const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth.middleware');
const EscrowController = require('../controllers/escrow.controller');

// Validation middleware
const createEscrowValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'XAF', 'BTC', 'ETH', 'USDT']).withMessage('Invalid currency'),
  body('sellerId').isUUID().withMessage('Valid seller ID is required')
];

// @route   POST /api/v1/escrows
// @desc    Create a new escrow
// @access  Private
router.post('/', 
  protect, 
  createEscrowValidation, 
  EscrowController.createEscrow
);

// @route   GET /api/v1/escrows
// @desc    Get all escrows for user
// @access  Private
router.get('/', protect, EscrowController.getEscrows);

// @route   GET /api/v1/escrows/stats
// @desc    Get escrow statistics
// @access  Private
router.get('/stats', protect, EscrowController.getStats);

// @route   GET /api/v1/escrows/:id
// @desc    Get single escrow
// @access  Private
router.get('/:id', protect, EscrowController.getEscrow);

// @route   PUT /api/v1/escrows/:id/fund
// @desc    Fund an escrow
// @access  Private
router.put('/:id/fund', protect, EscrowController.fundEscrow);

// @route   PUT /api/v1/escrows/:id/release
// @desc    Release escrow funds
// @access  Private
router.put('/:id/release', protect, EscrowController.releaseEscrow);

// @route   PUT /api/v1/escrows/:id/dispute
// @desc    Open dispute on escrow
// @access  Private
router.put('/:id/dispute', protect, EscrowController.openDispute);

// @route   PUT /api/v1/escrows/:id/cancel
// @desc    Cancel an escrow
// @access  Private
router.put('/:id/cancel', protect, EscrowController.cancelEscrow);

// @route   DELETE /api/v1/escrows/:id
// @desc    Delete an escrow (draft only)
// @access  Private
router.delete('/:id', protect, EscrowController.deleteEscrow);

module.exports = router;
