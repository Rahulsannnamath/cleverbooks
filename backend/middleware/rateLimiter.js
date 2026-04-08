/**
 * Rate Limiter Middleware
 * 
 * In-memory sliding window rate limiter.
 * Default: max 5 requests per minute per IP on the upload endpoint.
 */

const requestCounts = new Map();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entries] of requestCounts) {
    const validEntries = entries.filter((ts) => now - ts < 60000);
    if (validEntries.length === 0) {
      requestCounts.delete(key);
    } else {
      requestCounts.set(key, validEntries);
    }
  }
}, 60000);

/**
 * Create a rate limiter middleware
 * @param {number} maxRequests - Max requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 */
export function createRateLimiter(maxRequests = 5, windowMs = 60000) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.originalUrl}`;
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, []);
    }

    const timestamps = requestCounts.get(key);
    // Remove entries outside the window
    const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= maxRequests) {
      const oldestValid = validTimestamps[0];
      const retryAfter = Math.ceil((oldestValid + windowMs - now) / 1000);

      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        details: `Maximum ${maxRequests} requests per ${windowMs / 1000} seconds. Retry after ${retryAfter}s`,
        retryAfter,
      });
    }

    validTimestamps.push(now);
    requestCounts.set(key, validTimestamps);
    next();
  };
}
