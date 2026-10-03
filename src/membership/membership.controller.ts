import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AuditService } from '../audit/audit.service';
import { extractRequestMeta } from '../audit/audit.utils';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    username?: string;
  };
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('memberships')
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateMembershipDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.membershipService.create(dto);
    const membership = result?.data || result;
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'CREATE_MEMBERSHIP',
        target: `membership/${membership?.id || ''}`,
        details: `Created membership ${membership?.name || dto.name} (level ${membership?.level})`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Get()
  findAll(@Query('is_active') is_active?: string) {
    return this.membershipService.findAll(is_active);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.membershipService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembershipDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.membershipService.update(id, dto);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'UPDATE_MEMBERSHIP',
        target: `membership/${id}`,
        details: `Updated membership ${id}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('is_active') is_active: string | boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    const activeValue =
      typeof is_active === 'boolean'
        ? is_active
        : String(is_active).toLowerCase() === 'true';
    const meta = extractRequestMeta(req);
    const result = await this.membershipService.updateStatus(id, activeValue);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'UPDATE_MEMBERSHIP',
        target: `membership/${id}`,
        details: `Membership ${id} marked as ${activeValue ? 'Active' : 'Inactive'}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    const result = await this.membershipService.delete(id);
    this.auditService
      .create({
        user_id: req.user?.id,
        username: req.user?.username || 'system',
        action: 'DELETE_MEMBERSHIP',
        target: `membership/${id}`,
        details: `Deleted membership ${id}`,
        ...meta,
        status: 'success',
      })
      .catch(() => {});
    return result;
  }
}
