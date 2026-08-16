const user = guardPage('admin');
if (user) {
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoEmail').textContent = user.email;
}

document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  window.location.href = 'user-login.html';
});

async function loadCustomers(search = '') {
  const rows = await api(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  const body = document.getElementById('customersBody');
  const empty = document.getElementById('customersEmpty');

  if (!rows.length) {
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = rows.map(c => `
    <tr>
      <td><a href="loans.html?customer_id=${c.id}">${c.full_name}</a></td>
      <td>${c.phone}</td>
      <td>${c.email || '—'}</td>
      <td>${c.occupation || '—'}</td>
      <td>${formatDate(c.created_at)}</td>
      <td><a class="btn btn-ghost btn-sm" href="loans.html?customer_id=${c.id}">View loans</a></td>
    </tr>
  `).join('');
}

let searchTimer;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadCustomers(e.target.value.trim()), 300);
});

document.getElementById('exportBtn').addEventListener('click', () => {
  downloadCsv('/export/customers', 'customers.csv').catch(err => alert(err.message));
});

document.getElementById('addBtn').addEventListener('click', () => {
  document.getElementById('custError').style.display = 'none';
  ['c_name','c_phone','c_email','c_occupation','c_address','c_idtype','c_idnum','c_income'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('custModal').classList.add('open');
});
document.getElementById('custCancel').addEventListener('click', () => {
  document.getElementById('custModal').classList.remove('open');
});

document.getElementById('custSave').addEventListener('click', async () => {
  const errorMsg = document.getElementById('custError');
  errorMsg.style.display = 'none';
  const body = {
    full_name: document.getElementById('c_name').value.trim(),
    phone: document.getElementById('c_phone').value.trim(),
    email: document.getElementById('c_email').value.trim(),
    occupation: document.getElementById('c_occupation').value.trim(),
    address: document.getElementById('c_address').value.trim(),
    id_proof_type: document.getElementById('c_idtype').value.trim(),
    id_proof_number: document.getElementById('c_idnum').value.trim(),
    monthly_income: document.getElementById('c_income').value || null
  };
  if (!body.full_name || !body.phone) {
    errorMsg.textContent = 'Name and phone are required';
    errorMsg.style.display = 'block';
    return;
  }
  try {
    await api('/customers', { method: 'POST', body });
    document.getElementById('custModal').classList.remove('open');
    loadCustomers();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

loadCustomers();
