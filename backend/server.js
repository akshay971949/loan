require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const loanRoutes = require('./routes/loans');
const emiRoutes = require('./routes/emis');
const exportRoutes = require('./routes/export');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/emis', emiRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Ensure a default admin account exists on startup
async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!email || !password) return;

  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, 'admin']
    );
    console.log(`Default admin created: ${email}`);
  }
}

// Every day at 00:05, flip any pending EMI past its due date to 'overdue'
cron.schedule('5 0 * * *', async () => {
  try {
    const [result] = await pool.query(
      `UPDATE emis SET status='overdue' WHERE status='pending' AND due_date < CURDATE()`
    );
    console.log(`[cron] Marked ${result.affectedRows} EMI(s) overdue`);
  } catch (err) {
    console.error('[cron] Failed to refresh overdue EMIs', err.message);
  }
});

const PORT = process.env.PORT || 5000;

ensureAdmin()
  .then(() => {
    app.listen(PORT, () => console.log(`Loan management API running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
