import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleService } from './roles.service';
import { RoleController } from './roles.controller';
import { Role } from './entities/role.entity';

@Module({
  providers: [RoleService],
  controllers: [RoleController],
  imports: [TypeOrmModule.forFeature([Role])],
  exports: [RoleService],
})

export class RoleModule {}