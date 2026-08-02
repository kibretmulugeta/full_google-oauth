document.addEventListener('DOMContentLoaded', async () => {
  const loadingCard = document.getElementById('loading-card');
  const dashboardContent = document.getElementById('dashboard-content');

  const avatarImg = document.getElementById('user-avatar');
  const displayNameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-email');
  const phoneEl = document.getElementById('user-phone');
  const roleBadge = document.getElementById('user-role-badge');
  const authProviderBadge = document.getElementById('auth-provider-badge');
  const adminSwitchBtn = document.getElementById('admin-switch-btn');

  const mfaStatusText = document.getElementById('mfa-status-text');
  const toggleMfaBtn = document.getElementById('toggle-mfa-btn');
  const mfaSetupBox = document.getElementById('mfa-setup-box');
  const mfaQrImg = document.getElementById('mfa-qr-img');
  const mfaCodeInput = document.getElementById('mfa-code-input');
  const verifyMfaBtn = document.getElementById('verify-mfa-btn');

  const sessionsContainer = document.getElementById('sessions-container');

  const progressText = document.getElementById('progress-text');
  const progressBarFill = document.getElementById('progress-bar-fill');

  const createTaskForm = document.getElementById('create-task-form');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskDescInput = document.getElementById('task-desc-input');
  const taskPriorityInput = document.getElementById('task-priority-input');

  const tasksContainer = document.getElementById('tasks-container');

  const filterAllBtn = document.getElementById('filter-all');
  const filterPendingBtn = document.getElementById('filter-pending');
  const filterCompletedBtn = document.getElementById('filter-completed');

  let currentFilter = 'all';
  let allTasks = [];
  let currentUser = null;

  // 1. Fetch User Profile
  try {
    const response = await fetch('/auth/me', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      window.location.href = '/';
      return;
    }

    const data = await response.json();

    if (data.success && data.user) {
      currentUser = data.user;

      avatarImg.onerror = () => {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=818cf8&color=fff`;
      };
      avatarImg.src = currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=818cf8&color=fff`;

      displayNameEl.textContent = currentUser.displayName;
      emailEl.textContent = currentUser.email;
      phoneEl.textContent = `Phone: ${currentUser.phoneNumber || 'Not set'}`;
      authProviderBadge.textContent = (currentUser.authProvider || 'LOCAL').toUpperCase();

      if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
        roleBadge.textContent = currentUser.role.toUpperCase();
        roleBadge.className = 'badge badge-admin';
        adminSwitchBtn.classList.remove('hidden');
      } else {
        roleBadge.textContent = 'USER';
        roleBadge.className = 'badge badge-user';
      }

      updateMfaUi();

      loadingCard.classList.add('hidden');
      dashboardContent.classList.remove('hidden');

      // Load Sessions & Tasks
      await fetchSessions();
      await fetchTasks();
    } else {
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    window.location.href = '/';
  }

  // 2FA UI Update
  function updateMfaUi() {
    if (currentUser.twoFactorEnabled) {
      mfaStatusText.textContent = 'Status: Active (Protected)';
      mfaStatusText.style.color = '#34d399';
      toggleMfaBtn.textContent = 'Disable 2FA';
      toggleMfaBtn.className = 'btn-primary btn-admin';
      mfaSetupBox.classList.add('hidden');
    } else {
      mfaStatusText.textContent = 'Status: Disabled (Not protected)';
      mfaStatusText.style.color = '#fca5a5';
      toggleMfaBtn.textContent = 'Setup 2FA';
      toggleMfaBtn.className = 'btn-primary';
    }
  }

  // Handle 2FA Toggle & Setup
  toggleMfaBtn.addEventListener('click', async () => {
    if (currentUser.twoFactorEnabled) {
      if (confirm('Are you sure you want to disable two-factor authentication?')) {
        const res = await fetch('/auth/mfa/disable', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          currentUser.twoFactorEnabled = false;
          updateMfaUi();
        }
      }
    } else {
      const res = await fetch('/auth/mfa/setup', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.qrCodeUrl) {
        mfaQrImg.src = data.qrCodeUrl;
        mfaSetupBox.classList.remove('hidden');
      }
    }
  });

  verifyMfaBtn.addEventListener('click', async () => {
    const code = mfaCodeInput.value.trim();
    if (!code || code.length !== 6) return alert('Enter 6-digit code');

    const res = await fetch('/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.success) {
      currentUser.twoFactorEnabled = true;
      updateMfaUi();
      alert('2FA successfully enabled!');
    } else {
      alert(data.message || 'Invalid code');
    }
  });

  // Fetch Active Device Sessions
  async function fetchSessions() {
    try {
      const res = await fetch('/auth/sessions');
      const data = await res.json();
      if (data.success) {
        renderSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }

  function renderSessions(sessions) {
    if (sessions.length === 0) {
      sessionsContainer.innerHTML = '<div class="empty-state">No active sessions found.</div>';
      return;
    }

    sessionsContainer.innerHTML = '';
    sessions.forEach(sess => {
      const div = document.createElement('div');
      div.className = 'task-item';
      div.innerHTML = `
        <div class="task-info">
          <div class="task-title" style="font-size:0.9rem;">${escapeHtml(sess.deviceInfo.userAgent || 'Web Browser')}</div>
          <div class="task-desc">IP: ${sess.deviceInfo.ipAddress} • Connected ${new Date(sess.createdAt).toLocaleDateString()}</div>
        </div>
        <button class="btn-sm btn-danger-sm revoke-session-btn" data-id="${sess._id}">Revoke Device</button>
      `;
      sessionsContainer.appendChild(div);
    });

    document.querySelectorAll('.revoke-session-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const sessionId = e.target.getAttribute('data-id');
        const res = await fetch('/auth/sessions/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (data.success) fetchSessions();
      });
    });
  }

  // Tasks Handling
  async function fetchTasks() {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();

      if (data.success) {
        allTasks = data.tasks || [];
        updateProgressBar(data.stats);
        renderTasks();
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  }

  function updateProgressBar(stats) {
    if (!stats) return;
    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    progressText.textContent = `${completed} of ${total} Completed (${percent}%)`;
    progressBarFill.style.width = `${percent}%`;
  }

  function renderTasks() {
    let filtered = allTasks;
    if (currentFilter === 'pending') {
      filtered = allTasks.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
      filtered = allTasks.filter(t => t.completed);
    }

    if (filtered.length === 0) {
      tasksContainer.innerHTML = `<div class="empty-state">No tasks found in this section. Create one above!</div>`;
      return;
    }

    tasksContainer.innerHTML = '';
    filtered.forEach(task => {
      const taskEl = document.createElement('div');
      taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
      const priorityBadgeClass = task.priority === 'high' ? 'priority-high' : task.priority === 'low' ? 'priority-low' : 'priority-medium';

      taskEl.innerHTML = `
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task._id}" />
          <div class="task-info">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="task-title">${escapeHtml(task.title)}</span>
              <span class="badge ${priorityBadgeClass}">${task.priority}</span>
            </div>
            ${task.description ? `<span class="task-desc">${escapeHtml(task.description)}</span>` : ''}
          </div>
        </div>
        <div class="task-right">
          <button class="btn-icon-danger delete-task-btn" data-id="${task._id}" title="Delete Task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      tasksContainer.appendChild(taskEl);
    });

    document.querySelectorAll('.task-checkbox').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        await toggleTaskCompleted(id, e.target.checked);
      });
    });

    document.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        await deleteTask(id);
      });
    });
  }

  if (createTaskForm) {
    createTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = taskTitleInput.value.trim();
      const description = taskDescInput.value.trim();
      const priority = taskPriorityInput.value;

      if (!title) return;

      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, priority }),
        });

        const data = await res.json();
        if (data.success) {
          taskTitleInput.value = '';
          taskDescInput.value = '';
          taskPriorityInput.value = 'medium';
          await fetchTasks();
        }
      } catch (err) {
        console.error('Error creating task:', err);
      }
    });
  }

  async function toggleTaskCompleted(id, completed) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      const data = await res.json();
      if (data.success) await fetchTasks();
    } catch (err) {
      console.error('Error updating task:', err);
    }
  }

  async function deleteTask(id) {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) await fetchTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  }

  filterAllBtn.addEventListener('click', () => setFilter('all', filterAllBtn));
  filterPendingBtn.addEventListener('click', () => setFilter('pending', filterPendingBtn));
  filterCompletedBtn.addEventListener('click', () => setFilter('completed', filterCompletedBtn));

  function setFilter(filter, activeBtn) {
    currentFilter = filter;
    [filterAllBtn, filterPendingBtn, filterCompletedBtn].forEach(b => {
      b.style.background = 'rgba(255, 255, 255, 0.08)';
      b.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    });
    activeBtn.style.background = 'rgba(99, 102, 241, 0.2)';
    activeBtn.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    renderTasks();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});

