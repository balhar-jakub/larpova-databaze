# Návrh: nová úvodní stránka — zvlášť pro přihlášeného a nepřihlášeného

**Rozsah:** návrh vizuálu a struktury úvodní stránky (mockup ze **skutečných produkčních dat**, kód jsem nepsal).
**Datum:** 2026-10-08 · **Důkaz:** produkce `https://larpovadatabaze.cz` — veřejné GraphQL API, živá stránka v prohlížeči
a čtení produkční DB (jen SELECT, přes `ssh balda@193.150.13.68`).
**Soubory:** `csld-home-navrh.html` (mockup, 3 varianty) · `csld-home-navrh-1-neprihlaseny.png`,
`-2-prihlaseny.png`, `-2b-dokoncit.png`, `-3-bez-dat.png` (návrh) ·
`csld-home-dnes-1-hry-akce.png`, `-2-komentare.png`, `-karusel.png`, `-3-mobil.png` (dnešní stav z živé stránky).

---

## 1. Co je dnes měřeno špatně

| # | Problém | Naměřeno |
| --- | --- | --- |
| 1 | **Úvodní stránka je pro všechny stejná.** `HomePagePanel.tsx` ani nic v `components/HomePage/` **nečte přihlášeného uživatele** (v celé složce není `useLoggedInUser` ani `UserContext`). Přihlášený vidí přesně to, co náhodný návštěvník. | 3 170 účtů, 40 budoucích akcí |
| 2 | **„Nejoblíbenější“ vede hry s nula hlasy.** `homepage.ts` řadí `orderBy: { total_rating: 'desc' }` — v PostgreSQL jdou NULLy v DESC **první**, takže v karuselu jsou na začátku 4 hry s 0 hlasy (`Helmáč`, `Good People of Languedoc`, `Camlann`, `Blankspace`) a skutečná jednička (`Legie: Sibiřský příběh`, 94,4 %, 242 hlasů) je **až pátá**. | `csld-home-dnes-karusel.png` |
| 3 | **Karty her mají tři čísla bez popisků.** `GameBaseDataPanel` skládá `54` `154` `242` `x` dohromady → na obrazovce „**54154242 x**“, u prázdné hry „**40000 x**“. Nikde není „hlasů“ / „komentářů“. | všech 12 karet na úvodní stránce |
| 4 | **Komentáře nesou surové HTML entity.** `commentAsText` jen odstraní tagy, ale nedekóduje entity → na stránce je doslova „…dal Blackhillu**`&nbsp;`**. A bylo super…“. | **7 z 18** dlaždic; celá DB: **3 466 z 4 836** komentářů (72 %) |
| 5 | **Blok komentářů je mrtvá plocha.** 18 dlaždic přes celou šířku, ale nejnovější komentář je **24 dní starý** (14. 9.), za srpen 0, za září 1. Na stránce vysoké 1 055 px zabírá „Poslední komentáře“ (od y=494 dolů) **561 px, tj. 53 %**. | 84 komentářů za 14 měsíců, 83 hlasů za 30 dní |
| 6 | **Stránka neřekne, co v databázi je.** 1 512 her / 2 733 akcí / 3 170 lidí se na úvodní stránce neobjeví; hledání je jen malé pole v hlavičce. | katalog 1 512 her; 40 budoucích akcí |
| 7 | **Štítky — hlavní nástroj objevování — na úvodní stránce chybí.** Přitom štítek má **1 511 z 1 512 her** a katalog podle nich umí filtrovat. | 61 štítků, fantasy 787, dřevárna 536, svět 510, komorní 419 |
| 8 | **Pro přihlášeného se nedozví nic o sobě.** „Hrál jsem bez hlasu“ (2 522 záznamů u 518 lidí), 19 her v „chci hrát“ z let 2007–2017, poslední hlas na jeho hře 13. 7. 2026, poslední komentář **4. 11. 2021** — nic z toho na úvodní stránce není. | uživatel #1 (Balda): 110 / 19 / 15 / 51 |
| 9 | **Čísla v osobních blocích si odporují** (kdyby se použily dnešní kolony): `amount_of_created` **34** vs 15 skutečných autorských vazeb, `amount_of_comments` **101** vs 51 komentářů u živých her. | viz §4 |
| 10 | **Personalizace nesmí být jen pro „aktivní“.** 1 146 ze 3 170 účtů (**36 %**) nemá ani jeden záznam — bez prázdného stavu by pro ně byla stránka slepá. | DB: 1 966 účtů hrálo, 390 chce hrát |

---

## 2. Návrh

Princip: **nepřihlášený dostane rozcestník, přihlášený dostane seznam úkolů.** Společná zůstává jen
hlavička, kalendář a patička; zbytek stránky se řídí tím, kdo se dívá.

### A. Nepřihlášený — „co tu je a kde začnu“ (`csld-home-navrh-1-neprihlaseny.png`)

1. **Hero místo dvou panelů her**: název + rozsah dat (**1 512 her · 2 733 akcí · 3 170 lidí**),
   **velké hledací pole** (dnes je jen 190 px v hlavičce) a pod ním **štítky s počty**
   (787 fantasy, 536 dřevárna, 510 svět…), které vedou rovnou do katalogu s filtrem.
2. **Nejbližší akce** (6 karet): datum jako blok vlevo (den/měsíc/rok), místo, `přihlášky otevřené` jen když
   organizátor opravdu otevřel (**2 ze 40**), `místo neuvedeno` tam, kde chybí (**15 ze 40**).
   Data o chybějících polích jsou součást návrhu — návštěvník nemá hádat, proč u akce nic není.
3. **Naposledy přidáno** (6 her, 30 dní aktivity) **vedle** **Nejlépe hodnocené** — nové řazení:
   od 5 hlasů, vážený průměr (dnešní „Nejoblíbenější“ s 0 hlasy mizí).
4. **Procházej podle štítků**: 12 dlaždic s počty + délky (víkendová 664, do 8 hodin 487, čtyřdenní 220, jednodenní 51).
5. **Poslední komentáře jen 3** (a s dekódovanými entitami), protože blok s 18 dlaždicemi je dnes 53 % stránky
   a nic se v něm nemění.
6. **CTA pás „Co získáte účtem“** (larpotéka a hodnocení · kalendář jako ICS · hlídání her).

### B. Přihlášený — „pokračuj, nezmeškej, dokonči“ (`csld-home-navrh-2-prihlaseny.png`)

**Žádné obecné bloky.** Místo nich dvě věci, které patří jen jemu: události z jeho her a blížící se události.

1. **Osobní pás**: „Ahoj Baldo — tvoje larpotéka má 110 her“ + čísla **110 hraných · 19 chci hrát ·
   15 mých her · 51 komentářů** + odkazy *Moje stránka* a *Kalendář (ICS)*.
2. **Události z vašich her** (nahoře, protože tohle je „nezmeškat“): karta akce
   *Krvavé časy 1313 — 10. běh* (19.–22. 11. 2026, hraje se *Krvavé časy* ze seznamu „Chci hrát“)
   a vedle ní karta, kolik her se ještě v kalendáři neobjevuje (**18 z 19**) + odkaz na odběr ICS.
   Dnes je to jediná budoucí akce, která se protne s jeho seznamem; obecně má spárovanou hru **17 ze 40** akcí
   a takovou shodu má **12 lidí** — proto je vedle karty i fallback s ICS.
3. **Dokončit** — dvě karty z reálných dat uživatele: *Země snů: Sen ve stínech* („hrál jste 2. 2. 2020 a hra
   nemá váš hlas“) a *19 her v seznamu „Chci hrát“* (nejstarší z roku 2007).
4. **Tvoje hry** (15): sloupce *poslední hlas / kdy / od koho* (Zpěvy rytířské 8 · 13. 7. 2026, Čí sny sníš 9 ·
   18. 12. 2025, …) + `Castaways` bez hlasu a komentáře. Dneska si to zjistí jen otevřením 15 detailů.
5. **Doporučeno podle štítků** — štítky z her, kterým dal 8 a víc (opakovatelný 33×, komorní 28×,
   sociální drama 18×, současnost 14×…), přes katalog s filtrem `anyLabels` + `minRating 80`
   (300 her, po odečtení odehraných **15**) a s chipem „shoda: opakovatelný, dramatický“ na každé kartě.
6. **Blížící se události** (obecný kalendář) — zůstává kvůli uživatelům, kterým se nic neprotíná.

### C. Přihlášený bez dat — prázdný stav (`csld-home-navrh-3-bez-dat.png`)

Pro **1 146 účtů (36 %)**: osobní bloky se schovají, hero se změní na „vaše larpotéka je zatím prázdná“
s třemi prvními kroky a jako obsah se použije **nejhranější hry + nejlépe hodnocené + nejbližší akce**
(tedy to, co vidí nepřihlášený). Bez toho by personalizace pro třetinu účtů znamenala prázdnou stránku.

---

## 3. Odkud čísla jsou

- **GraphQL** `https://larpovadatabaze.cz/graphql` (bez auth): `homepage { lastAddedGames mostPopularGames nextEvents lastComments }`,
  `games { catalog(order: Recommended|MostPlayed) { games facets } }`, `userById(1) { playedGames wantedGames authoredGames commentsPaged }`,
  `gameById { similarGames }`, `eventById(2798)`, `usersByQueryWithTotal`.
- **DB** (SELECT jen pro součty, které API neumí): `csld_rating` (21 691 řádků, 17 079 s hlasem, 2 077 uživatelů s hlasem),
  `csld_comment` (4 836, z toho 3 466 s entitou), `csld_game_has_author` (3 821 vazeb, 1 132 autorů),
  `csld_game_has_label` (6 361), `similar_games` (12 537), `event` (2 733 živých, 40 budoucích, 17 s hrou).
- **Živá stránka** měřená v prohlížeči: výška 1 055 px (1280 px šířka), blok komentářů od y=494 do 1 055;
  na mobilu (390 px) je stránka **2 700 px** vysoká, bez horizontálního přetečení.

---

## 4. Co návrh potřebuje z API

**Dnes to jde bez změny API**
- `loggedInUser` vrací `playedGames` (i s `rating`), `wantedGames`, `authoredGames`, `commentsPaged.totalAmount`.
- `games.catalog` umí facety s počty, `order: Recommended` (Bayes) i `MostPlayed` — tedy „nejlépe hodnocené“ i „nejhranější“.
- `gameById { similarGames }` funguje (12 537 dvojic) — doporučování je hotové.
- `eventCalendar(from:)` a `/ical?id=` (ICS) existují.

**Malé opravy (řádky, ne návrh)**
1. `homepage.mostPopularGames`: řadit jako katalog (`total_rating` NOT NULL / od 5 hlasů) — dnes 4 hry s 0 hlasy na prvním místě.
2. `commentAsText`: dekódovat entity (`&nbsp;`, `&iacute;`) — dnes je vidět v textu na úvodní stránce. Týká se 72 % komentářů.
3. `nextEvents`: vrátit `labels` a `games` (dnes `null`) — jinak karta nemůže ukázat, co se na akci hraje.
4. Cesta přes `csld_rating` (`playedGames`/`wantedGames`) a `csld_game_has_author` (`authoredGames`) vrací **prázdné `labels`** —
   doplnit include, jinak karty v osobních blocích nemají štítky (dnes je má jen homepage/katalog).
5. Osobní čísla počítat z vazeb, ne z kolon: `amount_of_created` 34 vs 15, `amount_of_comments` 101 vs 51.

**Nové dotazy (2)**
- `eventCalendar(gameIds: [ID!])` (nebo `homepage.myEvents`) pro kartu *události z her, které chceš hrát*.
  Bez toho musí UI stáhnout celý kalendář a 40× se doptat přes `eventById` — funkční, ale 40 dotazů.
- **Štítky z hodnocených her** pro doporučování: osobní cesta (`userById.playedGames` přes `csld_rating`) vrací
  `labels: []`, takže se z ní „opakovatelný 33×“ nevypočítá. Buď doplnit include (1 řádek v `user.ts`),
  nebo přidat `User.topLabels` (agregace na serveru). Katalogová část (`games.catalog(anyLabels, minRating)`) funguje dnes.

---

## 5. Fáze implementace

| Fáze | Co | Soubory |
| --- | --- | --- |
| 1 | Hero s rozsahem dat a hledáním, dlaždice štítků, oprava řazení místo „Nejoblíbenější“ (od 5 hlasů), dekódování entit, zmenšený blok komentářů | `HomePage/HomePagePanel.tsx`, nové `HomePage/HomeHeroPanel.tsx`, `HomeLabelsPanel.tsx`, `homepage.ts` (1 řádek), `mappers.ts`, `common.json` |
| 2 | Přepínač podle přihlášení + osobní pás + *Dokončit* (2 karty bez nové query: hrané bez hlasu, „chci hrát“) | `HomePage/HomePersonalPanel.tsx`, `graphql/homePageUser.graphql` |
| 3 | *Doporučeno podle štítků* (katalog `anyLabels` + `minRating`, filtr odehraných) a *Tvoje hry* (15× `gameById`) | `HomeRecommendationPanel.tsx`, `HomeAuthoredPanel.tsx`, `game.ts` |
| 4 | *Události z vašich her* + odběr ICS — vyžaduje `eventCalendar(gameIds)` | `event.ts`, `schema.graphql`, `HomeMyEventsPanel.tsx` |
| 5 | Prázdný stav (C) + `labels` v osobních cestách + osobní čísla z vazeb | `user.ts` (`normalizeUser`), `HomeEmptyPanel.tsx` |

**Testy:** `packages/web/src/components/HomePage/tests/` (vzorem `client-rendered-ui-tests`): přepnutí A/B/C podle
přihlášení, „nejlépe hodnocené“ neobsahuje hru do 5 hlasů, dekódované entity v komentáři, počet dlaždic štítků;
API: `homepage.test.ts` na řazení `mostPopularGames`.

---

## 7. Rozhodnuto (Jakub, 2026-10-08)

1. **Rozsah: A + B + C** (nepřihlášený, přihlášený, přihlášený bez dat) — implementuje se jako jeden celek.
2. **U přihlášeného žádné obecné bloky.** Místo nich *Události z vašich her* (hry ze seznamu „Chci hrát“)
   a *Blížící se události* jako obecný kalendář. Blok „Poslední komentáře“ z přihlášené varianty zmizel.
3. **„Nejoblíbenější“ zrušit** — na všech variantách zůstává jen „Nejlépe hodnocené“ (od 5 hlasů, vážený průměr).
4. **Doporučovat přes štítky** (štítky z her hodnocených 8+ → katalog `anyLabels` + `minRating 80`),
   ne přes tabulku `similar_games`.

Mockup i tento dokument už rozhodnutí obsahují (`csld-home-navrh-2-prihlaseny.png`, `-2b-udalosti.png`).
Zbývá **jen otevřená otázka**: minimální počet hlasů u „Nejlépe hodnocené“ (návrh: 5, stejně jako odznak hodnocení).

## 8. Co jsem nemohl ověřit

- **Přihlášenou variantu jsem neviděl živě** — přihlášení je přes magic link, nemám session. Data jsou z produkce
  (GraphQL + DB), ale rozložení přihlášené stránky jsem na živém webu nezměřil; vychází z kódu `UserProfilePanel`
  a `PageHeader` a z tmavého tématu (`darkTheme.ts`).
- **Mobilní rozložení návrhu**: mockup je pevně 1280 px (jako dnešní `wrap` 1110 px). Živou stránku jsem na 390 px
  změřil (`csld-home-dnes-3-mobil.png`), ale že se nové bloky poskládají do sloupce, je návrh, ne měření.
- **Chování 40 dotazů `eventById`** (obchvat chybějícího filtru `gameIds`) jsem nezkoušel.
