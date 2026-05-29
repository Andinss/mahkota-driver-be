import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

  const existing = await userRepository.findOne({
    where: { username: 'admin' },
  });

  if (existing) {
    console.log('Admin already exists:', existing.id);
    await app.close();
    return;
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = userRepository.create({
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    password: hashedPassword,
    // profile_photo: 'https://ui-avatars.com/api/?background=0D8F81&color=fff&name=Admin',
    is_active: true,
  });

  await userRepository.save(admin);
  console.log('Admin created:', admin.id);

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
