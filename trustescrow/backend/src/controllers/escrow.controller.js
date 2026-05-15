const { Escrow, User, Contract, Milestone, Wallet } = require('../models');
const { sequelize } = require('../config/database');

class EscrowController {
  // @route   POST /api/v1/escrows
  // @desc    Create a new escrow
  // @access  Private
  static async createEscrow(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        title,
        description,
        amount,
        currency,
        sellerId,
        milestoneBased,
        milestones,
        autoReleaseDays,
        contractId
      } = req.body;

      // Validate buyer and seller
      if (req.user.id === sellerId) {
        return res.status(400).json({
          success: false,
          message: 'Buyer and seller cannot be the same'
        });
      }

      const seller = await User.findByPk(sellerId);
      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found'
        });
      }

      // Calculate fee
      const feePercentage = process.env.ESCROW_FEE_PERCENTAGE || 2.5;
      const feeAmount = (amount * feePercentage) / 100;

      // Create escrow
      const escrow = await Escrow.create({
        title,
        description,
        amount,
        currency,
        buyerId: req.user.id,
        sellerId,
        milestoneBased,
        autoReleaseDays,
        contractId,
        feeAmount,
        status: 'pending'
      }, { transaction });

      // Create milestones if provided
      if (milestoneBased && milestones && milestones.length > 0) {
        for (const milestoneData of milestones) {
          await Milestone.create({
            escrowId: escrow.id,
            title: milestoneData.title,
            description: milestoneData.description,
            amount: milestoneData.amount,
            status: 'pending'
          }, { transaction });
        }
      }

      await transaction.commit();

      // Emit socket event for real-time notification
      req.app.get('io')?.to(`user:${sellerId}`).emit('new-escrow', {
        escrowId: escrow.id,
        buyerId: req.user.id
      });

      res.status(201).json({
        success: true,
        data: { escrow }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Create escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error creating escrow'
      });
    }
  }

  // @route   GET /api/v1/escrows
  // @desc    Get all escrows for user
  // @access  Private
  static async getEscrows(req, res) {
    try {
      const { status, page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC' } = req.query;

      const where = {
        [sequelize.Op.or]: [
          { buyerId: req.user.id },
          { sellerId: req.user.id }
        ]
      };

      if (status) {
        where.status = status;
      }

      const escrows = await Escrow.findAndCountAll({
        where,
        include: [
          { model: User, as: 'buyer', attributes: ['id', 'firstName', 'lastName', 'email', 'trustScore'] },
          { model: User, as: 'seller', attributes: ['id', 'firstName', 'lastName', 'email', 'trustScore'] },
          { model: Contract, as: 'contract', attributes: ['id', 'title', 'status'] },
          { model: Milestone, as: 'milestones' }
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [[sortBy, order]]
      });

      res.json({
        success: true,
        data: {
          escrows: escrows.rows,
          total: escrows.count,
          page: parseInt(page),
          totalPages: Math.ceil(escrows.count / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get escrows error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching escrows'
      });
    }
  }

  // @route   GET /api/v1/escrows/:id
  // @desc    Get single escrow
  // @access  Private
  static async getEscrow(req, res) {
    try {
      const escrow = await Escrow.findByPk(req.params.id, {
        include: [
          { model: User, as: 'buyer', attributes: ['id', 'firstName', 'lastName', 'email', 'trustScore', 'avatar'] },
          { model: User, as: 'seller', attributes: ['id', 'firstName', 'lastName', 'email', 'trustScore', 'avatar'] },
          { model: Contract, as: 'contract' },
          { model: Milestone, as: 'milestones' }
        ]
      });

      if (!escrow) {
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      // Check permission
      if (escrow.buyerId !== req.user.id && escrow.sellerId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this escrow'
        });
      }

      res.json({
        success: true,
        data: { escrow }
      });
    } catch (error) {
      console.error('Get escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching escrow'
      });
    }
  }

  // @route   PUT /api/v1/escrows/:id/fund
  // @desc    Fund an escrow
  // @access  Private
  static async fundEscrow(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const escrow = await Escrow.findByPk(req.params.id, { transaction });

      if (!escrow) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      if (escrow.buyerId !== req.user.id) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only buyer can fund this escrow'
        });
      }

      if (escrow.status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot fund escrow with status: ${escrow.status}`
        });
      }

      // Get buyer's wallet
      let wallet = await Wallet.findOne({ where: { userId: req.user.id }, transaction });
      
      if (!wallet || wallet.balance < escrow.amount) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Insufficient funds in wallet'
        });
      }

      // Deduct from buyer's wallet
      wallet.balance -= escrow.amount;
      await wallet.save({ transaction });

      // Update escrow status
      escrow.status = 'active';
      await escrow.save({ transaction });

      await transaction.commit();

      // Emit socket events
      req.app.get('io')?.to(`escrow:${escrow.id}`).emit('escrow-funded', {
        escrowId: escrow.id,
        amount: escrow.amount
      });

      res.json({
        success: true,
        message: 'Escrow funded successfully',
        data: { escrow }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Fund escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error funding escrow'
      });
    }
  }

  // @route   PUT /api/v1/escrows/:id/release
  // @desc    Release escrow funds
  // @access  Private
  static async releaseEscrow(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { amount, milestoneId } = req.body;

      const escrow = await Escrow.findByPk(req.params.id, { 
        include: [{ model: Milestone, as: 'milestones' }],
        transaction 
      });

      if (!escrow) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      if (escrow.sellerId !== req.user.id && req.user.role !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only seller or admin can release funds'
        });
      }

      if (escrow.status !== 'active') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot release funds from escrow with status: ${escrow.status}`
        });
      }

      let releaseAmount = amount;

      // Handle milestone-based release
      if (milestoneId) {
        const milestone = escrow.milestones.find(m => m.id === milestoneId);
        if (!milestone) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: 'Milestone not found'
          });
        }
        releaseAmount = milestone.amount;
        milestone.status = 'completed';
        await milestone.save({ transaction });
      }

      // Get seller's wallet
      let sellerWallet = await Wallet.findOne({ where: { userId: escrow.sellerId }, transaction });
      if (!sellerWallet) {
        sellerWallet = await Wallet.create({ userId: escrow.sellerId, balance: 0 }, { transaction });
      }

      // Transfer funds to seller
      sellerWallet.balance += parseFloat(releaseAmount);
      await sellerWallet.save({ transaction });

      escrow.releasedAmount = parseFloat(escrow.releasedAmount) + parseFloat(releaseAmount);
      
      // Check if fully released
      if (parseFloat(escrow.releasedAmount) >= parseFloat(escrow.amount)) {
        escrow.status = 'completed';
        escrow.completedAt = new Date();
      }

      await escrow.save({ transaction });

      await transaction.commit();

      // Emit socket events
      req.app.get('io')?.to(`escrow:${escrow.id}`).emit('funds-released', {
        escrowId: escrow.id,
        amount: releaseAmount
      });

      res.json({
        success: true,
        message: 'Funds released successfully',
        data: { escrow }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Release escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error releasing funds'
      });
    }
  }

  // @route   PUT /api/v1/escrows/:id/dispute
  // @desc    Open dispute on escrow
  // @access  Private
  static async openDispute(req, res) {
    try {
      const { reason, description } = req.body;

      const escrow = await Escrow.findByPk(req.params.id);

      if (!escrow) {
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      // Check permission
      if (escrow.buyerId !== req.user.id && escrow.sellerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to open dispute'
        });
      }

      if (escrow.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Cannot open dispute on escrow with status: ${escrow.status}`
        });
      }

      // Update escrow status
      escrow.status = 'disputed';
      await escrow.save();

      // Create dispute (will be implemented in dispute controller)
      // const dispute = await Dispute.create({ ... });

      // Emit socket events
      req.app.get('io')?.to(`escrow:${escrow.id}`).emit('dispute-opened', {
        escrowId: escrow.id,
        openedBy: req.user.id
      });

      res.json({
        success: true,
        message: 'Dispute opened successfully',
        data: { escrow }
      });
    } catch (error) {
      console.error('Open dispute error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error opening dispute'
      });
    }
  }

  // @route   PUT /api/v1/escrows/:id/cancel
  // @desc    Cancel an escrow
  // @access  Private
  static async cancelEscrow(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const escrow = await Escrow.findByPk(req.params.id, { transaction });

      if (!escrow) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      if (escrow.buyerId !== req.user.id) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only buyer can cancel escrow'
        });
      }

      if (escrow.status !== 'pending' && escrow.status !== 'active') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot cancel escrow with status: ${escrow.status}`
        });
      }

      // Refund if already funded
      if (escrow.status === 'active' && escrow.releasedAmount === 0) {
        let buyerWallet = await Wallet.findOne({ where: { userId: req.user.id }, transaction });
        if (buyerWallet) {
          buyerWallet.balance += parseFloat(escrow.amount);
          await buyerWallet.save({ transaction });
        }
      }

      escrow.status = 'cancelled';
      escrow.cancelledAt = new Date();
      await escrow.save({ transaction });

      await transaction.commit();

      // Emit socket events
      req.app.get('io')?.to(`escrow:${escrow.id}`).emit('escrow-cancelled', {
        escrowId: escrow.id
      });

      res.json({
        success: true,
        message: 'Escrow cancelled successfully',
        data: { escrow }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Cancel escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error cancelling escrow'
      });
    }
  }

  // @route   DELETE /api/v1/escrows/:id
  // @desc    Delete an escrow (draft only)
  // @access  Private
  static async deleteEscrow(req, res) {
    try {
      const escrow = await Escrow.findByPk(req.params.id);

      if (!escrow) {
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      if (escrow.buyerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Only buyer can delete escrow'
        });
      }

      if (escrow.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Can only delete draft escrows'
        });
      }

      await escrow.destroy();

      res.json({
        success: true,
        message: 'Escrow deleted successfully'
      });
    } catch (error) {
      console.error('Delete escrow error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error deleting escrow'
      });
    }
  }

  // @route   GET /api/v1/escrows/stats
  // @desc    Get escrow statistics
  // @access  Private
  static async getStats(req, res) {
    try {
      const stats = await Escrow.findAll({
        where: {
          [sequelize.Op.or]: [
            { buyerId: req.user.id },
            { sellerId: req.user.id }
          ]
        },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
        ],
        group: ['status']
      });

      res.json({
        success: true,
        data: { stats }
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

module.exports = EscrowController;
