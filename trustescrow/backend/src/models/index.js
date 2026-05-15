const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const Escrow = require('./Escrow');
const Contract = require('./Contract');
const Dispute = require('./Dispute');
const Wallet = require('./Wallet');
const ChatMessage = require('./ChatMessage');

// Define associations that reference other models
Escrow.associate({ User, Contract, Milestone: sequelize.models.Milestone, EscrowTransaction: sequelize.models.EscrowTransaction });
Contract.associate({ User, Escrow });
Dispute.associate({ Escrow, User, Evidence: sequelize.models.Evidence });
Wallet.associate({ User, WalletTransaction: sequelize.models.WalletTransaction });
ChatMessage.associate({ User });

module.exports = {
  sequelize,
  User,
  Escrow,
  Contract,
  Dispute,
  Wallet,
  ChatMessage
};
