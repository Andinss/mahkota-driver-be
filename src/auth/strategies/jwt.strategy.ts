import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; purpose?: string }) {
    // Token challenge MFA hanya boleh dipakai di endpoint verifikasi MFA,
    // tidak boleh dianggap sebagai access token.
    if (payload.purpose === 'mfa') {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.is_active === false) {
      throw new UnauthorizedException('Akun Anda sedang nonaktif');
    }
    if (user.role && user.role.is_active === false) {
      throw new UnauthorizedException('Role Anda sedang nonaktif');
    }
    if (user.driver && user.driver.is_active === false) {
      throw new UnauthorizedException('Akun Anda sedang nonaktif');
    }
    return user;
  }
}
