import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('memberships')
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'int', unique: true })
  level!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  fee!: number;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  benefits!: string[];

  @Column({ type: 'bool', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
