/* ================= TASKHIVE API LAYER =================
   Set API_URL to your deployed Google Apps Script Web App URL, e.g.
   'https://script.google.com/macros/s/AKfycb.../exec'
*/
const API_URL = 'https://script.google.com/macros/s/AKfycbyCFQurHVo-Us4FDcfpG3_mODOANpqI8q9y3GMazcPhKdZqvwWoN1MB3v5vCF4mfjvaLw/exec';

const Api = (function () {
  function call(action, payload) {
    const body = Object.assign({ action: action }, payload || {});
    return fetch(API_URL, {
      method: 'POST',
      // text/plain avoids a CORS preflight against Apps Script
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json(); })
      .catch(function (err) {
        console.error('API network error:', err);
        return { success: false, message: 'Unable to connect to TaskHive data services. Please try again.' };
      });
  }
  return { call: call };
})();
