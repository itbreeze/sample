require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { identifyUser } = require('./middleware/auth');
const userRoutes = require('./routes/users');
const folderRoutes = require('./routes/folders');
const searchRoutes = require('./routes/search');

const app = express();

// CORS 설정
const allowedOrigins = ['http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            const msg = 'CORS 정책: 허용되지 않은 origin';
            callback(new Error(msg), false);
        }
    },
    credentials: true,
}));

// 공통 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API 라우터 연결
app.use('/api', identifyUser);
app.use('/api/users', userRoutes);
app.use('/folders', folderRoutes);
app.use('/api/search', searchRoutes);

module.exports = app;