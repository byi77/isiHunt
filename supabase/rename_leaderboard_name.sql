-- Einmalig im Supabase SQL Editor ausfuehren.
-- Danach uebernimmt eine Namensaenderung im Profil den Namen auch in der Rangliste.

create or replace function public.rename_best_score(
  p_player_id   uuid,
  p_player_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_id is null or char_length(trim(p_player_name)) not between 1 and 16 then
    raise exception 'Ungueltiges Spielerprofil';
  end if;

  update public.scores
  set player_name = trim(p_player_name)
  where player_id = p_player_id;

  return true;
end;
$$;

revoke execute on function public.rename_best_score(uuid, text)
  from public;
grant execute on function public.rename_best_score(uuid, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
