require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PlatformService } = require('../dist/platform/platform.service');

test('platform subscription creation snapshots pricing and issues the first active invoice', async () => {
  const created = { subscription: null, invoice: null };
  const plan = { id: 'plan', code: 'BASIC', name: 'Basic', isActive: true, monthlyAmount: 125000, quarterlyAmount: 350000, yearlyAmount: 1200000, aiQuota: 0, features: ['students'] };
  const tx = {
    schoolSubscription: { create: async ({ data }) => { created.subscription = data; return { id: 'sub-12345678', ...data }; } },
    subscriptionInvoice: { create: async ({ data }) => { created.invoice = data; return data; } },
  };
  const prisma = {
    school: { findUnique: async () => ({ id: 'school' }) },
    subscriptionPlan: { findUnique: async () => plan },
    schoolSubscription: { findFirst: async () => null },
    $transaction: async callback => callback(tx),
  };
  const service = new PlatformService(prisma);
  await service.createSubscription({ schoolId: 'school', planId: 'plan', billingFrequency: 'MONTHLY', startDate: '2026-11-01', status: 'ACTIVE' });
  assert.equal(created.subscription.billingFrequency, 'MONTHLY');
  assert.equal(created.subscription.priceSnapshot.amount, 125000);
  assert.equal(created.invoice.baseAmount, 125000);
  assert.equal(created.invoice.status, 'ISSUED');
  assert.equal(created.invoice.periodEnd.toISOString().slice(0, 10), '2026-11-30');
});

test('a trial subscription does not issue an invoice', async () => {
  let invoiceCreated = false;
  const tx = { schoolSubscription: { create: async ({ data }) => ({ id: 'sub', ...data }) }, subscriptionInvoice: { create: async () => { invoiceCreated = true; } } };
  const prisma = { school: { findUnique: async () => ({ id: 'school' }) }, subscriptionPlan: { findUnique: async () => ({ id: 'plan', code: 'AI_PLUS', name: 'AI Plus', isActive: true, monthlyAmount: 1, quarterlyAmount: 2, yearlyAmount: 3, aiQuota: 10, features: [] }) }, schoolSubscription: { findFirst: async () => null }, $transaction: async callback => callback(tx) };
  await new PlatformService(prisma).createSubscription({ schoolId: 'school', planId: 'plan', billingFrequency: 'YEARLY', startDate: '2026-11-01', status: 'TRIAL' });
  assert.equal(invoiceCreated, false);
});
