const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Contract = sequelize.define('Contract', {
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
  type: {
    type: DataTypes.ENUM(
      'freelance',
      'marketplace',
      'vehicle_sale',
      'real_estate',
      'saas',
      'service'
    ),
    defaultValue: 'freelance'
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'active', 'completed', 'terminated'),
    defaultValue: 'draft'
  },
  templateId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  terms: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  milestones: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  refundTerms: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  arbitrationConditions: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  penaltyRules: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  autoReleaseConditions: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'en'
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
  buyerSignature: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sellerSignature: {
    type: DataTypes.STRING,
    allowNull: true
  },
  buyerSignedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sellerSignedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  pdfUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  aiGenerated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['buyerId'] },
    { fields: ['sellerId'] }
  ]
});

// Associations
Contract.associate = (models) => {
  Contract.belongsTo(models.User, { as: 'buyer', foreignKey: 'buyerId' });
  Contract.belongsTo(models.User, { as: 'seller', foreignKey: 'sellerId' });
  Contract.hasMany(models.Escrow, { as: 'escrows', foreignKey: 'contractId' });
};

module.exports = Contract;
