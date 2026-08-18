# Loan Management System

A full-stack, multi-company loan/EMI management app: Node.js + Express backend, MySQL database, and a plain HTML/CSS/JS frontend. No build step required for the frontend — just open the HTML files (or serve them statically).

## Role hierarchy

```
SUPER_ADMIN (you)
   │
   ├── Company A
   │      ├── Admin   — manages that company's Staff, sees/edits/deletes all of the company's loans
   │      └── Staff    — adds customers & loans, but only sees the ones they personally added
   │
   ├── Company B
   │      ├── Admin
   │      └── Staff
   │
   └── Company C
          ├── Admin
          └── Staff
```

- **Super Admin** — the platform owner. Creates and removes Companies (each creation also creates that company's first Admin account). Can reset a company's Admin password. Doesn't see day-to-day loan data.
- **Admin** (one per company) — manages Staff for their own company (add/remove/reset their password), and sees every customer/loan within their company. **Only the Admin can edit or delete a loan** — Staff cannot.
- **Staff** — added by their company's Admin. Can add customers and create loans, mark EMIs as paid, and export their own data — but can only see what they personally created, and can't edit/delete loans or manage other accounts.
- **Customers have no login** — they're borrower records only, managed entirely by Staff/Admin. There is no customer-facing portal.

## Features

- **Single staff sign-in** (`user-login.html`) — covers Super Admin, Admin, and Staff. No customer login/signup exists.
- **Strict data isolation** — enforced on the backend: Staff only ever see what they added; Admins see their whole company; different companies never see each other's data.
- **Only Admins manage Staff and loans** — adding/removing Staff, and editing/deleting a loan, are Admin-only actions.
- **Password reset by the managing role** — if someone forgets their password, the person who manages them resets it directly: the company's Admin resets a Staff member's password from the "Staff" page; the Super Admin resets a company's Admin password from the "Companies" page. No email or SMS required.
- **Customer management** — add, search, and view borrower profiles, with phone (10-digit Indian mobile) and email format validation. No income field.
- **Loans — EMI-driven**: instead of entering an interest rate, you enter the **principal, the desired monthly EMI amount, and the tenure** — the system calculates the resulting monthly interest rate automatically and generates the full reducing-balance schedule.
- **Loan editing** (Admin only) — a loan's terms can be edited as long as no EMI has been paid yet (editing after payments are recorded is blocked, to protect the payment history). Editing a loan regenerates its EMI schedule.
- **Loan deletion** (Admin only) — removes the loan and its entire EMI schedule.
- **EMI tracking** — dashboard of due & overdue EMIs, mark payments (full or partial), auto-flip to "overdue" via a daily cron job.
- **CSV export** — customers, loans, full EMI schedules, and the due/overdue collections list (scoped to what the signed-in user can see).

## Tech stack

- Backend: Node.js, Express, MySQL (`mysql2`), JWT (`jsonwebtoken`), `bcryptjs` for password hashing, `json2csv` for exports, `node-cron` for the overdue-status job.
- Database: MySQL.
- Frontend: static HTML/CSS/JS (no framework, no build step) — talks to the API via `fetch`.

## 1. Set up the database

```sql
-- In MySQL:
SOURCE backend/database/schema.sql;
```

This creates the `loan_management` database and all tables (`companies`, `users`, `customers`, `loans`, `emis`).

## 2. Configure and run the backend

```bash
cd backend
cp .env.example .env
# edit .env with your MySQL credentials and a strong JWT_SECRET
npm install
npm start
```

The API runs on `http://localhost:5000` by default. On first run it automatically creates the **Super Admin** account using `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `.env` (defaults: `super@loanapp.com` / `SuperAdmin@12345` — **change these**).

## 3. Run the frontend

The frontend is plain static files — no build step. Easiest options:

- Open `frontend/index.html` directly in a browser, **or**
- Serve it so relative paths behave consistently:
  ```bash
  cd frontend
  npx serve .
  # or: python3 -m http.server 8080
  ```

If your backend isn't on `http://localhost:5000`, update `API_BASE` at the top of `frontend/js/api.js`.

## 4. Log in

Open `index.html` — it redirects straight to `user-login.html` (the only sign-in page).

1. Log in as the **Super Admin** first (using your `.env` credentials) → you land on `companies.html`. Create a company here — this also creates that company's first **Admin** account (you set their email/password directly).
2. That Admin then logs in at the same `user-login.html` → lands on `dashboard.html`. From "Staff" in the sidebar, they add Staff accounts for their own company, and can reset a staff member's password if they forget it.
3. Staff log in the same way and land on the same dashboard, but only ever see the customers/loans they personally added, and don't see the "Staff" menu.

**Note on loans:** instead of an interest rate, enter the **principal, the EMI amount you want, and the tenure** — the monthly interest rate is calculated automatically to match.

## API overview

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| PUT | `/api/auth/change-password` | Change your own password (any signed-in user) |
| GET/POST | `/api/companies` | List / create companies (Super Admin only) |
| DELETE | `/api/companies/:id` | Remove a company and everything in it (Super Admin only) |
| PUT | `/api/companies/:id/reset-admin-password` | Super Admin resets that company's Admin password |
| GET/POST | `/api/staff` | List / add staff in your own company (Admin only) |
| DELETE | `/api/staff/:id` | Remove a staff account from your own company (Admin only) |
| PUT | `/api/staff/:id/reset-password` | Admin resets a staff member's password (their own company only) |
| GET/POST | `/api/customers` | List / create customers — scoped to company (Admin) or self (Staff) |
| GET/PUT/DELETE | `/api/customers/:id` | Manage a customer |
| GET/POST | `/api/loans` | List loans / create a loan (send `principal_amount`, `emi_amount`, `tenure_months`, `start_date`) |
| GET | `/api/loans/:id` | Loan details + full EMI schedule (`editable: false` once any EMI is paid) |
| PUT | `/api/loans/:id` | Edit a loan's terms (Admin only, only before any payment is recorded) |
| DELETE | `/api/loans/:id` | Delete a loan and its schedule (Admin only) |
| PUT | `/api/loans/:id/status` | Update loan status (active/closed/defaulted) |
| GET | `/api/emis/due?days=7` | EMIs due soon + overdue |
| GET | `/api/emis/overdue` | Overdue EMIs only |
| GET | `/api/emis/stats` | Dashboard summary numbers |
| PUT | `/api/emis/:id/pay` | Record a payment |
| GET | `/api/export/customers` \| `/loans` \| `/emis?loan_id=` \| `/due` | CSV exports |

## Notes

- Passwords are hashed with bcrypt; tokens are JWTs with a 7-day expiry (configurable).
- Phone numbers are validated as 10-digit Indian mobile numbers (`6-9` followed by 9 digits); emails are validated for standard format.
- The EMI schedule uses the standard reducing-balance formula: `EMI = P × r × (1+r)^n / ((1+r)^n − 1)`. Since you now enter the desired EMI instead of a rate, the backend solves for the matching monthly rate using bisection search (there's no closed-form formula for this).
- For production: put this behind HTTPS, move the JWT secret to a real secrets manager, and consider rate limiting and audit logging for payment records.
