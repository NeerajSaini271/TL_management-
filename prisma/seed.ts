import prisma from '../src/db/prisma.js';
import argon2 from 'argon2';

async function main() {
  const adminPwd = await argon2.hash('Admin@123!');
  const tlPwd = await argon2.hash('TL@123!');
  const employeePwd = await argon2.hash('Employee@123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      name: 'System Admin',
      passwordHash: adminPwd,
      role: 'ADMIN',
      department: 'Engineering',
    },
  });

  const tl = await prisma.user.upsert({
    where: { email: 'tl@company.com' },
    update: {},
    create: {
      email: 'tl@company.com',
      name: 'Team Lead',
      passwordHash: tlPwd,
      role: 'TL',
      department: 'Product',
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@company.com' },
    update: {},
    create: {
      email: 'employee@company.com',
      name: 'John Doe',
      passwordHash: employeePwd,
      role: 'EMPLOYEE',
      department: 'Product',
    },
  });

  console.log('Seeded users:', admin.id, tl.id, employee.id);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
