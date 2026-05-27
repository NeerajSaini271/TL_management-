import { attendanceService } from './attendance.service.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { markAttendanceSchema } from './attendance.schema.js';

export async function attendanceRoutes(app) {
  app.addHook('preHandler', authenticate);

  app.post('/mark', { preHandler: [validateBody(markAttendanceSchema)] }, async function(req, reply) {
    var a = await attendanceService.mark(req.user.id, req.body);
    reply.status(201).send({ success: true, data: a });
  });

  app.get('/my', async function(req, reply) {
    var result = await attendanceService.getMyAttendance(req.user.id, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
    reply.send({ success: true, data: result.data, total: result.total });
  });

  app.get('/today', async function(req, reply) {
    var status = await attendanceService.getTodayStatus(req.user.id);
    reply.send({ success: true, data: status });
  });
}
