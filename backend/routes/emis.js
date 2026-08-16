const express = require('express');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

// Builds the WHERE clause + params for "which loans can this user see"
function scopeClause(req) {
  if (req.user.role === 'admin') return { clause: 'loans.company_id = ?', param: req.user.company_id };
  return { clause: 'loans.created_by = ?', param: req.user.id }; // staff
}

// GET /api/emis/due - EMIs due within next N days (default 7), plus overdue.
router.get('/due', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const days = Number(req.query.days) || 7;
    const scope = scopeClause(req);
    const [rows] = await pool.query(
      `SELECT emis.*, loans.customer_id, customers.full_name, customers.phone
       FROM emis
       JOIN loans ON emis.loan_id = loans.id
       JOIN customers ON loans.customer_id = customers.id
       WHERE emis.status IN ('pending','overdue')
         AND emis.due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND ${scope.clause}
       ORDER BY emis.due_date ASC`,
      [days, scope.param]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch due EMIs', error: err.message });
  }
});

router.get('/overdue', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const scope = scopeClause(req);
    const [rows] = await pool.query(
      `SELECT emis.*, loans.customer_id, customers.full_name, customers.phone
       FROM emis
       JOIN loans ON emis.loan_id = loans.id
       JOIN customers ON loans.customer_id = customers.id
       WHERE emis.due_date < CURDATE() AND emis.status IN ('pending','overdue')
         AND ${scope.clause}
       ORDER BY emis.due_date ASC`,
      [scope.param]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch overdue EMIs', error: err.message });
  }
});

router.get('/stats', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const scope = scopeClause(req);
    const customerScope = req.user.role === 'admin'
      ? { clause: 'company_id = ?', param: req.user.company_id }
      : { clause: 'created_by = ?', param: req.user.id };

    const [[customerCount]] = await pool.query(`SELECT COUNT(*) AS count FROM customers WHERE ${customerScope.clause}`, [customerScope.param]);
    const [[activeLoans]] = await pool.query(`SELECT COUNT(*) AS count FROM loans WHERE status='active' AND ${scope.clause}`, [scope.param]);
    const [[totalDisbursed]] = await pool.query(`SELECT IFNULL(SUM(principal_amount),0) AS total FROM loans WHERE ${scope.clause}`, [scope.param]);
    const [[collected]] = await pool.query(
      `SELECT IFNULL(SUM(emis.paid_amount),0) AS total FROM emis
       JOIN loans ON emis.loan_id = loans.id
       WHERE emis.status='paid' AND ${scope.clause}`, [scope.param]
    );
    const [[dueThisMonth]] = await pool.query(
      `SELECT COUNT(*) AS count, IFNULL(SUM(emis.emi_amount),0) AS total FROM emis
       JOIN loans ON emis.loan_id = loans.id
       WHERE emis.status IN ('pending','overdue') AND MONTH(emis.due_date)=MONTH(CURDATE()) AND YEAR(emis.due_date)=YEAR(CURDATE())
         AND ${scope.clause}`, [scope.param]
    );
    const [[overdue]] = await pool.query(
      `SELECT COUNT(*) AS count, IFNULL(SUM(emis.emi_amount),0) AS total FROM emis
       JOIN loans ON emis.loan_id = loans.id
       WHERE emis.due_date < CURDATE() AND emis.status IN ('pending','overdue') AND ${scope.clause}`, [scope.param]
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

router.put('/:id/pay', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { paid_amount, paid_date } = req.body;
    const [rows] = await pool.query(
      `SELECT emis.*, loans.created_by, loans.company_id FROM emis JOIN loans ON emis.loan_id = loans.id WHERE emis.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'EMI not found' });
    const emi = rows[0];

    if (req.user.role === 'staff' && emi.created_by !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    if (req.user.role === 'admin' && emi.company_id !== req.user.company_id) return res.status(403).json({ message: 'Access denied' });

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

router.post('/refresh-overdue', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const scope = scopeClause(req);
    const [result] = await pool.query(
      `UPDATE emis e JOIN loans l ON e.loan_id = l.id
       SET e.status='overdue' WHERE e.status='pending' AND e.due_date < CURDATE() AND ${scope.clause.replace('loans.', 'l.')}`,
      [scope.param]
    );
    res.json({ message: 'Overdue EMIs refreshed', updated: result.affectedRows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to refresh overdue EMIs', error: err.message });
  }
});

module.exports = router;
