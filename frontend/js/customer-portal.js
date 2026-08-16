const user = guardPage('customer');
if (user) {
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoEmail').textContent = user.email;
}

document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  window.location.href = 'customer-login.html';
});

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

async function load() {
  const loans = await api('/loans');
  const container = document.getElementById('loansContainer');
  const empty = document.getElementById('loansEmpty');

  if (!loans.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const panels = await Promise.all(loans.map(async (loan) => {
    const { emis } = await api(`/loans/${loan.id}`);
    const paid = emis.filter(e => e.status === 'paid').length;
    const rows = emis.map(e => `
      <tr>
        <td>${e.emi_number}</td>
        <td>${formatDate(e.due_date)}</td>
        <td class="right money">${formatMoney(e.emi_amount)}</td>
        <td>${statusBadge(e.status)}</td>
        <td>${e.paid_date ? formatDate(e.paid_date) : '—'}</td>
      </tr>
    `).join('');

    return `
      <div class="panel">
        <div class="panel-head">
          <h3>${loan.loan_type} loan #${loan.id} — ${formatMoney(loan.principal_amount)} ${statusBadge(loan.status)}</h3>
          <span class="muted">${paid}/${emis.length} EMIs paid</span>
        </div>
        <table>
          <thead><tr><th>#</th><th>Due date</th><th class="right">Amount</th><th>Status</th><th>Paid on</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }));

  container.innerHTML = panels.join('');
}

load();
