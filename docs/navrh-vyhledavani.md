# Návrh: vyhledávání tak, aby se daly najít i konkrétní lidé a akce

**Rozsah:** analýza dnešního stavu + návrh. Žádný kód jsem nepsal.
**Datum:** 2026-10-08 · **Zdroj důkazů:** produkce `https://larpovadatabaze.cz` (veřejné GraphQL API + UI v prohlížeči) a kód v `main`.

## 1. Jak vyhledávání funguje dnes

Data v produkci: **1512 her, 2733 akcí, ~3200 uživatelů**.

| Kde | Kód | Co dělá |
| --- | --- | --- |
| Hry | `packages/api/src/resolvers/game.ts:161` (`byQuery`), `:175` (`byQueryWithTotal`) | jediná podmínka `name contains query, mode: 'insensitive'`; řazení `total_rating desc` |
| Lidé | `packages/api/src/resolvers/user.ts:126` (`usersByQuery`) | `OR(name contains, nickname contains)`, **bez `ORDER BY`** |
| Skupiny | `packages/api/src/resolvers/group.ts:28` | existuje v API, v UI jen autocomplete u hry |
| Akce | `packages/api/src/schema.graphql:8` (`eventCalendar`) | **textové hledání neexistuje** — jen datum + štítky |
| Katalog her | `packages/api/src/resolvers/gameCatalog.ts:142` | `filter.query` funguje, ale v UI na něj není pole |

Klíčové souvislosti v UI:

- Horní našeptávač (`HeaderSearchForm.tsx:120` → `searchGamesQuery.graphql`) **hledá jen hry**. Jméno člověka nebo akce se v něm nikdy neobjeví. Minimální délka 3 znaky (`HeaderSearchForm.tsx:105`).
- Stránka `/search` má taby Hry/Uživatelé (`SearchPanel.tsx:42-53`), ale **tab není v URL** — reload nebo poslaný odkaz vždy skončí na Hrách.
- V horní navigaci (`PageHeader.tsx:195-215`) **není na `/search` žádný odkaz**. Kdo neví, že má stisknout Enter v našeptávači, tab s uživateli nenajde.
- Kalendář (`CalendarPanel.tsx`, filtry ~ř. 570-670) umí kdy / délka / místo / stav / štítky. **Žádné textové pole.** 2733 akcí se dá jen prolistovat.
- Katalog her: stav i API textový filtr podporují (`catalogState.ts:113` → `?q=`, `CatalogPanel.tsx:316` zobrazí chip „aktivní filtr“), ale `CatalogFilterPanel.tsx` **nemá input, kterým by se zadal**.

### 1.1 Živé důkazy z produkce

1. **Diakritika rozhoduje o všem.**
   - `usersByQuery("novak")` → 2 lidé (Karel Novak, Veronika Novakova).
   - `usersByQuery("Novák")` → Ondřej Novák, Antonín Novák, Matěj Novák, Jozef Novák…
   - Diakritiku má **72 % jmen uživatelů** (vzorek 600), **63 % názvů her** (400), **64 % názvů akcí** (600).
   - Kdo píše bez diakritiky (na klávesnici běžné), nenajde tři čtvrtiny lidí.
2. **Nápověda přímo v aplikaci slibuje něco jiného, než co kód dělá.** `common.json:607` (a příklady `example1–3` na ř. 612-614) tvrdí: „Hledání probíhá po slovech. Vyhovují ty položky, jejichž název obsahuje slova začínající stejně, jako slova výrazu… Velikost písmen a diakritika nerozhoduje.“ Ověřeno proti produkci:
   - `he whe` → **0** (má najít *Hell on Wheels*)
   - `na so` → **0** (má najít *Národ Sobě*, *NarutoLARP 2020: Soumrak shinobi*)
   - `D L B` → **0** (má najít *De la Bête*)
   - `bete` → **0**, `Bête` → **1** (*De la Bête*)
   Všechny tři vlastní příklady vrací nula.
3. **Záleží na pořadí slov** (celý dotaz je jeden substring): `Jozef Novák` → 1, `Novák Jozef` → **0**, `novak jozef` → **0**.
4. **Žádná relevance.** `usersByQuery("Manik")` → 3 lidé v pořadí podle id, ne podle kvality shody. Dotaz `a` v UI ukáže jako prvních 10 lidí pořadí vložení (Jakub Balhar, Tereza Marková, Jakub Korbel…) — náhodné lidi.
5. **Bez diakritiky se nenačte ani autor u hry.** Autocomplete autorů (`AuthorsAutoCompleteField.tsx` → `searchAuthors.graphql`) jde přes stejné `usersByQuery`: kdo u hry napíše „novak“, autora nenajde a **založí duplikát**. V datech už duplicity jsou (např. „Michal Havelka“ 2×, id 5 a 2361).
6. **Hledá se jen v názvu.** Hry nejdou najít podle autora, lidé podle města, akce podle místa — přitom `loc` je vyplněné u 600/600 vzorku akcí a popis u 599/600.
7. **Prázdný dotaz vrací celou databázi.** `usersByQuery("")` vrátí všechny uživatele, `groupsByQuery("")` všechny skupiny, `byQuery("")` všechny hry (1512). E-mail je sice guardovaný (`index.ts:139-153`), ale jména a města se dají procházet dál. Minimální délku dotazu API nemá (našeptávač ji má vlastní = 3).

## 2. Návrh

Princip: **jedno pravidlo shody pro všechny typy obsahu** a jedna společná vyhledávací funkce, kterou použijí hry, lidé, akce i skupiny.

### Pravidla shody (nová, jednotná)

- **Normalizace:** bez diakritiky + bez ohledu na velikost písmen. Řeším `translate()` v SQL dotazu — bez rozšíření, bez změny schématu, bez backfillu. (`unaccent` je volitelné vylepšení, viz §4.)
- **Tokenizace:** dotaz se rozdělí na slova. **Každé slovo dotazu musí být začátkem nějakého slova v názvu** (prefix), pořadí slov nezáleží; shoda kdekoli uvnitř slova jako poslední stupeň. Tedy `novak jozef` i `Jozef Novák` najdou „Jozef Novák“, `he whe` najde „Hell on Wheels“, `d l b` najde „De la Bête“.
- **Řazení podle skóre:** (4) celý název == dotaz, (3) název začíná dotazem, (2) všechna slova jako začátky slov ve stejném pořadí, (1) ostatní shody; dál podle dnešních kritérií (hry hodnocení, lidé abeceda).
- **Minimální délka 2 znaky**, prázdný dotaz nic nevrací.
- **Prohledávané sloupce:**
  - hry: název + autoři + skupiny
  - lidé: jméno + přezdívka + město (`address`)
  - akce: název + `loc` + popis
  - skupiny: název
  - **e-mail uživatele se nehledá nikdy** (soukromí); město je už dnes veřejné.

### Etapa 1 — vyhledávací engine (server), ~1 den

- Nový `packages/api/src/resolvers/search.ts`: tokenizace, SQL builder přes `$queryRaw` (normalizace + prefix na začátku slova + skóre + stránkování + celkový počet).
- Napojit: `game.ts` (`byQuery`, `byQueryWithTotal`), `user.ts` (`usersByQuery` + město), `group.ts`, `gameCatalog.ts` (katalog převezme stejná pravidla).
- Dotaz vrací jen `id` + skóre; plná data se dotáhnou přes Prisma `findMany` s `include` a přemapují stávajícími `normalizeGame` / `normalizeUser` — **kontrakt GraphQL ani mappery se nemění**.
- Přestat vracet všechno u prázdného / 1znakového dotazu.

### Etapa 2 — UI, aby se to dalo vůbec najít, ~1–1,5 dne

- `packages/api/src/schema.graphql`: `eventCalendar(..., query: String)` a nový `eventsByQuery(query, from, to, offset, limit): EventsPaged!`.
- `SearchPanel.tsx`: tab **Akce** (+ Skupiny), tab i dotaz v URL (`/search?q=&t=`), aby odkaz šel poslat a reload udržel tab.
- Nový `EventsSearchPanel.tsx` + `graphql/eventsByQuery.graphql` (karta akce: název, termín, místo, štítky → odkaz na detail).
- `UserSearchPanel.tsx`: celkový počet, zvýraznění shody, pořadí ze serveru; doplnit chybějící `key` u řádku (ř. 85).
- `HeaderSearchForm.tsx`: hledat všechny typy, našeptávač rozdělit po typech s počty („3 lidé“, „2 akce“) a „Zobrazit vše“ na příslušný tab.
- `PageHeader.tsx`: doplnit odkaz na `/search`.
- `CalendarPanel.tsx`: textové pole napojené na nový `query` parametr (stávající filtry zůstávají).
- `CatalogFilterPanel.tsx`: textový input na `state.query` (napojení i chip už existují, chybí jen pole).
- i18n `common.json`: uvést `Search.queryHint` a `example1–3` do souladu se skutečným chováním + nové klíče pro taby a akce.

### Etapa 3 — volitelně

- Typová tolerance (`pg_trgm` similarity) a „Mysleli jste…?“
- U nalezeného člověka rovnou jeho hry („hry od X“) — model už má `gamesOfAuthors` / `authoredGames`.
- Výrazový index, až dat naroste (dnes 1512 / 2733 / 3200 řádků = sekvenční scan v pohodě).

### Testy

`test.yml` už pouští jest na PR.

- `packages/api/src/__tests__/search.test.ts` — diakritika („novak“ najde „Novák“), pořadí slov, prefix, skóre a řazení, minimální délka, prázdný dotaz nevrací vše.
- `packages/api/src/__tests__/searchEvents.test.ts` — nové hledání akcí.
- web: komponentové testy tabů a našeptávače (vzorem `client-rendered-ui-tests`).

## 3. Co jsem nemohl ověřit

- **Do DB jsem se odsud nedostal** — na tomto boxu není SSH klíč (`~/.ssh` prázdné). Všechna čísla jsou z veřejného API a z UI, ne z `psql`.
- Proto zůstává otevřené, jestli je na produkci dostupné rozšíření `unaccent` a jestli si `prisma db push` nerozumí s ručně vytvořenými indexy/triggery. Návrh proto záměrně stojí na `translate()` uvnitř dotazu: **žádná změna schématu, žádný backfill, žádná migrace.**

## 4. Co potřebuju rozhodnout

1. **Rozsah:** Etapa 1 / 1+2 / 1+2+3?
2. **Pravidlo shody:** změnit nápovědu na „každé slovo musí začínat nějaké slovo v názvu, v libovolném pořadí“ (doporučuji), nebo trvat na původním „ve stejném pořadí“?
3. **Sloupce:** sedí návrh v §2 (hry +autoři, lidé +město, akce +místo+popis)?
4. **Akce:** vlastní tab v `/search` i textové pole v kalendáři (doporučuji obojí)?
5. **Minimální délka dotazu:** 2 znaky, nebo 3 (jako našeptávač)?
