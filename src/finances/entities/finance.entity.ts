import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { Rental } from '../../rentals/entities/rental.entity';

@Entity('finances')
export class Finance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'date' })
  payment_date!: Date;

  @Column({ unique: true })
  reference_number!: string;

  @Column({
    type: 'enum',
    enum: ['cash', 'transfer', 'e-wallet'],
    nullable: false,
  })
  payment_method!: string;

  @Column('decimal', { precision: 14, scale: 2, transformer: { to: (value: number) => value, from: (value: string | null) => value ? parseFloat(value) : 0 } })
  amount_received!: number;

  @Column('varchar', { length: 500 })
  notes!: string;

  @Column('varchar', { length: 100 })
  payer!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver)
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({
    type: 'enum',
    enum: ['manual', 'rental', 'late_payment'],
    default: 'manual',
  })
  finance_type!: string;

  @ManyToMany(() => Rental, (rental) => rental.finances)
  @JoinTable({
    name: 'finance_rentals',
    joinColumn: { name: 'finance_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'rental_id', referencedColumnName: 'id' },
  })
  rentals!: Rental[];

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}