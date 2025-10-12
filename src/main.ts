import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = process.env.PORT || configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Cookie parser for refresh tokens
  app.use(cookieParser());

  // CORS configuration
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3001');
  logger.log(`🔗 CORS configured for origin: ${corsOrigin}`);
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (origin === corsOrigin) {
        return callback(null, true);
      }
      
      logger.warn(`❌ CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Access-Control-Allow-Credentials',
    ],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  });

  // Global API prefix
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe with security options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip non-whitelisted properties
      forbidNonWhitelisted: true, // Throw error for non-whitelisted properties
      transform: true,
      disableErrorMessages: configService.get<string>('NODE_ENV') === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('E-Procurement Sourcing API')
    .setDescription(`
      Enterprise Procurement Sourcing Backend with comprehensive role-based access control.
      
      ## Authentication
      This API uses JWT Bearer token authentication with role-based permissions:
      - **ADMIN**: Full system access, can manage all tenders and view all bids
      - **USER**: Internal users who create tenders and score bids for their department
      - **VENDOR**: External vendors who can view published tenders and submit bids
      
      ## Security Features
      - Role-based access control (RBAC) with CASL
      - Rate limiting per role (Admin: 100/min, User: 50/min, Vendor: 10/min)
      - Data encryption for sensitive bid information
      - Comprehensive audit logging
      - OWASP security compliance
      
      ## Workflow
      1. **Admin/User** creates and publishes tenders
      2. **Vendors** submit encrypted bids before closing date
      3. **Users/Admin** score bids using Go microservice
      4. **Camunda workflow** manages approval process
      5. **Events** trigger notifications and integrations
    `)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter JWT token',
    })
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Sourcing - Tenders', 'Tender management with role-based access')
    .addTag('Sourcing - Bids', 'Vendor bid submission with encryption')
    .addTag('Scoring', 'Bid evaluation and scoring (Admin/User only)')
    .addTag('Audit', 'System audit logs and compliance')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Custom Swagger options with role-based examples
  const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      tagsSorter: 'alpha',
    },
  };

  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, swaggerOptions);

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: configService.get<string>('NODE_ENV'),
      version: '1.0.0',
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  await app.listen(port, '0.0.0.0'); // Bind to all interfaces for deployment
  
  logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(`💖 Health check: http://localhost:${port}/health`);
  logger.log(`🔒 Security: Helmet, CORS, Rate Limiting, Validation enabled`);
  logger.log(`🎭 Roles: ADMIN (unlimited), USER (50/min), VENDOR (10/min)`);
}

bootstrap().catch((error) => {
  Logger.error(`Failed to start application: ${error.message}`, error.stack, 'Bootstrap');
  process.exit(1);
});