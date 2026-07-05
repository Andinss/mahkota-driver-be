import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

@Entity('gps_locations')
export class GpsLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  vehicle_id!: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  speed!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  fuel_level!: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'idle',
  })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  recorded_at!: Date;
}
