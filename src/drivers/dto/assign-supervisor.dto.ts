import { IsUUID, ValidateIf } from 'class-validator';

export class AssignSupervisorDto {
  /**
   * ID user supervisor yang ditunjuk.
   * Kirim `null` untuk melepas penunjukan supervisor.
   */
  @ValidateIf((o: AssignSupervisorDto) => o.supervisor_id !== null)
  @IsUUID(undefined, { message: 'supervisor_id harus berupa UUID yang valid' })
  supervisor_id!: string | null;
}
