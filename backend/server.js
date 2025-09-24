require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const { sequelize } = require('./src/models');

app.use(cors());
app.use(express.json());

// Роуты
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/business-units', require('./src/routes/businessUnits'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synced');
  } catch (err) {
    console.error('Database sync error:', err);
  }
});
