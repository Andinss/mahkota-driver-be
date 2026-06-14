import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleService } from './roles.service';
import { RoleController } from './roles.controller';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';

@Module({
  providers: [RoleService],
  controllers: [RoleController],
  imports: [TypeOrmModule.forFeature([Role, Permission])],
  exports: [RoleService],
})
export class RoleModule {}
