const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'Users', key: 'id' }
  },
  balanceUSD: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  balanceEUR: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  balanceGBP: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  balanceXAF: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  balanceBTC: {
    type: DataTypes.DECIMAL(18, 8),
    defaultValue: 0.00000000
  },
  balanceETH: {
    type: DataTypes.DECIMAL(18, 8),
    defaultValue: 0.00000000
  },
  balanceUSDT: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  lockedAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  isFrozen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  frozenAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  frozenBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' }
  },
  frozenReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  stripeAccountId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paypalEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cryptoAddresses: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['userId'] }
  ]
});

// Associations
Wallet.associate = (models) => {
  Wallet.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
  Wallet.hasMany(models.WalletTransaction, { as: 'transactions', foreignKey: 'walletId' });
};

module.exports = Wallet;
