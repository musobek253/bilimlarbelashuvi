
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log("Available models on prisma object:");
console.log(Object.keys(prisma).filter(key => !key.startsWith('_') && typeof prisma[key] === 'object' && prisma[key] !== null));

prisma.$disconnect();
