const path = require('path');
const envPath = path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });
const express = require('express');
const cors = require('cors'); 
const cookieParser = require('cookie-parser');
const { attachAuth, requireAuth } = require('./utils/auth');

const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const searchRoutes = require('./routes/search');

const app = express();

const allowedOrigins = ['http://localhost:3001'];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
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
