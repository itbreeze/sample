const path = require('path');
const envPath = path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });
const express = require('express');
const cors = require('cors'); 
const cookieParser = require('cookie-parser');

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

app.use(
  '/viewer_doc',
  express.static(path.join(__dirname, 'viewer_doc')) 
);

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes); 
app.use('/api/search', searchRoutes);


module.exports = app;
