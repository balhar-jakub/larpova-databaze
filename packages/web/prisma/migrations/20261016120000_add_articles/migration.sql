-- CreateTable
CREATE TABLE "csld_article" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "perex" TEXT,
    "language" VARCHAR(10) NOT NULL DEFAULT 'cs',
    "authors" TEXT,
    "author_id" INTEGER,
    "published_at" TIMESTAMP(3),
    "categories" TEXT[],
    "tags" TEXT[],
    "image_url" TEXT,
    "fetched_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csld_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_article_has_game" (
    "article_id" INTEGER NOT NULL,
    "game_id" INTEGER NOT NULL,

    CONSTRAINT "csld_article_has_game_pkey" PRIMARY KEY ("article_id","game_id")
);

-- CreateIndex
CREATE INDEX "csld_article_published_at_idx" ON "csld_article"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "csld_article_source_source_id_key" ON "csld_article"("source", "source_id");

-- AddForeignKey
ALTER TABLE "csld_article" ADD CONSTRAINT "csld_article_user_fk" FOREIGN KEY ("author_id") REFERENCES "csld_csld_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_article_has_game" ADD CONSTRAINT "csld_article_game_article_fk" FOREIGN KEY ("article_id") REFERENCES "csld_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_article_has_game" ADD CONSTRAINT "csld_article_game_game_fk" FOREIGN KEY ("game_id") REFERENCES "csld_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

