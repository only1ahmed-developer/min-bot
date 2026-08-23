(function () {
  if (!Api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  window.ADEVOS_TELEGRAM_BOT_USERNAME = window.ADEVOS_TELEGRAM_BOT_USERNAME || 'AdevosMinBot';
  document.getElementById('tgOpenBtn').href = `https://t.me/${window.ADEVOS_TELEGRAM_BOT_USERNAME}`;

  const state = { account: null, groups: { whatsapp: [], telegram: [] }, groupPlatform: 'whatsapp' };

  /* ---------------- navigation ---------------- */
  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.getElementById(`view-${name}`)?.classList.add('active');
    document.querySelectorAll('.side-link[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    document.getElementById('pageTitle').textContent = name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById('sidebar').classList.remove('open');
  }
  document.querySelectorAll('[data-view]').forEach((btn) =>
    btn.addEventListener('click', () => showView(btn.dataset.view))
  );
  document.querySelectorAll('[data-view-link]').forEach((btn) =>
    btn.addEventListener('click', () => showView(btn.dataset.viewLink))
  );
  document.getElementById('mobileMenuBtn').addEventListener('click', () =>
    document.getElementById('sidebar').classList.toggle('open')
  );
  document.getElementById('logoutBtn').addEventListener('click', () => {
    Api.clearSession();
    window.location.href = 'login.html';
  });

  /* ---------------- load account + render everything ---------------- */
  async function loadAccount() {
    try {
      const { account } = await Api.get('/api/account/me');
      state.account = account;
      renderAccount();
      await loadGroups();
    } catch (err) {
      Toast.error(err.message);
      if (err.message.toLowerCase().includes('authenticat')) {
        Api.clearSession();
        window.location.href = 'login.html';
      }
    }
  }

  function renderAccount() {
    const a = state.account;
    document.getElementById('topUsername').textContent = a.username;
    document.getElementById('avatarInitial').textContent = a.username.charAt(0).toUpperCase();
    document.getElementById('profileUsername').value = a.username;

    // Overview
    const platformsConnected = (a.whatsapp ? 1 : 0) + (a.telegram ? 1 : 0);
    document.getElementById('ovPlatforms').textContent = platformsConnected;
    document.getElementById('ovStatus').textContent = a.whatsapp ? a.whatsapp.status : 'not connected';

    const overviewCards = document.getElementById('overviewCards');
    overviewCards.innerHTML = '';
    overviewCards.appendChild(buildBotCard('WhatsApp', a.whatsapp, 'whatsapp'));
    overviewCards.appendChild(buildBotCard('Telegram', a.telegram ? { status: 'connected', groupCount: a.telegram.groupCount } : null, 'telegram'));

    // WhatsApp view
    document.getElementById('waConnectedCard').style.display = a.whatsapp ? 'block' : 'none';
    document.getElementById('waConnectCard').style.display = a.whatsapp ? 'none' : 'block';
    if (a.whatsapp) {
      document.getElementById('waRing').dataset.state = a.whatsapp.status === 'connected' ? 'connected' : (a.whatsapp.status === 'pairing' ? 'connecting' : 'offline');
      document.getElementById('waNumber').textContent = `+${a.whatsapp.phoneNumber}`;
      document.getElementById('waStatusText').textContent = a.whatsapp.status;
      document.getElementById('waGroupCount').textContent = a.whatsapp.groupCount;
    }

    // Telegram view
    document.getElementById('tgConnectedCard').style.display = a.telegram ? 'block' : 'none';
    document.getElementById('tgConnectCard').style.display = a.telegram ? 'none' : 'block';
    if (a.telegram) document.getElementById('tgGroupCount').textContent = a.telegram.groupCount;
  }

  function buildBotCard(label, data, platform) {
    const card = document.createElement('div');
    card.className = 'card';
    if (!data) {
      card.innerHTML = `
        <div class="bot-card-head">
          <div class="bot-card-title"><span class="ring" data-state="offline"></span> ${label} Bot</div>
        </div>
        <p>Not connected yet.</p>
        <button class="btn btn-outline btn-block" data-view="${platform}">Connect ${label}</button>`;
    } else {
      const ringState = data.status === 'connected' ? 'connected' : (data.status === 'pairing' ? 'connecting' : 'offline');
      card.innerHTML = `
        <div class="bot-card-head">
          <div class="bot-card-title"><span class="ring" data-state="${ringState}"></span> ${label} Bot</div>
          <span class="badge">${data.status || 'linked'}</span>
        </div>
        <div class="bot-meta-row"><span>Groups</span><span>${data.groupCount ?? '-'}</span></div>`;
    }
    card.querySelector('[data-view]')?.addEventListener('click', (e) => showView(e.target.dataset.view));
    return card;
  }

  /* ---------------- WhatsApp pairing: code flow ---------------- */
  document.querySelectorAll('[data-wa-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-wa-mode]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('waPairMode').style.display = btn.dataset.waMode === 'pair' ? 'block' : 'none';
      document.getElementById('waQrMode').style.display = btn.dataset.waMode === 'qr' ? 'block' : 'none';
    });
  });

  document.getElementById('waStartPairBtn').addEventListener('click', async () => {
    const btn = document.getElementById('waStartPairBtn');
    const resultBox = document.getElementById('waPairResult');
    const phoneNumber = document.getElementById('waPhoneInput').value.replace(/[^0-9]/g, '');
    if (!phoneNumber) return Toast.error('Enter a phone number first.');

    btn.disabled = true; btn.textContent = 'Requesting code...';
    resultBox.innerHTML = '';
    try {
      const { pairingCode } = await Api.post('/api/pairing/start', { phoneNumber });
      resultBox.innerHTML = `
        <div class="code-display">${pairingCode}</div>
        <div class="status-line"><span class="ring" data-state="connecting"></span> Waiting for you to enter the code on WhatsApp...</div>`;
      pollPairingStatus(phoneNumber);
    } catch (err) {
      Toast.error(err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Get pairing code';
    }
  });

  document.getElementById('waStartQrBtn').addEventListener('click', async () => {
    const btn = document.getElementById('waStartQrBtn');
    const resultBox = document.getElementById('waQrResult');
    const phoneNumber = document.getElementById('waQrPhoneInput').value.replace(/[^0-9]/g, '');
    if (!phoneNumber) return Toast.error('Enter a phone number first.');

    btn.disabled = true; btn.textContent = 'Starting...';
    resultBox.innerHTML = '<div class="skeleton" style="width:220px;height:220px;margin:0 auto;border-radius:12px;"></div>';
    try {
      await Api.post('/api/pairing/start-qr', { phoneNumber });
      pollQr(phoneNumber, resultBox);
      pollPairingStatus(phoneNumber);
    } catch (err) {
      Toast.error(err.message);
      resultBox.innerHTML = '';
    } finally {
      btn.disabled = false; btn.textContent = 'Generate QR code';
    }
  });

  function pollQr(phoneNumber, box, attempts = 0) {
    if (attempts > 30) return;
    Api.get(`/api/pairing/qr/${phoneNumber}`)
      .then(({ qr }) => {
        if (qr) {
          box.innerHTML = `<img src="${qr}" width="220" height="220" alt="WhatsApp QR code" style="border-radius:12px;" />
            <p class="field-hint">Scan with WhatsApp: Linked Devices &gt; Link a Device</p>`;
        } else {
          setTimeout(() => pollQr(phoneNumber, box, attempts + 1), 2000);
        }
      })
      .catch(() => {});
  }

  function pollPairingStatus(phoneNumber, attempts = 0) {
    if (attempts > 40) return;
    Api.get(`/api/pairing/status/${phoneNumber}`)
      .then(({ status }) => {
        if (status === 'connected') {
          Toast.success('WhatsApp connected successfully.');
          loadAccount();
        } else if (status === 'banned' || status === 'disconnected') {
          setTimeout(() => pollPairingStatus(phoneNumber, attempts + 1), 3000);
        } else {
          setTimeout(() => pollPairingStatus(phoneNumber, attempts + 1), 3000);
        }
      })
      .catch(() => {});
  }

  document.getElementById('waDisconnectBtn').addEventListener('click', async () => {
    if (!confirm('Disconnect your WhatsApp number? You will need to pair again to reconnect.')) return;
    try {
      await Api.post('/api/pairing/disconnect', {});
      Toast.success('WhatsApp disconnected.');
      loadAccount();
    } catch (err) {
      Toast.error(err.message);
    }
  });

  /* ---------------- groups ---------------- */
  async function loadGroups() {
    try {
      const data = await Api.get('/api/groups');
      state.groups = data;
      renderGroups();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  document.querySelectorAll('[data-group-platform]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-group-platform]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.groupPlatform = btn.dataset.groupPlatform;
      renderGroups();
    });
  });

  function renderGroups() {
    const grid = document.getElementById('groupGrid');
    const empty = document.getElementById('groupEmpty');
    const list = state.groups[state.groupPlatform] || [];
    grid.innerHTML = '';
    empty.style.display = list.length ? 'none' : 'block';

    list.forEach((g) => {
      const card = document.createElement('div');
      card.className = 'card group-card';
      card.innerHTML = `
        <h4>${g.name || 'Unnamed group'}</h4>
        <span class="badge">${g.role}</span>
        <div class="meta">
          <span>${g.members !== undefined ? g.members + ' members' : ''}</span>
          <button class="btn btn-outline" style="padding:6px 10px; font-size:0.78rem;" data-copy="${g.groupId}">Copy ID</button>
        </div>`;
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-copy]')) return;
        openGroupModal(g);
      });
      card.querySelector('[data-copy]').addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(g.groupId);
        Toast.success('Group ID copied.');
      });
      grid.appendChild(card);
    });
  }

  let activeGroup = null;
  function openGroupModal(group) {
    activeGroup = group;
    document.getElementById('groupModalTitle').textContent = group.name || 'Group settings';
    const body = document.getElementById('groupModalBody');

    if (state.groupPlatform === 'whatsapp') {
      body.innerHTML = `
        <div class="toggle-row"><span>Anti-link</span>
          <label class="switch"><input type="checkbox" id="setAntiLink" ${group.settings?.antiLink?.enabled ? 'checked' : ''} /><span class="track"></span></label>
        </div>
        <div class="toggle-row"><span>Anti bad word</span>
          <label class="switch"><input type="checkbox" id="setAntiBadWord" ${group.settings?.antiBadWord ? 'checked' : ''} /><span class="track"></span></label>
        </div>
        <div class="toggle-row"><span>Auto react</span>
          <label class="switch"><input type="checkbox" id="setAutoReact" ${group.settings?.autoReact ? 'checked' : ''} /><span class="track"></span></label>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Welcome message</label>
          <textarea id="setWelcomeText" rows="2">${group.settings?.welcomeMessage?.text || ''}</textarea>
        </div>`;
    } else {
      body.innerHTML = `
        <div class="toggle-row"><span>Anti-link</span>
          <label class="switch"><input type="checkbox" id="setAntiLink" ${group.settings?.antiLink ? 'checked' : ''} /><span class="track"></span></label>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Welcome message</label>
          <textarea id="setWelcomeText" rows="2">${group.settings?.welcomeMessage?.text || ''}</textarea>
        </div>`;
    }
    document.getElementById('groupModal').style.display = 'flex';
  }

  document.getElementById('groupModalClose').addEventListener('click', () => {
    document.getElementById('groupModal').style.display = 'none';
  });

  document.getElementById('groupModalSave').addEventListener('click', async () => {
    if (!activeGroup) return;
    const platform = state.groupPlatform;
    const antiLinkChecked = document.getElementById('setAntiLink').checked;
    const welcomeText = document.getElementById('setWelcomeText').value;

    const body = platform === 'whatsapp'
      ? {
          antiLink: { enabled: antiLinkChecked, mode: activeGroup.settings?.antiLink?.mode || 'delete' },
          antiBadWord: document.getElementById('setAntiBadWord').checked,
          autoReact: document.getElementById('setAutoReact').checked,
          welcomeMessage: { enabled: Boolean(welcomeText), text: welcomeText },
        }
      : {
          antiLink: antiLinkChecked,
          welcomeMessage: { enabled: Boolean(welcomeText), text: welcomeText },
        };

    try {
      await Api.patch(`/api/groups/${platform}/${encodeURIComponent(activeGroup.groupId)}/settings`, body);
      Toast.success('Settings saved.');
      document.getElementById('groupModal').style.display = 'none';
      loadGroups();
    } catch (err) {
      Toast.error(err.message);
    }
  });

  /* ---------------- commands ---------------- */
  document.getElementById('runCommandBtn').addEventListener('click', async () => {
    const platform = document.getElementById('commandPlatform').value;
    const command = document.getElementById('commandInput').value.trim();
    const output = document.getElementById('commandOutput');
    if (!command) return Toast.error('Enter a command.');

    output.textContent = 'Sending...';
    try {
      const data = await Api.post(`/api/commands/${platform}`, { command });
      output.textContent = data.response;
    } catch (err) {
      output.textContent = err.message;
    }
  });

  /* ---------------- profile modal ---------------- */
  function openProfile() {
    document.getElementById('profileModal').style.display = 'flex';
    const linking = document.getElementById('linkingStatus');
    const a = state.account;
    linking.innerHTML = `
      WhatsApp: ${a.whatsapp ? `linked (+${a.whatsapp.phoneNumber})` : 'not linked - connect it from the WhatsApp tab'}<br/>
      Telegram: ${a.telegramLinked ? 'linked' : 'not linked - message the Telegram bot to link'}`;
  }
  document.getElementById('openProfileBtn').addEventListener('click', openProfile);
  document.getElementById('openProfileBtn2').addEventListener('click', openProfile);
  document.getElementById('profileModalClose').addEventListener('click', () => {
    document.getElementById('profileModal').style.display = 'none';
  });

  document.querySelectorAll('.profile-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.profile-view').forEach((v) => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`profile-${tab.dataset.profileTab}`).classList.add('active');
    });
  });

  document.getElementById('saveUsernameBtn').addEventListener('click', async () => {
    try {
      await Api.post('/api/account/change-username', { username: document.getElementById('profileUsername').value.trim() });
      Toast.success('Username updated. Please log in again.');
      setTimeout(() => { Api.clearSession(); window.location.href = 'login.html'; }, 1500);
    } catch (err) {
      Toast.error(err.message);
    }
  });

  document.getElementById('changePasswordBtn').addEventListener('click', async () => {
    try {
      await Api.post('/api/account/change-password', {
        currentPassword: document.getElementById('currentPasswordInput').value,
        newPassword: document.getElementById('newPasswordInput').value,
      });
      Toast.success('Password changed.');
      document.getElementById('currentPasswordInput').value = '';
      document.getElementById('newPasswordInput').value = '';
    } catch (err) {
      Toast.error(err.message);
    }
  });

  document.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.documentElement.setAttribute('data-theme', btn.dataset.theme);
      localStorage.setItem('adevos_theme', btn.dataset.theme);
      Toast.success(`Theme set to ${btn.dataset.theme}.`);
    });
  });

  document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
    if (!confirm('This permanently deletes your website login. Continue?')) return;
    try {
      await Api.del('/api/account');
      Toast.success('Account deleted.');
      Api.clearSession();
      setTimeout(() => (window.location.href = 'index.html'), 1000);
    } catch (err) {
      Toast.error(err.message);
    }
  });

  loadAccount();
})();
