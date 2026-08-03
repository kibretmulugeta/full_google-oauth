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
  const taskTypeInput = document.getElementById('task-type-input');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskDescInput = document.getElementById('task-desc-input');
  const taskPriorityInput = document.getElementById('task-priority-input');

  const bookFieldsBox = document.getElementById('book-fields-box');
  const readingFieldsBox = document.getElementById('reading-fields-box');

  const taskBookTitle = document.getElementById('task-book-title');
  const taskAuthor = document.getElementById('task-author');
  const taskBorrower = document.getElementById('task-borrower');
  const taskPagesPerDay = document.getElementById('task-pages-per-day');
  const taskStartPage = document.getElementById('task-start-page');
  const taskEndPage = document.getElementById('task-end-page');
  const taskDueDate = document.getElementById('task-due-date');

  const tasksContainer = document.getElementById('tasks-container');

  const filterAllBtn = document.getElementById('filter-all');
  const filterBorrowBtn = document.getElementById('filter-borrow');
  const filterReturnBtn = document.getElementById('filter-return');
  const filterReadingBtn = document.getElementById('filter-reading');
  const filterCompletedBtn = document.getElementById('filter-completed');

  let currentFilter = 'all';
  let allTasks = [];
  let currentUser = null;

  // Toggle dynamic form fields based on mode
  if (taskTypeInput) {
    taskTypeInput.addEventListener('change', () => {
      const mode = taskTypeInput.value;
      if (mode === 'appointment' || mode === 'meeting' || mode === 'event' || mode === 'borrow_book' || mode === 'return_book' || mode === 'reading_alert') {
        bookFieldsBox.classList.remove('hidden');
      } else {
        bookFieldsBox.classList.add('hidden');
      }
    });
  }

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
      mfaStatusText.textContent = 'Status: Disabled';
      mfaStatusText.style.color = '#f87171';
      toggleMfaBtn.textContent = 'Enable 2FA';
      toggleMfaBtn.className = 'btn-primary';
    }
  }

  // Toggle 2FA Setup
  if (toggleMfaBtn) {
    toggleMfaBtn.addEventListener('click', async () => {
      if (currentUser.twoFactorEnabled) {
        if (!confirm('Are you sure you want to disable 2FA?')) return;
        try {
          const res = await fetch('/auth/2fa/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enable: false }),
          });
          const data = await res.json();
          if (data.success) {
            currentUser.twoFactorEnabled = false;
            updateMfaUi();
            alert('2FA disabled');
          }
        } catch (err) {
          alert('Failed to disable 2FA');
        }
      } else {
        try {
          const res = await fetch('/auth/2fa/generate', { method: 'POST' });
          const data = await res.json();
          if (data.success && data.qrCodeUrl) {
            mfaQrImg.src = data.qrCodeUrl;
            mfaSetupBox.classList.remove('hidden');
          }
        } catch (err) {
          alert('Error generating 2FA QR Code');
        }
      }
    });
  }

  // Verify 2FA
  if (verifyMfaBtn) {
    verifyMfaBtn.addEventListener('click', async () => {
      const code = mfaCodeInput.value.trim();
      if (!code || code.length !== 6) {
        alert('Please enter a valid 6-digit code');
        return;
      }
      try {
        const res = await fetch('/auth/2fa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (data.success) {
          currentUser.twoFactorEnabled = true;
          updateMfaUi();
          mfaCodeInput.value = '';
          alert('2FA Enabled Successfully!');
        } else {
          alert(data.message || 'Invalid passcode');
        }
      } catch (err) {
        alert('Error verifying code');
      }
    });
  }

  // Fetch Sessions
  async function fetchSessions() {
    try {
      const res = await fetch('/auth/sessions');
      const data = await res.json();

      if (data.success && data.sessions) {
        sessionsContainer.innerHTML = '';
        data.sessions.forEach(sess => {
          const sessDiv = document.createElement('div');
          sessDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: var(--surface); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); font-size: 0.8rem;';

          const isCurrent = sess.sessionToken === getCookie('token');
          sessDiv.innerHTML = `
            <div>
              <strong style="color: var(--text-primary);">${escapeHtml(sess.deviceInfo || 'Unknown Device')}</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem;">IP: ${sess.ipAddress} • Logged in: ${new Date(sess.createdAt).toLocaleDateString()}</div>
            </div>
            <div>
              ${isCurrent ? '<span class="badge" style="background: rgba(52, 211, 153, 0.2); color: #34d399;">Current Session</span>' : `<button class="btn-sm revoke-session-btn" data-id="${sess._id}" style="color: #f87171;">Revoke</button>`}
            </div>
          `;
          sessionsContainer.appendChild(sessDiv);
        });

        document.querySelectorAll('.revoke-session-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const sid = e.target.getAttribute('data-id');
            await revokeSession(sid);
          });
        });
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }

  async function revokeSession(sessionId) {
    try {
      const res = await fetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchSessions();
      }
    } catch (err) {
      alert('Failed to revoke session');
    }
  }

  // Fetch Tasks & Reminders
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
    if (currentFilter === 'borrow') {
      filtered = allTasks.filter(t => t.taskType === 'appointment' || t.taskType === 'borrow_book');
    } else if (currentFilter === 'return') {
      filtered = allTasks.filter(t => t.taskType === 'meeting' || t.taskType === 'return_book');
    } else if (currentFilter === 'reading') {
      filtered = allTasks.filter(t => t.taskType === 'event' || t.taskType === 'reading_alert');
    } else if (currentFilter === 'completed') {
      filtered = allTasks.filter(t => t.completed);
    }

    if (filtered.length === 0) {
      tasksContainer.innerHTML = `<div class="empty-state">No scheduled appointments found in this section. Create one above!</div>`;
      return;
    }

    tasksContainer.innerHTML = '';
    filtered.forEach(task => {
      const taskEl = document.createElement('div');
      taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;

      const computedStatus = task.computedStatus || (task.completed ? 'completed' : 'pending');
      let statusBadgeHtml = '';

      if (computedStatus === 'overdue') {
        statusBadgeHtml = '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">🚨 Overdue Alert</span>';
      } else if (computedStatus === 'due_soon') {
        statusBadgeHtml = '<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">⚠️ Due Soon</span>';
      } else if (task.taskType === 'appointment' || task.taskType === 'borrow_book') {
        statusBadgeHtml = '<span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;">📅 Appointment</span>';
      } else if (task.taskType === 'meeting' || task.taskType === 'return_book') {
        statusBadgeHtml = '<span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">🤝 Meeting</span>';
      } else if (task.taskType === 'event' || task.taskType === 'reading_alert') {
        statusBadgeHtml = '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">🎉 Event</span>';
      } else {
        statusBadgeHtml = '<span class="badge" style="background: rgba(148, 163, 184, 0.2); color: #cbd5e1;">📝 Schedule</span>';
      }

      const priorityBadgeClass = task.priority === 'high' ? 'priority-high' : task.priority === 'low' ? 'priority-low' : 'priority-medium';
      const dueFormatted = task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

      const locationText = task.location || task.bookTitle;
      const clientText = task.clientName || task.author;
      const durationText = task.durationMinutes ? `${task.durationMinutes} mins` : (task.borrowerName ? task.borrowerName : null);

      taskEl.innerHTML = `
        <div class="task-left" style="flex: 1;">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task._id}" style="margin-top: 4px;" />
          <div class="task-info" style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="task-title" style="${task.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHtml(task.title)}</span>
              ${statusBadgeHtml}
              <span class="badge ${priorityBadgeClass}">${task.priority}</span>
            </div>

            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: flex; flex-wrap: wrap; gap: 12px;">
              ${locationText ? `<span>📍 Location/Link: <strong style="color: #cbd5e1;">${escapeHtml(locationText)}</strong></span>` : ''}
              ${clientText ? `<span>👤 Client/Attendee: ${escapeHtml(clientText)}</span>` : ''}
              ${durationText ? `<span>⏱️ Duration: ${escapeHtml(durationText)}</span>` : ''}
              ${dueFormatted ? `<span style="${computedStatus === 'overdue' ? 'color: #f87171; font-weight: bold;' : ''}">📅 Date/Time: ${dueFormatted}</span>` : ''}
            </div>

            ${task.description ? `<span class="task-desc" style="margin-top: 4px; display: block;">${escapeHtml(task.description)}</span>` : ''}
          </div>
        </div>

        <div class="task-right" style="display: flex; align-items: center; gap: 6px;">
          ${(task.dueDate) && !task.completed ? `
            <button class="btn-sm extend-rental-btn" data-id="${task._id}" style="font-size: 0.7rem; padding: 4px 8px;" title="Reschedule appointment by +7 days">📅 +7 Days</button>
          ` : ''}
          <button class="btn-icon-danger delete-task-btn" data-id="${task._id}" title="Delete Schedule">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      tasksContainer.appendChild(taskEl);
    });

    // Event listeners
    document.querySelectorAll('.task-checkbox').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        await toggleTaskCompleted(id, e.target.checked);
      });
    });

    document.querySelectorAll('.extend-rental-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        await extendRental(id);
      });
    });

    document.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        await deleteTask(id);
      });
    });
  }

  // Filter Buttons
  function setActiveFilter(activeBtn, filterName) {
    [filterAllBtn, filterBorrowBtn, filterReturnBtn, filterReadingBtn, filterCompletedBtn].forEach(b => {
      if (b) {
        b.classList.remove('active');
        b.style.background = '';
        b.style.borderColor = '';
      }
    });
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.background = 'rgba(99, 102, 241, 0.2)';
      activeBtn.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    }
    currentFilter = filterName;
    renderTasks();
  }

  if (filterAllBtn) filterAllBtn.addEventListener('click', () => setActiveFilter(filterAllBtn, 'all'));
  if (filterBorrowBtn) filterBorrowBtn.addEventListener('click', () => setActiveFilter(filterBorrowBtn, 'borrow'));
  if (filterReturnBtn) filterReturnBtn.addEventListener('click', () => setActiveFilter(filterReturnBtn, 'return'));
  if (filterReadingBtn) filterReadingBtn.addEventListener('click', () => setActiveFilter(filterReadingBtn, 'reading'));
  if (filterCompletedBtn) filterCompletedBtn.addEventListener('click', () => setActiveFilter(filterCompletedBtn, 'completed'));

  // Restrict calendar input so user cannot select dates in the past
  if (taskDueDate) {
    const updateMinDate = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      taskDueDate.min = `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    updateMinDate();
    taskDueDate.addEventListener('focus', updateMinDate);
  }

  // Screen Toast Notification Helper
  function showScreenNotification(msg = "You schedule have beenn setup!") {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-message');
    if (msgEl) msgEl.textContent = msg;
    if (toast) {
      toast.classList.remove('hidden');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 4500);
    }
  }

  // Task Submission Form
  if (createTaskForm) {
    createTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const taskType = taskTypeInput ? taskTypeInput.value : 'appointment';
      const title = taskTitleInput.value.trim();
      const description = taskDescInput ? taskDescInput.value.trim() : '';
      const priority = taskPriorityInput ? taskPriorityInput.value : 'medium';

      const locationVal = taskBookTitle ? taskBookTitle.value.trim() : '';
      const clientVal = taskAuthor ? taskAuthor.value.trim() : '';
      const durationVal = taskBorrower ? taskBorrower.value : 30;
      const dueDate = taskDueDate ? taskDueDate.value : null;

      if (!title) return;

      if (dueDate) {
        const selectedDate = new Date(dueDate);
        const now = new Date();
        if (selectedDate < now) {
          alert('Selected date/time cannot be in the past. Please select a future date & time.');
          return;
        }
      }

      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskType,
            title,
            description,
            location: locationVal,
            clientName: clientVal,
            durationMinutes: durationVal,
            bookTitle: locationVal,
            author: clientVal,
            borrowerName: durationVal ? `${durationVal} mins` : '',
            priority,
            dueDate,
          }),
        });

        const data = await res.json();
        if (data.success) {
          taskTitleInput.value = '';
          if (taskDescInput) taskDescInput.value = '';
          if (taskBookTitle) taskBookTitle.value = '';
          if (taskAuthor) taskAuthor.value = '';
          if (taskBorrower) taskBorrower.value = '30';
          if (taskDueDate) taskDueDate.value = '';

          showScreenNotification("You schedule have beenn setup!");
          await fetchTasks();
        } else {
          alert(data.message || 'Failed to create schedule');
        }
      } catch (err) {
        alert('Error saving schedule');
      }
    });
  }

  async function extendRental(taskId) {
    try {
      const res = await fetch(`/api/tasks/${taskId}/extend?days=7`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchTasks();
      } else {
        alert(data.message || 'Failed to reschedule appointment');
      }
    } catch (err) {
      alert('Error rescheduling appointment');
    }
  }

  async function toggleTaskCompleted(taskId, completed) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  }

  async function deleteTask(taskId) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
});
