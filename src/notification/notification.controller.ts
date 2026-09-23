import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  findAll(
    @Query('type') type?: string,
    @Query('is_read') is_read?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.findAll({
      type,
      is_read: is_read !== undefined ? is_read === 'true' : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('recent')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  findRecent(@Query('limit') limit?: string) {
    return this.notificationService.findRecent(limit ? Number(limit) : 5);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.read')
  getUnreadCount() {
    return this.notificationService.getUnreadCount();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationService.create(dto);
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }

  @Put('read-all')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  markAllAsRead() {
    return this.notificationService.markAllAsRead();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('monitoring.update')
  remove(@Param('id') id: string) {
    return this.notificationService.remove(id);
  }
}
