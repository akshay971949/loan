# Loan Management System

A full-stack, multi-company loan/EMI management app: Node.js + Express backend, MySQL database, and a plain HTML/CSS/JS frontend. No build step required for the frontend — just open the HTML files (or serve them statically).

## Role hierarchy

```
SUPER_ADMIN (you)
   │
   ├── Company A
   │      ├── Admin   — manages that company's Staff, sees all of the company's data
   │      └── Staff    — only sees the customers/loans they personally added
   │
   ├── Company B
   │      ├── Admin
   │      └── Staff
   │
   └── Company C
          ├── Admin
          └── Staff
```

- **Super Admin** — the platform owner. Creates and removes Companies (each creation also creates that company's first Admin account). Doesn't see day-to-day loan data.
- **Admin** (one per company, more can't be added — only Super Admin creates a company's admin) — manages Staff for their own company (add/remove), and sees every customer/loan within their company.
- **Staff** — added by their company's Admin. Can add customers and loans, but can only see the ones they personally created. **Only the Admin can add or remove Staff — Staff can never manage other accounts.**
- **Customer** — a borrower. Can self-register to view their own loan/EMI status.

## Features

- **Separate staff & customer portals** — distinct sign-in pages (`user-login.html` covers Super Admin/Admin/Staff, `customer-login.html` for borrowers).
- **Strict data isolation** — enforced on the backend, not just hidden in the UI: Staff only ever see what they added; Admins see their whole company; different companies never see each other's data.
- **Only Admins manage Staff** — the ability to add/remove team accounts is restricted to the company's Admin, closing the earlier gap where any user could remove any other user.
- **Password change** — any signed-in user can change their password from "Change password" in the sidebar.
- **Customer management** — add, search, and view borrower profiles (KYC-style fields).
- **Loans & EMI schedule** — create a loan and the system auto-generates the full reducing-balance EMI schedule. **Interest rate is entered as a monthly percentage** (not annual).
- **EMI tracking** — dashboard of due & overdue EMIs, mark payments (full or partial), auto-flip to "overdue" via a daily cron job.
- **Customer self-service portal** — customers who sign up can see their own loans and payment status (once a company has linked them as a customer).
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

**If you're upgrading from an earlier single-tier version**, this is a breaking schema change (the `role` column now has 4 values, and `company_id` is required). The simplest path is to drop the old tables and re-run the full `schema.sql` fresh, then re-create your data through the app.

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

Open `index.html` — it's a chooser page that links to the two portals:

- **Staff tier (Super Admin / Admin / Staff)**: `user-login.html`.
  - Log in as the **Super Admin** first (using your `.env` credentials) → you'll land on `companies.html`. Create a company here — this also creates that company's first **Admin** account (you set their email/password directly).
  - That Admin then logs in at the same `user-login.html` → lands on `dashboard.html`. From "Staff" in the sidebar, they can add Staff accounts for their own company.
  - Staff log in the same way and land on the same dashboard, but only ever see what they personally added.
- **Customer**: `customer-login.html`, or `signup.html` to self-register. Customers land on `customer-portal.html`, a read-only view of their own loans (once a company has added them as a customer).

**Note on interest rates:** the interest rate field on a loan is a **monthly** percentage, not annual. If you're used to quoting annual rates, divide by 12 first (e.g. 12% annual ≈ 1% monthly).

## API overview

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Customer self-registration |
| POST | `/api/auth/login` | Login (send `portal: 'staff'\|'customer'` to enforce matching account type) |
| PUT | `/api/auth/change-password` | Change your own password (any signed-in user) |
| GET/POST | `/api/companies` | List / create companies (Super Admin only) |
| DELETE | `/api/companies/:id` | Remove a company and everything in it (Super Admin only) |
| GET/POST | `/api/staff` | List / add staff in your own company (Admin only) |
| DELETE | `/api/staff/:id` | Remove a staff account from your own company (Admin only) |
| GET/POST | `/api/customers` | List / create customers — scoped to company (Admin) or self (Staff) |
| GET/PUT/DELETE | `/api/customers/:id` | Manage a customer |
| GET/POST | `/api/loans` | List loans / create a loan (auto-generates EMI schedule) |
| GET | `/api/loans/:id` | Loan details + full EMI schedule |
| PUT | `/api/loans/:id/status` | Update loan status |
| GET | `/api/emis/due?days=7` | EMIs due soon + overdue |
| GET | `/api/emis/overdue` | Overdue EMIs only |
| GET | `/api/emis/stats` | Dashboard summary numbers |
| PUT | `/api/emis/:id/pay` | Record a payment |
| GET | `/api/export/customers` \| `/loans` \| `/emis?loan_id=` \| `/due` | CSV exports |

## Notes

- Passwords are hashed with bcrypt; tokens are JWTs with a 7-day expiry (configurable).
- The EMI schedule uses the standard reducing-balance formula: `EMI = P × r × (1+r)^n / ((1+r)^n − 1)`.
- For production: put this behind HTTPS, move the JWT secret to a real secrets manager, and consider rate limiting and audit logging for payment records.
