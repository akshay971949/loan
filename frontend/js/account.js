const user = guardPage(); // no specific role required — works for admin or customer
const backLink = document.getElementById('backLink');
if (user) {
  const dest = user.role === 'admin' ? 'dashboard.html' : 'customer-portal.html';
  backLink.innerHTML = `<a href="${dest}">← Back to dashboard</a>`;
}

document.getElementById('pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  const current_password = document.getElementById('current_password').value;
  const new_password = document.getElementById('new_password').value;
  const confirm_password = document.getElementById('confirm_password').value;

  if (new_password !== confirm_password) {
    errorMsg.textContent = 'New password and confirmation do not match';
    errorMsg.style.display = 'block';
    return;
  }

  try {
    await api('/auth/change-password', { method: 'PUT', body: { current_password, new_password } });
    successMsg.style.display = 'block';
    document.getElementById('pwForm').reset();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});
