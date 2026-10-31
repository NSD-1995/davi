import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** School-scoped setup lifecycle. Kept separate from tenant provisioning and profile management. */
@Injectable()
export class SchoolOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async state(schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    const onboarding = await (this.prisma as any).schoolOnboarding.findUnique({ where: { schoolId } });
    if (!onboarding) throw new NotFoundException('School onboarding record not found.');
    return {
      status: onboarding.status,
      completedAt: onboarding.completedAt,
      welcomeShownAt: onboarding.welcomeShownAt,
      onboardingCurrentStep: onboarding.onboardingCurrentStep || 1,
      isWizardCompleted: onboarding.status === 'COMPLETED',
      isWizardSkipped: onboarding.status === 'SKIPPED',
      shouldShowWelcome: ['COMPLETED', 'SKIPPED'].includes(onboarding.status) && !onboarding.welcomeShownAt,
    };
  }

  async complete(schoolId: string | null, skipped = false) {
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    const status = skipped ? 'SKIPPED' : 'COMPLETED';
    const result = await (this.prisma as any).schoolOnboarding.updateMany({ where: { schoolId, status: { in: ['PENDING', status] } }, data: { status, completedAt: new Date(), onboardingCurrentStep: 5 } });
    if (!result.count) throw new ConflictException('School onboarding is already in a different state.');
    return this.state(schoolId);
  }

  async saveProgress(schoolId: string | null, step: unknown) {
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    const onboardingCurrentStep = Number(step);
    if (!Number.isInteger(onboardingCurrentStep) || onboardingCurrentStep < 1 || onboardingCurrentStep > 5) throw new BadRequestException('Use an onboarding step between 1 and 5.');
    await (this.prisma as any).schoolOnboarding.updateMany({ where: { schoolId, status: 'PENDING' }, data: { onboardingCurrentStep } });
    return this.state(schoolId);
  }

  async resume(schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    await (this.prisma as any).schoolOnboarding.updateMany({ where: { schoolId, status: 'SKIPPED' }, data: { status: 'PENDING', welcomeShownAt: new Date() } });
    return this.state(schoolId);
  }

  async acknowledgeWelcome(schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    await (this.prisma as any).schoolOnboarding.updateMany({ where: { schoolId, status: { in: ['COMPLETED', 'SKIPPED'] }, welcomeShownAt: null }, data: { welcomeShownAt: new Date() } });
    return this.state(schoolId);
  }
}
