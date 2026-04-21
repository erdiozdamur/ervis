-- CreateTable
CREATE TABLE "secret_rotation_audits" (
    "id" TEXT NOT NULL,
    "secretKey" VARCHAR(64) NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" VARCHAR(320) NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "note" TEXT,
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secret_rotation_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "secret_rotation_audits_secretKey_happenedAt_idx" ON "secret_rotation_audits"("secretKey", "happenedAt");

-- CreateIndex
CREATE INDEX "secret_rotation_audits_actorUserId_happenedAt_idx" ON "secret_rotation_audits"("actorUserId", "happenedAt");
