import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
import { AppLocalModule } from './app.local.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap (Local Dev)');
  
  const app = await NestFactory.create(AppLocalModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

  // Security middleware (simplified for local dev)
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for local dev
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Cookie parser for refresh tokens
  app.use(cookieParser());

  // CORS configuration (permissive for local dev)
  app.enableCors({
    origin: true, // Allow any origin in local dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
    ],
  });

  // Global API prefix
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe with security options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false, // Show errors in development
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('E-Procurement Sourcing API (Local Dev)')
    .setDescription(`
      🚀 **Local Development Environment**
      
      Enterprise Procurement Sourcing Backend with role-based access control.
      
      ## 🎭 Test Accounts (for local development)
      After seeding the database, you can use these test accounts:
      
      ### Admin Account
      - **Email**: admin@eproc.local
      - **Password**: admin123
      - **Role**: ADMIN
      - **Permissions**: Full system access
      
      ### User Account  
      - **Email**: user@eproc.local
      - **Password**: user123
      - **Role**: USER
      - **Permissions**: Create/manage tenders, score bids
      
      ### Vendor Account
      - **Email**: vendor@eproc.local
      - **Password**: vendor123
      - **Role**: VENDOR
      - **Permissions**: View published tenders, submit bids
      
      ## 🔧 Local Development Features
      - SQLite database (no external DB required)
      - Simplified authentication
      - Permissive CORS
      - Detailed error messages
      - Auto-generated test data
      
      ## 📋 Getting Started
      1. Login with one of the test accounts above
      2. Copy the JWT token from the response
      3. Click "Authorize" and paste the token
      4. Explore the role-based API endpoints
    `)
    .setVersion('1.0-dev')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter JWT token (get from /auth/login)',
    })
    .addTag('🔐 Authentication', 'User login and token management')
    .addTag('📋 Tenders', 'Tender management (Admin/User)')
    .addTag('💼 Bids', 'Bid submission (Vendor)')
    .addTag('📊 Scoring', 'Bid evaluation (Admin/User)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
    },
  });

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.json({
      status: 'ok',
      environment: 'local-development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0-dev',
      database: 'SQLite (local)',
      features: {
        authentication: true,
        roleBasedAccess: true,
        rateLimit: true,
        swagger: true,
        auditLogging: true
      },
      testAccounts: [
        { role: 'ADMIN', email: 'admin@eproc.local' },
        { role: 'USER', email: 'user@eproc.local' },
        { role: 'VENDOR', email: 'vendor@eproc.local' }
      ]
    });
  });

  await app.listen(port);
  
  logger.log('🎉 E-Procurement Sourcing Backend - Local Development');
  logger.log('─'.repeat(60));
  logger.log(`🚀 Server running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(`💖 Health check: http://localhost:${port}/health`);
  logger.log('─'.repeat(60));
  logger.log('🎭 Test Accounts:');
  logger.log('   👑 Admin: admin@eproc.local / admin123');
  logger.log('   👤 User:  user@eproc.local / user123');
  logger.log('   🏢 Vendor: vendor@eproc.local / vendor123');
  logger.log('─'.repeat(60));
  logger.log('🔧 Local Development Features:');
  logger.log('   ✅ SQLite database (no setup required)');
  logger.log('   ✅ Role-based access control');
  logger.log('   ✅ JWT authentication');
  logger.log('   ✅ Rate limiting');
  logger.log('   ✅ Comprehensive API documentation');
  logger.log('   ✅ Audit logging');
  logger.log('─'.repeat(60));
}

bootstrap().catch((error) => {
  Logger.error(`Failed to start application: ${error.message}`, error.stack, 'Bootstrap');
  process.exit(1);
});