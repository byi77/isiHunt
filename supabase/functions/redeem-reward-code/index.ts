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

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[ -]/g, '');
  return /^\d{12}$/.test(normalized) ? normalized : null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
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
  if (request.method !== 'POST')
    return json({ ok: false, code: 'invalid_request', retryable: false }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('REWARD_CODE_HMAC_SECRET');
  if (!url || !anonKey || !serviceRole || !secret) {
    return json({ ok: false, code: 'unavailable', retryable: true }, 503);
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ ok: false, code: 'unauthorized', retryable: false }, 401);

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user)
    return json({ ok: false, code: 'unauthorized', retryable: false }, 401);

  let payload: { code?: unknown; requestId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, code: 'invalid_request', retryable: false }, 400);
  }
  const code = normalizeCode(payload.code);
  if (!code || !isUuid(payload.requestId))
    return json({ ok: false, code: 'invalid_request', retryable: false }, 400);

  // Die IP wird nur als nicht umkehrbarer, secret-gebundener Hash gespeichert.
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const [digest, networkHash] = await Promise.all([
    hmacHex(secret, `code:v1:${code}`),
    forwardedFor ? hmacHex(secret, `network:v1:${forwardedFor}`) : Promise.resolve(null),
  ]);
  const service = createClient(url, serviceRole);
  const { data, error } = await service.rpc('redeem_reward_code_internal', {
    p_profile_id: userData.user.id,
    p_code_digest: digest,
    p_suffix: code.slice(-4),
    p_request_id: payload.requestId,
    p_network_hash: networkHash,
  });
  if (error || !data || typeof data !== 'object') {
    return json({ ok: false, code: 'unavailable', retryable: true }, 503);
  }
  return json(data, (data as { ok?: boolean }).ok ? 200 : 400);
});
