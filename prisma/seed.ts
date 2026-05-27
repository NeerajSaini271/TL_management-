import prisma from '../src/db/prisma.js';
import argon2 from 'argon2';

async function main() {
  var adminPwd = await argon2.hash('Admin@123!');
  var tlPwd = await argon2.hash('TL@123!');
  var empPwd = await argon2.hash('Employee@123!');
  await prisma.user.upsert({ where: { email: 'admin@company.com' }, update: {}, create: { email: 'admin@company.com', name: 'Admin', passwordHash: adminPwd, role: 'ADMIN', department: 'Engineering' } });
  await prisma.user.upsert({ where: { email: 'tl@company.com' }, update: {}, create: { email: 'tl@company.com', name: 'TL', passwordHash: tlPwd, role: 'TL', department: 'Product' } });
  await prisma.user.upsert({ where: { email: 'employee@company.com' }, update: {}, create: { email: 'employee@company.com', name: 'Employee', passwordHash: empPwd, role: 'EMPLOYEE', department: 'Product' } });
  console.log('Seeded!');
}
main().catch(console.error).finally(function() { prisma.$disconnect(); });
