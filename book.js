// ============================================================
// 対戦ログの画面・対戦履歴・スキル辞典（表示と操作）
//   データと文の組み立ては battlelog.js / dict.js にある。
// ============================================================

// ---------- 共通：カードの参照（ログや履歴の中のカード名から、カードの詳細を開く） ----------

// いま見ているログの両者のデッキ（カードレベルと選択スキルを引くため）。[{ lv, op }, { lv, op }]
let bookDecks = null;

function packedDecksOf(st) { return st.decks.map(packDeck); }

// 'r01' や '0r01'（側つき）から、表示するカードを作る
function bookCard(ref) {
  ref = String(ref).split('~')[0];
  const sided = /^[01]/.test(ref) && CARD_DEFS[ref.slice(1)];
  const id = sided ? ref.slice(1) : ref;
  if (!CARD_DEFS[id]) return CARD_BY_ID[id] || null;
  const deck = sided && bookDecks ? bookDecks[Number(ref[0])] : null;
  if (deck) return cardAt(id, deck.lv[id] || 1, deck.op[id]);
  return owns(profile, id) ? ownedCard(profile, id) : cardAt(id);
}

// ---------- 対戦中のログ ----------

let logImportant = false;

function logCtx() {
  return { names: [state.players[0].name, state.players[1].name], terrain: state.terrain ? state.terrain.id : null };
}

function renderLogPanel() {
  $('#log-body').innerHTML = logHtml(state.log, logCtx(), logImportant);
  $('#log-imp').checked = logImportant;
}

// ログを開く（開いている間はゲームが止まる）
function openLog() {
  if (!state) return;
  hideTip();
  gamePaused = true;
  bookDecks = packedDecksOf(state);
  renderLogPanel();
  $('#log-panel').classList.add('open');
  const body = $('#log-body');
  body.scrollTop = body.scrollHeight; // いちばん新しいところから
}

function closeLog() {
  $('#log-panel').classList.remove('open');
  if ($('#dict').classList.contains('hidden')) gamePaused = false;
}

$('#btn-log').addEventListener('click', openLog);
$('#btn-log-close').addEventListener('click', closeLog);
$('#log-imp').addEventListener('change', e => { logImportant = e.target.checked; renderLogPanel(); });
$('#btn-log-dict').addEventListener('click', () => openDict());
$('#btn-dict-battle').addEventListener('click', () => openDict());

// ---------- 対戦履歴 ----------

let battleHistory = loadHistory();
let histFilter = { mode: null, result: null };
let histOpen = null;      // 詳細を見ている試合（t）
let histImportant = false;

// 対戦が終わったら履歴に足す（ui.js の勝敗画面から呼ばれる）
function recordHistory(st, win, mode) {
  const info = { win, foe: st.players[1].name, mode: 'f', label: '', deck: mode.deckName || '' };
  if (mode.type === 'stage') Object.assign(info, { mode: 's', label: mode.stage.id });
  if (mode.type === 'dungeon') Object.assign(info, { mode: 'd', label: mode.label || 'ダンジョン' });
  if (mode.type === 'event') Object.assign(info, { mode: 'e', label: `${mode.event.name} ${mode.n}戦目`, event: mode.event.id });
  addHistory(battleHistory, makeHistoryRecord(st, info));
  saveHistory(battleHistory);
}

const two = n => String(n).padStart(2, '0');
function histDate(t) {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
function histTitle(r) {
  if (r.m === 's') {
    const st = STAGE_BY_ID[r.lb];
    return `ステージ ${r.lb}${st ? `（${CHAPTERS[st.chapter - 1].name}）` : ''}`;
  }
  if (r.m === 'd') return r.lb || 'ダンジョン';
  return r.m === 'e' ? `イベント：${r.lb}` : 'フリー対戦';
}
const histHero = d => (d.h && HERO_SKILL_INFO[d.h] ? `${d.hn || ''}「<span class="lk sk" data-dict="hero:${d.h}">${HERO_SKILL_INFO[d.h].name}</span>」` : 'ヒーローなし');
const histLand = r => (TERRAIN_BY_ID[r.land] ? `<span class="lk sk" data-dict="terrain:${r.land}">${TERRAIN_BY_ID[r.land].icon} ${TERRAIN_BY_ID[r.land].name}</span>` : '地形なし');

function chips(items, current, act) {
  return items.map(([v, label]) => `<button class="btn chip${current === v ? ' on' : ''}" data-${act}="${v === null ? '' : v}">${label}</button>`).join('');
}

function renderHistory() {
  const body = $('#hist-body');
  const rec = histOpen !== null && battleHistory.find(r => r.t === histOpen);
  $('#hist-title').textContent = rec ? '対戦の詳細' : '対戦履歴';
  if (rec) { body.innerHTML = histDetailHtml(rec); return; }
  histOpen = null;
  const list = filterHistory(battleHistory, histFilter.mode, histFilter.result);
  const favs = battleHistory.filter(r => r.fav).length;
  const rows = list.map(r => `<div class="hist-row ${r.w ? 'win' : 'lose'}" data-hist="${r.t}">
      <span class="hist-res">${r.w ? '勝ち' : '負け'}</span>
      <span class="hist-main"><b>${histTitle(r)}</b>
        <small>${histDate(r.t)}　${r.n}ターン　vs ${r.fn}${r.dn ? `　🂠${r.dn}` : ''}</small>
        <small>${histHero(r.dk[0])}　${histLand(r)}</small></span>
      <button class="btn small fav${r.fav ? ' on' : ''}" data-fav="${r.t}" aria-label="保存マーク">${r.fav ? '★' : '☆'}</button>
    </div>`).join('');
  body.innerHTML = `
    <div class="chip-row">${chips([[null, 'すべて'], ['s', 'ステージ'], ['f', 'フリー'], ['e', 'イベント'], ['d', 'ダンジョン']], histFilter.mode, 'hmode')}</div>
    <div class="chip-row">${chips([[null, '勝敗すべて'], ['win', '勝ち'], ['lose', '負け']], histFilter.result, 'hres')}</div>
    <p class="hist-note">直近${HISTORY.MAX}試合を保存（${battleHistory.length}試合・約${Math.max(1, Math.round(historyBytes(battleHistory) / 1024))}KB）。★を付けた試合は自動で消えません（${favs}/${HISTORY.MAX_FAV}）。</p>
    ${rows || '<p class="blog-empty">まだ対戦の記録がありません</p>'}`;
}

function histDeckHtml(d, side) {
  // 同じカードは1行にまとめて「×2」と出す
  const row = (title, ids) => `<div class="hd-kind">${title}</div>` + deckGroups(ids).map(([id, n]) =>
    `<div class="hd-card"><span class="lk s${side}" data-card="${side}${id}">${logCardName(id)}${n > 1 ? ` ×${n}` : ''}</span><small>Lv${d.lv[id] || 1}${d.op[id] != null ? '・選択' : ''}</small></div>`).join('');
  return row('モンスター', d.m) + row('装備', d.i.filter(id => CARD_DEFS[id] && CARD_DEFS[id].kind === 'equip'))
    + row('フラッシュ', d.i.filter(id => !CARD_DEFS[id] || CARD_DEFS[id].kind === 'flash'));
}

function histDetailHtml(r) {
  bookDecks = r.dk;
  const mvp = r.sum.mvp ? `<span class="lk s0" data-card="0${r.sum.mvp[0]}">${logCardName(r.sum.mvp[0])}</span>（与えたダメージ ${r.sum.mvp[1]}）` : 'なし';
  return `
    <div class="hist-sum ${r.w ? 'win' : 'lose'}">
      <h3>${r.w ? '🏆 勝ち' : '💀 負け'}　${histTitle(r)}</h3>
      <p>${histDate(r.t)}　${r.n}ターン　vs ${r.fn}　${histLand(r)}</p>
      ${r.dn ? `<p class="hist-deck">使ったデッキ：<b>${r.dn}</b></p>` : ''}
      <p>${LOG_REASON[r.rs] || ''}</p>
      <table class="sum-table">
        <tr><th></th><th>あなた</th><th>${r.fn}</th></tr>
        <tr><td>与えたダメージ合計</td><td>${r.sum.d[0]}</td><td>${r.sum.d[1]}</td></tr>
        <tr><td>倒した数</td><td>${r.sum.k[0]}</td><td>${r.sum.k[1]}</td></tr>
        <tr><td>ヒーロー</td><td>${histHero(r.dk[0])}</td><td>${histHero(r.dk[1])}</td></tr>
      </table>
      <p>一番活躍したモンスター：${mvp}</p>
      <button class="btn small fav${r.fav ? ' on' : ''}" data-fav="${r.t}">${r.fav ? '★ 保存中（自動で消えない）' : '☆ この試合を保存する'}</button>
    </div>
    <details class="hist-decks"><summary>両者のデッキ</summary>
      <div class="hd-cols"><div><div class="hd-head s0">あなた${r.dn ? `（${r.dn}）` : ''}</div>${histDeckHtml(r.dk[0], 0)}</div><div><div class="hd-head s1">${r.fn}</div>${histDeckHtml(r.dk[1], 1)}</div></div>
    </details>
    <label class="imp-toggle"><input type="checkbox" id="hist-imp" ${histImportant ? 'checked' : ''}> 重要なものだけ</label>
    ${logHtml(r.log, { names: ['あなた', r.fn], terrain: r.land }, histImportant)}`;
}

function openHistory() {
  histOpen = null;
  showScreen('history');
  renderHistory();
}

$('#btn-history').addEventListener('click', openHistory);
$('#btn-hist-back').addEventListener('click', () => {
  if (histOpen !== null) { histOpen = null; renderHistory(); $('#hist-body').scrollTop = 0; } else { showScreen('title'); renderTitle(); }
});
$('#hist-body').addEventListener('change', e => {
  if (e.target.id === 'hist-imp') { histImportant = e.target.checked; renderHistory(); }
});
$('#hist-body').addEventListener('click', e => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    const t = Number(fav.dataset.fav);
    const rec = battleHistory.find(r => r.t === t);
    if (!setHistoryFav(battleHistory, t, !rec.fav)) { fav.textContent = `保存は${HISTORY.MAX_FAV}試合まで`; return; }
    saveHistory(battleHistory);
    renderHistory();
    return;
  }
  const mode = e.target.closest('[data-hmode]'), res = e.target.closest('[data-hres]');
  if (mode) { histFilter.mode = mode.dataset.hmode || null; renderHistory(); return; }
  if (res) { histFilter.result = res.dataset.hres || null; renderHistory(); return; }
  if (e.target.closest('.lk')) return; // 名前のタップは辞典へ
  const row = e.target.closest('[data-hist]');
  if (row) { histOpen = Number(row.dataset.hist); histImportant = false; renderHistory(); $('#hist-body').scrollTop = 0; }
});

// ---------- スキル辞典 ----------

let dictStack = [];  // 開いたページの履歴：{ type: 'list' } / { type: 'entry', key } / { type: 'card', ref }
const dictFilter = { q: '', group: null, cat: null, sort: 'cat', mine: false };

// 辞典を開く（開いている間はゲームが止まる）。page を省くと一覧
function openDict(page) {
  hideTip();
  gamePaused = true;
  if ($('#dict').classList.contains('hidden')) dictStack = [{ type: 'list' }];
  if (page) dictStack.push(page);
  $('#dict').classList.remove('hidden');
  renderDict();
}

function closeDict() {
  $('#dict').classList.add('hidden');
  if (!$('#log-panel').classList.contains('open')) gamePaused = false;
}

function dictBack() {
  dictStack.pop();
  if (dictStack.length) renderDict(); else closeDict();
}

function dictItemHtml(e) {
  return `<button class="dict-item" data-dict="${e.key}">
    <span class="di-icon">${e.icon}</span>
    <span class="di-main"><b>${e.name}</b>${e.ja ? `<small>${e.ja}</small>` : ''}<span class="di-desc">${e.desc}</span></span>
    <span class="di-tags"><i class="cat-${e.cat}">${DICT_CATS[e.cat]}</i><i>${DICT_GROUPS[e.group]}</i></span>
  </button>`;
}

function renderDictList() {
  const list = dictSearch({ ...dictFilter, keys: dictFilter.mine ? deckDictKeys(profile) : null });
  $('#dict-list').innerHTML = `<p class="hist-note">${list.length}件</p>` + (list.map(dictItemHtml).join('') || '<p class="blog-empty">見つかりませんでした</p>');
}

// 図解：上段＝相手、下段＝自分の小さな盤面で、動きをくり返し見せる
function dictDemoHtml(name) {
  const demo = DICT_DEMOS[name];
  if (!demo || !demo.steps.length) return '';
  const cell = key => {
    const fx = demo.steps.filter(s => s[0] === key).map(s => `<i class="dx dx-${s[1]}" style="--dl:${s[2]}"></i>`).join('');
    return `<span class="dcell ${key[0] === 'f' ? 'foe' : 'me'}${fx ? ' used' : ''}">${fx}</span>`;
  };
  const row = side => ['2', '1', '3'].map(n => cell(side + n)).join('');
  return `<div class="dict-demo"><div class="dboard"><div class="drow">${row('f')}</div><div class="drow">${row('m')}</div></div>
    <small>${demo.cap}<br>上段＝相手、下段＝自分（中央が前列）</small></div>`;
}

function dictEntryHtml(e) {
  const cards = dictCards(e);
  const cardHtml = cards.map(c => {
    const card = bookCardPlain(c.id);
    return cardFaceHtml(card, { cls: owns(profile, c.id) ? 'owned' : 'unowned', attrs: `data-card="${c.id}"`, extra: c.opt ? '<span class="card-own">選択スキル</span>' : '' });
  }).join('');
  const rel = e.rel.map(k => DICT_BY_KEY[k]).map(o => `<button class="btn chip" data-dict="${o.key}">${o.icon} ${o.name}</button>`).join('');
  return `<div class="dict-entry">
    <div class="de-head"><span class="de-icon">${e.icon}</span><div><h3>${e.name}</h3>${e.ja ? `<small>${e.ja}（${e.yomi}）</small>` : ''}</div></div>
    <div class="di-tags"><i class="cat-${e.cat}">分類：${DICT_CATS[e.cat]}</i><i>${DICT_GROUPS[e.group]}</i></div>
    <p class="de-desc">${e.desc}</p>
    ${e.hasX ? '<p class="de-note">X は数値です。カードやカードのレベルによって変わります（カードに書かれた数字が X）。</p>' : ''}
    ${e.note ? `<p class="de-note">${e.note}</p>` : ''}
    <div class="de-row"><b>発動タイミング</b><span>${e.when}</span></div>
    ${dictDemoHtml(e.demo)}
    ${rel ? `<div class="tip-sub">関係する項目</div><div class="chip-row wrap">${rel}</div>` : ''}
    ${cards.length ? `<div class="tip-sub">${e.group === 'hero' ? '対応するカード' : e.group === 'event' ? 'このイベントの Elite カード' : `このスキルを持つカード（${cards.length}枚。暗いカードは未所持）`}</div><div class="dict-cards">${cardHtml}</div>` : ''}
  </div>`;
}

// 辞典の一覧から開くカード：持っていれば自分のレベル、なければLv1
function bookCardPlain(id) { return owns(profile, id) ? ownedCard(profile, id) : cardAt(id); }

function dictCardHtml(ref) {
  const card = bookCard(ref);
  if (!card) return '<p class="blog-empty">カードが見つかりません</p>';
  return `<div class="dict-entry"><div class="dict-bigcard">${cardFaceHtml(card, {})}</div>
    <div class="detail-info">${cardTipHtml(card)}</div>
    <p class="de-note">スキル名をタップすると、そのスキルのページを開きます。</p></div>`;
}

function renderDict() {
  const page = dictStack[dictStack.length - 1];
  const body = $('#dict-body');
  $('#dict-back').textContent = dictStack.length > 1 ? '← 戻る' : '← 閉じる';
  if (page.type === 'list') {
    $('#dict-title').textContent = '辞典';
    const groups = [[null, 'すべて'], ...Object.keys(DICT_GROUPS).map(g => [g, DICT_GROUPS[g]])];
    const cats = [[null, '全分類'], ...Object.keys(DICT_CATS).map(c => [c, DICT_CATS[c]])];
    body.innerHTML = `
      <input id="dict-q" type="search" placeholder="検索（例：いばら / Thorns / はんげき）" value="${dictFilter.q.replace(/"/g, '&quot;')}">
      <div class="chip-row">${chips(groups, dictFilter.group, 'dgroup')}</div>
      <div class="chip-row">${chips(cats, dictFilter.cat, 'dcat')}</div>
      <div class="chip-row">${chips([['cat', '分類順'], ['kana', '50音順']], dictFilter.sort, 'dsort')}
        <label class="imp-toggle"><input type="checkbox" id="dict-mine" ${dictFilter.mine ? 'checked' : ''}> 自分のデッキのスキルだけ</label></div>
      <div id="dict-list"></div>`;
    renderDictList();
  } else if (page.type === 'entry') {
    const e = DICT_BY_KEY[page.key];
    $('#dict-title').textContent = DICT_GROUPS[e.group];
    body.innerHTML = dictEntryHtml(e);
  } else {
    $('#dict-title').textContent = 'カード';
    body.innerHTML = dictCardHtml(page.ref);
  }
  body.scrollTop = 0;
}

$('#dict-back').addEventListener('click', dictBack);
$('#dict-close').addEventListener('click', closeDict);
$('#dict-body').addEventListener('input', e => {
  if (e.target.id === 'dict-q') { dictFilter.q = e.target.value; renderDictList(); } // 入力欄は描き直さない（入力が途切れないように）
});
$('#dict-body').addEventListener('change', e => {
  if (e.target.id === 'dict-mine') { dictFilter.mine = e.target.checked; renderDictList(); }
});
$('#dict-body').addEventListener('click', e => {
  for (const [attr, field] of [['dgroup', 'group'], ['dcat', 'cat'], ['dsort', 'sort']]) {
    const el = e.target.closest(`[data-${attr}]`);
    if (el) { dictFilter[field] = el.dataset[attr] || null; renderDict(); return; }
  }
});
$('#btn-dict').addEventListener('click', () => openDict());
$('#btn-col-dict').addEventListener('click', () => openDict());

// どの画面でも：スキル名（data-dict）やカード名（data-card）をタップすると、辞典の該当ページを開く
document.addEventListener('click', e => {
  if (!e.target.closest) return;
  const d = e.target.closest('[data-dict]');
  if (d && DICT_BY_KEY[d.dataset.dict]) { e.stopPropagation(); openDict({ type: 'entry', key: d.dataset.dict }); return; }
  const c = e.target.closest('#dict [data-card], #log-panel [data-card], #screen-history [data-card]');
  if (c) { e.stopPropagation(); openDict({ type: 'card', ref: c.dataset.card }); }
}, true);
