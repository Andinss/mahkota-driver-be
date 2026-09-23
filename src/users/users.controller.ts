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
  NotFoundException,
  BadRequestException,
  StreamableFile,
  Query,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { AddUserDto } from './dto/add-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserExportDto } from './dto/user-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuditService } from '../audit/audit.service';
import { extractRequestMeta } from '../audit/audit.utils';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Permissions('user.read')
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('summary')
  @Permissions('user.read')
  getSummary() {
    return this.usersService.getSummary();
  }

  @Get('export')
  @Permissions('user.read')
  async export(@Query() query: UserExportDto) {
    const result = await this.usersService.exportData(query);
    if (!result) {
      throw new BadRequestException('Invalid export format');
    }
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get(':id')
  @Permissions('user.read')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      success: true,
      message: 'User retrieved successfully',
      data: user,
    };
  }

  @Post('create')
  @Permissions('user.create')
  async create(@Body() addUserDto: AddUserDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    const result = await this.usersService.create(addUserDto);
    const user = result?.data || result;
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'CREATE_USER',
        target: `user/${user?.id || ''}`,
        details: `Created user ${addUserDto.email}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Put('update/:id')
  @Permissions('user.update')
  async update(@Body() updateUserDto: Partial<AddUserDto>, @Req() req: any) {
    const userId = req.params.id;
    const meta = extractRequestMeta(req);
    const result = await this.usersService.update(userId, updateUserDto);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'UPDATE_USER',
        target: `user/${userId}`,
        details: `Updated user ${userId}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Delete('delete/:employid')
  @Permissions('user.delete')
  async delete(@Req() req: any) {
    const userId = req.params.employid;
    const meta = extractRequestMeta(req);
    const result = await this.usersService.delete(userId);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'DELETE_USER',
        target: `user/${userId}`,
        details: `Deleted user ${userId}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }
}
