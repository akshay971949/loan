const user = guardPage('super_admin');
if (user) {
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoEmail').textContent = user.email;
}

document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  window.location.href = 'user-login.html';
});

async function loadCompanies() {
  const rows = await api('/companies');
  const body = document.getElementById('companiesBody');
  const empty = document.getElementById('companiesEmpty');

  if (!rows.length) {
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = rows.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.admin_name || '—'}</td>
      <td>${c.admin_email || '—'}</td>
      <td>${c.staff_count}</td>
      <td>${c.customer_count}</td>
      <td>${formatDate(c.created_at)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="removeCompany(${c.id})">Remove</button></td>
    </tr>
  `).join('');
}

async function removeCompany(id) {
  if (!confirm('Remove this company? This deletes its admin, staff, customers, loans and EMI records — permanently.')) return;
  try {
    await api(`/companies/${id}`, { method: 'DELETE' });
    loadCompanies();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('addBtn').addEventListener('click', () => {
  document.getElementById('companyError').style.display = 'none';
  ['c_name','c_admin_name','c_admin_email','c_admin_password'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('companyModal').classList.add('open');
});
document.getElementById('companyCancel').addEventListener('click', () => {
  document.getElementById('companyModal').classList.remove('open');
});

document.getElementById('companySave').addEventListener('click', async () => {
  const errorMsg = document.getElementById('companyError');
  errorMsg.style.display = 'none';
  const body = {
    company_name: document.getElementById('c_name').value.trim(),
    admin_name: document.getElementById('c_admin_name').value.trim(),
    admin_email: document.getElementById('c_admin_email').value.trim(),
    admin_password: document.getElementById('c_admin_password').value
  };
  if (!body.company_name || !body.admin_name || !body.admin_email || !body.admin_password) {
    errorMsg.textContent = 'All fields are required';
    errorMsg.style.display = 'block';
    return;
  }
  try {
    await api('/companies', { method: 'POST', body });
    document.getElementById('companyModal').classList.remove('open');
    loadCompanies();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

loadCompanies();
