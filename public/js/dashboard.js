document.addEventListener('DOMContentLoaded', async () => {
  const loadingCard = document.getElementById('loading-card');
  const dashboardContent = document.getElementById('dashboard-content');

  const avatarImg = document.getElementById('user-avatar');
  const displayNameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-email');
  const roleBadge = document.getElementById('user-role-badge');
  const adminSwitchBtn = document.getElementById('admin-switch-btn');

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
      const user = data.user;

      avatarImg.onerror = () => {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=818cf8&color=fff`;
      };
      avatarImg.src = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=818cf8&color=fff`;

      displayNameEl.textContent = user.displayName;
      emailEl.textContent = user.email;

      if (user.role === 'admin') {
        roleBadge.textContent = 'ADMIN';
        roleBadge.className = 'badge badge-admin';
        adminSwitchBtn.classList.remove('hidden');
      } else {
        roleBadge.textContent = 'USER';
        roleBadge.className = 'badge badge-user';
      }

      loadingCard.classList.add('hidden');
      dashboardContent.classList.remove('hidden');

      // Load User Tasks
      await fetchTasks();
    } else {
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    window.location.href = '/';
  }

  // 2. Fetch Tasks Function
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

  // Update Progress Bar
  function updateProgressBar(stats) {
    if (!stats) return;
    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    progressText.textContent = `${completed} of ${total} Completed (${percent}%)`;
    progressBarFill.style.width = `${percent}%`;
  }

  // Render Tasks according to active filter
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

    // Attach Event Listeners to Checkboxes and Delete Buttons
    document.querySelectorAll('.task-checkbox').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const isChecked = e.target.checked;
        await toggleTaskCompleted(id, isChecked);
      });
    });

    document.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        await deleteTask(id);
      });
    });
  }

  // 3. Create Task Handler
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

  // 4. Toggle Task Completion
  async function toggleTaskCompleted(id, completed) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  }

  // 5. Delete Task
  async function deleteTask(id) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  }

  // 6. Filter Listeners
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
