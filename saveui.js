// ============================================================
// セーブデータの守り（IndexedDB への写し・「消さないで」の依頼）と、その画面
//   書き出し（ファイル・文字列）・読み込み（ファイル・貼り付け、今のデータと比べて確認）・バックアップから戻す・
//   バックアップの案内（ホーム画面）。データの扱いそのものは save.js。
// ============================================================

// ---------- IndexedDB（localStorage が消えても戻せるように、同じデータを書いておく） ----------

const SAVE_IDB = { NAME: 'card-monsters', STORE: 'kv', KEY: 'save', DELAY_MS: 400 };
let saveIdbDb = null;
const saveIdb = { ok: null, pending: null, timer: null }; // ok: 使えるか（null はまだ分からない）

function saveIdbOpen() {
  if (saveIdbDb) return saveIdbDb;
  saveIdbDb = new Promise(done => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) { done(null); return; }
      const req = indexedDB.open(SAVE_IDB.NAME, 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore(SAVE_IDB.STORE); } catch (e) { /* もうある */ } };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
    } catch (e) { done(null); }
  }).then(db => { saveIdb.ok = !!db; return db; });
  return saveIdbDb;
}
function saveIdbGet(key) {
  return saveIdbOpen().then(db => db && new Promise(done => {
    try {
      const req = db.transaction(SAVE_IDB.STORE, 'readonly').objectStore(SAVE_IDB.STORE).get(key);
      req.onsuccess = () => done(req.result || null);
      req.onerror = () => done(null);
    } catch (e) { done(null); }
  }));
}
function saveIdbPut(key, value) {
  return saveIdbOpen().then(db => db && new Promise(done => {
    try {
      const tx = db.transaction(SAVE_IDB.STORE, 'readwrite');
      tx.objectStore(SAVE_IDB.STORE).put(value, key);
      tx.oncomplete = () => done(true);
      tx.onerror = () => done(false);
    } catch (e) { done(false); }
  }));
}
// 保存のたびに呼ばれる（save.js の saveMirror）。続けて保存されたら、最後のものだけを書く
function saveIdbMirror(json) {
  saveIdb.pending = json;
  clearTimeout(saveIdb.timer);
  saveIdb.timer = setTimeout(saveIdbFlush, SAVE_IDB.DELAY_MS);
}
function saveIdbFlush() {
  const json = saveIdb.pending;
  if (!json) return;
  saveIdb.pending = null;
  saveIdbPut(SAVE_IDB.KEY, { at: Date.now(), data: json });
}

// 起動時：IndexedDB の写しを確かめる。localStorage が空・読めないときは、写しから戻す
function saveIdbInit(onRestore) {
  if (typeof indexedDB === 'undefined') return Promise.resolve(false);
  saveMirror = saveIdbMirror;
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveIdbFlush(); }); // 閉じる前に書き切る
  }
  return saveIdbGet(SAVE_IDB.KEY).then(rec => {
    const r = rec && parseSave(rec.data);
    const local = parseSave(storeGet(defaultStorage(), GROWTH.SAVE_KEY) || 'null');
    const cur = summarizeProfile(local.ok ? local.profile : profile), curAt = local.ok ? local.savedAt : 0;
    const localLost = saveState.status === 'new' || saveState.status === 'broken' || saveState.status === 'recovered';
    if (r && r.ok && localLost && hasProgress(summarizeProfile(r.profile))
      && (!hasProgress(cur) || r.savedAt > curAt)) {
      const why = saveState.status === 'new' ? '見つからなかった' : '読めなかった';
      backupSpecial(defaultStorage(), 'idb', storeGet(defaultStorage(), GROWTH.SAVE_KEY));
      saveState.blocked = false;
      saveState.status = 'idb';
      saveState.notice = `この端末の保存データ（localStorage）が${why}ため、IndexedDB に残っていた ${saveDateText(rec.at)} のデータから戻しました。`;
      if (onRestore) onRestore(r.profile);
      return true;
    }
    // ふだん：今のデータを写しておく
    const raw = storeGet(defaultStorage(), GROWTH.SAVE_KEY);
    if (raw) saveIdbPut(SAVE_IDB.KEY, { at: Date.now(), data: raw });
    return false;
  });
}

// ---------- ブラウザに「データを消さないで」と頼む（navigator.storage.persist） ----------

const savePersist = { state: 'unknown' }; // 'granted' 許可された・'denied' 許可されなかった・'unsupported' 使えない
function saveRequestPersist() {
  const st = typeof navigator !== 'undefined' && navigator.storage;
  if (!st || !st.persist) { savePersist.state = 'unsupported'; return Promise.resolve(false); }
  const ask = () => st.persist().then(ok => { savePersist.state = ok ? 'granted' : 'denied'; return ok; }, () => { savePersist.state = 'denied'; return false; });
  return (st.persisted ? st.persisted().then(ok => (ok ? (savePersist.state = 'granted', true) : ask()), ask) : ask());
}

// ---------- 起動時 ----------

function saveBoot() {
  saveRequestPersist();
  saveIdbInit(p => { profile = p; saveProfile(profile); renderTitle(); renderCollection(); saveShowNotice(); });
  saveShowNotice();
}
function saveShowNotice() {
  if (!saveState.notice) return;
  const text = saveState.notice;
  saveState.notice = '';
  showOverlay(`<div class="result">
    <h2>💾 セーブデータ</h2>
    <p>${text}</p>
    <button class="btn big" data-act="sv-menu">セーブデータの画面へ</button>
    <button class="btn big primary" data-act="close-detail">とじる</button>
  </div>`);
}

// ---------- 画面 ----------

const saveEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function saveSumText(sum) {
  return sum ? `Lv${sum.level}・カード${sum.cardKinds}種${sum.cardCopies}枚・ステージ${sum.stagesCleared}（★${sum.stars}）` : '読めないデータ';
}

function showSaveMenu() {
  const meta = saveMeta();
  const backups = listBackups(), broken = listBroken();
  const persist = { granted: '✅ 許可されています', denied: '⚠️ 許可されていません（ブラウザが空き容量などで消すことがあります）', unsupported: '⚠️ このブラウザでは使えません', unknown: '確認中' }[savePersist.state];
  const rows = backups.length ? backups.map(b => `<li class="sv-item">
      <div><b>${saveDateText(b.at)}</b><small>${SAVE_REASONS[b.reason] || b.reason}</small></div>
      <div class="sv-sum">${saveSumText(b.sum)}</div>
      ${b.ok ? `<button class="btn small" data-act="sv-restore" data-kind="${b.kind}" data-index="${b.index}">この時点に戻す</button>` : ''}
    </li>`).join('') : '<li class="sv-empty">まだありません（10分以上あけて遊ぶと、自動で残ります）</li>';
  const brokenRows = broken.map((b, i) => `<li class="sv-item"><div><b>${saveDateText(b.at)}</b><small>${saveEsc(b.why || '読めない')}</small></div>
      <button class="btn small" data-act="sv-broken-copy" data-index="${i}">文字列をコピー</button></li>`).join('');
  showOverlay(`<div class="result settings save-menu">
    <h2>💾 セーブデータ</h2>
    <p class="settings-note">今のデータ：${saveSumText(summarizeProfile(profile))}<br>
      最後の書き出し：${meta.lastExport ? saveDateText(meta.lastExport) : 'まだ'}<br>
      IndexedDB への写し：${saveIdb.ok ? '✅ あり' : saveIdb.ok === false ? '⚠️ 使えません' : '確認中'}<br>
      データを消さない依頼：${persist}</p>
    <p>書き出す（別の端末・アドレスへの引っ越しや、もしものときに）</p>
    <div class="tabs settings-row">
      <button class="btn" data-act="sv-export-file">📄 ファイルに保存</button>
      <button class="btn" data-act="sv-export-copy">📋 文字列をコピー</button>
    </div>
    <p>読み込む（今のデータは、上書きの前に自動でバックアップします）</p>
    <div class="tabs settings-row">
      <label class="btn sv-file">📂 ファイルを選ぶ<input type="file" id="sv-file-input" accept=".json,application/json,text/plain"></label>
      <button class="btn" data-act="sv-paste">📝 文字列を貼り付け</button>
    </div>
    <p>自動バックアップ（直近3つ）と、読み込み・リセットなどの前のデータ</p>
    <ul class="sv-list">${rows}</ul>
    ${broken.length ? `<p>読めなかったため退避したデータ</p><ul class="sv-list">${brokenRows}</ul>` : ''}
    <p>バックアップの案内</p>
    <div class="tabs settings-row">
      <button class="btn${meta.remind !== false ? ' on' : ''}" data-act="sv-remind" data-on="1">ホームで知らせる</button>
      <button class="btn${meta.remind === false ? ' on' : ''}" data-act="sv-remind" data-on="0">知らせない</button>
    </div>
    <p class="settings-note">最後に書き出してから${SAVE.REMIND_DAYS}日以上たつと、ホーム画面に小さく表示します。<br>
      セーブデータは、ゲームを開いたアドレス（例：GitHub Pages と http://192.168.…:8000）ごとに別々に保存されます。別のアドレスで続きを遊ぶときは、書き出して読み込んでください。</p>
    <button class="btn big primary" data-act="sv-settings">設定にもどる</button>
  </div>`);
}

// 書き出し：iPhone では共有シートから「"ファイル"に保存」できる。使えなければダウンロード
function saveFileName(now = Date.now()) {
  const d = new Date(now), z = n => String(n).padStart(2, '0');
  return `card-monsters-save-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.json`;
}
function saveExportFile() {
  const text = exportSaveText(), name = saveFileName();
  saveRequestPersist();
  const done = how => { markExported(); renderTitle(); saveToast(`${how}。ファイルは「ファイル」アプリなどに保管してください`); };
  let file = null;
  try { file = new File([text], name, { type: 'application/json' }); } catch (e) { file = null; }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Card Monsters のセーブデータ' })
      .then(() => done('書き出しました'), e => { if (!e || e.name !== 'AbortError') saveDownload(text, name, done); });
    return;
  }
  saveDownload(text, name, done);
}
function saveDownload(text, name, done) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    done('ダウンロードしました');
  } catch (e) { saveShowText(text, 'ファイルに保存できませんでした。下の文字列をコピーして保管してください'); }
}
function saveExportCopy() {
  const text = exportSaveText();
  saveRequestPersist();
  const ok = () => { markExported(); renderTitle(); saveToast('コピーしました。メモ帳などに貼り付けて保管してください'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => saveShowText(text, '自動でコピーできませんでした。下の文字列を長押しして、全部コピーしてください', true));
  else saveShowText(text, '下の文字列を長押しして、全部コピーしてください', true);
}
// 文字列を見せる（自動でコピーできないとき）
function saveShowText(text, note, mark) {
  if (mark) { markExported(); renderTitle(); }
  showOverlay(`<div class="result settings save-menu">
    <h2>📋 セーブデータの文字列</h2>
    <p class="settings-note">${note}</p>
    <textarea class="sv-text" readonly>${saveEsc(text)}</textarea>
    <button class="btn big primary" data-act="sv-menu">もどる</button>
  </div>`);
  const ta = $('#overlay').querySelector && $('#overlay').querySelector('.sv-text');
  if (ta && ta.select) { ta.focus(); ta.select(); }
}
function saveToast(text) {
  showOverlay(`<div class="result"><h2>💾</h2><p>${text}</p><button class="btn big primary" data-act="sv-menu">もどる</button></div>`);
}

function showSavePaste(error = '') {
  showOverlay(`<div class="result settings save-menu">
    <h2>📝 文字列を貼り付け</h2>
    <p class="settings-note">書き出した文字列（{"app":"card-monsters", … で始まる）を、全部貼り付けてください。</p>
    <textarea class="sv-text" id="sv-paste-text" placeholder="ここに貼り付け"></textarea>
    ${error ? `<p class="sv-error">${saveEsc(error)}</p>` : ''}
    <button class="btn big" data-act="sv-paste-go">読み込む</button>
    <button class="btn big primary" data-act="sv-menu">もどる</button>
  </div>`);
}

let saveIncoming = null; // 読み込もうとしているデータ（確認の画面の間だけ）

function saveTryImport(text, from) {
  const r = parseImportText(text);
  if (!r.ok) { if (from === 'paste') showSavePaste(r.why); else saveToast(r.why); return; }
  saveIncoming = r;
  showImportCompare(r);
}

// 今のデータを最後に保存した時刻
function saveSavedAt() { const r = parseSave(storeGet(defaultStorage(), GROWTH.SAVE_KEY) || 'null'); return r.ok ? r.savedAt : 0; }

// 読み込む前に、今のデータと比べて確認する
function showImportCompare(r) {
  const a = summarizeProfile(profile), b = r.sum;
  const row = (label, x, y) => `<tr${x !== y ? ' class="diff"' : ''}><th>${label}</th><td>${x}</td><td>${y}</td></tr>`;
  showOverlay(`<div class="result settings save-menu">
    <h2>読み込みの確認</h2>
    <table class="sv-compare">
      <tr><th></th><td>今のデータ</td><td>読み込むデータ</td></tr>
      ${row('プレイヤーLv', a.level, b.level)}
      ${row('勝敗', `${a.wins}勝${a.losses}敗`, `${b.wins}勝${b.losses}敗`)}
      ${row('カード', `${a.cardKinds}種 ${a.cardCopies}枚`, `${b.cardKinds}種 ${b.cardCopies}枚`)}
      ${row('ステージ', `${a.stagesCleared}（★${a.stars}）`, `${b.stagesCleared}（★${b.stars}）`)}
      ${row('ゴールド・魔石', `${a.gold}・${a.stones}`, `${b.gold}・${b.stones}`)}
      ${row('ダンジョン最高', a.dungeonBest, b.dungeonBest)}
      ${row('パズル', a.puzzles, b.puzzles)}
      ${row('保存した日時', saveDateText(saveSavedAt()), saveDateText(r.exportedAt || r.savedAt))}
    </table>
    <p class="settings-note">今のデータは、上書きする前に自動でバックアップします（この画面から戻せます）。</p>
    <button class="btn danger big" data-act="sv-import-go">上書きして読み込む</button>
    <button class="btn big primary" data-act="sv-menu">やめる</button>
  </div>`);
}

// 読み込み・戻したあと：画面と設定を新しいデータに合わせる
function saveAfterLoad(p, text) {
  profile = p;
  if (typeof fxLoadSettings === 'function') fxLoadSettings();
  if (typeof renderMuteButton === 'function') renderMuteButton();
  renderTitle(); renderCollection();
  if (saveMirror) saveMirror(storeGet(defaultStorage(), GROWTH.SAVE_KEY));
  saveToast(text);
}

// ---------- ホーム画面の、バックアップの案内 ----------

function renderBackupNote() {
  const el = $('#home-backup');
  if (!el) return;
  const due = backupReminderDue(profile);
  el.hidden = !due;
  el.innerHTML = due ? `<span>💾 バックアップ（書き出し）をおすすめします</span>
    <button class="btn small" data-act="sv-home-export">書き出す</button><button class="btn small icon" data-act="sv-home-later" aria-label="あとで">✕</button>` : '';
}

// ---------- 操作 ----------

$('#overlay').addEventListener('click', e => {
  const act = e.target.closest && e.target.closest('[data-act]');
  const name = act && act.dataset.act;
  if (!name) return;
  if (name === 'sv-menu') { saveIncoming = null; showSaveMenu(); }
  if (name === 'sv-export-file') saveExportFile();
  if (name === 'sv-export-copy') saveExportCopy();
  if (name === 'sv-paste') showSavePaste();
  if (name === 'sv-paste-go') { const ta = $('#overlay').querySelector('#sv-paste-text'); saveTryImport(ta ? ta.value : '', 'paste'); }
  if (name === 'sv-import-go' && saveIncoming) {
    const p = applyImport(saveIncoming);
    saveIncoming = null;
    if (p) saveAfterLoad(p, '読み込みました。前のデータはバックアップに残してあります');
    else saveToast('保存できませんでした（端末の空き容量を確かめてください）');
  }
  if (name === 'sv-restore') {
    showOverlay(`<div class="result"><h2>この時点に戻す</h2><p>今のデータは、戻す前に自動でバックアップします。</p>
      <button class="btn danger big" data-act="sv-restore-go" data-kind="${act.dataset.kind}" data-index="${act.dataset.index}">戻す</button>
      <button class="btn big primary" data-act="sv-menu">やめる</button></div>`);
  }
  if (name === 'sv-restore-go') {
    const p = restoreBackup(act.dataset.kind, Number(act.dataset.index));
    if (p) saveAfterLoad(p, 'バックアップから戻しました');
    else saveToast('このバックアップは読めませんでした');
  }
  if (name === 'sv-broken-copy') {
    const b = listBroken()[Number(act.dataset.index)];
    if (b) saveShowText(b.raw, '退避したデータです。直せるかもしれないので、捨てずに保管しておいてください');
  }
  if (name === 'sv-remind') { setSaveMeta({ remind: act.dataset.on === '1' }); renderBackupNote(); showSaveMenu(); }
  if (name === 'sv-settings') showSettings();
});
$('#overlay').addEventListener('change', e => {
  if (!e.target || e.target.id !== 'sv-file-input') return;
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => saveTryImport(String(reader.result || ''), 'file');
  reader.onerror = () => saveToast('ファイルが読めませんでした');
  reader.readAsText(f);
});
$('#home-backup').addEventListener('click', e => {
  const act = e.target.closest && e.target.closest('[data-act]');
  if (!act) return;
  if (act.dataset.act === 'sv-home-export') showSaveMenu();
  if (act.dataset.act === 'sv-home-later') { setSaveMeta({ snoozeUntil: Date.now() + SAVE.REMIND_DAYS * 86400000 }); renderBackupNote(); }
});
