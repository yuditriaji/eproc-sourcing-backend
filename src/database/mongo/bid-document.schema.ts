import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import * as crypto from "crypto";

export type BidDocumentDocument = BidDocument & Document;

@Schema({
  timestamps: true,
  collection: "bid_documents",
})
export class BidDocument {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  bidId: string;

  @Prop({ required: true, index: true })
  vendorId: string;

  @Prop({ required: true, index: true })
  tenderId: string;

  @Prop({ required: true })
  documentType: string; // 'technical', 'commercial', 'financial', 'legal'

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop()
  encryptedContent?: string; // Encrypted file content for sensitive documents

  @Prop()
  encryptionAlgorithm?: string; // 'aes-256-gcm'

  @Prop()
  initializationVector?: string; // IV for encryption

  @Prop()
  authTag?: string; // Authentication tag for GCM mode

  @Prop({ required: true })
  filePath: string; // Path to stored file

  @Prop()
  checksum: string; // File integrity check

  @Prop({ default: false })
  isEncrypted: boolean;

  @Prop({ default: false })
  isSubmitted: boolean;

  @Prop()
  submittedAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Additional metadata

  // Security and audit
  @Prop()
  uploadedBy: string;

  @Prop({ default: Date.now })
  uploadedAt: Date;

  @Prop()
  lastAccessedAt?: Date;

  @Prop()
  lastAccessedBy?: string;
}

export const BidDocumentSchema = SchemaFactory.createForClass(BidDocument);

// Add index for efficient querying
BidDocumentSchema.index({ tenantId: 1, bidId: 1, documentType: 1 });
BidDocumentSchema.index({ tenantId: 1, vendorId: 1, tenderId: 1 });
BidDocumentSchema.index({ tenantId: 1, isSubmitted: 1, submittedAt: 1 });

// Encrypt sensitive content before saving using per-tenant derived key
BidDocumentSchema.pre("save", function (next) {
  if (
    this.isModified("encryptedContent") &&
    this.encryptedContent &&
    !this.isEncrypted
  ) {
    const base = process.env.ENCRYPTION_KEY || "fallback-key";
    const tenantComponent = this.tenantId || "no-tenant";
    const key = crypto.scryptSync(`${base}:${tenantComponent}`, "salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(this.encryptedContent, "utf8", "hex");
    encrypted += cipher.final("hex");

    this.encryptedContent = encrypted;
    this.initializationVector = iv.toString("hex");
    this.authTag = cipher.getAuthTag().toString("hex");
    this.encryptionAlgorithm = "aes-256-gcm";
    this.isEncrypted = true;
  }

  // Update checksum if content changed
  if (this.isModified("encryptedContent") || this.isModified("filePath")) {
    const hash = crypto.createHash("sha256");
    hash.update(this.encryptedContent || this.filePath);
    this.checksum = hash.digest("hex");
  }

  next();
});
