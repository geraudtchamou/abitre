const crypto = require('crypto');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send OTP via email
const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = createEmailTransporter();
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@trustescrow.com',
      to: email,
      subject: 'Your TrustEscrow Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">TrustEscrow Verification</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px;">
            <h1 style="color: #007bff; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #888; font-size: 12px;">© ${new Date().getFullYear()} TrustEscrow. All rights reserved.</p>
        </div>
      `
    });
    
    console.log(`OTP sent to email: ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

// Send OTP via SMS
const sendOTPSMS = async (phone, otp) => {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    await client.messages.create({
      body: `Your TrustEscrow verification code is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    
    console.log(`OTP sent to phone: ${phone}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP SMS:', error);
    // Fallback: log OTP for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV MODE] OTP for ${phone}: ${otp}`);
      return true;
    }
    throw error;
  }
};

// Send OTP
const sendOTP = async (recipient, otp, method = 'email') => {
  if (method === 'email') {
    return await sendOTPEmail(recipient, otp);
  } else if (method === 'sms') {
    return await sendOTPSMS(recipient, otp);
  } else {
    throw new Error('Invalid OTP method');
  }
};

module.exports = {
  generateOTP,
  sendOTP,
  sendOTPEmail,
  sendOTPSMS
};
