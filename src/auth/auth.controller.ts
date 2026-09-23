import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { extractRequestMeta } from '../audit/audit.utils';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    return this.authService.login(loginDto, meta);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() req: any,
  ) {
    const meta = extractRequestMeta(req);
    return this.authService.forgotPassword(forgotPasswordDto, meta);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    return this.authService.resetPassword(resetPasswordDto, meta);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('set-password')
  setPassword(@Body() setPasswordDto: SetPasswordDto, @Req() req: any) {
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
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user);
  }
}
