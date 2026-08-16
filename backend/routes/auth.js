const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();
require('dotenv').config();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/signup  -> customers self-register (role is always 'customer')
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || null, hash, 'customer']
    );

    // Also create a linked customer profile automatically
    await pool.query(
      'INSERT INTO customers (user_id, full_name, email, phone, created_by) VALUES (?, ?, ?, ?, ?)',
      [result.insertId, name, email, phone || '', result.insertId]
    );

    const user = { id: result.insertId, role: 'customer', name, email };
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
});

// POST /api/auth/login
// `portal` is optional ('admin' | 'customer'). When provided, the login is rejected
// if the account's role doesn't match — keeps the admin and customer sign-in pages separate.
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

    if (portal && user.role !== portal) {
      const message = portal === 'admin'
        ? 'This account is a customer account. Please use the customer sign-in page instead.'
        : 'This account is a user (staff) account. Please use the user sign-in page instead.';
      return res.status(403).json({ message });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// PUT /api/auth/change-password - any authenticated user (admin or customer)
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

// ---- Admin management (multiple admins) ----

// GET /api/auth/admins - list all admin accounts. Admin only.
router.get('/admins', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, phone, created_at FROM users WHERE role = 'admin' ORDER BY created_at ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch admins', error: err.message });
  }
});

// POST /api/auth/admins - create another admin account. Admin only.
router.post('/admins', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || null, hash, 'admin']
    );
    res.status(201).json({ id: result.insertId, message: 'Admin created' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create admin', error: err.message });
  }
});

// DELETE /api/auth/admins/:id - remove an admin account. Admin only. Can't delete yourself.
router.delete('/admins/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ message: "You can't remove your own admin account" });
    }
    await pool.query("DELETE FROM users WHERE id = ? AND role = 'admin'", [req.params.id]);
    res.json({ message: 'Admin removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove admin', error: err.message });
  }
});

module.exports = router;
