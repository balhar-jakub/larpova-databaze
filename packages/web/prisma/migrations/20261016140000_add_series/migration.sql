-- Series: recurring games (Florie, Zlenice, Bezkrálí …) are today one row per
-- instalment, with the year crammed into the name ("Florie [2000]"). A series is
-- a relationship between the existing game rows, not a merge of them: each
-- instalment keeps its ratings, comments and play states.
CREATE TABLE "csld_series" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "added" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" INTEGER,
    "deleted" BOOLEAN DEFAULT false,
    CONSTRAINT "csld_series_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "csld_game" ADD COLUMN "series_id" INTEGER;

ALTER TABLE "csld_game" ADD CONSTRAINT "csld_game_series_fk" FOREIGN KEY ("series_id") REFERENCES "csld_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: create one series per recurring name found in the data. The
-- heuristic groups games whose name is the same after whitespace
-- normalization, with at least two instalments, and names the series by the
-- normalized name. Series whose instalments differ only by a year in the name
-- ("Florie [2000]" vs "Florie Obroda") are NOT merged by a machine — they need
-- a human decision and are linked from the game edit form. Imported series stay
-- where they are; nothing is renamed or merged.
WITH candidates AS (
    SELECT regexp_replace(btrim(name), '\s+', ' ', 'g') AS base_name,
           min(id) AS keep_id
    FROM csld_game
    WHERE deleted = false AND name IS NOT NULL
    GROUP BY 1
    HAVING count(*) >= 2
),
new_series AS (
    INSERT INTO csld_series (name, description, added_by, deleted)
    SELECT base_name, NULL, NULL, false
    FROM candidates
    WHERE NOT EXISTS (SELECT 1 FROM csld_series s WHERE s.name = candidates.base_name)
    RETURNING id, name
)
UPDATE csld_game g
SET series_id = ns.id
FROM new_series ns
JOIN candidates c ON c.base_name = ns.name
WHERE regexp_replace(btrim(g.name), '\s+', ' ', 'g') = ns.name
  AND g.deleted = false;
