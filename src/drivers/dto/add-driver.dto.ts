import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AddDriverDto {
  //step 1
  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;

  @IsDate()
  @Type(() => Date)
  date_of_birth!: Date;

  @IsOptional()
  @IsString()
  profile_photo?: string;

  @IsString()
  gender!: string;

  @IsString()
  employee_id!: string;

  @IsString()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  citizenship?: string;

  //step 2

  @IsString()
  emergency_contact!: string;

  @IsString()
  emergency_email!: string;

  @IsString()
  house_type!: string;

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

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  ready_sign_contract!: boolean;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  willing_to_be_survey!: boolean;

  // step 3
  @IsOptional()
  @IsString()
  national_id_card?: string;

  @IsOptional()
  @IsString()
  sim_card?: string;

  @IsOptional()
  @IsString()
  kartu_keluarga?: string;

  @IsOptional()
  @IsString()
  garage_photo?: string;

  @IsOptional()
  @IsString()
  npwp_photo?: string;

  @IsOptional()
  @IsString()
  skck?: string;

  @IsOptional()
  @IsUUID()
  membership_id?: string;
}
