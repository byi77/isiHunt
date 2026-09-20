import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function generateCode(): string {
  const digits: string[] = [];
  while (digits.length < 12) {
    const value = new Uint8Array(1);
    crypto.getRandomValues(value);
    const byte = value[0]!;
    if (byte < 250) digits.push(String(byte % 10));
  }
  return digits.join('');
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'invalid_request' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('REWARD_CODE_HMAC_SECRET');
  const authorization = request.headers.get('authorization');
  if (!url || !anonKey || !serviceRole || !secret || !authorization)
    return json({ error: 'unauthorized' }, 401);

  const auth = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData } = await auth.auth.getUser();
  if (!userData.user) return json({ error: 'unauthorized' }, 401);
  const service = createClient(url, serviceRole);

  // Die folgenden internen RPCs pruefen `profiles.is_admin` selbst unter
  // Service-Role-Gate (`reward_require_admin`). Der fruehere zweite Lookup
  // hier im Edge-Handler konnte bei einem frisch angelegten Profil trotz
  // gesetzter Rolle 403 liefern. Die DB bleibt damit die einzige autoritative
  // Berechtigungsentscheidung, ohne einen weniger verlaesslichen Doppelcheck.

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  if (body.action === 'createCampaign') {
    const { data, error } = await service.rpc('admin_create_reward_campaign_internal', {
      p_actor: userData.user.id,
      p_name: body.name,
      p_description: body.description ?? '',
      p_package: body.package,
      p_starts_at: body.startsAt,
      p_ends_at: body.endsAt,
      p_global_limit: body.globalLimit,
      p_account_limit: body.accountLimit,
    });
    return error ? json({ error: 'invalid_campaign' }, 400) : json({ campaignId: data });
  }

  if (
    body.action === 'setStatus' &&
    isUuid(body.campaignId) &&
    (body.status === 'active' || body.status === 'disabled')
  ) {
    const { error } = await service.rpc('admin_set_reward_campaign_status_internal', {
      p_actor: userData.user.id,
      p_campaign_id: body.campaignId,
      p_status: body.status,
    });
    return error ? json({ error: 'invalid_campaign' }, 400) : json({ ok: true });
  }

  if (
    body.action === 'generateCodes' &&
    isUuid(body.campaignId) &&
    Number.isInteger(body.count) &&
    Number(body.count) >= 1 &&
    Number(body.count) <= 1000 &&
    (body.boundProfileId === undefined ||
      body.boundProfileId === null ||
      isUuid(body.boundProfileId))
  ) {
    const rawCodes = Array.from({ length: Number(body.count) }, generateCode);
    const codes = await Promise.all(
      rawCodes.map(async (code) => ({
        digest: await hmacHex(secret, `code:v1:${code}`),
        suffix: code.slice(-4),
        keyVersion: 1,
      })),
    );
    const { error } = await service.rpc('admin_create_reward_codes_internal', {
      p_actor: userData.user.id,
      p_campaign_id: body.campaignId,
      p_codes: codes,
      p_bound_profile_id: body.boundProfileId ?? null,
    });
    // Klartext existiert nur in dieser einen expliziten Antwort und wird nie geloggt oder gespeichert.
    return error ? json({ error: 'invalid_codes' }, 400) : json({ codes: rawCodes });
  }
  return json({ error: 'invalid_request' }, 400);
});
