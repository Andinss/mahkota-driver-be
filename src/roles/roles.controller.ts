import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsToRoleDto } from './dto/add-permissions-to-role.dto';

@ApiTags('Roles')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all roles' })
  findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role by ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete role by ID' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.delete(id);
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Assign permissions to role' })
  assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPermissionsToRoleDto,
  ) {
    return this.roleService.assignPermissions(id, dto);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Get permissions of a role' })
  getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.getPermissions(id);
  }
}
