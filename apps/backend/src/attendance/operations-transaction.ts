import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
export async function operationsTransaction<T>(db: any, run: (tx: any) => Promise<T>, options: any = {}) {
    try {
        return await db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, ...options }) as T;
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (['P2002', 'P2034'].includes(error.code))
                throw new ConflictException('These records changed while saving. Refresh and retry.');
            if (error.code === 'P2025')
                throw new NotFoundException('Record no longer exists.');
            if (['P2003', 'P2004'].includes(error.code))
                throw new BadRequestException('Related records or record constraints changed. Refresh and retry.');
        }
        throw error;
    }
}
