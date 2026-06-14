import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { Role } from './roles/entities/role.entity';
import { Permission } from './permissions/entities/permission.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

const modules = ['user', 'role', 'permission', 'driver', 'vehicle', 'transaction'];
const actions = ['create', 'read', 'update', 'delete'];

const rolesData = [
  { name: 'Administrator', code: 'ADMIN', description: 'Full system access' },
  { name: 'Supervisor', code: 'SUPERVISOR', description: 'Supervisor level access' },
  { name: 'Finance', code: 'FINANCE', description: 'Finance department access' },
  { name: 'Field Officer', code: 'FIELD_OFFICER', description: 'Field operations access' },
  { name: 'Driver', code: 'DRIVER', description: 'Driver limited access' },
  { name: 'Owner', code: 'OWNER', description: 'Business owner access' },
  { name: 'Operator', code: 'OPERATOR', description: 'System operator access' },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const roleRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
  const permissionRepository = app.get<Repository<Permission>>(
    getRepositoryToken(Permission),
  );
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

  // Seed permissions
  const permissionNames: string[] = [];
  for (const module of modules) {
    for (const action of actions) {
      permissionNames.push(`${module}.${action}`);
    }
  }

  const existingPermissions = await permissionRepository.find();
  const existingNames = existingPermissions.map((p) => p.name);
  const newPermissions: Permission[] = [];

  for (const permName of permissionNames) {
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
    console.log(`Created ${newPermissions.length} permissions`);
  } else {
    console.log('All permissions already exist');
  }

  const allPermissions = await permissionRepository.find();

  // Seed roles
  for (const roleData of rolesData) {
    let role = await roleRepository.findOne({
      where: { code: roleData.code },
      relations: { permissions: true },
    });

    if (!role) {
      role = roleRepository.create(roleData);
      role = await roleRepository.save(role);
      console.log(`Created role: ${roleData.code}`);
    }

    // Assign all permissions to ADMIN role
    if (roleData.code === 'ADMIN') {
      role.permissions = allPermissions;
      await roleRepository.save(role);
      console.log(`Assigned all permissions to ${roleData.code}`);
    }

    // Assign read permissions to common roles
    if (['SUPERVISOR', 'FIELD_OFFICER'].includes(roleData.code)) {
      const readPermissions = allPermissions.filter((p) =>
        p.name.endsWith('.read'),
      );
      role.permissions = readPermissions;
      await roleRepository.save(role);
      console.log(`Assigned read permissions to ${roleData.code}`);
    }
  }

  // Seed admin user
  const existingAdmin = await userRepository.findOne({
    where: [{ username: 'admin' }, { email: 'admin@example.com' }],
  });

  if (!existingAdmin) {
    const adminRole = await roleRepository.findOne({
      where: { code: 'ADMIN' },
    });

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

  await app.close();
  console.log('Seed completed successfully');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
