document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.style.display = 'none';

  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api('/auth/signup', { method: 'POST', body: { name, phone, email, password }, auth: false });
    setSession(data.token, data.user);
    window.location.href = 'customer-portal.html';
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
});
