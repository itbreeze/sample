// server/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const {
    checkUser,
    getSessionUser,
    getConfig,
    getUserFavorites,  
    toggleFavoriteDoc, 
} = require('../controllers/userCheckController');
const { requireAuth } = require('../utils/auth');

router.post('/checkUser', checkUser);
router.get('/config', getConfig);
router.get('/me', requireAuth, getSessionUser);
router.get('/favorites', requireAuth, getUserFavorites);
router.post('/favorites/toggle', requireAuth, toggleFavoriteDoc);

module.exports = router;
