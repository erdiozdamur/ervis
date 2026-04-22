-- Add user active/passive flag for admin controls.
ALTER TABLE "users"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "users_isActive_role_idx" ON "users"("isActive", "role");
