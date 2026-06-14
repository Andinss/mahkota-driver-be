import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

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
      const defaultPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      data.password = hashedPassword;

      const user = this.usersRepository.create(data);
      const result = await this.usersRepository.save(user);

      return {
        success: true,
        message: 'User created successfully',
        data: result,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to create user');
    }
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
