import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IdentityModule } from './identity/identity.module';
import { ShopModule } from './shop/shop.module';
import { EngineeringModule } from './engineering/engineering.module';
import { ProductionModule } from './production/production.module';
import { TerminalModule } from './terminal/terminal.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    IdentityModule,
    ShopModule,
    EngineeringModule,
    ProductionModule,
    TerminalModule,
    DispatchModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
