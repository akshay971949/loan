const express = require('express');
const { Parser } = require('json2csv');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

function sendCsv(res, rows, filename) {
  if (!rows.length) return res.status(404).json({ message: 'No data to export' });
  const parser = new Parser({ fields: Object.keys(rows[0]) });
  const csv = parser.parse(rows);
  res.header('Content-Type', 'text/csv');
  res.attachment(filename);
  res.send(csv);
}

// GET /api/export/customers - only what THIS admin/user added
router.get('/customers', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, address, id_proof_type, id_proof_number, occupation, monthly_income, created_at
       FROM customers WHERE created_by = ? ORDER BY id`,
      [req.user.id]
    );
    sendCsv(res, rows, `customers_${Date.now()}.csv`);
  } catch (err) {
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
});

// GET /api/export/loans - only what THIS admin/user created
router.get('/loans', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT loans.id, customers.full_name, customers.phone, loans.loan_type, loans.principal_amount,
              loans.interest_rate, loans.tenure_months, loans.emi_amount, loans.start_date, loans.status
       FROM loans JOIN customers ON loans.customer_id = customers.id
       WHERE loans.created_by = ? ORDER BY loans.id`,
      [req.user.id]
    );
    sendCsv(res, rows, `loans_${Date.now()}.csv`);
  } catch (err) {
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
});

// GET /api/export/emis?loan_id=  (all of THIS admin/user's EMIs, or a single loan's schedule)
router.get('/emis', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { loan_id } = req.query;
    let sql = `SELECT emis.id, customers.full_name, loans.id AS loan_id, emis.emi_number, emis.due_date,
                      emis.emi_amount, emis.principal_component, emis.interest_component,
                      emis.paid_amount, emis.paid_date, emis.status
               FROM emis
               JOIN loans ON emis.loan_id = loans.id
               JOIN customers ON loans.customer_id = customers.id
               WHERE loans.created_by = ?`;
    const params = [req.user.id];
    if (loan_id) {
      sql += ' AND loans.id = ?';
      params.push(loan_id);
    }
    sql += ' ORDER BY loans.id, emis.emi_number';
    const [rows] = await pool.query(sql, params);
    sendCsv(res, rows, `emis_${Date.now()}.csv`);
  } catch (err) {
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
});

// GET /api/export/due - THIS admin/user's currently due + overdue EMIs (collections list)
router.get('/due', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT emis.id, customers.full_name, customers.phone, loans.id AS loan_id, emis.emi_number,
              emis.due_date, emis.emi_amount, emis.status
       FROM emis
       JOIN loans ON emis.loan_id = loans.id
       JOIN customers ON loans.customer_id = customers.id
       WHERE emis.status IN ('pending','overdue') AND loans.created_by = ?
       ORDER BY emis.due_date ASC`,
      [req.user.id]
    );
    sendCsv(res, rows, `due_emis_${Date.now()}.csv`);
  } catch (err) {
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
});

module.exports = router;
