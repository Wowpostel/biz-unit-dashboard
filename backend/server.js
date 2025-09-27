const express = require('express');
const { sequelize } = require('./src/models');
const authRoutes = require('./src/routes/auth');
require('dotenv').config();

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await sequelize.authenticate();
  console.log(`🚀 Server running on port ${PORT}`);
});
