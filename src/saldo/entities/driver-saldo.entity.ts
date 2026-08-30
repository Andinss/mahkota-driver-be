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
import { Driver } from '../../drivers/entities/driver.entity';
import { SaldoTransaction } from './saldo-transaction.entity';

@Entity('driver_saldo')
export class DriverSaldo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  driver_id!: string;

  @ManyToOne(() => Driver)
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  balance!: number;

  @OneToMany(() => SaldoTransaction, (tx) => tx.driver_saldo)
  transactions!: SaldoTransaction[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
