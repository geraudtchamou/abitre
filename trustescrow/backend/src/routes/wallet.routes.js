const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const WalletController = require('../controllers/wallet.controller');

// Validation middleware
const depositValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP', 'XAF', 'BTC', 'ETH', 'USDT']),
  body('paymentMethod').notEmpty().withMessage('Payment method is required')
];

const withdrawValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP', 'XAF', 'BTC', 'ETH', 'USDT']),
  body('withdrawalMethod').notEmpty().withMessage('Withdrawal method is required')
];

const transferValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP', 'XAF', 'BTC', 'ETH', 'USDT']),
  body('recipientEmail').optional().isEmail(),
  body('recipientId').optional().isUUID()
];

// @route   GET /api/v1/wallets
// @desc    Get user's wallet
// @access  Private
router.get('/', protect, WalletController.getWallet);

// @route   POST /api/v1/wallets/deposit
// @desc    Deposit funds to wallet
// @access  Private
router.post('/deposit', 
  protect, 
  depositValidation, 
  WalletController.deposit
);

// @route   POST /api/v1/wallets/withdraw
// @desc    Withdraw funds from wallet
// @access  Private
router.post('/withdraw', 
  protect, 
  withdrawValidation, 
  WalletController.withdraw
);

// @route   POST /api/v1/wallets/transfer
// @desc    Transfer funds to another user
// @access  Private
router.post('/transfer', 
  protect, 
  transferValidation, 
  WalletController.transfer
);

// @route   GET /api/v1/wallets/transactions
// @desc    Get wallet transactions
// @access  Private
router.get('/transactions', protect, WalletController.getTransactions);

// @route   GET /api/v1/wallets/stats
// @desc    Get wallet statistics
// @access  Private
router.get('/stats', protect, WalletController.getStats);

module.exports = router;
