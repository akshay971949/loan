function redirectForRole(role) {
  if (role === 'super_admin') return 'companies.html';
  return 'dashboard.html'; // admin or staff
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.style.display = 'none';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password, portal: 'staff' }, auth: false });
    setSession(data.token, data.user);
    window.location.href = redirectForRole(data.user.role);
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

(function redirectIfLoggedIn() {
  const user = getUser();
  if (getToken() && user && ['super_admin', 'admin', 'staff'].includes(user.role)) {
    window.location.href = redirectForRole(user.role);
  }
})();
