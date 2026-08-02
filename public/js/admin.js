document.addEventListener('DOMContentLoaded', async () => {
  const loadingCard = document.getElementById('loading-card');
  const adminContent = document.getElementById('admin-content');
  const adminWelcomeText = document.getElementById('admin-welcome-text');

  const statTotalUsers = document.getElementById('stat-total-users');
  const statTotalAdmins = document.getElementById('stat-total-admins');
  const statTotalTasks = document.getElementById('stat-total-tasks');
  const statCompletionRate = document.getElementById('stat-completion-rate');

  const usersTableBody = document.getElementById('users-table-body');
  const auditTableBody = document.getElementById('audit-table-body');
  const tasksTableBody = document.getElementById('tasks-table-body');

  let currentAdminId = null;

  // 1. Verify Auth & Admin Privileges
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
      if (data.user.role !== 'admin' && data.user.role !== 'superadmin') {
        window.location.href = '/dashboard';
        return;
      }

      currentAdminId = data.user.id;
      adminWelcomeText.textContent = `Logged in as ${data.user.displayName} (${data.user.email})`;

      loadingCard.classList.add('hidden');
      adminContent.classList.remove('hidden');

      await loadAdminDashboard();
    } else {
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Error verifying admin authentication:', error);
    window.location.href = '/';
  }

  // 2. Main Admin Data Loader
  async function loadAdminDashboard() {
    await Promise.all([
      fetchStats(),
      fetchUsers(),
      fetchAuditLogs(),
      fetchTasks(),
    ]);
  }

  // Fetch Stats
  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();

      if (data.success && data.stats) {
        const s = data.stats;
        statTotalUsers.textContent = s.totalUsers;
        statTotalAdmins.textContent = s.totalAdmins;
        statTotalTasks.textContent = s.totalTasks;
        statCompletionRate.textContent = `${s.completionRate}%`;
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  }

  // Fetch Users List
  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();

      if (data.success && data.users) {
        renderUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }

  // Render Users Table
  function renderUsers(users) {
    if (!users || users.length === 0) {
      usersTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No registered users found.</td></tr>`;
      return;
    }

    usersTableBody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      const roleBadgeClass = u.role === 'admin' || u.role === 'superadmin' ? 'badge-admin' : 'badge-user';
      const avatarUrl = u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=818cf8&color=fff`;

      const formattedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) : 'N/A';

      const isSelf = u.id === currentAdminId;
      const targetRole = u.role === 'admin' ? 'user' : 'admin';
      const roleToggleBtnText = u.role === 'admin' ? 'Demote to User' : 'Promote to Admin';

      tr.innerHTML = `
        <td>
          <div class="user-cell">
            <img src="${avatarUrl}" alt="${escapeHtml(u.displayName)}" referrerpolicy="no-referrer" />
            <div>
              <div style="font-weight: 600;">${escapeHtml(u.displayName)}</div>
              ${isSelf ? '<span style="font-size: 0.75rem; color: var(--accent-purple);">(You)</span>' : ''}
            </div>
          </div>
        </td>
        <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(u.email)}</td>
        <td><span class="badge ${roleBadgeClass}">${u.role}</span></td>
        <td>${u.taskStats ? `${u.taskStats.completed}/${u.taskStats.total}` : '0'}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-sm toggle-role-btn" data-id="${u.id}" data-role="${targetRole}">
              ${roleToggleBtnText}
            </button>
            ${!isSelf ? `
              <button class="btn-sm btn-danger-sm delete-user-btn" data-id="${u.id}" data-name="${escapeHtml(u.displayName)}">
                Delete
              </button>
            ` : ''}
          </div>
        </td>
      `;

      usersTableBody.appendChild(tr);
    });

    document.querySelectorAll('.toggle-role-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const role = e.currentTarget.getAttribute('data-role');
        await updateUserRole(id, role);
      });
    });

    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const name = e.currentTarget.getAttribute('data-name');
        if (confirm(`Are you sure you want to delete user "${name}" and all their tasks?`)) {
          await deleteUser(id);
        }
      });
    });
  }

  // Fetch Security Audit Logs
  async function fetchAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs');
      const data = await res.json();
      if (data.success && data.logs) {
        renderAuditLogs(data.logs);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  }

  function renderAuditLogs(logs) {
    if (!logs || logs.length === 0) {
      auditTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No security logs recorded yet.</td></tr>`;
      return;
    }

    auditTableBody.innerHTML = '';
    logs.forEach(log => {
      const tr = document.createElement('tr');
      const date = new Date(log.timestamp).toLocaleString();
      const actionBadge = log.action.includes('SUCCESS') ? 'priority-low' : (log.action.includes('FAILED') || log.action.includes('LOCKED')) ? 'priority-high' : 'priority-medium';

      tr.innerHTML = `
        <td style="font-size:0.8rem; color:var(--text-muted);">${date}</td>
        <td><span class="badge ${actionBadge}">${log.action}</span></td>
        <td style="font-size:0.85rem;">${escapeHtml(log.email || 'N/A')}</td>
        <td style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(log.ipAddress)}</td>
        <td style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(log.details || '-')}</td>
      `;
      auditTableBody.appendChild(tr);
    });
  }

  // Fetch Global Tasks
  async function fetchTasks() {
    try {
      const res = await fetch('/api/admin/tasks');
      const data = await res.json();

      if (data.success && data.tasks) {
        renderTasks(data.tasks);
      }
    } catch (err) {
      console.error('Error fetching global tasks:', err);
    }
  }

  function renderTasks(tasks) {
    if (!tasks || tasks.length === 0) {
      tasksTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No system tasks created yet.</td></tr>`;
      return;
    }

    tasksTableBody.innerHTML = '';
    tasks.forEach(t => {
      const tr = document.createElement('tr');

      const ownerName = t.userId ? t.userId.displayName : 'Unknown User';
      const ownerEmail = t.userId ? t.userId.email : '';
      const priorityClass = t.priority === 'high' ? 'priority-high' : t.priority === 'low' ? 'priority-low' : 'priority-medium';

      const formattedDate = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) : 'N/A';

      tr.innerHTML = `
        <td style="font-weight: 600;">${escapeHtml(t.title)}</td>
        <td>
          <div style="font-size: 0.875rem;">${escapeHtml(ownerName)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(ownerEmail)}</div>
        </td>
        <td><span class="badge ${priorityClass}">${t.priority}</span></td>
        <td>
          <span style="color: ${t.completed ? 'var(--accent-emerald)' : 'var(--accent-amber)'}; font-weight: 600; font-size: 0.85rem;">
            ${t.completed ? 'Completed' : 'Pending'}
          </span>
        </td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
      `;

      tasksTableBody.appendChild(tr);
    });
  }

  async function updateUserRole(userId, newRole) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (data.success) {
        await loadAdminDashboard();
      } else {
        alert(data.message || 'Failed to update user role');
      }
    } catch (err) {
      console.error('Error updating role:', err);
    }
  }

  async function deleteUser(userId) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        await loadAdminDashboard();
      } else {
        alert(data.message || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});

