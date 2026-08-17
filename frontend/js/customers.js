const user = guardPage(['admin', 'staff']);
if (user) {
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoEmail').textContent = user.email;
}

document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault(); clearSession(); window.location.href = 'user-login.html';
});

let editingCustomerId = null;

async function loadCustomers(search = '') {
  const rows = await api(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  const body = document.getElementById('customersBody');
  const empty = document.getElementById('customersEmpty');
  if (!rows.length) { body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';

  body.innerHTML = rows.map(c => `
    <tr>
      <td><a href="loans.html?customer_id=${c.id}">${c.full_name}</a></td>
      <td>${c.phone}</td>
      <td>${c.email || '—'}</td>
      <td>${c.occupation || '—'}</td>
      <td>${formatDate(c.created_at)}</td>
      <td>
        <a class="btn btn-ghost btn-sm" href="loans.html?customer_id=${c.id}">View loans</a>
        ${user.role === 'admin' ? `<button class="btn btn-ghost btn-sm" onclick="editCustomer(${c.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="removeCustomer(${c.id})">Remove</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function editCustomer(id) {
  try {
    const c = await api(`/customers/${id}`);
    editingCustomerId = id;
    document.getElementById('custModalTitle').textContent = 'Edit customer';
    document.getElementById('custModalSub').textContent = 'Only the company admin can edit customer details';
    document.getElementById('c_name').value = c.full_name || '';
    document.getElementById('c_phone').value = c.phone || '';
    document.getElementById('c_email').value = c.email || '';
    document.getElementById('c_occupation').value = c.occupation || '';
    document.getElementById('c_address').value = c.address || '';
    document.getElementById('c_idtype').value = c.id_proof_type || '';
    document.getElementById('c_idnum').value = c.id_proof_number || '';
    document.getElementById('custModal').classList.add('open');
  } catch (err) { alert(err.message); }
}

async function removeCustomer(id) {
  if (!confirm('Remove this customer and all linked loans/EMIs? This cannot be undone.')) return;
  try { await api(`/customers/${id}`, { method:'DELETE' }); loadCustomers(); }
  catch (err) { alert(err.message); }
}

let searchTimer;
document.getElementById('searchInput').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadCustomers(e.target.value.trim()), 300);
});
document.getElementById('exportBtn').addEventListener('click', () => {
  downloadCsv('/export/customers', 'customers.csv').catch(err => alert(err.message));
});
document.getElementById('addBtn').addEventListener('click', () => {
  editingCustomerId = null;
  document.getElementById('custModalTitle').textContent = 'Add customer';
  document.getElementById('custModalSub').textContent = 'Create a borrower profile';
  document.getElementById('custError').style.display='none';
  ['c_name','c_phone','c_email','c_occupation','c_address','c_idtype','c_idnum'].forEach(id => document.getElementById(id).value='');
  document.getElementById('custModal').classList.add('open');
});
document.getElementById('custCancel').addEventListener('click', () => document.getElementById('custModal').classList.remove('open'));

document.getElementById('custSave').addEventListener('click', async () => {
  const errorMsg=document.getElementById('custError'); errorMsg.style.display='none';
  const body={
    full_name:document.getElementById('c_name').value.trim(),
    phone:document.getElementById('c_phone').value.trim(),
    email:document.getElementById('c_email').value.trim(),
    occupation:document.getElementById('c_occupation').value.trim(),
    address:document.getElementById('c_address').value.trim(),
    id_proof_type:document.getElementById('c_idtype').value.trim(),
    id_proof_number:document.getElementById('c_idnum').value.trim()
  };
  if(!body.full_name || !body.phone || !body.email){
    errorMsg.textContent='Name, Gmail and phone are required'; errorMsg.style.display='block'; return;
  }
  try {
    if (editingCustomerId) await api(`/customers/${editingCustomerId}`,{method:'PUT',body});
    else await api('/customers',{method:'POST',body});
    document.getElementById('custModal').classList.remove('open'); loadCustomers();
  } catch(err){ errorMsg.textContent=err.message; errorMsg.style.display='block'; }
});

loadCustomers();
if (user && user.role !== 'admin') {
  const staffLink=document.getElementById('staffNavLink'); if(staffLink) staffLink.style.display='none';
}
