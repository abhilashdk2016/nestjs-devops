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
      .swagger-ui .topbar { bdisplay: none }
      .swagger-ui .info { margin: 50px 0; }
      .swagger-ui .info .title { font-size: 24px; color: #4A90E2 }`
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch(error => {
  Logger.error('Failed to start the application', error);
  process.exit(1);
});
