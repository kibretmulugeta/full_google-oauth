document.addEventListener('DOMContentLoaded', () => {
  const tabUser = document.getElementById('tab-user');
  const tabAdmin = document.getElementById('tab-admin');

  const userSection = document.getElementById('user-portal-section');
  const adminSection = document.getElementById('admin-portal-section');

  const portalBadge = document.getElementById('portal-badge');
  const portalBadgeText = document.getElementById('portal-badge-text');
  const portalTitle = document.getElementById('portal-title');
  const portalSubtitle = document.getElementById('portal-subtitle');

  const errorBanner = document.getElementById('error-banner');
  const adminForm = document.getElementById('admin-login-form');

  // Check URL query params for errors
  const urlParams = new URLSearchParams(window.location.search);
  const errorMsg = urlParams.get('error');
  if (errorMsg) {
    errorBanner.textContent = decodeURIComponent(errorMsg);
    errorBanner.style.display = 'block';
  }

  // Switch to User Login Tab
  tabUser.addEventListener('click', () => {
    tabUser.classList.add('active');
    tabUser.classList.remove('active-admin');
    tabAdmin.classList.remove('active', 'active-admin');

    userSection.classList.remove('hidden');
    adminSection.classList.add('hidden');

    portalBadge.classList.remove('badge-admin-banner');
    portalBadgeText.textContent = 'User Portal';
    portalTitle.textContent = 'Welcome Back';
    portalSubtitle.textContent = 'Sign in with your Google Account to access your personal task manager.';
    errorBanner.style.display = 'none';
  });

  // Switch to Admin Login Tab
  tabAdmin.addEventListener('click', () => {
    tabAdmin.classList.add('active-admin');
    tabUser.classList.remove('active', 'active-admin');

    adminSection.classList.remove('hidden');
    userSection.classList.add('hidden');

    portalBadge.classList.add('badge-admin-banner');
    portalBadgeText.textContent = 'Admin Portal Access';
    portalTitle.textContent = 'Admin Sign In';
    portalSubtitle.textContent = 'Enter your system admin credentials and passcode to access system management.';
    errorBanner.style.display = 'none';
  });

  // Handle Admin Login Form Submission
  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBanner.style.display = 'none';

      const email = document.getElementById('admin-email').value;
      const adminKey = document.getElementById('admin-key').value;

      try {
        const response = await fetch('/auth/admin-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, adminKey }),
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = data.redirect || '/admin';
        } else {
          errorBanner.textContent = data.message || 'Admin authentication failed';
          errorBanner.style.display = 'block';
        }
      } catch (err) {
        console.error('Admin login fetch error:', err);
        errorBanner.textContent = 'Connection error during admin login';
        errorBanner.style.display = 'block';
      }
    });
  }
});
