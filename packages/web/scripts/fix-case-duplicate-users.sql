-- Sloučení pěti case-insensitive dvojic účtů — jednorázový skript, mimo deploy.
--
-- Provoz: spuštěno 19. 10. 2026 nejdřív na csld_test a pak na produkci (public),
-- pokaždé po vlastním pg_dumpu (backups/csld-test-schema-before-pair-merge-*.sql,
-- backups/csld-prod-before-pair-merge-*.sql). Výsledek: 5 shell řádků smazáno,
-- 7 kolizních hodnocení zahozeno, 2 přesunuta, 0 case-insensitive dvojic zbylo.
--
-- Použití: připlněte schéma cílové databáze (test = csld_test, produkce = public)
-- jako PRVNÍ příkaz téhož SQL streamu, např.
--   psql "$URL" -v ON_ERROR_STOP=1 -f <(echo 'set search_path to csld_test;'; cat tento_soubor)
-- Skript záměrně schéma nepřepíná sám — ať ho nejde omylem pustit na produkci.
--
-- Co dělá: starší účet s aktivitou (`keep`) si nechá historii, novější duplikát
-- (`drop`) se do něj sloučí a smaže. Hodnocení, která kolidují s `keep` (unique
-- index game_id+user_id), se zahodí — vyhrávají hodnoty `keep`. Heslo vyhrává
-- `keep`; kdo používal heslo druhého řádku, použije „Zapomenuté heslo" (mailbox má).
-- Zdůvodnění a data: docs/navrh-normalizace-emailu.md.

BEGIN;

-- Guard: bez všech deseti řádků se nic nestane. Chrání proti špatnému schématu
-- (např. omylem produkce), proti částečnému stavu a proti druhému spuštění.
DO $$
DECLARE present int;
DECLARE drops int;
BEGIN
  SELECT count(*) INTO present FROM csld_csld_user
   WHERE id IN (1103, 6320, 620, 105752, 1372, 102700, 634, 106804, 2469, 6336);
  SELECT count(*) INTO drops FROM csld_csld_user
   WHERE id IN (6320, 105752, 102700, 106804, 6336);
  IF present <> 10 OR drops <> 5 THEN
    RAISE EXCEPTION
      'fix-case-duplicate-users: expected all 10 pair rows (5 to drop), found % rows (% to drop) with search_path=% — wrong schema, or already merged',
      present, drops, current_setting('search_path');
  END IF;
END $$;

CREATE TEMP TABLE case_pairs (keep int, drop_id int) ON COMMIT DROP;
INSERT INTO case_pairs VALUES
  (1103, 6320), (620, 105752), (1372, 102700), (634, 106804), (2469, 6336);

-- 1) kolizní hodnocení pryč (unique index (game_id, user_id) by je nepustil)
DELETE FROM csld_rating r
 USING csld_rating k, case_pairs p
 WHERE r.user_id = p.drop_id AND k.user_id = p.keep AND r.game_id = k.game_id;

-- 2) přesunout, co zbylo
UPDATE csld_rating          r  SET user_id          = p.keep FROM case_pairs p WHERE r.user_id          = p.drop_id;
UPDATE csld_comment         c  SET user_id          = p.keep FROM case_pairs p WHERE c.user_id          = p.drop_id;
UPDATE csld_comment_upvote  v  SET user_id          = p.keep FROM case_pairs p WHERE v.user_id          = p.drop_id;
UPDATE csld_game_has_author g  SET id_user          = p.keep FROM case_pairs p WHERE g.id_user          = p.drop_id;
UPDATE csld_game            g  SET added_by         = p.keep FROM case_pairs p WHERE g.added_by         = p.drop_id;
UPDATE event                e  SET added_by         = p.keep FROM case_pairs p WHERE e.added_by         = p.drop_id;
UPDATE csld_photo           ph SET author           = p.keep FROM case_pairs p WHERE ph.author          = p.drop_id;
UPDATE csld_label           l  SET added_by         = p.keep FROM case_pairs p WHERE l.added_by         = p.drop_id;
UPDATE csld_article         a  SET author_id        = p.keep FROM case_pairs p WHERE a.author_id        = p.drop_id;
UPDATE csld_csld_group      gr SET administrator_id = p.keep FROM case_pairs p WHERE gr.administrator_id = p.drop_id;

-- 3) tokeny (magic link) a samotné řádky
DELETE FROM csld_email_authentication t USING case_pairs p WHERE t.user_id = p.drop_id;
DELETE FROM csld_csld_user u USING case_pairs p WHERE u.id = p.drop_id;

COMMIT;

-- Kontrola pro operátora: zachované účty a stav po sloučení.
SELECT u.id, u.email, (u.password = '') AS no_password,
       (SELECT count(*) FROM csld_rating r WHERE r.user_id = u.id) AS ratings
  FROM csld_csld_user u WHERE u.id IN (1103, 620, 1372, 634, 2469) ORDER BY u.id;

SELECT (SELECT count(*) FROM csld_csld_user WHERE id IN (6320, 105752, 102700, 106804, 6336)) AS drop_rows_left,
       (SELECT count(*) FROM (SELECT 1 FROM csld_csld_user WHERE email IS NOT NULL
                              GROUP BY lower(btrim(email)) HAVING count(*) > 1) d) AS duplicate_groups;
