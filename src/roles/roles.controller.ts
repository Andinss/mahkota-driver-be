import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  Delete,
  Param,
} from '@nestjs/common';

import { RoleService } from './roles.service';
import { AddRoleDto } from './dto/add-role.dto';

@Controller('roles')

export class RoleController {
  constructor(private readonly roleService: RoleService) {}
  
    @Get()
    findAll() {
      return this.roleService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
      return this.roleService.findById(id);
    }
    
    @Post('create')
    create(@Body() addRoleDto: AddRoleDto) {
      return this.roleService.create(addRoleDto);
    }
  
    @Put('update/:id')
    update(@Body() updateRoleDto: Partial<AddRoleDto>, @Req() req: any) {
      const roleId = req.params.id;
      return this.roleService.update(roleId, updateRoleDto);
    }
  
    @Delete('delete/:id')
    delete(@Req() req: any) {
      const roleId = req.params.id;
      return this.roleService.delete(roleId);
    }
}