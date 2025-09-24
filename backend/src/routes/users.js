const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Получить всех пользователей (только для admin)
router.get('/', authenticate, authorize(['admin']), async (req, res) => {
  const users = await User.findAll();
  res.json(users);
});

module.exports = router;
