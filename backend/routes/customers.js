const express = require('express');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/customers - list only what THIS admin/user added (admin only), supports ?search=
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM customers WHERE created_by = ?';
    const params = [req.user.id];
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

    // A customer can only view their own record; an admin/user can only view what they added
    if (req.user.role === 'customer' && rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'admin' && rows[0].created_by !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer', error: err.message });
  }
});

// POST /api/customers - admin creates a customer profile (no login required)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { full_name, email, phone, address, id_proof_type, id_proof_number, occupation, monthly_income } = req.body;
    if (!full_name || !phone) {
      return res.status(400).json({ message: 'full_name and phone are required' });
    }
    const [result] = await pool.query(
      `INSERT INTO customers (full_name, email, phone, address, id_proof_type, id_proof_number, occupation, monthly_income, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, email || null, phone, address || null, id_proof_type || null, id_proof_number || null, occupation || null, monthly_income || null, req.user.id]
    );
    res.status(201).json({ id: result.insertId, message: 'Customer created' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create customer', error: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT created_by FROM customers WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Customer not found' });
    if (existing[0].created_by !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    const { full_name, email, phone, address, id_proof_type, id_proof_number, occupation, monthly_income } = req.body;
    await pool.query(
      `UPDATE customers SET full_name=?, email=?, phone=?, address=?, id_proof_type=?, id_proof_number=?, occupation=?, monthly_income=? WHERE id=?`,
      [full_name, email, phone, address, id_proof_type, id_proof_number, occupation, monthly_income, req.params.id]
    );
    res.json({ message: 'Customer updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update customer', error: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT created_by FROM customers WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Customer not found' });
    if (existing[0].created_by !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete customer', error: err.message });
  }
});

module.exports = router;
