import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('setting.read')
  findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  @Permissions('setting.read')
  findByKey(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }

  @Post()
  @Permissions('setting.create')
  create(@Body() dto: CreateSettingDto) {
    return this.settingsService.create(dto);
  }

  @Patch(':key')
  @Permissions('setting.update')
  update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.update(key, dto);
  }

  @Delete(':key')
  @Permissions('setting.delete')
  delete(@Param('key') key: string) {
    return this.settingsService.delete(key);
  }
}
