require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const staffRoutes = require('./routes/staff');
const customerRoutes = require('./routes/customers');
const loanRoutes = require('./routes/loans');
const emiRoutes = require('./routes/emis');
const exportRoutes = require('./routes/export');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/emis', emiRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Ensure password reset storage exists even when an existing database is used
async function ensurePasswordResetTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_password_resets_user (user_id),
      INDEX idx_password_resets_expiry (expires_at)
    )
  `);
}

// Ensure a Super Admin account exists on startup (no company — manages all companies)
async function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';
  if (!email || !password) return;

  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role, company_id) VALUES (?, ?, ?, ?, NULL)',
      [name, email, hash, 'super_admin']
    );
    console.log(`Super Admin created: ${email}`);
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

ensurePasswordResetTable()
  .then(() => ensureSuperAdmin())
  .then(() => {
    app.listen(PORT, () => console.log(`Loan management API running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
