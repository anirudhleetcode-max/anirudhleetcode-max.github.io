// If the film's code never starts (the connection dropped while it was loading, or a file is broken),
// say so gently, with a way to try again, instead of leaving "gathering sunlight…" on screen forever.
// A plain script (not a module), so it runs even when the film's modules can't. main.js sets
// window.__film as soon as it runs; once it has, this stays quiet.
(function () {
  var shown = false;
  function fail() {
    if (shown || window.__film) return;
    var boot = document.getElementById('boot');
    var text = boot && boot.querySelector('.boot-text');
    if (!text) return;
    shown = true;
    boot.removeAttribute('aria-hidden');
    text.setAttribute('role', 'alert');
    text.textContent = 'Something went wrong loading the story. Please refresh.';
    var again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn-ghost boot-retry';
    again.textContent = 'Try again';
    again.addEventListener('click', function () { location.reload(); });
    boot.appendChild(again);
    try { again.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  // a script error while the film's code starts up (before it is running)
  window.addEventListener('error', function (e) {
    if (!window.__film && e && e.filename && /\/assets\/js\//.test(e.filename)) setTimeout(fail, 1500);
  });
  // and a long silence (a module that never arrived): generous, so a slow connection isn't mistaken for one
  setTimeout(fail, 45000);
})();
