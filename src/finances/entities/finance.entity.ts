import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('finances')
export class Finance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'date' })
  payment_date!: Date;

  @Column({ unique: true })
  reference_number!: string;

  @Column({
    type: 'enum',
    enum: ['cash', 'transfer', 'e-wallet'],
    nullable: false,
  })
  payment_method!: string;

  @Column('varchar', { length: 1000 })
  amount_received!: string;

  @Column('varchar', { length: 500 })
  notes!: string;

  @Column('varchar', { length: 100 })
  payer!: string;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}