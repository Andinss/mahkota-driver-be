import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
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

  @Column({ type: 'uuid', nullable: true })
  driver_id?: string;

  @OneToOne(() => Driver)
  @JoinColumn({ name: 'driver_id' })
  driver?: Driver;

  @Column('varchar', { length: 255, nullable: true })
  reset_password_token!: string | null;

  @Column('timestamp', { nullable: true })
  reset_password_expires_at!: Date | null;

  @Column('varchar', { length: 255, nullable: true })
  set_password_token!: string | null;

  @Column('timestamp', { nullable: true })
  set_password_expires_at!: Date | null;

  @Column('boolean', { default: false })
  mfa_enabled!: boolean;

  /** Secret TOTP terenkripsi (AES-256-GCM), hanya diisi saat MFA aktif. */
  @Column('varchar', { length: 512, nullable: true, select: false })
  @Exclude()
  mfa_secret!: string | null;

  /** Secret sementara selama proses aktivasi MFA. */
  @Column('varchar', { length: 512, nullable: true, select: false })
  @Exclude()
  mfa_pending_secret!: string | null;

  /** Daftar hash bcrypt kode pemulihan (JSON string). */
  @Column('text', { nullable: true, select: false })
  @Exclude()
  mfa_recovery_codes!: string | null;

  @Column('timestamp', { nullable: true })
  mfa_enabled_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
