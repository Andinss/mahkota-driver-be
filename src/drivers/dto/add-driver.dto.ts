import {
  IsDate,
  IsEmail,
  IsEnum,
  isString,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Column } from 'typeorm';

export class AddDriverDto {
  //step 1
  @IsUUID()
  user_id!: string;

  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;

  @IsDate()
  date_of_birth!: string;

  @IsString()
  profile_photo!: string;

  @IsString()
  gender!: string;

  @IsString()
  employee_id!: string;

  //step 2

  @IsString()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  emergency_contact!: string;

  @IsEmail()
  emergency_email!: string;

  @IsString()
  house_type!: string;

  @IsString()
  permanent_address!: string;

  @IsString()
  ready_sign_contract!: boolean;

  @IsString()
  willing_to_be_survey!: boolean;

  // step 3
  @IsString()
  national_id_card!: string;

  @IsString()
  sim_card!: string;

  @IsString()
  garage_photo!: string;

  @IsString()
  npwp_photo!: string;
}
