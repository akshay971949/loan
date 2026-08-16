const express = require('express');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/emis/due - EMIs due within next N days (default 7), plus overdue, for THIS admin/user only.
router.get('/due', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const days = Number(req.query.days) || 7;
    const [rows] = await pool.query(
      `SELECT emis.*, loans.customer_id, customers.full_name, customers.phone
       FROM emis
       JOIN loans ON emis.loan_id = loans.id
       JOIN customers ON loans.customer_id = customers.id
       WHERE emis.status IN ('pending','overdue')
         AND emis.due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND loans.created_by = ?
       ORDER BY emis.due_date ASC`,
      [days, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch due EMIs', error: err.message });
  }
});

// GET /api/emis/overdue - Admin only
router.get('/overdue', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT emis.*, loans.customer_id, customers.full_name, customers.phone
       FROM emis
       JOIN loans ON emis.loan_id = loans.id
       JOIN customers ON loans.customer_id = customers.id
       WHERE emis.due_date < CURDATE() AND emis.status IN ('pending','overdue')
         AND loans.created_by = ?
       ORDER BY emis.due_date ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch overdue EMIs', error: err.message });
  }
});

// GET /api/emis/stats - dashboard summary numbers. Admin only.
router.get('/stats', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const uid = req.user.id;
    const [[customerCount]] = await pool.query('SELECT COUNT(*) AS count FROM customers WHERE created_by = ?', [uid]);
    const [[activeLoans]] = await pool.query(`SELECT COUNT(*) AS count FROM loans WHERE status='active' AND created_by = ?`, [uid]);
    const [[totalDisbursed]] = await pool.query('SELECT IFNULL(SUM(principal_amount),0) AS total FROM loans WHERE created_by = ?', [uid]);
    const [[collected]] = await pool.query(
      `SELECT IFNULL(SUM(emis.paid_amount),0) AS total FROM emis
       JOIN loans ON emis.loan_id = loans.id
       WHERE emis.status='paid' AND loans.created_by = ?`, [uid]
    );
    const [[dueThisMonth]] = await pool.query(
      `SELECT COUNT(*) AS count, IFNULL(SUM(emis.emi_amount),0) AS total FROM emis
       JOIN loans ON emis.loan_id = loans.id
       WHERE emis.status IN ('pending','overdue') AND MONTH(emis.due_date)=MONTH(CURDATE()) AND YEAR(emis.due_date)=YEAR(CURDATE())
         AND loans.created_by = ?`, [uid]
    );
    const [[overdue]] = await pool.query(
      `SELECT COUNT(*) AS count, IFNULL(SUM(emis.emi_amount),0) AS total FROM emis
       JOIN loans ON emis.loan_id = loans.id
       WHERE emis.due_date < CURDATE() AND emis.status IN ('pending','overdue') AND loans.created_by = ?`, [uid]
    );

    res.json({
      totalCustomers: customerCount.count,
      activeLoans: activeLoans.count,
      totalDisbursed: totalDisbursed.total,
      totalCollected: collected.total,
      dueThisMonth,
      overdue
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats', error: err.message });
  }
});

// PUT /api/emis/:id/pay - mark an EMI as paid (full or partial). Admin only.
router.put('/:id/pay', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { paid_amount, paid_date } = req.body;
    const [rows] = await pool.query(
      `SELECT emis.*, loans.created_by FROM emis JOIN loans ON emis.loan_id = loans.id WHERE emis.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'EMI not found' });
    const emi = rows[0];
    if (emi.created_by !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    const amount = Number(paid_amount) || Number(emi.emi_amount);
    const status = amount >= Number(emi.emi_amount) ? 'paid' : 'partial';

    await pool.query(
      'UPDATE emis SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?',
      [amount, paid_date || new Date().toISOString().slice(0, 10), status, req.params.id]
    );

    res.json({ message: 'EMI payment recorded', status });
  } catch (err) {
    res.status(500).json({ message: 'Failed to record payment', error: err.message });
  }
});

// A lightweight helper endpoint: flips any pending EMI whose due_date has passed to 'overdue'.
// Call this on dashboard load (also wired to a daily cron in server.js).
router.post('/refresh-overdue', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE emis e JOIN loans l ON e.loan_id = l.id
       SET e.status='overdue' WHERE e.status='pending' AND e.due_date < CURDATE() AND l.created_by = ?`,
      [req.user.id]
    );
    res.json({ message: 'Overdue EMIs refreshed', updated: result.affectedRows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to refresh overdue EMIs', error: err.message });
  }
});

module.exports = router;
