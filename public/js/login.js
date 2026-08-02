document.addEventListener('DOMContentLoaded', () => {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const tabAdmin = document.getElementById('tab-admin');

  const loginSection = document.getElementById('login-section');
  const signupSection = document.getElementById('signup-section');
  const adminSection = document.getElementById('admin-section');

  const portalBadge = document.getElementById('portal-badge');
  const portalBadgeText = document.getElementById('portal-badge-text');
  const portalTitle = document.getElementById('portal-title');
  const portalSubtitle = document.getElementById('portal-subtitle');

  const errorBanner = document.getElementById('error-banner');
  const successBanner = document.getElementById('success-banner');

  const localLoginForm = document.getElementById('local-login-form');
  const localSignupForm = document.getElementById('local-signup-form');
  const adminForm = document.getElementById('admin-login-form');

  const mfaGroup = document.getElementById('mfa-group');
  const forgotPasswordLink = document.getElementById('forgot-password-link');
  const forgotModal = document.getElementById('forgot-modal');
  const closeForgotModal = document.getElementById('close-forgot-modal');
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const resetTokenDisplay = document.getElementById('reset-token-display');

  const savedAccountsList = document.getElementById('saved-accounts-list');
  const addAccountBtn = document.getElementById('add-account-btn');

  // Check URL query params for errors
  const urlParams = new URLSearchParams(window.location.search);
  const errorMsg = urlParams.get('error');
  if (errorMsg) {
    showError(decodeURIComponent(errorMsg));
  }

  function showError(msg) {
    errorBanner.textContent = msg;
    errorBanner.style.display = 'block';
    successBanner.style.display = 'none';
  }

  function showSuccess(msg) {
    successBanner.textContent = msg;
    successBanner.style.display = 'block';
    errorBanner.style.display = 'none';
  }

  function clearBanners() {
    errorBanner.style.display = 'none';
    successBanner.style.display = 'none';
  }

  // Check if session is already active
  fetch('/auth/me')
    .then(res => res.json())
    .then(data => {
      if (data.success && data.user) {
        saveAccountToStorage(data.user);
        if (data.user.role === 'admin' || data.user.role === 'superadmin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        renderSavedAccounts();
      }
    })
    .catch(() => renderSavedAccounts());

  // Tab Switcher Logic
  tabLogin.addEventListener('click', () => switchTab('login'));
  tabSignup.addEventListener('click', () => switchTab('signup'));
  tabAdmin.addEventListener('click', () => switchTab('admin'));

  function switchTab(tab) {
    clearBanners();
    tabLogin.classList.remove('active', 'active-admin');
    tabSignup.classList.remove('active', 'active-admin');
    tabAdmin.classList.remove('active', 'active-admin');

    loginSection.classList.add('hidden');
    signupSection.classList.add('hidden');
    adminSection.classList.add('hidden');

    if (tab === 'login') {
      tabLogin.classList.add('active');
      loginSection.classList.remove('hidden');
      portalBadgeText.textContent = 'Universal Auth Service';
      portalTitle.textContent = 'Welcome Back';
      portalSubtitle.textContent = 'Sign in with your email, Google, or GitHub account.';
    } else if (tab === 'signup') {
      tabSignup.classList.add('active');
      signupSection.classList.remove('hidden');
      portalBadgeText.textContent = 'Account Registration';
      portalTitle.textContent = 'Create an Account';
      portalSubtitle.textContent = 'Register once for permanent access across all platform services.';
    } else if (tab === 'admin') {
      tabAdmin.classList.add('active-admin');
      adminSection.classList.remove('hidden');
      portalBadgeText.textContent = 'System Administration';
      portalTitle.textContent = 'Admin Portal Access';
      portalSubtitle.textContent = 'Sign in with Google Admin OAuth or Secret Passcode.';
    }
  }

  // Handle Signup Form (First Signup)
  localSignupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearBanners();

    const firstName = document.getElementById('signup-firstname').value;
    const lastName = document.getElementById('signup-lastname').value;
    const email = document.getElementById('signup-email').value;
    const phoneNumber = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;

    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phoneNumber, password }),
      });
      const data = await res.json();

      if (data.success) {
        showSuccess(data.message || 'Registration successful! Redirecting to login...');
        setTimeout(() => {
          switchTab('login');
          document.getElementById('login-email').value = email;
        }, 1500);
      } else {
        showError(data.message || 'Registration failed');
      }
    } catch (err) {
      showError('Network error during registration');
    }
  });

  // Handle Local Login Form
  localLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearBanners();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const mfaCode = document.getElementById('mfa-code').value;

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, mfaCode }),
      });
      const data = await res.json();

      if (data.mfaRequired) {
        mfaGroup.classList.remove('hidden');
        showError(data.message || 'Please enter your 6-digit 2FA passcode');
        return;
      }

      if (data.success) {
        saveAccountToStorage(data.user);
        if (data.user.role === 'admin' || data.user.role === 'superadmin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        showError(data.message || 'Login failed');
      }
    } catch (err) {
      showError('Network error during login');
    }
  });

  // Handle Admin Login Form
  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearBanners();

    const email = document.getElementById('admin-email').value;
    const adminKey = document.getElementById('admin-key').value;

    try {
      const response = await fetch('/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, adminKey }),
      });
      const data = await response.json();

      if (data.success) {
        saveAccountToStorage(data.user);
        window.location.href = data.redirect || '/admin';
      } else {
        showError(data.message || 'Admin authentication failed');
      }
    } catch (err) {
        showError('Connection error during admin login');
    }
  });

  // Handle Forgot & Reset Password Modal
  const modalTitle = document.getElementById('modal-title');
  const modalSubtitle = document.getElementById('modal-subtitle');
  const resetPasswordForm = document.getElementById('reset-password-form');
  const closeForgotModalBtns = document.querySelectorAll('.close-forgot-modal');

  forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    forgotModal.classList.remove('hidden');
    forgotPasswordForm.classList.remove('hidden');
    resetPasswordForm.classList.add('hidden');
    modalTitle.textContent = 'Reset Password';
    modalSubtitle.textContent = 'Enter your email address to generate a password reset token.';
  });

  closeForgotModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      forgotModal.classList.add('hidden');
    });
  });

  // Step 1: Submit email to get reset token
  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();

    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.resetToken) {
        // Auto-fill token in step 2 form for seamless UX
        document.getElementById('reset-token-input').value = data.resetToken;
        forgotPasswordForm.classList.add('hidden');
        resetPasswordForm.classList.remove('hidden');
        modalTitle.textContent = 'Set New Password';
        modalSubtitle.textContent = 'Enter your new password below to update your account.';
      } else {
        alert(data.message || 'If an account exists, a reset link has been processed.');
        forgotModal.classList.add('hidden');
      }
    } catch (err) {
      alert('Error requesting password reset token.');
    }
  });

  // Step 2: Submit reset token & new password
  resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const resetToken = document.getElementById('reset-token-input').value.trim();
    const newPassword = document.getElementById('new-password-input').value;
    const email = document.getElementById('forgot-email').value.trim();

    try {
      const res = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        showSuccess('Password reset successfully! You can now log in with your new password.');
        forgotModal.classList.add('hidden');
        switchTab('login');
        document.getElementById('login-email').value = email;
        document.getElementById('login-password').value = newPassword;
      } else {
        alert(data.message || 'Password reset failed.');
      }
    } catch (err) {
      alert('Error resetting password.');
    }
  });


  // Multi-Account Storage & Switcher Logic
  function saveAccountToStorage(user) {
    if (!user || !user.email) return;
    let accounts = JSON.parse(localStorage.getItem('auth_saved_accounts') || '[]');
    const exists = accounts.some(a => a.email.toLowerCase() === user.email.toLowerCase());
    if (!exists) {
      accounts.push({
        email: user.email,
        displayName: user.displayName || user.email,
        avatarUrl: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}`,
        role: user.role || 'user',
      });
      localStorage.setItem('auth_saved_accounts', JSON.stringify(accounts));
    }
  }

  function renderSavedAccounts() {
    let accounts = JSON.parse(localStorage.getItem('auth_saved_accounts') || '[]');
    savedAccountsList.innerHTML = '';

    if (accounts.length === 0) {
      savedAccountsList.innerHTML = '<div class="empty-state" style="padding:8px">No saved accounts yet.</div>';
      return;
    }

    accounts.forEach(acc => {
      const item = document.createElement('div');
      item.className = 'account-item';
      item.innerHTML = `
        <div class="account-info">
          <img src="${acc.avatarUrl}" class="account-avatar" alt="Avatar" />
          <div>
            <div class="account-name">${acc.displayName}</div>
            <div class="account-email">${acc.email} (${acc.role})</div>
          </div>
        </div>
        <button type="button" class="btn-text">Select</button>
      `;
      item.addEventListener('click', () => {
        document.getElementById('login-email').value = acc.email;
        switchTab('login');
      });
      savedAccountsList.appendChild(item);
    });
  }

  if (addAccountBtn) {
    addAccountBtn.addEventListener('click', () => {
      document.getElementById('login-email').value = '';
      document.getElementById('login-password').value = '';
      switchTab('login');
    });
  }
});

