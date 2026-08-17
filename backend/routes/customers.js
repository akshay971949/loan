const express = require('express');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();
function isValidGmail(email) { return /^[A-Z0-9._%+-]+@gmail\.com$/i.test(String(email || '').trim()); }
function isValidPhone(phone) { return /^\+?[0-9]{10,15}$/.test(String(phone || '').replace(/[\s-]/g, '')); }

// GET /api/customers - admin: everyone in their company. staff: only what THEY added.
router.get('/', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { search } = req.query;
    let sql, params;
    if (req.user.role === 'admin') {
      sql = 'SELECT * FROM customers WHERE company_id = ?';
      params = [req.user.company_id];
    } else {
      sql = 'SELECT * FROM customers WHERE created_by = ?';
      params = [req.user.id];
    }
    if (search) {
      sql += ' AND (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customers', error: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Customer not found' });
    const c = rows[0];

    if (req.user.role === 'customer' && c.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'staff' && c.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'admin' && c.company_id !== req.user.company_id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer', error: err.message });
  }
});

// POST /api/customers - admin or staff creates a customer profile within their own company
router.post('/', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { full_name, email, phone, address, id_proof_type, id_proof_number, occupation } = req.body;
    if (!full_name || !phone || !email) {
      return res.status(400).json({ message: 'Name, Gmail and phone are required' });
    }
    if (!isValidGmail(email)) return res.status(400).json({ message: 'Only a valid Gmail address (@gmail.com) is allowed' });
    if (!isValidPhone(phone)) return res.status(400).json({ message: 'Enter a valid phone number' });
    const [result] = await pool.query(
      `INSERT INTO customers (company_id, full_name, email, phone, address, id_proof_type, id_proof_number, occupation, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, full_name, email, phone, address || null, id_proof_type || null, id_proof_number || null, occupation || null, req.user.id]
    );
    res.status(201).json({ id: result.insertId, message: 'Customer created' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create customer', error: err.message });
  }
});

// PUT /api/customers/:id - company admin only
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT company_id FROM customers WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Customer not found' });
    if (existing[0].company_id !== req.user.company_id) return res.status(403).json({ message: 'Access denied' });

    const { full_name, email, phone, address, id_proof_type, id_proof_number, occupation } = req.body;
    if (!full_name || !email || !phone) return res.status(400).json({ message: 'Name, Gmail and phone are required' });
    if (!isValidGmail(email)) return res.status(400).json({ message: 'Only a valid Gmail address (@gmail.com) is allowed' });
    if (!isValidPhone(phone)) return res.status(400).json({ message: 'Enter a valid phone number' });

    await pool.query(
      `UPDATE customers SET full_name=?, email=?, phone=?, address=?, id_proof_type=?, id_proof_number=?, occupation=? WHERE id=?`,
      [full_name, email, phone, address || null, id_proof_type || null, id_proof_number || null, occupation || null, req.params.id]
    );
    res.json({ message: 'Customer updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update customer', error: err.message });
  }
});

// DELETE /api/customers/:id - company admin only
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT company_id FROM customers WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Customer not found' });
    if (existing[0].company_id !== req.user.company_id) return res.status(403).json({ message: 'Access denied' });
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete customer', error: err.message });
  }
});

module.exports = router;
