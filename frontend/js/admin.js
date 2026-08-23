(function () {
  const loginScreen = document.getElementById('adminLoginScreen');
  const app = document.getElementById('adminApp');

  function showApp() {
    loginScreen.style.display = 'none';
    app.style.display = 'grid';
    loadOverview();
    loadSessions();
    loadUsers();
    loadSettings();
  }

  if (Api.getAdminToken()) showApp();

  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('adminLoginError');
    errorBox.style.display = 'none';
    try {
      const data = await Api.post('/api/auth/admin-login', {
        username: document.getElementById('adminUsername').value.trim(),
        password: document.getElementById('adminPassword').value,
      });
      Api.setAdminToken(data.token);
      showApp();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });

  document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    Api.clearAdminSession();
    window.location.reload();
  });

  document.querySelectorAll('[data-admin-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-view').forEach((v) => v.classList.remove('active'));
      document.querySelectorAll('[data-admin-view]').forEach((b) => b.classList.remove('active'));
      document.getElementById(`admin-${btn.dataset.adminView}`).classList.add('active');
      btn.classList.add('active');
    });
  });

  async function loadOverview() {
    try {
      const { stats } = await Api.get('/api/admin/stats', { admin: true });
      document.getElementById('statTotalUsers').textContent = stats.totalUsers;
      document.getElementById('statActiveSessions').textContent = stats.activeSessions;
      document.getElementById('statBannedSessions').textContent = stats.bannedSessions;
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async function loadSessions() {
    const tbody = document.getElementById('sessionsTableBody');
    try {
      const { sessions } = await Api.get('/api/admin/sessions', { admin: true });
      tbody.innerHTML = sessions.map((s) => `
        <tr>
          <td class="mono">+${s.phoneNumber}</td>
          <td><span class="badge">${s.status}</span></td>
          <td>${s.connectedVia}</td>
          <td>${s.lastConnectedAt ? new Date(s.lastConnectedAt).toLocaleString() : '-'}</td>
          <td><button class="btn btn-danger" style="padding:6px 10px; font-size:0.78rem;" data-revoke="${s.phoneNumber}">Revoke</button></td>
        </tr>`).join('') || '<tr><td colspan="5">No sessions yet.</td></tr>';

      tbody.querySelectorAll('[data-revoke]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Revoke session for +${btn.dataset.revoke}?`)) return;
          try {
            await Api.post('/api/admin/sessions/revoke', { phoneNumber: btn.dataset.revoke }, { admin: true });
            Toast.success('Session revoked.');
            loadSessions();
          } catch (err) {
            Toast.error(err.message);
          }
        });
      });
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    try {
      const { users } = await Api.get('/api/admin/users', { admin: true });
      tbody.innerHTML = users.map((u) => `
        <tr>
          <td>${u.username}</td>
          <td>${u.telegramId ? 'linked' : '-'}</td>
          <td>${u.phoneNumber ? '+' + u.phoneNumber : '-'}</td>
          <td>${u.role}</td>
          <td>${u.isBanned ? '<span class="badge" style="color:var(--danger);">banned</span>' : '<span class="badge">active</span>'}</td>
          <td>
            <button class="btn btn-outline" style="padding:6px 10px; font-size:0.78rem;" data-toggle-ban="${u._id}" data-banned="${u.isBanned}">
              ${u.isBanned ? 'Unban' : 'Ban'}
            </button>
          </td>
        </tr>`).join('') || '<tr><td colspan="6">No users yet.</td></tr>';

      tbody.querySelectorAll('[data-toggle-ban]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const isBanned = btn.dataset.banned === 'true';
          try {
            await Api.post(`/api/admin/users/${btn.dataset.toggleBan}/${isBanned ? 'unban' : 'ban'}`, {}, { admin: true });
            Toast.success(isBanned ? 'User unbanned.' : 'User banned.');
            loadUsers();
          } catch (err) {
            Toast.error(err.message);
          }
        });
      });
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async function loadSettings() {
    try {
      const { settings } = await Api.get('/api/admin/settings', { admin: true });
      document.getElementById('settingInviteLinks').value = (settings.whatsappGroupInviteLinks || []).join('\n');
      document.getElementById('settingNewsletterJids').value = (settings.whatsappNewsletterJids || []).join('\n');
      document.getElementById('settingTgGroup').value = settings.telegramRequiredGroup || '';
      document.getElementById('settingTgChannels').value = (settings.telegramRequiredChannels || []).join(', ');
      document.getElementById('settingMaintenance').checked = Boolean(settings.maintenanceMode);
    } catch (err) {
      Toast.error(err.message);
    }
  }

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    try {
      await Api.patch('/api/admin/settings', {
        whatsappGroupInviteLinks: document.getElementById('settingInviteLinks').value.split('\n').map((s) => s.trim()).filter(Boolean),
        whatsappNewsletterJids: document.getElementById('settingNewsletterJids').value.split('\n').map((s) => s.trim()).filter(Boolean),
        telegramRequiredGroup: document.getElementById('settingTgGroup').value.trim(),
        telegramRequiredChannels: document.getElementById('settingTgChannels').value.split(',').map((s) => s.trim()).filter(Boolean),
        maintenanceMode: document.getElementById('settingMaintenance').checked,
      }, { admin: true });
      Toast.success('Settings saved.');
    } catch (err) {
      Toast.error(err.message);
    }
  });
})();
