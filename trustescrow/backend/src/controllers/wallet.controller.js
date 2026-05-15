const { Wallet, WalletTransaction, User, Escrow } = require('../models');
const { sequelize } = require('../config/database');

class WalletController {
  // @route   GET /api/v1/wallets
  // @desc    Get user's wallet
  // @access  Private
  static async getWallet(req, res) {
    try {
      let wallet = await Wallet.findOne({
        where: { userId: req.user.id },
        include: [{
          model: WalletTransaction,
          as: 'transactions',
          limit: 20,
          order: [['createdAt', 'DESC']]
        }]
      });

      if (!wallet) {
        wallet = await Wallet.create({ userId: req.user.id, balance: 0 });
      }

      res.json({
        success: true,
        data: { wallet }
      });
    } catch (error) {
      console.error('Get wallet error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching wallet'
      });
    }
  }

  // @route   POST /api/v1/wallets/deposit
  // @desc    Deposit funds to wallet
  // @access  Private
  static async deposit(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { amount, currency = 'USD', paymentMethod, paymentDetails } = req.body;

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than 0'
        });
      }

      let wallet = await Wallet.findOne({ where: { userId: req.user.id }, transaction });
      
      if (!wallet) {
        wallet = await Wallet.create({ userId: req.user.id, balance: 0 }, { transaction });
      }

      // Process payment through Stripe/PayPal/etc (implement in production)
      // const paymentResult = await paymentService.processPayment(paymentMethod, paymentDetails);

      // For demo, assume payment successful
      wallet.balance += parseFloat(amount);
      await wallet.save({ transaction });

      // Create transaction record
      const tx = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'deposit',
        amount,
        currency,
        status: 'completed',
        paymentMethod,
        metadata: paymentDetails
      }, { transaction });

      await transaction.commit();

      res.json({
        success: true,
        message: 'Deposit successful',
        data: { wallet, transaction: tx }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Deposit error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error processing deposit'
      });
    }
  }

  // @route   POST /api/v1/wallets/withdraw
  // @desc    Withdraw funds from wallet
  // @access  Private
  static async withdraw(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { amount, currency = 'USD', withdrawalMethod, accountDetails } = req.body;

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than 0'
        });
      }

      let wallet = await Wallet.findOne({ where: { userId: req.user.id }, transaction });
      
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance'
        });
      }

      // Calculate withdrawal fee
      const withdrawalFeePercentage = process.env.WITHDRAWAL_FEE_PERCENTAGE || 1;
      const feeAmount = (amount * withdrawalFeePercentage) / 100;
      const totalDeduction = amount + feeAmount;

      if (wallet.balance < totalDeduction) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance including fees'
        });
      }

      wallet.balance -= totalDeduction;
      await wallet.save({ transaction });

      // Create transaction record
      const tx = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'withdrawal',
        amount: -amount,
        feeAmount,
        currency,
        status: 'pending',
        withdrawalMethod,
        metadata: accountDetails
      }, { transaction });

      await transaction.commit();

      // Process withdrawal (implement in production)
      // await paymentService.processWithdrawal(withdrawalMethod, accountDetails, amount);

      res.json({
        success: true,
        message: 'Withdrawal request submitted',
        data: { wallet, transaction: tx }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Withdraw error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error processing withdrawal'
      });
    }
  }

  // @route   POST /api/v1/wallets/transfer
  // @desc    Transfer funds to another user
  // @access  Private
  static async transfer(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { recipientEmail, recipientId, amount, currency = 'USD', note } = req.body;

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than 0'
        });
      }

      // Find sender wallet
      let senderWallet = await Wallet.findOne({ where: { userId: req.user.id }, transaction });
      
      if (!senderWallet || senderWallet.balance < amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance'
        });
      }

      // Find recipient
      let recipient;
      if (recipientId) {
        recipient = await User.findByPk(recipientId);
      } else if (recipientEmail) {
        recipient = await User.findOne({ where: { email: recipientEmail } });
      }

      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: 'Recipient not found'
        });
      }

      if (recipient.id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot transfer to yourself'
        });
      }

      // Get or create recipient wallet
      let recipientWallet = await Wallet.findOne({ where: { userId: recipient.id }, transaction });
      if (!recipientWallet) {
        recipientWallet = await Wallet.create({ userId: recipient.id, balance: 0 }, { transaction });
      }

      // Deduct from sender
      senderWallet.balance -= parseFloat(amount);
      await senderWallet.save({ transaction });

      // Add to recipient
      recipientWallet.balance += parseFloat(amount);
      await recipientWallet.save({ transaction });

      // Create transaction records
      await WalletTransaction.create({
        walletId: senderWallet.id,
        type: 'transfer_out',
        amount: -amount,
        currency,
        status: 'completed',
        relatedUserId: recipient.id,
        metadata: { note }
      }, { transaction });

      await WalletTransaction.create({
        walletId: recipientWallet.id,
        type: 'transfer_in',
        amount,
        currency,
        status: 'completed',
        relatedUserId: req.user.id,
        metadata: { note }
      }, { transaction });

      await transaction.commit();

      // Emit socket event
      req.app.get('io')?.to(`user:${recipient.id}`).emit('transfer-received', {
        amount,
        from: req.user.id,
        note
      });

      res.json({
        success: true,
        message: 'Transfer completed successfully',
        data: { senderWallet, recipientWallet }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Transfer error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error processing transfer'
      });
    }
  }

  // @route   GET /api/v1/wallets/transactions
  // @desc    Get wallet transactions
  // @access  Private
  static async getTransactions(req, res) {
    try {
      const { type, status, page = 1, limit = 20 } = req.query;

      const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
      
      if (!wallet) {
        return res.json({
          success: true,
          data: { transactions: [], total: 0 }
        });
      }

      const where = { walletId: wallet.id };

      if (type) {
        where.type = type;
      }

      if (status) {
        where.status = status;
      }

      const transactions = await WalletTransaction.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          transactions: transactions.rows,
          total: transactions.count,
          page: parseInt(page),
          totalPages: Math.ceil(transactions.count / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching transactions'
      });
    }
  }

  // @route   GET /api/v1/wallets/stats
  // @desc    Get wallet statistics
  // @access  Private
  static async getStats(req, res) {
    try {
      const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
      
      if (!wallet) {
        return res.json({
          success: true,
          data: { stats: { balance: 0, totalDeposits: 0, totalWithdrawals: 0 } }
        });
      }

      const deposits = await WalletTransaction.findAll({
        where: { walletId: wallet.id, type: 'deposit', status: 'completed' },
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']]
      });

      const withdrawals = await WalletTransaction.findAll({
        where: { walletId: wallet.id, type: 'withdrawal', status: 'completed' },
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']]
      });

      const transfersIn = await WalletTransaction.findAll({
        where: { walletId: wallet.id, type: 'transfer_in', status: 'completed' },
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']]
      });

      const transfersOut = await WalletTransaction.findAll({
        where: { walletId: wallet.id, type: 'transfer_out', status: 'completed' },
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']]
      });

      res.json({
        success: true,
        data: {
          stats: {
            balance: wallet.balance,
            totalDeposits: deposits[0].getDataValue('total') || 0,
            totalWithdrawals: Math.abs(withdrawals[0].getDataValue('total') || 0),
            totalTransfersIn: transfersIn[0].getDataValue('total') || 0,
            totalTransfersOut: Math.abs(transfersOut[0].getDataValue('total') || 0)
          }
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching stats'
      });
    }
  }
}

module.exports = WalletController;
