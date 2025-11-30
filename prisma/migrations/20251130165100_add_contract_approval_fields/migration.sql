-- Add approval fields to contracts table
ALTER TABLE "contracts" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "contracts" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "contracts" ADD COLUMN "rejectionReason" TEXT;

-- Add foreign key constraint for approver
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
