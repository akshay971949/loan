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

async function loadStaff() {
  const rows = await api('/staff');
  const body = document.getElementById('staffBody');
  const empty = document.getElementById('staffEmpty');

  if (!rows.length) {
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = rows.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.email}</td>
      <td>${s.phone || '—'}</td>
      <td>${formatDate(s.created_at)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="removeStaff(${s.id})">Remove</button></td>
    </tr>
  `).join('');
}

async function removeStaff(id) {
  if (!confirm('Remove this staff account? They will lose access immediately.')) return;
  try {
    await api(`/staff/${id}`, { method: 'DELETE' });
    loadStaff();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('addBtn').addEventListener('click', () => {
  document.getElementById('staffError').style.display = 'none';
  ['s_name','s_email','s_phone','s_password'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('staffModal').classList.add('open');
});
document.getElementById('staffCancel').addEventListener('click', () => {
  document.getElementById('staffModal').classList.remove('open');
});

document.getElementById('staffSave').addEventListener('click', async () => {
  const errorMsg = document.getElementById('staffError');
  errorMsg.style.display = 'none';
  const body = {
    name: document.getElementById('s_name').value.trim(),
    email: document.getElementById('s_email').value.trim(),
    phone: document.getElementById('s_phone').value.trim(),
    password: document.getElementById('s_password').value
  };
  if (!body.name || !body.email || !body.password) {
    errorMsg.textContent = 'Name, email and password are required';
    errorMsg.style.display = 'block';
    return;
  }
  try {
    await api('/staff', { method: 'POST', body });
    document.getElementById('staffModal').classList.remove('open');
    loadStaff();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

loadStaff();
