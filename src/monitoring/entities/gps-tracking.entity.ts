import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

@Entity('gps_tracking')
export class GpsTracking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  VehicleId!: string | null;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.trackings, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'VehicleId', referencedColumnName: 'imei' })
  vehicle?: Vehicle | null;

  @Column({ type: 'varchar', default: '' })
  VehicleNumber!: string;

  @Column({ type: 'varchar', default: '' })
  DatetimeUTC!: string;

  @Column({ type: 'varchar', default: '' })
  GpsLocation!: string;

  @Column({ type: 'varchar', default: '' })
  Lon!: string;

  @Column({ type: 'varchar', default: '' })
  Lat!: string;

  @Column({ type: 'varchar', default: '' })
  Speed!: string;

  @Column({ type: 'varchar', default: '' })
  Direction!: string;

  @Column({ type: 'varchar', default: '' })
  Engine!: string;

  @Column({ type: 'varchar', default: '' })
  Odometer!: string;

  @Column({ type: 'varchar', default: '' })
  Car_Status!: string;

  @Column({ type: 'varchar', default: '' })
  VehicleType!: string;

  @Column({ type: 'varchar', default: '' })
  Alarm!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}
