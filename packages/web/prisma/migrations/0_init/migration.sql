-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "csld_comment" (
    "user_id" INTEGER,
    "game_id" INTEGER,
    "comment" TEXT NOT NULL,
    "added" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "id" SERIAL NOT NULL,
    "amount_of_upvotes" INTEGER,

    CONSTRAINT "csld_comment_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_comment_upvote" (
    "id" SERIAL NOT NULL,
    "comment_id" INTEGER,
    "user_id" INTEGER,
    "added" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csld_comment_upvote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_csld_group" (
    "id" SERIAL NOT NULL,
    "image" INTEGER,
    "administrator_id" INTEGER,
    "name" TEXT,

    CONSTRAINT "csld_csld_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_csld_user" (
    "id" SERIAL NOT NULL,
    "password" TEXT NOT NULL,
    "role" SMALLINT NOT NULL,
    "name" TEXT,
    "nickname" TEXT,
    "birth_date" DATE,
    "email" VARCHAR(200),
    "image" INTEGER,
    "address" TEXT,
    "description" TEXT,
    "is_author" BOOLEAN DEFAULT false,
    "amount_of_comments" INTEGER DEFAULT 0,
    "amount_of_played" INTEGER DEFAULT 0,
    "amount_of_created" INTEGER DEFAULT 0,
    "best_game_id" INTEGER,
    "last_rating" INTEGER,
    "default_lang" VARCHAR(10),
    "gender" INTEGER DEFAULT 0,

    CONSTRAINT "csld_csld_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_email_authentication" (
    "id" SERIAL NOT NULL,
    "auth_token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csld_email_authentication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_game" (
    "id" SERIAL NOT NULL,
    "year" INTEGER,
    "web" TEXT,
    "hours" INTEGER,
    "days" INTEGER,
    "players" INTEGER,
    "men_role" INTEGER,
    "women_role" INTEGER,
    "both_role" INTEGER,
    "added" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "video" INTEGER,
    "image" INTEGER,
    "added_by" INTEGER,
    "total_rating" DOUBLE PRECISION,
    "amount_of_comments" INTEGER DEFAULT 0,
    "amount_of_played" INTEGER DEFAULT 0,
    "amount_of_ratings" INTEGER DEFAULT 0,
    "gallery_url" TEXT,
    "photo_author" TEXT,
    "average_rating" DOUBLE PRECISION,
    "deleted" BOOLEAN,
    "lang" VARCHAR(32) DEFAULT 'cs',
    "ratingsdisabled" BOOLEAN NOT NULL DEFAULT false,
    "commentsdisabled" BOOLEAN NOT NULL DEFAULT false,
    "cover_photo" INTEGER,
    "cover_image" INTEGER,
    "show_in_advertisements" BOOLEAN DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "blueprint_path" TEXT,

    CONSTRAINT "csld_game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_game_has_author" (
    "id_user" INTEGER NOT NULL,
    "id_game" INTEGER NOT NULL,

    CONSTRAINT "csld_game_has_author_pkey" PRIMARY KEY ("id_user","id_game")
);

-- CreateTable
CREATE TABLE "csld_game_has_event" (
    "game_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,

    CONSTRAINT "csld_game_has_event_pkey" PRIMARY KEY ("game_id","event_id")
);

-- CreateTable
CREATE TABLE "csld_game_has_group" (
    "id_group" INTEGER NOT NULL,
    "id_game" INTEGER NOT NULL,

    CONSTRAINT "csld_game_has_group_pkey" PRIMARY KEY ("id_group","id_game")
);

-- CreateTable
CREATE TABLE "csld_game_has_label" (
    "id_label" INTEGER NOT NULL,
    "id_game" INTEGER NOT NULL,

    CONSTRAINT "csld_game_has_label_pkey" PRIMARY KEY ("id_label","id_game")
);

-- CreateTable
CREATE TABLE "csld_image" (
    "id" SERIAL NOT NULL,
    "path" TEXT,
    "contenttype" VARCHAR(256),

    CONSTRAINT "csld_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_label" (
    "id" SERIAL NOT NULL,
    "is_required" BOOLEAN DEFAULT false,
    "is_authorized" BOOLEAN DEFAULT false,
    "added_by" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,

    CONSTRAINT "csld_label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_photo" (
    "id" SERIAL NOT NULL,
    "image" INTEGER NOT NULL,
    "author" INTEGER,
    "game" INTEGER,
    "orderseq" INTEGER NOT NULL DEFAULT 0,
    "description" VARCHAR(2048),
    "fullwidth" INTEGER NOT NULL DEFAULT 0,
    "fullheight" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN DEFAULT false,

    CONSTRAINT "csld_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_rating" (
    "user_id" INTEGER NOT NULL,
    "game_id" INTEGER NOT NULL,
    "rating" INTEGER,
    "added" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL,
    "state" INTEGER,
    "by_author" BOOLEAN DEFAULT false,

    CONSTRAINT "csld_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csld_video" (
    "id" SERIAL NOT NULL,
    "path" TEXT,
    "type" INTEGER NOT NULL,

    CONSTRAINT "csld_video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation" (
    "id" SERIAL NOT NULL,
    "donor" TEXT,
    "date" DATE,
    "amount" DOUBLE PRECISION,
    "description" TEXT,

    CONSTRAINT "donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "loc" TEXT,
    "source" TEXT,
    "amountofplayers" INTEGER,
    "from" TIMESTAMPTZ(6),
    "to" TIMESTAMPTZ(6),
    "language" VARCHAR(50),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "added_by" INTEGER,
    "web" TEXT,
    "registration_url" TEXT,
    "registration_status" TEXT,
    "registration_opens_at" TIMESTAMPTZ(6),
    "deleted" BOOLEAN DEFAULT false,
    "lang" TEXT,
    "gcaleventid" VARCHAR(100),
    "gcaleventlastupdated" BIGINT,
    "cover_image" INTEGER,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_has_labels" (
    "event_id" INTEGER NOT NULL,
    "label_id" INTEGER NOT NULL,

    CONSTRAINT "event_has_labels_pkey" PRIMARY KEY ("event_id","label_id")
);

-- CreateTable
CREATE TABLE "fb_search_queries" (
    "id" SERIAL NOT NULL,
    "query" TEXT,
    "type" TEXT,

    CONSTRAINT "fb_search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flyway_schema_history" (
    "installed_rank" INTEGER NOT NULL,
    "version" VARCHAR(50),
    "description" VARCHAR(200) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "script" VARCHAR(1000) NOT NULL,
    "checksum" INTEGER,
    "installed_by" VARCHAR(100) NOT NULL,
    "installed_on" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "execution_time" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,

    CONSTRAINT "flyway_schema_history_pk" PRIMARY KEY ("installed_rank")
);

-- CreateTable
CREATE TABLE "similar_games" (
    "id" SERIAL NOT NULL,
    "id_game1" INTEGER,
    "id_game2" INTEGER,
    "similarity_coefficient" DOUBLE PRECISION,

    CONSTRAINT "similar_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_added_idx" ON "csld_comment"("added");

-- CreateIndex
CREATE UNIQUE INDEX "unique_email" ON "csld_csld_user"("email");

-- CreateIndex
CREATE INDEX "user_amount_of_comments_idx" ON "csld_csld_user"("amount_of_comments");

-- CreateIndex
CREATE INDEX "user_amount_of_played_idx" ON "csld_csld_user"("amount_of_played");

-- CreateIndex
CREATE INDEX "user_best_game_idx" ON "csld_csld_user"("best_game_id");

-- CreateIndex
CREATE INDEX "user_name_idx" ON "csld_csld_user"("name");

-- CreateIndex
CREATE INDEX "game_added_idx" ON "csld_game"("added");

-- CreateIndex
CREATE INDEX "game_amount_of_comments_idx" ON "csld_game"("amount_of_comments");

-- CreateIndex
CREATE INDEX "game_amount_of_played_idx" ON "csld_game"("amount_of_played");

-- CreateIndex
CREATE INDEX "game_amount_of_ratings_idx" ON "csld_game"("amount_of_ratings");

-- CreateIndex
CREATE INDEX "total_rating_idx" ON "csld_game"("total_rating");

-- CreateIndex
CREATE UNIQUE INDEX "csld_rating_game_id_user_id_key" ON "csld_rating"("game_id", "user_id");

-- CreateIndex
CREATE INDEX "flyway_schema_history_s_idx" ON "flyway_schema_history"("success");

-- AddForeignKey
ALTER TABLE "csld_comment" ADD CONSTRAINT "csld_comment_game_fk" FOREIGN KEY ("game_id") REFERENCES "csld_game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_comment" ADD CONSTRAINT "csld_comment_user_fk" FOREIGN KEY ("user_id") REFERENCES "csld_csld_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_comment_upvote" ADD CONSTRAINT "FKolgxe7lbwwvh5bfboev7sxare" FOREIGN KEY ("user_id") REFERENCES "csld_csld_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_comment_upvote" ADD CONSTRAINT "FKq86ju9n3jnsefnnaosun3sgk6" FOREIGN KEY ("comment_id") REFERENCES "csld_comment"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_csld_group" ADD CONSTRAINT "FKca03ex20heis9f6voo7xtqxsw" FOREIGN KEY ("administrator_id") REFERENCES "csld_csld_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_csld_group" ADD CONSTRAINT "csld_group_image_pk" FOREIGN KEY ("image") REFERENCES "csld_image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_csld_user" ADD CONSTRAINT "FKo1rwv4yy7imwowct55qidvrt5" FOREIGN KEY ("image") REFERENCES "csld_image"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_email_authentication" ADD CONSTRAINT "csld_email_authentication_user_fk" FOREIGN KEY ("user_id") REFERENCES "csld_csld_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game" ADD CONSTRAINT "csld_game_added_by_fk" FOREIGN KEY ("added_by") REFERENCES "csld_csld_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game" ADD CONSTRAINT "csld_game_image_fk" FOREIGN KEY ("image") REFERENCES "csld_image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game" ADD CONSTRAINT "csld_game_video_fk" FOREIGN KEY ("video") REFERENCES "csld_video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game" ADD CONSTRAINT "game_cover_image_fk" FOREIGN KEY ("cover_image") REFERENCES "csld_image"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_game" ADD CONSTRAINT "game_photo_cover_fk" FOREIGN KEY ("cover_photo") REFERENCES "csld_photo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_game_has_author" ADD CONSTRAINT "csld_user_fk" FOREIGN KEY ("id_user") REFERENCES "csld_csld_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game_has_author" ADD CONSTRAINT "game_fk" FOREIGN KEY ("id_game") REFERENCES "csld_game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game_has_event" ADD CONSTRAINT "FK2mms2rr7bdltm6vomirbj105" FOREIGN KEY ("game_id") REFERENCES "csld_game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_game_has_event" ADD CONSTRAINT "FKecmspf5rpsu6hk2hvninqh11j" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_game_has_group" ADD CONSTRAINT "game_fk" FOREIGN KEY ("id_game") REFERENCES "csld_game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game_has_group" ADD CONSTRAINT "group_fk" FOREIGN KEY ("id_group") REFERENCES "csld_csld_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game_has_label" ADD CONSTRAINT "game_fk" FOREIGN KEY ("id_game") REFERENCES "csld_game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_game_has_label" ADD CONSTRAINT "label_fk" FOREIGN KEY ("id_label") REFERENCES "csld_label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_label" ADD CONSTRAINT "csld_label_user_fk" FOREIGN KEY ("added_by") REFERENCES "csld_csld_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_photo" ADD CONSTRAINT "FK4vs16vhiveflo1laqnlu1pb6g" FOREIGN KEY ("game") REFERENCES "csld_game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "csld_photo" ADD CONSTRAINT "csld_photo_image_fk" FOREIGN KEY ("image") REFERENCES "csld_image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_photo" ADD CONSTRAINT "csld_photo_person_fk" FOREIGN KEY ("author") REFERENCES "csld_csld_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_rating" ADD CONSTRAINT "csld_rating_game_fk" FOREIGN KEY ("game_id") REFERENCES "csld_game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csld_rating" ADD CONSTRAINT "csld_rating_user_fk" FOREIGN KEY ("user_id") REFERENCES "csld_csld_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_added_by" FOREIGN KEY ("added_by") REFERENCES "csld_csld_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_cover_image_fk" FOREIGN KEY ("cover_image") REFERENCES "csld_image"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_has_labels" ADD CONSTRAINT "FK340a57aimx0etc1f0rk9qujta" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_has_labels" ADD CONSTRAINT "FKf3egluya6u415d84qgady980e" FOREIGN KEY ("label_id") REFERENCES "csld_label"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "similar_games" ADD CONSTRAINT "similar_games_game_1_fk" FOREIGN KEY ("id_game1") REFERENCES "csld_game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "similar_games" ADD CONSTRAINT "similar_games_game_2_fk" FOREIGN KEY ("id_game2") REFERENCES "csld_game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

