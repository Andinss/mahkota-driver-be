import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '../../roles/entities/role.entity';
import { IsOptional } from 'class-validator';
import { Driver } from 'src/drivers/entities/driver.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 100 })
  username!: string;

  @IsOptional()
  @Column('varchar', { length: 100, nullable: true })
  fullname!: string;

  @Column({ unique: true })
  email!: string;

  @Column('varchar', { length: 255, nullable: true })
  @Exclude()
  password!: string | null;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column({ type: 'uuid', nullable: true })
  role_id!: string;

  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @OneToMany(() => Driver, (driver) => driver.created_by)
  drivers!: Driver[];

  @Column('varchar', { length: 255, nullable: true })
  reset_password_token!: string | null;

  @Column('timestamp', { nullable: true })
  reset_password_expires_at!: Date | null;

  @Column('varchar', { length: 255, nullable: true })
  set_password_token!: string | null;

  @Column('timestamp', { nullable: true })
  set_password_expires_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
