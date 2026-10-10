import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import type { FileFilterCallback, StorageEngine } from 'multer';
import type { Request } from 'express';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';

const PROOF_FOLDER = 'image/payment-proofs/';

/** Bentuk data user di `req.user` (diisi JwtStrategy, berisi relasi driver). */
interface ProofUploadRequestUser extends Request {
  user?: {
    driver?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  };
}

/** Nama file ala vendor-vehicle: huruf kecil, spasi -> `-`. */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Nama file bukti = `<nama-driver>-<id-transaksi>.<ext>`
 * (mis. `budi-santoso-TRX827193.png`). ID transaksi diambil dari body
 * (FormData mengirim field teks sebelum file), nama driver dari `req.user`
 * (guard JWT berjalan sebelum interceptor). Bila id transaksi kosong,
 * pakai timestamp; bila nama sudah dipakai, tambah suffix `-2`, `-3`, ...
 */
const buildProofFilename = (
  req: Request,
  file: Express.Multer.File,
): string => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const pickText = (...keys: string[]): string => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  };

  const rawTransactionId = pickText('transaction_id', 'reference_number');
  const driver = (req as ProofUploadRequestUser).user?.driver;
  const nameSlug =
    slugify(`${driver?.first_name ?? ''} ${driver?.last_name ?? ''}`.trim()) ||
    'driver';
  const transactionSlug = slugify(rawTransactionId);

  const ext = extname(file.originalname);
  const base = transactionSlug
    ? `${nameSlug}-${transactionSlug}`
    : `${nameSlug}-${Date.now()}`;

  let filename = `${base}${ext}`;
  for (let counter = 2; existsSync(join(PROOF_FOLDER, filename)); counter++) {
    filename = `${base}-${counter}${ext}`;
  }
  return filename;
};

/**
 * Konfigurasi multer untuk upload bukti bayar driver.
 * File disimpan ke `image/payment-proofs/` (pola vendor-vehicle),
 * diakses lewat static serve `main.ts` -> `/image/payment-proofs/...`.
 */
const storage: StorageEngine = diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, destination: string) => void,
  ) => {
    if (!existsSync(PROOF_FOLDER)) {
      mkdirSync(PROOF_FOLDER, { recursive: true });
    }
    callback(null, PROOF_FOLDER);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void,
  ) => {
    callback(null, buildProofFilename(req, file));
  },
});

export const proofImageUpload = {
  storage,
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    callback: FileFilterCallback,
  ) => {
    const allowedMimes = /jpg|jpeg|png|webp|svg/;
    const ext = extname(file.originalname).toLowerCase();
    if (allowedMimes.test(ext)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          'Only image files are allowed! (jpg, jpeg, png, webp, svg)',
        ),
      );
    }
  },
  limits: {
    // Screenshot bukti transfer dari HP bisa besar-besar.
    fileSize: 5 * 1024 * 1024,
  },
};

/** Path file hasil multer pakai `\` di Windows — samakan jadi `/`. */
export const toStoredPath = (file: Express.Multer.File): string =>
  file.path.replace(/\\/g, '/');

/** Hapus file bukti dari disk (aman dipanggil berkali-kali). */
export const removeStoredFile = (path?: string | null): void => {
  if (!path) return;
  // Lewati data-URL base64 lama / URL absolut.
  if (path.startsWith('data:') || path.startsWith('http')) return;

  try {
    const fullPath = path.startsWith('/') ? path : `./${path}`;
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`Failed to delete file ${path}:`, err);
  }
};
