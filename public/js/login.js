document.addEventListener('DOMContentLoaded', async () => {
  const errorBanner = document.getElementById('error-banner');

  // Check URL query params for error message
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');

  if (error) {
    let message = 'Authentication failed. Please try again.';
    if (error === 'google_auth_failed') {
      message = 'Google authentication was cancelled or failed.';
    } else if (error === 'server_error') {
      message = 'Internal server error during authentication.';
    }
    if (errorBanner) {
      errorBanner.textContent = message;
      errorBanner.style.display = 'block';
    }
  }

  // Check if session is already active
  try {
    const response = await fetch('/auth/me', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        // User is already logged in, redirect to dashboard
        window.location.href = '/dashboard';
      }
    }
  } catch (err) {
    // User is not logged in or server connection failed, stay on sign-in page
    console.log('Session check complete - user unauthenticated.');
  }
});
