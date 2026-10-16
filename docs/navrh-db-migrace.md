# Návrh: Systematické DB změny v deployi (Prisma Migrate)

Cíl: databázové změny (schéma **i data**) jako standardní, reviewovatelná část
deploye — ne ad-hoc `db push --accept-data-loss` plus ruční SQL přes SSH.

## Současný stav (co dnes bolí)

Deploy test (`deploy-test.yml`, po mergi) i prod (`deploy-production.yml`,
manuální) dnes dělají tohle:

1. GH runner: `prisma db push --accept-data-loss` proti prázdnému kontejneru
   (aby testy měly schéma).
2. Na serveru: pg_dump backup (jen prod), pak zase
   `prisma db push --accept-data-loss` proti živé DB.
3. Po startu: drift check (`prisma migrate diff`) jako pojistka.

Problémy:

- **`db push` je deklarativní synchronizace, ne migrace.** Vygeneruje SQL
  on-the-fly z rozdílu schema.prisma vs. DB a nikdo ho nevidí předem.
  `--accept-data-loss` navíc tiše dropne sloupec, když ho někdo ze schématu
  odebere — v reviewi PR je vidět změna `schema.prisma`, ne SQL, který
  poběží nad produkcí.
- **Datové změny nemají kam patřit.** `db push` vytvoří sloupec, ale nikdy
  nemigruje data (`registration_status` backfill, normalizace entit v
  perexech článků, `created_at` pro `csld_email_authentication` — vše se
  dělalo ručně přes SSH a zůstalo jen v hlase chatu). Uvidí to jen autor
  deploye, nikdo jiný.
- **Žádné pořadí ani historie.** Když se sejde více schématových změn, běží
  jeden souhrnný diff; když deploy failne uprostřed, neexistuje záznam,
  co už proběhlo (drift check to jen konstatuje po vině).

## Návrh: SQL migrace v repu, aplikované `prisma migrate deploy`

Standardní Prisma Migrate workflow — SQL soubory jsou v repu, reviewované
v PR, aplikované deployem v daném pořadí, se záznamem o stavu v tabulce
`_prisma_migrations`.

### Struktura

```
packages/web/prisma/migrations/
  20260901000000_init/migration.sql          ← baseline (viz fáze 1)
  20261016120000_add_articles/migration.sql  ← první opravdová migrace
```

Každá migrace = adresář s `migration.sql`, běží v jedné transakci,
aplikuje se právě jednou (hlídá `_prisma_migrations`), selže-li, deploy
zastaví a nic dalšího neproběhne.

### Vývojářský workflow (ta „systematická" část)

1. Změna schématu: edit `schema.prisma` + `yarn prisma migrate dev --name xyz`
   → Prisma vygeneruje `migrations/<ts>_xyz/migration.sql`.
2. **Datová změna patří do stejného souboru.** Vygenerované SQL doplním
   ručně o `UPDATE ... SET ... WHERE ...` (Prisma soubor spustí tak, jak je).
   Příklady z historie, které by dnes byly migrace: `registration_status`
   backfill, `ALTER TABLE csld_email_authentication ADD created_at`,
   normalizace entit v perexech.
3. Do PR jde **schema.prisma + migration.sql** — reviewer v diffu vidí
   přesně SQL, který poběží nad produkcí. To je hlavní bezpečnostní zisk:
   dnes vidí jen deklaraci, ne provedení.
4. Merge → test deploy aplikuje migrace automaticky; prod deploy (manuální)
   aplikuje tutéž sadu stejným mechanismem.
5. Aplikovanou migraci nikdy needitujeme — nová migrace na opravu.

### Změny ve workflolech

**`deploy-test.yml` + `deploy-production.yml`** (oba stejně):

- GH runner: `npx prisma db push --accept-data-loss` → `npx prisma migrate deploy`
  (runner taky ověří, že migrace jdou aplikovat na čistou DB — chytí migraci,
  která předpokládá data, která nemají existovat).
- Na serveru: v SSH bloku po pg_dump backupu (prod) / před startem (test)
  `npx prisma db push --accept-data-loss` → `npx prisma migrate deploy`.
  Backup zůstává jako rollback mechanismus (migrace nejsou automaticky
  vratné; pg_dump je záchrana).
- `--accept-data-loss` z workflow mizí úplně. `db push` zůstává jen jako
  dokumentovaný nouzový nástroj pro ruční použití (runbook), ne v pipeline.
- Drift verify step zůstává (=`migrate diff`), nyní ale kontroluje i
  konzistenci migrací se schématem.

**`test.yml`** (PR gate) — nový krok navíc:

```yaml
- name: Migrations must match schema.prisma
  working-directory: packages/web
  run: |
    npx prisma migrate diff \
      --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
      --shadow-database-url postgresql://csld:csld@localhost:5432/csld_shadow \
      --script > /tmp/drift.sql
    if grep -v '^--' /tmp/drift.sql | grep -q .; then
      cat /tmp/drift.sql; exit 1
    fi
```

Tohle je páka celého návrhu: **PR nejde mergnout, když schema.prisma
a migrace driftnuly** (někdo změnil schéma bez migrace). Dnes se taková
zrada projeví až `db push`em na produkcí.

### Fázové nasazení

1. **Baseline** (malý PR sám o sobě):
   - `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
     → `migrations/0_init/migration.sql` (baseline = dnešní main, produktivní
     DB mu odpovídá).
   - Na testu i prode: `npx prisma migrate resolve --applied 0_init` — označí
     baseline za aplikovaný, nic nespouští.
   - Lokální dev DB: totéž resolve.
2. **První opravdová migrace = články** (`feat/articles-metadata`): do PR
   přidám `migrations/<ts>_add_articles/migration.sql` s DDL, které dnes
   držím v repu jen implicitně (tabulky jsem vytvořil lokálně ručně).
   Lokálně tabulky dropnu a nechám migraci je vytvořit — ověří se celý
   mechanismus na první reálné změně.
3. **Přepnutí workflow** (deploy-test, deploy-production, test.yml) — až
   po mergi článků, aby baseline odpovídal realitě všech prostředí.
4. **Hotovo** — každá další DB změna jde standardně přes migrace.

### Gotchy k ověření při implementaci

- **Test sdílí instanci s produkcí** (`?schema=csld_test` v URL): Prisma
  zakládá `_prisma_migrations` ve schématu z URL (search_path), takže test
  a prod povedou oddělené historie — dobré. Ověřit na testu v první fázi.
- **Shadow databáze pro `migrate dev`**: Prisma při vývoji potřebuje právo
  `CREATE DATABASE` (lokální uživatel `csld` ho má — tabulky vytvářel).
  Na produkci `migrate deploy` shadow nepotřebuje.
- **Dlouhé `UPDATE` nad produkcí**: velký backfill zamkne tabulku; masivní
  datové migrace dávkovat (`LIMIT`/`WHERE id BETWEEN` smyčkou) a případně
  spustit předem ručně — v migraci pak zůstane jen levná pojistka.
- **`flyway_schema_history`** v DB je dědictví Javy — Prisma si vede vlastní
  `_prisma_migrations`, nedotkneme se ji.

## Zamítnutá alternativa

Ponechat `db push` pro schéma a přidat vedle konvenci `db/migrations/*.sql`
aplikovanou vlastním skriptem (jako dnes ruční SQL, jen automatizované).
Zamítnuto: dvě paralelní mechanismy, které musí držet krok; Prisma Migrate
je standardní cesta, repo už je celé na Prismě, a shadow-DB kontrola v CI
(`from-migrations` vs `schema.prisma`) je zdarma.

## Otevřená rozhodnutí (s navrženým defaultem)

1. **Baseline z main, články jako první migrace** (default), ne baseline
   zahrnující články — produktivní DB dnes odpovídá mainu a resolve pak
   sedne na všech prostředích bez ručních výjimek.
2. **Lokální vývoj přepnout na `migrate dev`** (default) — včetně shadow DB;
   `db push` lokálně zakázat konvencí, jinak si lokální DB vytvoří drift,
   který CI guard odmítne.
3. **Nouzový `db push --accept-data-loss` zůstává** jako ruční runbook
   (default: ano) — pro případ opravy driftu mimo migrace; nikdy v pipeline.
4. **pg_dump zavedeme i testu** (default: ano) — dnes ho dělá jen prod; když
   na testu migrace rozbrečí data, rsync ze starého backupu není.
