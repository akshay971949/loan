const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/companies - list all companies with their admin's details. Super admin only.
router.get('/', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT companies.id, companies.name, companies.created_at,
             admins.name AS admin_name, admins.email AS admin_email,
             (SELECT COUNT(*) FROM users WHERE users.company_id = companies.id AND users.role = 'staff') AS staff_count,
             (SELECT COUNT(*) FROM customers WHERE customers.company_id = companies.id) AS customer_count
      FROM companies
      LEFT JOIN users admins ON admins.company_id = companies.id AND admins.role = 'admin'
      ORDER BY companies.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch companies', error: err.message });
  }
});

// POST /api/companies - create a company AND its first Admin account. Super admin only.
router.post('/', authenticate, requireRole('super_admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { company_name, admin_name, admin_email, admin_password } = req.body;
    if (!company_name || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({ message: 'Company name, admin name, admin email and admin password are all required' });
    }
    if (admin_password.length < 6) {
      return res.status(400).json({ message: 'Admin password must be at least 6 characters' });
    }

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [admin_email]);
    if (existing.length) {
      return res.status(409).json({ message: 'An account with this admin email already exists' });
    }

    await conn.beginTransaction();

    const [companyResult] = await conn.query('INSERT INTO companies (name) VALUES (?)', [company_name]);
    const companyId = companyResult.insertId;

    const hash = await bcrypt.hash(admin_password, 10);
    await conn.query(
      'INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [companyId, admin_name, admin_email, hash, 'admin']
    );

    await conn.commit();
    res.status(201).json({ id: companyId, message: 'Company and admin account created' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Failed to create company', error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /api/companies/:id - removes the company and everything in it (admin, staff, customers, loans). Super admin only.
router.delete('/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM companies WHERE id = ?', [req.params.id]);
    res.json({ message: 'Company removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove company', error: err.message });
  }
});

// PUT /api/companies/:id/reset-admin-password - super admin resets a company's admin password
router.put('/:id/reset-admin-password', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' AND company_id = ?",
      [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ message: 'No admin account found for this company' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, existing[0].id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
});

module.exports = router;
