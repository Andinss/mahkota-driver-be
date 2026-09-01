import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { DriverSaldo } from './driver-saldo.entity';

@Entity('saldo_transactions')
export class SaldoTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({ type: 'uuid', nullable: true })
  driver_saldo_id!: string;

  @ManyToOne(() => DriverSaldo, (saldo) => saldo.transactions)
  @JoinColumn({ name: 'driver_saldo_id' })
  driver_saldo!: DriverSaldo;

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

  @Column({ type: 'text', nullable: true })
  notes!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}
