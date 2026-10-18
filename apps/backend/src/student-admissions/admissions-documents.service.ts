import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AdmissionsCrmService } from './admissions-crm.service';
import { admissionsTransaction } from './admissions-transaction';
import { parse, text } from './admissions-rules';

@Injectable()
export class AdmissionsDocumentsService {
  constructor(private readonly db: PrismaService, private readonly crm: AdmissionsCrmService) {}
  private directory = resolve(process.cwd(), 'private-uploads', 'admissions');
  async upload(schoolId: string | null, actorId: string, applicationId: string, kindInput: unknown, file: any) {
    this.crm.school(schoolId); const kind = parse(text, kindInput);
    if (!file?.buffer || file.buffer.length > 5 * 1024 * 1024 || !file.buffer.length) throw new BadRequestException('Choose a PDF, PNG or JPEG up to 5 MB.');
    const buffer: Buffer = file.buffer;
    const mimeType = buffer.subarray(0,5).toString() === '%PDF-' ? 'application/pdf' : buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 ? 'image/jpeg' : null;
    if (!mimeType) throw new BadRequestException('Only PDF, PNG and JPEG documents are supported.');
    const fileKey = randomUUID(); await mkdir(this.directory, { recursive: true });
    await this.crm.application(schoolId, applicationId);
    const filename = resolve(this.directory, fileKey); await writeFile(filename, buffer, { flag: 'wx' });
    try { return await admissionsTransaction(this.db, async tx => {
      const application = await this.crm.application(schoolId, applicationId, tx);
      if (application.documents.length >= 20) throw new BadRequestException('An application can have at most 20 documents.');
      const document = await tx.admissionDocument.create({ data: { schoolId, applicationId, kind, fileKey, mimeType, size: buffer.length, uploadedById: actorId, name: String(file.originalname || 'Document').replace(/[\x00-\x1f/\\]/g, '_').slice(0,200) }, select: { id: true, name: true, kind: true, mimeType: true, size: true } });
      await this.crm.activity(tx, schoolId, actorId, 'DOCUMENT_UPLOADED', { documentId: document.id, kind }, { applicationId }); return document;
    }); } catch (error) { await unlink(filename).catch(() => undefined); throw error; }
  }
  async download(schoolId: string | null, applicationId: string, documentId: string) {
    this.crm.school(schoolId); const document = await this.db.admissionDocument.findFirst({ where: { id: documentId, schoolId, applicationId } });
    if (!document || !/^[a-f0-9-]{36}$/.test(document.fileKey)) throw new NotFoundException('Document not found.');
    try { return { document, buffer: await readFile(resolve(this.directory, document.fileKey)) }; } catch { throw new NotFoundException('Document file is unavailable.'); }
  }
}
