const user = guardPage(['admin', 'staff']);
if (user) {
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoEmail').textContent = user.email;
}

document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  window.location.href = 'user-login.html';
});

const loanId = new URLSearchParams(window.location.search).get('id');
let activeEmiId = null;

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

let currentLoan = null;

async function load() {
  const { loan, emis, editable } = await api(`/loans/${loanId}`);
  currentLoan = loan;

  document.getElementById('loanTitle').textContent = `Loan #${loan.id} — ${loan.full_name}`;
  document.getElementById('loanSub').textContent = `${loan.loan_type} • ${loan.phone} • started ${formatDate(loan.start_date)}`;
  document.getElementById('statusSelect').value = loan.status;

  if (user.role === 'admin') {
    document.getElementById('deleteBtn').style.display = 'inline-block';
    const editBtn = document.getElementById('editBtn');
    editBtn.style.display = 'inline-block';
    editBtn.disabled = !editable;
    editBtn.title = editable ? '' : 'Cannot edit after payments have been recorded';
  }

  const paid = emis.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.paid_amount), 0);
  const outstanding = Number(loan.principal_amount) + emis.reduce((s, e) => s + Number(e.interest_component), 0) - paid;
  const overdueCount = emis.filter(e => e.status === 'overdue').length;

  document.getElementById('loanStats').innerHTML = `
    <div class="stat-card"><div class="label">Principal</div><div class="value money">${formatMoney(loan.principal_amount)}</div></div>
    <div class="stat-card"><div class="label">Interest rate (monthly)</div><div class="value">${loan.interest_rate}%</div></div>
    <div class="stat-card"><div class="label">EMI / month</div><div class="value money">${formatMoney(loan.emi_amount)}</div></div>
    <div class="stat-card"><div class="label">Collected so far</div><div class="value money good">${formatMoney(paid)}</div></div>
    <div class="stat-card"><div class="label">Outstanding</div><div class="value money warn">${formatMoney(Math.max(outstanding,0))}</div></div>
    <div class="stat-card"><div class="label">Overdue EMIs</div><div class="value ${overdueCount ? 'bad' : ''}">${overdueCount}</div></div>
  `;

  document.getElementById('emiBody').innerHTML = emis.map(e => `
    <tr>
      <td>${e.emi_number}</td>
      <td>${formatDate(e.due_date)}</td>
      <td class="right money">${formatMoney(e.principal_component)}</td>
      <td class="right money">${formatMoney(e.interest_component)}</td>
      <td class="right money">${formatMoney(e.emi_amount)}</td>
      <td>${statusBadge(e.status)}</td>
      <td>${e.paid_date ? formatDate(e.paid_date) : '—'}</td>
      <td>${e.status === 'paid' ? '' : `<button class="btn btn-primary btn-sm" onclick="openPayModal(${e.id}, ${e.emi_number}, ${e.emi_amount})">Mark paid</button>`}</td>
    </tr>
  `).join('');
}

function openPayModal(emiId, emiNumber, amount) {
  activeEmiId = emiId;
  document.getElementById('payModalSub').textContent = `EMI #${emiNumber} — amount due ${formatMoney(amount)}`;
  document.getElementById('payAmount').value = amount;
  document.getElementById('payDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('payModal').classList.add('open');
}

document.getElementById('payCancel').addEventListener('click', () => {
  document.getElementById('payModal').classList.remove('open');
});

document.getElementById('payConfirm').addEventListener('click', async () => {
  const paid_amount = document.getElementById('payAmount').value;
  const paid_date = document.getElementById('payDate').value;
  try {
    await api(`/emis/${activeEmiId}/pay`, { method: 'PUT', body: { paid_amount, paid_date } });
    document.getElementById('payModal').classList.remove('open');
    load();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('statusSelect').addEventListener('change', async (e) => {
  try {
    await api(`/loans/${loanId}/status`, { method: 'PUT', body: { status: e.target.value } });
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('exportBtn').addEventListener('click', () => {
  downloadCsv(`/export/emis?loan_id=${loanId}`, `loan_${loanId}_schedule.csv`).catch(err => alert(err.message));
});

document.getElementById('editBtn').addEventListener('click', () => {
  if (!currentLoan) return;
  document.getElementById('editError').style.display = 'none';
  document.getElementById('e_type').value = currentLoan.loan_type;
  document.getElementById('e_principal').value = currentLoan.principal_amount;
  document.getElementById('e_emi').value = currentLoan.emi_amount;
  document.getElementById('e_tenure').value = currentLoan.tenure_months;
  document.getElementById('e_start').value = currentLoan.start_date.slice(0, 10);
  document.getElementById('editModal').classList.add('open');
});
document.getElementById('editCancel').addEventListener('click', () => {
  document.getElementById('editModal').classList.remove('open');
});
document.getElementById('editSave').addEventListener('click', async () => {
  const errorMsg = document.getElementById('editError');
  errorMsg.style.display = 'none';
  const body = {
    loan_type: document.getElementById('e_type').value.trim() || 'Personal',
    principal_amount: document.getElementById('e_principal').value,
    emi_amount: document.getElementById('e_emi').value,
    tenure_months: document.getElementById('e_tenure').value,
    start_date: document.getElementById('e_start').value
  };
  if (!body.principal_amount || !body.emi_amount || !body.tenure_months || !body.start_date) {
    errorMsg.textContent = 'All fields are required';
    errorMsg.style.display = 'block';
    return;
  }
  try {
    await api(`/loans/${loanId}`, { method: 'PUT', body });
    document.getElementById('editModal').classList.remove('open');
    load();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

document.getElementById('deleteBtn').addEventListener('click', async () => {
  if (!confirm('Delete this loan and its entire EMI schedule? This cannot be undone.')) return;
  try {
    await api(`/loans/${loanId}`, { method: 'DELETE' });
    window.location.href = 'loans.html';
  } catch (err) {
    alert(err.message);
  }
});

load();

// "Staff" management is admin-only — hide the nav link for staff-role users
if (user && user.role !== 'admin') {
  const staffLink = document.getElementById('staffNavLink');
  if (staffLink) staffLink.style.display = 'none';
}
