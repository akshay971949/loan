document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.style.display = 'none';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password, portal: 'admin' }, auth: false });
    setSession(data.token, data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});

(function redirectIfLoggedIn() {
  const user = getUser();
  if (getToken() && user && user.role === 'admin') {
    window.location.href = 'dashboard.html';
  }
})();
