CREATE TABLE "PlatformPasswordReset" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "requestedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformPasswordReset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformPasswordReset_tokenHash_key" ON "PlatformPasswordReset"("tokenHash");
CREATE INDEX "PlatformPasswordReset_userId_expiresAt_idx" ON "PlatformPasswordReset"("userId","expiresAt");
ALTER TABLE "PlatformPasswordReset" ADD CONSTRAINT "PlatformPasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
