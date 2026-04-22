// Toggle in browser console:
//   localStorage.setItem('DEBUG', 'true')  — enable
//   localStorage.removeItem('DEBUG')        — disable
// Then refresh the page.

const isDebug = () => localStorage.getItem('DEBUG') === 'true';

const STYLES = {
  API:    'color:#6c8fef;font-weight:600',
  AUTH:   'color:#c084fc;font-weight:600',
  NAV:    'color:#4ade80;font-weight:600',
  PAGE:   'color:#fbbf24;font-weight:600',
  ERROR:  'color:#f87171;font-weight:600',
  INFO:   'color:#94a3b8;font-weight:600',
};

function stamp() {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function emit(tag, style, ...args) {
  if (!isDebug()) return;
  console.log(`%c[${tag}] ${stamp()}`, style, ...args);
}

function group(tag, style, label, fn) {
  if (!isDebug()) { fn(); return; }
  console.groupCollapsed(`%c[${tag}] ${stamp()} ${label}`, style);
  fn();
  console.groupEnd();
}

export const debug = {
  api(method, url, body, response, ms) {
    if (!isDebug()) return;
    const ok = response?.ok !== false;
    const style = ok ? STYLES.API : STYLES.ERROR;
    group('API', style, `${method} ${url} → ${ok ? 'OK' : 'ERROR'} (${ms}ms)`, () => {
      if (body !== undefined)    console.log('  request body:', body);
      if (response !== undefined) console.log('  response:    ', response);
    });
  },

  auth(event, data) {
    emit('AUTH', STYLES.AUTH, event, data ?? '');
  },

  nav(from, to) {
    emit('NAV', STYLES.NAV, `${from} → ${to}`);
  },

  page(name, data) {
    if (!isDebug()) return;
    group('PAGE', STYLES.PAGE, `Loaded: ${name}`, () => {
      if (data !== undefined) console.log('  data:', data);
    });
  },

  info(...args) {
    emit('INFO', STYLES.INFO, ...args);
  },

  error(context, err) {
    if (!isDebug()) return;
    console.group(`%c[ERROR] ${stamp()} ${context}`, STYLES.ERROR);
    console.error(err);
    console.groupEnd();
  },

  // Call once on app boot
  init() {
    if (isDebug()) {
      console.log('%c🔍 Chunky Admin — DEBUG MODE ON', 'color:#6c8fef;font-size:14px;font-weight:700');
      console.log('%c  To disable: localStorage.removeItem("DEBUG") then refresh', 'color:#94a3b8');
    }
  },
};
