require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const cookieParser = require('cookie-parser');
const path = require('path');

const { identifyUser } = require('./middleware/auth');
const userRoutes = require('./routes/users');
const documentRoutes = require('./routes/documentRoutes');
const searchRoutes = require('./routes/search');

const app = express();

const allowedOrigins = ['http://localhost:3000'];
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

app.use('/api', identifyUser);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes); 
app.use('/api/search', searchRoutes);

module.exports = app;