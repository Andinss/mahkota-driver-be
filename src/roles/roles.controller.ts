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
  Req,
} from '@nestjs/common';
import { RoleService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsToRoleDto } from './dto/add-permissions-to-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuditService } from '../audit/audit.service';
import { extractRequestMeta } from '../audit/audit.utils';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('roles')
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('role.create')
  async create(@Body() dto: CreateRoleDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    const result = await this.roleService.create(dto);
    const role = result?.data || result;
    this.auditService.create({
      user_id: req.user?.id,
      username: req.user?.username || 'system',
      action: 'CREATE_ROLE',
      target: `role/${role?.id || ''}`,
      details: `Created role ${dto.name}`,
      ...meta,
      status: 'success',
    }).catch(() => {});
    return result;
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
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: any,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.roleService.update(id, dto);
    this.auditService.create({
      user_id: req.user?.id,
      username: req.user?.username || 'system',
      action: 'UPDATE_ROLE',
      target: `role/${id}`,
      details: `Updated role ${id}`,
      ...meta,
      status: 'success',
    }).catch(() => {});
    return result;
  }

  @Delete(':id')
  @Permissions('role.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const meta = extractRequestMeta(req);
    const result = await this.roleService.delete(id);
    this.auditService.create({
      user_id: req.user?.id,
      username: req.user?.username || 'system',
      action: 'DELETE_ROLE',
      target: `role/${id}`,
      details: `Deleted role ${id}`,
      ...meta,
      status: 'success',
    }).catch(() => {});
    return result;
  }

  @Post(':id/permissions')
  @Permissions('role.update')
  async assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPermissionsToRoleDto,
    @Req() req: any,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.roleService.assignPermissions(id, dto);
    this.auditService.create({
      user_id: req.user?.id,
      username: req.user?.username || 'system',
      action: 'ASSIGN_PERMISSIONS',
      target: `role/${id}`,
      details: `Assigned ${dto.permissionIds?.length || 0} permissions to role`,
      ...meta,
      status: 'success',
    }).catch(() => {});
    return result;
  }

  @Delete(':id/permissions')
  @Permissions('role.update')
  async removePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPermissionsToRoleDto,
    @Req() req: any,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.roleService.removePermissions(id, dto);
    this.auditService.create({
      user_id: req.user?.id,
      username: req.user?.username || 'system',
      action: 'REMOVE_PERMISSIONS',
      target: `role/${id}`,
      details: `Removed ${dto.permissionIds?.length || 0} permissions from role`,
      ...meta,
      status: 'success',
    }).catch(() => {});
    return result;
  }

  @Get(':id/permissions')
  @Permissions('role.read')
  getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.getPermissions(id);
  }
}
