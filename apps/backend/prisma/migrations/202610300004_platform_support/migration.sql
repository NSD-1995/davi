CREATE TYPE "PlatformSupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_SCHOOL', 'RESOLVED', 'CLOSED');
CREATE TYPE "PlatformSupportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "PlatformSupportTicket" (
  "id" TEXT NOT NULL, "schoolId" TEXT, "requesterEmail" TEXT NOT NULL, "requesterName" TEXT,
  "subject" TEXT NOT NULL, "status" "PlatformSupportStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "PlatformSupportPriority" NOT NULL DEFAULT 'NORMAL', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "PlatformSupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformSupportTicket_schoolId_status_idx" ON "PlatformSupportTicket"("schoolId","status");
CREATE INDEX "PlatformSupportTicket_status_priority_createdAt_idx" ON "PlatformSupportTicket"("status","priority","createdAt");
ALTER TABLE "PlatformSupportTicket" ADD CONSTRAINT "PlatformSupportTicket_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformSupportMessage" (
  "id" TEXT NOT NULL, "ticketId" TEXT NOT NULL, "authorId" TEXT, "authorName" TEXT, "body" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSupportMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformSupportMessage_ticketId_createdAt_idx" ON "PlatformSupportMessage"("ticketId","createdAt");
ALTER TABLE "PlatformSupportMessage" ADD CONSTRAINT "PlatformSupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "PlatformSupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
