import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

@Entity('vendor_vehicles')
export class VendorVehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 150 })
  owner_name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  pendapatan!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  harga_pokok!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  harga_jual!: number;

  @Column({ type: 'int', default: 0 })
  total_kendaraan!: number;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status!: string;

  @OneToMany(() => Vehicle, (vehicle) => vehicle.vendor)
  vehicles!: Vehicle[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
