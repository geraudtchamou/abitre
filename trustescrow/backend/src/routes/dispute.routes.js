const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth.middleware');
const DisputeController = require('../controllers/dispute.controller');

// Validation middleware
const openDisputeValidation = [
  body('escrowId').isUUID().withMessage('Valid escrow ID is required'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('description').trim().notEmpty().withMessage('Description is required')
];

const evidenceValidation = [
  body('type').isIn(['document', 'image', 'video', 'audio', 'link', 'text']).withMessage('Invalid evidence type'),
  body('content').notEmpty().withMessage('Content is required'),
  body('description').optional()
];

const assignArbitratorValidation = [
  body('arbitratorId').isUUID().withMessage('Valid arbitrator ID is required')
];

const resolveDisputeValidation = [
  body('decision').isIn(['buyer_wins', 'seller_wins', 'split', 'refund']).withMessage('Invalid decision'),
  body('reasoning').trim().notEmpty().withMessage('Reasoning is required'),
  body('fundSplit').optional()
];

// @route   POST /api/v1/disputes
// @desc    Open a new dispute
// @access  Private
router.post('/', 
  protect, 
  openDisputeValidation, 
  DisputeController.openDispute
);

// @route   GET /api/v1/disputes
// @desc    Get disputes for user
// @access  Private
router.get('/', protect, DisputeController.getDisputes);

// @route   GET /api/v1/disputes/:id
// @desc    Get single dispute
// @access  Private
router.get('/:id', protect, DisputeController.getDispute);

// @route   POST /api/v1/disputes/:id/evidence
// @desc    Submit evidence for dispute
// @access  Private
router.post('/:id/evidence', 
  protect, 
  evidenceValidation, 
  DisputeController.submitEvidence
);

// @route   PUT /api/v1/disputes/:id/assign
// @desc    Assign arbitrator to dispute
// @access  Private (Admin/Moderator)
router.put('/:id/assign', 
  protect, 
  authorize('admin', 'moderator'),
  assignArbitratorValidation,
  DisputeController.assignArbitrator
);

// @route   PUT /api/v1/disputes/:id/resolve
// @desc    Resolve dispute with decision
// @access  Private (Arbitrator/Admin)
router.put('/:id/resolve', 
  protect, 
  authorize('arbitrator', 'admin'),
  resolveDisputeValidation,
  DisputeController.resolveDispute
);

// @route   PUT /api/v1/disputes/:id/appeal
// @desc    Appeal a dispute decision
// @access  Private
router.put('/:id/appeal', protect, DisputeController.appealDispute);

module.exports = router;
