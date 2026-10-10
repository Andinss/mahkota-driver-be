import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';
import { Finance } from '../../finances/entities/finance.entity';
import { LatePayment } from '../../late-payments/entities/late-payment.entity';

@Entity('rentals')
export class Rental {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  rental_number!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({ type: 'uuid' })
  vehicle_id!: string;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.rentals)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @Column({ type: 'date' })
  start_date!: Date;

  @Column({ type: 'date' })
  end_date!: Date;

  @Column({ type: 'int' })
  total_duration!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  daily_rate!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  document_contract!: string;

  @Column({
    type: 'enum',
    enum: ['harian', 'mingguan', 'bulanan', 'tahunan'],
  })
  rental_duration!: string;

  @Column({
    type: 'enum',
    enum: ['lepas kunci', 'pakai supir'],
  })
  rental_service!: string;

  // Status siklus hidup rental. 'active' = kontrak masih berjalan normal
  // (dihitung juga dari rentang tanggal), 'stopped' = dihentikan manual
  // sebelum tanggal akhir sehingga tidak lagi generates tagihan harian.
  @Column({
    type: 'enum',
    enum: ['active', 'stopped'],
    default: 'active',
  })
  status!: string;

  @Column({ type: 'timestamp', nullable: true })
  stopped_at!: Date | null;

  @ManyToMany(() => Finance, (finance) => finance.rentals)
  finances!: Finance[];

  @ManyToMany(() => LatePayment, (latePayment) => latePayment.rentals)
  late_payments!: LatePayment[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;

  // Nomor urut (RENT/tahun/bulan/0001) dihitung di service sebelum insert
  // karena butuh akses ke database. Hook ini hanya pengaman jika ada jalur
  // insert yang belum mengisi nomornya.
  @BeforeInsert()
  generateRentalNumber() {
    if (this.rental_number) return;
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    this.rental_number = `RENT/${year}/${month}/0001`;
  }
}
