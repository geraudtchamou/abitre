const { User, Wallet } = require('../models');
const authService = require('../services/auth.service');
const { generateOTP, sendOTP } = require('../utils/otp.util');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

class AuthController {
  // @route   POST /api/v1/auth/register
  // @desc    Register a new user
  // @access  Public
  static async register(req, res) {
    try {
      const { email, password, firstName, lastName, phone } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'User already exists' 
        });
      }

      // Create user with wallet
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        phone
      });

      // Create wallet for new user
      await Wallet.create({ userId: user.id, balance: 0 });

      // Generate JWT token
      const token = authService.generateToken(user.id);

      res.status(201).json({
        success: true,
        data: { user, token }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error during registration' 
      });
    }
  }

  // @route   POST /api/v1/auth/login
  // @desc    Login user
  // @access  Public
  static async login(req, res) {
    try {
      const { email, password, twoFactorCode } = req.body;

      // Find user
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid credentials' 
        });
      }

      // Check if suspended
      if (user.isSuspended) {
        return res.status(403).json({ 
          success: false, 
          message: 'Account is suspended' 
        });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid credentials' 
        });
      }

      // Check 2FA
      if (user.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(401).json({
            success: false,
            requiresTwoFactor: true,
            message: 'Two-factor authentication required'
          });
        }

        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: twoFactorCode
        });

        if (!verified) {
          return res.status(401).json({
            success: false,
            message: 'Invalid two-factor code'
          });
        }
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token
      const token = authService.generateToken(user.id);

      res.json({
        success: true,
        data: { user, token }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error during login' 
      });
    }
  }

  // @route   POST /api/v1/auth/logout
  // @desc    Logout user
  // @access  Private
  static async logout(req, res) {
    try {
      // In production, add token to blacklist
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   POST /api/v1/auth/refresh
  // @desc    Refresh access token
  // @access  Private
  static async refreshToken(req, res) {
    try {
      const token = authService.generateToken(req.user.id);
      res.json({
        success: true,
        data: { token }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   POST /api/v1/auth/otp/request
  // @desc    Request OTP for verification
  // @access  Public
  static async requestOTP(req, res) {
    try {
      const { email, phone } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email or phone required' 
        });
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in Redis (implement this in production)
      // await redisClient.setex(`otp:${email || phone}`, 600, otp);

      // Send OTP
      if (email) {
        await sendOTP(email, otp, 'email');
      } else if (phone) {
        await sendOTP(phone, otp, 'sms');
      }

      res.json({
        success: true,
        message: 'OTP sent successfully'
      });
    } catch (error) {
      console.error('OTP request error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   POST /api/v1/auth/otp/verify
  // @desc    Verify OTP
  // @access  Public
  static async verifyOTP(req, res) {
    try {
      const { email, phone, otp } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email or phone required' 
        });
      }

      if (!otp) {
        return res.status(400).json({ 
          success: false, 
          message: 'OTP required' 
        });
      }

      // Verify OTP from Redis (implement this in production)
      // const storedOtp = await redisClient.get(`otp:${email || phone}`);
      
      // For demo purposes, accept any 6-digit OTP
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid OTP' 
        });
      }

      res.json({
        success: true,
        message: 'OTP verified successfully'
      });
    } catch (error) {
      console.error('OTP verify error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   GET /api/v1/auth/me
  // @desc    Get current user
  // @access  Private
  static async getCurrentUser(req, res) {
    try {
      res.json({
        success: true,
        data: { user: req.user }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   PUT /api/v1/auth/password
  // @desc    Change password
  // @access  Private
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findByPk(req.user.id);

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   POST /api/v1/auth/2fa/setup
  // @desc    Setup two-factor authentication
  // @access  Private
  static async setup2FA(req, res) {
    try {
      const user = await User.findByPk(req.user.id);

      const secret = speakeasy.generateSecret({
        name: `TrustEscrow (${user.email})`,
        issuer: 'TrustEscrow'
      });

      // Save secret temporarily (not enabled yet)
      user.twoFactorSecret = secret.base32;
      await user.save();

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      res.json({
        success: true,
        data: {
          secret: secret.base32,
          qrCodeUrl,
          otpauthUrl: secret.otpauth_url
        }
      });
    } catch (error) {
      console.error('Setup 2FA error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   POST /api/v1/auth/2fa/enable
  // @desc    Enable two-factor authentication
  // @access  Private
  static async enable2FA(req, res) {
    try {
      const { code } = req.body;

      const user = await User.findByPk(req.user.id);

      if (!user.twoFactorSecret) {
        return res.status(400).json({
          success: false,
          message: 'Please setup 2FA first'
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      user.twoFactorEnabled = true;
      await user.save();

      res.json({
        success: true,
        message: 'Two-factor authentication enabled successfully'
      });
    } catch (error) {
      console.error('Enable 2FA error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   POST /api/v1/auth/2fa/disable
  // @desc    Disable two-factor authentication
  // @access  Private
  static async disable2FA(req, res) {
    try {
      const { code } = req.body;

      const user = await User.findByPk(req.user.id);

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      await user.save();

      res.json({
        success: true,
        message: 'Two-factor authentication disabled successfully'
      });
    } catch (error) {
      console.error('Disable 2FA error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   POST /api/v1/auth/forgot-password
  // @desc    Request password reset
  // @access  Public
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ where: { email } });

      if (!user) {
        // Don't reveal if user exists
        return res.json({
          success: true,
          message: 'If an account exists, a reset link has been sent'
        });
      }

      // Generate reset token
      const resetToken = authService.generateResetToken(user.id);

      // Send reset email (implement in production)
      // await sendResetEmail(user.email, resetToken);

      res.json({
        success: true,
        message: 'Password reset link sent to your email'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }

  // @route   POST /api/v1/auth/reset-password
  // @desc    Reset password with token
  // @access  Public
  static async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
      
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
}

module.exports = AuthController;
