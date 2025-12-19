-- AlterTable
ALTER TABLE "purchase_requisitions" ADD COLUMN     "department" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priority" TEXT DEFAULT 'MEDIUM';
