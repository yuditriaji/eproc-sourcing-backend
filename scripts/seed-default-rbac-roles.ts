/**
 * Script to create default RBAC roles that match enum roles
 * Run with: npx ts-node scripts/seed-default-rbac-roles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_RBAC_ROLES = [
  {
    roleName: 'Admin',
    description: 'Full administrative access to all system features',
    permissions: {
      all: ['manage'],
      users: ['create', 'read', 'update', 'delete'],
      roles: ['create', 'read', 'update', 'delete'],
      tenders: ['create', 'read', 'update', 'delete', 'publish', 'cancel'],
      bids: ['read', 'evaluate', 'score', 'approve', 'reject'],
      contracts: ['create', 'read', 'update', 'delete', 'sign'],
      purchaseOrders: ['create', 'read', 'update', 'delete', 'approve'],
      purchaseRequisitions: ['create', 'read', 'update', 'delete', 'approve'],
      invoices: ['create', 'read', 'update', 'delete', 'approve'],
      payments: ['create', 'read', 'update', 'delete', 'approve', 'process'],
      reports: ['read', 'export'],
      settings: ['read', 'update'],
    },
    isActive: true,
  },
  {
    roleName: 'Buyer',
    description: 'Procurement specialist who creates and manages purchase requisitions and orders',
    permissions: {
      tenders: ['create', 'read', 'update'],
      bids: ['read', 'evaluate'],
      purchaseRequisitions: ['create', 'read', 'update'],
      purchaseOrders: ['create', 'read', 'update'],
      vendors: ['read'],
      contracts: ['read'],
      reports: ['read'],
    },
    isActive: true,
  },
  {
    roleName: 'Vendor',
    description: 'External vendor with access to published tenders and bid submission',
    permissions: {
      tenders: ['read'],
      bids: ['create', 'read', 'update', 'submit'],
      contracts: ['read'],
      invoices: ['create', 'read', 'update'],
      purchaseOrders: ['read'],
    },
    isActive: true,
  },
  {
    roleName: 'Approver',
    description: 'Can approve purchase requisitions, orders, and other procurement documents',
    permissions: {
      purchaseRequisitions: ['read', 'approve', 'reject'],
      purchaseOrders: ['read', 'approve', 'reject'],
      tenders: ['read', 'approve'],
      contracts: ['read', 'approve'],
      reports: ['read'],
    },
    isActive: true,
  },
  {
    roleName: 'Finance',
    description: 'Financial team member with access to invoices, payments, and financial reports',
    permissions: {
      invoices: ['create', 'read', 'update', 'approve'],
      payments: ['create', 'read', 'update', 'approve', 'process'],
      purchaseOrders: ['read'],
      contracts: ['read'],
      reports: ['read', 'export'],
      budgets: ['read', 'update'],
    },
    isActive: true,
  },
  {
    roleName: 'Manager',
    description: 'Department manager with oversight and approval authority',
    permissions: {
      tenders: ['read', 'approve', 'publish'],
      bids: ['read', 'evaluate'],
      purchaseRequisitions: ['read', 'approve', 'reject'],
      purchaseOrders: ['read', 'approve', 'reject'],
      contracts: ['read', 'approve'],
      reports: ['read', 'export'],
      users: ['read'],
      budgets: ['read'],
    },
    isActive: true,
  },
  {
    roleName: 'User',
    description: 'Basic user with limited access to view and create basic documents',
    permissions: {
      tenders: ['read'],
      purchaseRequisitions: ['create', 'read'],
      reports: ['read'],
    },
    isActive: true,
  },
];

async function seedDefaultRbacRoles() {
  console.log('🌱 Seeding default RBAC roles...\n');

  try {
    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    if (tenants.length === 0) {
      console.log('⚠️  No tenants found. Please create tenants first.');
      return;
    }

    console.log(`Found ${tenants.length} tenant(s)\n`);

    // Create default roles for each tenant
    for (const tenant of tenants) {
      console.log(`\n📍 Processing tenant: ${tenant.name} (${tenant.id})`);

      for (const roleData of DEFAULT_RBAC_ROLES) {
        try {
          // Check if role already exists
          const existing = await prisma.rbacConfig.findUnique({
            where: {
              tenantId_roleName: {
                tenantId: tenant.id,
                roleName: roleData.roleName,
              },
            },
          });

          if (existing) {
            console.log(`  ⏭️  Role "${roleData.roleName}" already exists, skipping...`);
            continue;
          }

          // Create the role
          const role = await prisma.rbacConfig.create({
            data: {
              tenantId: tenant.id,
              roleName: roleData.roleName,
              description: roleData.description,
              permissions: roleData.permissions,
              isActive: roleData.isActive,
            },
          });

          console.log(`  ✅ Created role: "${role.roleName}"`);
        } catch (error) {
          console.error(`  ❌ Error creating role "${roleData.roleName}":`, error.message);
        }
      }
    }

    console.log('\n\n✨ Default RBAC roles seeded successfully!');
    console.log('\n📋 Summary:');
    console.log(`  - Created roles for ${tenants.length} tenant(s)`);
    console.log(`  - ${DEFAULT_RBAC_ROLES.length} role templates applied`);
    console.log('\n💡 Next steps:');
    console.log('  1. Assign these roles to users via Admin Portal or API');
    console.log('  2. Users will get these roles in JWT token on next login');
    console.log('  3. Update frontend to check rbacRoles array');
  } catch (error) {
    console.error('\n❌ Error seeding roles:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
seedDefaultRbacRoles()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
