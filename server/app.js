const path = require('path');
const envPath = path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });
const express = require('express');
const cors = require('cors'); 
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { attachAuth, requireAuth } = require('./utils/auth');

const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const searchRoutes = require('./routes/search');

const app = express();

const normalizeOrigin = (value) =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : value;
const defaultOrigins = ['http://localhost:3001', 'http://localhost:4001'];
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const allowedOrigins = Array.from(
  new Set([...defaultOrigins.map(normalizeOrigin), ...envOrigins])
);
const localOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;
const privateNetworkOriginPattern = /^https?:\/\/(?:(?:10|192\.168)\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/;
const corsLogCache = {
  allowed: new Set(),
  blocked: new Set(),
};

const logCorsDecision = (origin, allowed) => {
  const actual = normalizeOrigin(origin);
  if (!actual) return;
  const cacheSet = allowed ? corsLogCache.allowed : corsLogCache.blocked;
  if (cacheSet.has(actual)) return;
  cacheSet.add(actual);
  const verb = allowed ? '허용' : '차단';
  console.log(`[CORS] ${verb} origin=${actual}`);
};
app.use(
  cors({
    origin: function (origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);
      const isLocalOrigin = !origin || localOriginPattern.test(normalizedOrigin);
      const isPrivateNetworkOrigin = privateNetworkOriginPattern.test(normalizedOrigin);
      const isExplicitlyAllowed = allowedOrigins.indexOf(normalizedOrigin) !== -1;
      if (isLocalOrigin || isPrivateNetworkOrigin || isExplicitlyAllowed) {
        logCorsDecision(origin, true);
        callback(null, true);
      } else {
        logCorsDecision(origin, false);
        const msg = 'CORS 정책: 허용되지 않은 사용자 IP';
        callback(new Error(msg), false);
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachAuth);

app.use(
  '/viewer_doc',
  requireAuth,
  express.static(path.join(__dirname, 'viewer_doc')) 
);

app.use('/api/auth', authRoutes);
app.use('/api/documents', requireAuth, documentRoutes); 
app.use('/api/search', requireAuth, searchRoutes);


module.exports = app;
