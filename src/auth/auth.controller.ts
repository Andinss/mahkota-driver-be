import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';
import {
  DisableMfaDto,
  EnableMfaDto,
  RegenerateRecoveryCodesDto,
  VerifyMfaDto,
} from './dto/mfa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { extractRequestMeta } from '../audit/audit.utils';
import { User } from '../users/entities/user.entity';

interface AuthenticatedRequest {
  user: User;
  headers: Record<string, string | undefined>;
  connection?: { remoteAddress?: string };
  ip?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest) {
    const meta = extractRequestMeta(req);
    return this.authService.login(loginDto, meta);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('mfa/verify')
  verifyMfa(
    @Body() verifyMfaDto: VerifyMfaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    return this.authService.verifyMfaLogin(verifyMfaDto, meta);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mfa/status')
  mfaStatus(@Req() req: AuthenticatedRequest) {
    return this.mfaService.getStatus(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('mfa/setup')
  setupMfa(@Req() req: AuthenticatedRequest) {
    const meta = extractRequestMeta(req);
    return this.mfaService.setup(req.user, meta);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('mfa/enable')
  enableMfa(
    @Body() enableMfaDto: EnableMfaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    return this.mfaService.enable(req.user, enableMfaDto.code, meta);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('mfa/disable')
  disableMfa(
    @Body() disableMfaDto: DisableMfaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    return this.mfaService.disable(
      req.user,
      disableMfaDto.password,
      disableMfaDto.code,
      meta,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('mfa/recovery-codes')
  regenerateRecoveryCodes(
    @Body() dto: RegenerateRecoveryCodesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    return this.mfaService.regenerateRecoveryCodes(
      req.user,
      dto.password,
      meta,
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    return this.authService.forgotPassword(forgotPasswordDto, meta);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    return this.authService.resetPassword(resetPasswordDto, meta);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('set-password')
  setPassword(
    @Body() setPasswordDto: SetPasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const meta = extractRequestMeta(req);
    return this.authService.setPassword(setPasswordDto, meta);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-reset-token')
  verifyResetToken(@Body() verifyTokenDto: VerifyTokenDto) {
    return this.authService.verifyResetToken(verifyTokenDto.token);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-set-token')
  verifySetToken(@Body() verifyTokenDto: VerifyTokenDto) {
    return this.authService.verifySetToken(verifyTokenDto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user);
  }
}
