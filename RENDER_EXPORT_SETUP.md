# Render + Secure Current-Page Export

## Backend URL
https://loan-pdyh.onrender.com/api

## Export rule
The frontend should pass the ID of the record currently being viewed (for example, the selected
loan's `loan_id`) to the corresponding export endpoint. The backend must authorize the logged-in
user before returning any rows.

For EMI export, use:
`GET /export/emis?loan_id=<CURRENT_LOAN_ID>`

The backend should verify:
1. Authentication token/session.
2. User role (owner/admin/staff).
3. Company/tenant scope.
4. Permission to view the requested loan.
5. Only then query and export that loan's EMI rows.

Do not rely on hiding the export button for security.

## Current-page behavior
Export controls should use the ID/filter state of the page currently open, rather than a fixed
global loan ID or a global loans export endpoint.
