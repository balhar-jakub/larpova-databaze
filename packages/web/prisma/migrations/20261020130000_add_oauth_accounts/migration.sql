-- CreateTable
CREATE TABLE "csld_oauth_account" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "provider_email" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csld_oauth_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "csld_oauth_account_user_idx" ON "csld_oauth_account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "csld_oauth_account_provider_account_key" ON "csld_oauth_account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "csld_oauth_account_user_provider_key" ON "csld_oauth_account"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "csld_oauth_account" ADD CONSTRAINT "csld_oauth_account_user_fk" FOREIGN KEY ("user_id") REFERENCES "csld_csld_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

