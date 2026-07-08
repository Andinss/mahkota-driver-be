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
import { AuditService } from '../audit/audit.service';

import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
    private readonly auditService: AuditService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async login(loginDto: LoginDto, meta?: { ip_address: string; user_agent: string }) {
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

    if (!user || !user.password) {
      await this.auditService.create({
        username: loginDto.email,
        action: 'Login Failed',
        target: 'Auth',
        details: 'User not found or no password set',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'failed',
      }).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      await this.auditService.create({
        username: loginDto.email,
        action: 'Login Failed',
        target: 'Auth',
        details: 'Invalid password',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'failed',
      }).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id };

    await this.auditService.create({
      user_id: user.id,
      username: user.username,
      action: 'Login',
      target: 'Auth',
      details: `User ${user.username} logged in`,
      ip_address: meta?.ip_address,
      user_agent: meta?.user_agent,
      status: 'success',
    }).catch(() => {});

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

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto, meta?: { ip_address: string; user_agent: string }) {
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

      this.auditService.create({
        user_id: user.id,
        username: user.username,
        action: 'Forgot Password',
        target: 'Auth',
        details: `Password reset requested for ${email}`,
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'success',
      }).catch(() => {});
    } else {
      this.auditService.create({
        username: email,
        action: 'Forgot Password',
        target: 'Auth',
        details: `Password reset requested for unknown email ${email}`,
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'failed',
      }).catch(() => {});
    }

    return {
      success: true,
      message: 'Jika email terdaftar, link reset password telah dikirim.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto, meta?: { ip_address: string; user_agent: string }) {
    const { token, password, password_confirmation } = resetPasswordDto;

    // If password not provided, this is a verification request
    if (!password) {
      const user = await this.usersService.findByResetToken(token);

      if (
        !user ||
        !user.reset_password_expires_at ||
        user.reset_password_expires_at < new Date()
      ) {
        return { valid: false };
      }

      return { valid: true };
    }

    if (password !== password_confirmation) {
      throw new BadRequestException(
        'Password dan konfirmasi password tidak cocok',
      );
    }

    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      this.auditService.create({
        username: 'unknown',
        action: 'Reset Password Failed',
        target: 'Auth',
        details: 'Invalid reset token',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'failed',
      }).catch(() => {});
      throw new BadRequestException('Token reset password tidak valid');
    }

    if (
      !user.reset_password_expires_at ||
      user.reset_password_expires_at < new Date()
    ) {
      this.auditService.create({
        user_id: user.id,
        username: user.username,
        action: 'Reset Password Failed',
        target: 'Auth',
        details: 'Expired reset token',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'failed',
      }).catch(() => {});
      throw new BadRequestException('Token reset password sudah kedaluwarsa');
    }

    await this.usersService.update(user.id, {
      password,
      reset_password_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    this.auditService.create({
      user_id: user.id,
      username: user.username,
      action: 'Reset Password',
      target: 'Auth',
      details: `Password reset for ${user.email}`,
      ip_address: meta?.ip_address,
      user_agent: meta?.user_agent,
      status: 'success',
    }).catch(() => {});

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

  async setPassword(setPasswordDto: SetPasswordDto, meta?: { ip_address: string; user_agent: string }) {
    const { token, password, password_confirmation } = setPasswordDto;

    // If password not provided, this is a verification request
    if (!password) {
      const user = await this.usersService.findBySetPasswordToken(token);

      if (
        !user ||
        !user.set_password_expires_at ||
        user.set_password_expires_at < new Date() ||
        user.password !== null
      ) {
        return { valid: false };
      }

      return { valid: true };
    }

    if (password !== password_confirmation) {
      throw new BadRequestException(
        'Password dan konfirmasi password tidak cocok',
      );
    }

    const user = await this.usersService.findBySetPasswordToken(token);

    if (!user) {
      this.auditService.create({
        username: 'unknown',
        action: 'Set Password Failed',
        target: 'Auth',
        details: 'Invalid set password token',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'failed',
      }).catch(() => {});
      throw new BadRequestException('Token tidak valid');
    }

    if (
      !user.set_password_expires_at ||
      user.set_password_expires_at < new Date()
    ) {
      this.auditService.create({
        user_id: user.id,
        username: user.username,
        action: 'Set Password Failed',
        target: 'Auth',
        details: 'Expired set password token',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'failed',
      }).catch(() => {});
      throw new BadRequestException('Token sudah kedaluwarsa');
    }

    await this.usersService.update(user.id, {
      password,
      set_password_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    this.auditService.create({
      user_id: user.id,
      username: user.username,
      action: 'Set Password',
      target: 'Auth',
      details: `Password set for ${user.email}`,
      ip_address: meta?.ip_address,
      user_agent: meta?.user_agent,
      status: 'success',
    }).catch(() => {});

    return {
      success: true,
      message: 'Password berhasil dibuat. Silakan login.',
    };
  }

  async verifyResetToken(token: string) {
    const user = await this.usersService.findByResetToken(token);

    if (
      !user ||
      !user.reset_password_expires_at ||
      user.reset_password_expires_at < new Date()
    ) {
      return { valid: false };
    }

    return { valid: true };
  }

  async verifySetToken(token: string) {
    const user = await this.usersService.findBySetPasswordToken(token);

    if (
      !user ||
      !user.set_password_expires_at ||
      user.set_password_expires_at < new Date() ||
      user.password !== null
    ) {
      return { valid: false };
    }

    return { valid: true };
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

    return {
      id: profile?.id,
      username: profile?.username,
      email: profile?.email,
      role: profile?.role
        ? {
            id: profile.role.id,
            name: profile.role.name,
            code: profile.role.code,
          }
        : null,
      permissions: profile?.role?.permissions
        ? profile.role.permissions.map((p) => p.name)
        : [],
    };
  }
}
