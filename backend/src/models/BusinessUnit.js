module.exports = (sequelize, DataTypes) => {
    const BusinessUnit = sequelize.define('BusinessUnit', {
      name: DataTypes.STRING,
      turnover: DataTypes.FLOAT,
      profitSource: DataTypes.STRING,
      priority: DataTypes.ENUM('high', 'medium', 'low'),
      timeEstimate: DataTypes.INTEGER,
      effortEstimate: DataTypes.INTEGER,
      costEstimate: DataTypes.INTEGER,
      goal: DataTypes.TEXT,
      responsibleId: DataTypes.INTEGER
    });
  
    return BusinessUnit;
  };
  