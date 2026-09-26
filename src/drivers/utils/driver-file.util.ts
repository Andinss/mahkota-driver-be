export type DriverFileField =
  | 'national_id_card'
  | 'sim_card'
  | 'profile_photo'
  | 'garage_photo'
  | 'kartu_keluarga'
  | 'npwp_photo';

const DRIVER_FILE_FOLDERS: Record<DriverFileField, string> = {
  national_id_card: 'image/driver/ktp',
  sim_card: 'image/driver/sim',
  profile_photo: 'image/driver/photo-driver',
  garage_photo: 'image/driver/garage-photo',
  kartu_keluarga: 'image/driver/kartu-keluarga',
  npwp_photo: 'image/driver/npwp',
};

export function resolveDriverFileField(originalname: string): DriverFileField {
  const name = originalname.toLowerCase();
  const nameWithoutExt = name.replace(/\.[^.]+$/, '');

  if (
    nameWithoutExt.includes('keluarga') ||
    /(^|[-_.])kk($|[-_.])/.test(nameWithoutExt)
  ) {
    return 'kartu_keluarga';
  }
  if (name.includes('ktp')) {
    return 'national_id_card';
  }
  if (name.includes('sim')) {
    return 'sim_card';
  }
  if (name.includes('foto') || name.includes('profil')) {
    return 'profile_photo';
  }
  if (name.includes('rumah')) {
    return 'garage_photo';
  }
  return 'npwp_photo';
}

export function resolveDriverFileFolder(originalname: string): string {
  return DRIVER_FILE_FOLDERS[resolveDriverFileField(originalname)];
}
