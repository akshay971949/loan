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

let activeEmiId = null;

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

async function loadStats() {
  const stats = await api('/emis/stats');
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stat-card"><div class="label">Total customers</div><div class="value">${stats.totalCustomers}</div></div>
    <div class="stat-card"><div class="label">Active loans</div><div class="value">${stats.activeLoans}</div></div>
    <div class="stat-card"><div class="label">Total disbursed</div><div class="value money">${formatMoney(stats.totalDisbursed)}</div></div>
    <div class="stat-card"><div class="label">Total collected</div><div class="value money good">${formatMoney(stats.totalCollected)}</div></div>
    <div class="stat-card"><div class="label">Due this month</div><div class="value money warn">${formatMoney(stats.dueThisMonth.total)} <span class="muted" style="font-size:13px">(${stats.dueThisMonth.count})</span></div></div>
    <div class="stat-card"><div class="label">Overdue</div><div class="value money bad">${formatMoney(stats.overdue.total)} <span class="muted" style="font-size:13px">(${stats.overdue.count})</span></div></div>
  `;
}

async function loadDue() {
  await api('/emis/refresh-overdue', { method: 'POST' });
  const rows = await api('/emis/due?days=7');
  const body = document.getElementById('dueBody');
  const empty = document.getElementById('dueEmpty');

  if (!rows.length) {
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = rows.map(r => `
    <tr>
      <td>${r.full_name}</td>
      <td>${r.phone}</td>
      <td>#${r.loan_id}</td>
      <td>${r.emi_number}</td>
      <td>${formatDate(r.due_date)}</td>
      <td class="right money">${formatMoney(r.emi_amount)}</td>
      <td>${statusBadge(r.status)}</td>
      <td><button class="btn btn-primary btn-sm" onclick="openPayModal(${r.id}, '${r.full_name.replace(/'/g, "\\'")}', ${r.emi_amount})">Mark paid</button></td>
    </tr>
  `).join('');
}

function openPayModal(emiId, name, amount) {
  activeEmiId = emiId;
  document.getElementById('payModalSub').textContent = `${name} — EMI amount ${formatMoney(amount)}`;
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
    await Promise.all([loadStats(), loadDue()]);
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('exportDueBtn').addEventListener('click', () => {
  downloadCsv('/export/due', 'due_emis.csv').catch(err => alert(err.message));
});

loadStats();
loadDue();

// "Staff" management is admin-only — hide the nav link for staff-role users
if (user && user.role !== 'admin') {
  const staffLink = document.getElementById('staffNavLink');
  if (staffLink) staffLink.style.display = 'none';
}
