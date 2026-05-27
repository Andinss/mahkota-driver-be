import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Put,
  Delete,
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

  @Post('create')
  create(@Body() addUserDto: AddUserDto) {
    return this.usersService.create(addUserDto);
  }

  @Put('update/:id')
  update(@Body() updateUserDto: Partial<AddUserDto>, @Req() req: any) {
    const userId = req.params.id;
    return this.usersService.update(userId, updateUserDto);
  }

  @Delete('delete/:id')
  delete(@Req() req: any) {
    const userId = req.params.id;
    return this.usersService.delete(userId);
  }
}
