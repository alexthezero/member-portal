const SUPABASE_URL = 'https://vqxjedlvphxgndhfugqm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_q3iDOodA4cXBa4MJLTsOIA_pb2l5Hz0';
const PRODUCTION_URL = 'https://alexthezero.github.io/member-portal/';
const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const byId = (id) => document.getElementById(id);
const authView = byId('auth-view');
const dashboardView = byId('dashboard-view');
const loginTab = byId('login-tab');
const signupTab = byId('signup-tab');
const loginForm = byId('login-form');
const signupForm = byId('signup-form');
const resendForm = byId('resend-form');
const resetForm = byId('reset-form');
const newPasswordForm = byId('new-password-form');
const profileForm = byId('profile-form');
const avatarFileInput = byId('profile-avatar-file');
const removePhotoButton = byId('remove-profile-photo');
const selectedFileName = byId('selected-file-name');
const messageBox = byId('message');
const dashboardMessage = byId('dashboard-message');
const logoutButton = byId('logout-button');
const themeButton = byId('theme-button');
let currentUser = null;
let pendingAvatarFile = null;
let removeExistingAvatar = false;
let temporaryPreviewUrl = '';

function showMessage(text, type = 'success', target = messageBox) {
  target.textContent = text;
  target.className = `message show ${type}`;
}
function clearMessage(target = messageBox) {
  target.textContent = '';
  target.className = 'message';
}
function setButtonLoading(button, isLoading, loadingText) {
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.originalText;
}
function initials(name, email) {
  const source = name?.trim() || email?.split('@')[0] || 'M';
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M';
}
function applyAvatar(element, avatarUrl, fallbackText) {
  element.textContent = fallbackText;
  element.style.backgroundImage = avatarUrl ? `url("${avatarUrl.replace(/"/g, '')}")` : '';
  element.style.color = avatarUrl ? 'transparent' : '';
}
function clearTemporaryPreview() {
  if (temporaryPreviewUrl) URL.revokeObjectURL(temporaryPreviewUrl);
  temporaryPreviewUrl = '';
}
function avatarExtension(file) {
  const extensionByType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return extensionByType[file.type] || 'jpg';
}
function currentAvatarUrl() {
  return currentUser?.user_metadata?.avatar_url?.trim() || '';
}
function resetPhotoSelection() {
  clearTemporaryPreview();
  pendingAvatarFile = null;
  removeExistingAvatar = false;
  avatarFileInput.value = '';
  selectedFileName.textContent = 'No photo selected';
}
function refreshPhotoControls() {
  removePhotoButton.classList.toggle('hidden', !currentAvatarUrl() && !pendingAvatarFile);
}

function showAuthForm(name) {
  clearMessage();
  loginForm.classList.toggle('hidden', name !== 'login');
  signupForm.classList.toggle('hidden', name !== 'signup');
  resendForm.classList.toggle('hidden', name !== 'resend');
  resetForm.classList.toggle('hidden', name !== 'reset');
  newPasswordForm.classList.toggle('hidden', name !== 'new-password');
  const tabsVisible = name === 'login' || name === 'signup';
  document.querySelector('.tabs').classList.toggle('hidden', !tabsVisible);
  loginTab.classList.toggle('active', name === 'login');
  signupTab.classList.toggle('active', name === 'signup');
  loginTab.setAttribute('aria-selected', String(name === 'login'));
  signupTab.setAttribute('aria-selected', String(name === 'signup'));
}

function showPortalSection(name) {
  document.querySelectorAll('.portal-section').forEach((section) => section.classList.add('hidden'));
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.section === name));
  byId(`section-${name}`).classList.remove('hidden');
  clearMessage(dashboardMessage);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderUser(user) {
  currentUser = user;
  const metadata = user.user_metadata || {};
  const displayName = metadata.full_name?.trim() || 'Member';
  const avatarUrl = metadata.avatar_url?.trim() || '';
  const role = user.app_metadata?.role || 'member';
  const fallback = initials(displayName, user.email);

  byId('welcome-heading').textContent = `Welcome, ${displayName}.`;
  byId('account-email').textContent = user.email || '';
  byId('role-badge').textContent = role;
  byId('profile-role').textContent = role;
  byId('profile-preview-name').textContent = displayName;
  byId('profile-preview-email').textContent = user.email || '';
  byId('profile-name').value = displayName;
  byId('profile-email').value = user.email || '';
  applyAvatar(byId('avatar-display'), avatarUrl, fallback);
  applyAvatar(byId('profile-avatar-preview'), avatarUrl, fallback);
  resetPhotoSelection();
  refreshPhotoControls();
}

function showDashboard(user) {
  authView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  renderUser(user);
  showPortalSection('home');
}
function showLoggedOutView() {
  currentUser = null;
  resetPhotoSelection();
  dashboardView.classList.add('hidden');
  authView.classList.remove('hidden');
  showAuthForm('login');
}
function openResendForm(email = '') {
  showAuthForm('resend');
  byId('resend-email').value = email;
  byId('resend-email').focus();
}

loginTab.addEventListener('click', () => showAuthForm('login'));
signupTab.addEventListener('click', () => showAuthForm('signup'));
byId('forgot-password').addEventListener('click', () => showAuthForm('reset'));
byId('open-resend-confirmation').addEventListener('click', () => openResendForm(byId('login-email').value.trim()));
byId('open-resend-confirmation-signup').addEventListener('click', () => openResendForm(byId('signup-email').value.trim()));
byId('back-from-resend').addEventListener('click', () => showAuthForm('login'));
byId('back-to-login').addEventListener('click', () => showAuthForm('login'));
document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => showPortalSection(button.dataset.section)));
document.querySelectorAll('[data-open-section]').forEach((button) => button.addEventListener('click', () => showPortalSection(button.dataset.openSection)));

avatarFileInput.addEventListener('change', () => {
  clearMessage(dashboardMessage);
  const file = avatarFileInput.files?.[0];
  if (!file) {
    resetPhotoSelection();
    const fallback = initials(byId('profile-name').value, currentUser?.email);
    applyAvatar(byId('profile-avatar-preview'), currentAvatarUrl(), fallback);
    refreshPhotoControls();
    return;
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    avatarFileInput.value = '';
    showMessage('Please choose a JPG, PNG, WebP, or GIF image.', 'error', dashboardMessage);
    return;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    avatarFileInput.value = '';
    showMessage('The selected image is larger than 5 MB.', 'error', dashboardMessage);
    return;
  }
  clearTemporaryPreview();
  pendingAvatarFile = file;
  removeExistingAvatar = false;
  temporaryPreviewUrl = URL.createObjectURL(file);
  selectedFileName.textContent = file.name;
  applyAvatar(byId('profile-avatar-preview'), temporaryPreviewUrl, initials(byId('profile-name').value, currentUser?.email));
  refreshPhotoControls();
});

removePhotoButton.addEventListener('click', () => {
  clearTemporaryPreview();
  pendingAvatarFile = null;
  removeExistingAvatar = true;
  avatarFileInput.value = '';
  selectedFileName.textContent = 'Current photo will be removed';
  applyAvatar(byId('profile-avatar-preview'), '', initials(byId('profile-name').value, currentUser?.email));
  removePhotoButton.classList.add('hidden');
});

byId('profile-name').addEventListener('input', () => {
  byId('profile-preview-name').textContent = byId('profile-name').value.trim() || 'Member';
  if (!pendingAvatarFile && (removeExistingAvatar || !currentAvatarUrl())) {
    applyAvatar(byId('profile-avatar-preview'), '', initials(byId('profile-name').value, currentUser?.email));
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage();
  const button = loginForm.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Logging in…');
  const { error } = await supabaseClient.auth.signInWithPassword({ email: byId('login-email').value.trim(), password: byId('login-password').value });
  setButtonLoading(button, false);
  if (error) return showMessage(error.message, 'error');
  loginForm.reset();
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage();
  const button = signupForm.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Creating account…');
  const { data, error } = await supabaseClient.auth.signUp({
    email: byId('signup-email').value.trim(), password: byId('signup-password').value,
    options: { data: { full_name: byId('signup-name').value.trim() }, emailRedirectTo: PRODUCTION_URL },
  });
  setButtonLoading(button, false);
  if (error) return showMessage(error.message, 'error');
  signupForm.reset();
  showMessage(data.session ? 'Account created successfully.' : 'Account created. Check your email to confirm your address, then log in.');
});

resendForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage();
  const button = resendForm.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Sending…');
  const { error } = await supabaseClient.auth.resend({ type: 'signup', email: byId('resend-email').value.trim(), options: { emailRedirectTo: PRODUCTION_URL } });
  setButtonLoading(button, false);
  if (error) return showMessage(error.message, 'error');
  showMessage('A new confirmation email was sent. Check your inbox and spam folder.');
});

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage();
  const button = resetForm.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Sending…');
  const { error } = await supabaseClient.auth.resetPasswordForEmail(byId('reset-email').value.trim(), { redirectTo: PRODUCTION_URL });
  setButtonLoading(button, false);
  if (error) return showMessage(error.message, 'error');
  resetForm.reset(); showMessage('Password reset link sent. Check your email.');
});

newPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage();
  const button = newPasswordForm.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Updating…');
  const { error } = await supabaseClient.auth.updateUser({ password: byId('new-password').value });
  setButtonLoading(button, false);
  if (error) return showMessage(error.message, 'error');
  newPasswordForm.reset(); showMessage('Password updated successfully.');
  window.setTimeout(() => window.history.replaceState({}, document.title, window.location.pathname), 800);
});

async function uploadAvatar(file) {
  const extension = avatarExtension(file);
  const filePath = `${currentUser.id}/profile.${extension}`;
  const { error: uploadError } = await supabaseClient.storage.from(AVATAR_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;
  const { data } = supabaseClient.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
  return `${data.publicUrl}?v=${Date.now()}`;
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage(dashboardMessage);
  const button = profileForm.querySelector('button[type="submit"]');
  const fullName = byId('profile-name').value.trim();
  let avatarUrl = removeExistingAvatar ? '' : currentAvatarUrl();
  setButtonLoading(button, true, pendingAvatarFile ? 'Uploading…' : 'Saving…');

  try {
    if (pendingAvatarFile) avatarUrl = await uploadAvatar(pendingAvatarFile);
    const { data, error } = await supabaseClient.auth.updateUser({ data: { full_name: fullName, avatar_url: avatarUrl } });
    if (error) throw error;
    renderUser(data.user);
    showMessage('Your profile has been updated.', 'success', dashboardMessage);
  } catch (error) {
    const storageHint = /bucket|storage|row-level security|policy/i.test(error.message || '')
      ? ' The Supabase avatars bucket or its upload policy may still need to be configured.'
      : '';
    showMessage(`${error.message || 'The profile could not be updated.'}${storageHint}`, 'error', dashboardMessage);
  } finally {
    setButtonLoading(button, false);
  }
});

logoutButton.addEventListener('click', async () => {
  setButtonLoading(logoutButton, true, 'Logging out…');
  const { error } = await supabaseClient.auth.signOut();
  setButtonLoading(logoutButton, false);
  if (error) window.alert(error.message);
});

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('portal-theme', theme);
  themeButton.textContent = theme === 'light' ? '☾' : '☀';
  themeButton.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
}
setTheme(localStorage.getItem('portal-theme') || 'dark');
themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    authView.classList.remove('hidden'); dashboardView.classList.add('hidden'); showAuthForm('new-password'); return;
  }
  if (session?.user) showDashboard(session.user); else showLoggedOutView();
});

(async function initializePortal() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) { showLoggedOutView(); showMessage(error.message, 'error'); return; }
  if (data.session?.user) showDashboard(data.session.user); else showLoggedOutView();
})();