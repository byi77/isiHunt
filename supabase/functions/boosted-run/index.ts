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
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, code: 'invalid_request', retryable: false }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('authorization');
  if (!url || !anonKey || !serviceRole || !authorization) return json({ ok: false, code: 'unauthorized', retryable: false }, 401);
  const auth = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await auth.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, code: 'unauthorized', retryable: false }, 401);
  let body: Record<string, unknown> | null;
  try { body = asRecord(await request.json()); } catch { body = null; }
  if (!body) return json({ ok: false, code: 'invalid_request', retryable: false }, 400);

  const service = createClient(url, serviceRole);
  let rpc: string;
  let parameters: Record<string, unknown>;
  if (body.action === 'start' && isUuid(body.requestId) && typeof body.worldId === 'string' && body.mode === 'solo') {
    rpc = 'start_boosted_run_internal';
    parameters = { p_profile_id: userData.user.id, p_request_id: body.requestId, p_world_id: body.worldId, p_mode: body.mode };
  } else if (body.action === 'abandon' && isUuid(body.runId)) {
    rpc = 'abandon_boosted_run_internal';
    parameters = { p_profile_id: userData.user.id, p_run_id: body.runId };
  } else if (body.action === 'finish' && isUuid(body.runId) && Number.isInteger(body.score) && Number.isInteger(body.bestCombo) && Number.isInteger(body.durationMs) && asRecord(body.collected) && Array.isArray(body.achievementIds) && body.achievementIds.every((id) => typeof id === 'string')) {
    rpc = 'finish_boosted_run_internal';
    parameters = {
      p_profile_id: userData.user.id, p_run_id: body.runId, p_score: body.score,
      p_best_combo: body.bestCombo, p_duration_ms: body.durationMs, p_collected: body.collected,
      p_achievement_ids: body.achievementIds,
    };
  } else {
    return json({ ok: false, code: 'invalid_request', retryable: false }, 400);
  }
  const { data, error } = await service.rpc(rpc, parameters);
  if (error || !data || typeof data !== 'object') return json({ ok: false, code: 'unavailable', retryable: true }, 503);
  return json(data, (data as { ok?: boolean }).ok ? 200 : 400);
});
