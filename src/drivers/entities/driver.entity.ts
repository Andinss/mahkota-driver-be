import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  //step 1
  @Column({ type: 'varchar', length: 100 })
  first_name!: string;

  @Column({ type: 'varchar', length: 100 })
  last_name!: string;

  @Column({ type: 'date' })
  date_of_birth!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profile_photo!: string;

  @Column({ type: 'varchar', length: 20 })
  gender!: string;

  @Column({ unique: true, type: 'varchar', length: 50 })
  employee_id!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email!: string;
  //step 2

  @Column({ type: 'varchar', length: 20 })
  emergency_contact!: string;

  @Column({ type: 'varchar', length: 100 })
  emergency_email!: string;

  @Column({ type: 'varchar', length: 50 })
  house_type!: string;

  @Column({ type: 'text' })
  permanent_address!: string;

  @Column({ type: 'boolean', default: true })
  ready_sign_contract!: boolean;

  @Column({ type: 'boolean', default: true })
  willing_to_be_survey!: boolean;

  // step 3
  @Column({ type: 'varchar', length: 255, nullable: true })
  national_id_card!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sim_card!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  garage_photo!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  npwp_photo!: string;

  @Column({ type: 'uuid', nullable: true })
  created_by_id!: string;

  @ManyToOne(() => User, (user) => user.drivers)
  @JoinColumn({ name: 'created_by_id' })
  created_by!: User;

  //default
  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
