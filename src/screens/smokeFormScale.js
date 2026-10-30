// src/screens/smokeFormScale.js
//
// SMOKE ONLY (claude/agent-form-s2-smoke, NEVER MERGE): the founder's size dial. `?formScale=` in the address (0.8 to 1.6;
// anything else is 1) multiplies every battle and League form's box. Each site lays the bigger or smaller box out by its
// own rule. A corner label shows the value.

export const SMOKE_FORM_SCALE = (() => {
  try { const v = Number(new URLSearchParams(window.location.search).get('formScale')); return v >= 0.8 && v <= 1.6 ? v : 1; } catch { return 1; }
})();
export const dial = (px) => Math.round(px * SMOKE_FORM_SCALE);

let labels = 0;
/** Mount the corner label once, however many forms draw; call from an effect, and call what it returns on cleanup. */
export function showScaleLabel() {
  labels += 1;
  let el = document.querySelector('[data-agent-form-scale]');
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('data-agent-form-scale', '');
    el.style.cssText = 'position:fixed;left:4px;top:4px;z-index:2147483647;padding:3px 6px;border-radius:6px;background:rgba(0,0,0,.72);color:#fff;font:10px/1.35 ui-monospace,monospace;pointer-events:none';
    el.textContent = `formScale ${SMOKE_FORM_SCALE}`;
    document.body.appendChild(el);
  }
  return () => { labels -= 1; if (!labels) el.remove(); };
}
