import { ratingsService } from './ratings.service.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { createRatingSchema } from './ratings.schema.js';

export async function ratingsRoutes(app: any) {
  app.addHook('preHandler', authenticate);

  app.post('/', { preHandler: [authorize('TL', 'MANAGER', 'ADMIN'), validateBody(createRatingSchema)] }, async function(req: any, reply: any) {
    var r = await ratingsService.create(req.body, req.user.id);
    reply.status(201).send({ success: true, data: r });
  });

  app.get('/my', async function(req: any, reply: any) {
    var result = await ratingsService.getMyRatings(req.user.id);
    reply.send({ success: true, data: result.data, total: result.total });
  });
}
