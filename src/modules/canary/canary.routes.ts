import { authenticate } from '../../middleware/auth.js';
import { CanaryToken } from '../../utils/canaryTokens.js';

export async function canaryRoutes(app: any) {
  app.addHook('preHandler', authenticate);

  app.post('/deploy', async function(req: any, reply: any) {
    var canary = CanaryToken.deploy(req.body.type || 'api', req.body.resource || 'unknown');
    reply.send({ success: true, data: canary });
  });

  app.get('/verify/:id', async function(req: any, reply: any) {
    var status = CanaryToken.verify(req.params.id);
    reply.send({ success: true, data: status });
  });

  app.get('/registry', async function(req: any, reply: any) {
    var registry = CanaryToken.getRegistry();
    reply.send({ success: true, data: registry });
  });
}
