import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { Finance } from './finance.entity';
import { MethodPayment } from '../../method-payment/entities/method-payment.entity';

@Entity('finance_payments')
export class FinancePayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  finance_id!: string;

  @ManyToOne(() => Finance, (finance) => finance.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'finance_id' })
  finance!: Finance;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column('decimal', {
    precision: 14,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value ? parseFloat(value) : 0),
    },
  })
  amount!: number;

  @Column({ type: 'varchar', length: 50 })
  payment_method!: string;

  @Column({ type: 'date' })
  payment_date!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference_number!: string;

  /** Rekening tujuan yang dipilih driver (relasi ke method_payments). */
  @Column({ type: 'uuid', nullable: true })
  method_payment_id!: string | null;

  @ManyToOne(() => MethodPayment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'method_payment_id' })
  method_payment!: MethodPayment | null;

  /** Rekening asal milik driver yang dipakai bayar (teks bebas). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  source_account!: string | null;

  /** Path file bukti bayar yang diunggah driver. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  proof_image!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
