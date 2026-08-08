/* ================= TASKHIVE AUTH ================= */
const Auth = (function () {
  const KEY = 'taskhive_session';

  function save(session) {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  }
  function get() {
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function clear() {
    sessionStorage.removeItem(KEY);
  }
  function requireAuth(role) {
    const s = get();
    if (!s) { window.location.href = getLoginPath_(); return null; }
    if (role && s.role !== role) { window.location.href = getLoginPath_(); return null; }
    return s;
  }
  function getLoginPath_() {
    // works whether we're at root or inside /admin or /member
    const depth = window.location.pathname.split('/').filter(Boolean);
    const inSub = depth.includes('admin') || depth.includes('member');
    return inSub ? '../index.html' : 'index.html';
  }

  async function loginAdmin(username, password) {
    const res = await Api.call('loginAdmin', { username: username, password: password });
    if (res.success) save(res.data);
    return res;
  }
  async function loginMember(fullName) {
    const res = await Api.call('loginMember', { fullName: fullName });
    if (res.success) save(res.data);
    return res;
  }
  function logout() {
    const s = get();
    if (s) Api.call('logout', { userId: s.id }).catch(function () {});
    clear();
    window.location.href = getLoginPath_();
  }

  return { save: save, get: get, clear: clear, requireAuth: requireAuth, loginAdmin: loginAdmin, loginMember: loginMember, logout: logout };
})();
