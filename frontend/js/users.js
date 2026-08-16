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

async function loadAdmins() {
  const rows = await api('/auth/admins');
  document.getElementById('adminsBody').innerHTML = rows.map(a => `
    <tr>
      <td>${a.name}${a.id === user.id ? ' <span class="muted">(you)</span>' : ''}</td>
      <td>${a.email}</td>
      <td>${a.phone || '—'}</td>
      <td>${formatDate(a.created_at)}</td>
      <td>${a.id === user.id ? '' : `<button class="btn btn-ghost btn-sm" onclick="removeAdmin(${a.id})">Remove</button>`}</td>
    </tr>
  `).join('');
}

async function removeAdmin(id) {
  if (!confirm('Remove this user account? They will lose dashboard access immediately.')) return;
  try {
    await api(`/auth/admins/${id}`, { method: 'DELETE' });
    loadAdmins();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('addBtn').addEventListener('click', () => {
  document.getElementById('adminError').style.display = 'none';
  ['a_name','a_email','a_phone','a_password'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('adminModal').classList.add('open');
});
document.getElementById('adminCancel').addEventListener('click', () => {
  document.getElementById('adminModal').classList.remove('open');
});

document.getElementById('adminSave').addEventListener('click', async () => {
  const errorMsg = document.getElementById('adminError');
  errorMsg.style.display = 'none';
  const body = {
    name: document.getElementById('a_name').value.trim(),
    email: document.getElementById('a_email').value.trim(),
    phone: document.getElementById('a_phone').value.trim(),
    password: document.getElementById('a_password').value
  };
  if (!body.name || !body.email || !body.password) {
    errorMsg.textContent = 'Name, email and password are required';
    errorMsg.style.display = 'block';
    return;
  }
  try {
    await api('/auth/admins', { method: 'POST', body });
    document.getElementById('adminModal').classList.remove('open');
    loadAdmins();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

loadAdmins();
