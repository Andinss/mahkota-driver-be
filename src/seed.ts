import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { Role } from './roles/entities/role.entity';
import { Permission } from './permissions/entities/permission.entity';
import { Vehicle } from './vehicles/entities/vehicle.entity';
import { GpsLocation } from './monitoring/entities/gps-location.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

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
  setting: ['create', 'read', 'update', 'delete'],
  audit: ['read'],
};

const allPermissionNames: string[] = [];
for (const [mod, actions] of Object.entries(modulePermissions)) {
  for (const action of actions) {
    allPermissionNames.push(`${mod}.${action}`);
  }
}

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
        'monitoring.read',
        'monitoring.read.all',
        'monitoring.update',
      ];
      return perms.includes(name);
    },
  },
  {
    name: 'Driver', code: 'DRIVER', description: 'Driver - no dashboard access',
    permissionFilter: () => false,
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

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const roleRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
  const permissionRepository = app.get<Repository<Permission>>(getRepositoryToken(Permission));
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

  // Seed permissions
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
    console.log(`Created ${newPermissions.length} permissions`);
  } else {
    console.log('All permissions already exist');
  }

  const allPermissions = await permissionRepository.find();

  // Seed roles with permissions
  for (const roleData of rolesData) {
    let role = await roleRepository.findOne({
      where: [
        { code: roleData.code },
        { name: roleData.name },
      ],
      relations: { permissions: true },
    });

    if (role) {
      // Update existing role permissions
      role.permissions = allPermissions.filter((p) => roleData.permissionFilter(p.name));
      await roleRepository.save(role);
      console.log(`Updated permissions for role: ${roleData.code}`);
      continue;
    }

    try {
      role = roleRepository.create({
        name: roleData.name,
        code: roleData.code,
        description: roleData.description,
      });
      role = await roleRepository.save(role);
      console.log(`Created role: ${roleData.code}`);
    } catch (err: any) {
      if (err.code === '23505') {
        console.log(`Role already exists (duplicate): ${roleData.code} (skipped)`);
        continue;
      }
      throw err;
    }

    // Assign permissions
    role.permissions = allPermissions.filter((p) => roleData.permissionFilter(p.name));
    await roleRepository.save(role);
    console.log(`Assigned permissions to ${roleData.code}`);
  }

  // Seed admin user
  const existingAdmin = await userRepository.findOne({
    where: [{ username: 'admin' }, { email: 'admin@example.com' }],
  });

  if (!existingAdmin) {
    const adminRole = await roleRepository.findOne({ where: { code: 'ADMIN' } });
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = userRepository.create({
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role_id: adminRole?.id,
      is_active: true,
    });

    try {
      await userRepository.save(admin);
      console.log('Admin user created with role ADMIN');
    } catch (err: any) {
      if (err.code === '23505') {
        console.log('Admin user already exists (skipped)');
      } else {
        throw err;
      }
    }
  } else {
    console.log('Admin user already exists');
  }

  // Seed monitoring dummy data
  const vehicleRepository = app.get<Repository<Vehicle>>(getRepositoryToken(Vehicle));
  const gpsRepository = app.get<Repository<GpsLocation>>(getRepositoryToken(GpsLocation));

  const dummyVehicles = [
    {
      merk: 'Toyota', model: 'Avanza',
      launching_year: new Date('2022-01-01'),
      license_plate: 'B 1234 ABC',
      vin_number: 'MHFX1234567890123',
      color: 'Silver', status: 'Available',
      engine_number: 'EN-TOYOTA-001',
      daily_rate: 350000,
    },
    {
      merk: 'Honda', model: 'Brio',
      launching_year: new Date('2023-01-01'),
      license_plate: 'B 5678 DEF',
      vin_number: 'MHFX9876543210987',
      color: 'Red', status: 'Available',
      engine_number: 'EN-HONDA-001',
      daily_rate: 300000,
    },
  ];

  const dummyGpsLocations = [
    { latitude: -6.2088, longitude: 106.8456, speed: 45, fuel_level: 72, status: 'moving' },
    { latitude: -6.175, longitude: 106.827, speed: 0, fuel_level: 30, status: 'idle' },
  ];

  for (let i = 0; i < dummyVehicles.length; i++) {
    const v = dummyVehicles[i];
    let vehicle = await vehicleRepository.findOne({ where: { license_plate: v.license_plate } });
    if (!vehicle) {
      vehicle = vehicleRepository.create(v);
      vehicle = await vehicleRepository.save(vehicle);
      console.log(`Created vehicle: ${v.license_plate}`);
    } else {
      console.log(`Vehicle already exists: ${v.license_plate}`);
    }
    const gps = gpsRepository.create({
      vehicle_id: vehicle.id,
      latitude: dummyGpsLocations[i].latitude,
      longitude: dummyGpsLocations[i].longitude,
      speed: dummyGpsLocations[i].speed,
      fuel_level: dummyGpsLocations[i].fuel_level,
      status: dummyGpsLocations[i].status,
    });
    await gpsRepository.save(gps);
    console.log(`GPS location saved for ${v.license_plate}`);
  }

  await app.close();
  console.log('Seed completed successfully');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
