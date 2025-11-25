const express = require('express');
const router = express.Router();
const userCheckController = require('../controllers/userCheckController');

router.post('/checkUser', userCheckController.checkUser);
router.get('/config', userCheckController.getConfig);

module.exports = router;
