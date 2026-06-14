import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user: jwtUser } = context.switchToHttp().getRequest();

    const user = await this.usersRepository.findOne({
      where: { id: jwtUser.id },
      relations: {
        role: {
          permissions: true,
        },
      },
    });

    if (!user || !user.role || !user.role.permissions) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    const userPermissionNames = user.role.permissions.map((p) => p.name);

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissionNames.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
