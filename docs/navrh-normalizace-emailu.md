# Návrh: Normalizace e-mailů + case-insensitive hledání (krok 0)

**Verdikt: jde to na dva deploye a jeden ručně odsouhlasený skript.** Kód má **6 míst, kde se
hledá uživatel podle e-mailu** a **3 místa, kde se e-mail zapisuje**; přepíše se **351 řádků**;
**5 kolizních dvojic** je potřeba rozhodnout ručně (nejde o backfill, ale o smazání dvou účtů).

Pořadí je důležité: **nejdřív kód, potom data**. Kód je zpětně kompatibilní (nové hledání je
povolenější než dnešní), takže se nikdo „neztratí" v okně mezi deployi a případný rollback
aplikace funguje i po backfillu.

---

## Současný stav (produkce, `public`, 17. 10. 2026)

| Co | Počet |
| --- | --- |
| Účtů celkem | 3 182 |
| E-mail se liší od `lower(btrim(email))` (backfill je přepíše) | **351** |
| — z toho syntetické adresy staré aplikace (`…@larpovadatabaze.cz`) | 119 |
| — z toho reálné adresy | 232 |
| E-mail s mezerou na začátku/konci | 0 |
| E-mail s diakritikou (např. `jakubě@balhar.net`, `573Škodi@…`) | 27 (24 z toho mixed-case) |
| E-mail, který není adresa (bez `@` nebo `…_old`) | 53 (3 bez platného tvaru) |
| Kolizní dvojice po `lower(btrim(email))` | **5 dvojic / 10 účtů** |

### Kde všude se hledá podle e-mailu (case-sensitivně)

| # | Místo | Dnešní tvar | Důsledek |
| --- | --- | --- | --- |
| 1 | `resolvers/userMutation.ts:75–78` (`user.logIn`) | `findUnique({ where: { email: userName.toLowerCase() } })` | 351 účtů se **nepřihlásí heslem** |
| 2 | `resolvers/userMutation.ts:153–155` (`createUser`) | totéž na `input.email.toLowerCase()` | druhý účet přes registraci heslem |
| 3 | `resolvers/userMutation.ts:313–315` (`startRecoverPassword`) | totéž | účet nenajde → vrátí `true` a **žádný e-mail nedorazí** (tichý fail, heslo jim nejde obnovit) |
| 4 | `resolvers/userMutation.ts:401–403` (`startEmailLogin`) | totéž | magic link **vytvoří druhý účet** |
| 5 | `resolvers/user.ts:121–124` (`userByEmail`) | `findUnique({ where: { email: args.email } })` — **surový vstup, bez lowercase** | kontrola obsazenosti e-mailu (používá `useIsEmailAvailable` ve 3 komponentách: `SignUpPanel`, `UserSettingsPanel`, `GameEdit/NewAuthorModal`) řekne „volný" u účtu, který existuje → duplikát; a „přidat autora hry podle e-mailu" autora nenapáruje |
| 6 | `auth/passport.ts:19–22` (LocalStrategy) | `findUnique(email.toLowerCase())` | **mrtvý kód** — nic nikdy nevolá `passport.authenticate('local')` (ověřeno grepem); kvůli tomu se taky nikdy nespustí MD5→PBKDF2 upgrade z `passport.ts:33–39` |

### Kde se e-mail zapisuje

| Místo | Dnes | Chybí |
| --- | --- | --- |
| `userMutation.ts:172` (`createUser`) | `input.email.toLowerCase()` | `trim()` |
| `userMutation.ts:244` (`updateLoggedInUser`) | `input.email.toLowerCase()` | `trim()` |
| `userMutation.ts:392` (`startEmailLogin`) | `email.toLowerCase().trim()` | — (jen sjednotit přes helper) |
| `server.ts:297–301` (magic-link callback) | hledá podle **tokenu** | v pořádku |
| `auth/rememberMe.ts` | podle `id` | v pořádku |

### Tři dnešní chyby, které to způsobuje

1. **232 účtů s reálnou adresou a velkými písmeny se nemůže přihlásit heslem** (Passport i GraphQL
   resolver porovnávají lowercase vstup se surovým sloupcem). 119 syntetických je jedno.
2. **Přihlášení magic linkem u nich vyrobí druhý účet a data zůstanou v tom starém** —
   `startEmailLogin` nenajde nic, a protože `unique_email` je case-sensitivní, vytvoří nový řádek
   s prázdným heslem. Už se to stalo **5×**: `1103/6320` (clementois@), `2469/6336` (vojta1662000@)
   jsou jasné magic-link shelly (prázdné heslo, jméno = část před zavináčem), `620/105752`,
   `1372/102700`, `634/106804` jsou zjevně importované dvojice (obě strany mají heslo).
3. **Stejnou dírou projde i registrace heslem**, protože `userByEmail` (kontrola obsazenosti)
   porovnává přesně: uživatel napíše `cilkaj@seznam.cz`, formulář řekne „volný", `createUser`
   založí druhý účet.

### Čeho se normalizace nedotkne

- **Hesla se nerozbijí.** PBKDF2 formát je `iterations:saltHex:hashHex` — sůl je uložená v hashi,
  takže změna e-mailu v DB ověření nijak neovlivní (`auth/password.ts:43–58`).
- `csld_email_authentication` (magic link) i `rememberMe` míří na `user_id`, ne na e-mail.
- Žádná změna GraphQL schématu → **žádný `yarn codegen`**, žádné i18n klíče, žádná UI změna.
- `amount_of_comments/played/created` jsou legacy denormalizované sloupce; `user.ts:58–61` je už
  dopočítává z `csld_rating`, takže sloučení účtů nevyžaduje přepočet čítačů.

## Návrh 1 — jeden helper místo šesti hledání

Nový soubor `packages/web/src/api/src/auth/emailLookup.ts`:

```ts
export function normalizeEmail(raw: string): string   // trim + toLowerCase

/** Hlavní kandidát: přesná shoda → jinak case-insensitive shody. */
export async function findUserByEmail(db, rawEmail): Promise<Row | null>

/** Všichni kandidáti (pro login, kde o účtu rozhodne heslo). */
export async function findUserCandidatesByEmail(db, rawEmail): Promise<Row[]>
```

Kontrakt:

1. `findUnique({ where: { email: normalizeEmail(raw) } })` jako rychlá cesta (index `unique_email`).
2. Když nic nenajde → `findMany({ where: { email: { equals: normalized, mode: 'insensitive' } }, take: 2 })`
   jako **přechodová záchrana pro legacy řádky uložené s velkými písmeny**.
3. `findUserByEmail` při více shodách vrátí deterministického kandidáta a **zaloguje varování**
   (default: řádek s neprázdným heslem, jinak nejnižší `id` = nejstarší účet, což je vždycky ten
   s historií — ověřeno na všech 5 dvojicích).
4. `user.logIn` projde **všechny kandidáty** a přihlásí toho, jehož hash odpovídá zadanému heslu.
   Tím se dvojice `1103/6320` opraví okamžitě (uživatel píše lowercase → přesná shoda míří na
   shell `6320`, ale heslo projde jen na `1103`) a je to bezpečné — rozhoduje důkaz heslem.

Proč ne jen přesná shoda na lowercase datech: do backfillu by 232 reálných účtů zůstalo mimo hru.

**Jak je to implementováno (a co z toho vyplynulo):**

- Helper **nepoužívá `mode: 'insensitive'`**. To je v Prismě `ILIKE`, kde `%` a `_` ve vstupu
  fungují jako divoké znaky — a `_` je v adresách běžné. Přihlášení magic linkem by pak u adresy
  jako `jan_novak@seznam.cz` mohlo vytvořit token pro *cizí* řádek `janXnovak@seznam.cz` a poslat
  odkaz na adresu, kterou útočník vlastní. Místo toho se porovnává přesně:
  `lower(btrim(email)) = lower(btrim(vstup))` — stejná normalizace jako v migraci, žádné divoké znaky.
- **Přesná shoda nesmí být rychlá cesta před fallbackem.** První verze dělala `findUnique`
  na normalizovanou adresu a fallback jen když nic nenašla; test ji shodil: u dvojice `1103/6320`
  je lowercased forma právě magic-link *shell*, takže by přihlášení mířilo na prázdný účet
  a skutečný uživatel by se heslem nedostal dovnitř. Lookup proto vždy hledá přes
  `lower(btrim(...))` a vrací všechny kandidáty; o účtu rozhodne heslo (login) nebo pravidlo
  „s heslem, jinak nejstarší" (ostatní cesty).
- **Cena:** `EXPLAIN (ANALYZE)` na produkčních datech (3 182 řádků) = **Seq Scan, ~5 ms**;
  přesná shoda na sloupci je Index Scan 0,08 ms. Dokud funkční index neexistuje, platí se těch
  ~5 ms na přihlášení a na kontrolu obsazenosti e-mailu ve formuláři. Je to vědomé: varianta
  bez indexu je bezpečná okamžitě, index patří do kroku 3/5 (po sloučení dvojic).
- **Testovací dvojníci:** resolver `updateLoggedInUser` teď volá `$queryRaw`, a to je kontrakt,
  který musí umět i ručně psané fake DB v testech komponent
  (`src/components/Profile/tests/userGenderSetting.test.ts`) — dvojník tam byl rozšířen o
  `$queryRaw` + `findMany`, skutečné SQL pokrývá DB suite
  (`src/api/src/__tests__/emailCaseInsensitive.test.ts`).

## Návrh 2 — zápis vždy normalizovaně

`normalizeEmail()` na třech místech (`createUser`, `updateLoggedInUser`, `startEmailLogin`),
u nově zakládaných i upravovaných účtů. `passport.ts` (mrtvá strategie) srovnat na stejný helper,
aby se při případném oživení nevrátila chyba zpět.

## Návrh 3 — backfill jako migrace s guardem

`packages/web/prisma/migrations/20261018120000_normalize_user_email/migration.sql`
(stejný styl jako `20261017100000_track_user_sessions`):

```sql
-- Normalize user e-mails to lower(btrim(e-mail)).
--
-- The guard below is the important part: `unique_email` is case-sensitive, so if
-- a case-insensitive duplicate is still present the UPDATE dies with an opaque
-- unique violation. Fail with a sentence a human can act on instead.

DO $$
DECLARE dups int;
BEGIN
  SELECT count(*) INTO dups FROM (
    SELECT lower(btrim(email)) FROM csld_csld_user
    WHERE email IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF dups > 0 THEN
    RAISE EXCEPTION 'normalize_user_email: % case-insensitive duplicate(s) still present — merge them first (scripts/fix-case-duplicate-users.sql)', dups;
  END IF;
END $$;

UPDATE csld_csld_user
SET email = lower(btrim(email))
WHERE email IS NOT NULL AND email <> lower(btrim(email));
```

**Runbook, když guard v deployi vystřelí** (tedy někdo nasadil migraci před sloučením dvojic):
Prisma si neúspěšnou migraci zapíše a **další migrace neproběhnou**, dokud se nevyřeší
(„New migrations cannot be applied before the error is recovered from"). Postup je
`npx prisma migrate resolve --rolled-back 20261018120000_normalize_user_email`, potom sloučení
dvojic a znovu deploy. Ověřeno v rehearsal níže.

- Přepíše **351 řádků**, je idempotentní (druhý běh 0 řádků).
- Guard je to podstatné: bez něj by migrace spadla na `unique_email` a deploy by skončil
  nesrozumitelnou chybou (workflow na to má `exit 1`, takže by to člověk viděl — ale ne co s tím).
- Diakritika: `lower()` v Postgresu vs `toLowerCase()` v JS se u českých znaků (`Š`, `á`, `ě`)
  shodují; 24 mixed-case adres s diakritikou je důvod, proč po backfillu spustit kontrolu
  (`select count(*) … where email <> lower(btrim(email))` → 0), ne to předpokládat.

## Návrh 4 — pět dvojic (jednorázový skript, ruční odsouhlasení)

Data (produkce):

| Dvojice (zachovat ← smazat) | Zachovat: aktivita | Smazat: co na něm je |
| --- | --- | --- |
| `1103 Clementois@…` ← `6320 clementois@…` | 30 hodnocení, 5 tokenů, obrázek, „Eliška Klementová" | 3 hodnocení, **prázdné heslo** (magic-link shell), 0 komentářů |
| `620 gaome@…` ← `105752 Gaome@…` | 6 hodnocení, bio, město, obrázek, 1 token | 0 hodnocení, 0 všeho |
| `1372 gyvermek@…` ← `102700 Gyvermek@…` | 1 hodnocení, obrázek, 4 tokeny | 0 hodnocení, 0 všeho |
| `634 kelghor@…` ← `106804 Kelghor@…` | 7 hodnocení, 3 autorství, bio, obrázek | 0 hodnocení, 0 všeho |
| `2469 Vojta1662000@…` ← `6336 vojta1662000@…` | 10 hodnocení, obrázek | 6 hodnocení, **prázdné heslo** (magic-link shell) |

Ve všech pěti případech je „zachovat" **starší, aktivní účet**; pět „smazat" řádků dohromady drží
jen 9 hodnocení a jinak nic (komentáře 0, upvoty 0, autorství 0, přidané hry 0, akce 0, články 0,
fotky 0, tokeny 0 — ověřeno dotazem).

**Past:** `csld_rating` má unique index `(game_id, user_id)`, takže přesun hodnocení nejde naslepo:
u `1103/6320` koliduje hra 710, u `2469/6336` koliduje všech 6 her (659, 1289, 1496, 48750, 51000,
54455). Skript proto nejdřív smaže kolizní hodnocení a teprve pak přesune zbytek
(**2 hodnocení se přesunou, 7 se zahodí** — vyhrávají hodnoty „zachovat" účtu).

Skript `packages/web/scripts/fix-case-duplicate-users.sql` (spouští se ručně, mimo deploy,
s vlastním `pg_dump` předem):

```sql
BEGIN;

CREATE TEMP TABLE case_pairs (keep int, drop_id int) ON COMMIT DROP;
INSERT INTO case_pairs VALUES
  (1103, 6320), (620, 105752), (1372, 102700), (634, 106804), (2469, 6336);

-- 1) kolizní hodnocení pryč (unique index (game_id, user_id))
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
```

Předpoklady a důsledky, které je potřeba odsouhlasit:

- **Heslo vyhrává to „zachovat" účtu.** U `620/105752`, `1372/102700`, `634/106804` měla druhá
  strana vlastní heslo — kdo si zvykl na něj, použije „Zapomenuté heslo" (mailbox má).
- Hodnoty hodnocení v kolizních hrách zůstávají z účtu „zachovat" (u `2469/6336` jde o 6 her,
  kde se hodnoty liší, např. hra 659: 9 vs. 10). Alternativa je brát maximum — výchozí je
  neměnit hodnoty zachovávaného účtu.
- Sloučení **není** vratné z dat samotných (case už nevrátíš) → proto vlastní dump předem;
  deploy si sice bere `pg_dump` automaticky, ale tenhle krok běží mimo deploy.

## Návrh 5 (volitelně) — trvalá pojistka na úrovni DB

Aby se normalizace nemohla vrátit (ruční `INSERT` ze skriptu, import), funkční unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS user_email_lower_uniq ON csld_csld_user (lower(email));
```

**Ověřeno proti oběma drift gateům** (PostgreSQL 18 + Prisma 6.19.3, migrační historie z repa):
- post-deploy gate v `deploy-*.yml` (`migrate diff --from-url … --to-schema-datamodel … --script`):
  „This is an empty migration.", 0 nekomentářových řádků;
- PR gate v `test.yml` (`migrate diff --from-migrations prisma/migrations --to-schema-datamodel …
  --shadow-database-url … --script`, jiný směr a jiný příkaz): také 0 nekomentářových řádků.

Prisma expression indexy neumí, takže je ignoruje v obou směrech. Kontrolní pokus s přebytečným
sloupcem drift vyhlásil, takže gates fungují. Index ale **nelze zapsat do `schema.prisma`**, takže
zůstane jen v SQL migraci — při budoucím `prisma migrate dev` na jiném stroji se musí vytvořit znovu.
Když se do helperu přidá fallback přes `lower(email) =` (raw query), použije se stejný index.

## Pořadí kroků

Rozdělené do dvou PR, protože mezi nimi leží nevratný krok (sloučení účtů):

**PR 1 — jen kód, žádná migrace** (`emailLookup.ts`, `userMutation.ts`, `user.ts`, `passport.ts`,
testy). Nic se nedotýká dat, takže ho může nasadit automatický test deploy bez rizika a rollback
je revert commitu. Tímhle PR se 232 účtům přihlášení *opraví*, nikomu se nerozbije.

**PR 2 — data** (skript na sloučení dvojic + backfill migrace + volitelný index). Pozor na
pořadí, protože merge do `main` spouští test deploy:
1. Sloučení 5 dvojic na **testu** (`csld_test` je kopie produkce → zkouška naslepo) + ověření.
2. Sloučení 5 dvojic na **produkci**, s vlastním `pg_dump` předem (deploy si svůj bere, ale tenhle
   krok běží mimo deploy) + ověření.
3. Teprve pak merge PR 2: backfill migrace se aplikuje na test (guard projde) a ručním
   „Deploy to Production" na produkci.
4. Ověření: `select count(*) from csld_csld_user where email <> lower(btrim(email))` = 0 na obou.

Kdyby se PR 2 mergnul **před** krokem 1, automatický test deploy spadne na guardu a Prisma
zablokuje další migrace na testu, dokud se neudělá `migrate resolve --rolled-back` (postup výše).

Proč kód první: `findUserByEmail` je **nadmnožina** dnešního chování (case-insensitive shoda
místo přesné), takže v okně mezi PR 1 a backfillem se 232 účtům přihlášení *opraví*, nikomu se
nerozbije; a rollback aplikace po backfillu je také bezpečný, protože staré hledání dělá
`lower(vstup)` a v DB už budou všechna e-maily lowercase — čili i starý kód je po backfillu
*funkčnější*, ne rozbitý.

**Rollback:** PR 1 revert commitu (bez dopadu na data); sloučení dvojic obnova z dumpu (jen řádky
účtů); backfill netřeba vracet (lowercase je idempotentní a neškodí), případně z dumpu; index
`DROP INDEX`.

## Testy a ověření

Testy (API sada, `yarn test:api`, vzor `src/api/src/__tests__/`):

- nový `emailLookup.test.ts`: `normalizeEmail` (mezery, velká písmena, diakritika) + kontrakt
  helperu (přesná shoda vyhrává; více shod → deterministický kandidát + log; nejednoznačnost
  se nevyřeší „naslepo").
- `minimalSignup.test.ts` / `auth.test.ts`: registrace s e-mailem v jiné velikosti → `VALIDATION_FAILED`;
  magic link na účet uložený s velkými písmeny → **stejný účet, žádný nový řádek**; login heslem
  u mixed-case účtu projde.
- Guard pro `userByEmail`: jiná velikost písmen → stejný uživatel (to je ta cesta, která dnes
  vyrábí duplikáty).

Živé ověření na testu `csld.vezlute.cz` (test DB je kopie produkce, takže má stejných 351 řádků):

```text
POST /graphql {"query":"query { userByEmail(email: \"Cilkaj@seznam.cz\") { id email } }"}
POST /graphql {"query":"query { userByEmail(email: \"cilkaj@seznam.cz\") { id email } }"}
```
→ před změnou vrátí jen první volání uživatele, po změně **obě stejné `id`**.

Pro krok 2 stačí po každé dvojici ověřit: `csld_rating` na smazaném id je 0, na zachovaném
původní + přesunutá, a v `csld_email_authentication` nezůstal token smazaného účtu.

### Rehearsal (provedeno lokálně 18. 10. 2026)

Celý postup jsem předehrál na scratch DB (PostgreSQL 18, Prisma 6.19.3) s migrační historií
z repa a daty, která odpovídají produkci (10 řádků pěti dvojic + 4 běžné mixed-case účty
+ překryvy hodnocení + token na shell účtu):

| Krok | Výsledek |
| --- | --- |
| `prisma migrate deploy` s migrací před sloučením | **guard vystřelil** přesně mou zprávou: `ERROR: normalize_user_email: 5 case-insensitive duplicate(s) still present — merge them first (scripts/fix-case-duplicate-users.sql)` a Prisma zablokovalo další migrace |
| `prisma migrate resolve --rolled-back …` | „migration … marked as rolled back" — obnova podle runbooku výše |
| `merge_pairs.sql` (všech 5 dvojic) | proběhl bez chyby i s unique indexem `(game_id, user_id)` |
| `prisma migrate deploy` podruhé | guard prošel, backfill aplikován |
| Kontrola dat | 14 → 9 účtů, `count(*) where email <> lower(btrim(email))` = **0**, hodnocení `1103` = 3 (původní hra 710 zůstala, 2 přesunuté, 1 kolizní smazaná), `2469` = 6 (6 kolizních smazaných), tokeny smazaných účtů = 0 |
| Case-variantní `INSERT` bez funkčního indexu | **prošel** (holý `unique_email` duplikát v jiné velikosti nezachytí) |
| Totéž po `CREATE UNIQUE INDEX … (lower(email))` | **spadlo** na `duplicate key value violates unique constraint "user_email_lower_uniq"` |
| Drift gate (`migrate diff --from-url … --to-schema-datamodel … --script`, přesně jako ve workflow) s funkčním indexem | `-- This is an empty migration.`, 0 nekomentářových řádků → gate nespadne |

Scratch DB i role byly po rehearsal smazány; produkce ani test se rehearsal nedotkly (žádný
zápis, jen čtení).

## Otevřená rozhodnutí (s navrženým defaultem)

1. **Sloučení 5 dvojic** (mazání účtů v produkci) — default podle tabulky výše (starší aktivní účet
   zůstává, hodnoty jeho hodnocení vyhrávají). Potřebuji explicitní „ano".
2. **Politika nejednoznačné shody** — default: přesná shoda → jinak kandidát s neprázdným heslem →
   jinak nejnižší `id`, vždy s logem; login zkouší heslo proti všem kandidátům.
3. **Funkční unique index** — default: ano (ověřeno proti drift gate), jako trvalá pojistka.
4. **Mrtvá LocalStrategy** (`passport.ts`) — default: srovnat na helper a nechat být; smazat ji
   je samostatné rozhodnutí (a s ní i otázka MD5→PBKDF2 upgradu, viz níže).
5. **Rehearsal na testu před produkcí** — default: ano, u kroku 2 i 3.

## Ověřeno / neověřeno

**Ověřeno:** všechna čísla dotazy do produkční DB (read-only přes SSH, schéma `public`); mrtvost
`passport.authenticate` (grep celého repa); unique index `csld_rating (game_id, user_id)` a seznam
FK tabulek; dnešní chování všech 6 hledání a 3 zápisů v kódu; **celý navržený postup předehraný
na scratch DB** (guard vystřelí při `prisma migrate deploy` a zablokuje další migrace, runbook
`migrate resolve --rolled-back` zabere, sloučení dvojic projde i s unique indexem, backfill
proběhne, funkční index case-variantu odmítne a drift gate zůstane čistý).

**Neověřeno:** že se v Postgresu a JS shoduje `lower()`/`toLowerCase()` pro *všechny* znaky
v datech (proto kontrolní dotaz po backfillu; rehearsal jel na ASCII + `ě`); přesná data testovací
DB (předpokládá se kopie produkce — před krokem 2 se to ověří dotazem); chování při souběhu
(přihlášená session během backfillu — e-mail v session se nemění, takže se nic neděje, ale
nezkoušel jsem to na živém provozu).

## Vedlejší nález (nesouvisí, ale leží ve stejné funkci)

`passport.ts` je **mrtvá cesta** — nikdo nevolá `passport.authenticate('local')`, login jde přes
`logInResolver`. Důsledek: **MD5→PBKDF2 upgrade z `passport.ts:33–39` se nikdy nespustí, takže
461 účtů s legacy MD5 hashem zůstává na MD5 navždy.** Oprava je ~15 řádků v `logInResolver`
(převzít upgrade z mrtvé strategie + test v `password.test.ts`). Doporučuji jako samostatný,
nezávislý krok — klidně hned po této normalizaci.
