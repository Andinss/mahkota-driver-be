import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GpsidService } from './gpsid.service';
import { GpsidController } from './gpsid.controller';

@Module({
  imports: [ConfigModule],
  controllers: [GpsidController],
  providers: [GpsidService],
  exports: [GpsidService],
})
export class GpsidModule {}
