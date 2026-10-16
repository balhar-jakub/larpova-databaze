# Návrh: Larpové články v databázi

Cíl: ukládat metadata o larpových článcích publikovaných v češtině. Primární zdroje
**larpy.cz** a **larp.cz**, případné další zdroje později (bardocasopis.cz apod.).

## Současný stav (gap analysis)

V systému na články nic není — platí pro všechny čtyři vrstvy:

- **Data**: v `prisma/schema.prisma` není žádný model pro články (modely končí u
  `similar_games`; žádné `article`/`post`/`blog`).
- **API**: GraphQL schema ani resolvers články neznají.
- **UI**: žádná stránka ani komponenta články nezobrazuje ani nezapisuje.
- **Zdroje**: existuje precedens pro scrapování — `api/src/external/larpCzImport.ts`
  (import akcí z kalendáře larp.cz přes cheerio) + noční batch v
  `api/src/scheduled/tasks.ts` (node-cron, 02:00).

## Průzkum zdrojů (ověřeno 16. 10. 2026)

### larpy.cz — WordPress, ideální případ

- **Veřejné REST API**: `https://www.larpy.cz/wp-json/wp/v2/posts` funguje bez auth.
  - `X-WP-Total: 223` příspěvků, paginace `?page=N`, `?per_page=100`.
  - JSON obsahuje: id, slug, title.rendered, excerpt.rendered (perex), date_gmt,
    link, categories, tags, author (id → `/wp-json/wp/v2/users/<id>`), `_links`
    (featured media → obrázek přes `/wp-json/wp/v2/media/<id>`).
  - **Inkrementální import**: parametr `?after=<ISO datum>` — stáhnout jen nové.
- **Kategorie** (id → počet): Z domova 98, Praxe 54, Teorie 39, Reportáž(e) 16+31,
  Recenze 18, Ze světa 27, Doslov 14, Portál 10, **English articles 30 (vynechat)**
  , Nezařazené 16, Newsletter 0.
- **Českých článků ≈ 193** (223 − 30 English articles).
- Nejstarší příspěvky od roku 2007, poslední červen 2026 — web žije, import musí
  být opakovatelný, ne jednorázový.

### larp.cz — Drupal, nutné scrapování

- Žádné JSON API; HTML listing `https://www.larp.cz/?q=cs/clanky&page=N`.
- Struktura URL článku: `/?q=cs/clanek/<id>/<slug>` — **numerické id v URL je
  přirozený deduplikační klíč** (např. 9739, 9733, 9712…).
- Listing paginovaný: `page=1` … `page=34` (poslední), ≈ 10 článků/stranu →
  **~330–340 článků** (zahrnuje i starší obsah; rubriky: Návody, Reportáže,
  Zahraničí, Pro pořadatele, Pro veřejnost, Podcast, Diplomky).
- Existuje sitemap (`/?q=cs/sitemap`) a stránky štítků (`/?q=cs/tagy/<slug>`),
  autorů (`/?q=cs/user/<nick>`).
- Detail článku je potřeba oescrapovat pro: perex, datum, autora, rubriku, tagy.
- Pozn.: scraping je křehlejší (Drupal theme se může změnit) — parser má mít
  fallback-selectory jako `larpCzImport.ts`.

## Datový model

Nová tabulka `csld_article` (+ vstupní tabulka pro autoři, pokud chceme relaci
na `csld_csld_user`):

```prisma
model csld_article {
  id            Int      @id @default(autoincrement())
  source        String          // 'LARPY_CZ' | 'LARP_CZ'
  sourceId      String          // WP post id | Drupal numeric id
  url           String          // kanonické URL článku (odkaz ven)
  title         String
  perex         String?         // krátký perex/excerpt, bez HTML
  language      String  @default("cs")
  authors       String?         // jména autorů jako text („Kristýna Obrdlíková")
  published_at  DateTime        // datum publikace u zdroje
  categories    String[]        // rubriky/kategorie ze zdroje
  tags          String[]        // štítky
  image_url     String?         // titulní obrázek (URL u zdroje, nestahujeme)
  fetched_at    DateTime @default(now())
  game_has_article csld_article_has_game[]

  @@unique([source, sourceId])
}
```

Volitelné (viz otevřená rozhodnutí): `csld_article_has_game` — vazba článek↔hra
(„reportáž o běhu hry X"), analogie k `csld_game_has_event`.

## Import

- `api/src/external/larpyCzArticlesImport.ts` — WP REST API, `per_page=100`,
  stránkované, `?after=` pro inkrementální běhy. English articles (kategorie 1113)
  filtr ven → plní `language`.
- `api/src/external/larpCzArticlesImport.ts` — cheerio, listing stran 1–34,
  dedup dle `sourceId`; perex/datum/autor z detailní stránky. Při opakování
  stahovat jen články s id > max(zdrojová id v DB) + poslední stránku listingu.
- Oba skripty ve stylu `larpCzImport.ts` (vrací počet nových/aktualizovaných),
  napojené do nočního batche v `scheduled/tasks.ts`.
- Autoři se ukládají jako text; spárování na uživatele ČSLD necháme na později
  (ruční úloha jako u autorů her — jméno v textu vs. záznam v DB).

## API + UI

- GraphQL: `type Article`, `articles(filter, pagination)`, `article(id)`;
  později `ArticleFilter.gameId` a fragment v detailech her.
- UI (vlastní fáze): seznam `/clanky`, filtr na zdroj/rubriku/rok, na detailu
  hry sekce „Články o hře". Importní skripty a UI jsou nezávislé — DB+import
  mohou nasadit dřív.

## Fázový plán

1. **Schema + migrace** — `csld_article` (+ příp. `csld_article_has_game`),
   `prisma migrate dev` lokálně, `prisma db push` na test/prod.
2. **Import larpy.cz** (triviální, WP API) — jedno provedení ≈ 193 českých
   článků; ověřit dedup a diakritiku.
3. **Import larp.cz** (scraping) — ~340 článků, robustní selectory, report
   anomálií (články bez data, bez autora).
4. **GraphQL** — typy, resolvers, fragmenty, regenerace typed GraphQL.
5. **UI** — `/clanky` + vazby na hry, ruční editace vazeb přes admin.
6. **Noční batch** — inkrementální obě zdroje (`tasks.ts`).

## Otevřená rozhodnutí (s navrženým defaultem)

1. **Obsah článku**: ukládat jen metadata + perex + odkaz (default), nebo i
   fulltext? Fulltext = autorská práva + sanitizace HTML + velikost —
   doporučuji ne, ČSLD bude agregátorem odkazů.
2. **Vazba článek↔hra**: udělat hned (prázdná tabulka, plní se ručně/na
   doporučení) — default ANO, tabulka je levná a backfill je dražší.
3. **Rozsah zdrojů**: jen cz články obou webů (default), English articles
   z larpy.cz vynechat; další zdroje (bardocasopis.cz, LarpSpot?) později.
4. **Autoři jako text vs. relace na csld_csld_user**: default text
   (spárování je separátní, ruční úloha jako u autorů her).
