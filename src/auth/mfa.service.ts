import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { generateSecret, generateURI, verify } from 'otplib';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';

type RequestMeta = { ip_address: string; user_agent: string };

const MFA_CHALLENGE_TTL = '5m';
const RECOVERY_CODE_COUNT = 8;

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private get issuer(): string {
    return this.configService.get<string>('MFA_ISSUER') || 'Mahkota Drive';
  }

  /**
   * Kolom secret MFA memakai `select: false`, jadi harus diambil eksplisit
   * lewat query builder khusus autentikasi.
   */
  private async findByIdWithMfa(id: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .leftJoinAndSelect('user.driver', 'driver')
      .addSelect([
        'user.mfa_secret',
        'user.mfa_pending_secret',
        'user.mfa_recovery_codes',
        'user.password',
      ])
      .where('user.id = :id', { id })
      .getOne();
  }

  private getEncryptionKey(): Buffer {
    const raw =
      this.configService.get<string>('MFA_ENCRYPTION_KEY') ||
      this.configService.get<string>('JWT_SECRET') ||
      'mahkota-mfa-default-key';
    return crypto.createHash('sha256').update(raw).digest();
  }

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  private decrypt(payload: string | null): string | null {
    if (!payload) return null;
    try {
      const [ivB64, tagB64, dataB64] = payload.split('.');
      if (!ivB64 || !tagB64 || !dataB64) return null;
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        Buffer.from(ivB64, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      return null;
    }
  }

  private normalizeRecoveryCode(code: string): string {
    return code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  private async verifyTotp(
    encryptedSecret: string | null,
    code: string,
  ): Promise<boolean> {
    const secret = this.decrypt(encryptedSecret);
    const token = code.trim();
    if (!secret || !/^\d{6}$/.test(token)) return false;

    try {
      const result = await verify({ secret, token, epochTolerance: 1 });
      return result.valid;
    } catch {
      return false;
    }
  }

  private async consumeRecoveryCode(
    user: User,
    code: string,
  ): Promise<boolean> {
    if (!user.mfa_recovery_codes) return false;

    const normalized = this.normalizeRecoveryCode(code);
    if (normalized.length < 8) return false;

    let hashes: string[] = [];
    try {
      const parsed: unknown = JSON.parse(user.mfa_recovery_codes);
      if (Array.isArray(parsed)) {
        hashes = parsed.filter(
          (item): item is string => typeof item === 'string',
        );
      }
    } catch {
      return false;
    }

    for (let index = 0; index < hashes.length; index++) {
      if (await bcrypt.compare(normalized, hashes[index])) {
        hashes.splice(index, 1);
        await this.usersRepository.update(user.id, {
          mfa_recovery_codes: JSON.stringify(hashes),
        });
        return true;
      }
    }

    return false;
  }

  private async verifyUserCode(user: User, code: string): Promise<boolean> {
    if (/^\d{6}$/.test(code.trim())) {
      return this.verifyTotp(user.mfa_secret, code);
    }
    return this.consumeRecoveryCode(user, code);
  }

  private async generateRecoveryCodes(): Promise<{
    plain: string[];
    hashed: string[];
  }> {
    const rawCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      crypto.randomBytes(8).toString('hex').toUpperCase(),
    );

    const hashed = await Promise.all(
      rawCodes.map((code) => bcrypt.hash(code, 10)),
    );

    const plain = rawCodes.map((code) =>
      (code.match(/.{1,4}/g) || [code]).join('-'),
    );

    return { plain, hashed };
  }

  getStatus(user: User) {
    return { mfa_enabled: !!user.mfa_enabled };
  }

  async setup(user: User, meta?: RequestMeta) {
    if (user.mfa_enabled) {
      throw new BadRequestException('MFA sudah aktif untuk akun ini');
    }

    const secret = generateSecret();
    const account = user.email || user.username;

    await this.usersRepository.update(user.id, {
      mfa_pending_secret: this.encrypt(secret),
    });

    this.auditService
      .create({
        user_id: user.id,
        username: user.username,
        action: 'MFA Setup Started',
        target: 'Auth',
        details: 'MFA setup initiated',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'success',
      })
      .catch(() => {});

    return {
      success: true,
      secret,
      otpauth_url: generateURI({
        issuer: this.issuer,
        label: account,
        secret,
      }),
      issuer: this.issuer,
      account,
    };
  }

  async enable(user: User, code: string, meta?: RequestMeta) {
    if (user.mfa_enabled) {
      throw new BadRequestException('MFA sudah aktif untuk akun ini');
    }

    const account = await this.findByIdWithMfa(user.id);
    if (!account) {
      throw new UnauthorizedException('Akun tidak ditemukan');
    }

    if (!account.mfa_pending_secret) {
      throw new BadRequestException(
        'Sesi pengaturan MFA tidak ditemukan. Mulai pengaturan ulang.',
      );
    }

    const isValid = await this.verifyTotp(account.mfa_pending_secret, code);
    if (!isValid) {
      throw new BadRequestException('Kode verifikasi tidak valid');
    }

    const { plain, hashed } = await this.generateRecoveryCodes();

    await this.usersRepository.update(account.id, {
      mfa_enabled: true,
      mfa_secret: account.mfa_pending_secret,
      mfa_pending_secret: null,
      mfa_recovery_codes: JSON.stringify(hashed),
      mfa_enabled_at: new Date(),
    });

    this.auditService
      .create({
        user_id: account.id,
        username: account.username,
        action: 'MFA Enabled',
        target: 'Auth',
        details: 'MFA activated for account',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'success',
      })
      .catch(() => {});

    return {
      success: true,
      message:
        'MFA berhasil diaktifkan. Simpan kode pemulihan di tempat yang aman.',
      recovery_codes: plain,
    };
  }

  async disable(
    user: User,
    password: string,
    code: string,
    meta?: RequestMeta,
  ) {
    const account = await this.findByIdWithMfa(user.id);
    if (!account) {
      throw new UnauthorizedException('Akun tidak ditemukan');
    }

    if (!account.mfa_enabled) {
      throw new BadRequestException('MFA belum aktif untuk akun ini');
    }

    const isPasswordValid =
      !!account.password && (await bcrypt.compare(password, account.password));
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password salah');
    }

    const isValid = await this.verifyUserCode(account, code);
    if (!isValid) {
      throw new UnauthorizedException('Kode MFA tidak valid');
    }

    await this.usersRepository.update(account.id, {
      mfa_enabled: false,
      mfa_secret: null,
      mfa_pending_secret: null,
      mfa_recovery_codes: null,
      mfa_enabled_at: null,
    });

    this.auditService
      .create({
        user_id: account.id,
        username: account.username,
        action: 'MFA Disabled',
        target: 'Auth',
        details: 'MFA deactivated for account',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'success',
      })
      .catch(() => {});

    return { success: true, message: 'MFA berhasil dinonaktifkan.' };
  }

  async regenerateRecoveryCodes(
    user: User,
    password: string,
    meta?: RequestMeta,
  ) {
    const account = await this.findByIdWithMfa(user.id);
    if (!account) {
      throw new UnauthorizedException('Akun tidak ditemukan');
    }

    if (!account.mfa_enabled || !account.mfa_secret) {
      throw new BadRequestException('MFA belum aktif untuk akun ini');
    }

    const isPasswordValid =
      !!account.password && (await bcrypt.compare(password, account.password));
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password salah');
    }

    const { plain, hashed } = await this.generateRecoveryCodes();

    await this.usersRepository.update(account.id, {
      mfa_recovery_codes: JSON.stringify(hashed),
    });

    this.auditService
      .create({
        user_id: account.id,
        username: account.username,
        action: 'MFA Recovery Codes Regenerated',
        target: 'Auth',
        details: 'Recovery codes regenerated',
        ip_address: meta?.ip_address,
        user_agent: meta?.user_agent,
        status: 'success',
      })
      .catch(() => {});

    return {
      success: true,
      message: 'Kode pemulihan baru berhasil dibuat.',
      recovery_codes: plain,
    };
  }

  createChallengeToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose: 'mfa' },
      { expiresIn: MFA_CHALLENGE_TTL },
    );
  }

  async verifyChallenge(mfaToken: string, code: string): Promise<User> {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify<{ sub: string; purpose?: string }>(
        mfaToken,
      );
    } catch {
      throw new UnauthorizedException(
        'Sesi verifikasi MFA kedaluwarsa. Silakan login ulang.',
      );
    }

    if (payload.purpose !== 'mfa' || !payload.sub) {
      throw new UnauthorizedException('Token verifikasi MFA tidak valid');
    }

    const user = await this.findByIdWithMfa(payload.sub);

    if (
      !user ||
      user.is_active === false ||
      !user.mfa_enabled ||
      !user.mfa_secret
    ) {
      throw new UnauthorizedException(
        'Verifikasi MFA tidak dapat diproses. Silakan login ulang.',
      );
    }

    if (user.role && user.role.is_active === false) {
      throw new UnauthorizedException('Role Anda sedang nonaktif');
    }

    if (user.driver && user.driver.is_active === false) {
      throw new UnauthorizedException('Akun Anda sedang nonaktif');
    }

    const isValid = await this.verifyUserCode(user, code);
    if (!isValid) {
      throw new UnauthorizedException('Kode MFA tidak valid');
    }

    return user;
  }
}
