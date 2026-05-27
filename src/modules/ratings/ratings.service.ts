import prisma from '../../db/prisma.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';

export var RatingsService = (function() {
  function RatingsService() {}

  RatingsService.prototype.create = async function(input, reviewerId) {
    var user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundError('User not found');
    var existing = await prisma.rating.findFirst({ where: { userId: input.userId, month: input.month } });
    if (existing) throw new BadRequestError('Rating exists for this month');
    var rating = await prisma.rating.create({ data: { userId: input.userId, month: input.month, score: input.score, comment: input.comment, reviewerId: reviewerId }, include: { user: { select: { id: true, name: true } } } });
    return rating;
  };

  RatingsService.prototype.getMyRatings = async function(userId, page, limit) {
    page = page || 1; limit = limit || 20;
    var skip = (page - 1) * limit;
    var ratings = await prisma.rating.findMany({ where: { userId: userId }, include: { user: { select: { name: true } } }, skip: skip, take: limit, orderBy: { month: 'desc' } });
    var total = await prisma.rating.count({ where: { userId: userId } });
    return { data: ratings, total: total };
  };

  return RatingsService;
})();

export var ratingsService = new RatingsService();
