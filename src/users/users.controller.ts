import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Put,
  Delete,
  Param,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { AddUserDto } from './dto/add-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('user.read')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Permissions('user.read')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post('create')
  @Permissions('user.create')
  create(@Body() addUserDto: AddUserDto) {
    return this.usersService.create(addUserDto);
  }

  @Put('update/:id')
  @Permissions('user.update')
  update(@Body() updateUserDto: Partial<AddUserDto>, @Req() req: any) {
    const userId = req.params.id;
    return this.usersService.update(userId, updateUserDto);
  }

  @Delete('delete/:employid')
  @Permissions('user.delete')
  delete(@Req() req: any) {
    const userId = req.params.employid;
    return this.usersService.delete(userId);
  }
}
