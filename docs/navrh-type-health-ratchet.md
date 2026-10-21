# Návrh: type-health ratchet — cesta od 201 chyb tsc k nule

**Fáze 4, gate 3.** Doplňuje coverage ratchet (gate 1) a negative-auth smoke (gate 2).
**Datum:** 2026-10-21 · **Baseline:** `npx tsc --noEmit -p tsconfig.json` = 201 chyb (packages/web).

---

## 1. Proč ne "zapnout tsc hned"

Tvrdá brána na 201 chyb zablokuje každý PR do vyčištění celého dluhu — dluh,
který se netýká produkčního kódu (viz rozdělení níže), ale zastaralých typings
z doby migrace. Ratchet (chyby nesmí přibýt, jít mohou jen dolů) zachytí
*regrese* — nový PR s novou chybou tsc — bez čekání na vyčištění.

## 2. Rozdělení 201 chyb (naměřeno 2026-10-21)

| Kód | Počet | Typický původ |
|---|---|---|
| TS2322 | 85 | `IconDefinition` vs `IconProp` (Icons.tsx, 27×), `children` u providerů |
| TS2339 | 50 | property na `unknown`/`never` — hlavně test-mocky (`jest.fn()` bez typů) |
| TS2345 | 43 | argument `never` — opět test-mocky (CatalogPanel.test, mockResolvedValue) |
| TS2559 | 17 | `{ children }` nemá společné props — Providery/Context bez typovaného `children` |
| TS2554 | 2 | arita handleru |
| TS2307 | 2 | chybějící import modulu |
| TS2614, TS2344 | 2 | mixin `.next/types/validator` (build artifact!) |

Koncentrace: **Icons.tsx 27 · GameEditForm 19 · CatalogPanel.test 19 · SignUp 7 ·
GameDetailPanel 7 · PageHeader 6 · SignIn 6** — prvních 7 souborů ≈ 42 % chyb.

Zásadní poznatek: **~40 % chyb je v `__tests__`/`tests` souborech** (untyped
jest mocky), dalších ~5 % v build artifactu `.next/types` (ten do ratchetu
vůbec nepatří — vzniká při `next build` a mizí po `rm -rf .next`).

## 3. Návrh: tři kroky

### Krok A — rychlé vyloučení šumu (≈ +30 minut práce, −25 chyb)
1. `tsconfig.json`: přidat `"exclude": [".next"]` (validator.ts je artefakt
   buildu, ne zdrojový kód — jeho chyby po každém buildu jinde/mizí).
2. Test-mocky: `jest.fn()` degradující na `never` nahradit existujícím
   repo patternem — explicitní implementace (`jest.fn(async () => …)`),
   jak už je zavedené v rememberMeKey.test.ts (jsou tam k tomu komentáře).
   −~35 chyb v CatalogPanel.test a dalších.

### Krok B — dvě šablony pro 44 % zbývajících chyb
3. `Icons.tsx`: jedna úprava typu (`IconProp` z hostedIcons / import z
   `@fortawesome/react-fontawesome` verze v lockfile) smaže 27 chyb najednou.
4. Providery (`pages/_app.tsx`, UserContext, ToastContext,
   InPlaceSignInContext): doplnit `children: React.ReactNode` do props —
   17× TS2559 + část TS2322.

Po A+B: odhad ≈ 100–120 zbývajících, převážně reálné drobné nesrovnalosti
props v panelling.

### Krok C — ratchet jako CI brána (gate 3, ten vlastní)
5. `scripts/type-ratchet.mjs`: spočítá chyby `tsc --noEmit`, porovná s
   `scripts/type-ratchet-baseline.json` (`{ "count": N }`), selže při
   `count > N`. Stejné rozhraní jako coverage ratchet: `--update-baseline`
   jen na zeleném mainu, floor jde jen dolů.
6. Navázán do `test.yml` jako další step. Práce na snižování pokračuje
   běžnými PR (každé snížení = commit + update baseline, mechanicky).

Proč count a ne per-file jako coverage: chyby tsc se sdružují do vzorů
napříč soubory; per-file floor by přinutil update baseline při každém
refactoru, count ratchet je tichý, když se nic nepaměťově nezhorší.

## 4. Co ratchet NEchytí (a vědomě nechytá)

- Přesun chyby mezi soubory (count stejný) — akceptováno; tržní hodnota
  ratchetu je zastavit *růst*, nehlídat lokalitu.
- Smazání souboru s chybami (= −N) — legální operace, coverage ratchet
  hlídá ztrátu testů paralelně.

## 5. Odhad práce

| Krok | Čas | Chyb po |
|---|---|---|
| A (exclude .next, test-mocky) | 0.5–1 h | ~175 |
| B (Icons, children props) | 1–2 h | ~120 |
| C (ratchet script + workflow) | 0.5 h | brána aktivní |
| Další postup (paralelní, po souborech) | dle kapacity | → 0 |

Krok C lze aktivovat OKAMŽITĚ (baseline 201), i před A/B — nic neblokuje.

## 6. Doporučení

1. Začít krokem C hned (ratchet s baseline 201) — každý PR od teď se
   počítá.
2. A+B jako jeden "type-health" PR s vlastním review (tyka se 5 souborů).
3. Zbývající ~120 rozdělit do batchů po funkční oblasti (Forms → Panels →
   Pages), každý batch samostatný PR.
4. Po dosažení 0: přepnout ratchet na tvrdou bránu (`tsc --noEmit` v CI
   jako povinný step) a baseline smazat.
