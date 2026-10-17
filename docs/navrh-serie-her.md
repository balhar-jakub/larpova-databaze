# Série her — návrh a data

Opakující se hry (Florie, Zlenice, Bezkrálí…) jsou dnes v databázi jedna řada na
díl, s rokem v názvu. Návrh zavádí `csld_series` jako vztah nad existujícími
hrami — žádné slučování, každý díl si nechává svoje hlasy, recenze i „hrál jsem“.

## Co je dnes v datech (produkce, 17. 10. 2026)

- **107 her** má v názvu `[rok]`; další desítky jen konvencí pojmenování.
- Florie = **9 samostatných záznamů** (`Florie [2000]`, `Florie [2001]`,
  `Florie - přístav Ostrie [2006]`, `Florie Obroda [2016]`,
  `Florie: Pod tlakem`…) + 6 akcí v kalendáři (2017–2027, včetně budoucích).
- Hodnocení jsou roztahaná: 41 hlasů, 42 hráčů, 26 recenzí celkem, ale žádný
  jednotlivý záznam nemá víc než 28 hlasů — v žebříčcích se proto série neprosadí.
- Hledání „Florie“ vrátí devět skoro stejných řádků.
- Další řady z dat: Zlenice 18 dílů, Bezkrálí 14, Pražská hlídka 14, Arkánum 12,
  Pán Prstenů – Bitva o Středozem 11, Trója 6, Cormalen 5.

## Model

```prisma
model csld_series {
  id          Int         @id @default(autoincrement())
  name        String?
  description String?
  added       DateTime    @default(now())
  added_by    Int?
  deleted     Boolean?    @default(false)
  csld_game   csld_game[]
}
```

`csld_game.series_id` je nullable s `ON DELETE SET NULL`: smazání série hry
neruší, jen je přestane seskupovat.

### Backfill v migraci

Migrace zakládá série pro hry, jejichž název je po normalizaci mezer **shodný**,
s alespoň dvěma díly (`Bitva o Fort`, `Derniéra`, `Konference`, `Příběhy
Zapomenutých říší`, `Dobro proti Dobru VIII`). Názvy lišící se rokem
(`Florie [2000]` vs `Florie Obroda [2016]`) stroj neslučuje — u nich jde o
lidské rozhodnutí a propojí se z editačního formuláře. Záměr: migrace nesmí
tiše přepsat význam existujících dat.

## Rozhraní

- `Series` s agregáty počítanými **nad díly, které stejný dotaz vrací**
  (`amountOfGames`, `amountOfRatings`, `amountOfPlayed`, `amountOfComments`,
  `firstYear`, `lastYear`) — jedno číslo, jeden význam.
- `Game.series` — díl zná svoji sérii; osamocená hra odpovídá `null`.
- `seriesById`, `seriesByQuery` (našeptávač v editaci).
- Mutace `game.setGameSeries` — propojení, odpojení nebo založení série podle
  jména. Oprávnění jako u `updateGame`: autor hry, editor a admin.

## Obrazovka

- **Detail hry**: panel „Série: Florie (9)“ v pravém sloupci vedle stávajících
  panelů (stejná rodina: zelená hlavička + bílý obsah), se seznamem dílů
  (rok, badge pásma hodnocení, název), aktuální díl zvýrazněný. Hra bez série
  nevykreslí nic; stávající panely (Podobné larpy, Události, Larpy autorů)
  zůstávají.
- **Editace hry**: pole „Série“ s našeptávačem nad existujícími sériemi
  a volbou „Vytvořit novou sérii“.

## Co zůstává na člověku

- Propojení rokem odlišených dílů (Florie a spol.) — heuristika by u názvů typu
  `Florie Obroda` hádala špatně.
- Popis série a případné sloučení duplicitních dílů (`Bitva o Fort` má tři řádky
  se shodným názvem).
