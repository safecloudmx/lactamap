-- Add publicToken for shareable QR codes (hard-to-guess UUID)
ALTER TABLE "PumpingSession" ADD COLUMN "publicToken" TEXT;
CREATE UNIQUE INDEX "PumpingSession_publicToken_key" ON "PumpingSession"("publicToken");

-- Add consumedAt timestamp for 15-min lock on CONSUMED status
ALTER TABLE "PumpingSession" ADD COLUMN "consumedAt" TIMESTAMP(3);

-- Backfill existing sessions with a random UUID token
UPDATE "PumpingSession" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE "PumpingSession" ALTER COLUMN "publicToken" SET NOT NULL;
ALTER TABLE "PumpingSession" ALTER COLUMN "publicToken" SET DEFAULT gen_random_uuid()::text;
