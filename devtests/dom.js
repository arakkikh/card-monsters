// minimal fake DOM so ui.js can run a whole game headlessly
// （画面の流れのテスト用。ブラウザなしで、ボタンを押す → 対戦 → 結果、までを通しで動かす）
var handlers = {}, els = {};
function fakeEl(sel) {
  const cls = new Set();
  return { sel, innerHTML: '', textContent: '', className: '', disabled: false, dataset: {}, style: { setProperty() {} },
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => on ? cls.add(c) : cls.delete(c), has: c => cls.has(c) },
    addEventListener: (ev, fn) => { (handlers[sel + ':' + ev] = handlers[sel + ':' + ev] || []).push(fn); }, appendChild() {}, parentNode: { appendChild() {} } };
}
var document = {
  querySelector(sel) { if (sel.startsWith('.mon')) return fakeEl(sel); return els[sel] || (els[sel] = fakeEl(sel)); },
  querySelectorAll() { return []; },
  createElement() { return fakeEl('new'); },
};
document.addEventListener = () => {}; document.documentElement = fakeEl('html');
var store = {};
var localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
var setTimeout = fn => { Promise.resolve().then(fn); };
