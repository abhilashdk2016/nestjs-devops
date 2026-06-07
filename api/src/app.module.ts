import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './modules/auth/strategies/jwt.strategy';
import { UsersModule } from './modules/users/users.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule, 
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }), 
    UsersModule, 
    CategoryModule, ProductsModule
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
