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

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column('enum', {
    enum: [
      'owner',
      'finance',
      'supervisor',
      'field_officer',
      'driver',
      'admin',
      'operator',
    ],
  })
  role!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
