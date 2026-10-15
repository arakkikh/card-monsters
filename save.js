// ============================================================
// 成長システム（セーブデータ・報酬・パック・強化・分解・作成）
// 画面には触らない。数値はすべて GROWTH で調整できる。
// ============================================================

const GROWTH = {
  SAVE_KEY: 'card-monsters-save-v1',

  // プレイヤーレベル
  XP_WIN: 30,
  XP_LOSS: 10,
  XP_BASE: 50,            // Lv1→2 に必要な経験値
  XP_STEP: 25,            // レベルが上がるごとに増える必要経験値
  // 機能が解放されるプレイヤーレベル
  UNLOCK: { free: 2, dismantle: 3, craft: 3, daily: 3, upgrade: 5, event: 7 },
  UNLOCK_NAMES: { free: 'フリー対戦', dismantle: '分解', craft: '作成', daily: 'デイリークエスト', upgrade: '強化', event: 'イベント' },

  // 対戦の報酬
  GOLD_WIN: 30,
  GOLD_LOSS: 10,
  PACK_BULK_MAX: 10,      // まとめて開けられるパックの数（1回あたり）
  PACKS_WIN: 1,           // 勝利でもらえるパック
  PACKS_LEVEL_UP: 1,      // プレイヤーレベルアップでもらえるパック
  GOLD_LEVEL_UP: 50,
  START_PACKS: 1,         // はじめから持っているパック

  // カードパック
  PACK_SIZE: 5,           // 1パックの枚数
  PACK_RATES: { common: 0.70, rare: 0.22, epic: 0.065, legend: 0.015 }, // 1枚ごとの排出率
  PACK_GUARANTEE: 'rare', // 最後の1枚はこのレアリティ以上が確定
  PACK_MONSTER_RATE: 0.55, // モンスターが出る割合（残りは装備・フラッシュ）

  // 強化（Lv L → L+1）：同じカードの予備 L 枚 ＋ ゴールドと魔石（下の値 × L）
  UPGRADE_GOLD:   { common: 20, rare: 40, epic: 80, legend: 150 },
  UPGRADE_STONES: { common: 5,  rare: 10, epic: 25, legend: 50 },
  // 分解でもらえる魔石（1枚あたり）
  DISMANTLE: { common: 5, rare: 20, epic: 80, legend: 300 },
  // 作成に必要な魔石
  CRAFT: { common: 20, rare: 80, epic: 320, legend: 1200 },
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legend'];

// ---------- セーブデータ ----------

// はじめの状態：スターターデッキ1つぶんのカードだけを持っている
function newProfile() {
  const cards = {};
  [...DEFAULT_DECK.monsters, ...DEFAULT_DECK.items].forEach(id => { cards[id] = { level: 1, copies: 0 }; });
  const profile = {
    version: 8,
    level: 1, xp: 0,
    gold: 0, stones: 0, packs: GROWTH.START_PACKS, // packs: 通常パックの数
    packBag: {},           // そのほかのパックの数 { 種類: 数 }（packs.js）
    cards,                 // { カードid: { level: レベル, copies: 予備の枚数 } }
    deck: { monsters: DEFAULT_DECK.monsters.slice(), items: DEFAULT_DECK.items.slice() },
    stages: {},            // { ステージid: 星の数（1〜3） }
    options: {},           // { カードid: 選んだ選択スキルの番号 }
    hero: newHeroData(),   // ヒーロー（選択・解放・レベル・ギフト）
    daily: newDailyData(), // デイリークエストとログインボーナス
    event: newEventData(), // イベント（今週の成績と、受け取った報酬）
    dungeon: newDungeonData(), // ダンジョン（挑戦中のデータと記録）
    puzzle: newPuzzleData(),   // 詰めパズル（クリア状況）
    wins: 0, losses: 0,
  };
  return sanitizeDecks(profile, {}); // 最初のデッキを「デッキ1」として持つ（decks.js）
}

function owns(profile, id) { return !!profile.cards[id]; }
function cardLevel(profile, id) { return owns(profile, id) ? profile.cards[id].level : 0; }
// 持っているレベルのカード（持っていなければLv1）
function ownedCard(profile, id) { return cardAt(id, cardLevel(profile, id) || 1, (profile.options || {})[id]); }

function deckIsValid(profile, deck) {
  // 同じカードは2枚まで、レジェンドは1枚まで（持っていれば、予備の枚数に関係なく入れられる）
  const ok = (ids, kind, n) => Array.isArray(ids) && ids.length === n
    && ids.every(id => owns(profile, id) && (CARD_DEFS[id].kind === 'monster') === (kind === 'monster')
      && ids.filter(x => x === id).length <= copyLimit(id));
  return !!deck && ok(deck.monsters, 'monster', CONFIG.DECK_MONSTERS) && ok(deck.items, 'item', CONFIG.DECK_ITEMS);
}

// 読み込んだデータを点検する。壊れていたら直せるところだけ直す（読めないデータの扱いは loadProfileSafe）
function sanitizeProfile(p) {
  if (!p || typeof p !== 'object' || !p.cards || typeof p.cards !== 'object') return newProfile();
  const fresh = newProfile();
  const num = (v, d) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const out = {
    version: 8,
    level: Math.max(1, num(p.level, 1)), xp: num(p.xp, 0),
    gold: num(p.gold, 0), stones: num(p.stones, 0), packs: num(p.packs, 0), // 古いセーブのパックは、すべて通常パック
    packBag: sanitizePackBag(p.packBag),
    cards: {}, deck: p.deck,
    stages: {}, options: {}, hero: null, daily: sanitizeDailyData(p.daily), event: sanitizeEventData(p.event),
    dungeon: sanitizeDungeonData(p.dungeon), // ダンジョン：古いセーブにはないので初期値を補う
    puzzle: sanitizePuzzleData(p.puzzle),    // 詰めパズル：同じく初期値を補う
    wins: num(p.wins, 0), losses: num(p.losses, 0),
  };
  for (const id in p.stages || {}) {
    if (STAGE_BY_ID[id]) out.stages[id] = Math.max(1, Math.min(num(p.stages[id], 1), 3));
  }
  for (const id in p.cards) {
    if (!CARD_DEFS[id]) continue; // なくなったカードは捨てる
    out.cards[id] = { level: Math.max(1, Math.min(num(p.cards[id].level, 1), maxLevel(id))), copies: num(p.cards[id].copies, 0) };
    if (num(p.cards[id].got, 0)) out.cards[id].got = num(p.cards[id].got, 0); // 手に入れた順番（古いセーブにはない）
  }
  // 選択スキル：なくなったカード・番号・まだ解放されていないものは捨てる
  out.options = {};
  for (const id in p.options || {}) {
    if (out.cards[id] && optionAvailable(id, out.cards[id].level) && CARD_DEFS[id].options[p.options[id]]) out.options[id] = p.options[id];
  }
  // ヒーロー：古いセーブにはないので初期値を補い、すでに倒したボスのぶんのヒーローを解放する
  out.hero = sanitizeHeroData(p.hero);
  unlockHeroes(out);
  if (!Array.isArray(p.decks) && !deckIsValid(out, out.deck)) {
    // （デッキが1つだった古いセーブ）デッキが組めない状態なら、スターターのカードを補って初期デッキに戻す
    for (const id in fresh.cards) if (!out.cards[id]) out.cards[id] = fresh.cards[id];
    out.deck = fresh.deck;
  }
  // 複数デッキ：古いセーブのデッキは「デッキ1」として引き継ぐ。profile.deck は使用中のデッキの写しになる
  const done = sanitizeDecks(out, p);
  if (num(p.cardSeq, 0)) done.cardSeq = num(p.cardSeq, 0); // カードを手に入れた回数（入手順の番号。古いセーブにはない）
  return done;
}

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (e) { return null; }
}

// ---------- セーブデータを消さない仕組み ----------
//   ・読めなかったデータは初期化で上書きせず「退避」に残す（BROKEN_KEY）。バックアップがあれば、そこから戻す
//   ・形式の変換（古い版のセーブ）や、データが減る点検の前に、元のデータを「特別なバックアップ」に残す
//   ・自動バックアップ：前回から10分以上たってからのセーブのとき、直前のデータを残す（最新3つ）
//   ・IndexedDB にも同じデータを書く（localStorage が消えても、そこから戻す）
//   ・書き出し（ファイル・文字列）と読み込み。読み込みの前に、今のデータを特別なバックアップに残す
const SAVE = {
  VERSION: 8,
  AUTO_KEY: 'card-monsters-save-backups',   // 自動バックアップ [{ at, reason: 'auto', data }]（新しい順）
  AUTO_MAX: 3,
  AUTO_GAP_MS: 10 * 60 * 1000,               // 自動バックアップの間隔（毎回だと、数秒前のデータばかりになる）
  SPECIAL_KEY: 'card-monsters-save-special', // 変換前・読み込み前・リセット前・戻す前（新しい順）
  SPECIAL_MAX: 6,
  BROKEN_KEY: 'card-monsters-save-broken',   // 読めなかったデータ [{ at, raw }]
  BROKEN_MAX: 5,
  META_KEY: 'card-monsters-save-meta',       // { lastExport, since, remind, snoozeUntil }
  REMIND_DAYS: 7,                            // 最後に書き出してから、この日数で「バックアップをおすすめします」
  EXPORT_APP: 'card-monsters',
  EXPORT_FORMAT: 1,
};
const SAVE_REASONS = { auto: '自動', migrate: '形式の変換の前', import: '読み込みの前', reset: 'リセットの前', restore: 'バックアップから戻す前', repair: '点検で減る前', idb: 'IndexedDB から戻す前' };

// 読み込みのようす（画面で知らせるため）。status: 'new' 初めて・'ok'・'migrated' 変換した・'recovered' バックアップから戻した・'broken' 読めず新規
const saveState = { status: 'new', notice: '', blocked: false };

function storeGet(storage, key) { try { return storage ? storage.getItem(key) : null; } catch (e) { return null; } }
function storeSet(storage, key, value) { try { storage.setItem(key, value); return true; } catch (e) { return false; } }
function storeList(storage, key) {
  try { const v = JSON.parse(storeGet(storage, key)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

// セーブの中身を点検する。決して例外を出さない。
//   返す値：{ ok, profile, version（元の版）, dropped（点検で捨てたカード・ステージがあった） }
function parseSave(raw) {
  let p;
  try { p = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return { ok: false, why: 'JSON として読めない' }; }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, why: 'データの形がちがう' };
  if (!p.cards || typeof p.cards !== 'object' || !Object.keys(p.cards).length) return { ok: false, why: 'カードのデータがない' };
  try {
    const profile = sanitizeProfile(p);
    const dropped = Object.keys(p.cards).some(id => !profile.cards[id]) || Object.keys(p.stages || {}).some(id => !profile.stages[id]);
    return { ok: true, profile, version: p.version || 0, dropped, savedAt: Number(p.savedAt) || 0 }; // savedAt：保存した時刻（保存データの側だけにある）
  } catch (e) {
    return { ok: false, why: '点検の途中で止まった（' + e.message + '）' };
  }
}

// プレイヤーレベル・カード・ステージなど、比べるための要約
function summarizeProfile(p) {
  if (!p || !p.cards) return null;
  const cards = Object.values(p.cards);
  const stages = Object.values(p.stages || {});
  return {
    level: p.level || 1, wins: p.wins || 0, losses: p.losses || 0, gold: p.gold || 0, stones: p.stones || 0,
    cardKinds: cards.length, cardCopies: cards.reduce((n, c) => n + 1 + (c.copies || 0), 0),
    stagesCleared: stages.length, stars: stages.reduce((n, v) => n + v, 0),
    dungeonBest: (p.dungeon && p.dungeon.best && p.dungeon.best.floor) || 0,
    puzzles: p.puzzle && p.puzzle.done ? Object.keys(p.puzzle.done).length : 0,
  };
}
// 遊んだ形跡があるか（初期状態のデータを、大事なデータと取りちがえない）
function hasProgress(sum) { return !!sum && (sum.level > 1 || sum.wins > 0 || sum.losses > 0 || sum.stagesCleared > 0); }

// 退避・バックアップに足す（新しい順・上限つき）。書けたら true
function pushBackup(storage, key, entry, max) {
  const list = storeList(storage, key);
  list.unshift(entry);
  while (list.length > max) list.pop();
  // 入りきらないとき（容量不足）は、古いものから減らして入れ直す
  while (list.length) {
    if (storeSet(storage, key, JSON.stringify(list))) return true;
    list.pop();
  }
  return false;
}
function backupSpecial(storage, reason, raw, now = Date.now()) {
  if (!raw) return true;
  return pushBackup(storage, SAVE.SPECIAL_KEY, { at: now, reason, data: raw }, SAVE.SPECIAL_MAX);
}

// 起動時の読み込み。読めないときも、元のデータは消さずに退避する
function loadProfileSafe(storage = defaultStorage(), now = Date.now()) {
  const raw = storeGet(storage, GROWTH.SAVE_KEY);
  saveState.blocked = false; saveState.notice = '';
  if (raw == null) { saveState.status = 'new'; return newProfile(); }
  const r = parseSave(raw);
  if (r.ok) {
    // 古い版の形式・点検で減るデータは、変換する前の元データを残しておく
    if (r.version !== SAVE.VERSION || r.dropped) backupSpecial(storage, r.version !== SAVE.VERSION ? 'migrate' : 'repair', raw, now);
    saveState.status = r.version !== SAVE.VERSION ? 'migrated' : 'ok';
    return r.profile;
  }
  // 読めない：元のデータを退避する。退避できなければ、上書きしないよう保存を止める
  if (!pushBackup(storage, SAVE.BROKEN_KEY, { at: now, raw, why: r.why }, SAVE.BROKEN_MAX)) saveState.blocked = true;
  for (const b of [...storeList(storage, SAVE.AUTO_KEY), ...storeList(storage, SAVE.SPECIAL_KEY)].sort((x, y) => y.at - x.at)) {
    const rb = parseSave(b.data);
    if (rb.ok) {
      saveState.status = 'recovered';
      saveState.notice = `セーブデータが読めなかったため、${saveDateText(b.at)} のバックアップから戻しました。読めなかったデータは退避してあります（⚙ 設定 → セーブデータ）。`;
      return rb.profile;
    }
  }
  saveState.status = 'broken';
  saveState.notice = saveState.blocked
    ? 'セーブデータが読めませんでした。元のデータを守るため、保存を止めています。⚙ 設定 → セーブデータ から、データの書き出しや読み込みができます。'
    : 'セーブデータが読めなかったため、新しく始めます。読めなかったデータは退避してあります（⚙ 設定 → セーブデータ）。';
  return newProfile();
}

function loadProfile(storage = defaultStorage()) { return loadProfileSafe(storage); }

function saveDateText(at) {
  if (!at) return '不明';
  const d = new Date(at), z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${z(d.getMonth() + 1)}/${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

let saveMirror = null; // IndexedDB にも書く関数（ブラウザで saveIdbInit が入れる）

function saveProfile(profile, storage = defaultStorage(), now = Date.now()) {
  if (saveState.blocked || !storage) return false; // 読めなかった元データを守っている間は書かない
  // 自動バックアップ：前のバックアップから時間がたっていれば、上書きする前のデータを残す
  const prev = storeGet(storage, GROWTH.SAVE_KEY);
  if (prev) {
    const auto = storeList(storage, SAVE.AUTO_KEY);
    if (!auto.length || now - auto[0].at >= SAVE.AUTO_GAP_MS) pushBackup(storage, SAVE.AUTO_KEY, { at: now, reason: 'auto', data: prev }, SAVE.AUTO_MAX);
  }
  const json = JSON.stringify(Object.assign({}, profile, { savedAt: now })); // 保存した時刻は、保存したデータの側だけに書く
  if (!storeSet(storage, GROWTH.SAVE_KEY, json)) return false;
  if (saveMirror) { try { saveMirror(json); } catch (e) { /* IndexedDB に書けなくても続ける */ } }
  return true;
}

function resetProfile(storage = defaultStorage()) {
  const fresh = newProfile();
  backupSpecial(storage, 'reset', storeGet(storage, GROWTH.SAVE_KEY)); // リセットの前のデータも残す（設定から戻せる）
  saveState.blocked = false;
  saveProfile(fresh, storage);
  return fresh;
}

// バックアップの一覧（設定画面）：[{ kind: 'auto'|'special', index, at, reason, sum }]
function listBackups(storage = defaultStorage()) {
  const out = [];
  for (const [kind, key] of [['auto', SAVE.AUTO_KEY], ['special', SAVE.SPECIAL_KEY]]) {
    storeList(storage, key).forEach((b, index) => {
      const r = parseSave(b.data);
      out.push({ kind, index, at: b.at, reason: b.reason, ok: r.ok, sum: r.ok ? summarizeProfile(r.profile) : null });
    });
  }
  return out.sort((x, y) => y.at - x.at);
}
function listBroken(storage = defaultStorage()) { return storeList(storage, SAVE.BROKEN_KEY); }

// バックアップから戻す（戻す前の今のデータも残す）。戻した profile を返す（だめなら null）
function restoreBackup(kind, index, storage = defaultStorage(), now = Date.now()) {
  const b = storeList(storage, kind === 'auto' ? SAVE.AUTO_KEY : SAVE.SPECIAL_KEY)[index];
  const r = b && parseSave(b.data);
  if (!r || !r.ok) return null;
  backupSpecial(storage, 'restore', storeGet(storage, GROWTH.SAVE_KEY), now);
  saveState.blocked = false;
  return saveProfile(r.profile, storage, now) ? r.profile : null;
}

// ---------- 書き出し・読み込み ----------
//   書き出す中身：セーブデータ・対戦履歴・設定・カードの並び順（どれも、この端末の localStorage にあるもの）
const SAVE_EXTRA_KEYS = { history: 'card-monsters-history-v1', settings: 'card-monsters-settings', cardview: 'card-monsters-cardview' };

function exportSaveData(storage = defaultStorage(), now = Date.now()) {
  const raw = storeGet(storage, GROWTH.SAVE_KEY);
  const r = raw ? parseSave(raw) : { ok: false };
  const data = { app: SAVE.EXPORT_APP, format: SAVE.EXPORT_FORMAT, exportedAt: now, profile: r.ok ? JSON.parse(raw) : null };
  for (const [k, key] of Object.entries(SAVE_EXTRA_KEYS)) {
    try { const v = JSON.parse(storeGet(storage, key)); if (v != null) data[k] = v; } catch (e) { /* なければ入れない */ }
  }
  return data;
}
function exportSaveText(storage = defaultStorage(), now = Date.now()) { return JSON.stringify(exportSaveData(storage, now)); }

// 読み込む文字列を点検する。書き出したファイル・文字列のほか、セーブデータそのもの（JSON）も受けつける
function parseImportText(text) {
  let d;
  try { d = JSON.parse(String(text || '').trim().replace(/^﻿/, '')); } catch (e) { return { ok: false, why: 'セーブデータの文字列として読めません。書き出したファイル・文字列を、そのまま全部貼り付けてください' }; }
  if (!d || typeof d !== 'object') return { ok: false, why: 'セーブデータの形ではありません' };
  const isExport = d.app === SAVE.EXPORT_APP && 'profile' in d;
  const prof = isExport ? d.profile : d;
  const r = parseSave(prof);
  if (!r.ok) return { ok: false, why: `セーブデータが読めません（${r.why}）` };
  return { ok: true, data: isExport ? d : { profile: d }, profile: r.profile, sum: summarizeProfile(r.profile), exportedAt: isExport ? d.exportedAt : 0, savedAt: r.savedAt };
}

// 読み込みを反映する（前の今のデータは特別なバックアップに残す）。新しい profile を返す
function applyImport(parsed, storage = defaultStorage(), now = Date.now()) {
  backupSpecial(storage, 'import', storeGet(storage, GROWTH.SAVE_KEY), now);
  saveState.blocked = false;
  if (!saveProfile(parsed.profile, storage, now)) return null;
  for (const [k, key] of Object.entries(SAVE_EXTRA_KEYS)) {
    if (parsed.data[k] != null) storeSet(storage, key, JSON.stringify(parsed.data[k]));
  }
  return parsed.profile;
}

// ---------- 定期的なバックアップの案内 ----------

function saveMeta(storage = defaultStorage()) {
  try { const m = JSON.parse(storeGet(storage, SAVE.META_KEY)); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; }
}
function setSaveMeta(patch, storage = defaultStorage()) {
  const m = Object.assign(saveMeta(storage), patch);
  storeSet(storage, SAVE.META_KEY, JSON.stringify(m));
  return m;
}
function markExported(storage = defaultStorage(), now = Date.now()) { return setSaveMeta({ lastExport: now, snoozeUntil: 0 }, storage); }

// ホーム画面で「バックアップをおすすめします」と出すか
function backupReminderDue(profile, storage = defaultStorage(), now = Date.now()) {
  const m = saveMeta(storage);
  if (m.remind === false) return false;
  if (!hasProgress(summarizeProfile(profile))) return false;
  if (!m.since) { setSaveMeta({ since: now }, storage); return false; } // 初めて：この日から数える
  if (m.snoozeUntil && now < m.snoozeUntil) return false;
  return now - (m.lastExport || m.since) >= SAVE.REMIND_DAYS * 86400000;
}

// 対戦に使うデッキ（持っているレベルつき）
function deckForBattle(profile) {
  const levels = {};
  const options = {};
  [...profile.deck.monsters, ...profile.deck.items].forEach(id => {
    levels[id] = cardLevel(profile, id);
    if (profile.options[id] != null) options[id] = profile.options[id];
  });
  return { monsters: profile.deck.monsters.slice(), items: profile.deck.items.slice(), levels, options, hero: heroForBattle(profile) };
}

// ---------- 選択スキル ----------

// そのカードの選択スキルを選べるか（持っていて、カードレベルが解放レベル以上）
function optionUnlocked(profile, id) {
  return owns(profile, id) && optionAvailable(id, cardLevel(profile, id));
}

// 選択スキルを選ぶ（いつでも無料で変えられる）。index に null を渡すと「なし」に戻す
function setOption(profile, id, index) {
  if (!optionUnlocked(profile, id)) return false;
  if (index === null) { delete profile.options[id]; return true; }
  if (!CARD_DEFS[id].options[index]) return false;
  profile.options[id] = index;
  return true;
}

// ---------- プレイヤーレベル ----------

function xpToNext(level) { return GROWTH.XP_BASE + GROWTH.XP_STEP * (level - 1); }

function isUnlocked(profile, feature) { return profile.level >= GROWTH.UNLOCK[feature]; }

// 経験値を加える。レベルアップした回数ぶんの報酬（パック・ゴールド）を渡し、解放された機能を返す
function addXp(profile, xp) {
  const before = profile.level;
  profile.xp += xp;
  while (profile.xp >= xpToNext(profile.level)) {
    profile.xp -= xpToNext(profile.level);
    profile.level++;
  }
  const levelUps = profile.level - before;
  profile.packs += levelUps * GROWTH.PACKS_LEVEL_UP;
  profile.gold += levelUps * GROWTH.GOLD_LEVEL_UP;
  const unlocked = Object.keys(GROWTH.UNLOCK).filter(f => GROWTH.UNLOCK[f] > before && GROWTH.UNLOCK[f] <= profile.level);
  return { levelUps, unlocked };
}

// 対戦の報酬を渡す。outcome: 'win' / 'loss' / 'surrender'（降参は報酬なし）
function battleReward(profile, outcome) {
  const win = outcome === 'win';
  const r = { outcome, xp: 0, gold: 0, packs: 0, gifts: 0, levelUps: 0, levelUpPacks: 0, levelUpGold: 0, unlocked: [] };
  if (win) profile.wins++; else profile.losses++;
  if (outcome === 'surrender') return r;
  r.xp = win ? GROWTH.XP_WIN : GROWTH.XP_LOSS;
  r.gold = win ? GROWTH.GOLD_WIN : GROWTH.GOLD_LOSS;
  r.packs = win ? GROWTH.PACKS_WIN : 0;
  profile.gold += r.gold;
  profile.packs += r.packs;
  if (win) r.gifts = giveHeroGift(profile); // ヒーロースキルを使って勝つと、そのヒーローのギフトがもらえる
  const up = addXp(profile, r.xp);
  r.levelUps = up.levelUps;
  r.levelUpPacks = up.levelUps * GROWTH.PACKS_LEVEL_UP;
  r.levelUpGold = up.levelUps * GROWTH.GOLD_LEVEL_UP;
  r.unlocked = up.unlocked;
  return r;
}

// ---------- カードの入手 ----------

// カードを1枚手に入れる。初めてなら所持、2枚目以降は予備になる。初めてなら true
function addCard(profile, id) {
  if (!owns(profile, id)) {
    // got: 手に入れた順番（コレクションの「入手順」に使う。この項目がない古いカードは、いちばん古い扱い）
    profile.cardSeq = (profile.cardSeq || 0) + 1;
    profile.cards[id] = { level: 1, copies: 0, got: profile.cardSeq };
    return true;
  }
  profile.cards[id].copies++;
  return false;
}

// レアリティを抽選する（min を指定すると、それ以上のレアリティだけから選ぶ）
// パックを開ける処理は packs.js。ここは、通常パックを開ける今までの呼び方を残したもの
function openPack(profile, rng = Math.random) { return openPackOf(profile, 'normal', rng); }
function openPacks(profile, n, rng = Math.random) { return openPacksOf(profile, 'normal', n, rng); }

// ---------- 強化・分解・作成 ----------

// 次のレベルへの強化に必要なもの（最大レベルなら null）
function upgradeCost(profile, id) {
  const level = cardLevel(profile, id);
  if (!level || level >= maxLevel(id)) return null;
  const rarity = CARD_DEFS[id].rarity;
  return { copies: level, gold: GROWTH.UPGRADE_GOLD[rarity] * level, stones: GROWTH.UPGRADE_STONES[rarity] * level };
}

// 強化できるか。できないときは理由を返す { ok, reason }
function canUpgrade(profile, id) {
  if (!isUnlocked(profile, 'upgrade')) return { ok: false, reason: `プレイヤーLv${GROWTH.UNLOCK.upgrade}で解放` };
  if (!owns(profile, id)) return { ok: false, reason: '持っていないカード' };
  const cost = upgradeCost(profile, id);
  if (!cost) return { ok: false, reason: '最大レベル' };
  if (profile.cards[id].copies < cost.copies) return { ok: false, reason: '同じカードの予備が足りない' };
  if (profile.gold < cost.gold) return { ok: false, reason: 'ゴールドが足りない' };
  if (profile.stones < cost.stones) return { ok: false, reason: '魔石が足りない' };
  return { ok: true, reason: '' };
}

function upgradeCard(profile, id) {
  if (!canUpgrade(profile, id).ok) return false;
  const cost = upgradeCost(profile, id);
  profile.cards[id].copies -= cost.copies;
  profile.gold -= cost.gold;
  profile.stones -= cost.stones;
  profile.cards[id].level++;
  return true;
}

function isInDeck(profile, id) {
  return profile.deck.monsters.includes(id) || profile.deck.items.includes(id);
}

// 分解できるか。予備があれば予備を、なければ本体を分解する（デッキに入っている本体は不可）
function canDismantle(profile, id) {
  if (!isUnlocked(profile, 'dismantle')) return { ok: false, reason: `プレイヤーLv${GROWTH.UNLOCK.dismantle}で解放` };
  if (!owns(profile, id)) return { ok: false, reason: '持っていないカード' };
  if (CARD_DEFS[id].elite) return { ok: false, reason: 'Elite カードは分解できない' };
  if (profile.cards[id].copies === 0 && isInDeck(profile, id)) return { ok: false, reason: 'デッキに入っている（予備がない）' };
  return { ok: true, reason: '', last: profile.cards[id].copies === 0 };
}

// 1枚分解して魔石にする。もらえた魔石の数を返す（できなければ0）
function dismantleCard(profile, id) {
  if (!canDismantle(profile, id).ok) return 0;
  if (profile.cards[id].copies > 0) profile.cards[id].copies--;
  else { delete profile.cards[id]; delete profile.options[id]; } // 最後の1枚。レベルも選択スキルも失われる
  const gain = GROWTH.DISMANTLE[CARD_DEFS[id].rarity];
  profile.stones += gain;
  return gain;
}

function craftCost(id) { return GROWTH.CRAFT[CARD_DEFS[id].rarity]; }

function canCraft(profile, id) {
  if (!isUnlocked(profile, 'craft')) return { ok: false, reason: `プレイヤーLv${GROWTH.UNLOCK.craft}で解放` };
  if (CARD_DEFS[id].elite) return { ok: false, reason: 'Elite カードは作成できない（イベントの報酬でもらえる）' };
  if (profile.stones < craftCost(id)) return { ok: false, reason: '魔石が足りない' };
  return { ok: true, reason: '' };
}

// 魔石でカードを1枚作る。持っていれば予備が増える
function craftCard(profile, id) {
  if (!canCraft(profile, id).ok) return false;
  profile.stones -= craftCost(id);
  addCard(profile, id);
  return true;
}

// ---------- 対戦相手 ----------

// 今のデッキの強さに合わせたCPUデッキを組む。
//   レアリティの内訳はプレイヤーのデッキと同じ（コモン6・レア2なら相手もコモン6・レア2）
//   カードレベルは、プレイヤーのデッキの平均レベル（切り捨て）
function cpuDeckFor(profile, rng = Math.random) {
  const ids = [...profile.deck.monsters, ...profile.deck.items];
  const level = Math.max(1, Math.floor(ids.reduce((n, id) => n + cardLevel(profile, id), 0) / ids.length));
  const pick = (mine, pool) => {
    const out = [];
    for (const rarity of RARITY_ORDER) {
      const n = mine.filter(id => CARD_DEFS[id].rarity === rarity).length;
      out.push(...shuffle(pool.filter(c => c.rarity === rarity), rng).slice(0, n));
    }
    // そのレアリティのカードが足りないときは、ほかのカードで埋める
    const rest = shuffle(pool.filter(c => !out.includes(c)), rng);
    while (out.length < mine.length && rest.length) out.push(rest.pop());
    return out.map(c => c.id);
  };
  const deck = { monsters: pick(profile.deck.monsters, MONSTERS), items: pick(profile.deck.items, ITEMS), levels: {} };
  [...deck.monsters, ...deck.items].forEach(id => { deck.levels[id] = Math.min(level, maxLevel(id)); });
  deck.options = randomOptions(deck, rng); // CPUも選択スキルを持つ
  deck.hero = randomHero(profile, rng);    // CPUもヒーローを使う
  return deck;
}
