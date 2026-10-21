import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { OutOfTownService } from './out-town.service';
import { CreateMyOutOfTownDto } from './dto/create-my-out-of-town.dto';
import { ApproveRejectDto } from './dto/approve-reject.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

interface AuthedRequest {
  user?: {
    id?: string;
    driver?: { id?: string };
    driver_id?: string;
  };
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('out-of-town')
export class OutOfTownController {
  constructor(private readonly outOfTownService: OutOfTownService) {}

  /** Pengajuan izin keluar kota oleh driver. */
  @Post('my')
  @Permissions('out_of_town.create')
  createMine(@Body() dto: CreateMyOutOfTownDto, @Req() req: AuthedRequest) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      throw new BadRequestException('No driver profile linked to this account');
    }
    return this.outOfTownService.createForDriver(dto, driverId);
  }

  /** Daftar pengajuan milik driver yang login. */
  @Get('my')
  @Permissions('out_of_town.read')
  listMine(@Req() req: AuthedRequest) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      return { success: true, message: 'No driver', data: [] };
    }
    return this.outOfTownService.listMine(driverId);
  }

  /** Statistik pengajuan milik driver yang login. */
  @Get('my/stats')
  @Permissions('out_of_town.read')
  getMyStats(@Req() req: AuthedRequest) {
    const driverId = req.user?.driver?.id || req.user?.driver_id;
    if (!driverId) {
      return {
        success: true,
        message: 'No driver',
        data: { pending: 0, approved: 0, rejected: 0, total: 0 },
      };
    }
    return this.outOfTownService.getStats(driverId);
  }

  @Get()
  @Permissions('out_of_town.read')
  findAll(@Query('status') status?: string) {
    return this.outOfTownService.findAll(status);
  }

  @Get('stats')
  @Permissions('out_of_town.read')
  getStats() {
    return this.outOfTownService.getStats();
  }

  @Get(':id')
  @Permissions('out_of_town.read')
  findOne(@Param('id') id: string) {
    return this.outOfTownService.findById(id);
  }

  @Post(':id/approve')
  @Permissions('out_of_town.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveRejectDto,
    @Req() req: AuthedRequest,
  ) {
    return this.outOfTownService.approve(
      id,
      dto.admin_note,
      req.user?.id,
      dto.fee_amount,
    );
  }

  @Post(':id/reject')
  @Permissions('out_of_town.approve')
  reject(
    @Param('id') id: string,
    @Body() dto: ApproveRejectDto,
    @Req() req: AuthedRequest,
  ) {
    return this.outOfTownService.reject(id, dto.admin_note, req.user?.id);
  }

  @Delete('delete/:id')
  @Permissions('out_of_town.approve')
  delete(@Param('id') id: string) {
    return this.outOfTownService.delete(id);
  }
}
