/**
 * Initial Data Migration Script
 * Sets up default currencies, system configuration, and migrates existing data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateInitialData() {
  console.log('🚀 Starting initial data migration...');

  try {
    // Run each migration step separately to avoid timeout issues
    
    // 1. Create default currencies
    console.log('💰 Creating default currencies...');
    await createDefaultCurrencies(prisma);

    // 2. Create initial system configuration
    console.log('⚙️  Setting up system configuration...');
    await createSystemConfig(prisma);

    // 3. Create default role configurations
    console.log('🔐 Setting up role configurations...');
    await createRoleConfigurations(prisma);

    // 4. Migrate existing vendor users to vendor entities
    console.log('🏢 Migrating vendor users to vendors...');
    await migrateVendorUsers(prisma);

    // 5. Update existing tenders with numbers
    console.log('📄 Updating tender numbering...');
    await updateTenderNumbers(prisma);

    // 6. Create default workflow steps
    console.log('🔄 Setting up default workflows...');
    await createDefaultWorkflows(prisma);

    console.log('✅ Initial data migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function createDefaultCurrencies(prisma: any) {
  const currencies = [
    {
      code: 'USD',
      symbol: '$',
      name: 'US Dollar',
      isActive: true,
      exchangeRate: 1.0, // Base currency
    },
    {
      code: 'EUR',
      symbol: '€',
      name: 'Euro',
      isActive: true,
      exchangeRate: 0.85, // Example rate
    },
    {
      code: 'IDR',
      symbol: 'Rp',
      name: 'Indonesian Rupiah',
      isActive: true,
      exchangeRate: 15.0, // Simplified rate (1 USD = 15 IDR units)
    },
    {
      code: 'GBP',
      symbol: '£',
      name: 'British Pound',
      isActive: true,
      exchangeRate: 0.73, // Example rate
    },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: currency,
      create: currency,
    });
  }

  console.log(`   ✓ Created ${currencies.length} currencies`);
}

async function createSystemConfig(prisma: any) {
  const configs = [
    {
      key: 'procurement.auto_approve_limit',
      value: { amount: 10000, currency: 'USD' },
      description: 'Auto-approve purchase orders below this amount',
      category: 'Procurement',
    },
    {
      key: 'tender.min_duration_days',
      value: 7,
      description: 'Minimum tender duration in days',
      category: 'Tender',
    },
    {
      key: 'tender.max_duration_days',
      value: 90,
      description: 'Maximum tender duration in days',
      category: 'Tender',
    },
    {
      key: 'notification.email_enabled',
      value: true,
      description: 'Enable email notifications',
      category: 'Notification',
    },
    {
      key: 'notification.sms_enabled',
      value: false,
      description: 'Enable SMS notifications',
      category: 'Notification',
    },
    {
      key: 'document.max_file_size_mb',
      value: 50,
      description: 'Maximum file size for document uploads in MB',
      category: 'Document',
    },
    {
      key: 'document.allowed_types',
      value: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png', 'zip'],
      description: 'Allowed file types for document uploads',
      category: 'Document',
    },
    {
      key: 'vendor.auto_approval_enabled',
      value: false,
      description: 'Automatically approve vendor registrations',
      category: 'Vendor',
    },
    {
      key: 'payment.default_terms_days',
      value: 30,
      description: 'Default payment terms in days',
      category: 'Payment',
    },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {
        value: config.value,
        description: config.description,
        category: config.category,
      },
      create: config,
    });
  }

  console.log(`   ✓ Created ${configs.length} system configurations`);
}

async function createRoleConfigurations(prisma: any) {
  const roleConfigs = [
    {
      roleName: 'ADMIN',
      permissions: {
        actions: ['create', 'read', 'update', 'delete', 'manage'],
        subjects: 'all',
      },
      description: 'Full system access',
      isActive: true,
    },
    {
      roleName: 'BUYER',
      permissions: {
        actions: ['create', 'read', 'update'],
        subjects: ['PurchaseRequisition', 'PurchaseOrder', 'Tender', 'Vendor', 'Document'],
        conditions: { ownerId: '{{ userId }}' },
      },
      description: 'Can create and manage purchase requests and orders',
      isActive: true,
    },
    {
      roleName: 'VENDOR',
      permissions: {
        actions: ['read', 'create', 'update'],
        subjects: ['Bid', 'Quotation', 'Invoice', 'Document'],
        conditions: { vendorId: '{{ userId }}' },
      },
      description: 'Can participate in tenders and submit bids',
      isActive: true,
    },
    {
      roleName: 'APPROVER',
      permissions: {
        actions: ['read', 'approve', 'reject'],
        subjects: ['PurchaseRequisition', 'PurchaseOrder', 'Invoice', 'Payment'],
      },
      description: 'Can approve procurement requests and orders',
      isActive: true,
    },
    {
      roleName: 'FINANCE',
      permissions: {
        actions: ['read', 'create', 'update'],
        subjects: ['Invoice', 'Payment', 'Contract', 'Vendor'],
      },
      description: 'Can manage financial aspects of procurement',
      isActive: true,
    },
  ];

  for (const roleConfig of roleConfigs) {
    await prisma.roleConfig.upsert({
      where: { roleName: roleConfig.roleName },
      update: {
        permissions: roleConfig.permissions,
        description: roleConfig.description,
        isActive: roleConfig.isActive,
      },
      create: roleConfig,
    });
  }

  console.log(`   ✓ Created ${roleConfigs.length} role configurations`);
}

async function migrateVendorUsers(prisma: any) {
  // Find all users with VENDOR role
  const vendorUsers = await prisma.user.findMany({
    where: {
      role: 'VENDOR',
    },
  });

  let createdCount = 0;

  for (const user of vendorUsers) {
    // Check if vendor already exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { id: user.id },
    });

    if (!existingVendor) {
      await prisma.vendor.create({
        data: {
          id: user.id,
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.username,
          contactEmail: user.email,
          contactPhone: user.phone || null,
          status: user.isVerified ? 'ACTIVE' : 'PENDING_APPROVAL',
          businessType: 'Individual', // Default value
        },
      });
      createdCount++;
    }
  }

  console.log(`   ✓ Migrated ${createdCount} vendor users to vendors`);
}

async function updateTenderNumbers(prisma: any) {
  // Get all tenders without tender numbers (since this is a fresh database, likely none exist)
  const tenders = await prisma.tender.findMany({
    orderBy: {
      createdAt: 'asc',
    },
  });

  let updatedCount = 0;

  for (const tender of tenders) {
    const tenderNumber = generateTenderNumber(tender.createdAt, tender.id);
    
    await prisma.tender.update({
      where: { id: tender.id },
      data: { tenderNumber },
    });

    updatedCount++;
  }

  console.log(`   ✓ Updated ${updatedCount} tenders with numbers`);
}

async function createDefaultWorkflows(prisma: any) {
  const workflows = [
    // Purchase Requisition Approval Workflow
    {
      workflowType: 'PR_APPROVAL',
      steps: [
        {
          stepName: 'Manager Review',
          stepOrder: 1,
          assignedRole: 'MANAGER',
          requiresApproval: true,
          approvalCount: 1,
          timeoutHours: 48,
        },
        {
          stepName: 'Finance Review',
          stepOrder: 2,
          assignedRole: 'FINANCE',
          requiresApproval: true,
          approvalCount: 1,
          timeoutHours: 24,
          conditions: { amount: { gt: 5000 } },
        },
        {
          stepName: 'Final Approval',
          stepOrder: 3,
          assignedRole: 'APPROVER',
          requiresApproval: true,
          approvalCount: 1,
          timeoutHours: 72,
        },
      ],
    },
    // Purchase Order Approval Workflow
    {
      workflowType: 'PO_APPROVAL',
      steps: [
        {
          stepName: 'Buyer Verification',
          stepOrder: 1,
          assignedRole: 'BUYER',
          requiresApproval: true,
          approvalCount: 1,
          timeoutHours: 24,
        },
        {
          stepName: 'Finance Approval',
          stepOrder: 2,
          assignedRole: 'FINANCE',
          requiresApproval: true,
          approvalCount: 1,
          timeoutHours: 48,
        },
      ],
    },
    // Invoice Approval Workflow
    {
      workflowType: 'INVOICE_APPROVAL',
      steps: [
        {
          stepName: 'Receipt Verification',
          stepOrder: 1,
          assignedRole: 'BUYER',
          requiresApproval: true,
          approvalCount: 1,
          timeoutHours: 24,
        },
        {
          stepName: 'Finance Approval',
          stepOrder: 2,
          assignedRole: 'FINANCE',
          requiresApproval: true,
          approvalCount: 1,
          timeoutHours: 48,
        },
      ],
    },
  ];

  let createdSteps = 0;

  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      await prisma.workflowStep.upsert({
        where: {
          workflowType_stepOrder: {
            workflowType: workflow.workflowType,
            stepOrder: step.stepOrder,
          },
        },
        update: step,
        create: {
          workflowType: workflow.workflowType,
          ...step,
        },
      });
      createdSteps++;
    }
  }

  console.log(`   ✓ Created ${createdSteps} workflow steps`);
}

function generateTenderNumber(createdAt: Date, id: string): string {
  const year = createdAt.getFullYear();
  const month = String(createdAt.getMonth() + 1).padStart(2, '0');
  const shortId = id.substring(0, 8).toUpperCase();
  
  return `TDR-${year}${month}-${shortId}`;
}

// Run migration if called directly
if (require.main === module) {
  migrateInitialData()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { migrateInitialData };