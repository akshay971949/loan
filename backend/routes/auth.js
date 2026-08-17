const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();
require('dotenv').config();


function isValidGmail(email) {
  return /^[A-Z0-9._%+-]+@gmail\.com$/i.test(String(email || '').trim());
}

function isValidPhone(phone) {
  return /^\+?[0-9]{10,15}$/.test(String(phone || '').replace(/[\s-]/g, ''));
}

async function getMailer() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email, company_id: user.company_id || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/signup  -> customers self-register (role is always 'customer', no company yet)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'Name, email, phone and password are required' });
    }

    if (!isValidGmail(email)) return res.status(400).json({ message: 'Only a valid Gmail address (@gmail.com) is allowed' });
    if (!isValidPhone(phone)) return res.status(400).json({ message: 'Enter a valid phone number' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || null, hash, 'customer']
    );

    const user = { id: result.insertId, role: 'customer', name, email, company_id: null };
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
});

// POST /api/auth/login
// `portal` is optional ('staff' | 'customer'). 'staff' covers super_admin/admin/staff accounts.
router.post('/login', async (req, res) => {
  try {
    const { email, password, portal } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isStaffTier = ['super_admin', 'admin', 'staff'].includes(user.role);
    if (portal === 'staff' && !isStaffTier) {
      return res.status(403).json({ message: 'This is a customer account. Please use the customer sign-in page instead.' });
    }
    if (portal === 'customer' && user.role !== 'customer') {
      return res.status(403).json({ message: 'This is a staff account. Please use the staff sign-in page instead.' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, company_id: user.company_id }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});


// POST /api/auth/forgot-password - sends a one-time password reset link
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    // Always return the same response to avoid account enumeration.
    const generic = 'If an account exists for this email, a password reset link has been sent.';
    if (!email) return res.json({ message: generic });

    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.json({ message: generic });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query('DELETE FROM password_resets WHERE user_id = ?', [rows[0].id]);
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [rows[0].id, tokenHash]
    );

    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password.html?token=${rawToken}`;
    const mailer = await getMailer();
    if (!mailer || !frontendUrl) {
      console.error('[password-reset] SMTP_USER/SMTP_PASS/FRONTEND_URL are not configured');
      return res.status(503).json({ message: 'Password reset email is not configured on the server. Set SMTP_USER, SMTP_PASS and FRONTEND_URL.' });
    }

    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: rows[0].email,
      subject: 'Loan Manager - Reset your password',
      text: `Hello ${rows[0].name},\n\nUse this link to reset your password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Hello ${rows[0].name},</p><p>Use the button below to reset your Loan Manager password. This link expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`
    });

    res.json({ message: generic });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to process password reset request' });
  }
});

// POST /api/auth/reset-password - consumes a one-time reset token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'Valid token and a new password of at least 6 characters are required' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      `SELECT pr.id, pr.user_id FROM password_resets pr
       WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > NOW() LIMIT 1`,
      [tokenHash]
    );
    if (!rows.length) return res.status(400).json({ message: 'This reset link is invalid or has expired' });

    const hash = await bcrypt.hash(new_password, 10);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].user_id]);
      await conn.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [rows[0].id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// PUT /api/auth/change-password - any authenticated user
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to change password', error: err.message });
  }
});

module.exports = router;
