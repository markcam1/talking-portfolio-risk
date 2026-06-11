-- AddColumn tenantId to all models (multi-tenancy stub)
-- Default "default" keeps all existing rows in the default tenant

ALTER TABLE "Portfolio" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Contact" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Consent" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "CallerProfile" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "OwnedNumber" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "DncEntry" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Job" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "CallRecord" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
