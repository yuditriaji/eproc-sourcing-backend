import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// Rotates tenant DEKs by creating a new TenantKey version and re-encrypting Bid.encryptedData
// Usage: npx ts-node scripts/rotate-tenant-keys.ts TENANT_ID

const prisma = new PrismaClient();

function unwrapWithLocalKek(wrappedDek: string): Buffer {
  const kek = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'local-kek').digest();
  const buf = Buffer.from(wrappedDek, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function wrapWithLocalKek(plaintext: Buffer): string {
  const kek = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'local-kek').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decryptWithDek(ciphertext: string, dek: Buffer): Buffer {
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

function encryptWithDek(plaintext: Buffer, dek: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) throw new Error('TENANT_ID required');

  // Get current active key
  const active = await prisma.tenantKey.findFirst({ where: { tenantId, isActive: true }, orderBy: { version: 'desc' } });
  const newVersion = (active?.version || 0) + 1;

  // Create new DEK version
  const newDek = crypto.randomBytes(32);
  const wrappedDek = wrapWithLocalKek(newDek);
  await prisma.tenantKey.updateMany({ where: { tenantId }, data: { isActive: false } });
  await prisma.tenantKey.create({ data: { tenantId, version: newVersion, wrappedDek, kekVersion: 1, algorithm: 'aes-256-gcm', isActive: true } });

  // Re-encrypt bids
  const bids = await prisma.bid.findMany({ where: { tenantId, encryptedData: { not: null } }, select: { id: true, encryptedData: true } });
  const oldDek = active ? unwrapWithLocalKek(active.wrappedDek) : null;

  for (const b of bids) {
    try {
      const plaintext = oldDek ? decryptWithDek(b.encryptedData as string, oldDek) : Buffer.from('');
      const newCipher = encryptWithDek(plaintext, newDek);
      await prisma.bid.update({ where: { id: b.id }, data: { encryptedData: newCipher, keyVersion: newVersion } });
    } catch (e) {
      console.error('Failed to rotate bid', b.id, e);
    }
  }

  console.log(`Rotation complete for tenant ${tenantId}. New version ${newVersion}`);
}

main().finally(async () => prisma.$disconnect());
