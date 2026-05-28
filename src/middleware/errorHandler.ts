export function errorHandler(error: any, request: any, reply: any) {
  // Extract status code and message from any error type
  var statusCode = error.statusCode || error.status || 500;
  var message = error.message || String(error) || 'Internal server error';

  // Handle specific Fastify error codes
  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') { statusCode = 415; message = 'Unsupported Media Type'; }
  if (error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') { statusCode = 400; message = 'Request body is empty'; }
  if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') { statusCode = 400; message = 'Invalid JSON in request body'; }
  if (error.validation) { statusCode = 400; message = error.message || 'Validation failed'; }

  // Log the full error for debugging
  request.log.error({
    error: error.message || String(error),
    stack: error.stack,
    statusCode: statusCode,
    url: request.url,
    method: request.method
  }, 'Request error');

  reply.status(statusCode).send({
    success: false,
    message: message,
    code: error.code || 'ERR'
  });
}
