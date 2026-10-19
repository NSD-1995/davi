import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export async function admissionsTransaction<T>(db: PrismaService, action: (tx: any) => Promise<T>, timeout = 30000): Promise<T> {
  try { return await db.$transaction(async tx => {
    const result = await action(tx);
    // Surface deferred capacity/uniqueness errors before Prisma returns the result.
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    return result;
  }, { isolationLevel: 'Serializable', timeout }); }
  catch (error: any) {
    if (error.code === 'P2034' || error.code === 'P2002') throw new ConflictException('Another change conflicts with this request or the record already exists. Refresh before retrying.');
    throw error;
  }
}
