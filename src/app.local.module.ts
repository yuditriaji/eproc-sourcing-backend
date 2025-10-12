import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';

// Database
import { PrismaService } from './database/prisma/prisma.service';

// Auth Module
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { JwtStrategy } from './modules/auth/strategies/jwt.strategy';
import { AbilityFactory } from './modules/auth/abilities/ability.factory';

// Tender Module
import { TenderController } from './modules/tender/tender.controller';
import { TenderService } from './modules/tender/tender.service';

// Bid Module (simplified without MongoDB)
import { BidService } from './modules/bid/bid.service';
import { BidController } from './modules/bid/bid.controller';

// Audit Module
import { AuditService } from './modules/audit/audit.service';

// Events Module (simplified)
import { EventService } from './modules/events/event.service';

// Guards
import { RolesGuard } from './common/guards/roles.guard';
import { CaslAbilityGuard } from './common/guards/casl-ability.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
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
  ],
  controllers: [
    AuthController,
    TenderController,
    BidController,
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
export class AppLocalModule {}