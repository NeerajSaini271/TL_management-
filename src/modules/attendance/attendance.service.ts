import pool from '../../db/pool.js';
import { BadRequestError } from '../../common/errors.js';

export var AttendanceService = (function() {
  function AttendanceService() {}

  AttendanceService.prototype.mark = async function(userId, input) {
    var c = await pool.connect();
    try {
      var today = new Date(); today.setHours(0,0,0,0);
      var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
      var existing = await c.query('SELECT id FROM attendance WHERE user_id = $1 AND date >= $2 AND date < $3', [userId, today.toISOString(), tomorrow.toISOString()]);
      if (existing.rows.length > 0) {
        throw new BadRequestError('Already marked today');
      }
      var now = new Date();
      var isLate = input.status === 'PRESENT' && (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30));
      var result = await c.query('INSERT INTO attendance (user_id, status, is_late, comment) VALUES ($1,$2,$3,$4) RETURNING *', [userId, input.status, isLate, input.comment || null]);
      return result.rows[0];
    } finally { c.release(); }
  };

  AttendanceService.prototype.getMyAttendance = async function(userId, page, limit) {
    page = page || 1; limit = limit || 20;
    var offset = (page - 1) * limit;
    var c = await pool.connect();
    try {
      var result = await c.query('SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC LIMIT $2 OFFSET $3', [userId, limit, offset]);
      return { data: result.rows, total: result.rows.length };
    } finally { c.release(); }
  };

  AttendanceService.prototype.getTodayStatus = async function(userId) {
    var c = await pool.connect();
    try {
      var today = new Date(); today.setHours(0,0,0,0);
      var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
      var result = await c.query('SELECT * FROM attendance WHERE user_id = $1 AND date >= $2 AND date < $3', [userId, today.toISOString(), tomorrow.toISOString()]);
      return { marked: result.rows.length > 0, attendance: result.rows[0] || null };
    } finally { c.release(); }
  };

  return AttendanceService;
})();

export var attendanceService = new AttendanceService();
