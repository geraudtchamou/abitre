const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const AuthController = require('../controllers/auth.controller');

// Validation middleware
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const otpValidation = [
  body('email').optional().isEmail(),
  body('phone').optional().isMobilePhone(),
  body('otp').isLength({ min: 6, max: 6 }).matches(/^\d+$/).withMessage('OTP must be 6 digits')
];

const passwordChangeValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
];

const twoFactorValidation = [
  body('code').isLength({ min: 6, max: 6 }).matches(/^\d+$/).withMessage('Invalid verification code')
];

// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', 
  registerValidation, 
  AuthController.register
);

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', 
  loginValidation, 
  AuthController.login
);

// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, AuthController.logout);

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Private
router.post('/refresh', protect, AuthController.refreshToken);

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, AuthController.getCurrentUser);

// @route   PUT /api/v1/auth/password
// @desc    Change password
// @access  Private
router.put('/password', 
  protect, 
  passwordChangeValidation,
  AuthController.changePassword
);

// @route   POST /api/v1/auth/otp/request
// @desc    Request OTP for verification
// @access  Public
router.post('/otp/request', AuthController.requestOTP);

// @route   POST /api/v1/auth/otp/verify
// @desc    Verify OTP
// @access  Public
router.post('/otp/verify', 
  otpValidation,
  AuthController.verifyOTP
);

// @route   POST /api/v1/auth/2fa/setup
// @desc    Setup two-factor authentication
// @access  Private
router.post('/2fa/setup', protect, AuthController.setup2FA);

// @route   POST /api/v1/auth/2fa/enable
// @desc    Enable two-factor authentication
// @access  Private
router.post('/2fa/enable', 
  protect, 
  twoFactorValidation,
  AuthController.enable2FA
);

// @route   POST /api/v1/auth/2fa/disable
// @desc    Disable two-factor authentication
// @access  Private
router.post('/2fa/disable', 
  protect, 
  twoFactorValidation,
  AuthController.disable2FA
);

// @route   POST /api/v1/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', 
  body('email').isEmail().withMessage('Valid email is required'),
  AuthController.forgotPassword
);

// @route   POST /api/v1/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', 
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  AuthController.resetPassword
);

module.exports = router;
