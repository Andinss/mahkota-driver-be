import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepository: Repository<Notification>,
  ) {}

  async findAll(query?: { type?: string; is_read?: boolean; limit?: number }) {
    const qb = this.notifRepository
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.vehicle', 'vehicle')
      .orderBy('n.created_at', 'DESC');

    if (query?.type) {
      qb.andWhere('n.type = :type', { type: query.type });
    }

    if (query?.is_read !== undefined) {
      qb.andWhere('n.is_read = :is_read', { is_read: query.is_read });
    }

    if (query?.limit) {
      qb.take(query.limit);
    }

    const notifications = await qb.getMany();
    const unreadCount = await this.notifRepository.count({
      where: { is_read: false },
    });

    return {
      success: true,
      message: 'Notifications retrieved successfully',
      data: notifications,
      unread_count: unreadCount,
    };
  }

  async findRecent(limit = 5) {
    const notifications = await this.notifRepository.find({
      order: { created_at: 'DESC' },
      take: limit,
      relations: { vehicle: true },
    });

    const unreadCount = await this.notifRepository.count({
      where: { is_read: false },
    });

    return {
      success: true,
      message: 'Recent notifications retrieved successfully',
      data: notifications,
      unread_count: unreadCount,
    };
  }

  async create(dto: CreateNotificationDto) {
    const notif = this.notifRepository.create({
      type: dto.type,
      title: dto.title,
      message: dto.message,
      vehicle_id: dto.vehicle_id || null,
      status: dto.status || 'unread',
      metadata: dto.metadata || null,
      is_read: false,
    });

    const saved = await this.notifRepository.save(notif);

    return {
      success: true,
      message: 'Notification created successfully',
      data: saved,
    };
  }

  async markAsRead(id: string) {
    const notif = await this.notifRepository.findOne({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');

    notif.is_read = true;
    notif.status = 'read';
    await this.notifRepository.save(notif);

    return {
      success: true,
      message: 'Notification marked as read',
      data: notif,
    };
  }

  async markAllAsRead() {
    await this.notifRepository.update(
      { is_read: false },
      { is_read: true, status: 'read' },
    );

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  async getUnreadCount() {
    const count = await this.notifRepository.count({
      where: { is_read: false },
    });

    return {
      success: true,
      data: { count },
    };
  }

  async remove(id: string) {
    const notif = await this.notifRepository.findOne({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');

    await this.notifRepository.remove(notif);

    return {
      success: true,
      message: 'Notification deleted successfully',
    };
  }
}
