const redisConnection = require("../config/redis");

const rateLimiter = async (req, res, next) => {
  const ip = req.ip;
  const redisKey = `rate-limit:${ip}:${req.originalUrl}`;

  const LIMIT = 10;
  const WINDOW_SIZE_IN_SECONDS = 60;

  try {
    const currentRequests = await redisConnection.incr(redisKey);

    if (currentRequests === 1) {
      await redisConnection.expire(redisKey, WINDOW_SIZE_IN_SECONDS);
    }

    res.set("X-RateLimit-Limit", LIMIT);
    res.set("X-RateLimit-Remaining", Math.max(0, LIMIT - currentRequests));

    if (currentRequests > LIMIT) {
      req.log.warn(
        { ip, redisKey, currentRequests },
        "Rate limit dépassé pour cette IP",
      );

      return res.status(429).json({
        error: "Trop de requêtes. Réessayez plus tard",
      });
    }

    next();
  } catch (err) {
    console.error("[Rate Limiter]:", err);
    next();
  }
};

module.exports = rateLimiter;
