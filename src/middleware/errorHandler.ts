import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../common/errors.js';
import config from '../config/index.js';

export function errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }

  // Prisma errors
  if (error.code === 'P2002') {
    reply.status(409).send({
      success: false,
      message: 'A record with that value already exists.',
    });
    return;
  }

  if (error.validation) {
    reply.status(400).send({
      success: false,
      message: error.message,
    });
    return;
  }

  request.log.error(error);
  reply.status(500).send({
    success: false,
    message: config.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
}
