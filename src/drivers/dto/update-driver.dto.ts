import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateDriverDto {
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

  @IsOptional()
  @IsString()
  citizenship!: string;

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
  @IsString()
  emergency_email!: string;

  @IsOptional()
  @IsString()
  house_type!: string;

  @IsOptional()
  @IsString()
  permanent_address!: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  province_name?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  city_name?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  district_name?: string;

  @IsOptional()
  @IsString()
  subdistrict?: string;

  @IsOptional()
  @IsString()
  subdistrict_name?: string;

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
  kartu_keluarga!: string;

  @IsOptional()
  @IsString()
  garage_photo!: string;

  @IsOptional()
  @IsString()
  npwp_photo!: string;
}
