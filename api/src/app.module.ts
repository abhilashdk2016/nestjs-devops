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
import { OrdersModule } from './modules/orders/orders.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { PaymentsModule } from './modules/payments/payments.module';
import { CartModule } from './modules/cart/cart.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 10
      }
    ]),
    PrismaModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    UsersModule,
    CategoryModule, ProductsModule, OrdersModule, PaymentsModule, CartModule
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule { }
