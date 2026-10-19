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
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

@Entity('out_of_town_requests')
export class OutOfTownRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({ type: 'varchar', length: 100 })
  driver_name!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  driver_phone!: string;

  /** Kendaraan yang dipakai untuk perjalanan luar kota. */
  @Column({ type: 'uuid', nullable: true })
  vehicle_id!: string | null;

  @ManyToOne(() => Vehicle, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  vehicle_name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vehicle_plate!: string;

  @Column({ type: 'varchar', length: 120 })
  destination!: string;

  @Column({ type: 'date' })
  departure_date!: Date;

  @Column({ type: 'date' })
  return_date!: Date;

  @Column({ type: 'text' })
  reason!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status!: string;

  @Column({ type: 'text', nullable: true })
  admin_note!: string | null;

  /** User yang menyetujui/menolak pengajuan (jejak audit). */
  @Column({ type: 'uuid', nullable: true })
  reviewed_by!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
