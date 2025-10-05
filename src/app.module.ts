import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';

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
import { BidService } from './modules/bid/bid.service';

// Audit Module
import { AuditService } from './modules/audit/audit.service';

// Events Module
import { EventService } from './modules/events/event.service';

// Guards
import { RolesGuard } from './common/guards/roles.guard';
import { CaslAbilityGuard } from './common/guards/casl-ability.guard';

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

    // MongoDB for document storage
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URL'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: BidDocument.name, schema: BidDocumentSchema }
    ]),
  ],
  controllers: [
    AuthController,
    TenderController,
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
    AuditService,
    EventService,
    
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
    AuditService,
    EventService,
  ],
})
export class AppModule {}