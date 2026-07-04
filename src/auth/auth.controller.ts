import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { extractRequestMeta } from '../audit/audit.utils';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    return this.authService.login(loginDto, meta);
  }

  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    return this.authService.forgotPassword(forgotPasswordDto, meta);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    return this.authService.resetPassword(resetPasswordDto, meta);
  }

  @Post('set-password')
  setPassword(@Body() setPasswordDto: SetPasswordDto, @Req() req: any) {
    const meta = extractRequestMeta(req);
    return this.authService.setPassword(setPasswordDto, meta);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user);
  }
}
