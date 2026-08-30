-- Phase 2.37: gemeinsamer Realtime-Kanal fuer beide Duellteilnehmer.
--
-- RPCs bleiben ueber individuelle Teilnehmer-Tokens geschuetzt. Broadcast
-- und Presence muessen dagegen denselben Kanal verwenden: Host und Gast
-- erhalten beim Erzeugen/Beitreten denselben serverseitigen Seed, waehrend
-- ihre Tokens absichtlich verschieden sind.

begin;

do $$
begin
  if to_regclass('public.isihunt_schema_state') is null
     or not exists (
       select 1 from public.isihunt_schema_state
       where singleton = true and schema_version = 36
     ) then
    raise exception 'Phase 2.36 muss vor Phase 2.37 ausgefuehrt werden';
  end if;
end;
$$;

-- Der Client abonniert CODE:SEED. Der Seed ist beiden Teilnehmern bereits
-- durch create/join/accept/rematch bekannt; die Policy bindet ihn hier exakt
-- an den Raum und laesst keinen Code-only-Fallback zu.
create or replace function public.duel_channel_is_authorized(p_topic text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.duel_rooms
    where code = split_part(p_topic, ':', 1)
      and seed = split_part(p_topic, ':', 2)
      and split_part(p_topic, ':', 3) = ''
      and expires_at > now()
  );
$$;

revoke execute on function public.duel_channel_is_authorized(text) from public;
grant execute on function public.duel_channel_is_authorized(text) to anon, authenticated;

update public.isihunt_schema_state
set schema_version = 37,
    migration_name = 'phase_2_37_duel_shared_realtime_topic.sql',
    applied_at = now()
where singleton = true;

commit;
notify pgrst, 'reload schema';
