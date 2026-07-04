import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { Setting } from './entities/setting.entity';

@Module({
  providers: [SettingsService],
  controllers: [SettingsController],
  imports: [TypeOrmModule.forFeature([Setting])],
  exports: [SettingsService],
})
export class SettingsModule {}
