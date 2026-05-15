const { Dispute, Escrow, User, Evidence } = require('../models');
const { sequelize } = require('../config/database');

class DisputeController {
  // @route   POST /api/v1/disputes
  // @desc    Open a new dispute
  // @access  Private
  static async openDispute(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { escrowId, reason, description } = req.body;

      const escrow = await Escrow.findByPk(escrowId, { transaction });

      if (!escrow) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      // Check permission
      if (escrow.buyerId !== req.user.id && escrow.sellerId !== req.user.id) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Not authorized to open dispute'
        });
      }

      if (escrow.status !== 'active') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot open dispute on escrow with status: ${escrow.status}`
        });
      }

      // Update escrow status
      escrow.status = 'disputed';
      await escrow.save({ transaction });

      // Create dispute
      const dispute = await Dispute.create({
        escrowId,
        openedBy: req.user.id,
        reason,
        description,
        status: 'open'
      }, { transaction });

      await transaction.commit();

      // Emit socket events
      req.app.get('io')?.to(`escrow:${escrow.id}`).emit('dispute-opened', {
        disputeId: dispute.id,
        openedBy: req.user.id
      });

      res.status(201).json({
        success: true,
        data: { dispute }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Open dispute error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error opening dispute'
      });
    }
  }

  // @route   GET /api/v1/disputes
  // @desc    Get disputes for user
  // @access  Private
  static async getDisputes(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;

      const where = {};

      // Regular users see disputes they're involved in
      if (req.user.role === 'user') {
        where[sequelize.Op.or] = [
          { openedBy: req.user.id },
          { '$escrow.buyerId$': req.user.id },
          { '$escrow.sellerId$': req.user.id }
        ];
      } else if (req.user.role === 'moderator' || req.user.role === 'arbitrator') {
        // Moderators and arbitrators see all disputes
      }

      if (status) {
        where.status = status;
      }

      const disputes = await Dispute.findAndCountAll({
        where,
        include: [
          { model: Escrow, as: 'escrow', include: [
            { model: User, as: 'buyer', attributes: ['id', 'firstName', 'lastName'] },
            { model: User, as: 'seller', attributes: ['id', 'firstName', 'lastName'] }
          ]},
          { model: User, as: 'openedBy', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName'] },
          { model: Evidence, as: 'evidence' }
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          disputes: disputes.rows,
          total: disputes.count,
          page: parseInt(page),
          totalPages: Math.ceil(disputes.count / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get disputes error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching disputes'
      });
    }
  }

  // @route   GET /api/v1/disputes/:id
  // @desc    Get single dispute
  // @access  Private
  static async getDispute(req, res) {
    try {
      const dispute = await Dispute.findByPk(req.params.id, {
        include: [
          { model: Escrow, as: 'escrow', include: [
            { model: User, as: 'buyer' },
            { model: User, as: 'seller' }
          ]},
          { model: User, as: 'openedBy' },
          { model: User, as: 'assignedTo' },
          { model: Evidence, as: 'evidence' }
        ]
      });

      if (!dispute) {
        return res.status(404).json({
          success: false,
          message: 'Dispute not found'
        });
      }

      // Check permission
      const canView = 
        dispute.openedBy === req.user.id ||
        dispute.escrow.buyerId === req.user.id ||
        dispute.escrow.sellerId === req.user.id ||
        ['moderator', 'arbitrator', 'admin'].includes(req.user.role);

      if (!canView) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this dispute'
        });
      }

      res.json({
        success: true,
        data: { dispute }
      });
    } catch (error) {
      console.error('Get dispute error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching dispute'
      });
    }
  }

  // @route   POST /api/v1/disputes/:id/evidence
  // @desc    Submit evidence for dispute
  // @access  Private
  static async submitEvidence(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { type, content, description } = req.body;

      const dispute = await Dispute.findByPk(req.params.id, {
        include: [{ model: Escrow, as: 'escrow' }]
      });

      if (!dispute) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Dispute not found'
        });
      }

      // Check permission
      const canSubmit = 
        dispute.openedBy === req.user.id ||
        dispute.escrow.buyerId === req.user.id ||
        dispute.escrow.sellerId === req.user.id ||
        ['moderator', 'arbitrator', 'admin'].includes(req.user.role);

      if (!canSubmit) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Not authorized to submit evidence'
        });
      }

      if (['open', 'awaiting_evidence'].includes(dispute.status)) {
        dispute.status = 'under_review';
        await dispute.save({ transaction });
      }

      const evidence = await Evidence.create({
        disputeId: dispute.id,
        submittedBy: req.user.id,
        type,
        content,
        description
      }, { transaction });

      await transaction.commit();

      // Emit socket events
      req.app.get('io')?.to(`dispute:${dispute.id}`).emit('evidence-submitted', {
        disputeId: dispute.id,
        evidenceId: evidence.id
      });

      res.status(201).json({
        success: true,
        data: { evidence }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Submit evidence error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error submitting evidence'
      });
    }
  }

  // @route   PUT /api/v1/disputes/:id/assign
  // @desc    Assign arbitrator to dispute
  // @access  Private (Admin/Moderator)
  static async assignArbitrator(req, res) {
    try {
      const { arbitratorId } = req.body;

      const dispute = await Dispute.findByPk(req.params.id);

      if (!dispute) {
        return res.status(404).json({
          success: false,
          message: 'Dispute not found'
        });
      }

      const arbitrator = await User.findByPk(arbitratorId);

      if (!arbitrator || arbitrator.role !== 'arbitrator') {
        return res.status(400).json({
          success: false,
          message: 'Invalid arbitrator'
        });
      }

      dispute.assignedTo = arbitratorId;
      dispute.status = 'arbitration';
      await dispute.save();

      // Emit socket events
      req.app.get('io')?.to(`dispute:${dispute.id}`).emit('arbitrator-assigned', {
        disputeId: dispute.id,
        arbitratorId
      });

      res.json({
        success: true,
        message: 'Arbitrator assigned successfully',
        data: { dispute }
      });
    } catch (error) {
      console.error('Assign arbitrator error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error assigning arbitrator'
      });
    }
  }

  // @route   PUT /api/v1/disputes/:id/resolve
  // @desc    Resolve dispute with decision
  // @access  Private (Arbitrator/Admin)
  static async resolveDispute(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { decision, reasoning, fundSplit } = req.body;

      const dispute = await Dispute.findByPk(req.params.id, {
        include: [{ model: Escrow, as: 'escrow' }]
      });

      if (!dispute) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Dispute not found'
        });
      }

      // Check permission
      if (req.user.role !== 'arbitrator' && req.user.role !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Not authorized to resolve dispute'
        });
      }

      if (dispute.status !== 'arbitration' && dispute.status !== 'under_review') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot resolve dispute with status: ${dispute.status}`
        });
      }

      // Update dispute
      dispute.decision = decision;
      dispute.reasoning = reasoning;
      dispute.status = 'resolved';
      dispute.resolvedAt = new Date();
      await dispute.save({ transaction });

      // Handle fund split
      const escrow = dispute.escrow;
      const remainingAmount = parseFloat(escrow.amount) - parseFloat(escrow.releasedAmount);

      if (fundSplit) {
        const { buyerAmount, sellerAmount } = fundSplit;

        // Transfer to buyer
        if (buyerAmount > 0) {
          let buyerWallet = await Wallet.findOne({ where: { userId: escrow.buyerId }, transaction });
          if (!buyerWallet) {
            buyerWallet = await Wallet.create({ userId: escrow.buyerId, balance: 0 }, { transaction });
          }
          buyerWallet.balance += buyerAmount;
          await buyerWallet.save({ transaction });
        }

        // Transfer to seller
        if (sellerAmount > 0) {
          let sellerWallet = await Wallet.findOne({ where: { userId: escrow.sellerId }, transaction });
          if (!sellerWallet) {
            sellerWallet = await Wallet.create({ userId: escrow.sellerId, balance: 0 }, { transaction });
          }
          sellerWallet.balance += sellerAmount;
          await sellerWallet.save({ transaction });
        }
      }

      // Update escrow status
      escrow.status = 'completed';
      escrow.completedAt = new Date();
      await escrow.save({ transaction });

      await transaction.commit();

      // Emit socket events
      req.app.get('io')?.to(`dispute:${dispute.id}`).emit('dispute-resolved', {
        disputeId: dispute.id,
        decision
      });

      res.json({
        success: true,
        message: 'Dispute resolved successfully',
        data: { dispute }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Resolve dispute error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error resolving dispute'
      });
    }
  }

  // @route   PUT /api/v1/disputes/:id/appeal
  // @desc    Appeal a dispute decision
  // @access  Private
  static async appealDispute(req, res) {
    try {
      const { reason } = req.body;

      const dispute = await Dispute.findByPk(req.params.id);

      if (!dispute) {
        return res.status(404).json({
          success: false,
          message: 'Dispute not found'
        });
      }

      // Check permission
      if (dispute.openedBy !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Only the party who opened the dispute can appeal'
        });
      }

      if (dispute.status !== 'resolved') {
        return res.status(400).json({
          success: false,
          message: 'Can only appeal resolved disputes'
        });
      }

      dispute.status = 'appealed';
      dispute.appealReason = reason;
      await dispute.save();

      // Emit socket events
      req.app.get('io')?.to(`dispute:${dispute.id}`).emit('dispute-appealed', {
        disputeId: dispute.id
      });

      res.json({
        success: true,
        message: 'Appeal submitted successfully',
        data: { dispute }
      });
    } catch (error) {
      console.error('Appeal dispute error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error submitting appeal'
      });
    }
  }
}

module.exports = DisputeController;
