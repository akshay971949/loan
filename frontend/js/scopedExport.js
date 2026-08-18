// Secure current-page export helper.
// The backend must enforce authentication, company scope, role and loan/customer access.
// Never trust a loan_id supplied by the browser without server-side authorization.
export async function exportCurrentLoanEMI({ apiBase, loanId, token, filename = "loan_emi_schedule.csv" }) {
  if (!loanId) throw new Error("A loan ID is required for this export.");
  const url = `${apiBase.replace(/\\/$/, "")}/export/emis?loan_id=${encodeURIComponent(loanId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
