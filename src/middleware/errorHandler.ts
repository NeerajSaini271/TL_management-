export function errorHandler(error: any, request: any, reply: any) {
  var statusCode = error.statusCode || 500;
  var message = error.message || 'Internal server error';

  // Fastify validation errors
  if (error.validation) {
    statusCode = 400;
    message = error.message;
  }

  // Known Fastify error codes
  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    statusCode = 415;
    message = 'Unsupported Media Type';
  }
  if (error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
    statusCode = 400;
    message = 'Request body is empty';
  }
  if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  }

  // Log full error for debugging
  request.log.error({
    err: error,
    statusCode: statusCode,
    url: request.url,
    method: request.method
  }, message);

  reply.status(statusCode).send({
    success: false,
    message: message,
    code: error.code || 'ERR'
  });
}
