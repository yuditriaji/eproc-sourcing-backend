import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Database
import { PrismaService } from './database/prisma/prisma.service';
import { BidDocument, BidDocumentSchema } from './database/mongo/bid-document.schema';

// Auth Module
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { JwtStrategy } from './modules/auth/strategies/jwt.strategy';
import { AbilityFactory } from './modules/auth/abilities/ability.factory';

// Tender Module
import { TenderController } from './modules/tender/tender.controller';
import { TenderService } from './modules/tender/tender.service';

// Bid Module
import { BidController } from './modules/bid/bid.controller';
import { BidService } from './modules/bid/bid.service';

// Contract Module
import { ContractController } from './modules/contract/contract.controller';
import { ContractService } from './modules/contract/contract.service';

// Purchase Requisition Module
import { PurchaseRequisitionService } from './modules/purchase-requisition/purchase-requisition.service';

// Purchase Order Module
import { PurchaseOrderService } from './modules/purchase-order/purchase-order.service';

// Workflow Module
import { WorkflowService } from './modules/workflow/workflow.service';
import { WorkflowController } from './modules/workflow/workflow.controller';

// Audit Module
import { AuditService } from './modules/audit/audit.service';

// Events Module
import { EventService } from './modules/events/event.service';

// Guards
import { RolesGuard } from './common/guards/roles.guard';
import { CaslAbilityGuard } from './common/guards/casl-ability.guard';

// Tenancy
import { TenantContext } from './common/tenant/tenant-context';
import { TenantInterceptor } from './common/tenant/tenant.interceptor';
import { DbTenantSessionInterceptor } from './common/tenant/db-tenant-session.interceptor';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

// Crypto / KMS
import { TenantKmsService } from './common/crypto/tenant-kms.service';

// Tenant Provisioning
import { TenantService } from './modules/tenant/tenant.service';
import { TenantController as TenantsController } from './modules/tenant/tenant.controller';

// Conditionally include MongoDB modules only when MONGODB_URL is provided
const mongooseImports = process.env.MONGODB_URL
  ? [
      MongooseModule.forRoot(process.env.MONGODB_URL),
      MongooseModule.forFeature([{ name: BidDocument.name, schema: BidDocumentSchema }]),
    ]
  : [];

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Throttling (Rate Limiting)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => [
        {
          name: 'short',
          ttl: parseInt(config.get<string>('THROTTLE_TTL', '60000')),
          limit: parseInt(config.get<string>('THROTTLE_LIMIT_VENDOR', '10')),
        },
        {
          name: 'medium',
          ttl: 60000,
          limit: parseInt(config.get<string>('THROTTLE_LIMIT_USER', '50')),
        },
        {
          name: 'long',
          ttl: 60000,
          limit: parseInt(config.get<string>('THROTTLE_LIMIT_ADMIN', '100')),
        },
      ],
      inject: [ConfigService],
    }),

    // JWT Authentication
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRY', '15m'),
          algorithm: 'HS256',
        },
      }),
      inject: [ConfigService],
    }),

    // MongoDB for document storage (enabled only if MONGODB_URL is set)
    ...mongooseImports,
  ],
  controllers: [
    AuthController,
    TenantsController,
    TenderController,
    BidController,
    ContractController,
    WorkflowController,
  ],
  providers: [
    // Database Services
    PrismaService,

    // Authentication & Authorization
    AuthService,
    JwtStrategy,
    AbilityFactory,

    // Core Services
    TenderService,
    BidService,
    ContractService,
    PurchaseRequisitionService,
    PurchaseOrderService,
    WorkflowService,
    AuditService,
    EventService,

    // Crypto / KMS
    TenantKmsService,

    // Tenancy
    TenantContext,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DbTenantSessionInterceptor,
    },

    // Tenant Provisioning
    TenantService,

    // Guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    RolesGuard,
    CaslAbilityGuard,
  ],
  exports: [
    PrismaService,
    AuthService,
    AbilityFactory,
    TenderService,
    BidService,
    ContractService,
    PurchaseRequisitionService,
    PurchaseOrderService,
    WorkflowService,
    AuditService,
    EventService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
