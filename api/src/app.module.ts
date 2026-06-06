import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './modules/auth/strategies/jwt.strategy';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
