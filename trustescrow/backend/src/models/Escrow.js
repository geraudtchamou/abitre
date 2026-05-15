const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Escrow = sequelize.define('Escrow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(
      'draft',
      'pending',
      'active',
      'completed',
      'disputed',
      'refunded',
      'cancelled',
      'frozen'
    ),
    defaultValue: 'draft'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: { min: 0 }
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD',
    validate: {
      isIn: [['USD', 'EUR', 'GBP', 'XAF', 'BTC', 'ETH', 'USDT']]
    }
  },
  buyerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  sellerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  contractId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Contracts', key: 'id' }
  },
  milestoneBased: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  autoReleaseDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1 }
  },
  releasedAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  refundedAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  feeAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true
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
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['buyerId'] },
    { fields: ['sellerId'] },
    { fields: ['createdAt'] }
  ]
});

// Associations
Escrow.associate = (models) => {
  Escrow.belongsTo(models.User, { as: 'buyer', foreignKey: 'buyerId' });
  Escrow.belongsTo(models.User, { as: 'seller', foreignKey: 'sellerId' });
  Escrow.belongsTo(models.Contract, { as: 'contract', foreignKey: 'contractId' });
  Escrow.hasMany(models.Milestone, { as: 'milestones', foreignKey: 'escrowId' });
  Escrow.hasMany(models.EscrowTransaction, { as: 'transactions', foreignKey: 'escrowId' });
};

module.exports = Escrow;
