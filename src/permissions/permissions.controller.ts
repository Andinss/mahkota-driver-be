import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Permissions('permission.create')
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Get()
  @Permissions('permission.read')
  findAll(@Query('is_active') is_active?: string) {
    return this.permissionsService.findAll(is_active);
  }

  @Get(':id')
  @Permissions('permission.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.findById(id);
  }

  @Patch(':id')
  @Permissions('permission.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('permission.delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.delete(id);
  }
}
