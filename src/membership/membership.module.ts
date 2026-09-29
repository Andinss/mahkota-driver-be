import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { Membership } from './entities/membership.entity';

@Module({
  providers: [MembershipService],
  controllers: [MembershipController],
  imports: [TypeOrmModule.forFeature([Membership])],
  exports: [MembershipService],
})
export class MembershipModule {}
