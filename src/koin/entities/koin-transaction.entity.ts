import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { DriverKoin } from './driver-koin.entity';

@Entity('saldo_transactions')
export class KoinTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({ type: 'uuid', nullable: true })
  driver_saldo_id!: string;

  @ManyToOne(() => DriverKoin, (koin) => koin.transactions)
  @JoinColumn({ name: 'driver_saldo_id' })
  driver_saldo!: DriverKoin;

  @Column({
    type: 'enum',
    enum: ['top_up', 'rental_payment', 'refund', 'withdrawal'],
  })
  type!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  balance_before!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  balance_after!: number;

  @Column({ type: 'uuid', nullable: true })
  reference_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference_number!: string;

  /**
   * Alasan transaksi koin, mis. "Sebagai Reward capai target Juni".
   * Wajib diisi saat admin top up, supaya driver tahu kenapa koinnya
   * ditambahkan. Kolom lama (sebelum fitur ini) berisi NULL.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  /** Keterangan tambahan / detail (mis. "Reward 20 unit bulan Juni"). */
  @Column({ type: 'text', nullable: true })
  notes!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}
