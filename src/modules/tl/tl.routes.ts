import { tlService } from './tl.service.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { createTLSchema, updateTLSchema } from './tl.schema.js';
import { z } from 'zod';

var idSchema = z.object({ id: z.string() });

export async function tlRoutes(app: any) {
  app.addHook('preHandler', authenticate);

  app.post('/', { preHandler: [authorize('ADMIN', 'MANAGER'), validateBody(createTLSchema)] }, async function(req: any, reply: any) {
    var tl = await tlService.create(req.body, req.user.id);
    reply.status(201).send({ success: true, data: tl });
  });

  app.get('/', async function(req: any, reply: any) {
    var result = await tlService.getAll(parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
    reply.send({ success: true, data: result.data, total: result.total });
  });

  app.get('/:id', { preHandler: [validateParams(idSchema)] }, async function(req: any, reply: any) {
    var tl = await tlService.getById(req.params.id);
    reply.send({ success: true, data: tl });
  });

  app.put('/:id', { preHandler: [authorize('ADMIN', 'MANAGER'), validateParams(idSchema), validateBody(updateTLSchema)] }, async function(req: any, reply: any) {
    var tl = await tlService.update(req.params.id, req.body, req.user.id);
    reply.send({ success: true, data: tl });
  });

  app.delete('/:id', { preHandler: [authorize('ADMIN'), validateParams(idSchema)] }, async function(req: any, reply: any) {
    await tlService.delete(req.params.id, req.user.id);
    reply.send({ success: true, message: 'TL deactivated' });
  });
}
