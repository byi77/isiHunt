-- Groessere Reliktpunkte und deutlichere Serien-Jackpots.
--
-- Die vorherige Balance bleibt als historische Migration unveraendert. Die
-- aktuelle balance_config() wird aus ihr abgeleitet, damit alle sonstigen
-- Balance-Werte identisch bleiben und nur Score-relevante Werte steigen.

begin;

alter function public.balance_config() rename to balance_config_legacy;

create or replace function public.balance_config()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                public.balance_config_legacy(),
                '{rarities,poor,points}',
                '5'::jsonb
              ),
              '{rarities,common,points}',
              '10'::jsonb
            ),
            '{rarities,uncommon,points}',
            '25'::jsonb
          ),
          '{rarities,rare,points}',
          '60'::jsonb
        ),
        '{rarities,epic,points}',
        '150'::jsonb
      ),
      '{rarities,legendary,points}',
      '400'::jsonb
    ),
    '{score,comboTiers}',
    '[
      {"minCombo": 0, "multiplier": 1},
      {"minCombo": 2, "multiplier": 1.5},
      {"minCombo": 4, "multiplier": 2.2},
      {"minCombo": 7, "multiplier": 3.2},
      {"minCombo": 11, "multiplier": 4.5},
      {"minCombo": 16, "multiplier": 6}
    ]'::jsonb
  );
$$;

commit;
