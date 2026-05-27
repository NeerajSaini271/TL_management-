import argon2 from 'argon2';
import prisma from '../../db/prisma.js';
import { ConflictError, NotFoundError } from '../../common/errors.js';

export var TLService = (function() {
  function TLService() {}

  TLService.prototype.create = async function(input, createdBy) {
    var existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('Email exists');
    var hash = await argon2.hash(input.password);
    var tl = await prisma.user.create({
      data: { email: input.email, passwordHash: hash, name: input.name, department: input.department, role: 'TL' }
    });
    await prisma.auditLog.create({ data: { userId: createdBy, action: 'TL_CREATED', resource: 'tl', detail: 'Created TL: ' + tl.name } });
    return { id: tl.id, name: tl.name, email: tl.email, department: tl.department, role: tl.role };
  };

  TLService.prototype.getAll = async function(page, limit) {
    page = page || 1; limit = limit || 20;
    var skip = (page - 1) * limit;
    var tls = await prisma.user.findMany({
      where: { role: 'TL' },
      select: { id: true, name: true, email: true, department: true, isActive: true, createdAt: true },
      skip: skip, take: limit, orderBy: { createdAt: 'desc' }
    });
    var total = await prisma.user.count({ where: { role: 'TL' } });
    return { data: tls, total: total, page: page, limit: limit };
  };

  TLService.prototype.getById = async function(id) {
    var tl = await prisma.user.findFirst({ where: { id: id, role: 'TL' } });
    if (!tl) throw new NotFoundError('TL not found');
    return { id: tl.id, name: tl.name, email: tl.email, department: tl.department, isActive: tl.isActive };
  };

  TLService.prototype.update = async function(id, input, updatedBy) {
    var tl = await prisma.user.findFirst({ where: { id: id, role: 'TL' } });
    if (!tl) throw new NotFoundError('TL not found');
    var updated = await prisma.user.update({ where: { id: id }, data: input });
    await prisma.auditLog.create({ data: { userId: updatedBy, action: 'TL_UPDATED', resource: 'tl', detail: 'Updated TL: ' + updated.name } });
    return { id: updated.id, name: updated.name, email: updated.email, department: updated.department, isActive: updated.isActive };
  };

  TLService.prototype.delete = async function(id, deletedBy) {
    var tl = await prisma.user.findFirst({ where: { id: id, role: 'TL' } });
    if (!tl) throw new NotFoundError('TL not found');
    await prisma.user.update({ where: { id: id }, data: { isActive: false } });
    await prisma.auditLog.create({ data: { userId: deletedBy, action: 'TL_DELETED', resource: 'tl', detail: 'Deactivated TL: ' + tl.name } });
  };

  return TLService;
})();

export var tlService = new TLService();
