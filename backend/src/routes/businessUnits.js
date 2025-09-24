const express = require('express');
const router = express.Router();
const { BusinessUnit } = require('../models');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, async (req, res) => {
  const units = await BusinessUnit.findAll();
  res.json(units);
});

router.post('/', authenticate, async (req, res) => {
  try {
    const unit = await BusinessUnit.create(req.body);
    res.json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const unit = await BusinessUnit.findByPk(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Not found' });
    await unit.update(req.body);
    res.json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const unit = await BusinessUnit.findByPk(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Not found' });
    await unit.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
