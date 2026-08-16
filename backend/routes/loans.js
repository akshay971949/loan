const express = require('express');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateSchedule } = require('../utils/emi');
const router = express.Router();

// GET /api/loans - admin/user: only loans on customers THEY added, customer: only their own
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT loans.*, customers.full_name, customers.phone
               FROM loans JOIN customers ON loans.customer_id = customers.id`;
    const params = [];
    const where = [];

    if (req.user.role === 'customer') {
      where.push('customers.user_id = ?');
      params.push(req.user.id);
    } else {
      where.push('loans.created_by = ?');
      params.push(req.user.id);
    }
    if (status) {
      where.push('loans.status = ?');
      params.push(status);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY loans.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch loans', error: err.message });
  }
});

// GET /api/loans/:id - loan details + full EMI schedule
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [loanRows] = await pool.query(
      `SELECT loans.*, customers.full_name, customers.phone, customers.user_id
       FROM loans JOIN customers ON loans.customer_id = customers.id WHERE loans.id = ?`,
      [req.params.id]
    );
    if (!loanRows.length) return res.status(404).json({ message: 'Loan not found' });
    const loan = loanRows[0];

    if (req.user.role === 'customer' && loan.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'admin' && loan.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [emis] = await pool.query('SELECT * FROM emis WHERE loan_id = ? ORDER BY emi_number ASC', [req.params.id]);
    res.json({ loan, emis });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch loan', error: err.message });
  }
});

// POST /api/loans - admin creates a loan; auto-generates the EMI schedule
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { customer_id, loan_type, principal_amount, interest_rate, tenure_months, start_date } = req.body;
    if (!customer_id || !principal_amount || !interest_rate || !tenure_months || !start_date) {
      return res.status(400).json({ message: 'customer_id, principal_amount, interest_rate, tenure_months and start_date are required' });
    }

    const [ownedCustomer] = await conn.query('SELECT id FROM customers WHERE id = ? AND created_by = ?', [customer_id, req.user.id]);
    if (!ownedCustomer.length) {
      return res.status(403).json({ message: 'You can only create loans for customers you added' });
    }

    const { emi, schedule } = generateSchedule(
      Number(principal_amount), Number(interest_rate), Number(tenure_months), start_date
    );

    await conn.beginTransaction();

    const [loanResult] = await conn.query(
      `INSERT INTO loans (customer_id, loan_type, principal_amount, interest_rate, tenure_months, emi_amount, start_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, loan_type || 'Personal', principal_amount, interest_rate, tenure_months, emi, start_date, req.user.id]
    );
    const loanId = loanResult.insertId;

    const values = schedule.map(row => [
      loanId, row.emi_number, row.due_date, row.emi_amount, row.principal_component, row.interest_component
    ]);
    await conn.query(
      `INSERT INTO emis (loan_id, emi_number, due_date, emi_amount, principal_component, interest_component) VALUES ?`,
      [values]
    );

    await conn.commit();
    res.status(201).json({ id: loanId, emi_amount: emi, message: 'Loan created and EMI schedule generated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Failed to create loan', error: err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/loans/:id/status - update loan status (active/closed/defaulted)
router.put('/:id/status', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'closed', 'defaulted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const [existing] = await pool.query('SELECT created_by FROM loans WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Loan not found' });
    if (existing[0].created_by !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    await pool.query('UPDATE loans SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Loan status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update loan status', error: err.message });
  }
});

module.exports = router;
