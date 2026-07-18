const SUPABASE_URL = 'https://vqxjedlvphxgndhfugqm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_q3iDOodA4cXBa4MJLTsOIA_pb2l5Hz0';
const PRODUCTION_URL = 'https://alexthezero.github.io/member-portal/';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const resetForm = document.getElementById('reset-form');
const newPasswordForm = document.getElementById('new-password-form');
const forgotPasswordButton = document.getElementById('forgot-password');
const backToLoginButton = document.getElementById('back-to-login');
const logoutButton = document.getElementById('logout-button');
const messageBox = document.getElementById('message');
const welcomeHeading = document.getElementById('welcome-heading');
const accountEmail = document.getElementById('account-email');

function showMessage(text, type = 'success') {
  messageBox.textContent = text;
  messageBox.className = `message show ${type}`;
}

function clearMessage() {
  messageBox.textContent = '';
  messageBox.className = 'message';
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.originalText;
}

function showAuthForm(name) {
  clearMessage();
  loginForm.classList.toggle('hidden', name !== 'login');
  signupForm.classList.toggle('hidden', name !== 'signup');
  resetForm.classList.toggle('hidden', name !== 'reset');
  newPasswordForm.classList.toggle('hidden', name !== 'new-password');

  const tabsVisible = name === 'login' || name === 'signup';
  document.querySelector('.tabs').classList.toggle('hidden', !tabsVisible);
  loginTab.classList.toggle('active', name === 'login');
  signupTab.classList.toggle('active', name === 'signup');
  loginTab.setAttribute('aria-selected', String(name === 'login'));
  signupTab.setAttribute('aria-selected', String(name === 'signup'));
}

function showDashboard(user) {
  authView.classList.add('hidden');
  dashboardView.classList.remove('hidden');

  const displayName = user.user_metadata?.full_name?.trim();
  welcomeHeading.textContent = displayName ? `Welcome, ${displayName}.` : 'Welcome!';
  accountEmail.textContent = user.email || '';
}

function showLoggedOutView() {
  dashboardView.classList.add('hidden');
  authView.classList.remove('hidden');
  showAuthForm('login');
}

loginTab.addEventListener('click', () => showAuthForm('login'));
signupTab.addEventListener('click', () => showAuthForm('signup'));
forgotPasswordButton.addEventListener('click', () => showAuthForm('reset'));
backToLoginButton.addEventListener('click', () => showAuthForm('login'));

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const button = loginForm.querySelector('button[type="submit"]');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  setButtonLoading(button, true, 'Logging in…');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  setButtonLoading(button, false);
  if (error) {
    showMessage(error.message, 'error');
    return;
  }

  loginForm.reset();
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const button = signupForm.querySelector('button[type="submit"]');
  const fullName = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  setButtonLoading(button, true, 'Creating account…');

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: PRODUCTION_URL,
    },
  });

  setButtonLoading(button, false);
  if (error) {
    showMessage(error.message, 'error');
    return;
  }

  signupForm.reset();
  if (data.session) {
    showMessage('Account created successfully.');
  } else {
    showMessage('Account created. Check your email to confirm your address, then log in.');
  }
});

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const button = resetForm.querySelector('button[type="submit"]');
  const email = document.getElementById('reset-email').value.trim();
  setButtonLoading(button, true, 'Sending…');

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: PRODUCTION_URL,
  });

  setButtonLoading(button, false);
  if (error) {
    showMessage(error.message, 'error');
    return;
  }

  resetForm.reset();
  showMessage('Password reset link sent. Check your email.');
});

newPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const button = newPasswordForm.querySelector('button[type="submit"]');
  const password = document.getElementById('new-password').value;
  setButtonLoading(button, true, 'Updating…');

  const { error } = await supabaseClient.auth.updateUser({ password });

  setButtonLoading(button, false);
  if (error) {
    showMessage(error.message, 'error');
    return;
  }

  newPasswordForm.reset();
  showMessage('Password updated successfully.');
  window.setTimeout(() => window.history.replaceState({}, document.title, window.location.pathname), 800);
});

logoutButton.addEventListener('click', async () => {
  setButtonLoading(logoutButton, true, 'Logging out…');
  const { error } = await supabaseClient.auth.signOut();
  setButtonLoading(logoutButton, false);

  if (error) {
    window.alert(error.message);
  }
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    authView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    showAuthForm('new-password');
    return;
  }

  if (session?.user) {
    showDashboard(session.user);
  } else {
    showLoggedOutView();
  }
});

(async function initializePortal() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showLoggedOutView();
    showMessage(error.message, 'error');
    return;
  }

  if (data.session?.user) {
    showDashboard(data.session.user);
  } else {
    showLoggedOutView();
  }
})();