/* ================= TASKHIVE APP SHELL ================= */

function thToast(message, type) {
  let wrap = document.querySelector('.toast-th');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-th';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast-item ' + (type || '');
  el.innerHTML = '<div>' + message + '</div>';
  wrap.appendChild(el);
  setTimeout(function () { el.remove(); }, 3500);
}

function thFmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function thFmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function thStatusBadgeClass(status) {
  const map = {
    'Not Started': 'badge-not-started', 'In Progress': 'badge-in-progress',
    'Submitted': 'badge-submitted', 'Approved': 'badge-approved', 'Needs Revision': 'badge-needs-revision'
  };
  return map[status] || 'badge-not-started';
}
function thPriorityBadgeClass(p) {
  const map = { High: 'badge-priority-high', Medium: 'badge-priority-medium', Low: 'badge-priority-low' };
  return map[p] || 'badge-priority-medium';
}
function thEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------------- Theme ---------------- */
const Theme = {
  apply: function (mode) {
    document.documentElement.setAttribute('data-theme', mode === 'light' ? 'light' : 'dark');
    localStorage.setItem('taskhive_theme', mode);
  },
  init: function () {
    const session = Auth.get();
    const stored = localStorage.getItem('taskhive_theme') || (session && session.theme) || 'dark';
    this.apply(stored);
  },
  toggle: async function () {
    const current = localStorage.getItem('taskhive_theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    this.apply(next);
    const session = Auth.get();
    if (session && session.role === 'Member') {
      await Api.call('updateMember', { memberId: session.id, ThemePreference: next });
    }
  }
};

/* ---------------- Sidebar shell builder ---------------- */
const NAV_ADMIN = [
  { href: 'dashboard.html', icon: 'fa-gauge-high', label: 'Dashboard' },
  { href: 'projects.html', icon: 'fa-folder', label: 'Projects' },
  { href: 'tasks.html', icon: 'fa-list-check', label: 'Task Review' },
  { href: 'members.html', icon: 'fa-users', label: 'Members' },
  { href: 'calendar.html', icon: 'fa-calendar-days', label: 'Calendar' },
  { href: 'meetings.html', icon: 'fa-calendar-check', label: 'Meetings' },
  { href: 'discussions.html', icon: 'fa-comments', label: 'Discussions' },
  { href: 'activity.html', icon: 'fa-clock-rotate-left', label: 'Activity Log' },
  { href: 'archive.html', icon: 'fa-box-archive', label: 'Archive' },
  { href: 'trash.html', icon: 'fa-trash', label: 'Trash' }
];
const NAV_MEMBER = [
  { href: 'dashboard.html', icon: 'fa-gauge-high', label: 'Dashboard' },
  { href: 'projects.html', icon: 'fa-folder', label: 'My Projects' },
  { href: 'tasks.html', icon: 'fa-list-check', label: 'My Tasks' },
  { href: 'calendar.html', icon: 'fa-calendar-days', label: 'Calendar' },
  { href: 'meetings.html', icon: 'fa-calendar-check', label: 'Meetings' },
  { href: 'discussions.html', icon: 'fa-comments', label: 'Discussions' },
  { href: 'notes.html', icon: 'fa-note-sticky', label: 'My Notes' }
];

function buildShell(activePage) {
  const session = Auth.requireAuth();
  if (!session) return null;
  const nav = session.role === 'Admin' ? NAV_ADMIN : NAV_MEMBER;

  const navHtml = nav.map(function (item) {
    const active = activePage === item.href ? ' active' : '';
    return '<a href="' + item.href + '" class="nav-link' + active + '"><i class="fa-solid ' + item.icon + '"></i><span>' + item.label + '</span></a>';
  }).join('');

  document.body.insertAdjacentHTML('afterbegin',
    '<div class="th-app">' +
    '<div class="th-sidebar-overlay" id="sidebarOverlay"></div>' +
    '<aside class="th-sidebar" id="sidebar">' +
    '  <div class="brand"><i class="fa-solid fa-hexagon-nodes"></i><span>TaskHive</span></div>' +
    '  <nav class="th-nav">' + navHtml + '</nav>' +
    '  <div class="th-sidebar-footer">' +
    '    <div class="d-flex align-items-center gap-2 mb-2">' +
    '      <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#121212;display:flex;align-items:center;justify-content:center;font-weight:700;">' + thEscape((session.name || '?').charAt(0).toUpperCase()) + '</div>' +
    '      <div><div style="font-weight:600;font-size:.9rem;">' + thEscape(session.name) + '</div><div class="text-secondary-th" style="font-size:.75rem;">' + thEscape(session.role) + '</div></div>' +
    '    </div>' +
    '    <button class="btn btn-th-outline w-100" id="logoutBtn"><i class="fa-solid fa-right-from-bracket me-2"></i>Logout</button>' +
    '  </div>' +
    '</aside>' +
    '<div class="th-main">' +
    '  <header class="th-topbar">' +
    '    <button class="th-hamburger" id="hamburgerBtn"><i class="fa-solid fa-bars"></i></button>' +
    '    <div class="th-search-box">' +
    '      <i class="fa-solid fa-magnifying-glass"></i>' +
    '      <input type="text" id="globalSearchInput" placeholder="Search projects, tasks, members...">' +
    '      <div class="th-search-results" id="globalSearchResults"></div>' +
    '    </div>' +
    '    <div class="th-topbar-actions">' +
    '      <button class="th-icon-btn" id="themeToggleBtn" title="Toggle theme"><i class="fa-solid fa-circle-half-stroke"></i></button>' +
    '      <button class="th-icon-btn" id="notifBtn" title="Notifications"><i class="fa-solid fa-bell"></i><span class="th-badge-dot" id="notifCount" style="display:none;">0</span></button>' +
    '    </div>' +
    '  </header>' +
    '  <div class="th-content" id="thContent"></div>' +
    '</div>' +
    '</div>' +
    '<div class="dropdown-menu" id="notifDropdown" style="position:absolute; display:none; width:340px; max-height:420px; overflow-y:auto; z-index:2000; background:var(--card); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow);"></div>'
  );

  document.getElementById('logoutBtn').onclick = function () { Auth.logout(); };
  document.getElementById('hamburgerBtn').onclick = function () {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
  };
  document.getElementById('sidebarOverlay').onclick = function () {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  };
  document.querySelectorAll('.th-nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('show');
    });
  });
  document.getElementById('themeToggleBtn').onclick = function () { Theme.toggle(); };

  initGlobalSearch_();
  initNotifications_(session);

  return session;
}

/* ---------------- Global Search ---------------- */
function initGlobalSearch_() {
  const input = document.getElementById('globalSearchInput');
  const results = document.getElementById('globalSearchResults');
  let debounce;
  input.addEventListener('input', function () {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (!q) { results.classList.remove('show'); results.innerHTML = ''; return; }
    debounce = setTimeout(async function () {
      const res = await Api.call('globalSearch', { query: q });
      if (!res.success) return;
      renderSearchResults_(res.data, results);
    }, 300);
  });
  document.addEventListener('click', function (e) {
    if (!results.contains(e.target) && e.target !== input) results.classList.remove('show');
  });
}
function renderSearchResults_(data, container) {
  const groups = [
    { key: 'projects', label: 'Projects', field: 'ProjectName' },
    { key: 'tasks', label: 'Tasks', field: 'TaskTitle' },
    { key: 'members', label: 'Members', field: 'FullName' },
    { key: 'meetings', label: 'Meetings', field: 'Title' },
    { key: 'events', label: 'Calendar Events', field: 'Title' },
    { key: 'notes', label: 'Notes', field: 'Title' },
    { key: 'discussions', label: 'Discussion Messages', field: 'Message' }
  ];
  let html = '';
  let any = false;
  groups.forEach(function (g) {
    const items = data[g.key] || [];
    if (!items.length) return;
    any = true;
    html += '<div class="result-group">' + g.label + '</div>';
    items.slice(0, 5).forEach(function (item) {
      html += '<div class="result-item">' + thEscape(item[g.field] || '(untitled)') + '</div>';
    });
  });
  if (!any) html = '<div class="result-item text-secondary-th">No results found</div>';
  container.innerHTML = html;
  container.classList.add('show');
}

/* ---------------- Notifications ---------------- */
async function initNotifications_(session) {
  const btn = document.getElementById('notifBtn');
  const dropdown = document.getElementById('notifDropdown');
  const countEl = document.getElementById('notifCount');

  async function refresh() {
    const res = await Api.call('getNotifications', { userId: session.id });
    if (!res.success) return;
    const unread = res.data.filter(function (n) { return !n.IsRead; }).length;
    if (unread > 0) { countEl.style.display = 'flex'; countEl.textContent = unread > 9 ? '9+' : unread; }
    else { countEl.style.display = 'none'; }
    return res.data;
  }
  refresh();

  btn.addEventListener('click', async function (e) {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'block';
    if (isOpen) { dropdown.style.display = 'none'; return; }
    const rect = btn.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    dropdown.style.left = 'auto';
    const notifs = await refresh();
    if (!notifs || !notifs.length) {
      dropdown.innerHTML = '<div class="th-empty"><i class="fa-solid fa-bell-slash"></i>No notifications yet</div>';
    } else {
      dropdown.innerHTML = '<div class="d-flex justify-content-between align-items-center p-2 border-bottom" style="border-color:var(--border) !important;">' +
        '<strong style="font-size:.85rem;">Notifications</strong>' +
        '<button class="btn btn-sm btn-th-outline" id="markAllReadBtn" style="font-size:.72rem; padding:.2rem .6rem;">Mark all read</button></div>' +
        notifs.map(function (n) {
          return '<div class="p-2 border-bottom" data-id="' + n.NotificationID + '" style="border-color:var(--border) !important; cursor:pointer; ' + (n.IsRead ? 'opacity:.55;' : '') + '">' +
            '<div style="font-weight:600; font-size:.82rem;">' + thEscape(n.Title) + '</div>' +
            '<div class="text-secondary-th" style="font-size:.78rem;">' + thEscape(n.Message) + '</div>' +
            '<div class="text-secondary-th" style="font-size:.68rem; margin-top:2px;">' + thFmtDateTime(n.DateTime) + '</div></div>';
        }).join('');
      dropdown.style.display = 'block';
      document.getElementById('markAllReadBtn').onclick = async function () {
        await Api.call('markAllNotificationsRead', { userId: session.id });
        refresh();
        dropdown.style.display = 'none';
      };
      dropdown.querySelectorAll('[data-id]').forEach(function (row) {
        row.addEventListener('click', async function () {
          await Api.call('markNotificationRead', { notificationId: row.getAttribute('data-id') });
          refresh();
        });
      });
    }
    dropdown.style.display = 'block';
  });
  document.addEventListener('click', function () { dropdown.style.display = 'none'; });
}

/* ---------------- Generic loading/empty state helpers ---------------- */
function thLoadingHtml(msg) {
  return '<div class="th-loading"><div class="spinner-th"></div><span>' + (msg || 'Loading from TaskHive data services...') + '</span></div>';
}
function thEmptyHtml(icon, msg) {
  return '<div class="th-empty"><i class="fa-solid ' + icon + '"></i>' + msg + '</div>';
}
