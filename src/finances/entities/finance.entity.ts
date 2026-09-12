import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { Rental } from '../../rentals/entities/rental.entity';
import { FinancePayment } from './finance-payment.entity';

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
    enum: ['cash', 'transfer', 'e-wallet', 'saldo'],
    nullable: false,
  })
  payment_method!: string;

  @Column('decimal', {
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value ? parseFloat(value) : 0),
    },
  })
  amount_received!: number;

  @Column('decimal', {
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value ? parseFloat(value) : 0),
    },
  })
  deposit_amount!: number;

  @Column('decimal', {
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value ? parseFloat(value) : 0),
    },
  })
  total_amount!: number;

  /**
   * Jumlah cicilan pembayaran tagihan (1, 2, atau 4 kali).
   */
  @Column('int', { default: 1 })
  payment_terms!: number;

  /**
   * Admin fee join (biaya admin saat akun pertama kali melakukan sewa).
   * Otomatis dihitung berdasarkan jenis mobil: Reguler Rp 500.000, Premium Rp 700.000.
   */
  @Column('decimal', {
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value ? parseFloat(value) : 0),
    },
  })
  fee_admin_join!: number;

  @Column('varchar', { length: 500 })
  notes!: string;

  @Column('varchar', { length: 100 })
  payer!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({
    type: 'enum',
    enum: ['paid', 'unpaid', 'pending'],
    default: 'pending',
  })
  finance_type!: string;

  @Column({ type: 'varchar', length: 50, default: 'unpaid' })
  status!: string;

  @ManyToMany(() => Rental, (rental) => rental.finances)
  @JoinTable({
    name: 'finance_rentals',
    joinColumn: { name: 'finance_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'rental_id', referencedColumnName: 'id' },
  })
  rentals!: Rental[];

  @OneToMany(() => FinancePayment, (payment) => payment.finance, {
    cascade: true,
  })
  payments!: FinancePayment[];

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
