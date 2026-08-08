/* ================= TASKHIVE CALENDAR MODULE ================= */
async function initCalendarPage(session, role) {
  const content = document.getElementById('thContent');
  let current = new Date();
  let events = [];
  let projects = [];

  content.innerHTML =
    '<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">' +
      '<h4 class="mb-0"><i class="fa-solid fa-calendar-days me-2"></i>Calendar</h4>' +
      '<div class="d-flex gap-2 align-items-center">' +
        '<button class="btn btn-th-outline btn-sm" id="prevMonth"><i class="fa-solid fa-chevron-left"></i></button>' +
        '<button class="btn btn-th-outline btn-sm" id="todayBtn">Today</button>' +
        '<button class="btn btn-th-outline btn-sm" id="nextMonth"><i class="fa-solid fa-chevron-right"></i></button>' +
        '<button class="btn btn-th-primary btn-sm" id="addEventBtn"><i class="fa-solid fa-plus me-1"></i>Add Event</button>' +
      '</div>' +
    '</div>' +
    '<div class="th-card mb-3"><div class="row g-2">' +
      '<div class="col-md-4"><select class="form-select" id="fType"><option value="">All Types</option><option>Meeting</option><option>Deadline</option><option>Reminder</option><option>Announcement</option><option>Personal Note</option></select></div>' +
      '<div class="col-md-4"><select class="form-select" id="fProject"><option value="">All Projects</option></select></div>' +
    '</div></div>' +
    '<div class="th-card">' +
      '<h6 id="monthLabel" class="mb-3"></h6>' +
      '<div class="th-calendar-grid" id="calGrid"></div>' +
      '<div class="th-cal-agenda" id="calAgenda"></div>' +
    '</div>';

  async function load() {
    const [evRes, prRes] = await Promise.all([Api.call('getCalendar'), Api.call('getProjects')]);
    if (evRes.success) events = evRes.data;
    if (prRes.success) {
      projects = prRes.data;
      document.getElementById('fProject').innerHTML = '<option value="">All Projects</option>' + projects.map(p => '<option value="' + p.ProjectID + '">' + thEscape(p.ProjectName) + '</option>').join('');
      const sel = document.getElementById('evProjectSel');
      if (sel) sel.innerHTML = '<option value="">None</option>' + projects.map(p => '<option value="' + p.ProjectID + '">' + thEscape(p.ProjectName) + '</option>').join('');
    }
    render();
  }

  function filteredEvents() {
    const t = document.getElementById('fType').value;
    const p = document.getElementById('fProject').value;
    return events.filter(function (e) {
      if (t && e.Type !== t) return false;
      if (p && e.ProjectID !== p) return false;
      return true;
    });
  }

  function render() {
    const y = current.getFullYear(), m = current.getMonth();
    document.getElementById('monthLabel').textContent = current.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const evs = filteredEvents();
    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let grid = dows.map(function (d) { return '<div class="dow">' + d + '</div>'; }).join('');

    const cells = [];
    for (let i = startDow - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, other: true, dateStr: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      cells.push({ day: d, other: false, dateStr: dateStr });
    }
    while (cells.length % 7 !== 0) cells.push({ day: cells.length, other: true, dateStr: null });

    grid += cells.map(function (c) {
      if (!c.dateStr) return '<div class="th-cal-day other-month"><span class="num">' + c.day + '</span></div>';
      const dayEvents = evs.filter(function (e) { return e.Date === c.dateStr; });
      const isToday = c.dateStr === todayStr;
      return '<div class="th-cal-day' + (isToday ? ' today' : '') + '" data-date="' + c.dateStr + '">' +
        '<span class="num">' + c.day + '</span>' +
        dayEvents.slice(0, 3).map(function (e) { return '<span class="th-cal-event-dot">' + thEscape(e.Title) + '</span>'; }).join('') +
        (dayEvents.length > 3 ? '<span class="th-cal-event-dot">+' + (dayEvents.length - 3) + ' more</span>' : '') +
        '</div>';
    }).join('');
    document.getElementById('calGrid').innerHTML = grid;
    document.querySelectorAll('.th-cal-day[data-date]').forEach(function (el) {
      el.addEventListener('click', function () { openDayModal(el.getAttribute('data-date')); });
    });

    // agenda (mobile fallback)
    const byDate = {};
    evs.forEach(function (e) { (byDate[e.Date] = byDate[e.Date] || []).push(e); });
    const sortedDates = Object.keys(byDate).sort();
    const agenda = document.getElementById('calAgenda');
    if (!sortedDates.length) {
      agenda.innerHTML = thEmptyHtml('fa-calendar-xmark', 'No events this month');
    } else {
      agenda.innerHTML = sortedDates.map(function (d) {
        return '<div class="agenda-day" data-date="' + d + '"><strong>' + thFmtDate(d) + '</strong>' +
          byDate[d].map(function (e) { return '<div style="font-size:.82rem; margin-top:.3rem;"><i class="fa-solid fa-circle-dot me-1" style="font-size:.5rem; color:var(--primary);"></i>' + thEscape(e.Title) + ' <span class="text-secondary-th">(' + e.Type + ')</span></div>'; }).join('') +
          '</div>';
      }).join('');
      agenda.querySelectorAll('.agenda-day').forEach(function (el) {
        el.addEventListener('click', function () { openDayModal(el.getAttribute('data-date')); });
      });
    }
  }

  document.getElementById('prevMonth').onclick = function () { current.setMonth(current.getMonth() - 1); render(); };
  document.getElementById('nextMonth').onclick = function () { current.setMonth(current.getMonth() + 1); render(); };
  document.getElementById('todayBtn').onclick = function () { current = new Date(); render(); };
  document.getElementById('fType').addEventListener('change', render);
  document.getElementById('fProject').addEventListener('change', render);

  /* -------- Day detail / add note modal -------- */
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal fade" id="dayModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">' +
    '<div class="modal-header"><h5 class="modal-title" id="dayModalTitle">Date</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>' +
    '<div class="modal-body">' +
      '<div id="dayEventsList" class="mb-3"></div>' +
      '<hr style="border-color:var(--border);">' +
      '<h6 class="mb-2">Add ' + (role === 'Admin' ? 'Event' : 'Personal Note') + '</h6>' +
      '<div class="mb-2"><label>Title *</label><input class="form-control" id="evTitle"></div>' +
      '<div class="mb-2"><label>Description</label><textarea class="form-control" id="evDesc" rows="2"></textarea></div>' +
      '<div class="row g-2 mb-2">' +
        '<div class="col-6"><label>Time</label><input type="time" class="form-control" id="evTime"></div>' +
        '<div class="col-6"><label>Type</label><select class="form-select" id="evType">' +
          (role === 'Admin' ? '<option>Meeting</option><option>Deadline</option><option>Reminder</option><option>Announcement</option>' : '<option selected>Personal Note</option>') +
        '</select></div>' +
      '</div>' +
      (role === 'Admin' ? '<div class="mb-2"><label>Related Project</label><select class="form-select" id="evProjectSel"><option value="">None</option></select></div>' : '') +
      '<div id="evError" class="text-danger" style="font-size:.85rem; display:none;"></div>' +
    '</div><div class="modal-footer"><button class="btn btn-th-outline" data-bs-dismiss="modal">Close</button><button class="btn btn-th-primary" id="evSaveBtn">Save</button></div>' +
    '</div></div></div>'
  );
  const dayModal = new bootstrap.Modal(document.getElementById('dayModal'));
  let activeDate = null;

  function openDayModal(dateStr) {
    activeDate = dateStr;
    document.getElementById('dayModalTitle').textContent = thFmtDate(dateStr);
    const dayEvs = events.filter(function (e) { return e.Date === dateStr; });
    const list = document.getElementById('dayEventsList');
    list.innerHTML = dayEvs.length ? dayEvs.map(function (e) {
      const canEdit = role === 'Admin' || (e.Type === 'Personal Note' && String(e.CreatedBy) === String(session.id));
      return '<div class="d-flex justify-content-between align-items-start mb-2" style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:.6rem .8rem;">' +
        '<div><div style="font-weight:600; font-size:.88rem;">' + thEscape(e.Title) + ' <span class="badge-status badge-in-progress" style="font-size:.65rem;">' + e.Type + '</span></div>' +
        '<div class="text-secondary-th" style="font-size:.78rem;">' + (e.Time || '') + ' ' + thEscape(e.Description || '') + '</div></div>' +
        (canEdit ? '<div><button class="btn btn-th-icon edit-ev" data-id="' + e.EventID + '"><i class="fa-solid fa-pen-to-square"></i></button>' +
          '<button class="btn btn-th-icon del-ev" data-id="' + e.EventID + '"><i class="fa-solid fa-trash"></i></button></div>' : '') +
        '</div>';
    }).join('') : '<p class="text-secondary-th" style="font-size:.85rem;">No events on this date yet.</p>';

    list.querySelectorAll('.del-ev').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Delete this event?')) return;
        const res = await Api.call('deleteCalendarEvent', { eventId: b.dataset.id, actorId: session.id, actorName: session.name, role: role });
        if (res.success) { thToast('Event deleted', 'success'); await load(); openDayModal(dateStr); } else thToast(res.message, 'error');
      });
    });
    list.querySelectorAll('.edit-ev').forEach(function (b) {
      b.addEventListener('click', function () {
        const e = events.find(function (x) { return x.EventID === b.dataset.id; });
        document.getElementById('evTitle').value = e.Title;
        document.getElementById('evDesc').value = e.Description;
        document.getElementById('evTime').value = e.Time;
        document.getElementById('evType').value = e.Type;
        document.getElementById('evSaveBtn').dataset.editId = e.EventID;
      });
    });

    document.getElementById('evTitle').value = '';
    document.getElementById('evDesc').value = '';
    document.getElementById('evTime').value = '';
    document.getElementById('evError').style.display = 'none';
    document.getElementById('evSaveBtn').removeAttribute('data-edit-id');
    dayModal.show();
  }

  document.getElementById('addEventBtn').onclick = function () {
    openDayModal(new Date().toISOString().slice(0, 10));
  };

  document.getElementById('evSaveBtn').onclick = async function () {
    const title = document.getElementById('evTitle').value.trim();
    const errBox = document.getElementById('evError');
    if (!title) { errBox.textContent = 'Title cannot be empty.'; errBox.style.display = 'block'; return; }
    const editId = this.dataset.editId;
    const payload = {
      title: title, description: document.getElementById('evDesc').value, time: document.getElementById('evTime').value,
      type: document.getElementById('evType').value, date: activeDate,
      projectId: document.getElementById('evProjectSel') ? document.getElementById('evProjectSel').value : '',
      actorId: session.id, actorName: session.name, role: role
    };
    const res = editId ? await Api.call('updateCalendarEvent', Object.assign({ eventId: editId }, payload))
                        : await Api.call('addCalendarEvent', payload);
    if (res.success) { thToast(res.message, 'success'); await load(); openDayModal(activeDate); }
    else { errBox.textContent = res.message; errBox.style.display = 'block'; }
  };

  load();
}
