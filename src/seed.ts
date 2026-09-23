import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { Role } from './roles/entities/role.entity';
import { Permission } from './permissions/entities/permission.entity';
import { Vehicle } from './vehicles/entities/vehicle.entity';
import { Driver } from './drivers/entities/driver.entity';
import { LatePayment } from './late-payments/entities/late-payment.entity';
import { GpsTracking } from './monitoring/entities/gps-tracking.entity';
import { Setting } from './settings/entities/setting.entity';
import { AuditLog } from './audit/entities/audit-log.entity';
import { DriverKoin } from './koin/entities/driver-koin.entity';
import { KoinTransaction } from './koin/entities/koin-transaction.entity';
import { VendorVehicle } from './vendor-vehicle/entities/vendor-vehicle.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

// ─── Permissions ──────────────────────────────────────────────
const modulePermissions: Record<string, string[]> = {
  user: ['create', 'read', 'update', 'delete', 'activate', 'manage_role'],
  role: ['create', 'read', 'update', 'delete', 'assign_permissions'],
  permission: ['create', 'read', 'update', 'delete'],
  driver: [
    'create',
    'read.all',
    'read.own',
    'update.all',
    'update.own',
    'delete.all',
    'delete.own',
    'assign_vehicle',
  ],
  vehicle: ['create', 'read', 'update', 'delete', 'change_status'],
  rental: ['create', 'read', 'update', 'delete', 'approve', 'reject'],
  finance: ['create', 'read', 'update', 'delete', 'approve'],
  late_payment: ['read', 'approve'],
  monitoring: ['read', 'read.all', 'update'],
  koin: ['read', 'top_up', 'deduct', 'refund'],
  setting: ['create', 'read', 'update', 'delete'],
  audit: ['read'],
  vendor: ['create', 'read', 'update', 'delete'],
  driver_portal: ['dashboard', 'payment', 'profile'],
};

const allPermissionNames: string[] = [];
for (const [mod, actions] of Object.entries(modulePermissions)) {
  for (const action of actions) {
    allPermissionNames.push(`${mod}.${action}`);
  }
}

// ─── Roles ────────────────────────────────────────────────────
interface RoleSeed {
  name: string;
  code: string;
  description: string;
  permissionFilter: (name: string) => boolean;
}

const rolesData: RoleSeed[] = [
  {
    name: 'Administrator',
    code: 'ADMIN',
    description: 'Full system access',
    permissionFilter: () => true,
  },
  {
    name: 'Supervisor',
    code: 'SUPERVISOR',
    description: 'Supervisor - manage own drivers (max 10)',
    permissionFilter: (name) => {
      const perms = [
        'driver.create',
        'driver.read.own',
        'driver.update.own',
        'driver.delete.own',
        'driver.assign_vehicle',
        'vehicle.read',
        'rental.read',
        'rental.create',
        'koin.read',
        'koin.top_up',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Finance',
    code: 'FINANCE',
    description: 'Finance department access',
    permissionFilter: (name) => {
      const perms = [
        'finance.create',
        'finance.read',
        'finance.update',
        'finance.approve',
        'rental.read',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Field Officer',
    code: 'FIELD_OFFICER',
    description: 'Field operations access',
    permissionFilter: (name) => {
      const perms = [
        'driver.read.all',
        'driver.assign_vehicle',
        'vehicle.read',
        'rental.read',
        'monitoring.read',
        'monitoring.read.all',
        'monitoring.update',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Driver',
    code: 'DRIVER',
    description: 'Driver - access payment and profile',
    permissionFilter: (name) => {
      const perms = [
        'driver.read.all',
        'finance.read',
        'finance.create',
        'koin.read',
        'koin.top_up',
        'driver_portal.dashboard',
        'driver_portal.payment',
        'driver_portal.profile',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Owner',
    code: 'OWNER',
    description: 'Business owner - read-only reports',
    permissionFilter: (name) => {
      const perms = [
        'driver.read.all',
        'vehicle.read',
        'rental.read',
        'finance.read',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Operator',
    code: 'OPERATOR',
    description: 'System operator - basic read access',
    permissionFilter: (name) => {
      const perms = ['driver.read.all', 'vehicle.read', 'rental.read'];
      return perms.includes(name);
    },
  },
];

// ─── Vehicles ─────────────────────────────────────────────────
const vehiclesData = [
  {
    merk: 'Toyota',
    model: 'Avanza',
    launching_year: new Date('2022-01-15'),
    license_plate: 'B 1234 ABC',
    vin_number: 'MHFX1234567890123',
    color: 'Silver',
    status: 'rented',
    engine_number: 'EN-TOYOTA-001',
    engine_status: 'on',
    daily_rate: 350000,
    pricing_category: 'Reguler',
    vendor_name: 'CV Armada Jaya',
    imei: '123456789012345',
    device_name: 'GPS Tracker 001',
  },
  {
    merk: 'Honda',
    model: 'Brio',
    launching_year: new Date('2023-03-20'),
    license_plate: 'B 5678 DEF',
    vin_number: 'MHFX9876543210987',
    color: 'Red',
    status: 'rented',
    engine_number: 'EN-HONDA-001',
    engine_status: 'off',
    daily_rate: 300000,
    pricing_category: 'Reguler',
    vendor_name: 'CV Armada Jaya',
  },
  {
    merk: 'Toyota',
    model: 'Innova',
    launching_year: new Date('2021-06-10'),
    license_plate: 'B 9012 GHI',
    vin_number: 'MHFX4567890123456',
    color: 'Black',
    status: 'Available',
    engine_number: 'EN-TOYOTA-002',
    engine_status: 'off',
    daily_rate: 500000,
    pricing_category: 'Premium',
    vendor_name: 'CV Armada Jaya',
  },
  {
    merk: 'Daihatsu',
    model: 'Xenia',
    launching_year: new Date('2023-08-05'),
    license_plate: 'B 3456 JKL',
    vin_number: 'MHFX1122334455667',
    color: 'White',
    status: 'rented',
    engine_number: 'EN-DAIHATSU-001',
    engine_status: 'on',
    daily_rate: 280000,
    pricing_category: 'Reguler',
    vendor_name: 'PT Sejahtera Rent',
  },
  {
    merk: 'Mitsubishi',
    model: 'Xpander',
    launching_year: new Date('2023-05-15'),
    license_plate: 'B 2345 PQR',
    vin_number: 'MHFX3344556677889',
    color: 'Grey',
    status: 'Available',
    engine_number: 'EN-MITSUBISHI-001',
    engine_status: 'off',
    daily_rate: 400000,
    pricing_category: 'Premium',
    vendor_name: 'PT Sejahtera Rent',
  },
];

// ─── Drivers ──────────────────────────────────────────────────
const driversData = [
  {
    first_name: 'Budi',
    last_name: 'Santoso',
    date_of_birth: new Date('1990-05-15'),
    gender: 'Male',
    employee_id: 'DRV-001',
    phone: '081234567890',
    email: 'budi.santoso@example.com',
    emergency_contact: '081234567891',
    emergency_email: 'emergency.budi@example.com',
    house_type: 'Owned',
    permanent_address: 'Jl. Sudirman No. 10, Jakarta Selatan',
    citizenship: 'Indonesian (WNI)',
    province: '31',
    province_name: 'DKI Jakarta',
    city: '3171',
    city_name: 'Kota Jakarta Selatan',
    district: '3171060',
    district_name: 'Kebayoran Baru',
    subdistrict: '3171060001',
    subdistrict_name: 'Gandaria Utara',
    ready_sign_contract: true,
    willing_to_be_survey: true,
  },
  {
    first_name: 'Andi',
    last_name: 'Pratama',
    date_of_birth: new Date('1988-08-22'),
    gender: 'Male',
    employee_id: 'DRV-002',
    phone: '081234567892',
    email: 'andi.pratama@example.com',
    emergency_contact: '081234567893',
    emergency_email: 'emergency.andi@example.com',
    house_type: 'Rented',
    permanent_address: 'Jl. Gatot Subroto No. 25, Jakarta Pusat',
    citizenship: 'Indonesian (WNI)',
    province: '31',
    province_name: 'DKI Jakarta',
    city: '3173',
    city_name: 'Kota Jakarta Pusat',
    district: '3173020',
    district_name: 'Menteng',
    subdistrict: '3173020004',
    subdistrict_name: 'Gondangdia',
    ready_sign_contract: true,
    willing_to_be_survey: true,
  },
  {
    first_name: 'Siti',
    last_name: 'Rahayu',
    date_of_birth: new Date('1995-02-10'),
    gender: 'Female',
    employee_id: 'DRV-003',
    phone: '081234567894',
    email: 'siti.rahayu@example.com',
    emergency_contact: '081234567895',
    emergency_email: 'emergency.siti@example.com',
    house_type: 'Owned',
    permanent_address: 'Jl. Thamrin No. 30, Jakarta Pusat',
    citizenship: 'Indonesian (WNI)',
    province: '31',
    province_name: 'DKI Jakarta',
    city: '3173',
    city_name: 'Kota Jakarta Pusat',
    district: '3173030',
    district_name: 'Senen',
    subdistrict: '3173030003',
    subdistrict_name: 'Kramat',
    ready_sign_contract: true,
    willing_to_be_survey: true,
  },
  {
    first_name: 'Dedi',
    last_name: 'Kurniawan',
    date_of_birth: new Date('1992-11-30'),
    gender: 'Male',
    employee_id: 'DRV-004',
    phone: '081234567896',
    email: 'dedi.kurniawan@example.com',
    emergency_contact: '081234567897',
    emergency_email: 'emergency.dedi@example.com',
    house_type: 'Rented',
    permanent_address: 'Jl. Kuningan No. 15, Jakarta Selatan',
    citizenship: 'Indonesian (WNI)',
    province: '31',
    province_name: 'DKI Jakarta',
    city: '3171',
    city_name: 'Kota Jakarta Selatan',
    district: '3171090',
    district_name: 'Tebet',
    subdistrict: '3171090004',
    subdistrict_name: 'Kebon Baru',
    ready_sign_contract: true,
    willing_to_be_survey: false,
  },
  {
    first_name: 'Rina',
    last_name: 'Wulandari',
    date_of_birth: new Date('1993-07-18'),
    gender: 'Female',
    employee_id: 'DRV-005',
    phone: '081234567898',
    email: 'rina.wulandari@example.com',
    emergency_contact: '081234567899',
    emergency_email: 'emergency.rina@example.com',
    house_type: 'Owned',
    permanent_address: 'Jl. Kemang No. 8, Jakarta Selatan',
    citizenship: 'Indonesian (WNI)',
    province: '31',
    province_name: 'DKI Jakarta',
    city: '3171',
    city_name: 'Kota Jakarta Selatan',
    district: '3171060',
    district_name: 'Kebayoran Baru',
    subdistrict: '3171060004',
    subdistrict_name: 'Petogogan',
    ready_sign_contract: true,
    willing_to_be_survey: true,
  },
];

// ─── Settings ─────────────────────────────────────────────────
const settingsData = [
  {
    key: 'company_name',
    value: 'Mahkota Rental',
    category: 'general',
    description: 'Company name',
  },
  {
    key: 'company_email',
    value: 'info@mahkotarental.com',
    category: 'general',
    description: 'Company contact email',
  },
  {
    key: 'company_phone',
    value: '+62 21 5555 0123',
    category: 'general',
    description: 'Company phone number',
  },
  {
    key: 'currency',
    value: 'IDR',
    category: 'finance',
    description: 'Default currency',
  },
  {
    key: 'tax_rate',
    value: '11',
    category: 'finance',
    description: 'Tax rate percentage',
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const roleRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
  const permissionRepository = app.get<Repository<Permission>>(
    getRepositoryToken(Permission),
  );
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
  const vehicleRepository = app.get<Repository<Vehicle>>(
    getRepositoryToken(Vehicle),
  );
  const driverRepository = app.get<Repository<Driver>>(
    getRepositoryToken(Driver),
  );
  const latePaymentRepository = app.get<Repository<LatePayment>>(
    getRepositoryToken(LatePayment),
  );
  const trackingRepository = app.get<Repository<GpsTracking>>(
    getRepositoryToken(GpsTracking),
  );
  const settingRepository = app.get<Repository<Setting>>(
    getRepositoryToken(Setting),
  );
  const auditRepository = app.get<Repository<AuditLog>>(
    getRepositoryToken(AuditLog),
  );
  const driverKoinRepository = app.get<Repository<DriverKoin>>(
    getRepositoryToken(DriverKoin),
  );
  const koinTransactionRepository = app.get<Repository<KoinTransaction>>(
    getRepositoryToken(KoinTransaction),
  );
  const vendorVehicleRepository = app.get<Repository<VendorVehicle>>(
    getRepositoryToken(VendorVehicle),
  );

  // ═══════════════════════════════════════════════════════════
  // 1. SEED PERMISSIONS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Permissions ──');
  const existingPermissions = await permissionRepository.find();
  const existingNames = existingPermissions.map((p) => p.name);
  const newPermissions: Permission[] = [];

  for (const permName of allPermissionNames) {
    if (!existingNames.includes(permName)) {
      const [module] = permName.split('.');
      const permission = permissionRepository.create({
        name: permName,
        module,
      });
      newPermissions.push(permission);
    }
  }

  if (newPermissions.length > 0) {
    await permissionRepository.save(newPermissions);
    console.log(`  Created ${newPermissions.length} permissions`);
  } else {
    console.log('  All permissions already exist');
  }

  const allPermissions = await permissionRepository.find();

  // ═══════════════════════════════════════════════════════════
  // 2. SEED ROLES
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Roles ──');
  for (const roleData of rolesData) {
    let role = await roleRepository.findOne({
      where: [{ code: roleData.code }, { name: roleData.name }],
      relations: { permissions: true },
    });

    if (role) {
      role.permissions = allPermissions.filter((p) =>
        roleData.permissionFilter(p.name),
      );
      await roleRepository.save(role);
      console.log(`  Updated role: ${roleData.code}`);
      continue;
    }

    try {
      role = roleRepository.create({
        name: roleData.name,
        code: roleData.code,
        description: roleData.description,
      });
      role = await roleRepository.save(role);
      console.log(`  Created role: ${roleData.code}`);
    } catch (err: any) {
      if (err.code === '23505') {
        console.log(`  Role already exists: ${roleData.code} (skipped)`);
        continue;
      }
      throw err;
    }

    role.permissions = allPermissions.filter((p) =>
      roleData.permissionFilter(p.name),
    );
    await roleRepository.save(role);
    console.log(`  Assigned permissions to ${roleData.code}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 3. SEED USERS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Users ──');
  const usersData = [
    {
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',
      roleCode: 'ADMIN',
    },
    {
      username: 'supervisor1',
      email: 'supervisor1@example.com',
      password: 'super123',
      roleCode: 'SUPERVISOR',
    },
    {
      username: 'finance1',
      email: 'finance1@example.com',
      password: 'finance123',
      roleCode: 'FINANCE',
    },
    {
      username: 'field1',
      email: 'field1@example.com',
      password: 'field123',
      roleCode: 'FIELD_OFFICER',
    },
    {
      username: 'owner1',
      email: 'owner1@example.com',
      password: 'owner123',
      roleCode: 'OWNER',
    },
    {
      username: 'driver1',
      email: 'driver1@example.com',
      password: 'driver123',
      roleCode: 'DRIVER',
      driverIndex: 0,
    },
    {
      username: 'driver2',
      email: 'driver2@example.com',
      password: 'driver123',
      roleCode: 'DRIVER',
      driverIndex: 1,
    },
  ];

  const createdUsers: User[] = [];
  const driverUserMap: { userIndex: number; driverIndex: number }[] = [];
  for (let i = 0; i < usersData.length; i++) {
    const userData = usersData[i];
    const existing = await userRepository.findOne({
      where: [{ username: userData.username }, { email: userData.email }],
    });
    if (existing) {
      console.log(`  User already exists: ${userData.username}`);
      createdUsers.push(existing);
      if (
        'driverIndex' in userData &&
        typeof (userData as any).driverIndex === 'number'
      ) {
        driverUserMap.push({
          userIndex: i,
          driverIndex: (userData as any).driverIndex,
        });
      }
      continue;
    }

    const role = await roleRepository.findOne({
      where: { code: userData.roleCode },
    });
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = userRepository.create({
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      role_id: role?.id,
      is_active: true,
    });
    const saved = await userRepository.save(user);
    createdUsers.push(saved);
    if (
      'driverIndex' in userData &&
      typeof (userData as any).driverIndex === 'number'
    ) {
      driverUserMap.push({
        userIndex: i,
        driverIndex: (userData as any).driverIndex,
      });
    }
    console.log(`  Created user: ${userData.username} (${userData.roleCode})`);
  }

  const adminUser = createdUsers[0];

  // ═══════════════════════════════════════════════════════════
  // 4. SEED VENDOR VEHICLES & VEHICLES
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Vendor Vehicles ──');
  const vendorsData = [
    {
      name: 'CV Armada Jaya',
      owner_name: 'Budi Santoso',
      status: 'active',
      logo: '',
    },
    {
      name: 'PT Sejahtera Rent',
      owner_name: 'Rina Wulandari',
      status: 'active',
      logo: '',
    },
    {
      name: 'UD Barokah Motor',
      owner_name: 'Andi Pratama',
      status: 'inactive',
      logo: '',
    },
  ];

  const createdVendors: VendorVehicle[] = [];
  for (const vData of vendorsData) {
    let vendor = await vendorVehicleRepository.findOne({
      where: { name: vData.name },
    });
    if (vendor) {
      console.log(`  Vendor already exists: ${vData.name}`);
      createdVendors.push(vendor);
      continue;
    }
    vendor = vendorVehicleRepository.create(vData);
    vendor = await vendorVehicleRepository.save(vendor);
    createdVendors.push(vendor);
    console.log(`  Created vendor: ${vData.name} (${vData.owner_name})`);
  }

  console.log('\n── Seeding Vehicles ──');
  const createdVehicles: Vehicle[] = [];
  for (const vData of vehiclesData) {
    const { vendor_name, ...vehicleFields } = vData;
    const vendorId = vendor_name
      ? createdVendors.find((v) => v.name === vendor_name)?.id
      : undefined;

    let vehicle = await vehicleRepository.findOne({
      where: { license_plate: vData.license_plate },
    });
    if (vehicle) {
      if (vehicle.vendor_id !== vendorId) {
        await vehicleRepository.update(vehicle.id, { vendor_id: vendorId });
        console.log(
          `  Updated vehicle vendor_id: ${vData.license_plate} → ${vendor_name || '-'}`,
        );
      }
      createdVehicles.push(vehicle);
      continue;
    }
    vehicle = vehicleRepository.create({
      ...vehicleFields,
      vendor_id: vendorId,
    });
    vehicle = await vehicleRepository.save(vehicle);
    createdVehicles.push(vehicle);
    console.log(
      `  Created vehicle: ${vData.license_plate} (${vData.merk} ${vData.model})`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 5. SEED DRIVERS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Drivers ──');
  const createdDrivers: Driver[] = [];
  for (const dData of driversData) {
    let driver = await driverRepository.findOne({
      where: { employee_id: dData.employee_id },
    });
    if (driver) {
      console.log(`  Driver already exists: ${dData.employee_id}`);
      createdDrivers.push(driver);
      continue;
    }
    driver = driverRepository.create({
      ...dData,
      created_by_id: adminUser?.id,
    });
    driver = await driverRepository.save(driver);
    createdDrivers.push(driver);
    console.log(
      `  Created driver: ${dData.employee_id} (${dData.first_name} ${dData.last_name})`,
    );
  }

  // Link driver users to their driver records
  console.log('\n── Linking Driver Users ──');
  for (const mapping of driverUserMap) {
    const user = createdUsers[mapping.userIndex];
    const driver = createdDrivers[mapping.driverIndex];
    if (user && driver && !user.driver_id) {
      await userRepository.update(user.id, { driver_id: driver.id });
      console.log(
        `  Linked user ${user.username} → driver ${driver.first_name} ${driver.last_name}`,
      );
    } else if (user?.driver_id) {
      console.log(`  User ${user.username} already linked to driver`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 6. SEED LATE PAYMENTS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Late Payments ──');
  const latePaymentsData = [
    {
      driver: createdDrivers[3],
      driver_name: 'Dedi Kurniawan',
      vehicle: 'Daihatsu Xenia',
      plate: 'B 3456 JKL',
      amount: 1500000,
      due_date: new Date('2026-08-25'),
      payment_date: new Date('2026-08-28'),
      justification: 'Terlambat bayar karena gaji belum cair',
      justification_reason: 'Salary delayed by employer',
      message: 'Mohon maaf keterlambatan, gaji akan cair tanggal 28',
      status: 'pending',
    },
    {
      driver: createdDrivers[2],
      driver_name: 'Siti Rahayu',
      vehicle: 'Toyota Innova',
      plate: 'B 9012 GHI',
      amount: 5000000,
      due_date: new Date('2026-08-15'),
      payment_date: new Date('2026-08-20'),
      justification: 'Menunggu transfer dari keluarga',
      justification_reason: 'Waiting for family transfer',
      message: 'Dana akan segera ditransfer',
      status: 'approved',
      admin_note: 'Disetujui dengan catatan pembayaran bertahap',
    },
  ];

  for (const lpData of latePaymentsData) {
    const existing = await latePaymentRepository.findOne({
      where: {
        driver_id: lpData.driver.id,
        due_date: lpData.due_date,
        amount: lpData.amount,
      },
    });
    if (existing) {
      console.log(
        `  Late payment already exists: ${existing.driver_name} Rp ${existing.amount.toLocaleString('id-ID')}`,
      );
      continue;
    }

    const latePayment = latePaymentRepository.create({
      driver_id: lpData.driver.id,
      driver_name: lpData.driver_name,
      vehicle: lpData.vehicle,
      plate: lpData.plate,
      amount: lpData.amount,
      due_date: lpData.due_date,
      payment_date: lpData.payment_date,
      justification: lpData.justification,
      justification_reason: lpData.justification_reason,
      message: lpData.message,
      status: lpData.status,
      admin_note: (lpData as any).admin_note || undefined,
    });
    await latePaymentRepository.save(latePayment);
    console.log(
      `  Created late payment: ${lpData.driver_name} Rp ${lpData.amount.toLocaleString('id-ID')} [${lpData.status}]`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 7. SEED GPS TRACKING (1 data saja)
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding GPS Tracking ──');
  const vehicle = createdVehicles[0];
  const gpsData = [
    {
      vehicle,
      id_imei: vehicle.imei || `imei-${vehicle.id}`,
      VehicleId: vehicle.id,
      VehicleNumber: vehicle.license_plate,
      DatetimeUTC: '2026-09-23 08:00:00',
      GpsLocation: 'Jakarta Selatan',
      Lon: '106.8456',
      Lat: '-6.2088',
      Speed: '45',
      Direction: '90',
      Engine: vehicle.engine_status || 'on',
      Odometer: '12500',
      Car_Status: 'moving',
      VehicleType: 'rental',
      Alarm: 'none',
    },
  ];

  const gData = gpsData[0];
  const existing = await trackingRepository.findOne({
    where: { VehicleId: gData.VehicleId },
  });
  if (existing) {
    console.log(`  GPS already exists: ${gData.VehicleNumber}`);
  } else {
    const gps = trackingRepository.create({
      id_imei: gData.id_imei,
      VehicleId: gData.VehicleId,
      VehicleNumber: gData.VehicleNumber,
      DatetimeUTC: gData.DatetimeUTC,
      GpsLocation: gData.GpsLocation,
      Lon: gData.Lon,
      Lat: gData.Lat,
      Speed: gData.Speed,
      Direction: gData.Direction,
      Engine: gData.Engine,
      Odometer: gData.Odometer,
      Car_Status: gData.Car_Status,
      VehicleType: gData.VehicleType,
      Alarm: gData.Alarm,
    });
    await trackingRepository.save(gps);

    await vehicleRepository.update(gData.VehicleId, {
      engine_status: gData.Engine,
    });

    console.log(
      `  GPS: ${gData.VehicleNumber} @ ${gData.Lat}, ${gData.Lon} [${gData.Car_Status}] engine=${gData.Engine}`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 8. SEED DRIVER KOIN
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Driver Koin ──');
  const koinData = [
    { driver: createdDrivers[0], balance: 5000000 },
    { driver: createdDrivers[1], balance: 3000000 },
    { driver: createdDrivers[2], balance: 7500000 },
    { driver: createdDrivers[3], balance: 500000 },
    { driver: createdDrivers[4], balance: 2000000 },
  ];

  const koinLedger: {
    driver: Driver;
    txType: 'top_up' | 'rental_payment' | 'refund';
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    referenceId?: string;
    notes: string;
  }[] = [
    {
      driver: createdDrivers[0],
      txType: 'top_up',
      amount: 5000000,
      balanceBefore: 0,
      balanceAfter: 5000000,
      notes: 'Initial balance seed',
    },
    {
      driver: createdDrivers[1],
      txType: 'top_up',
      amount: 3000000,
      balanceBefore: 0,
      balanceAfter: 3000000,
      notes: 'Initial balance seed',
    },
    {
      driver: createdDrivers[2],
      txType: 'top_up',
      amount: 7500000,
      balanceBefore: 0,
      balanceAfter: 7500000,
      notes: 'Initial balance seed',
    },
    {
      driver: createdDrivers[3],
      txType: 'refund',
      amount: 500000,
      balanceBefore: 0,
      balanceAfter: 500000,
      notes: 'Refund koin',
    },
    {
      driver: createdDrivers[4],
      txType: 'top_up',
      amount: 2000000,
      balanceBefore: 0,
      balanceAfter: 2000000,
      notes: 'Initial balance seed',
    },
  ];

  for (const sData of koinData) {
    let koin = await driverKoinRepository.findOne({
      where: { driver_id: sData.driver.id },
    });
    if (koin) {
      console.log(
        `  Koin already exists for driver: ${sData.driver.first_name}, resetting balance`,
      );
      koin.balance = sData.balance;
      await driverKoinRepository.save(koin);
    } else {
      koin = driverKoinRepository.create({
        driver_id: sData.driver.id,
        balance: sData.balance,
      });
      koin = await driverKoinRepository.save(koin);
      console.log(
        `  Created koin: ${sData.driver.first_name} Rp ${sData.balance.toLocaleString('id-ID')}`,
      );
    }
  }

  for (const tx of koinLedger) {
    const koin = await driverKoinRepository.findOne({
      where: { driver_id: tx.driver.id },
    });
    const existingTx = await koinTransactionRepository.findOne({
      where: {
        driver_id: tx.driver.id,
        driver_saldo_id: koin?.id || undefined,
        type: tx.txType,
        amount: tx.amount,
        ...(tx.referenceId ? { reference_id: tx.referenceId } : {}),
      },
    });
    if (existingTx) {
      console.log(
        `  Koin ${tx.txType} already exists: ${tx.driver.first_name} Rp ${tx.amount.toLocaleString('id-ID')}`,
      );
      continue;
    }
    const entry = koinTransactionRepository.create({
      driver_id: tx.driver.id,
      driver_saldo_id: koin?.id || undefined,
      type: tx.txType,
      amount: tx.amount,
      balance_before: tx.balanceBefore,
      balance_after: tx.balanceAfter,
      reference_id: tx.referenceId || undefined,
      notes: tx.notes,
    });
    await koinTransactionRepository.save(entry);
    console.log(
      `  Koin ${tx.txType}: ${tx.driver.first_name} Rp ${tx.amount.toLocaleString('id-ID')} → koin ${tx.balanceAfter.toLocaleString('id-ID')}`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 9. SEED SETTINGS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Settings ──');
  for (const sData of settingsData) {
    const existing = await settingRepository.findOne({
      where: { key: sData.key },
    });
    if (existing) {
      console.log(`  Setting already exists: ${sData.key}`);
      continue;
    }
    const setting = settingRepository.create(sData);
    await settingRepository.save(setting);
    console.log(`  Created setting: ${sData.key} = ${sData.value}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 10. SEED AUDIT LOGS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Audit Logs ──');
  const auditData = [
    {
      username: 'admin',
      action: 'CREATE_DRIVER',
      target: 'driver/DRV-001',
      details: 'Created driver Budi Santoso',
      status: 'success',
    },
    {
      username: 'admin',
      action: 'CREATE_VEHICLE',
      target: 'vehicle/B 1234 ABC',
      details: 'Created vehicle Toyota Avanza',
      status: 'success',
    },
  ];

  let createdAuditLogs = 0;
  for (const aData of auditData) {
    const existing = await auditRepository.findOne({
      where: {
        username: aData.username,
        action: aData.action,
        target: aData.target,
      },
    });
    if (existing) {
      continue;
    }
    const log = auditRepository.create(aData);
    await auditRepository.save(log);
    createdAuditLogs++;
  }
  console.log(`  Created ${createdAuditLogs} audit log entries`);

  await app.close();
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Seed completed successfully!');
  console.log('═══════════════════════════════════════════════════\n');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
