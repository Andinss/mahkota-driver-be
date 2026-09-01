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

@Entity('late_payments')
export class LatePayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @Column({ type: 'varchar', length: 100, nullable: true })
  driver_name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vehicle!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  plate!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'date' })
  due_date!: Date;

  @Column({ type: 'date' })
  payment_date!: Date;

  @Column({ type: 'text' })
  justification!: string;

  @Column({ type: 'text', nullable: true })
  justification_reason!: string;

  @Column({ type: 'text', nullable: true })
  message!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proof_image!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  driver_image!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status!: string;

  @Column({ type: 'text', nullable: true })
  admin_note!: string;

  @ManyToMany(() => Rental, (rental) => rental.late_payments)
  @JoinTable({
    name: 'late_payment_rentals',
    joinColumn: { name: 'late_payment_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'rental_id', referencedColumnName: 'id' },
  })
  rentals!: Rental[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
