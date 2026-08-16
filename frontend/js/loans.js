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

const urlParams = new URLSearchParams(window.location.search);
const filterCustomerId = urlParams.get('customer_id');

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

async function loadLoans() {
  const rows = await api('/loans');
  const filtered = filterCustomerId ? rows.filter(r => String(r.customer_id) === filterCustomerId) : rows;
  const body = document.getElementById('loansBody');
  const empty = document.getElementById('loansEmpty');

  if (!filtered.length) {
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = filtered.map(l => `
    <tr>
      <td><a href="loan-details.html?id=${l.id}">#${l.id}</a></td>
      <td>${l.full_name}</td>
      <td>${l.loan_type}</td>
      <td class="right money">${formatMoney(l.principal_amount)}</td>
      <td>${l.interest_rate}%</td>
      <td>${l.tenure_months} mo</td>
      <td class="right money">${formatMoney(l.emi_amount)}</td>
      <td>${statusBadge(l.status)}</td>
      <td><a class="btn btn-ghost btn-sm" href="loan-details.html?id=${l.id}">View schedule</a></td>
    </tr>
  `).join('');
}

async function loadCustomerOptions() {
  const customers = await api('/customers');
  const select = document.getElementById('l_customer');
  select.innerHTML = customers.map(c => `<option value="${c.id}">${c.full_name} — ${c.phone}</option>`).join('');
  if (filterCustomerId) select.value = filterCustomerId;
}

document.getElementById('exportBtn').addEventListener('click', () => {
  downloadCsv('/export/loans', 'loans.csv').catch(err => alert(err.message));
});

document.getElementById('addBtn').addEventListener('click', async () => {
  document.getElementById('loanError').style.display = 'none';
  ['l_principal','l_rate','l_tenure'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('l_type').value = 'Personal';
  document.getElementById('l_start').value = new Date().toISOString().slice(0, 10);
  document.getElementById('emiPreview').textContent = '';
  await loadCustomerOptions();
  document.getElementById('loanModal').classList.add('open');
});
document.getElementById('loanCancel').addEventListener('click', () => {
  document.getElementById('loanModal').classList.remove('open');
});

// Live client-side EMI preview (mirrors the backend's reducing-balance formula)
function previewEmi() {
  const p = Number(document.getElementById('l_principal').value);
  const r = Number(document.getElementById('l_rate').value);
  const n = Number(document.getElementById('l_tenure').value);
  const el = document.getElementById('emiPreview');
  if (!p || !r || !n) { el.textContent = ''; return; }
  const monthlyRate = r / 100;
  const emi = monthlyRate === 0 ? p / n : (p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  el.textContent = `Estimated EMI: ${formatMoney(emi)} / month for ${n} months`;
}
['l_principal','l_rate','l_tenure'].forEach(id => document.getElementById(id).addEventListener('input', previewEmi));

document.getElementById('loanSave').addEventListener('click', async () => {
  const errorMsg = document.getElementById('loanError');
  errorMsg.style.display = 'none';
  const body = {
    customer_id: document.getElementById('l_customer').value,
    loan_type: document.getElementById('l_type').value.trim() || 'Personal',
    principal_amount: document.getElementById('l_principal').value,
    interest_rate: document.getElementById('l_rate').value,
    tenure_months: document.getElementById('l_tenure').value,
    start_date: document.getElementById('l_start').value
  };
  if (!body.customer_id || !body.principal_amount || !body.interest_rate || !body.tenure_months || !body.start_date) {
    errorMsg.textContent = 'All fields are required';
    errorMsg.style.display = 'block';
    return;
  }
  try {
    const result = await api('/loans', { method: 'POST', body });
    document.getElementById('loanModal').classList.remove('open');
    window.location.href = `loan-details.html?id=${result.id}`;
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

loadLoans();

// "Staff" management is admin-only — hide the nav link for staff-role users
if (user && user.role !== 'admin') {
  const staffLink = document.getElementById('staffNavLink');
  if (staffLink) staffLink.style.display = 'none';
}
