import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDriverDto {
  //step 1
  @IsOptional()
  @IsUUID()
  user_id!: string;

  @IsOptional()
  @IsString()
  first_name!: string;

  @IsOptional()
  @IsString()
  last_name!: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date_of_birth!: Date;

  @IsOptional()
  @IsString()
  profile_photo!: string;

  @IsOptional()
  @IsString()
  gender!: string;

  @IsOptional()
  @IsString()
  employee_id!: string;

  //step 2
  @IsOptional()
  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  emergency_contact!: string;

  @IsOptional()
  @IsEmail()
  emergency_email!: string;

  @IsOptional()
  @IsString()
  house_type!: string;

  @IsOptional()
  @IsString()
  permanent_address!: string;

  @IsOptional()
  @IsString()
  ready_sign_contract!: boolean;

  @IsOptional()
  @IsString()
  willing_to_be_survey!: boolean;

  // step 3
  @IsOptional()
  @IsString()
  national_id_card!: string;

  @IsOptional()
  @IsString()
  sim_card!: string;

  @IsOptional()
  @IsString()
  garage_photo!: string;

  @IsOptional()
  @IsString()
  npwp_photo!: string;
}
