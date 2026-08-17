# Loan Manager – Updated Version

Implemented requested changes:

1. Forgot password / password reset
   - Added forgot-password.html and reset-password.html.
   - Reset links expire after 30 minutes and are one-time use.
   - Backend sends reset links through Gmail SMTP.
   - Set `SMTP_USER`, `SMTP_PASS` (Gmail App Password), and `FRONTEND_URL` in Railway environment variables.
   - `password_resets` table is created automatically at backend startup.

2. Permissions
   - Staff can see all loans belonging to their company.
   - Staff can create loans but cannot edit/delete loans or change loan status.
   - Company admin can edit/delete loans.
   - Staff can create customers but cannot edit/delete customers.
   - Company admin can edit/delete customers.
   - Staff management remains company-admin-only: admin can add/remove staff; staff cannot edit staff.

3. Customer form
   - Monthly income removed from the customer page.
   - New/edited customer requires Gmail and phone.

4. Loan EMI / interest
   - New loan form supports either monthly interest rate OR monthly EMI.
   - Entering one automatically calculates the other.
   - Backend also calculates the missing value for security/consistency.

5. Gmail + phone validation
   - New company admin, staff, and customer records require `@gmail.com` email and a valid 10–15 digit phone number.
   - Customer self-signup also requires Gmail and phone.

Important:
- Existing database data is not automatically converted to Gmail/phone rules; these rules apply to new/edited records.
- For password reset email, configure Gmail SMTP on Railway. Use a Gmail App Password if the sending Gmail account has 2-Step Verification enabled.
- Existing MySQL databases do not need a manual password-reset table migration because the server creates that table automatically.
