import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

@Entity('rentals')
export class Rental {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  rental_number!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver)
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({ type: 'uuid' })
  vehicle_id!: string;

  @ManyToOne(() => Vehicle)
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

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  deposit_amount!: number;

  @Column({
    type: 'enum',
    enum: ['Bank', 'Cash', 'E Wallet'],
  })
  method_payment!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  document_contract!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_daily_rate!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  security_deposit!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  service_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_revenue!: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;

  @BeforeInsert()
  generateRentalNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    this.rental_number = `RENT/${year}/${month}/${random}`;
  }
}
