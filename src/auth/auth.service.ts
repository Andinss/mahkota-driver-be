import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async login(loginDto: LoginDto) {
    const formData = new URLSearchParams();
    formData.append(
      'secret',
      this.configService.get<string>('TURNSTILE_SECRET_KEY')!,
    );
    formData.append('response', loginDto.turnstile_token);

    const turnstileRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: formData,
      },
    );
    const turnstileResult = await turnstileRes.json();

    if (!turnstileResult.success) {
      throw new UnauthorizedException('Turnstile verification failed');
    }

    const user = await this.usersRepository.findOne({
      where: { email: loginDto.email },
      relations: {
        role: {
          permissions: true,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
            }
          : null,
        permissions: user.role?.permissions
          ? user.role.permissions.map((p) => p.name)
          : [],
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.usersService.findByEmail(email);

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      await this.usersService.update(user.id, {
        reset_password_token: token,
        reset_password_expires_at: expiresAt,
      });

      await this.sendResetPasswordEmail(email, token);
    }

    return {
      success: true,
      message: 'Jika email terdaftar, link reset password telah dikirim.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password, password_confirmation } = resetPasswordDto;

    if (password !== password_confirmation) {
      throw new BadRequestException(
        'Password dan konfirmasi password tidak cocok',
      );
    }

    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      throw new BadRequestException('Token reset password tidak valid');
    }

    if (
      !user.reset_password_expires_at ||
      user.reset_password_expires_at < new Date()
    ) {
      throw new BadRequestException('Token reset password sudah kedaluwarsa');
    }

    await this.usersService.update(user.id, {
      password,
      reset_password_token: null,
      reset_password_expires_at: null,
    });

    return {
      success: true,
      message: 'Password berhasil diubah.',
    };
  }

  private async sendResetPasswordEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetLink = `${frontendUrl}/auth/reset/?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Reset Password - Mahkota Drive',
      template: 'reset-password',
      context: { resetLink, year: new Date().getFullYear() },
    });
  }

  async getProfile(user: User) {
    const profile = await this.usersRepository.findOne({
      where: { id: user.id },
      relations: {
        role: {
          permissions: true,
        },
      },
    });
    return plainToInstance(User, profile);
  }
}
