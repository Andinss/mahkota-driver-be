import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  user_id?: string;

  @Column()
  username!: string;

  @Column()
  action!: string;

  @Column({ nullable: true })
  target?: string;

  @Column('text', { nullable: true })
  details?: string;

  @Column({ nullable: true })
  ip_address?: string;

  @Column({ nullable: true })
  user_agent?: string;

  @Column({ default: 'success' })
  status!: string;

  @CreateDateColumn()
  @Index()
  created_at!: Date;
}
