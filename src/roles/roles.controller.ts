import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { RoleService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsToRoleDto } from './dto/add-permissions-to-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Permissions('role.create')
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get()
  @Permissions('role.read')
  findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @Permissions('role.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.findById(id);
  }

  @Patch(':id')
  @Permissions('role.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('role.delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.delete(id);
  }

  @Post(':id/permissions')
  @Permissions('role.update')
  assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPermissionsToRoleDto,
  ) {
    return this.roleService.assignPermissions(id, dto);
  }

  @Delete(':id/permissions')
  @Permissions('role.update')
  removePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPermissionsToRoleDto,
  ) {
    return this.roleService.removePermissions(id, dto);
  }

  @Get(':id/permissions')
  @Permissions('role.read')
  getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.getPermissions(id);
  }
}
