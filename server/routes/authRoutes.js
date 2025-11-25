const express = require('express');
const router = express.Router();
const userCheckController = require('../controllers/userCheckController');
const { requireAuth } = require('../utils/auth');

router.post('/checkUser', userCheckController.checkUser);
router.get('/config', userCheckController.getConfig);
router.get('/me', requireAuth, userCheckController.getSessionUser);

module.exports = router;
