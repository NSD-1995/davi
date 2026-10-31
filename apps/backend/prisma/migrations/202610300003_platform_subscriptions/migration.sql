CREATE TYPE "SubscriptionPlanCode" AS ENUM ('BASIC', 'AI_PLUS', 'PREMIUM');
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING_VERIFICATION', 'CONFIRMED', 'REJECTED', 'REFUNDED');

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL, "code" "SubscriptionPlanCode" NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "features" JSONB NOT NULL, "monthlyAmount" INTEGER NOT NULL, "quarterlyAmount" INTEGER NOT NULL,
  "yearlyAmount" INTEGER NOT NULL, "aiQuota" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

CREATE TABLE "SchoolSubscription" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "planId" TEXT NOT NULL, "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "billingFrequency" "BillingFrequency" NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE,
  "currentPeriodStart" DATE, "currentPeriodEnd" DATE, "nextInvoiceDate" DATE, "priceSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SchoolSubscription_schoolId_status_idx" ON "SchoolSubscription"("schoolId","status");
ALTER TABLE "SchoolSubscription" ADD CONSTRAINT "SchoolSubscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolSubscription" ADD CONSTRAINT "SchoolSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SubscriptionInvoice" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL, "invoiceNumber" TEXT NOT NULL,
  "periodStart" DATE NOT NULL, "periodEnd" DATE NOT NULL, "issuedAt" TIMESTAMP(3), "dueDate" DATE NOT NULL,
  "baseAmount" INTEGER NOT NULL, "discountAmount" INTEGER NOT NULL DEFAULT 0, "taxAmount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL, "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE UNIQUE INDEX "SubscriptionInvoice_subscriptionId_periodStart_periodEnd_key" ON "SubscriptionInvoice"("subscriptionId","periodStart","periodEnd");
CREATE INDEX "SubscriptionInvoice_schoolId_status_dueDate_idx" ON "SubscriptionInvoice"("schoolId","status","dueDate");
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SchoolSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SubscriptionPayment" (
  "id" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "method" TEXT NOT NULL, "reference" TEXT NOT NULL,
  "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION', "paidAt" DATE NOT NULL,
  "recordedBy" TEXT NOT NULL, "verifiedBy" TEXT, "verifiedAt" TIMESTAMP(3), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPayment_invoiceId_reference_key" ON "SubscriptionPayment"("invoiceId","reference");
CREATE INDEX "SubscriptionPayment_invoiceId_status_idx" ON "SubscriptionPayment"("invoiceId","status");
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
