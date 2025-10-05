import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with test data...');
  
  // Hash passwords for test accounts
  const saltRounds = 12;
  const adminPassword = await bcrypt.hash('admin123', saltRounds);
  const userPassword = await bcrypt.hash('user123', saltRounds);
  const vendorPassword = await bcrypt.hash('vendor123', saltRounds);
  
  // Create test users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eproc.local' },
    update: {},
    create: {
      email: 'admin@eproc.local',
      username: 'admin',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
      abilities: [
        {
          actions: ['manage'],
          subjects: ['all']
        }
      ]
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@eproc.local' },
    update: {},
    create: {
      email: 'user@eproc.local',
      username: 'procurement_user',
      password: userPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
      isActive: true,
      isVerified: true,
      abilities: [
        {
          actions: ['create', 'read', 'update'],
          subjects: ['Tender'],
          conditions: { creatorId: '{{userId}}' }
        },
        {
          actions: ['read', 'score'],
          subjects: ['Bid']
        }
      ]
    },
  });

  const vendor = await prisma.user.upsert({
    where: { email: 'vendor@eproc.local' },
    update: {},
    create: {
      email: 'vendor@eproc.local',
      username: 'acme_vendor',
      password: vendorPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'VENDOR',
      isActive: true,
      isVerified: true,
      abilities: [
        {
          actions: ['read'],
          subjects: ['Tender'],
          conditions: { status: 'PUBLISHED' }
        },
        {
          actions: ['create', 'read', 'update'],
          subjects: ['Bid'],
          conditions: { vendorId: '{{userId}}' }
        }
      ]
    },
  });

  console.log('👑 Created admin user:', admin.email);
  console.log('👤 Created user:', user.email);
  console.log('🏢 Created vendor:', vendor.email);

  // Create sample tender
  const sampleTender = await prisma.tender.upsert({
    where: { id: 'sample-tender-1' },
    update: {},
    create: {
      id: 'sample-tender-1',
      title: 'IT Equipment Procurement',
      description: 'Procurement of laptops, desktop computers, and accessories for the IT department',
      requirements: {
        technical: {
          laptops: {
            quantity: 50,
            specs: {
              ram: '16GB minimum',
              storage: '512GB SSD',
              processor: 'Intel i7 or AMD equivalent',
              os: 'Windows 11 Pro'
            }
          },
          desktops: {
            quantity: 20,
            specs: {
              ram: '32GB minimum',
              storage: '1TB SSD',
              processor: 'Intel i7 or AMD equivalent',
              os: 'Windows 11 Pro'
            }
          }
        },
        commercial: {
          delivery: 'Within 30 days',
          warranty: '3 years minimum',
          support: '24/7 technical support'
        }
      },
      criteria: {
        technical: {
          weight: 0.4,
          subcriteria: {
            specifications: 0.6,
            experience: 0.2,
            certifications: 0.2
          }
        },
        commercial: {
          weight: 0.3,
          subcriteria: {
            delivery_time: 0.4,
            warranty: 0.3,
            support: 0.3
          }
        },
        financial: {
          weight: 0.3,
          subcriteria: {
            total_price: 0.8,
            payment_terms: 0.2
          }
        }
      },
      status: 'PUBLISHED',
      publishedAt: new Date(),
      closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      estimatedValue: 500000,
      category: 'IT Equipment',
      department: 'Information Technology',
      creatorId: user.id,
    },
  });

  console.log('📋 Created sample tender:', sampleTender.title);

  // Create sample bid
  const sampleBid = await prisma.bid.upsert({
    where: { 
      tenderId_vendorId: {
        tenderId: sampleTender.id,
        vendorId: vendor.id
      }
    },
    update: {},
    create: {
      tenderId: sampleTender.id,
      vendorId: vendor.id,
      status: 'DRAFT',
      encryptedData: JSON.stringify({
        technicalProposal: {
          experience: 8,
          certifications: ['ISO 9001', 'ISO 27001', 'Microsoft Partner'],
          specifications: {
            laptops: {
              brand: 'Dell Latitude 7420',
              ram: '16GB DDR4',
              storage: '512GB SSD',
              processor: 'Intel i7-1165G7'
            },
            desktops: {
              brand: 'Dell OptiPlex 7090',
              ram: '32GB DDR4',
              storage: '1TB SSD',
              processor: 'Intel i7-11700'
            }
          }
        },
        commercialProposal: {
          deliveryTime: 25,
          warranty: 36,
          support: '24/7 premium support included',
          paymentTerms: '30 days net'
        },
        financialProposal: {
          laptops: {
            unitPrice: 1200,
            quantity: 50,
            subtotal: 60000
          },
          desktops: {
            unitPrice: 1500,
            quantity: 20,
            subtotal: 30000
          },
          totalPrice: 90000,
          discount: 5000,
          finalPrice: 85000
        }
      })
    },
  });

  console.log('💼 Created sample bid for tender:', sampleTender.title);

  // Create some audit logs
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'user_created',
      targetType: 'User',
      targetId: user.id,
      newValues: { role: 'USER', email: user.email },
      ipAddress: '127.0.0.1',
      userAgent: 'Seeding Script',
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'tender_created',
      targetType: 'Tender',
      targetId: sampleTender.id,
      newValues: { title: sampleTender.title, status: 'DRAFT' },
      ipAddress: '127.0.0.1',
      userAgent: 'Seeding Script',
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'tender_published',
      targetType: 'Tender',
      targetId: sampleTender.id,
      oldValues: { status: 'DRAFT' },
      newValues: { status: 'PUBLISHED' },
      ipAddress: '127.0.0.1',
      userAgent: 'Seeding Script',
    }
  });

  console.log('📝 Created sample audit logs');

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📚 Test Accounts Created:');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ Role   │ Email                │ Password │ Description          │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ ADMIN  │ admin@eproc.local    │ admin123 │ Full system access   │');
  console.log('│ USER   │ user@eproc.local     │ user123  │ Create tenders       │');
  console.log('│ VENDOR │ vendor@eproc.local   │ vendor123│ Submit bids          │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('\n📋 Sample Data Created:');
  console.log(`• 1 Published Tender: "${sampleTender.title}"`);
  console.log(`• 1 Draft Bid from vendor`);
  console.log(`• Sample audit logs`);
  console.log('\n🚀 Ready to start the application with: npm run start:dev:local');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });