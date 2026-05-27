import prisma from '../../db/prisma.js';
import { BadRequestError } from '../../common/errors.js';

export var AttendanceService = (function() {
  function AttendanceService() {}

  AttendanceService.prototype.mark = async function(userId, input) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    var existing = await prisma.attendance.findFirst({ where: { userId: userId, date: { gte: today, lt: tomorrow } } });
    if (existing) throw new BadRequestError('Already marked today');
    var now = new Date();
    var isLate = input.status === 'PRESENT' && (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30));
    var attendance = await prisma.attendance.create({ data: { userId: userId, status: input.status, isLate: isLate, comment: input.comment, date: now } });
    await prisma.auditLog.create({ data: { userId: userId, action: 'ATTENDANCE_MARKED', resource: 'attendance', detail: 'Marked ' + input.status } });
    return attendance;
  };

  AttendanceService.prototype.getMyAttendance = async function(userId, page, limit) {
    page = page || 1; limit = limit || 20;
    var skip = (page - 1) * limit;
    var data = await prisma.attendance.findMany({ where: { userId: userId }, skip: skip, take: limit, orderBy: { date: 'desc' } });
    var total = await prisma.attendance.count({ where: { userId: userId } });
    return { data: data, total: total, page: page };
  };

  AttendanceService.prototype.getTodayStatus = async function(userId) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    var attendance = await prisma.attendance.findFirst({ where: { userId: userId, date: { gte: today, lt: tomorrow } } });
    return { marked: !!attendance, attendance: attendance };
  };

  return AttendanceService;
})();

export var attendanceService = new AttendanceService();
