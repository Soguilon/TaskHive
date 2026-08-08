/* ================= TASKHIVE DISCUSSIONS MODULE ================= */
async function initDiscussionsPage(session, role) {
  const content = document.getElementById('thContent');
  let projects = [];
  let activeProjectId = null;
  let messages = [];

  content.innerHTML =
    '<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">' +
      '<h4 class="mb-0"><i class="fa-solid fa-comments me-2"></i>Discussions</h4>' +
      '<select class="form-select" id="discProjectSel" style="max-width:280px;"></select>' +
    '</div>' +
    '<div class="th-card">' +
      '<div class="th-chat-window" id="chatWindow"></div>' +
      '<div class="d-flex gap-2 mt-2">' +
        '<input class="form-control" id="chatInput" placeholder="Type a message...">' +
        '<button class="btn btn-th-primary" id="sendBtn"><i class="fa-solid fa-paper-plane"></i></button>' +
      '</div>' +
    '</div>';

  async function loadProjects() {
    const res = await Api.call('getProjects');
    if (res.success) {
      projects = res.data;
      const sel = document.getElementById('discProjectSel');
      sel.innerHTML = projects.map(function (p) { return '<option value="' + p.ProjectID + '">' + thEscape(p.ProjectName) + '</option>'; }).join('');
      if (projects.length) { activeProjectId = projects[0].ProjectID; loadMessages(); }
      else document.getElementById('chatWindow').innerHTML = thEmptyHtml('fa-folder-open', 'No projects available yet');
    }
  }
  document.getElementById('discProjectSel').addEventListener('change', function () {
    activeProjectId = this.value; loadMessages();
  });

  async function loadMessages() {
    document.getElementById('chatWindow').innerHTML = thLoadingHtml('Loading discussion...');
    const res = await Api.call('getDiscussions', { projectId: activeProjectId });
    if (!res.success) { document.getElementById('chatWindow').innerHTML = thEmptyHtml('fa-triangle-exclamation', res.message); return; }
    messages = res.data.sort(function (a, b) { return new Date(a.DateTime) - new Date(b.DateTime); });
    renderMessages();
  }

  function renderMessages() {
    const win = document.getElementById('chatWindow');
    if (!messages.length) { win.innerHTML = thEmptyHtml('fa-comment-slash', 'No messages yet. Start the conversation!'); return; }
    win.innerHTML = messages.map(function (m) {
      const mine = String(m.SenderID) === String(session.id);
      const canModify = role === 'Admin' || mine;
      return '<div class="th-msg ' + (mine ? 'mine' : '') + (m.Pinned ? ' pinned' : '') + '" data-id="' + m.MessageID + '">' +
        '<div class="meta">' + (m.Pinned ? '<i class="fa-solid fa-thumbtack" style="color:var(--primary);"></i>' : '') +
        (m.Edited ? '<span>(edited)</span>' : '') + '<span>' + thFmtDateTime(m.DateTime) + '</span></div>' +
        '<div>' + thEscape(m.Message) + '</div>' +
        (canModify ? '<div class="mt-1 d-flex gap-2">' +
          (mine ? '<a href="#" class="edit-msg" data-id="' + m.MessageID + '" style="font-size:.72rem;">Edit</a>' : '') +
          '<a href="#" class="del-msg" data-id="' + m.MessageID + '" style="font-size:.72rem; color:var(--danger);">Delete</a>' +
          (role === 'Admin' ? '<a href="#" class="pin-msg" data-id="' + m.MessageID + '" data-pinned="' + m.Pinned + '" style="font-size:.72rem;">' + (m.Pinned ? 'Unpin' : 'Pin') + '</a>' : '') +
          '</div>' : '') +
        '</div>';
    }).join('');
    win.scrollTop = win.scrollHeight;

    win.querySelectorAll('.del-msg').forEach(function (a) {
      a.addEventListener('click', async function (e) {
        e.preventDefault();
        if (!confirm('Delete this message?')) return;
        const res = await Api.call('deleteDiscussionMessage', { messageId: a.dataset.id, senderId: session.id, role: role });
        if (res.success) loadMessages(); else thToast(res.message, 'error');
      });
    });
    win.querySelectorAll('.edit-msg').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const m = messages.find(function (x) { return x.MessageID === a.dataset.id; });
        const newText = prompt('Edit message:', m.Message);
        if (newText === null || !newText.trim()) return;
        Api.call('editDiscussionMessage', { messageId: m.MessageID, message: newText, senderId: session.id, role: role }).then(function (res) {
          if (res.success) loadMessages(); else thToast(res.message, 'error');
        });
      });
    });
    win.querySelectorAll('.pin-msg').forEach(function (a) {
      a.addEventListener('click', async function (e) {
        e.preventDefault();
        const pinned = a.dataset.pinned === 'true';
        const res = await Api.call('pinDiscussionMessage', { messageId: a.dataset.id, pinned: !pinned, role: role });
        if (res.success) loadMessages(); else thToast(res.message, 'error');
      });
    });
  }

  async function send() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !activeProjectId) return;
    input.value = '';
    const res = await Api.call('addDiscussionMessage', { projectId: activeProjectId, senderId: session.id, message: text, actorName: session.name });
    if (res.success) loadMessages(); else thToast(res.message, 'error');
  }
  document.getElementById('sendBtn').onclick = send;
  document.getElementById('chatInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

  loadProjects();
}
