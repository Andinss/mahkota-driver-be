import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsBoolean } from 'class-validator';

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

  @Column('varchar', { length: 255 })
  profile_photo!: string;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
