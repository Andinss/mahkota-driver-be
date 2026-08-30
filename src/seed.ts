import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { Role } from './roles/entities/role.entity';
import { Permission } from './permissions/entities/permission.entity';
import { Vehicle } from './vehicles/entities/vehicle.entity';
import { Driver } from './drivers/entities/driver.entity';
import { Rental } from './rentals/entities/rental.entity';
import { Finance } from './finances/entities/finance.entity';
import { LatePayment } from './late-payments/entities/late-payment.entity';
import { GpsLocation } from './monitoring/entities/gps-location.entity';
import { Setting } from './settings/entities/setting.entity';
import { AuditLog } from './audit/entities/audit-log.entity';
import { DriverSaldo } from './saldo/entities/driver-saldo.entity';
import { SaldoTransaction } from './saldo/entities/saldo-transaction.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

// ─── Permissions ──────────────────────────────────────────────
const modulePermissions: Record<string, string[]> = {
  user: ['create', 'read', 'update', 'delete', 'activate', 'manage_role'],
  role: ['create', 'read', 'update', 'delete', 'assign_permissions'],
  permission: ['create', 'read', 'update', 'delete'],
  driver: ['create', 'read.all', 'read.own', 'update.all', 'update.own', 'delete.all', 'delete.own', 'assign_vehicle'],
  vehicle: ['create', 'read', 'update', 'delete', 'change_status'],
  rental: ['create', 'read', 'update', 'delete', 'approve', 'reject'],
  finance: ['create', 'read', 'update', 'delete', 'approve'],
  late_payment: ['read', 'approve'],
  monitoring: ['read', 'read.all', 'update'],
  saldo: ['read', 'top_up', 'deduct', 'refund'],
  setting: ['create', 'read', 'update', 'delete'],
  audit: ['read'],
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
    name: 'Administrator', code: 'ADMIN', description: 'Full system access',
    permissionFilter: () => true,
  },
  {
    name: 'Supervisor', code: 'SUPERVISOR', description: 'Supervisor - manage own drivers (max 10)',
    permissionFilter: (name) => {
      const perms = [
        'driver.create', 'driver.read.own', 'driver.update.own', 'driver.delete.own', 'driver.assign_vehicle',
        'vehicle.read',
        'rental.read', 'rental.create',
        'saldo.read', 'saldo.top_up',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Finance', code: 'FINANCE', description: 'Finance department access',
    permissionFilter: (name) => {
      const perms = [
        'finance.create', 'finance.read', 'finance.update', 'finance.approve',
        'rental.read',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Field Officer', code: 'FIELD_OFFICER', description: 'Field operations access',
    permissionFilter: (name) => {
      const perms = [
        'driver.read.all', 'driver.assign_vehicle',
        'vehicle.read',
        'rental.read',
        'monitoring.read', 'monitoring.read.all', 'monitoring.update',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Driver', code: 'DRIVER', description: 'Driver - no dashboard access',
    permissionFilter: (name) => {
      const perms = [
        'saldo.read', 'saldo.top_up',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Owner', code: 'OWNER', description: 'Business owner - read-only reports',
    permissionFilter: (name) => {
      const perms = [
        'driver.read.all', 'vehicle.read', 'rental.read', 'finance.read',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Operator', code: 'OPERATOR', description: 'System operator - basic read access',
    permissionFilter: (name) => {
      const perms = [
        'driver.read.all', 'vehicle.read', 'rental.read',
      ];
      return perms.includes(name);
    },
  },
];

// ─── Vehicles ─────────────────────────────────────────────────
const vehiclesData = [
  {
    merk: 'Toyota', model: 'Avanza',
    launching_year: new Date('2022-01-15'),
    license_plate: 'B 1234 ABC',
    vin_number: 'MHFX1234567890123',
    color: 'Silver', status: 'rented',
    engine_number: 'EN-TOYOTA-001',
    engine_status: 'on',
    daily_rate: 350000,
  },
  {
    merk: 'Honda', model: 'Brio',
    launching_year: new Date('2023-03-20'),
    license_plate: 'B 5678 DEF',
    vin_number: 'MHFX9876543210987',
    color: 'Red', status: 'rented',
    engine_number: 'EN-HONDA-001',
    engine_status: 'off',
    daily_rate: 300000,
  },
  {
    merk: 'Toyota', model: 'Innova',
    launching_year: new Date('2021-06-10'),
    license_plate: 'B 9012 GHI',
    vin_number: 'MHFX4567890123456',
    color: 'Black', status: 'Available',
    engine_number: 'EN-TOYOTA-002',
    engine_status: 'off',
    daily_rate: 500000,
  },
  {
    merk: 'Daihatsu', model: 'Xenia',
    launching_year: new Date('2023-08-05'),
    license_plate: 'B 3456 JKL',
    vin_number: 'MHFX1122334455667',
    color: 'White', status: 'rented',
    engine_number: 'EN-DAIHATSU-001',
    engine_status: 'on',
    daily_rate: 280000,
  },
  {
    merk: 'Suzuki', model: 'Ertiga',
    launching_year: new Date('2022-11-01'),
    license_plate: 'B 7890 MNO',
    vin_number: 'MHFX7788990011223',
    color: 'Blue', status: 'rented',
    engine_number: 'EN-SUZUKI-001',
    engine_status: 'off',
    daily_rate: 320000,
  },
  {
    merk: 'Mitsubishi', model: 'Xpander',
    launching_year: new Date('2023-05-15'),
    license_plate: 'B 2345 PQR',
    vin_number: 'MHFX3344556677889',
    color: 'Grey', status: 'rented',
    engine_number: 'EN-MITSUBISHI-001',
    engine_status: 'on',
    daily_rate: 400000,
  },
  {
    merk: 'Toyota', model: 'Camry',
    launching_year: new Date('2024-01-10'),
    license_plate: 'B 6789 STU',
    vin_number: 'MHFX9988776655443',
    color: 'White', status: 'Available',
    engine_number: 'EN-TOYOTA-003',
    engine_status: 'off',
    daily_rate: 600000,
  },
];

// ─── Drivers ──────────────────────────────────────────────────
const driversData = [
  {
    first_name: 'Budi', last_name: 'Santoso',
    date_of_birth: new Date('1990-05-15'),
    gender: 'Male', employee_id: 'DRV-001',
    phone: '081234567890', email: 'budi.santoso@example.com',
    emergency_contact: '081234567891', emergency_email: 'emergency.budi@example.com',
    house_type: 'Owned', permanent_address: 'Jl. Sudirman No. 10, Jakarta Selatan',
    ready_sign_contract: true, willing_to_be_survey: true,
  },
  {
    first_name: 'Andi', last_name: 'Pratama',
    date_of_birth: new Date('1988-08-22'),
    gender: 'Male', employee_id: 'DRV-002',
    phone: '081234567892', email: 'andi.pratama@example.com',
    emergency_contact: '081234567893', emergency_email: 'emergency.andi@example.com',
    house_type: 'Rented', permanent_address: 'Jl. Gatot Subroto No. 25, Jakarta Pusat',
    ready_sign_contract: true, willing_to_be_survey: true,
  },
  {
    first_name: 'Siti', last_name: 'Rahayu',
    date_of_birth: new Date('1995-02-10'),
    gender: 'Female', employee_id: 'DRV-003',
    phone: '081234567894', email: 'siti.rahayu@example.com',
    emergency_contact: '081234567895', emergency_email: 'emergency.siti@example.com',
    house_type: 'Owned', permanent_address: 'Jl. Thamrin No. 30, Jakarta Pusat',
    ready_sign_contract: true, willing_to_be_survey: true,
  },
  {
    first_name: 'Dedi', last_name: 'Kurniawan',
    date_of_birth: new Date('1992-11-30'),
    gender: 'Male', employee_id: 'DRV-004',
    phone: '081234567896', email: 'dedi.kurniawan@example.com',
    emergency_contact: '081234567897', emergency_email: 'emergency.dedi@example.com',
    house_type: 'Rented', permanent_address: 'Jl. Kuningan No. 15, Jakarta Selatan',
    ready_sign_contract: true, willing_to_be_survey: false,
  },
  {
    first_name: 'Rina', last_name: 'Wulandari',
    date_of_birth: new Date('1993-07-18'),
    gender: 'Female', employee_id: 'DRV-005',
    phone: '081234567898', email: 'rina.wulandari@example.com',
    emergency_contact: '081234567899', emergency_email: 'emergency.rina@example.com',
    house_type: 'Owned', permanent_address: 'Jl. Kemang No. 8, Jakarta Selatan',
    ready_sign_contract: true, willing_to_be_survey: true,
  },
];

// ─── Settings ─────────────────────────────────────────────────
const settingsData = [
  { key: 'company_name', value: 'Mahkota Rental', category: 'general', description: 'Company name' },
  { key: 'company_email', value: 'info@mahkotarental.com', category: 'general', description: 'Company contact email' },
  { key: 'company_phone', value: '+62 21 5555 0123', category: 'general', description: 'Company phone number' },
  { key: 'currency', value: 'IDR', category: 'finance', description: 'Default currency' },
  { key: 'tax_rate', value: '11', category: 'finance', description: 'Tax rate percentage' },
  { key: 'late_fee_per_day', value: '50000', category: 'finance', description: 'Late fee per day in IDR' },
  { key: 'max_rental_duration_days', value: '365', category: 'rental', description: 'Maximum rental duration in days' },
  { key: 'min_deposit_percentage', value: '20', category: 'rental', description: 'Minimum deposit percentage' },
  { key: 'auto_set_late_enabled', value: 'true', category: 'rental', description: 'Auto-set late status for overdue rentals' },
  { key: 'gps_tracking_enabled', value: 'true', category: 'monitoring', description: 'Enable GPS tracking' },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const roleRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
  const permissionRepository = app.get<Repository<Permission>>(getRepositoryToken(Permission));
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
  const vehicleRepository = app.get<Repository<Vehicle>>(getRepositoryToken(Vehicle));
  const driverRepository = app.get<Repository<Driver>>(getRepositoryToken(Driver));
  const rentalRepository = app.get<Repository<Rental>>(getRepositoryToken(Rental));
  const financeRepository = app.get<Repository<Finance>>(getRepositoryToken(Finance));
  const latePaymentRepository = app.get<Repository<LatePayment>>(getRepositoryToken(LatePayment));
  const gpsRepository = app.get<Repository<GpsLocation>>(getRepositoryToken(GpsLocation));
  const settingRepository = app.get<Repository<Setting>>(getRepositoryToken(Setting));
  const auditRepository = app.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  const driverSaldoRepository = app.get<Repository<DriverSaldo>>(getRepositoryToken(DriverSaldo));
  const saldoTransactionRepository = app.get<Repository<SaldoTransaction>>(getRepositoryToken(SaldoTransaction));

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
      const permission = permissionRepository.create({ name: permName, module });
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
      role.permissions = allPermissions.filter((p) => roleData.permissionFilter(p.name));
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

    role.permissions = allPermissions.filter((p) => roleData.permissionFilter(p.name));
    await roleRepository.save(role);
    console.log(`  Assigned permissions to ${roleData.code}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 3. SEED USERS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Users ──');
  const usersData = [
    { username: 'admin', email: 'admin@example.com', password: 'admin123', roleCode: 'ADMIN' },
    { username: 'supervisor1', email: 'supervisor1@example.com', password: 'super123', roleCode: 'SUPERVISOR' },
    { username: 'finance1', email: 'finance1@example.com', password: 'finance123', roleCode: 'FINANCE' },
    { username: 'field1', email: 'field1@example.com', password: 'field123', roleCode: 'FIELD_OFFICER' },
    { username: 'owner1', email: 'owner1@example.com', password: 'owner123', roleCode: 'OWNER' },
  ];

  const createdUsers: User[] = [];
  for (const userData of usersData) {
    const existing = await userRepository.findOne({
      where: [{ username: userData.username }, { email: userData.email }],
    });
    if (existing) {
      console.log(`  User already exists: ${userData.username}`);
      createdUsers.push(existing);
      continue;
    }

    const role = await roleRepository.findOne({ where: { code: userData.roleCode } });
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
    console.log(`  Created user: ${userData.username} (${userData.roleCode})`);
  }

  const adminUser = createdUsers[0];

  // ═══════════════════════════════════════════════════════════
  // 4. SEED VEHICLES
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Vehicles ──');
  const createdVehicles: Vehicle[] = [];
  for (const vData of vehiclesData) {
    let vehicle = await vehicleRepository.findOne({ where: { license_plate: vData.license_plate } });
    if (vehicle) {
      console.log(`  Vehicle already exists: ${vData.license_plate}`);
      createdVehicles.push(vehicle);
      continue;
    }
    vehicle = vehicleRepository.create(vData);
    vehicle = await vehicleRepository.save(vehicle);
    createdVehicles.push(vehicle);
    console.log(`  Created vehicle: ${vData.license_plate} (${vData.merk} ${vData.model})`);
  }

  // ═══════════════════════════════════════════════════════════
  // 5. SEED DRIVERS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Drivers ──');
  const createdDrivers: Driver[] = [];
  for (const dData of driversData) {
    let driver = await driverRepository.findOne({ where: { employee_id: dData.employee_id } });
    if (driver) {
      console.log(`  Driver already exists: ${dData.employee_id}`);
      createdDrivers.push(driver);
      continue;
    }
    driver = driverRepository.create({ ...dData, created_by_id: adminUser?.id });
    driver = await driverRepository.save(driver);
    createdDrivers.push(driver);
    console.log(`  Created driver: ${dData.employee_id} (${dData.first_name} ${dData.last_name})`);
  }

  // ═══════════════════════════════════════════════════════════
  // 6. SEED RENTALS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Rentals ──');
  const rentalsData = [
    {
      driver: createdDrivers[0],
      vehicle: createdVehicles[0],
      start_date: new Date('2026-08-01'),
      end_date: new Date('2026-08-31'),
      total_duration: 30,
      daily_rate: 350000,
      deposit_amount: 2000000,
      method_payment: 'Bank',
      total_daily_rate: 10500000,
      security_deposit: 2000000,
      service_fee: 250000,
      total_revenue: 12750000,
      payment_status: 'partial',
    },
    {
      driver: createdDrivers[1],
      vehicle: createdVehicles[1],
      start_date: new Date('2026-08-05'),
      end_date: new Date('2026-09-04'),
      total_duration: 30,
      daily_rate: 300000,
      deposit_amount: 1500000,
      method_payment: 'Cash',
      total_daily_rate: 9000000,
      security_deposit: 1500000,
      service_fee: 250000,
      total_revenue: 10750000,
      payment_status: 'paid',
    },
    {
      driver: createdDrivers[2],
      vehicle: createdVehicles[2],
      start_date: new Date('2026-07-15'),
      end_date: new Date('2026-08-14'),
      total_duration: 30,
      daily_rate: 500000,
      deposit_amount: 3000000,
      method_payment: 'E Wallet',
      total_daily_rate: 15000000,
      security_deposit: 3000000,
      service_fee: 250000,
      total_revenue: 18250000,
      payment_status: 'unpaid',
    },
    {
      driver: createdDrivers[3],
      vehicle: createdVehicles[3],
      start_date: new Date('2026-08-10'),
      end_date: new Date('2026-08-25'),
      total_duration: 15,
      daily_rate: 280000,
      deposit_amount: 1000000,
      method_payment: 'Bank',
      total_daily_rate: 4200000,
      security_deposit: 1000000,
      service_fee: 250000,
      total_revenue: 5450000,
      payment_status: 'late',
    },
    {
      driver: createdDrivers[4],
      vehicle: createdVehicles[5],
      start_date: new Date('2026-08-20'),
      end_date: new Date('2026-09-19'),
      total_duration: 30,
      daily_rate: 400000,
      deposit_amount: 2500000,
      method_payment: 'Bank',
      total_daily_rate: 12000000,
      security_deposit: 2500000,
      service_fee: 250000,
      total_revenue: 14750000,
      payment_status: 'pending_confirmation',
    },
    {
      driver: createdDrivers[1],
      vehicle: createdVehicles[4],
      start_date: new Date('2026-08-22'),
      end_date: new Date('2026-08-26'),
      total_duration: 4,
      daily_rate: 320000,
      deposit_amount: 0,
      method_payment: 'Saldo',
      saldo_deducted: 1280000,
      total_daily_rate: 1280000,
      security_deposit: 0,
      service_fee: 0,
      total_revenue: 1280000,
      payment_status: 'paid',
    },
  ];

  const createdRentals: Rental[] = [];
  for (const rData of rentalsData) {
    const rental = rentalRepository.create({
      driver_id: rData.driver.id,
      vehicle_id: rData.vehicle.id,
      start_date: rData.start_date,
      end_date: rData.end_date,
      total_duration: rData.total_duration,
      daily_rate: rData.daily_rate,
      deposit_amount: rData.deposit_amount,
      method_payment: rData.method_payment,
      saldo_deducted: rData.saldo_deducted ?? 0,
      total_daily_rate: rData.total_daily_rate,
      security_deposit: rData.security_deposit,
      service_fee: rData.service_fee,
      total_revenue: rData.total_revenue,
      payment_status: rData.payment_status,
    });
    const saved = await rentalRepository.save(rental);
    createdRentals.push(saved);
    console.log(`  Created rental: ${saved.rental_number} (${rData.driver.first_name} → ${rData.vehicle.merk} ${rData.vehicle.model}) [${rData.payment_status}]`);
  }

  // ═══════════════════════════════════════════════════════════
  // 7. SEED FINANCES
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Finances ──');
  const financesData = [
    {
      payment_date: new Date('2026-08-02'),
      reference_number: 'PAY/2026/08/0001',
      payment_method: 'transfer',
      amount_received: 5000000,
      notes: 'DP Rental Avanza - Budi Santoso',
      payer: 'Budi Santoso',
      driver: createdDrivers[0],
      finance_type: 'rental',
      rentals: [createdRentals[0]],
      is_active: true,
    },
    {
      payment_date: new Date('2026-08-06'),
      reference_number: 'PAY/2026/08/0002',
      payment_method: 'cash',
      amount_received: 10750000,
      notes: 'Full payment rental Brio - Andi Pratama',
      payer: 'Andi Pratama',
      driver: createdDrivers[1],
      finance_type: 'rental',
      rentals: [createdRentals[1]],
      is_active: true,
    },
    {
      payment_date: new Date('2026-08-12'),
      reference_number: 'PAY/2026/08/0003',
      payment_method: 'transfer',
      amount_received: 3000000,
      notes: 'Partial payment rental Innova - Siti Rahayu',
      payer: 'Siti Rahayu',
      driver: createdDrivers[2],
      finance_type: 'rental',
      rentals: [createdRentals[2]],
      is_active: true,
    },
    {
      payment_date: new Date('2026-08-20'),
      reference_number: 'PAY/2026/08/0004',
      payment_method: 'transfer',
      amount_received: 1000000,
      notes: 'Partial payment for Xenia rental - Dedi Kurniawan',
      payer: 'Dedi Kurniawan',
      driver: createdDrivers[3],
      finance_type: 'rental',
      rentals: [createdRentals[3]],
      is_active: true,
    },
    {
      payment_date: new Date('2026-08-22'),
      reference_number: 'PAY/2026/08/0005',
      payment_method: 'e-wallet',
      amount_received: 2500000,
      notes: 'Deposit payment for Xpander - Rina Wulandari',
      payer: 'Rina Wulandari',
      driver: createdDrivers[4],
      finance_type: 'rental',
      rentals: [createdRentals[4]],
      is_active: true,
    },
    {
      payment_date: new Date('2026-08-25'),
      reference_number: 'PAY/2026/08/0006',
      payment_method: 'cash',
      amount_received: 500000,
      notes: 'Manual payment - office supply reimbursement',
      payer: 'Office Admin',
      driver: createdDrivers[0],
      finance_type: 'manual',
      rentals: [],
      is_active: true,
    },
    {
      payment_date: new Date('2026-08-22'),
      reference_number: 'SALDO/' + (createdRentals[5]?.rental_number || 'RENT/006'),
      payment_method: 'saldo',
      amount_received: 1280000,
      notes: 'Pembayaran rental ' + (createdRentals[5]?.rental_number || 'RENT/006') + ' dari saldo driver',
      payer: 'Andi Pratama',
      driver: createdDrivers[1],
      finance_type: 'rental',
      rentals: [createdRentals[5]],
      is_active: true,
    },
  ];

  const createdFinances: Finance[] = [];
  for (const fData of financesData) {
    const { rentals: rentalList, ...financeFields } = fData;
    const finance = financeRepository.create({
      ...financeFields,
      payment_date: new Date(fData.payment_date),
    });
    if (rentalList && rentalList.length > 0) {
      finance.rentals = rentalList.map((r) => ({ id: r.id } as any));
    }
    const saved = await financeRepository.save(finance);
    createdFinances.push(saved);
    console.log(`  Created finance: ${saved.reference_number} Rp ${saved.amount_received.toLocaleString('id-ID')} (${saved.finance_type})`);
  }

  // ═══════════════════════════════════════════════════════════
  // 8. SEED LATE PAYMENTS
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
      rentals: [createdRentals[3]],
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
      rentals: [createdRentals[2]],
    },
  ];

  for (const lpData of latePaymentsData) {
    const { rentals: rentalList, ...lpFields } = lpData;
    const latePayment = latePaymentRepository.create({
      ...lpFields,
      driver_id: lpData.driver.id,
    });
    const saved = await latePaymentRepository.save(latePayment);

    if (rentalList && rentalList.length > 0) {
      await latePaymentRepository
        .createQueryBuilder()
        .relation(LatePayment, 'rentals')
        .of(saved)
        .add(rentalList.map((r) => r.id));
    }

    console.log(`  Created late payment: ${lpData.driver_name} Rp ${lpData.amount.toLocaleString('id-ID')} [${lpData.status}]`);
  }

  // ═══════════════════════════════════════════════════════════
  // 9. SEED GPS LOCATIONS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding GPS Locations ──');
  const gpsData = [
    { vehicle: createdVehicles[0], latitude: -6.2088, longitude: 106.8456, speed: 45, fuel_level: 72, status: 'moving', engine_status: 'on' },
    { vehicle: createdVehicles[1], latitude: -6.1750, longitude: 106.8270, speed: 0, fuel_level: 30, status: 'idle', engine_status: 'off' },
    { vehicle: createdVehicles[2], latitude: -6.2297, longitude: 106.6891, speed: 60, fuel_level: 85, status: 'moving', engine_status: 'on' },
    { vehicle: createdVehicles[3], latitude: -6.2615, longitude: 106.8100, speed: 0, fuel_level: 45, status: 'idle', engine_status: 'off' },
    { vehicle: createdVehicles[5], latitude: -6.1944, longitude: 106.8329, speed: 35, fuel_level: 60, status: 'moving', engine_status: 'on' },
    { vehicle: createdVehicles[6], latitude: -6.1500, longitude: 106.8000, speed: 0, fuel_level: 90, status: 'idle', engine_status: 'off' },
  ];

  for (const gData of gpsData) {
    const gps = gpsRepository.create({
      vehicle_id: gData.vehicle.id,
      latitude: gData.latitude,
      longitude: gData.longitude,
      speed: gData.speed,
      fuel_level: gData.fuel_level,
      status: gData.status,
      engine_status: gData.engine_status,
    });
    await gpsRepository.save(gps);

    await vehicleRepository.update(gData.vehicle.id, {
      engine_status: gData.engine_status,
    });

    console.log(`  GPS: ${gData.vehicle.merk} ${gData.vehicle.model} @ ${gData.latitude}, ${gData.longitude} [${gData.status}] engine=${gData.engine_status}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 10. SEED DRIVER SALDO
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Driver Saldo ──');
  const saldoRental = createdRentals[5];

  const saldoData = [
    { driver: createdDrivers[0], balance: 5000000 },
    { driver: createdDrivers[1], balance: 1720000 },
    { driver: createdDrivers[2], balance: 7500000 },
    { driver: createdDrivers[3], balance: 500000 },
    { driver: createdDrivers[4], balance: 2000000 },
  ];

  const saldoLedger: {
    driver: Driver;
    txType: 'top_up' | 'rental_payment' | 'refund';
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    referenceId?: string;
    notes: string;
  }[] = [
    { driver: createdDrivers[0], txType: 'top_up', amount: 5000000, balanceBefore: 0, balanceAfter: 5000000, notes: 'Initial balance seed' },
    { driver: createdDrivers[1], txType: 'top_up', amount: 3000000, balanceBefore: 0, balanceAfter: 3000000, notes: 'Initial balance seed' },
    { driver: createdDrivers[1], txType: 'rental_payment', amount: 1280000, balanceBefore: 3000000, balanceAfter: 1720000, referenceId: saldoRental?.id, notes: 'Pembayaran rental dari saldo' },
    { driver: createdDrivers[2], txType: 'top_up', amount: 7500000, balanceBefore: 0, balanceAfter: 7500000, notes: 'Initial balance seed' },
    { driver: createdDrivers[3], txType: 'refund', amount: 500000, balanceBefore: 0, balanceAfter: 500000, referenceId: createdRentals[3]?.id, notes: 'Refund ke saldo' },
    { driver: createdDrivers[4], txType: 'top_up', amount: 2000000, balanceBefore: 0, balanceAfter: 2000000, notes: 'Initial balance seed' },
  ];

  for (const sData of saldoData) {
    let saldo = await driverSaldoRepository.findOne({
      where: { driver_id: sData.driver.id },
    });
    if (saldo) {
      console.log(`  Saldo already exists for driver: ${sData.driver.first_name}, resetting balance`);
      saldo.balance = sData.balance;
      await driverSaldoRepository.save(saldo);
    } else {
      saldo = driverSaldoRepository.create({
        driver_id: sData.driver.id,
        balance: sData.balance,
      });
      saldo = await driverSaldoRepository.save(saldo);
      console.log(`  Created saldo: ${sData.driver.first_name} Rp ${sData.balance.toLocaleString('id-ID')}`);
    }
  }

  for (const tx of saldoLedger) {
    const saldo = await driverSaldoRepository.findOne({
      where: { driver_id: tx.driver.id },
    });
    const entry = saldoTransactionRepository.create({
      driver_id: tx.driver.id,
      driver_saldo_id: saldo?.id || undefined,
      type: tx.txType,
      amount: tx.amount,
      balance_before: tx.balanceBefore,
      balance_after: tx.balanceAfter,
      reference_id: tx.referenceId || undefined,
      notes: tx.notes,
    });
    await saldoTransactionRepository.save(entry);
    console.log(`  Saldo ${tx.txType}: ${tx.driver.first_name} Rp ${tx.amount.toLocaleString('id-ID')} → saldo ${tx.balanceAfter.toLocaleString('id-ID')}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 11. SEED SETTINGS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Settings ──');
  for (const sData of settingsData) {
    const existing = await settingRepository.findOne({ where: { key: sData.key } });
    if (existing) {
      console.log(`  Setting already exists: ${sData.key}`);
      continue;
    }
    const setting = settingRepository.create(sData);
    await settingRepository.save(setting);
    console.log(`  Created setting: ${sData.key} = ${sData.value}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 12. SEED AUDIT LOGS
  // ═══════════════════════════════════════════════════════════
  console.log('\n── Seeding Audit Logs ──');
  const auditData = [
    { username: 'admin', action: 'CREATE_DRIVER', target: 'driver/DRV-001', details: 'Created driver Budi Santoso', status: 'success' },
    { username: 'admin', action: 'CREATE_VEHICLE', target: 'vehicle/B 1234 ABC', details: 'Created vehicle Toyota Avanza', status: 'success' },
    { username: 'admin', action: 'CREATE_RENTAL', target: `rental/${createdRentals[0]?.rental_number || 'RENT/001'}`, details: 'Created rental for Budi Santoso', status: 'success' },
    { username: 'finance1', action: 'CREATE_FINANCE', target: `finance/${createdFinances[0]?.id || ''}`, details: 'Created finance PAY/2026/08/0001', status: 'success' },
    { username: 'admin', action: 'UPDATE_RENTAL_STATUS', target: `rental/${createdRentals[1]?.rental_number || 'RENT/002'}`, details: 'Updated payment status to paid', status: 'success' },
    { username: 'admin', action: 'LOGIN', target: 'auth/login', details: 'Admin logged in', status: 'success' },
    { username: 'finance1', action: 'LOGIN', target: 'auth/login', details: 'Finance user logged in', status: 'success' },
  ];

  for (const aData of auditData) {
    const log = auditRepository.create(aData);
    await auditRepository.save(log);
  }
  console.log(`  Created ${auditData.length} audit log entries`);

  await app.close();
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Seed completed successfully!');
  console.log('═══════════════════════════════════════════════════\n');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
