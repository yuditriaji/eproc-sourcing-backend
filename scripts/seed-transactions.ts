import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedTransactionData() {
  console.log('🌱 Seeding transaction data for comprehensive testing...');

  // Get or create quiv tenant
  const quivTenant = await prisma.tenant.upsert({
    where: { subdomain: 'quiv' },
    update: { name: 'Quiv Organization', residencyTag: 'us', subdomain: 'quiv' },
    create: { 
      name: 'Quiv Organization', 
      subdomain: 'quiv', 
      residencyTag: 'us'
    },
  });

  console.log('🏢 Tenant created/found:', quivTenant.name);

  // Hash passwords
  const saltRounds = 12;
  const adminPassword = await bcrypt.hash('admin123', saltRounds);
  const buyerPassword = await bcrypt.hash('buyer123', saltRounds);
  const vendorPassword = await bcrypt.hash('vendor123', saltRounds);

  // Create users
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: quivTenant.id, email: 'admin@quiv.com' } as any },
    update: {},
    create: {
      tenantId: quivTenant.id,
      email: 'admin@quiv.com',
      username: 'admin',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
      abilities: [{ actions: ['manage'], subjects: ['all'] }]
    },
  });

  const buyer = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: quivTenant.id, email: 'buyer@quiv.com' } as any },
    update: {},
    create: {
      tenantId: quivTenant.id,
      email: 'buyer@quiv.com',
      username: 'buyer',
      password: buyerPassword,
      firstName: 'John',
      lastName: 'Buyer',
      role: 'BUYER',
      department: 'Procurement',
      isActive: true,
      isVerified: true,
      abilities: [
        { actions: ['create', 'read', 'update'], subjects: ['PurchaseRequisition'] },
        { actions: ['create', 'read', 'update'], subjects: ['PurchaseOrder'] },
        { actions: ['read'], subjects: ['Tender'] }
      ]
    },
  });

  const manager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: quivTenant.id, email: 'manager@quiv.com' } as any },
    update: {},
    create: {
      tenantId: quivTenant.id,
      email: 'manager@quiv.com',
      username: 'manager',
      password: buyerPassword,
      firstName: 'Jane',
      lastName: 'Manager',
      role: 'MANAGER',
      department: 'Procurement',
      isActive: true,
      isVerified: true,
      abilities: [{ actions: ['manage'], subjects: ['all'] }]
    },
  });

  console.log('👥 Created users: Admin, Buyer, Manager');

  // Create vendors
  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        tenantId: quivTenant.id,
        name: 'Tech Solutions Inc.',
        contactEmail: 'sales@techsolutions.com',
        contactPhone: '+1-555-0101',
        registrationNumber: 'REG-001',
        taxId: 'TAX-001',
        status: 'ACTIVE' as any,
        businessType: 'Technology',
        yearEstablished: 2015,
        employeeCount: 150,
        address: {
          street: '123 Tech Street',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
          country: 'USA'
        }
      }
    }),
    prisma.vendor.create({
      data: {
        tenantId: quivTenant.id,
        name: 'Office Supply Co.',
        contactEmail: 'orders@officesupply.com',
        contactPhone: '+1-555-0102',
        registrationNumber: 'REG-002',
        taxId: 'TAX-002',
        status: 'ACTIVE' as any,
        businessType: 'Office Supplies',
        yearEstablished: 2010,
        employeeCount: 50
      }
    }),
    prisma.vendor.create({
      data: {
        tenantId: quivTenant.id,
        name: 'Construction Pro Ltd.',
        contactEmail: 'contact@constructionpro.com',
        contactPhone: '+1-555-0103',
        registrationNumber: 'REG-003',
        taxId: 'TAX-003',
        status: 'ACTIVE' as any,
        businessType: 'Construction',
        yearEstablished: 2008,
        employeeCount: 200
      }
    })
  ]);

  console.log('🏢 Created 3 vendors');

  // Create USD currency first
  const usdCurrency = await prisma.currency.upsert({
    where: { tenantId_code: { tenantId: quivTenant.id, code: 'USD' } },
    update: {},
    create: {
      tenantId: quivTenant.id,
      code: 'USD',
      symbol: '$',
      name: 'US Dollar'
    }
  });

  // Create contracts
  const contracts = await Promise.all([
    prisma.contract.create({
      data: {
        tenantId: quivTenant.id,
        contractNumber: 'CNT-2024-001',
        title: 'IT Equipment Framework Agreement',
        description: 'Framework agreement for IT equipment procurement',
        status: 'DRAFT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalAmount: 1000000,
        currencyId: usdCurrency.id,
        terms: {
          paymentTerms: '30 days net',
          deliveryTerms: 'DDP',
          warranty: '2 years'
        },
        ownerId: buyer.id
      }
    }),
    prisma.contract.create({
      data: {
        tenantId: quivTenant.id,
        contractNumber: 'CNT-2024-002',
        title: 'Office Supplies Annual Contract',
        description: 'Annual contract for office supplies',
        status: 'DRAFT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalAmount: 250000,
        currencyId: usdCurrency.id,
        ownerId: buyer.id
      }
    })
  ]);

  console.log('📄 Created 2 contracts');

  // Add vendors to contracts
  await Promise.all([
    prisma.contractVendor.create({
      data: {
        tenantId: quivTenant.id,
        contractId: contracts[0].id,
        vendorId: vendors[0].id,
        role: 'PRIMARY'
      }
    }),
    prisma.contractVendor.create({
      data: {
        tenantId: quivTenant.id,
        contractId: contracts[0].id,
        vendorId: vendors[2].id,
        role: 'SECONDARY'
      }
    }),
    prisma.contractVendor.create({
      data: {
        tenantId: quivTenant.id,
        contractId: contracts[1].id,
        vendorId: vendors[1].id,
        role: 'PRIMARY'
      }
    })
  ]);

  console.log('🤝 Linked vendors to contracts');

  // Create purchase requisitions
  const purchaseRequisitions = await Promise.all([
    prisma.purchaseRequisition.create({
      data: {
        tenantId: quivTenant.id,
        prNumber: 'PR-2024-001',
        title: 'Laptop Procurement Q1',
        description: 'Procurement of laptops for new employees',
        requesterId: buyer.id,
        status: 'APPROVED',
        estimatedAmount: 50000,
        currency: 'USD',
        requiredBy: new Date('2024-02-15'),
        justification: 'New employee onboarding requirements',
        items: [
          {
            description: 'Business Laptop',
            quantity: 20,
            unitPrice: 1200,
            totalPrice: 24000,
            specifications: {
              brand: 'Dell',
              model: 'Latitude 7420',
              ram: '16GB',
              storage: '512GB SSD'
            }
          },
          {
            description: 'Extended Warranty',
            quantity: 20,
            unitPrice: 300,
            totalPrice: 6000
          }
        ],
        contractId: contracts[0].id,
        approverId: manager.id,
        approvedAt: new Date(),
        createdBy: buyer.id
      }
    }),
    prisma.purchaseRequisition.create({
      data: {
        tenantId: quivTenant.id,
        prNumber: 'PR-2024-002',
        title: 'Office Supplies Q1',
        description: 'Quarterly office supplies procurement',
        requesterId: buyer.id,
        status: 'PENDING',
        estimatedAmount: 15000,
        currency: 'USD',
        requiredBy: new Date('2024-03-01'),
        justification: 'Quarterly supplies replenishment',
        items: [
          {
            description: 'Paper A4',
            quantity: 100,
            unitPrice: 50,
            totalPrice: 5000
          },
          {
            description: 'Office Chairs',
            quantity: 10,
            unitPrice: 250,
            totalPrice: 2500
          }
        ],
        contractId: contracts[1].id,
        createdBy: buyer.id
      }
    }),
    prisma.purchaseRequisition.create({
      data: {
        tenantId: quivTenant.id,
        prNumber: 'PR-2024-003',
        title: 'Server Infrastructure Upgrade',
        description: 'Upgrading server infrastructure',
        requesterId: buyer.id,
        status: 'PENDING',
        estimatedAmount: 75000,
        currency: 'USD',
        requiredBy: new Date('2024-04-01'),
        justification: 'Current infrastructure reaching capacity limits',
        items: [
          {
            description: 'Server Hardware',
            quantity: 2,
            unitPrice: 25000,
            totalPrice: 50000
          },
          {
            description: 'Network Equipment',
            quantity: 1,
            unitPrice: 15000,
            totalPrice: 15000
          }
        ],
        createdBy: buyer.id
      }
    })
  ]);

  console.log('📝 Created 3 purchase requisitions');

  // Create purchase orders from approved PRs
  const purchaseOrders = await Promise.all([
    prisma.purchaseOrder.create({
      data: {
        tenantId: quivTenant.id,
        poNumber: 'PO-2024-001',
        title: 'Laptop Procurement Q1',
        description: 'Purchase order for laptop procurement',
        type: 'STANDARD',
        status: 'APPROVED',
        totalAmount: 50000,
        currency: 'USD',
        deliveryDate: new Date('2024-02-15'),
        deliveryAddress: {
          street: '456 Business Ave',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94103',
          country: 'USA'
        },
        terms: {
          paymentTerms: '30 days net',
          deliveryTerms: 'DDP',
          warranty: '2 years'
        },
        items: [
          {
            description: 'Business Laptop',
            quantity: 20,
            unitPrice: 1200,
            totalPrice: 24000,
            specifications: {
              brand: 'Dell',
              model: 'Latitude 7420'
            }
          }
        ],
        purchaseRequisitionId: purchaseRequisitions[0].id,
        contractId: contracts[0].id,
        createdById: buyer.id,
        approvedById: manager.id,
        approvedAt: new Date()
      }
    }),
    prisma.purchaseOrder.create({
      data: {
        tenantId: quivTenant.id,
        poNumber: 'PO-2024-002',
        title: 'Office Equipment Purchase',
        description: 'Purchase order for office equipment',
        type: 'STANDARD',
        status: 'DRAFT',
        totalAmount: 30000,
        currency: 'USD',
        deliveryDate: new Date('2024-03-15'),
        items: [
          {
            description: 'Office Desks',
            quantity: 15,
            unitPrice: 800,
            totalPrice: 12000
          },
          {
            description: 'Office Chairs',
            quantity: 15,
            unitPrice: 400,
            totalPrice: 6000
          }
        ],
        contractId: contracts[1].id,
        createdById: buyer.id
      }
    })
  ]);

  console.log('📋 Created 2 purchase orders');

  // Add vendors to purchase orders
  await Promise.all([
    prisma.pOVendor.create({
      data: {
        purchaseOrderId: purchaseOrders[0].id,
        vendorId: vendors[0].id,
        assignedAmount: 50000,
        status: 'ASSIGNED'
      }
    }),
    prisma.pOVendor.create({
      data: {
        purchaseOrderId: purchaseOrders[1].id,
        vendorId: vendors[1].id,
        assignedAmount: 30000,
        status: 'ASSIGNED'
      }
    })
  ]);

  console.log('🤝 Assigned vendors to purchase orders');

  // Create tenders
  const tenders = await Promise.all([
    prisma.tender.create({
      data: {
        tenantId: quivTenant.id,
        tenderNumber: 'TND-2024-001',
        title: 'Cloud Infrastructure Services',
        description: 'Tender for cloud infrastructure services',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        closingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        estimatedValue: 200000,
        category: 'IT Services',
        department: 'IT',
        requirements: {
          technical: {
            cloudServices: ['AWS', 'Azure', 'GCP'],
            support: '24/7',
            sla: '99.9% uptime'
          }
        },
        criteria: {
          technical: { weight: 0.4 },
          commercial: { weight: 0.3 },
          financial: { weight: 0.3 }
        },
        contractId: contracts[0].id,
        creatorId: buyer.id
      }
    }),
    prisma.tender.create({
      data: {
        tenantId: quivTenant.id,
        tenderNumber: 'TND-2024-002',
        title: 'Office Renovation Project',
        description: 'Tender for office renovation services',
        status: 'CLOSED',
        publishedAt: new Date('2024-01-01'),
        closingDate: new Date('2024-01-31'),
        estimatedValue: 150000,
        category: 'Construction',
        department: 'Facilities',
        requirements: {
          technical: {
            scope: 'Full office renovation',
            timeline: '8 weeks',
            certification: 'Required'
          }
        },
        criteria: {
          technical: { weight: 0.5 },
          financial: { weight: 0.5 }
        },
        creatorId: buyer.id
      }
    })
  ]);

  console.log('📢 Created 2 tenders');

  // Create bids for tenders
  const bids = await Promise.all([
    prisma.bid.create({
      data: {
        tenantId: quivTenant.id,
        tenderId: tenders[0].id,
        vendorId: vendors[0].id,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        bidAmount: 180000,
        currency: 'USD',
        technicalScore: 85,
        commercialScore: 90,
        financialScore: 92,
        totalScore: 88.5,
        encryptedData: JSON.stringify({
          technical: {
            cloudPlatform: 'AWS',
            certifications: ['AWS Solution Architect', 'ISO 27001'],
            experience: '10+ years'
          },
          commercial: {
            deliveryTime: '30 days',
            support: '24/7 premium support',
            sla: '99.95% uptime guarantee'
          },
          financial: {
            setup: 50000,
            monthly: 10000,
            total: 180000
          }
        })
      }
    }),
    prisma.bid.create({
      data: {
        tenantId: quivTenant.id,
        tenderId: tenders[0].id,
        vendorId: vendors[2].id,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        bidAmount: 195000,
        currency: 'USD',
        technicalScore: 90,
        commercialScore: 85,
        financialScore: 88,
        totalScore: 87.8,
        encryptedData: JSON.stringify({
          technical: {
            cloudPlatform: 'Azure',
            certifications: ['Microsoft Azure Architect', 'ISO 27001'],
            experience: '12+ years'
          },
          commercial: {
            deliveryTime: '25 days',
            support: '24/7 enterprise support',
            sla: '99.9% uptime guarantee'
          },
          financial: {
            setup: 55000,
            monthly: 11000,
            total: 195000
          }
        })
      }
    })
  ]);

  console.log('💼 Created 2 bids');

  // Award a tender
  await prisma.tender.update({
    where: { id: tenders[1].id },
    data: {
      status: 'AWARDED',
      awardedDate: new Date('2024-02-01'),
      awardedAmount: 145000,
      awardedVendorId: vendors[2].id,
      awardReason: 'Best overall value with excellent technical capabilities'
    }
  });

  console.log('🏆 Awarded tender to vendor');

  // Create quotations
  const quotations = await Promise.all([
    prisma.quotation.create({
      data: {
        tenantId: quivTenant.id,
        quotationNumber: 'QUO-2024-001',
        title: 'Software Licenses Quote',
        description: 'Quotation for software licenses',
        vendorId: vendors[0].id,
        status: 'DRAFT',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalAmount: 25000,
        currency: 'USD',
        items: [
          {
            description: 'Microsoft Office 365 Licenses',
            quantity: 100,
            unitPrice: 150,
            totalPrice: 15000
          },
          {
            description: 'Adobe Creative Suite Licenses',
            quantity: 20,
            unitPrice: 500,
            totalPrice: 10000
          }
        ],
        terms: {
          paymentTerms: '30 days net',
          deliveryTerms: 'Digital delivery',
          validity: '30 days'
        },
        createdById: buyer.id
      }
    }),
    prisma.quotation.create({
      data: {
        tenantId: quivTenant.id,
        quotationNumber: 'QUO-2024-002',
        title: 'Office Furniture Quote',
        description: 'Quotation for office furniture',
        vendorId: vendors[1].id,
        status: 'SENT',
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        totalAmount: 35000,
        currency: 'USD',
        items: [
          {
            description: 'Executive Desks',
            quantity: 5,
            unitPrice: 2000,
            totalPrice: 10000
          },
          {
            description: 'Conference Tables',
            quantity: 2,
            unitPrice: 3000,
            totalPrice: 6000
          }
        ],
        createdById: buyer.id,
        sentAt: new Date()
      }
    })
  ]);

  console.log('💰 Created 2 quotations');

  // Create goods receipts
  await prisma.goodsReceipt.create({
    data: {
      tenantId: quivTenant.id,
      receiptNumber: 'GR-2024-001',
      purchaseOrderId: purchaseOrders[0].id,
      receivedDate: new Date(),
      receivedById: buyer.id,
      status: 'RECEIVED',
      items: [
        {
          description: 'Business Laptop',
          quantityOrdered: 20,
          quantityReceived: 20,
          quantityAccepted: 18,
          quantityRejected: 2,
          rejectionReason: 'Damaged packaging'
        }
      ],
      notes: 'Partial acceptance due to damaged items',
      inspectionNotes: 'Quality check completed',
      inspectedBy: buyer.id
    }
  });

  console.log('📦 Created goods receipt');

  // Create invoices
  const invoices = await Promise.all([
    prisma.invoice.create({
      data: {
        tenantId: quivTenant.id,
        invoiceNumber: 'INV-2024-001',
        vendorId: vendors[0].id,
        purchaseOrderId: purchaseOrders[0].id,
        status: 'RECEIVED',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalAmount: 50000,
        currency: 'USD',
        taxAmount: 5000,
        netAmount: 45000,
        items: [
          {
            description: 'Business Laptop',
            quantity: 20,
            unitPrice: 1200,
            totalPrice: 24000
          }
        ],
        createdById: buyer.id
      }
    })
  ]);

  console.log('🧾 Created invoice');

  // Create payments
  await prisma.payment.create({
    data: {
      tenantId: quivTenant.id,
      paymentNumber: 'PAY-2024-001',
      invoiceId: invoices[0].id,
      purchaseOrderId: purchaseOrders[0].id,
      vendorId: vendors[0].id,
      amount: 50000,
      currency: 'USD',
      paymentMethod: 'BANK_TRANSFER',
      status: 'COMPLETED',
      paymentDate: new Date(),
      reference: 'TXN-ABC123456',
      processedById: admin.id
    }
  });

  console.log('💳 Created payment');

  console.log('\n🎉 Transaction data seeding completed successfully!');
  console.log('\n📊 SUMMARY:');
  console.log('• 1 Tenant (quiv)');
  console.log('• 3 Users (admin, buyer, manager)');
  console.log('• 3 Vendors');
  console.log('• 2 Contracts');
  console.log('• 3 Purchase Requisitions');
  console.log('• 2 Purchase Orders');
  console.log('• 2 Tenders');
  console.log('• 2 Bids');
  console.log('• 2 Quotations');
  console.log('• 1 Goods Receipt');
  console.log('• 1 Invoice');
  console.log('• 1 Payment');
  
  console.log('\n🔑 Test Credentials:');
  console.log('• admin@quiv.com / admin123 (Admin)');
  console.log('• buyer@quiv.com / buyer123 (Buyer)');
  console.log('• manager@quiv.com / buyer123 (Manager)');
  
  console.log('\n✅ All transaction tables now have test data!');
}

seedTransactionData()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during transaction seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });