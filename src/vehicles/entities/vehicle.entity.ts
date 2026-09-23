import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { VendorVehicle } from '../../vendor-vehicle/entities/vendor-vehicle.entity';
import { GpsTracking } from '../../monitoring/entities/gps-tracking.entity';
import { Rental } from '../../rentals/entities/rental.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'simple-json', nullable: true })
  vehicle_photo!: string[];

  @Column({ type: 'varchar', length: 100 })
  merk!: string;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @Column({ type: 'date' })
  launching_year!: Date;

  @Column({ type: 'varchar', length: 50 })
  license_plate!: string;

  @Column({ type: 'varchar', length: 50 })
  vin_number!: string;

  @Column({ type: 'varchar', length: 100 })
  color!: string;

  @Column({
    type: 'enum',
    enum: [
      'Available',
      'Maintenance',
      'Service',
      'Reserved',
      'rented',
      'retrieved',
    ],
    default: 'Available',
  })
  status!: string;

  @Column({ type: 'varchar', length: 50 })
  engine_number!: string;

  @Column({
    type: 'enum',
    enum: ['on', 'off'],
    default: 'off',
  })
  engine_status!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  daily_rate!: number;

  @Column({
    type: 'enum',
    enum: ['Reguler', 'Premium'],
    default: 'Reguler',
  })
  pricing_category!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'uuid', nullable: true })
  vendor_id!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  imei!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_name!: string;

  @ManyToOne(() => VendorVehicle, (vendor) => vendor.vehicles, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor!: VendorVehicle;

  @OneToMany(() => GpsTracking, (tracking) => tracking.vehicle)
  trackings!: GpsTracking[];

  @OneToMany(() => Rental, (rental) => rental.vehicle)
  rentals!: Rental[];

  //default
  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
