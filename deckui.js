// ============================================================
// デッキの画面：デッキ一覧・デッキ編集・対戦前のデッキ選択・デッキコード
//   データの操作は decks.js。ここは画面だけ。
// ============================================================

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- デッキ一覧 ----------

function deckBadgesHtml(deck) {
  const st = deckStatus(profile, deck);
  return (deck.id === profile.activeDeck ? '<span class="dk-badge on">使用中</span>' : '')
    + (!st.complete ? `<span class="dk-badge warn">未完成（${st.monsters + st.items}/${CONFIG.DECK_MONSTERS + CONFIG.DECK_ITEMS}）</span>` : '')
    + (st.missing.length ? `<span class="dk-badge bad">カードが足りません（${st.missing.length}）</span>` : '');
}

// デッキ1つぶんの見た目（一覧・対戦前の選択で共通）
function deckRowHtml(deck, { cls = '', attrs = '', tail = '', note = '' } = {}) {
  const sum = deckSummary(deck);
  const hero = HERO_BY_ID[deck.hero];
  const dots = sum.colors.map(c => `<i class="dk-dot c-${c}" title="${COLORS[c].name}"></i>`).join('') || '<small>モンスターなし</small>';
  const top = sum.top.map(id => `<span class="dk-mon${owns(profile, id) ? '' : ' missing'}" title="${esc(CARD_DEFS[id].name)}">${monsterArt(cardAt(id))}</span>`).join('');
  return `<div class="dk-row ${cls}" ${attrs}>
    <span class="dk-hero" title="${esc(hero.name)}">${heroArt(hero)}</span>
    <div class="dk-main">
      <div class="dk-name"><b>${esc(deck.name)}</b>${deckBadgesHtml(deck)}</div>
      <div class="dk-info"><span class="dk-dots">${dots}</span><span class="dk-mons">${top}</span><span class="dk-cost">平均コスト ${sum.avg.toFixed(1)}</span></div>
      <div class="dk-sub">${esc(hero.name)}「${esc(hero.skills[deck.skill].name)}」${note ? `　<span class="dk-why">${note}</span>` : ''}</div>
    </div>
    ${tail}
  </div>`;
}

function renderDecks() {
  const n = profile.decks.length;
  $('#decks-count').textContent = `${n} / ${DECKS.MAX}`;
  $('#deck-list').innerHTML = profile.decks.map((d, i) => deckRowHtml(d, {
    cls: d.id === profile.activeDeck ? 'active' : '', attrs: `data-deck="${d.id}"`,
    tail: `<span class="dk-move"><button class="btn small" data-move="-1" data-deck="${d.id}" ${i === 0 ? 'disabled' : ''} aria-label="上へ">▲</button><button class="btn small" data-move="1" data-deck="${d.id}" ${i === n - 1 ? 'disabled' : ''} aria-label="下へ">▼</button></span>`,
  })).join('') + '<p class="dk-hint">デッキをタップすると、編集・名前の変更・複製・削除・デッキコードの書き出しができます。▲▼で並べ替え。</p>';
  $('#btn-deck-new').disabled = n >= DECKS.MAX;
  $('#btn-deck-new').textContent = n >= DECKS.MAX ? `デッキは${DECKS.MAX}個まで` : '＋ 新しいデッキ';
}

function openDecks() {
  hideOverlay();
  renderDecks();
  showScreen('decks');
}

function saveDecks() {
  saveProfile(profile);
  renderDecks();
  renderTitle();
}

// デッキをタップしたときのメニュー
function showDeckMenu(id) {
  const d = deckById(profile, id);
  if (!d) return;
  const st = deckStatus(profile, d);
  const del = canDeleteDeck(profile, id);
  const full = profile.decks.length >= DECKS.MAX;
  showOverlay(`<div class="result detail dk-panel">
    <h2>${esc(d.name)}</h2>
    <div class="dk-name">${deckBadgesHtml(d)}</div>
    ${st.missing.length ? `<p class="dk-missing">足りないカード：${st.missing.map(x => esc(CARD_DEFS[x].name)).join('、')}</p>` : ''}
    <button class="btn primary" data-act="dk-edit" data-deck="${id}">編集する</button>
    <button class="btn" data-act="dk-use" data-deck="${id}" ${id === profile.activeDeck || !st.playable ? 'disabled' : ''}>${id === profile.activeDeck ? '使用中のデッキです' : st.playable ? '使用中にする' : '使用中にできません（対戦に使えないデッキ）'}</button>
    <button class="btn" data-act="dk-rename" data-deck="${id}">名前を変える</button>
    <button class="btn" data-act="dk-copy" data-deck="${id}" ${full ? 'disabled' : ''}>${full ? `複製できません（${DECKS.MAX}個まで）` : '複製する'}</button>
    <button class="btn" data-act="dk-export" data-deck="${id}">デッキコードを書き出す</button>
    <button class="btn danger" data-act="dk-delete" data-deck="${id}" ${del.ok ? '' : 'disabled'}>${del.ok ? '削除する' : del.reason}</button>
    <button class="btn" data-act="close-detail">とじる</button>
  </div>`);
}

function showDeckNew() {
  showOverlay(`<div class="result detail dk-panel">
    <h2>新しいデッキ</h2>
    <p>あと${DECKS.MAX - profile.decks.length}個作れます。</p>
    <button class="btn primary" data-act="dk-new" data-from="empty">空のデッキから作る</button>
    <button class="btn" data-act="dk-new" data-from="starter">スターターデッキから作る</button>
    <button class="btn" data-act="dk-import">デッキコードを読み込む</button>
    <button class="btn" data-act="close-detail">やめる</button>
  </div>`);
}

function showDeckRename(id) {
  const d = deckById(profile, id);
  showOverlay(`<div class="result detail dk-panel">
    <h2>名前を変える</h2>
    <input id="dk-name-input" class="dk-input" type="text" maxlength="${DECKS.NAME_MAX}" value="${esc(d.name)}" autocomplete="off">
    <p>${DECKS.NAME_MAX}文字まで</p>
    <button class="btn primary" data-act="dk-rename-ok" data-deck="${id}">この名前にする</button>
    <button class="btn" data-act="dk-menu" data-deck="${id}">やめる</button>
  </div>`);
}

function showDeckDelete(id) {
  const d = deckById(profile, id);
  showOverlay(`<div class="result detail dk-panel">
    <h2>デッキを削除しますか？</h2>
    <p>「<b>${esc(d.name)}</b>」を削除します。元に戻せません。<br>（カードはなくなりません）</p>
    <button class="btn danger" data-act="dk-delete-ok" data-deck="${id}">削除する</button>
    <button class="btn primary" data-act="dk-menu" data-deck="${id}">やめる</button>
  </div>`);
}

function showDeckExport(id) {
  const d = deckById(profile, id);
  showOverlay(`<div class="result detail dk-panel">
    <h2>デッキコード</h2>
    <p>「${esc(d.name)}」のコードです。コピーして、ほかの人に渡したり、メモに残したりできます。</p>
    <textarea id="dk-code-out" class="dk-input code" readonly rows="3">${deckToCode(d)}</textarea>
    <p id="dk-code-msg"></p>
    <button class="btn primary" data-act="dk-copy-code">コピーする</button>
    <button class="btn" data-act="dk-menu" data-deck="${id}">もどる</button>
  </div>`);
}

function showDeckImport(error = '', text = '') {
  showOverlay(`<div class="result detail dk-panel">
    <h2>デッキコードを読み込む</h2>
    <p>デッキコードを貼り付けてください。新しいデッキとして追加されます。</p>
    <textarea id="dk-code-in" class="dk-input code" rows="3" placeholder="${DECKS.CODE}-…" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(text)}</textarea>
    ${error ? `<p class="dk-missing">⚠️ ${esc(error)}</p>` : ''}
    <button class="btn primary" data-act="dk-import-ok">読み込む</button>
    <button class="btn" data-act="close-detail">やめる</button>
  </div>`);
}

function showDeckImported(r) {
  showOverlay(`<div class="result detail dk-panel">
    <h2>読み込みました</h2>
    <p>「<b>${esc(r.deck.name)}</b>」として追加しました。</p>
    ${r.missing.length ? `<p class="dk-missing">⚠️ 足りないカード（${r.missing.length}枚）：${r.missing.map(x => esc(CARD_DEFS[x].name)).join('、')}<br>そろうまで、このデッキは対戦に使えません。</p>` : '<p>すべてのカードを持っています。</p>'}
    ${r.heroChanged ? '<p class="dk-missing">コードのヒーロー（またはスキル）はまだ使えないので、今のヒーローにしました。</p>' : ''}
    <button class="btn primary" data-act="dk-edit" data-deck="${r.deck.id}">このデッキを編集する</button>
    <button class="btn" data-act="close-detail">とじる</button>
  </div>`);
}

function copyDeckCode() {
  const box = $('#dk-code-out');
  const done = ok => { $('#dk-code-msg').textContent = ok ? 'コピーしました' : 'コピーできませんでした。上の文字を長押しして、手でコピーしてください'; };
  try { box.focus(); box.select(); } catch (e) { /* 選べなくても続ける */ }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(box.value).then(() => done(true), () => done(document.execCommand('copy'))); return; }
    done(document.execCommand('copy'));
  } catch (e) { done(false); }
}

// ---------- デッキ編集 ----------

let editDeck = null; // { id, name, monsters, items, hero, skill }

// count: デッキに入っている枚数。入っていれば「×1」「×2」と、1枚外す「−」を出す。2枚入っていればそれ以上足せない
function deckCardHtml(c, count, missing) {
  const full = count >= copyLimit(c.id);
  const extra = (missing ? '<span class="card-miss">なし</span>' : '')
    + (count ? `<span class="card-count${full ? ' full' : ''}">×${count}${full ? ' 最大' : ''}</span><span class="card-minus" data-minus="1" role="button" aria-label="1枚外す">−</span>` : '');
  return cardFaceHtml(c, { cls: (count ? 'picked' : '') + (full ? ' maxed' : '') + (missing ? ' missing' : ''), attrs: `data-id="${c.id}"`, extra });
}

// デッキの中身（同じカードは1行にまとめて「×2」）。タップで1枚外せる
function deckContentsHtml() {
  const row = (key, title, max) => {
    const chips = deckGroups(editDeck[key]).map(([id, n]) => {
      const c = CARD_DEFS[id];
      return `<button class="dc-chip c-${c.color || 'none'}${owns(profile, id) ? '' : ' missing'}" data-remove="${id}" data-key="${key}"><i>${c.cost}</i>${esc(c.name)}${n > 1 ? `<b>×${n}</b>` : ''}</button>`;
    }).join('');
    return `<div class="dc-row"><span class="dc-title">${title} ${editDeck[key].length}/${max}</span>${chips || '<small>まだ入っていません</small>'}</div>`;
  };
  return row('monsters', 'モンスター', CONFIG.DECK_MONSTERS) + row('items', 'アイテム', CONFIG.DECK_ITEMS)
    + `<p class="dk-hint">下の一覧のカードをタップすると1枚入ります（同じカードは${CONFIG.DECK_COPIES}枚まで、レジェンドは${CONFIG.DECK_COPIES_LEGEND}枚まで）。「−」か、上の名前をタップすると1枚外れます。</p>`;
}

function openDeckEditor(id) {
  const d = deckById(profile, id);
  if (!d) return;
  editDeck = { id, name: d.name, monsters: d.monsters.slice(), items: d.items.slice(), hero: d.hero, skill: d.skill };
  hideOverlay();
  renderDeck();
  showScreen('deck');
}

// keepTools: 道具（並び替え・絞り込み）を描き直さない（検索欄に文字を打っているあいだ）
function renderDeck(keepTools = false) {
  // 色ごと（アイテムは種類ごと）に見出しを付けて並べる
  const groupOf = c => (c.kind === 'monster' ? c.color : c.kind);
  const groupTitle = {
    equip: '装備カード', flash: 'フラッシュカード（使い切り）',
    ...Object.fromEntries(Object.keys(COLORS).map(k => [k, `${COLORS[k].name}：${COLORS[k].theme}`])),
  };
  let shownCount = 0, totalCount = 0;
  const grids = [];
  const draw = (key, pool, max) => {
    let last = null;
    // 手持ちからなくなったカード（分解した・コードで読み込んだ）は、先頭に赤く出す。タップで外せる
    const gone = [...new Set(editDeck[key])].filter(id => !owns(profile, id));
    const lost = gone.length ? '<div class="deck-group c-none dk-lost">⚠️ カードが足りません（「−」で外す）</div>' + gone.map(id => deckCardHtml(cardAt(id), deckCount(editDeck[key], id), true)).join('') : '';
    // 並び替えと絞り込み（コレクションと同じ道具）。見出しは、標準の並び順のときだけ出す
    const view = cardTools.deck.view;
    const { list } = cardViewList(pool, view, profile);
    const grouped = view.sort === 'color' && !view.reverse;
    shownCount += list.length; totalCount += pool.length;
    $('#list-' + key).innerHTML = lost + (list.length ? list.map(c => {
      const g = c.kind === 'monster' ? c.color : `${c.kind}:${c.color || 'none'}`;
      const title = c.kind === 'monster' ? groupTitle[c.color] : `${groupTitle[c.kind]}・${c.color ? COLORS[c.color].name : '無色'}`;
      const head = grouped && g !== last ? `<div class="deck-group c-${c.color || 'none'}">${title}</div>` : '';
      last = g;
      return head + deckCardHtml(c, deckCount(editDeck[key], c.id));
    }).join('') : '<p class="ct-empty">条件に合うカードがありません。</p>');
    grids.push($('#list-' + key));
    const n = editDeck[key].length;
    $('#count-' + key).textContent = `${n} / ${max}`;
    $('#count-' + key).className = n === max ? 'ok' : 'ng';
  };
  // 持っているカードだけ（持っているレベルで表示）
  const mine = pool => pool.filter(c => owns(profile, c.id)).map(c => ownedCard(profile, c.id));
  draw('monsters', mine(MONSTERS), CONFIG.DECK_MONSTERS);
  draw('items', mine(ITEMS), CONFIG.DECK_ITEMS);
  if (!keepTools) $('#deck-tools').innerHTML = cardToolsHtml('deck', shownCount, totalCount, { kind: true });
  else { const count = $('#deck-tools').querySelector && $('#deck-tools').querySelector('[data-ct-count]'); if (count) count.textContent = cardToolsCount(shownCount, totalCount, cardFilterCount(cardTools.deck.view.filter)); }
  cardToolsAnimate('deck', ...grids);
  const hero = HERO_BY_ID[editDeck.hero];
  $('#deck-contents').innerHTML = deckContentsHtml();
  $('#deck-title').textContent = editDeck.name;
  $('#btn-deck-hero').textContent = `ヒーロー：${hero.name}「${hero.skills[editDeck.skill].name}」（変更）`;
  const st = deckStatus(profile, editDeck);
  const active = editDeck.id === profile.activeDeck;
  $('#btn-deck-save').disabled = active && !st.playable;
  $('#btn-deck-save').textContent = st.playable ? '保存する'
    : active ? '使用中のデッキは、16枚そろえると保存できます'
      : st.missing.length ? `保存する（カードが${st.missing.length}枚足りないので、対戦には使えません）`
        : `未完成のまま保存する（モンスター${st.monsters}/${CONFIG.DECK_MONSTERS}・アイテム${st.items}/${CONFIG.DECK_ITEMS}）`;
}

// 一覧のカードをタップ：1枚足す（同じカードは2枚まで）。「−」をタップ：1枚外す
function toggleDeckCard(key, max, e) {
  const el = e.target.closest('.card');
  if (!el) return;
  const list = editDeck[key];
  const id = el.dataset.id;
  if (e.target.closest('[data-minus]')) {
    const i = list.lastIndexOf(id);
    if (i >= 0) list.splice(i, 1);
  } else if (canAddToDeck(list, id, max) && owns(profile, id)) {
    // 同じカードは隣に並べる
    const at = list.lastIndexOf(id);
    list.splice(at >= 0 ? at + 1 : list.length, 0, id);
    sfx('tap');
  } else return;
  renderDeck();
}

// このデッキで使うヒーローとスキルを選ぶ（解放済みのものだけ）
function showDeckHero() {
  const rows = HEROES.filter(h => profile.hero.unlocked.includes(h.id)).map(h => {
    const skills = h.skills.map((k, i) => {
      const open = heroSkillUnlocked(profile, h.id, i);
      const on = editDeck.hero === h.id && editDeck.skill === i;
      return `<button class="btn${on ? ' on' : ''}" data-act="dk-hero" data-hero="${h.id}" data-skill="${i}" ${open ? '' : 'disabled'}><b>${esc(k.name)}</b><small>${open ? esc(k.desc) : `ヒーローLv${HERO_RULES.SKILL_LEVELS[i]}で解放`}</small></button>`;
    }).join('');
    return `<div class="dk-hero-row"><div class="dk-hero-head"><span class="dk-hero">${heroArt(h)}</span><b>${esc(h.name)}</b><small>Lv${heroLevel(profile, h.id)}</small></div>${skills}</div>`;
  }).join('');
  showOverlay(`<div class="result detail dk-panel">
    <h2>このデッキのヒーロー</h2>
    <p>ヒーローとスキルは、デッキごとに保存されます。</p>
    ${rows}
    <button class="btn" data-act="close-detail">とじる</button>
  </div>`);
}

function showDeckMessage(title, text) {
  showOverlay(`<div class="result detail dk-panel"><h2>${title}</h2><p>${text}</p><button class="btn primary" data-act="close-detail">とじる</button></div>`);
}

// ---------- 対戦を始める・デッキを切り替える ----------
// 対戦は、いつも「使用中」のデッキで始める（デッキを選ぶ画面は挟まない）。
// 変えたいときは、ステージやイベントの情報画面にある「使用中のデッキ」をタップして切り替える。

let switchBack = null; // デッキの切り替え一覧を閉じたあとに戻る先 { type: 'stage', id } | { type: 'event' } | { type: 'free' } | null
const LOANER_NOTICE_MS = 1300;

// 情報画面に出す「使用中のデッキ」の行（タップで切り替え一覧を開く）。back: 戻る先（'stage:1-3' / 'event' / 'free'）
function activeDeckLineHtml(back) {
  const d = activeDeck(profile);
  const hero = HERO_BY_ID[d.hero];
  return `<button class="btn dk-line" data-act="dk-switch" data-back="${back}">
    <span class="dk-hero">${heroArt(hero)}</span>
    <span class="dk-line-text"><small>使用中のデッキ（タップで切り替え）</small><b>${esc(d.name)}</b></span><span class="dk-line-arrow">⇄</span>
  </button>`;
}

function parseBack(text) {
  if (!text) return null;
  const [type, id] = text.split(':');
  return { type, id };
}

// デッキを切り替える小さな一覧。reason: 開いた理由（使用中のデッキが使えない、など）
function showDeckSwitch(back, reason = '') {
  switchBack = back;
  const ev = back && back.type === 'event' ? currentEvent() : null;
  const list = deckChoices(profile, back ? back.type : 'free', null);
  const rows = list.map(c => {
    const colorNg = ev && ev.rule.deckColor && c.ok && !deckIsColor(c.deck, ev.rule.deckColor);
    return deckRowHtml(c.deck, {
      cls: (c.deck.id === profile.activeDeck ? 'active ' : '') + (c.ok ? '' : 'off'), attrs: c.ok ? `data-act="dk-switch-pick" data-deck="${c.deck.id}"` : '',
      note: !c.ok ? `選べません：${c.reason}` : colorNg ? `今週のイベントでは貸し出しデッキになります（${COLORS[ev.rule.deckColor].name}のモンスターだけではない）` : '',
    });
  }).join('');
  showOverlay(`<div class="result detail dk-panel dk-pick">
    <h2>デッキを切り替える</h2>
    ${reason ? `<p class="dk-missing">⚠️ ${esc(reason)}</p><p>対戦に使えるデッキを選んでください。</p>` : '<p>タップしたデッキが「使用中」になります。</p>'}
    <div class="dk-list">${rows}</div>
    <button class="btn" data-act="dk-switch-edit">デッキ編集へ</button>
    <button class="btn" data-act="dk-switch-close">とじる</button>
  </div>`);
}

// 切り替え一覧を閉じて、元の画面に戻る
function closeDeckSwitch() {
  const back = switchBack;
  switchBack = null;
  if (back && back.type === 'stage' && STAGE_BY_ID[back.id]) showStageInfo(back.id);
  else if (back && back.type === 'event') showEvent();
  else hideOverlay();
}

// 「挑戦する」：使用中のデッキで、すぐ対戦を始める。
//   使用中のデッキが使えないときは、理由を出して切り替え一覧を開く（対戦は始まらない）。
//   色指定のイベントで条件に合わないときは、一言知らせてから、貸し出しデッキで始める。
function beginBattle(mode) {
  const ev = mode.type === 'event' ? (refreshEvent(profile), currentEvent()) : null;
  const check = battleDeckCheck(profile, mode.type, ev);
  if (!check.ok) {
    showDeckSwitch(mode.type === 'stage' ? { type: 'stage', id: mode.stage.id } : { type: mode.type }, check.reason);
    return false;
  }
  const go = () => { if (mode.type === 'event') startEventBattle(); else startBattle(mode); };
  if (check.loaner) {
    const color = COLORS[ev.rule.deckColor].name;
    showOverlay(`<div class="result detail dk-panel"><div class="result-icon">${ev.icon}</div><h2>貸し出しデッキで戦います</h2>
      <p>使用中のデッキ「${esc(activeDeck(profile).name)}」は、${color}のモンスターだけではありません。${color}のランダムなデッキを借りて戦います（ヒーローは使用中のデッキのもの）。</p></div>`);
    setTimeout(go, LOANER_NOTICE_MS);
    return true;
  }
  go();
  return true;
}

// ---------- 操作 ----------

$('#btn-deck').addEventListener('click', openDecks);
$('#btn-decks-back').addEventListener('click', () => { showScreen('title'); renderTitle(); });
$('#btn-deck-new').addEventListener('click', () => { if (profile.decks.length < DECKS.MAX) showDeckNew(); });
$('#deck-list').addEventListener('click', e => {
  const mv = e.target.closest('[data-move]');
  if (mv) { if (moveDeck(profile, Number(mv.dataset.deck), Number(mv.dataset.move))) saveDecks(); return; }
  const row = e.target.closest('.dk-row');
  if (row) showDeckMenu(Number(row.dataset.deck));
});

$('#list-monsters').addEventListener('click', e => toggleDeckCard('monsters', CONFIG.DECK_MONSTERS, e));
$('#list-items').addEventListener('click', e => toggleDeckCard('items', CONFIG.DECK_ITEMS, e));
$('#deck-tools').addEventListener('click', e => { if (cardToolsClick('deck', e.target)) renderDeck(); });
$('#deck-tools').addEventListener('input', e => {
  if (!e.target.dataset || e.target.dataset.ct !== 'q') return;
  cardTools.deck.view.filter.q = e.target.value;
  renderDeck(true);
});
$('#deck-contents').addEventListener('click', e => {
  const chip = e.target.closest('[data-remove]');
  if (!chip) return;
  const list = editDeck[chip.dataset.key];
  const i = list.lastIndexOf(chip.dataset.remove);
  if (i >= 0) { list.splice(i, 1); renderDeck(); }
});
$('#btn-deck-back').addEventListener('click', openDecks);
$('#btn-deck-hero').addEventListener('click', showDeckHero);
$('#btn-deck-reset').addEventListener('click', () => {
  editDeck.monsters = DEFAULT_DECK.monsters.slice();
  editDeck.items = DEFAULT_DECK.items.slice();
  renderDeck();
});
$('#btn-deck-save').addEventListener('click', () => {
  const r = saveDeckEdit(profile, editDeck.id, editDeck);
  if (!r.ok) { showDeckMessage('保存できません', r.reason); return; }
  saveProfile(profile);
  openDecks();
  renderTitle();
});

$('#overlay').addEventListener('click', e => {
  const act = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!act || !act.dataset.act.startsWith('dk-')) return;
  const name = act.dataset.act;
  const id = Number(act.dataset.deck);
  if (name === 'dk-menu') showDeckMenu(id);
  if (name === 'dk-edit') openDeckEditor(id);
  if (name === 'dk-use' && setActiveDeck(profile, id)) { sfx('equip'); saveDecks(); showDeckMenu(id); }
  if (name === 'dk-rename') showDeckRename(id);
  if (name === 'dk-rename-ok') { if (renameDeck(profile, id, $('#dk-name-input').value)) { saveDecks(); showDeckMenu(id); } }
  if (name === 'dk-copy') { const c = duplicateDeck(profile, id); if (c) { sfx('equip'); saveDecks(); showDeckMenu(c.id); } }
  if (name === 'dk-export') showDeckExport(id);
  if (name === 'dk-copy-code') copyDeckCode();
  if (name === 'dk-delete') showDeckDelete(id);
  if (name === 'dk-delete-ok') { if (deleteDeck(profile, id).ok) { saveDecks(); hideOverlay(); } }
  if (name === 'dk-new') { const d = addDeck(profile, act.dataset.from); if (d) { saveDecks(); openDeckEditor(d.id); } }
  if (name === 'dk-import') showDeckImport();
  if (name === 'dk-import-ok') {
    const text = $('#dk-code-in').value;
    const r = importDeck(profile, text);
    if (!r.ok) showDeckImport(r.error, text); // 壊れたコード：エラーを出して、何も追加しない
    else { sfx('gem'); saveDecks(); showDeckImported(r); }
  }
  if (name === 'dk-hero') {
    const skill = Number(act.dataset.skill);
    if (heroSkillUnlocked(profile, act.dataset.hero, skill)) { editDeck.hero = act.dataset.hero; editDeck.skill = skill; sfx('equip'); renderDeck(); hideOverlay(); }
  }
  if (name === 'dk-switch') showDeckSwitch(parseBack(act.dataset.back));
  if (name === 'dk-switch-pick' && chooseDeckForBattle(profile, 'free', id)) { sfx('equip'); saveProfile(profile); renderTitle(); closeDeckSwitch(); }
  if (name === 'dk-switch-close') closeDeckSwitch();
  if (name === 'dk-switch-edit') { switchBack = null; openDecks(); }
});
