import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditDto } from './dto/query-audit.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async findAll(query: QueryAuditDto) {
    const { search, action, status, page = 1, limit = 10 } = query;
    const where: any = {};

    if (search) {
      where.username = Like(`%${search}%`);
    }
    if (action) {
      where.action = action;
    }
    if (status) {
      where.status = status;
    }

    const [data, total] = await this.auditRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      success: true,
      message: 'Audit logs retrieved successfully',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const log = await this.auditRepository.findOne({ where: { id } });
    return { success: true, message: 'Audit log retrieved successfully', data: log };
  }

  async getStats() {
    const total = await this.auditRepository.count();
    const securityAlerts = await this.auditRepository.count({ where: { action: Like('security%') } });
    const userActions = await this.auditRepository.count({ where: { status: 'success' } });
    const failedRequests = await this.auditRepository.count({ where: { status: 'failed' } });

    return {
      success: true,
      message: 'Audit stats retrieved successfully',
      data: { totalEvents: total, securityAlerts, userActions, failedRequests },
    };
  }

  async create(data: Partial<AuditLog>) {
    const log = this.auditRepository.create(data);
    const saved = await this.auditRepository.save(log);
    return saved;
  }
}
