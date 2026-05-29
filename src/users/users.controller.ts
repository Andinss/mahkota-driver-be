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

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
  @Post('create')
  create(@Body() addUserDto: AddUserDto) {
    return this.usersService.create(addUserDto);
  }

  @Put('update/:id')
  update(@Body() updateUserDto: Partial<AddUserDto>, @Req() req: any) {
    const userId = req.params.id;
    return this.usersService.update(userId, updateUserDto);
  }

  @Delete('delete/:employid')
  delete(@Req() req: any) {
    const userId = req.params.employid;
    return this.usersService.delete(userId);
  }
}
