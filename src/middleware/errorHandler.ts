import { AppError } from '../common/errors.js';
import config from '../config/index.js';
export function errorHandler(error, request, reply) {
  if (error instanceof AppError) return reply.status(error.statusCode).send({ success: false, message: error.message });
  if (error.code === 'P2002') return reply.status(409).send({ success: false, message: 'Record already exists' });
  request.log.error(error);
  reply.status(500).send({ success: false, message: config.NODE_ENV === 'production' ? 'Internal error' : error.message });
}
