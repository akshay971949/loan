const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/staff - list staff within THIS admin's own company. Admin only.
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, phone, created_at FROM users WHERE role = 'staff' AND company_id = ? ORDER BY created_at ASC",
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch staff', error: err.message });
  }
});

// POST /api/staff - add a staff account to THIS admin's own company. Admin only.
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
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
      'INSERT INTO users (company_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.company_id, name, email, phone || null, hash, 'staff']
    );
    res.status(201).json({ id: result.insertId, message: 'Staff account created' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create staff account', error: err.message });
  }
});

// DELETE /api/staff/:id - remove a staff account, only if they belong to THIS admin's own company. Admin only.
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND role = 'staff' AND company_id = ?",
      [req.params.id, req.user.company_id]
    );
    if (!existing.length) return res.status(404).json({ message: 'Staff account not found in your company' });

    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Staff account removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove staff account', error: err.message });
  }
});

module.exports = router;
