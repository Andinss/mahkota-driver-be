import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  async findAll() {
    const settings = await this.settingsRepository.find();
    return { success: true, message: 'Settings retrieved successfully', data: settings };
  }

  async findByKey(key: string) {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return { success: true, message: 'Setting retrieved successfully', data: setting };
  }

  async create(dto: CreateSettingDto) {
    const setting = this.settingsRepository.create(dto);
    const saved = await this.settingsRepository.save(setting);
    return { success: true, message: 'Setting created successfully', data: saved };
  }

  async update(key: string, dto: UpdateSettingDto) {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    Object.assign(setting, dto);
    const updated = await this.settingsRepository.save(setting);
    return { success: true, message: 'Setting updated successfully', data: updated };
  }

  async delete(key: string) {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    await this.settingsRepository.remove(setting);
    return { success: true, message: 'Setting deleted successfully' };
  }
}
