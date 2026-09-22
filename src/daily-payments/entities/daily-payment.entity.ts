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

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference_number!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
