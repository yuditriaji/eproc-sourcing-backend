import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";
import * as crypto from "crypto";

interface DekMaterial {
  version: number;
  wrappedDek: string;
  algorithm: string;
}

@Injectable()
export class TenantKmsService {
  // In-memory cache for DEKs per tenant
  private cache = new Map<string, DekMaterial>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getActiveDek(tenantId?: string): Promise<DekMaterial> {
    const tId = tenantId ?? this.tenantContext.getTenantId();
    if (!tId) throw new Error("No tenantId in context");

    const cached = this.cache.get(tId);
    if (cached) return cached;

    const key = await this.prisma.tenantKey.findFirst({
      where: { tenantId: tId, isActive: true },
      orderBy: { version: "desc" },
      select: { version: true, wrappedDek: true, algorithm: true },
    });
    if (!key) {
      // Bootstrap: create a DEK and store wrapped with a local KEK
      const dek = crypto.randomBytes(32);
      const wrappedDek = this.wrapWithLocalKek(dek);
      const created = await this.prisma.tenantKey.create({
        data: {
          tenantId: tId,
          version: 1,
          wrappedDek,
          kekVersion: 1,
          algorithm: "aes-256-gcm",
          isActive: true,
        },
        select: { version: true, wrappedDek: true, algorithm: true },
      });
      this.cache.set(tId, created);
      return created;
    }
    this.cache.set(tId, key);
    return key;
  }

  unwrapDek(wrappedDek: string): Buffer {
    // Local KEK unwrap (placeholder). In production, replace with secure key vault.
    const kek = crypto
      .createHash("sha256")
      .update(process.env.JWT_SECRET || "local-kek")
      .digest();
    const data = Buffer.from(wrappedDek, "base64");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv);
    decipher.setAuthTag(tag);
    const dek = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return dek;
  }

  private wrapWithLocalKek(plaintext: Buffer): string {
    const kek = crypto
      .createHash("sha256")
      .update(process.env.JWT_SECRET || "local-kek")
      .digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString("base64");
  }
}
