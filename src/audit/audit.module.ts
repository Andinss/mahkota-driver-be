import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLog } from './entities/audit-log.entity';

@Global()
@Module({
  providers: [AuditService],
  controllers: [AuditController],
  imports: [TypeOrmModule.forFeature([AuditLog])],
  exports: [AuditService],
})
export class AuditModule {}
