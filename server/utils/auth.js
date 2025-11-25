const crypto = require('crypto');

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'epnid_auth';
const DEFAULT_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS || 1000 * 60 * 60 * 8); // 8h
const rawSecret =
  process.env.AUTH_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  'change-me';
const AUTH_SECRET = String(rawSecret || '').trim();

if (!process.env.AUTH_TOKEN_SECRET && !process.env.JWT_SECRET) {
  console.warn(
    '[auth] AUTH_TOKEN_SECRET is not configured. A fallback secret is being used; set AUTH_TOKEN_SECRET in the server .env for stronger security.'
  );
}

const cookieBaseOptions = {
  httpOnly: true,
  sameSite: (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase(),
  secure: String(process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true',
  path: '/',
};

const parseBearer = (authorization) => {
  if (!authorization || typeof authorization !== 'string') return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme && scheme.toLowerCase() === 'bearer' && token) return token.trim();
  return null;
};

const timingSafeEqual = (a, b) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

function signToken(payload, ttlMs = DEFAULT_TTL_MS) {
  if (!AUTH_SECRET) {
    throw new Error('AUTH_TOKEN_SECRET is missing');
  }

  const exp = Date.now() + ttlMs;
  const body = { ...payload, exp };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(encoded).digest('base64url');
  if (!timingSafeEqual(expectedSig, sig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function setAuthCookie(res, payload, ttlMs = DEFAULT_TTL_MS) {
  const token = signToken(payload, ttlMs);
  res.cookie(AUTH_COOKIE, token, { ...cookieBaseOptions, maxAge: ttlMs });
  return token;
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, cookieBaseOptions);
}

function attachAuth(req, res, next) {
  const token =
    (req.cookies && req.cookies[AUTH_COOKIE]) ||
    parseBearer(req.headers?.authorization);

  const payload = verifyToken(token);
  if (payload) {
    req.authUser = payload;
  } else if (token) {
    clearAuthCookie(res);
  }

  next();
}

function requireAuth(req, res, next) {
  if (req.authUser) return next();

  return res.status(401).json({
    ok: false,
    message: 'UNAUTHORIZED',
  });
}

module.exports = {
  setAuthCookie,
  clearAuthCookie,
  attachAuth,
  requireAuth,
};
