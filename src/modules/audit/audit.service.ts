import prisma from '../../db/prisma.js';

export var AuditService = (function() {
  function AuditService() {}

  AuditService.prototype.getLogs = async function(filters) {
    var where = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    var page = filters.page || 1;
    var limit = filters.limit || 50;
    var skip = (page - 1) * limit;
    var logs = await prisma.auditLog.findMany({ where: where, include: { user: { select: { name: true, email: true } } }, skip: skip, take: limit, orderBy: { createdAt: 'desc' } });
    var total = await prisma.auditLog.count({ where: where });
    return { data: logs, total: total };
  };

  return AuditService;
})();

export var auditService = new AuditService();
