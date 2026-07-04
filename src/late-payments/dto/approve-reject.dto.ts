import { IsOptional, IsString } from 'class-validator';

export class ApproveRejectDto {
  @IsOptional()
  @IsString()
  admin_note?: string;
}
