document.addEventListener('DOMContentLoaded', async () => {
  const loadingCard = document.getElementById('loading-card');
  const profileCard = document.getElementById('profile-card');

  const avatarImg = document.getElementById('user-avatar');
  const displayNameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-email');
  const infoIdEl = document.getElementById('info-id');
  const infoGoogleIdEl = document.getElementById('info-google-id');
  const infoCreatedAtEl = document.getElementById('info-created-at');

  try {
    const response = await fetch('/auth/me', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Unauthorized or session expired, redirect to login
      window.location.href = '/';
      return;
    }

    const data = await response.json();

    if (data.success && data.user) {
      const user = data.user;

      // Populate user info
      avatarImg.onerror = () => {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=818cf8&color=fff`;
      };
      if (user.avatarUrl) {
        avatarImg.src = user.avatarUrl;
      } else {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=818cf8&color=fff`;
      }
      avatarImg.alt = `${user.displayName}'s profile photo`;

      displayNameEl.textContent = user.displayName;
      emailEl.textContent = user.email;
      infoIdEl.textContent = user.id;
      infoGoogleIdEl.textContent = user.googleId;

      if (user.createdAt) {
        const date = new Date(user.createdAt);
        infoCreatedAtEl.textContent = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }

      // Hide skeleton, show profile card
      loadingCard.classList.add('hidden');
      profileCard.classList.remove('hidden');
    } else {
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Error loading dashboard profile:', error);
    window.location.href = '/';
  }
});
