import { EntityManager } from 'typeorm';
import { Rental } from './entities/rental.entity';

// Prefix nomor rental per bulan, contoh: RENT/2026/10/
export const rentalNumberPrefix = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `RENT/${year}/${month}/`;
};

export const formatRentalNumber = (prefix: string, seq: number): string =>
  `${prefix}${String(seq).padStart(4, '0')}`;

// Nomor rental berikutnya untuk bulan berjalan: 0001, 0002, 0003, ...
// Nomor yang sudah terpakai dilewati sehingga tidak melanggar unique
// constraint walaupun masih ada data lama dengan nomor acak.
export const nextRentalNumber = async (
  manager: EntityManager,
  date: Date = new Date(),
): Promise<string> => {
  const prefix = rentalNumberPrefix(date);

  const rows = await manager
    .createQueryBuilder(Rental, 'r')
    .select('r.rental_number', 'rental_number')
    .where('r.rental_number LIKE :prefix', { prefix: `${prefix}%` })
    .getRawMany<{ rental_number: string }>();

  const used = new Set<number>();
  for (const row of rows) {
    const seq = Number.parseInt(
      (row.rental_number.split('/').pop() ?? '').trim(),
      10,
    );
    if (Number.isFinite(seq)) used.add(seq);
  }

  let seq = 1;
  while (used.has(seq)) seq += 1;

  return formatRentalNumber(prefix, seq);
};
