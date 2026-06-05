-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tickers" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "dateRange" TEXT NOT NULL,
    "optimizerRunRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumbers" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "policyId" TEXT NOT NULL DEFAULT 'self',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'none',
    "method" TEXT NOT NULL DEFAULT 'self_owned',
    "scope" TEXT NOT NULL DEFAULT 'automated_ai_voice_calls_about_their_portfolio',
    "grantedAt" DATETIME,
    "expiresAt" DATETIME,
    "evidenceUri" TEXT,
    "capturedBy" TEXT,
    "recordingConsent" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Consent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityName" TEXT NOT NULL,
    "callbackNumber" TEXT NOT NULL,
    "voicePersona" TEXT,
    "financialDisclaimer" TEXT NOT NULL DEFAULT 'Educational use only. Not investment advice.',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OwnedNumber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneE164" TEXT NOT NULL,
    "label" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT NOT NULL DEFAULT 'manual_confirm',
    "verifiedAt" DATETIME,
    "addedBy" TEXT NOT NULL DEFAULT 'operator',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DncEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneE164" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savedPortfolioId" TEXT,
    "contactId" TEXT,
    "phoneE164" TEXT NOT NULL,
    "callerProfileId" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "blockReason" TEXT,
    "policyId" TEXT NOT NULL DEFAULT 'self',
    "packId" TEXT,
    "complianceDir" TEXT,
    "modeHint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_savedPortfolioId_fkey" FOREIGN KEY ("savedPortfolioId") REFERENCES "Portfolio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_callerProfileId_fkey" FOREIGN KEY ("callerProfileId") REFERENCES "CallerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "providerCallSid" TEXT,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "outcome" TEXT,
    "modeChosen" TEXT,
    "recordingConsented" BOOLEAN NOT NULL DEFAULT false,
    "transcriptUri" TEXT,
    "disclosuresDelivered" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CallRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnedNumber_phoneE164_key" ON "OwnedNumber"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "DncEntry_phoneE164_key" ON "DncEntry"("phoneE164");
