import { Module } from '@nestjs/common';
import { FieldOfficerService } from './field-officer.service';
import { FieldOfficerController } from './field-officer.controller';

@Module({
  providers: [FieldOfficerService],
  controllers: [FieldOfficerController]
})
export class FieldOfficerModule {}
