import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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
    enum: ['Available', 'Maintenance', 'Service', 'Reserved', 'rented', 'retrieved'],
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

  //default
  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
