import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 100 })
  username!: string;

  @Column({ unique: true })
  email!: string;

  @Column('varchar', { length: 255 })
  @Exclude()
  password!: string;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column({ type: 'uuid', nullable: true })
  role_id!: string;

  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column('varchar', { length: 255, nullable: true })
  reset_password_token!: string | null;

  @Column('timestamp', { nullable: true })
  reset_password_expires_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
