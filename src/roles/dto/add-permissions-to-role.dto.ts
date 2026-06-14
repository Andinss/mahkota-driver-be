import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddPermissionsToRoleDto {
  @ApiProperty({
    type: [String],
    example: ['uuid-permission-1', 'uuid-permission-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
