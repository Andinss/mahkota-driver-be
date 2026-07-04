import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async getSummary() {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository.count({ where: { is_active: true } });

    return {
      success: true,
      message: 'User summary retrieved successfully',
      data: {
        total_users: totalUsers,
        active_users: activeUsers,
      },
    };
  }

  async findAll(): Promise<{
    success: boolean;
    message: string;
    data: User[];
  }> {
    const result = await this.usersRepository.find({
      relations: { role: true },
    });
    return {
      success: true,
      message: 'Users retrieved successfully',
      data: result,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: { role: { permissions: true } },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: { role: { permissions: true } },
    });
  }

  async findBySetPasswordToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { set_password_token: token },
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { reset_password_token: token },
    });
  }

  async update(id: string, data: Partial<User>) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const result = await this.usersRepository.update(id, data);

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    const user = await this.findById(id);

    return {
      success: true,
      message: 'User updated successfully',
      data: user,
    };
  }

  async create(data: Partial<User>) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      data.password = null;
      data.set_password_token = token;
      data.set_password_expires_at = expiresAt;

      const user = this.usersRepository.create(data);
      const result = await this.usersRepository.save(user);

      try {
        await this.sendSetPasswordEmail(result.email, token);
      } catch (emailError) {
        console.error('Failed to send set-password email:', emailError);
      }

      return {
        success: true,
        message: 'User created successfully, please check email to set password',
        data: { ...result, set_password_token: token },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  private async sendSetPasswordEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const setPasswordLink = `${frontendUrl}/auth/set-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Buat Password Akun - Mahkota Drive',
      template: 'set-password',
      context: { setPasswordLink, year: new Date().getFullYear() },
    });
  }

  async delete(
    employid: string,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.usersRepository.delete(employid);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}
