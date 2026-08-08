/**
 * TASKHIVE — Google Apps Script Backend
 * ---------------------------------------------------------
 * Deployment:
 * 1. Create a Google Sheet. Copy its ID into SPREADSHEET_ID below.
 * 2. Paste this whole file into Extensions > Apps Script as Code.gs.
 * 3. Run setupSheets() once from the Apps Script editor (select it in the
 *    dropdown, click Run). This creates all sheets + headers + the admin row.
 * 4. Deploy > New deployment > Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the deployment URL into assets/js/api.js (API_URL).
 */

const SPREADSHEET_ID = '1EAyweene2I0WVvd9yGvbGdf3huPTNodZWuOk3z87O4Y';

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ---------------------------------------------------------------
// SHEET SCHEMAS
// ---------------------------------------------------------------
const SCHEMAS = {
  Admin: ['AdminID', 'Username', 'Password'],
  Members: ['MemberID', 'FullName', 'Role', 'Course', 'Email', 'Status', 'ThemePreference', 'DateCreated'],
  Projects: ['ProjectID', 'ProjectName', 'Description', 'Category', 'Priority', 'Deadline', 'Status', 'Progress', 'CreatedBy', 'CreatedDate'],
  Tasks: ['TaskID', 'ProjectID', 'AssignedMemberID', 'TaskTitle', 'Description', 'Priority', 'Deadline', 'Status', 'Checked', 'Remarks', 'CreatedDate', 'SubmissionDate', 'ApprovalDate', 'RevisionCount', 'LastUpdated'],
  Calendar: ['EventID', 'Date', 'Time', 'Title', 'Description', 'Type', 'ProjectID', 'CreatedBy', 'DateCreated', 'LastUpdated'],
  Notes: ['NoteID', 'MemberID', 'ProjectID', 'Title', 'Content', 'DateCreated', 'LastUpdated'],
  Discussions: ['MessageID', 'ProjectID', 'SenderID', 'Message', 'DateTime', 'Edited', 'Pinned'],
  Meetings: ['MeetingID', 'ProjectID', 'Title', 'Description', 'Date', 'Time', 'Location', 'MeetingLink', 'CreatedBy', 'Status'],
  ActivityLogs: ['LogID', 'UserID', 'UserName', 'Action', 'ProjectID', 'TaskID', 'DateTime'],
  Archive: ['ProjectID', 'ProjectName', 'Description', 'Category', 'Priority', 'Deadline', 'Status', 'Progress', 'CreatedBy', 'CreatedDate', 'ArchivedDate'],
  Trash: ['ProjectID', 'ProjectName', 'Description', 'Category', 'Priority', 'Deadline', 'Status', 'Progress', 'CreatedBy', 'CreatedDate', 'DeletedDate'],
  Notifications: ['NotificationID', 'UserID', 'Title', 'Message', 'Type', 'RelatedID', 'IsRead', 'DateTime']
};

function setupSheets() {
  const ss = ss_();
  Object.keys(SCHEMAS).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.clear();
    sheet.appendRow(SCHEMAS[name]);
    sheet.setFrozenRows(1);
  });
  // seed initial admin
  const adminSheet = ss.getSheetByName('Admin');
  adminSheet.appendRow([Utilities.getUuid(), 'Sugoi', '54601']);

  // remove default "Sheet1" if present
  const def = ss.getSheetByName('Sheet1');
  if (def) ss.deleteSheet(def);
}

// ---------------------------------------------------------------
// SHEET HELPERS (generic CRUD over rows-as-objects)
// ---------------------------------------------------------------
function getSheet_(name) {
  const sheet = ss_().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function readAll_(name) {
  const sheet = getSheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 1) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    const obj = {};
    headers.forEach(function (h, idx) { obj[h] = row[idx]; });
    obj.__row = i + 1; // 1-indexed sheet row, for internal use only
    rows.push(obj);
  }
  return rows;
}

function findRowIndexById_(name, idField, id) {
  const sheet = getSheet_(name);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idField);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) return i + 1;
  }
  return -1;
}

function appendRecord_(name, record) {
  const sheet = getSheet_(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(function (h) { return record.hasOwnProperty(h) ? record[h] : ''; });
  sheet.appendRow(row);
  return record;
}

function updateRecord_(name, idField, id, patch) {
  const sheet = getSheet_(name);
  const rowIdx = findRowIndexById_(name, idField, id);
  if (rowIdx === -1) throw new Error(name + ' record not found: ' + id);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const currentRow = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function (h, idx) { obj[h] = currentRow[idx]; });
  Object.keys(patch).forEach(function (k) { obj[k] = patch[k]; });
  const newRow = headers.map(function (h) { return obj[h]; });
  sheet.getRange(rowIdx, 1, 1, headers.length).setValues([newRow]);
  return obj;
}

function deleteRow_(name, idField, id) {
  const sheet = getSheet_(name);
  const rowIdx = findRowIndexById_(name, idField, id);
  if (rowIdx === -1) return false;
  sheet.deleteRow(rowIdx);
  return true;
}

function newId_(prefix) {
  return prefix + '_' + Utilities.getUuid().split('-')[0] + Date.now().toString(36);
}

function nowIso_() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------
// ACTIVITY LOG + NOTIFICATIONS
// ---------------------------------------------------------------
function logActivity_(userId, userName, action, projectId, taskId) {
  appendRecord_('ActivityLogs', {
    LogID: newId_('LOG'),
    UserID: userId || '',
    UserName: userName || '',
    Action: action,
    ProjectID: projectId || '',
    TaskID: taskId || '',
    DateTime: nowIso_()
  });
}

function notify_(userId, title, message, type, relatedId) {
  appendRecord_('Notifications', {
    NotificationID: newId_('NOTIF'),
    UserID: userId,
    Title: title,
    Message: message,
    Type: type,
    RelatedID: relatedId || '',
    IsRead: false,
    DateTime: nowIso_()
  });
}

// ---------------------------------------------------------------
// RESPONSE HELPERS
// ---------------------------------------------------------------
function ok_(data, message) {
  return { success: true, message: message || 'OK', data: data === undefined ? {} : data };
}
function fail_(message) {
  return { success: false, message: message || 'Error' };
}

// ---------------------------------------------------------------
// ENTRY POINTS
// ---------------------------------------------------------------
function doGet(e) {
  return handle_(e);
}
function doPost(e) {
  return handle_(e);
}

function handle_(e) {
  let params;
  try {
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter;
    }
  } catch (err) {
    return respond_(fail_('Invalid request payload'));
  }

  const action = params.action;
  let result;
  try {
    result = route_(action, params);
  } catch (err) {
    result = fail_(err.message || 'Server error');
  }
  return respond_(result);
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function route_(action, p) {
  switch (action) {
    // AUTH
    case 'loginAdmin': return loginAdmin(p.username, p.password);
    case 'loginMember': return loginMember(p.fullName);

    // MEMBERS
    case 'getMembers': return ok_(readAll_('Members'));
    case 'addMember': return addMember(p);
    case 'updateMember': return updateMember(p);
    case 'deleteMember': return deleteMember(p);

    // PROJECTS
    case 'getProjects': return ok_(readAll_('Projects'));
    case 'addProject': return addProject(p);
    case 'updateProject': return updateProject(p);
    case 'archiveProject': return archiveProject(p);
    case 'restoreProjectFromArchive': return restoreProjectFromArchive(p);
    case 'deleteProject': return deleteProject(p);
    case 'restoreProjectFromTrash': return restoreProjectFromTrash(p);
    case 'permanentlyDeleteProject': return permanentlyDeleteProject(p);
    case 'getArchive': return ok_(readAll_('Archive'));
    case 'getTrash': return ok_(readAll_('Trash'));

    // TASKS
    case 'getTasks': return ok_(readAll_('Tasks'));
    case 'addTask': return addTask(p);
    case 'updateTask': return updateTask(p);
    case 'submitTask': return submitTask(p);
    case 'approveTask': return approveTask(p);
    case 'requestRevision': return requestRevision(p);
    case 'deleteTask': return deleteTaskFn(p);

    // NOTES
    case 'getNotes': return ok_(readAll_('Notes').filter(function (n) { return String(n.MemberID) === String(p.memberId); }));
    case 'addNote': return addNote(p);
    case 'updateNote': return updateNote(p);
    case 'deleteNote': return deleteNote(p);

    // DISCUSSIONS
    case 'getDiscussions': return ok_(readAll_('Discussions').filter(function (m) { return String(m.ProjectID) === String(p.projectId); }));
    case 'addDiscussionMessage': return addDiscussionMessage(p);
    case 'editDiscussionMessage': return editDiscussionMessage(p);
    case 'deleteDiscussionMessage': return deleteDiscussionMessage(p);
    case 'pinDiscussionMessage': return pinDiscussionMessage(p);

    // CALENDAR
    case 'getCalendar': return ok_(readAll_('Calendar'));
    case 'addCalendarEvent': return addCalendarEvent(p);
    case 'updateCalendarEvent': return updateCalendarEvent(p);
    case 'deleteCalendarEvent': return deleteCalendarEvent(p);

    // MEETINGS
    case 'getMeetings': return ok_(readAll_('Meetings'));
    case 'addMeeting': return addMeeting(p);
    case 'updateMeeting': return updateMeeting(p);
    case 'deleteMeeting': return deleteMeeting(p);

    // ACTIVITY / NOTIFICATIONS
    case 'getActivityLogs': return ok_(readAll_('ActivityLogs').sort(function (a, b) { return new Date(b.DateTime) - new Date(a.DateTime); }));
    case 'getNotifications': return ok_(readAll_('Notifications').filter(function (n) { return String(n.UserID) === String(p.userId); }).sort(function (a, b) { return new Date(b.DateTime) - new Date(a.DateTime); }));
    case 'markNotificationRead': return markNotificationRead(p);
    case 'markAllNotificationsRead': return markAllNotificationsRead(p);

    // SEARCH
    case 'globalSearch': return globalSearch(p.query);

    default: return fail_('Unknown action: ' + action);
  }
}

// ---------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------
function loginAdmin(username, password) {
  const admins = readAll_('Admin');
  const match = admins.find(function (a) { return a.Username === username && String(a.Password) === String(password); });
  if (!match) return fail_('Invalid administrator credentials');
  logActivity_(match.AdminID, match.Username, 'Login (Admin)', '', '');
  return ok_({ id: match.AdminID, name: match.Username, role: 'Admin' }, 'Login successful');
}

function loginMember(fullName) {
  const members = readAll_('Members');
  const match = members.find(function (m) { return m.FullName.toLowerCase() === String(fullName).toLowerCase(); });
  if (!match) return fail_('Member not found. Check your name or ask the admin to add you.');
  if (match.Status !== 'Active') return fail_('This account is inactive. Contact the administrator.');
  logActivity_(match.MemberID, match.FullName, 'Login (Member)', '', '');
  return ok_({
    id: match.MemberID, name: match.FullName, role: 'Member',
    course: match.Course, theme: match.ThemePreference || 'dark'
  }, 'Login successful');
}

// ---------------------------------------------------------------
// MEMBERS
// ---------------------------------------------------------------
function addMember(p) {
  if (!p.fullName) return fail_('Full name is required');
  const record = {
    MemberID: newId_('MEM'),
    FullName: p.fullName,
    Role: p.role || 'Member',
    Course: p.course || '',
    Email: p.email || '',
    Status: 'Active',
    ThemePreference: 'dark',
    DateCreated: nowIso_()
  };
  appendRecord_('Members', record);
  logActivity_(p.actorId, p.actorName, 'Member added: ' + p.fullName, '', '');
  return ok_(record, 'Member added');
}

function updateMember(p) {
  const patch = {};
  ['FullName', 'Role', 'Course', 'Email', 'Status', 'ThemePreference'].forEach(function (f) {
    if (p[f] !== undefined) patch[f] = p[f];
  });
  const updated = updateRecord_('Members', 'MemberID', p.memberId, patch);
  logActivity_(p.actorId, p.actorName, 'Member updated: ' + updated.FullName, '', '');
  return ok_(updated, 'Member updated');
}

function deleteMember(p) {
  deleteRow_('Members', 'MemberID', p.memberId);
  logActivity_(p.actorId, p.actorName, 'Member deleted', '', '');
  return ok_({}, 'Member deleted');
}

// ---------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------
function addProject(p) {
  if (!p.projectName) return fail_('Project name is required');
  const record = {
    ProjectID: newId_('PRJ'),
    ProjectName: p.projectName,
    Description: p.description || '',
    Category: p.category || '',
    Priority: p.priority || 'Medium',
    Deadline: p.deadline || '',
    Status: p.status || 'Planning',
    Progress: 0,
    CreatedBy: p.actorName || '',
    CreatedDate: nowIso_()
  };
  appendRecord_('Projects', record);
  logActivity_(p.actorId, p.actorName, 'Project created: ' + record.ProjectName, record.ProjectID, '');
  return ok_(record, 'Project created');
}

function updateProject(p) {
  const patch = {};
  ['ProjectName', 'Description', 'Category', 'Priority', 'Deadline', 'Status'].forEach(function (f) {
    if (p[f] !== undefined) patch[f] = p[f];
  });
  const updated = updateRecord_('Projects', 'ProjectID', p.projectId, patch);
  logActivity_(p.actorId, p.actorName, 'Project edited: ' + updated.ProjectName, p.projectId, '');
  return ok_(updated, 'Project updated');
}

function archiveProject(p) {
  const rowIdx = findRowIndexById_('Projects', 'ProjectID', p.projectId);
  if (rowIdx === -1) return fail_('Project not found');
  const sheet = getSheet_('Projects');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  obj.Status = 'Archived';
  obj.ArchivedDate = nowIso_();
  appendRecord_('Archive', obj);
  sheet.deleteRow(rowIdx);
  logActivity_(p.actorId, p.actorName, 'Project archived: ' + obj.ProjectName, obj.ProjectID, '');
  notifyProjectMembers_(obj.ProjectID, 'Project archived', 'Project "' + obj.ProjectName + '" was archived.', 'project');
  return ok_(obj, 'Project archived');
}

function restoreProjectFromArchive(p) {
  const rowIdx = findRowIndexById_('Archive', 'ProjectID', p.projectId);
  if (rowIdx === -1) return fail_('Archived project not found');
  const sheet = getSheet_('Archive');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  const restored = {
    ProjectID: obj.ProjectID, ProjectName: obj.ProjectName, Description: obj.Description,
    Category: obj.Category, Priority: obj.Priority, Deadline: obj.Deadline,
    Status: 'Active', Progress: obj.Progress, CreatedBy: obj.CreatedBy, CreatedDate: obj.CreatedDate
  };
  appendRecord_('Projects', restored);
  sheet.deleteRow(rowIdx);
  logActivity_(p.actorId, p.actorName, 'Project restored: ' + obj.ProjectName, obj.ProjectID, '');
  notifyProjectMembers_(obj.ProjectID, 'Project restored', 'Project "' + obj.ProjectName + '" is active again.', 'project');
  return ok_(restored, 'Project restored');
}

function deleteProject(p) {
  const rowIdx = findRowIndexById_('Projects', 'ProjectID', p.projectId);
  if (rowIdx === -1) return fail_('Project not found');
  const sheet = getSheet_('Projects');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  obj.DeletedDate = nowIso_();
  appendRecord_('Trash', obj);
  sheet.deleteRow(rowIdx);
  logActivity_(p.actorId, p.actorName, 'Project deleted: ' + obj.ProjectName, obj.ProjectID, '');
  return ok_(obj, 'Project moved to trash');
}

function restoreProjectFromTrash(p) {
  const rowIdx = findRowIndexById_('Trash', 'ProjectID', p.projectId);
  if (rowIdx === -1) return fail_('Trashed project not found');
  const sheet = getSheet_('Trash');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  const restored = {
    ProjectID: obj.ProjectID, ProjectName: obj.ProjectName, Description: obj.Description,
    Category: obj.Category, Priority: obj.Priority, Deadline: obj.Deadline,
    Status: obj.Status || 'Planning', Progress: obj.Progress, CreatedBy: obj.CreatedBy, CreatedDate: obj.CreatedDate
  };
  appendRecord_('Projects', restored);
  sheet.deleteRow(rowIdx);
  logActivity_(p.actorId, p.actorName, 'Project restored from trash: ' + obj.ProjectName, obj.ProjectID, '');
  return ok_(restored, 'Project restored');
}

function permanentlyDeleteProject(p) {
  deleteRow_('Trash', 'ProjectID', p.projectId);
  logActivity_(p.actorId, p.actorName, 'Project permanently deleted', p.projectId, '');
  return ok_({}, 'Project permanently deleted');
}

function notifyProjectMembers_(projectId, title, message, type) {
  const tasks = readAll_('Tasks').filter(function (t) { return String(t.ProjectID) === String(projectId); });
  const memberIds = Array.from(new Set(tasks.map(function (t) { return t.AssignedMemberID; }).filter(Boolean)));
  memberIds.forEach(function (mid) { notify_(mid, title, message, type, projectId); });
}

// ---------------------------------------------------------------
// TASKS + PROGRESS
// ---------------------------------------------------------------
function recalcProjectProgress_(projectId) {
  const tasks = readAll_('Tasks').filter(function (t) { return String(t.ProjectID) === String(projectId); });
  if (tasks.length === 0) {
    updateRecord_('Projects', 'ProjectID', projectId, { Progress: 0 });
    return 0;
  }
  const approved = tasks.filter(function (t) { return t.Status === 'Approved'; }).length;
  const progress = Math.round((approved / tasks.length) * 100);
  try { updateRecord_('Projects', 'ProjectID', projectId, { Progress: progress }); } catch (e) { /* project may be archived */ }
  return progress;
}

function addTask(p) {
  if (!p.taskTitle) return fail_('Task title is required');
  const record = {
    TaskID: newId_('TSK'),
    ProjectID: p.projectId,
    AssignedMemberID: p.assignedMemberId || '',
    TaskTitle: p.taskTitle,
    Description: p.description || '',
    Priority: p.priority || 'Medium',
    Deadline: p.deadline || '',
    Status: 'Not Started',
    Checked: false,
    Remarks: '',
    CreatedDate: nowIso_(),
    SubmissionDate: '',
    ApprovalDate: '',
    RevisionCount: 0,
    LastUpdated: nowIso_()
  };
  appendRecord_('Tasks', record);
  logActivity_(p.actorId, p.actorName, 'Task created: ' + record.TaskTitle, record.ProjectID, record.TaskID);
  if (record.AssignedMemberID) {
    notify_(record.AssignedMemberID, 'New task assigned', 'You were assigned "' + record.TaskTitle + '"', 'task', record.TaskID);
  }
  recalcProjectProgress_(record.ProjectID);
  return ok_(record, 'Task created');
}

function updateTask(p) {
  const patch = {};
  ['TaskTitle', 'Description', 'Priority', 'Deadline', 'AssignedMemberID', 'Status'].forEach(function (f) {
    if (p[f] !== undefined) patch[f] = p[f];
  });
  patch.LastUpdated = nowIso_();
  const updated = updateRecord_('Tasks', 'TaskID', p.taskId, patch);
  logActivity_(p.actorId, p.actorName, 'Task edited: ' + updated.TaskTitle, updated.ProjectID, updated.TaskID);
  recalcProjectProgress_(updated.ProjectID);
  return ok_(updated, 'Task updated');
}

function deleteTaskFn(p) {
  const existing = readAll_('Tasks').find(function (t) { return String(t.TaskID) === String(p.taskId); });
  deleteRow_('Tasks', 'TaskID', p.taskId);
  logActivity_(p.actorId, p.actorName, 'Task deleted', p.projectId, p.taskId);
  if (existing) recalcProjectProgress_(existing.ProjectID);
  return ok_({}, 'Task deleted');
}

// Member checks the box -> submit for review
function submitTask(p) {
  const rowIdx = findRowIndexById_('Tasks', 'TaskID', p.taskId);
  if (rowIdx === -1) return fail_('Task not found');
  const existing = readAll_('Tasks').find(function (t) { return String(t.TaskID) === String(p.taskId); });
  if (String(existing.AssignedMemberID) !== String(p.memberId)) {
    return fail_('You can only submit your own tasks');
  }
  const patch = {
    Checked: true,
    Status: 'Submitted',
    SubmissionDate: nowIso_(),
    LastUpdated: nowIso_()
  };
  const updated = updateRecord_('Tasks', 'TaskID', p.taskId, patch);
  logActivity_(p.memberId, p.actorName, 'Task submitted: ' + updated.TaskTitle, updated.ProjectID, updated.TaskID);
  notifyAdmins_('Task submitted', '"' + updated.TaskTitle + '" was submitted by ' + p.actorName + ' for review.', 'task', updated.TaskID);
  return ok_(updated, 'Task submitted for review');
}

function notifyAdmins_(title, message, type, relatedId) {
  const admins = readAll_('Admin');
  admins.forEach(function (a) { notify_(a.AdminID, title, message, type, relatedId); });
}

function approveTask(p) {
  const patch = {
    Status: 'Approved',
    Checked: true,
    ApprovalDate: nowIso_(),
    LastUpdated: nowIso_(),
    Remarks: p.remarks || ''
  };
  const updated = updateRecord_('Tasks', 'TaskID', p.taskId, patch);
  logActivity_(p.actorId, p.actorName, 'Task approved: ' + updated.TaskTitle, updated.ProjectID, updated.TaskID);
  if (updated.AssignedMemberID) {
    notify_(updated.AssignedMemberID, 'Task approved', 'Your task "' + updated.TaskTitle + '" has been approved.', 'task', updated.TaskID);
  }
  recalcProjectProgress_(updated.ProjectID);
  return ok_(updated, 'Task approved');
}

function requestRevision(p) {
  if (!p.remarks || !String(p.remarks).trim()) return fail_('A remark is required to request revision');
  const existing = readAll_('Tasks').find(function (t) { return String(t.TaskID) === String(p.taskId); });
  const patch = {
    Status: 'Needs Revision',
    Checked: false,
    Remarks: p.remarks,
    RevisionCount: (Number(existing.RevisionCount) || 0) + 1,
    LastUpdated: nowIso_()
  };
  const updated = updateRecord_('Tasks', 'TaskID', p.taskId, patch);
  logActivity_(p.actorId, p.actorName, 'Task returned for revision: ' + updated.TaskTitle, updated.ProjectID, updated.TaskID);
  if (updated.AssignedMemberID) {
    notify_(updated.AssignedMemberID, 'Task needs revision', 'Your task "' + updated.TaskTitle + '" needs revision: ' + p.remarks, 'task', updated.TaskID);
  }
  recalcProjectProgress_(updated.ProjectID);
  return ok_(updated, 'Revision requested');
}

// ---------------------------------------------------------------
// NOTES
// ---------------------------------------------------------------
function addNote(p) {
  if (!p.title) return fail_('Note title is required');
  const record = {
    NoteID: newId_('NOTE'),
    MemberID: p.memberId,
    ProjectID: p.projectId || '',
    Title: p.title,
    Content: p.content || '',
    DateCreated: nowIso_(),
    LastUpdated: nowIso_()
  };
  appendRecord_('Notes', record);
  logActivity_(p.memberId, p.actorName, 'Note created: ' + record.Title, record.ProjectID, '');
  return ok_(record, 'Note created');
}

function updateNote(p) {
  const existing = readAll_('Notes').find(function (n) { return String(n.NoteID) === String(p.noteId); });
  if (!existing) return fail_('Note not found');
  if (String(existing.MemberID) !== String(p.memberId)) return fail_('You cannot edit another member\'s note');
  const patch = { LastUpdated: nowIso_() };
  if (p.title !== undefined) patch.Title = p.title;
  if (p.content !== undefined) patch.Content = p.content;
  const updated = updateRecord_('Notes', 'NoteID', p.noteId, patch);
  return ok_(updated, 'Note updated');
}

function deleteNote(p) {
  const existing = readAll_('Notes').find(function (n) { return String(n.NoteID) === String(p.noteId); });
  if (!existing) return fail_('Note not found');
  if (String(existing.MemberID) !== String(p.memberId)) return fail_('You cannot delete another member\'s note');
  deleteRow_('Notes', 'NoteID', p.noteId);
  return ok_({}, 'Note deleted');
}

// ---------------------------------------------------------------
// DISCUSSIONS
// ---------------------------------------------------------------
function addDiscussionMessage(p) {
  if (!p.message || !String(p.message).trim()) return fail_('Message cannot be empty');
  const record = {
    MessageID: newId_('MSG'),
    ProjectID: p.projectId,
    SenderID: p.senderId,
    Message: p.message,
    DateTime: nowIso_(),
    Edited: false,
    Pinned: false
  };
  appendRecord_('Discussions', record);
  logActivity_(p.senderId, p.actorName, 'Discussion message sent', p.projectId, '');
  return ok_(record, 'Message sent');
}

function editDiscussionMessage(p) {
  const existing = readAll_('Discussions').find(function (m) { return String(m.MessageID) === String(p.messageId); });
  if (!existing) return fail_('Message not found');
  if (p.role !== 'Admin' && String(existing.SenderID) !== String(p.senderId)) return fail_('You can only edit your own messages');
  const updated = updateRecord_('Discussions', 'MessageID', p.messageId, { Message: p.message, Edited: true });
  return ok_(updated, 'Message updated');
}

function deleteDiscussionMessage(p) {
  const existing = readAll_('Discussions').find(function (m) { return String(m.MessageID) === String(p.messageId); });
  if (!existing) return fail_('Message not found');
  if (p.role !== 'Admin' && String(existing.SenderID) !== String(p.senderId)) return fail_('You can only delete your own messages');
  deleteRow_('Discussions', 'MessageID', p.messageId);
  return ok_({}, 'Message deleted');
}

function pinDiscussionMessage(p) {
  if (p.role !== 'Admin') return fail_('Only admin can pin messages');
  const updated = updateRecord_('Discussions', 'MessageID', p.messageId, { Pinned: p.pinned });
  return ok_(updated, updated.Pinned ? 'Message pinned' : 'Message unpinned');
}

// ---------------------------------------------------------------
// CALENDAR
// ---------------------------------------------------------------
function addCalendarEvent(p) {
  if (!p.title || !p.date) return fail_('Title and date are required');
  if (p.type !== 'Personal Note' && p.role !== 'Admin') {
    return fail_('Only admin can create project events, meetings, deadlines, or announcements');
  }
  const record = {
    EventID: newId_('EVT'),
    Date: p.date,
    Time: p.time || '',
    Title: p.title,
    Description: p.description || '',
    Type: p.type || 'Personal Note',
    ProjectID: p.projectId || '',
    CreatedBy: p.actorId || '',
    DateCreated: nowIso_(),
    LastUpdated: nowIso_()
  };
  appendRecord_('Calendar', record);
  logActivity_(p.actorId, p.actorName, 'Calendar event created: ' + record.Title, record.ProjectID, '');
  return ok_(record, 'Event created');
}

function updateCalendarEvent(p) {
  const existing = readAll_('Calendar').find(function (ev) { return String(ev.EventID) === String(p.eventId); });
  if (!existing) return fail_('Event not found');
  if (p.role !== 'Admin' && (existing.Type !== 'Personal Note' || String(existing.CreatedBy) !== String(p.actorId))) {
    return fail_('You cannot modify this event');
  }
  const patch = { LastUpdated: nowIso_() };
  ['Title', 'Description', 'Date', 'Time', 'Type'].forEach(function (f) { if (p[f] !== undefined) patch[f] = p[f]; });
  const updated = updateRecord_('Calendar', 'EventID', p.eventId, patch);
  logActivity_(p.actorId, p.actorName, 'Calendar event edited: ' + updated.Title, updated.ProjectID, '');
  return ok_(updated, 'Event updated');
}

function deleteCalendarEvent(p) {
  const existing = readAll_('Calendar').find(function (ev) { return String(ev.EventID) === String(p.eventId); });
  if (!existing) return fail_('Event not found');
  if (p.role !== 'Admin' && (existing.Type !== 'Personal Note' || String(existing.CreatedBy) !== String(p.actorId))) {
    return fail_('You cannot delete this event');
  }
  deleteRow_('Calendar', 'EventID', p.eventId);
  logActivity_(p.actorId, p.actorName, 'Calendar event deleted: ' + existing.Title, existing.ProjectID, '');
  return ok_({}, 'Event deleted');
}

// ---------------------------------------------------------------
// MEETINGS
// ---------------------------------------------------------------
function addMeeting(p) {
  if (!p.title || !p.date) return fail_('Title and date are required');
  const record = {
    MeetingID: newId_('MTG'),
    ProjectID: p.projectId || '',
    Title: p.title,
    Description: p.description || '',
    Date: p.date,
    Time: p.time || '',
    Location: p.location || '',
    MeetingLink: p.meetingLink || '',
    CreatedBy: p.actorName || '',
    Status: 'Scheduled'
  };
  appendRecord_('Meetings', record);
  logActivity_(p.actorId, p.actorName, 'Meeting created: ' + record.Title, record.ProjectID, '');
  notifyProjectMembers_(record.ProjectID, 'New meeting', 'Meeting "' + record.Title + '" scheduled on ' + record.Date, 'meeting');
  return ok_(record, 'Meeting created');
}

function updateMeeting(p) {
  const patch = {};
  ['Title', 'Description', 'Date', 'Time', 'Location', 'MeetingLink', 'Status'].forEach(function (f) {
    if (p[f] !== undefined) patch[f] = p[f];
  });
  const updated = updateRecord_('Meetings', 'MeetingID', p.meetingId, patch);
  logActivity_(p.actorId, p.actorName, 'Meeting edited: ' + updated.Title, updated.ProjectID, '');
  return ok_(updated, 'Meeting updated');
}

function deleteMeeting(p) {
  const existing = readAll_('Meetings').find(function (m) { return String(m.MeetingID) === String(p.meetingId); });
  deleteRow_('Meetings', 'MeetingID', p.meetingId);
  if (existing) logActivity_(p.actorId, p.actorName, 'Meeting deleted: ' + existing.Title, existing.ProjectID, '');
  return ok_({}, 'Meeting deleted');
}

// ---------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------
function markNotificationRead(p) {
  const updated = updateRecord_('Notifications', 'NotificationID', p.notificationId, { IsRead: true });
  return ok_(updated, 'Marked as read');
}

function markAllNotificationsRead(p) {
  const sheet = getSheet_('Notifications');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const uidCol = headers.indexOf('UserID');
  const readCol = headers.indexOf('IsRead');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][uidCol]) === String(p.userId)) {
      sheet.getRange(i + 1, readCol + 1).setValue(true);
    }
  }
  return ok_({}, 'All notifications marked as read');
}

// ---------------------------------------------------------------
// SEARCH
// ---------------------------------------------------------------
function globalSearch(query) {
  if (!query) return ok_({ projects: [], tasks: [], members: [], meetings: [], events: [], notes: [], discussions: [] });
  const q = String(query).toLowerCase();
  const contains = function (val) { return val && String(val).toLowerCase().indexOf(q) !== -1; };

  const projects = readAll_('Projects').filter(function (r) { return contains(r.ProjectName) || contains(r.Description) || contains(r.Category); });
  const tasks = readAll_('Tasks').filter(function (r) { return contains(r.TaskTitle) || contains(r.Description); });
  const members = readAll_('Members').filter(function (r) { return contains(r.FullName) || contains(r.Email) || contains(r.Course); });
  const meetings = readAll_('Meetings').filter(function (r) { return contains(r.Title) || contains(r.Description); });
  const events = readAll_('Calendar').filter(function (r) { return contains(r.Title) || contains(r.Description); });
  const notes = readAll_('Notes').filter(function (r) { return contains(r.Title) || contains(r.Content); });
  const discussions = readAll_('Discussions').filter(function (r) { return contains(r.Message); });

  return ok_({ projects: projects, tasks: tasks, members: members, meetings: meetings, events: events, notes: notes, discussions: discussions });
}
