const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Dispute = sequelize.define('Dispute', {
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
      'open',
      'under_review',
      'awaiting_evidence',
      'arbitration',
      'resolved',
      'appealed'
    ),
    defaultValue: 'open'
  },
  escrowId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Escrows', key: 'id' }
  },
  openedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  assignedArbitratorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' }
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  resolution: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  decision: {
    type: DataTypes.ENUM('buyer_wins', 'seller_wins', 'split', 'refund'),
    allowNull: true
  },
  buyerRefundAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  sellerPayoutAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  arbitrationFee: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  aiAnalysis: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  aiRecommendation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  aiRiskScore: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true
  },
  evidenceDeadline: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  appealedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['escrowId'] },
    { fields: ['openedBy'] },
    { fields: ['assignedArbitratorId'] }
  ]
});

// Associations
Dispute.associate = (models) => {
  Dispute.belongsTo(models.Escrow, { as: 'escrow', foreignKey: 'escrowId' });
  Dispute.belongsTo(models.User, { as: 'openedByUser', foreignKey: 'openedBy' });
  Dispute.belongsTo(models.User, { as: 'arbitrator', foreignKey: 'assignedArbitratorId' });
  Dispute.hasMany(models.Evidence, { as: 'evidence', foreignKey: 'disputeId' });
};

module.exports = Dispute;
