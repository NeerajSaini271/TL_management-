import { auditService } from './audit.service.js';
import { authenticate, authorize } from '../../middleware/auth.js';

export async function auditRoutes(app) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN', 'MANAGER'));

  app.get('/logs', async function(req, reply) {
    var result = await auditService.getLogs(req.query);
    reply.send({ success: true, data: result.data, total: result.total });
  });
}
