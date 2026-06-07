import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  // Set Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS.split(',') ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Enable Swagger
  const config = new DocumentBuilder()
    .setTitle('My NestJS API for E-commerce')
    .setDescription('API documentation for E-commerce')
    .setVersion('1.0')
    .addTag('auth', 'Authentication related endpoints')
    .addTag('users', 'User management endpoints')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter JWT token to access protected endpoints',
      name: "JWT",
      in: 'header'
    }, 'JWT-auth')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter Refresh JWT token to access refresh token endpoint',
      name: "Refresh-JWT",
      in: 'header'
    }, 'JWT-refresh')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'My NestJS API for E-commerce',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0; }
      .swagger-ui .info .title { font-size: 24px; color: #4A90E2 }
      /* Dark Mode CSS */
      body { background-color: #1e1e1e; color: #e0e0e0; }
      .swagger-ui { background-color: #1e1e1e; }
      .swagger-ui .scheme-container { background-color: #252526; }
      .swagger-ui .btn { background-color: #3c3c3c; color: #e0e0e0; }
      .swagger-ui .btn:hover { background-color: #4a4a4a; }
      .swagger-ui textarea, .swagger-ui input[type="text"], .swagger-ui input[type="password"], .swagger-ui input[type="search"], .swagger-ui input[type="email"], .swagger-ui input[type="url"], .swagger-ui select { background-color: #2d2d2d; color: #e0e0e0; border-color: #404040; }
      .swagger-ui .try-out { background-color: #252526; }
      .swagger-ui .model { background-color: #252526; }
      .swagger-ui .model-box { background-color: #2d2d2d; }
      .swagger-ui .prop-type { color: #9cdcfe; }
      .swagger-ui .prop-name { color: #9cdcfe; }
      .swagger-ui section.models { background-color: #1e1e1e; }
      .swagger-ui .response-col_description { background-color: #2d2d2d; }
      .swagger-ui .parameter__in { background-color: #3c3c3c; }
    `
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch(error => {
  Logger.error('Failed to start the application', error);
  process.exit(1);
});
