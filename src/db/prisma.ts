import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
var prisma = new PrismaClient({ log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'] });
export async function connectDB() { await prisma.$connect(); }
export async function disconnectDB() { await prisma.$disconnect(); }
export default prisma;
