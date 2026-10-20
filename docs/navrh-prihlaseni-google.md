# Návrh: Přihlášení a registrace přes Google účet

**Verdikt: proveditelné a jádro už v aplikaci je.** Aplikace dnes umí tři cesty dovnitř (heslo,
magic link, remember-me cookie) a všechny končí stejným `ctx.login()` + `setRememberMeCookie()`.
Google přihlášení je „čtvrtá cesta" do stejného místa — ne nový auth systém.

Chybí: **jedna tabulka + migrace, dva REST endpointy, pravidlo propojení účtů, tlačítko v UI,
i18n klíče a konfigurace v Google Cloudu** (včetně zásad ochrany osobních údajů, které na webu
nejsou). Nová knihovna není potřeba — `googleapis` (OAuth2 klient) je už v závislostech.

**Jedna věc se ale musí opravit předem:** e-mail se v DB porovnává case-sensitivně, takže
**351 účtů (11 %) dnes nejde přihlásit heslem** a magic link u nich vyrobí **druhý účet**.
U pěti z nich už se to stalo (důkaz níže). Google přihlášení na tuto vadu narazí taky.

---

## Co dnes v aplikaci je (ověřeno v kódu a na produkci)

| Vrstva | Stav | Kde |
| --- | --- | --- |
| Session | `express-session` + `connect-pg-simple`, cookie `csld.sid`, 30 dní, tabulka `user_sessions` | `packages/web/server.ts:93–108` |
| Passport | jen lokální strategie (`passport-local`), serializace do session = `user.id` | `src/api/src/auth/passport.ts:11–62`, `:65–98` |
| Heslo | PBKDF2 (1000 iter., SHA1, sůl = e-mail) + legacy MD5 s automatickým přepisem při přihlášení | `src/api/src/auth/password.ts`, `passport.ts:33–39` |
| GraphQL login | `user.logIn(userName, password)` → `ctx.login` + remember-me | `src/api/src/resolvers/userMutation.ts:63–101` |
| Magic link | `user.startEmailLogin` (auto-registrace), REST callback `/auth/email-login`, token v `csld_email_authentication` (15 min) | `userMutation.ts:387–451`, `server.ts:291–349` |
| Zapomenuté heslo | token na 1 h → nastaví nový PBKDF2 hash | `userMutation.ts:308–383` |
| Remember-me | podepsaná cookie `LoggedIn` (HMAC, 30 dní), middleware přihlásí bez session | `src/api/src/auth/rememberMe.ts` |
| Role | `ANONYMOUS/USER/EDITOR/ADMIN/AUTHOR` v `csld_csld_user.role` | `src/api/src/auth/appUsers.ts:3–9` |
| UI přihlášení | `SignInPanel` (magic link nahoře, oddělovač „nebo použijte heslo", pak heslo) — na **3 místech**: `/signIn`, `SignInRequiredWrapper`, `InPlaceSignInWrapper` | `src/components/SignIn/SignInPanel.tsx:102–129` |
| UI registrace | `SignUpPanel` ve dvou režimech: výchozí magic link; přepínač „Chci si rovnou nastavit heslo" (heslo + reCAPTCHA) | `src/components/SignUp/SignUpPanel.tsx:152–217` |
| Google knihovna | `googleapis` je v `dependencies` (dnes jen Google Calendar sync, `GCAL_CREDENTIALS_BASE64` není nastaveno) | `src/api/src/external/googleCalendar.ts:1` |
| Deploy | rsync `packages/web/` (`–exclude=.env`), `.env` na serveru, systemd unit ho načítá jako `EnvironmentFile`, migrace `prisma migrate deploy`, po deployi drift gate | `.github/workflows/deploy-production.yml:76`, `:90–94`, `:197–234` |

Živě ověřeno na `https://larpovadatabaze.cz/signIn`: stránka nabízí e-mail (magic link) a heslo;
žádná jiná možnost přihlášení tam není.

## Co v datech je (produkce, `public`, 17. 10. 2026)

- **3 182 účtů**, všechny mají e-mail (žádný NULL, žádný prázdný) → adresu má každý účet.
- **351 účtů (11 %) má v e-mailu velká písmena** (např. `Cilkaj@seznam.cz`, `576Eonwe@larpovadatabaze.cz`).
- Unique index `unique_email` je **case-sensitivní**; existuje **5 dvojic** účtů lišících se jen
  velikostí písmen (10 účtů): `clementois@`, `gaome@`, `gyvermek@`, `kelghor@`, `vojta1662000@` (seznam.cz).
- Formát hesla: 2 721 PBKDF2, 461 legacy MD5, **15 účtů s prázdným heslem** (auto-registrace magic linkem).
- Role: 3 175 USER, 5 EDITOR, 2 ADMIN (7 účtů „staff"; dva z nich jsou testovací artefakty:
  `event-cover-test@example.invalid`, `4fa5a313-…@7d057b20-….cz`).
- Domény: `gmail.com` 1 029 (+25 `gmail.com_old`), `seznam.cz` 931, `centrum.cz` 180,
  `larpovadatabaze.cz` 141 (syntetické adresy staré aplikace — Google účet k nim neexistuje),
  `email.cz` 139… celkem **53 e-mailů, které nejsou platná adresa** (bez `@` nebo s `_old`).
- Magic link se reálně používá: 742 tokenů pro 293 účtů, poslední 17. 10. 2026.
- **Žádný OAuth sloupec ani tabulka** v DB nejsou (18 sloupců `csld_csld_user`, 26 tabulek v `public`).
- Dostupné extension: jen `pgcrypto` a `plpgsql` (žádný `citext`).

## Prerekvizita (musí být před Google přihlášením): case-sensitivní e-mail

Každé hledání uživatele v aplikaci dělá `where: { email: vstup.toLowerCase() }`
(`userMutation.ts:76`, `:154`, `:314`, `:401`, `passport.ts:19`) a porovnává se **surovým**
sloupcem. Důsledky na produkci:

1. **351 účtů se nemůže přihlásit heslem** — uložené `Cilkaj@seznam.cz` se na `cilkaj@seznam.cz`
   nikdy netrefí → „Invalid email or password" (a Passport strategie to samé).
2. **Magic link u těch účtů vyrobí druhý účet** — `startEmailLogin` hledá podle lowercase, nic
   nenajde, a protože unique index je case-sensitivní, vytvoří nový řádek. To se už stalo:
   - `1103 Clementois@seznam.cz` (heslo OK) + `6320 clementois@seznam.cz` (**prázdné heslo**),
   - `2469 Vojta1662000@seznam.cz` (heslo OK) + `6336 vojta1662000@seznam.cz` (**prázdné heslo**).
   Prázdné heslo = stopa auto-registrace přes magic link.
3. Google přihlášení by dopadlo stejně: buď nenajde existující účet (a založí třetí), nebo
   (při case-insensitive hledání) narazí na 5 dvojic a nebude vědět, ke které se připojit.

**Oprava (fáze 0):** sjednotit zápis e-mailu na lowercase + `update csld_csld_user set email = lower(email)`
+ case-insensitive lookup (`mode: 'insensitive'`). Backfill ale koliduje s `unique_email` u 5 dvojic
→ ty je potřeba nejdřív ručně rozhodnout (sloučit, nebo přejmenovat s `+` adresou).

*Ověřený experiment k drift gate* (lokálně: PostgreSQL 18 + Prisma 6.19.3, migrace z repa aplikované
do scratch DB): ručně psaný **funkční unique index na `lower(email)` drift gate nevyhlásí**
(„This is an empty migration."), zatímco přebytečný sloupec drift vyhlásí (kontrolní pokus prošel).
Varianta s funkčním indexem je tedy technicky průchodná, ale do `schema.prisma` se zapsat nedá
(Prisma expression indexy neumí) — zůstala by jen v SQL migraci. Doporučená cesta je proto
normalizace dat + běžný unique index, funkční index případně jako pojistka navíc.

## Co chybí (gap po vrstvách)

### 1. Databáze
Nová tabulka `csld_oauth_account` + migrace `prisma/migrations/<ts>_add_oauth_accounts/migration.sql`
(stejný styl jako `20261017100000_track_user_sessions`):

```
id, user_id (FK → csld_csld_user), provider ('google'),
provider_account_id (Google `sub`), provider_email, created_at, last_login_at
@@unique([provider, provider_account_id])   @@index([user_id])
```

Zamítnutá varianta: dva sloupce (`google_sub`) přímo do `csld_csld_user`. Uživatelská tabulka je
legacy a plná osobních dat, každý další poskytovatel (Facebook, Apple) by znamenal další sloupce,
a vazba „jeden uživatel → N identit" do jednoho sloupce nepatří.

### 2. Server / API
- `GET /auth/google` — přesměruje na Google, vygeneruje `state` (a PKCE, pokud ho knihovna umí)
  a uloží ho do `req.session`; `returnTo` pro in-place přihlášení.
- `GET /auth/google/callback` — výměna kódu za tokeny, **verifikace ID tokenu** (`verifyIdToken`
  s kontrolou `audience`), pak dohledání/propojení/registrace, a na konci **přesně to, co dělá
  magic-link callback**: `req.login(authUser)` + `setRememberMeCookie(res, id)` + redirect
  (`server.ts:314–344` je hotová šablona).
- Nový modul `src/api/src/auth/googleLink.ts` s rozhodovacím pravidlem (viz níže), aby se dal
  testovat bez HTTP.
- reCAPTCHA v Google cestě **není potřeba** — Google ověřuje člověka i e-mail sám
  (`recaptcha.ts` se v Google cestě vůbec nevolá).
- Fáze 2 (volitelně): GraphQL mutace pro propojení/odpojení v profilu. Pozor: **schéma je v repu
  dvakrát** (`src/api/src/schema.graphql` i `src/graphql/schema.graphql`, obě 936 řádků, shodné) →
  měnit obě + `yarn codegen` (`codegen.yml`).

### 3. UI
- Jedno tlačítko v `SignInPanel` pokryje **všechna tři** místa, kde se dnes přihlášení ukazuje
  (`/signIn`, „k přihlášení je potřeba se přihlásit" wrapper, in-place login u hodnocení/komentářů).
  Stejné tlačítko v `SignUpPanel` (v režimu magic linku — registrace Googlem je totéž jako přihlášení).
- Jako prostý odkaz `<a href="/auth/google?returnTo=…">` → **žádná `NEXT_PUBLIC_*` proměnná**,
  žádný zásah do buildu (na rozdíl od `google.accounts.id`/GIS tlačítka, které by potřebovalo
  client ID v bundlu a rebuild na obou workflowech).
- `returnTo`: dnes magic link vždy skončí na `/`; u in-place přihlášení chce uživatel zpět na
  stránku, kde byl (hodnocení hry, komentář).
- i18n: klíče do `public/static/locales/cs/common.json` **i `en/common.json`** (angličtina je
  dnes neúplná — v `SignIn` jí chybí `header`, `email`, `password`, `forgotPassword`).
- Fáze 2: v profilu „Přihlášen přes Google / Propojit účet".
- **Past:** `updateLoggedInUserPassword` vyžaduje staré heslo (`userMutation.ts:290`) → uživatel
  s prázdným heslem (15 magic-link účtů, po spuštění i nové Google účty) si heslo v profilu
  nastavit nemůže. Není to lock-out („Zapomenuté heslo" funguje, nastaví nový hash), ale je to
  díra v UX, kterou by fáze 2 měla zavřít (povolit nastavení bez starého hesla, když je účet bez hesla).

### 4. Konfigurace a nasazení
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (+ základ pro redirect URL) do `.env` na **obou**
  instancích. rsync `.env` nekopíruje a systemd ho načítá jako `EnvironmentFile`, takže ruční
  zápis + restart stačí; čistší varianta je rozšířit oba workflowy (zápis klíčů vedle
  `SESSION_SECRET`, `deploy-production.yml:90–94`), aby test a prod neutíkaly.
- Konfigurace je dnes v `.env` jen `MAIL_*`, `SESSION_SECRET`, `DATABASE_URL*`, `CSLD_DATA_*`,
  `INTEGRATE_ARTICLES` (klíče ověřeny na boxu) — **žádné `GOOGLE_*`/`GCAL_*` tam nejsou**,
  takže žádný starý OAuth klient k dispozici není.
- Jeden OAuth klient pro test i prod (dva seznamy redirect URI) vs. dva klienti — rozhodnutí níže.

### 5. Mimo repo — Google Cloud
Nutné v Google Auth Platform (dřív „OAuth consent screen"):
- **Branding:** název aplikace, homepage `https://larpovadatabaze.cz`, **odkaz na zásady ochrany
  osobních údajů**, ověřená doména.
- **Audience = External + publikovat.** V režimu „Testing" se přihlásí jen testovací uživatelé
  (max 100) — na veřejný web to nestačí.
- **Scopes:** `openid`, `email`, `profile` = non-sensitive → bez Google review (sensitive/restricted
  scopes by znamenaly ruční schválení a u restricted i bezpečnostní audit).
- **Klient typu Web** s přesnými redirect URI: `https://larpovadatabaze.cz/auth/google/callback`,
  `https://www.larpovadatabaze.cz/auth/google/callback`, `https://csld.vezlute.cz/auth/google/callback`,
  `http://localhost:8080/auth/google/callback` (+ IP adresa boxu, pokud se používá).
- **Zásady ochrany osobních údajů na webu nejsou** — v repu není žádná stránka ani odkaz v patičce
  (`PageFooter.tsx` má jen copyright, FB a tým). Pro externí aplikaci Google odkaz na zásady
  vyžaduje, musí být na stejné (ověřené) doméně a odkazovaný z homepage; homepage přitom nesmí být
  jen přihlašovací stránka. Nová stránka + odkaz v patičce je tedy součástí práce, ne formalita —
  a stejně tak GDPR: nově ukládáme **Google `sub`** a e-mail (případně jméno a avatar) od Googlu.
  Aktuální požadavky je před implementací dobré ověřit přímo v konzoli, viz zdroje níže.

## Bezpečnost: jak propojovat účty

Google vrací `sub` (stabilní ID účtu), `email`, `email_verified`, `name`, `picture`.

1. **Existuje propojení** (`provider='google'`, `provider_account_id=sub`) → přihlas toho uživatele.
   `sub` je primární klíč identity, e-mail se bere jen jako nápověda.
2. **Není propojení a `email_verified` a e-mail odpovídá právě jednomu účtu** (case-insensitive) →
   propojit a přihlásit. Tohle je bezpečné ze stejného důvodu, jako je bezpečné „Zapomenuté heslo":
   kdo ovládá mailbox, ovládá i účet — obě cesty dokazují totéž.
3. **E-mail odpovídá více účtům** (dnes 5 dvojic) → **nepropojovat automaticky**; vyzvat
   k přihlášení heslem/magic linkem a propojení nabídnout až v profilu. Tichý výběr jednoho
   z dvojice je předání účtu.
4. **E-mail neodpovídá ničemu** → založit nový účet (`role = 1`, `password = ''` jako u magic linku,
   `name` z Google profilu) a propojit. Tlačítko „Pokračovat přes Google" je tedy zároveň registrace.
5. **E-mail patří účtu, který už má propojení s jiným Google účtem** → odmítnout s vysvětlením.
6. **Staff účty (role > USER, dnes 7)** — doporučený default: stejné pravidlo jako u kohokoli
   jiného, ale každé automatické propojení logovat (`user_id`, `sub`, `ip`, čas) do auditní stopy;
   přísnější varianta = u staff účtů jen explicitní propojení po přihlášení. Rozhodnutí níže.

Nikdy se nemění `role` ani `is_author` — autorizace zůstává na `csld_csld_user.role`, Google je
jen další způsob, jak prokázat identitu.

## Fázový plán

| Fáze | Obsah | Odhad |
| --- | --- | --- |
| **0** | Normalizace e-mailů na lowercase (+ rozhodnutí 5 dvojic), case-insensitive lookup, testy | 0,5 dne |
| **1** | Tabulka + migrace, `auth/googleLink.ts`, `/auth/google` + callback, tlačítka v `SignInPanel`/`SignUpPanel`, `returnTo`, i18n cs+en, testy, ověření na testu | 2–3 dny |
| **2** | Propojení/odpojení v profilu (GraphQL — dvě kopie schématu + codegen), nastavení hesla bez starého, stránka se zásadami + odkaz v patičce | 1–1,5 dne |
| **3** | Volitelné: import Google avatara, další poskytovatelé (Facebook/Apple), „naposledy přihlášen přes Google" v adminu | dle zájmu |

Vedle toho **lead time mimo repo**: založení projektu v Google Cloudu, registrace redirect URI
a publikace consent screen (u non-sensitive scopes bez review, ale ověřit v konzoli).

## Testy a ověření

- `src/api/src/__tests__/auth.test.ts` (existuje) + nový `googleLink.test.ts`: matice pravidel
  1–6 včetně toho, že **nepotvrzený e-mail nepropojí** a že **nejednoznačný e-mail nepropojí**.
- Case-insensitive lookup: test na `Cilkaj@seznam.cz` (dnes by spadl).
- HTTP vrstva: existuje vzor `httpGuards.supertest.test.ts` (express app namísto importu
  `server.ts`) → supertest na `/auth/google/callback` bez platného `state` musí selhat.
- Guard: Google `sub`/`provider` se nesmí objevit ve veřejném GraphQL typu `User`.
- Ruční ověření celého flow **v prohlížeči na `csld.vezlute.cz`** (ne jen curl) — po mergi do
  `main` se test nasadí sám, produkce je pak ruční „Deploy to Production".

## Otevřená rozhodnutí (s navrženým defaultem)

1. **Propojení podle e-mailu:** default = jen jednoznačná shoda + `email_verified` (pravidlo 2).
2. **Staff účty:** default = stejné pravidlo + auditní log; přísnější varianta jen na explicitní pokyn.
3. **Auto-registrace Googlem:** default = ano (stejné chování jako magic link dnes).
4. **Jeden OAuth klient pro test i prod:** default = jeden, dva seznamy redirect URI; dva klienti
   jsou čistší oddělení, ale dvojí správa.
5. **Heslo nových Google účtů:** default = prázdné (jako magic link) + cesta k heslu přes
   „Zapomenuté heslo"; ve fázi 2 povolit nastavení bez starého hesla.
6. **Kde bude stránka se zásadami:** default = nová routa (`/ochrana-osobnich-udaju`) + odkaz
   v patičce; alternativa je článek v sekci Blog.
7. **Kdo vlastní projekt v Google Cloudu** (majitel domény, účet s přístupem k DNS pro ověření domény).

## Ověřeno / neověřeno

**Ověřeno:** čísla z produkční DB (SSH + `psql`, read-only, schéma `public`); živé `/signIn`
v prohlížeči; všechny citované cesty v kódu; experiment s drift gate proti lokálně replikované DB
(PostgreSQL 18 + Prisma 6.19.3, migrace z repa, scratch databáze); seznam klíčů v `.env` na obou
instancích (jen názvy, ne hodnoty).

**Neověřeno:** přesné aktuální požadavky Google konzole (nutno projít v UI, mění se — od 2024
je to „Google Auth Platform" se záložkami Branding/Audience/Clients); zda existuje nějaký starý
Google projekt z Java verze aplikace; chování test instance (test DB je kopie produkce, čísla
výše jsou z produkce).

## Zdroje

- Google, *Manage OAuth App Branding* — požadavky na homepage a zásady ochrany osobních údajů:
  https://support.google.com/cloud/answer/15549049
- Google for Developers, *Configure the OAuth consent screen and choose scopes* — citlivost scopes:
  https://developers.google.com/workspace/guides/configure-oauth-consent

---

## Provedeno (20. 10. 2026): fáze 0 a 1

Fáze 0 (normalizace e-mailů) je hotová a nasazená — `PR #86`, `#87`, viz
`docs/navrh-normalizace-emailu.md`. Fáze 1 (vlastní Google přihlášení) je v `PR #93`.

**Databáze:** nová tabulka `csld_oauth_account` (migrace
`prisma/migrations/20261020130000_add_oauth_accounts`), `provider_account_id` = Google `sub`,
`provider_email` jen jako nápověda. Dvě unikátní omezení dělají pravidla strukturálními:
`(provider, provider_account_id)` = jedna identita patří jednomu účtu, `(user_id, provider)` = jeden
účet má nejvýš jednu Google identitu. Migrace je vygenerovaná přes `prisma migrate diff`, takže
drift gate zůstává tichý (ověřeno: „No difference detected“).

**Server:** router `src/api/src/auth/googleRoutes.ts`, mountovaný v `server.ts` na `/auth/google`.
- `GET /auth/google` — `state` + PKCE (S256, verifier v session), `returnTo` jen jako relativní cesta
  (`//evil.example` se zahazuje), přesměrování na `accounts.google.com` (URL se skládá ručně —
  `googleapis` typuje `code_challenge_method` jako enum; výměna kódu a `verifyIdToken` jdou přes
  knihovnu, protože ručně ověřovat podpis ID tokenu by bylo to jediné skutečně nebezpečné místo).
- `GET /auth/google/callback` — ověří `state` proti session (a hned ho smaže, takže replay nemá co
  najít), vymění kód, ověří ID token včetně `audience`, rozhodne o propojení a na konci udělá přesně
  to co magic link: `req.login(authUser)` + `setRememberMeCookie` + redirect na `returnTo`.
- `GET /auth/google/status` — `{ enabled }`; tlačítko se vykreslí jen když je klient nakonfigurovaný,
  takže deploy bez credencí neukáže mrtvý odkaz.
- `src/api/src/auth/googleLink.ts` — rozhodovací pravidla 1–5 bez HTTP, testovatelná samostatně.

**Pravidla (implementováno přesně podle sekce „Bezpečnost“):** existující propojení → přihlásit
(rozhoduje `sub`, ne e-mail); potvrzený e-mail s právě jedním účtem → propojit a přihlásit (s
`console.warn` auditní stopou, u staff účtu s výslovným označením `STAFF account (role N)`);
víc účtů na jeden e-mail → odmítnout (`?error=google_ambiguous`) a nic nezapisovat; nikdo → založit
účet (`role = 1`, prázdné heslo, jméno z Google) a propojit; účet už propojený s jinou Google identitou
→ odmítnout (`?error=google_conflict`); nepotvrzený e-mail → odmítnout. `role` ani `is_author` se
nikdy nemění. Souběh dvou callbacků řeší unikátní omezení + dočtení vítěze.

**UI:** `GoogleSignInButton` (prostý odkaz, žádná `NEXT_PUBLIC_*` proměnná, žádný rebuild) v
`SignInPanel` (pokrývá `/signIn`, `SignInRequiredWrapper` i in-place přihlášení) a v `SignUpPanel`.
Chybové stavy mají české i anglické hlášky (`SignIn.googleError.*`). `returnTo` vrací uživatele tam,
kde byl (hodnocení, komentář).

**Testy:** `googleLink.test.ts` (matice pravidel 1–5, registrace v kanonickém tvaru, staff účet beze
změny role, log), `googleRoutes.supertest.test.ts` (status, inertní režim, PKCE v URL, chybějící a
nesouhlasící `state`, replay, zrušený souhlas, `safeReturnTo` proti open redirectu),
`googleSignInButton.test.tsx` (nevykreslí se bez konfigurace, jinak odkaz, chybové hlášky).
API suite 328 → 347 testů, web 498 → 504.

**Konfigurace, která zbývá (mimo repo):**
1. V Google Auth Platform založit **Web** OAuth klienta s redirect URI
   `https://larpovadatabaze.cz/auth/google/callback` a `https://csld.vezlute.cz/auth/google/callback`
   (+ `http://localhost:8080/auth/google/callback` pro lokál).
2. Do GitHubu přidat secrets `GOOGLE_CLIENT_ID` a `GOOGLE_CLIENT_SECRET`. Oba deploy workflowy je
   zapíšou do `.env` na serveru (a `GOOGLE_REDIRECT_URI` podle instance) — dokud secret neexistuje,
   feature je inertní a tlačítko se neukáže.
3. Consent screen: branding, homepage, **odkaz na zásady ochrany osobních údajů** (viz fáze 2 — bez
   něj Google externí aplikaci nepustí do produkce), audience External + publikovat, scopes
   `openid email profile`.

**Zásady ochrany osobních údajů (dřív blokovaly publikaci consent screenu) jsou hotové** — stránka
`/ochrana-osobnich-udaju`, odkaz v patičce na každé stránce a upozornění pod registrací
(`src/components/Privacy/PrivacyPolicyPanel.tsx`). Text není šablona: vychází z ověřeného seznamu
údajů (sloupce `csld_csld_user` včetně data narození a města, obsah, cookies `csld.sid`/`LoggedIn`,
tokeny, Google Analytics s Consent Mode, reCAPTCHA, Gmail SMTP, nginx logy 14 dní, denní zálohy do
soukromého GitHub repozitáře) a testy hlídají jednotlivá tvrzení. Dvě věci k rozhodnutí provozovatele:
(1) zálohy drží historii bez zkracování, takže výmaz ze záloh je dnes ruční — vyplatí se doplnit
retenci do `csld-backup-git.sh`; (2) `birth_date` a `address` (zobrazovaný jako „město“) jsou
nepovinné, ale u 1 157 resp. 1 799 účtů vyplněné — stojí za revizi, jestli je ještě potřebujeme.

**Co zůstává na fázi 2:** propojení/odpojení Google účtu v profilu (GraphQL — dvě kopie schématu +
codegen) a nastavení hesla bez starého hesla (jinak se uživatel s prázdným heslem k heslu dostane jen
přes „Zapomenuté heslo“).
