export const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export const AI_RATE_LIMITS = {
  '/api/gen-questions': { authenticated: 20, guest: 6 },
  '/api/gen-flowchart': { authenticated: 10, guest: 3 },
  '/api/generate': { authenticated: 20, guest: 4 }
};

export function createOptionalValidateAuth(validateAuth) {
  return function optionalValidateAuth(req, res, next) {
    if (!req.headers.authorization) {
      return next();
    }

    return validateAuth(req, res, (err) => {
      if (err) {
        return res.status(Number(err?.status) || 401).json({
          success: false,
          message: err?.message || 'Unauthorized'
        });
      }

      return next();
    });
  };
}

export function createAiRateLimit({
  store = new Map(),
  rateLimits = AI_RATE_LIMITS,
  windowMs = AI_RATE_LIMIT_WINDOW_MS,
  maxStoreSize = 5000,
  now = () => Date.now()
} = {}) {
  return function aiRateLimit(req, res, next) {
    const limitConfig = rateLimits[req.path];
    if (!limitConfig) {
      return next();
    }

    const isAuthenticated = Boolean(req.headers.authorization && req.headers.userid);
    const limit = isAuthenticated ? limitConfig.authenticated : limitConfig.guest;
    const clientKey = isAuthenticated
      ? `user:${req.headers.userid}`
      : `guest:${req.ip}:${req.get('user-agent') || 'unknown'}`;
    const requestKey = `${req.path}:${clientKey}`;
    const currentTime = now();
    const windowStart = currentTime - windowMs;
    const previousHits = store.get(requestKey) || [];
    const recentHits = previousHits.filter((timestamp) => timestamp > windowStart);

    if (recentHits.length >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((recentHits[0] + windowMs - currentTime) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: `Too many ${isAuthenticated ? 'authenticated' : 'guest'} AI requests. Please wait ${retryAfterSeconds} seconds and try again.`,
        retryAfterSeconds
      });
    }

    recentHits.push(currentTime);
    store.set(requestKey, recentHits);

    if (store.size > maxStoreSize) {
      for (const [key, timestamps] of store.entries()) {
        const activeTimestamps = timestamps.filter((timestamp) => timestamp > windowStart);
        if (activeTimestamps.length === 0) {
          store.delete(key);
        } else {
          store.set(key, activeTimestamps);
        }
      }
    }

    return next();
  };
}

export function getRetryAfterSeconds(err) {
  const retryDelay = err?.errorDetails
    ?.find((detail) => detail?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
    ?.retryDelay;

  if (typeof retryDelay !== 'string') {
    return null;
  }

  const match = retryDelay.match(/(\d+(?:\.\d+)?)s/i);
  if (!match) {
    return null;
  }

  return Math.max(1, Math.ceil(Number(match[1])));
}