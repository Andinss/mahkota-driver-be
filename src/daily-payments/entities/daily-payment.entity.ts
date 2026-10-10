import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Rental } from '../../rentals/entities/rental.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';
import { MethodPayment } from '../../method-payment/entities/method-payment.entity';

@Entity('daily_payments')
export class DailyPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  rental_id!: string;

  @ManyToOne(() => Rental, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rental_id' })
  rental!: Rental;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({ type: 'uuid' })
  vehicle_id!: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @Column({ type: 'date' })
  payment_date!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 50, default: 'unpaid' })
  status!: string;

  /** cash | transfer | e-wallet | saldo — metode yang dipilih driver. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method!: string | null;

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

  /** ID transaksi/kode hasil transfer (dari mutasi bank/e-wallet driver). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  transaction_id!: string | null;

  /** Catatan dari driver saat konfirmasi pembayaran (terpisah dari notes tagihan). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  payment_notes!: string | null;

  /** Alasan penolakan pembayaran oleh admin (status `rejected`). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  rejection_reason!: string | null;

  /** Tanggal driver melakukan pembayaran (diisi driver). */
  @Column({ type: 'date', nullable: true })
  paid_date!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference_number!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
