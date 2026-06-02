import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { Finance } from './entities/finance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Finance])],
  controllers: [FinancesController],
  providers: [FinancesService],
  exports: [FinancesService],
})
export class FinancesModule {}