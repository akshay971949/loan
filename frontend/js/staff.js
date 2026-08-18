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
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openResetModal(${s.id}, '${s.name.replace(/'/g, "\\'")}')">Reset password</button>
        <button class="btn btn-ghost btn-sm" onclick="removeStaff(${s.id})">Remove</button>
      </td>
    </tr>
  `).join('');
}

let resetStaffId = null;
function openResetModal(id, name) {
  resetStaffId = id;
  document.getElementById('resetModalSub').textContent = `Set a new password for ${name}`;
  document.getElementById('r_password').value = '';
  document.getElementById('resetError').style.display = 'none';
  document.getElementById('resetModal').classList.add('open');
}
document.getElementById('resetCancel').addEventListener('click', () => {
  document.getElementById('resetModal').classList.remove('open');
});
document.getElementById('resetConfirm').addEventListener('click', async () => {
  const errorMsg = document.getElementById('resetError');
  errorMsg.style.display = 'none';
  const new_password = document.getElementById('r_password').value;
  if (!new_password || new_password.length < 6) {
    errorMsg.textContent = 'Password must be at least 6 characters';
    errorMsg.style.display = 'block';
    return;
  }
  try {
    await api(`/staff/${resetStaffId}/reset-password`, { method: 'PUT', body: { new_password } });
    document.getElementById('resetModal').classList.remove('open');
    alert('Password reset. Share the new password with them directly.');
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

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
