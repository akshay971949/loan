# Loan Management System

A full-stack loan/EMI management app: Node.js + Express backend, MySQL database, and a plain HTML/CSS/JS frontend. No build step required for the frontend — just open the HTML files (or serve them statically).

## Features

- **Separate user (staff) & customer portals** — distinct sign-in pages (`user-login.html` / `customer-login.html`) and logout flows; each redirects to its own login on sign-out or session expiry.
- **Multiple users, data isolation** — any signed-in user can add other user (staff) accounts from the "Users" page. **Each user only sees the customers, loans, and EMIs they personally added** — one user can never see another user's data.
- **Password change** — any signed-in user can change their password directly from "Change password" in the sidebar.
- **Customer management** — add, search, and view borrower profiles (KYC-style fields).
- **Loans & EMI schedule** — create a loan and the system auto-generates the full reducing-balance EMI schedule. **Interest rate is entered as a monthly percentage** (not annual).
- **EMI tracking** — dashboard of due & overdue EMIs, mark payments (full or partial), auto-flip to "overdue" via a daily cron job.
- **Customer self-service portal** — customers who sign up can see their own loans and payment status.
- **CSV export** — customers, loans, full EMI schedules, and the due/overdue collections list (scoped to the signed-in user's own data).
- **Dashboard** — portfolio stats scoped to the signed-in user: total disbursed, collected, due this month, overdue.

## Tech stack

- Backend: Node.js, Express, MySQL (`mysql2`), JWT (`jsonwebtoken`), `bcryptjs` for password hashing, `json2csv` for exports, `node-cron` for the overdue-status job.
- Database: MySQL.
- Frontend: static HTML/CSS/JS (no framework, no build step) — talks to the API via `fetch`.

## 1. Set up the database

```sql
-- In MySQL:
SOURCE backend/database/schema.sql;
```

This creates the `loan_management` database and all tables (`users`, `customers`, `loans`, `emis`).

## 2. Configure and run the backend

```bash
cd backend
cp .env.example .env
# edit .env with your MySQL credentials and a strong JWT_SECRET
npm install
npm start
```

The API runs on `http://localhost:5000` by default. On first run it automatically creates a default user (staff) account using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (defaults: `admin@loanapp.com` / `Admin@12345` — **change these**).

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

Open `index.html` — it's a chooser page that links to the two separate portals:

- **User (staff)**: `user-login.html`, using the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`. You'll land on the full dashboard (customers, loans, EMI tracking, users, exports) — scoped to only what this user has added. From there, add more user accounts via the "Users" page.
- **Customer**: `customer-login.html`, or `signup.html` to self-register first. Customers land on `customer-portal.html`, a read-only view of their own loans and EMI status. (Users normally add customer profiles directly from the dashboard — the customer login is optional, for self-service viewing.)

Both portals have their own "Change password" page, and logging out always returns you to that portal's own sign-in page.

**Note on interest rates:** when creating a loan, the interest rate field is a **monthly** percentage, not annual. If you're used to quoting annual rates, divide by 12 first (e.g. 12% annual ≈ 1% monthly).

**Note on data isolation:** each user only ever sees the customers, loans, and EMIs they personally created — this is enforced on the backend, not just hidden in the UI.

## API overview

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Customer self-registration |
| POST | `/api/auth/login` | Login (send `portal: 'admin'\|'customer'` to enforce matching role — `'admin'` = user/staff) |
| PUT | `/api/auth/change-password` | Change your own password (any signed-in user) |
| GET/POST | `/api/auth/admins` | List / create user (staff) accounts |
| DELETE | `/api/auth/admins/:id` | Remove a user account (not yourself) |
| GET/POST | `/api/customers` | List / create customers — scoped to the signed-in user's own data |
| GET/PUT/DELETE | `/api/customers/:id` | Manage a customer |
| GET/POST | `/api/loans` | List loans / create a loan (auto-generates EMI schedule) |
| GET | `/api/loans/:id` | Loan details + full EMI schedule |
| PUT | `/api/loans/:id/status` | Update loan status |
| GET | `/api/emis/due?days=7` | EMIs due soon + overdue |
| GET | `/api/emis/overdue` | Overdue EMIs only |
| GET | `/api/emis/stats` | Dashboard summary numbers |
| PUT | `/api/emis/:id/pay` | Record a payment |
| GET | `/api/export/customers` \| `/loans` \| `/emis?loan_id=` \| `/due` | CSV exports |

## Notes / next steps

- Passwords are hashed with bcrypt; tokens are JWTs with a 7-day expiry (configurable).
- The EMI schedule uses the standard reducing-balance formula: `EMI = P × r × (1+r)^n / ((1+r)^n − 1)`.
- For production: put this behind HTTPS, move the JWT secret to a real secrets manager, and consider adding refresh tokens, rate limiting, and audit logging for payment records.
