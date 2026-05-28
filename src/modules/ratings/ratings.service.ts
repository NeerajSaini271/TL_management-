import pool from '../../db/pool.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';

export var RatingsService = (function() {
  function RatingsService() {}

  RatingsService.prototype.create = async function(input, reviewerId) {
    var c = await pool.connect();
    try {
      var user = await c.query('SELECT id FROM users WHERE id = $1', [input.userId]);
      if (user.rows.length === 0) throw new NotFoundError('User not found');
      var exists = await c.query('SELECT id FROM ratings WHERE user_id = $1 AND month = $2', [input.userId, input.month]);
      if (exists.rows.length > 0) throw new BadRequestError('Rating exists for this month');
      var result = await c.query('INSERT INTO ratings (user_id, month, score, comment, reviewer_id) VALUES ($1,$2,$3,$4,$5) RETURNING *', [input.userId, input.month, input.score, input.comment || null, reviewerId]);
      return result.rows[0];
    } finally { c.release(); }
  };

  RatingsService.prototype.getMyRatings = async function(userId) {
    var c = await pool.connect();
    try {
      var result = await c.query('SELECT * FROM ratings WHERE user_id = $1 ORDER BY month DESC', [userId]);
      return { data: result.rows, total: result.rows.length };
    } finally { c.release(); }
  };

  return RatingsService;
})();

export var ratingsService = new RatingsService();
