import { BadRequestError } from '../common/errors.js';
export function validateBody(schema) {
  return async function(req, _reply) {
    var r = schema.safeParse(req.body);
    if (!r.success) throw new BadRequestError(r.error.issues.map(function(i) { return i.message; }).join(', '));
    req.body = r.data;
  };
}
export function validateQuery(schema) {
  return async function(req, _reply) {
    var r = schema.safeParse(req.query);
    if (!r.success) throw new BadRequestError(r.error.issues.map(function(i) { return i.message; }).join(', '));
    req.query = r.data;
  };
}
export function validateParams(schema) {
  return async function(req, _reply) {
    var r = schema.safeParse(req.params);
    if (!r.success) throw new BadRequestError(r.error.issues.map(function(i) { return i.message; }).join(', '));
    req.params = r.data;
  };
}
