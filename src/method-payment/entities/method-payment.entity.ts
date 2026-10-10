import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MethodPaymentMethod = 'bank' | 'qris' | 'e_wallet';

@Entity('method_payments')
export class MethodPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({
    type: 'enum',
    enum: ['bank', 'qris', 'e_wallet'],
    default: 'bank',
  })
  method!: MethodPaymentMethod;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  /** Nama bank / nama e-wallet. Kosong untuk QRIS. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  provider!: string | null;

  /** Nomor rekening / nomor e-wallet. Kosong untuk QRIS. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  account_number!: string | null;

  /** Atas nama pemilik. Kosong untuk QRIS. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  account_holder!: string | null;

  /** Gambar QRIS (path atau data-URL). Hanya untuk method === 'qris'. */
  @Column({ type: 'text', nullable: true })
  image_url!: string | null;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'bool', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
