const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function isValidGmail(email) { return /^[A-Z0-9._%+-]+@gmail\.com$/i.test(String(email || '').trim()); }
function isValidPhone(phone) { return /^\+?[0-9]{10,15}$/.test(String(phone || '').replace(/[\s-]/g, '')); }
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
    const { company_name, admin_name, admin_email, admin_password, admin_phone } = req.body;
    if (!company_name || !admin_name || !admin_email || !admin_password || !admin_phone) {
      return res.status(400).json({ message: 'Company name, admin name, admin email and admin password are all required' });
    }
    if (!isValidGmail(admin_email)) return res.status(400).json({ message: 'Only a valid Gmail address (@gmail.com) is allowed' });
    if (!isValidPhone(admin_phone)) return res.status(400).json({ message: 'Enter a valid phone number' });
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
      'INSERT INTO users (company_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [companyId, admin_name, admin_email, admin_phone, hash, 'admin']
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

module.exports = router;
