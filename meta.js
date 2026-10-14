// ============================================================
// 対戦の外側の画面（タイトルの成長表示・コレクション・パック・報酬・データリセット）
// 成長のルールは save.js、対戦画面は ui.js にある。
// ============================================================

let profile = loadProfile();
let colTab = 'monster';   // コレクションで表示中の種類
let detailId = null;      // 詳細を開いているカード

function resourcesHtml() { return `💰${profile.gold}　🔷${profile.stones}　🎁${totalPacks(profile)}`; }

function saveAndRefresh() {
  saveProfile(profile);
  renderTitle();
  renderCollection();
}

// ---------- タイトル ----------

// 次に挑戦するステージ（まだクリアしていない最初のステージ。全部クリア済みなら null）
function nextStageToPlay() {
  return STAGES.find(st => stageUnlocked(profile, st.id) && !stageStars(profile, st.id)) || null;
}

// ホーム画面のボタン1つぶんの中身：アイコン・名前・小さな説明・バッジ（hot なら赤く光る）・鍵（未解放）
function homeBtnHtml(icon, label, { sub = '', badge = '', hot = false, lock = '' } = {}) {
  return `<i>${lock ? '🔒' : icon}</i><span>${label}</span>${lock ? `<small>${lock}</small>` : sub ? `<small>${sub}</small>` : ''}${badge && !lock ? `<b class="home-badge${hot ? ' hot' : ''}">${badge}</b>` : ''}`;
}

function renderTitle() {
  const need = xpToNext(profile.level);
  const hero = HERO_BY_ID[profile.hero.selected];
  const deck = activeDeck(profile);
  const lockText = f => (isUnlocked(profile, f) ? '' : `Lv${GROWTH.UNLOCK[f]}で解放`);
  // 上部バー：プレイヤー・資源
  $('#profile-bar').innerHTML = `<span class="pf-avatar">${heroArt(hero)}</span>
    <span class="pf-main"><b>Lv${profile.level}</b><small>${profile.wins}勝 ${profile.losses}敗</small>
      <span class="xp" title="経験値 ${profile.xp} / ${need}"><span class="xp-fill" style="width:${Math.round(100 * profile.xp / need)}%"></span></span></span>`;
  $('#home-gold').innerHTML = `💰<b>${profile.gold}</b>`;
  $('#home-stones').innerHTML = `🔷<b>${profile.stones}</b>`;
  $('#btn-pack-top').innerHTML = `🎁<b>${totalPacks(profile)}</b>`;
  // 中央：背景（今いる章）・ヒーロー・使用中のデッキ
  const next = nextStageToPlay();
  const chapter = next ? next.chapter : CHAPTERS.length;
  if ($('#home-bg').dataset.chapter !== String(chapter)) {
    $('#home-bg').dataset.chapter = String(chapter);
    $('#home-bg').innerHTML = `${sceneHtml(SCENE_OF_CHAPTER[chapter])}<div class="home-fog"></div><div class="home-fog two"></div><div class="home-rays"></div>`;
  }
  $('#home-hero').innerHTML = `<div class="home-hero-art c-${hero.color}">${heroArt(hero)}</div>
    <div class="home-hero-name"><b>${hero.name}</b><small>Lv${heroLevel(profile, hero.id)}「${hero.skills[profile.hero.skill].name}」</small></div>`;
  $('#btn-home-deck').innerHTML = `<small>使用中のデッキ</small><b>${deck.name.replace(/[&<>"]/g, '')}</b><i>⇄</i>`;
  // バトル：次に挑戦するステージ
  const cleared = STAGES.filter(st => stageStars(profile, st.id) > 0).length;
  const stars = STAGES.reduce((n, st) => n + stageStars(profile, st.id), 0);
  $('#btn-battle').innerHTML = `<b>バトル</b><span>${next ? `${next.boss ? '👑 ' : ''}${next.id}　${CHAPTERS[next.chapter - 1].name}` : '全ステージクリア！（ステージ一覧へ）'}</span>`;
  // ほかのモード
  const er = profile.event, ev = currentEvent(), run = profile.dungeon.run;
  const pzDone = PUZZLES.filter(p => profile.puzzle.done[p.id]).length;
  $('#btn-dungeon').innerHTML = homeBtnHtml('🗝️', 'ダンジョン', { sub: run ? `${runPlace(run).chapter}章 命${run.lives}` : profile.dungeon.best.floor ? `最高${profile.dungeon.best.floor}マス` : '全3章', badge: run ? '挑戦中' : '', hot: !!run });
  $('#btn-puzzle').innerHTML = homeBtnHtml('🧩', 'パズル', { sub: `${pzDone}/${PUZZLES.length}` });
  $('#btn-event').innerHTML = homeBtnHtml(ev.icon, 'イベント', { sub: ev.name, lock: lockText('event'), badge: er.active ? `${er.wins}勝${er.losses}敗` : '', hot: er.active });
  $('#btn-event').disabled = !isUnlocked(profile, 'event');
  $('#btn-free').innerHTML = homeBtnHtml('⚔️', 'フリー対戦', { sub: 'CPUと対戦', lock: lockText('free') });
  $('#btn-free').disabled = !isUnlocked(profile, 'free');
  $('#btn-start').innerHTML = homeBtnHtml('🗺️', 'ステージ一覧', { sub: `${cleared}/${STAGES.length} ★${stars}` });
  // 左右のアイコン
  const ds = dailyStatus(profile);
  $('#btn-daily').innerHTML = homeBtnHtml('📜', 'デイリー', { lock: lockText('daily'), badge: ds.claimable ? String(ds.claimable) : '', hot: ds.claimable > 0, sub: `${ds.done}/${ds.total}` });
  $('#btn-daily').disabled = !isUnlocked(profile, 'daily');
  $('#btn-login').innerHTML = homeBtnHtml('🎁', 'ログイン', { lock: lockText('daily'), sub: `${profile.daily.loginCount || 0}日目` });
  $('#btn-login').disabled = !isUnlocked(profile, 'daily');
  $('#btn-history').innerHTML = homeBtnHtml('📖', '対戦履歴');
  $('#btn-dict').innerHTML = homeBtnHtml('🔎', '辞典');
  $('#btn-more').innerHTML = homeBtnHtml('☰', 'その他');
  // これから解放される機能の案内
  const locked = Object.keys(GROWTH.UNLOCK).filter(f => !isUnlocked(profile, f));
  const byLevel = {};
  locked.forEach(f => { (byLevel[GROWTH.UNLOCK[f]] = byLevel[GROWTH.UNLOCK[f]] || []).push(GROWTH.UNLOCK_NAMES[f]); });
  const lv = Object.keys(byLevel)[0];
  $('#home-note').textContent = lv ? `次はプレイヤーLv${lv}で「${byLevel[lv].join('・')}」が解放されます` : '';
  // タブのバッジ（開けられるパックの数）
  $('#tab-pack-badge').textContent = totalPacks(profile) > 0 ? String(totalPacks(profile)) : '';
  $('#tab-pack-badge').classList.toggle('show', totalPacks(profile) > 0);
  renderTabs();
}

// 攻略本（guide.html。ゲームとは別のページ）を開く
function openGuide() {
  if (typeof window !== 'undefined' && window.open) window.open('guide.html', '_blank');
}

// 「その他」：ホームに置ききれないもの（あそびかた・設定・データリセット）
function showMore() {
  showOverlay(`<div class="result detail dk-panel">
    <h2>その他</h2>
    <button class="btn" data-act="more-rules">📘 あそびかた</button>
    <button class="btn" data-act="more-guide">📖 攻略本を開く</button>
    <button class="btn" data-act="more-stages">🗺️ ステージ一覧</button>
    <button class="btn" data-act="more-settings">⚙ 設定（演出の速さ・オートの強さ・効果音）</button>
    <button class="btn danger" data-act="more-reset">データリセット</button>
    <button class="btn primary" data-act="close-detail">とじる</button>
  </div>`);
}
function showRules() {
  showOverlay(`<div class="result detail dk-panel rules-panel"><h2>あそびかた</h2><div class="rules">${$('#rules-content').innerHTML}</div>
    <button class="btn primary" data-act="close-detail">とじる</button></div>`);
}
function confirmReset() {
  showOverlay(`<div class="result">
    <h2>データリセット</h2>
    <p>カード・レベル・ゴールド・魔石・デッキをすべて消して、最初からやり直します。元に戻せません。</p>
    <button class="btn danger big" data-act="reset">リセットする</button>
    <button class="btn big" data-act="close-detail">やめる</button>
  </div>`);
}

// ---------- ステージ選択 ----------

const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

function renderStages() {
  $('#stages-res').innerHTML = resourcesHtml();
  $('#stage-list').innerHTML = CHAPTERS.map(ch => {
    const prog = chapterProgress(profile, ch.id);
    const open = stageUnlocked(profile, `${ch.id}-1`);
    const cells = STAGES.filter(st => st.chapter === ch.id).map(st => {
      const stars = stageStars(profile, st.id);
      const locked = !stageUnlocked(profile, st.id);
      const cls = `stage-cell${st.boss ? ' boss' : ''}${locked ? ' locked' : ''}${stars ? ' cleared' : ''}`;
      return `<button class="${cls}" data-stage="${st.id}" ${locked ? 'disabled' : ''}>
        <span class="stage-no">${st.boss ? '👑 ' : ''}${st.id}</span>
        <span class="stage-land" title="${TERRAIN_BY_ID[st.terrain].name}">${TERRAIN_BY_ID[st.terrain].icon}</span>
        <span class="stage-stars">${locked ? '🔒' : stars ? starText(stars) : 'NEW'}</span>
      </button>`;
    }).join('');
    return `<div class="chapter${open ? '' : ' closed'}">
      <h2>${ch.icon} ${ch.id}章　${ch.name}<span>${prog.cleared}/${prog.total}　★${prog.stars}/${prog.total * 3}</span></h2>
      <div class="stage-grid">${cells}</div>
    </div>`;
  }).join('');
}

// ステージの情報（相手・報酬）を見せて、挑戦するか決める
function showStageInfo(id) {
  const st = STAGE_BY_ID[id];
  const deck = stageDeck(st);
  const stars = stageStars(profile, id);
  const reward = stageReward(st);
  const rewardText = `💰${reward.gold}　🔷${reward.stones}${reward.packs ? `　🎁パック×${reward.packs}` : ''}${reward.bag ? `　${packBagText(reward.bag)}` : ''}`;
  const colors = st.boss ? '' : `<p>使う色：${st.colors.map(c => `<b class="c-${c} color-name">${COLORS[c].name}</b>（${COLORS[c].theme}）`).join('・')}</p>`;
  const rarityCount = RARITY_ORDER.map(r => [r, [...deck.monsters, ...deck.items].filter(c => CARD_DEFS[c].rarity === r).length])
    .filter(x => x[1]).map(x => `<span class="r-${x[0]}">${RARITIES[x[0]].name}${x[1]}</span>`).join('　');
  showOverlay(`<div class="result detail">
    ${st.boss ? `<div class="boss-portrait">${bossArt(st.id)}</div>` : `<div class="result-icon">${st.icon}</div>`}
    <h2>${st.boss ? '👑 ボス　' : ''}${st.id}</h2>
    <p><b>${st.enemy}</b></p>
    ${st.boss ? `<p class="boss-note">${st.feature}</p><p class="hint-note">💡 ${st.hint}</p>` : colors}
    <p class="land-note">${terrainHtml(TERRAIN_BY_ID[st.terrain])}</p>
    <p>相手のカード：Lv${st.level}　／　${rarityCount}</p>
    ${deck.hero ? `<p class="hero-note">相手のヒーロースキル「${HERO_SKILL_INFO[deck.hero.skill].name}」：${HERO_SKILL_INFO[deck.hero.skill].desc}</p>` : ''}
    ${st.bonus > 0 ? `<p class="boss-note">${st.boss ? 'ボス' : '強敵'}補正：相手は最初からクリスタルを${st.bonus}個多く持っている</p>` : ''}
    ${st.bonus < 0 ? `<p class="hint-note">相手は、最初のクリスタルが${-st.bonus}個少ない</p>` : ''}
    ${st.income < 0 ? `<p class="hint-note">入門ステージ：相手が毎ターンもらえるクリスタルは${CONFIG.CRYSTALS_PER_TURN + st.income}個（通常は${CONFIG.CRYSTALS_PER_TURN}個）</p>` : ''}
    <div class="rewards">${stars ? `クリア済み　${starText(stars)}` : `初クリア報酬：${rewardText}`}<br>
      <small>★★ 残りモンスター${STAGE_RULES.STAR_2}体以上　★★★ ${STAGE_RULES.STAR_3}体以上</small></div>
    ${activeDeckLineHtml('stage:' + st.id)}
    <button class="btn primary" data-act="stage-go" data-stage="${st.id}">挑戦する</button>
    <button class="btn" data-act="close-detail">やめる</button>
  </div>`);
}

// 勝敗画面：ステージの星評価と初クリア報酬
function stageResultHtml(r) {
  if (!r) return '';
  const lines = [`<span class="stars">${starText(r.stars)}</span>${r.best > r.stars ? `　（最高 ${starText(r.best)}）` : ''}`];
  for (const h of r.heroes || []) {
    lines.push(`<span class="lvup">新しいヒーロー「${h.name}」が解放されました</span><br>対応するカード「${CARD_DEFS[h.card].name}」を1枚もらいました`);
  }
  if (r.firstClear) {
    lines.push(`<span class="lvup">初クリア報酬</span>　💰 +${r.reward.gold}　🔷 +${r.reward.stones}${r.reward.packs ? `　🎁 +${r.reward.packs}` : ''}${r.reward.bag ? `　${packBagText(r.reward.bag)}` : ''}`);
  }
  return `<div class="rewards">${lines.join('<br>')}</div>`;
}

// イベントの対戦結果（成績と、届いた段階の報酬）
function eventResultHtml(r) {
  if (!r) return '';
  const lines = [`イベント：<b>${r.wins}勝 ${r.losses}敗</b>${r.over ? '　連戦終了' : `（あと${EVENT_CONFIG.BATTLES - r.wins - r.losses}戦。${EVENT_CONFIG.MAX_LOSSES}敗で終了）`}`];
  for (const t of r.tiers) lines.push(`<span class="lvup">${t.wins}勝の報酬</span>　${rewardText(t.reward)}`);
  return `<div class="rewards">${lines.join('<br>')}</div>`;
}

// 勝敗画面のボタン（ステージなら次のステージへ進める）
function resultButtonsHtml(win) {
  if (battleMode.type === 'dungeon') {
    const run = profile.dungeon.run;
    const note = !run ? '' : win ? '' : run.over ? '<p class="dk-missing">命が尽きました。</p>' : `<p class="dk-missing">命が1つ減りました（残り ${run.lives}）</p>`;
    return `${note}<button class="btn primary big" data-dg="return">ダンジョンへ戻る</button>`;
  }
  if (battleMode.type === 'event') {
    return `${profile.event.active ? '<button class="btn primary big" data-act="event-go">次の対戦へ</button>' : ''}
      <button class="btn big${profile.event.active ? '' : ' primary'}" data-act="event">イベント画面へ</button>
      <button class="btn big" data-act="title">タイトルへ</button>`;
  }
  if (battleMode.type !== 'stage') {
    return `<button class="btn primary big" data-act="restart">もう一度</button>
      <button class="btn big" data-act="title">タイトルへ</button>`;
  }
  const next = nextStage(battleMode.stage.id);
  const canNext = next && stageUnlocked(profile, next.id);
  return `${win && canNext ? `<button class="btn primary big" data-act="stage-go" data-stage="${next.id}">次のステージ（${next.id}）へ</button>` : ''}
    ${win && !next ? '<p class="lvup">全ステージクリア！おめでとうございます</p>' : ''}
    <button class="btn big${win && canNext ? '' : ' primary'}" data-act="restart">もう一度</button>
    <button class="btn big" data-act="stages">ステージ選択へ</button>`;
}

// 対戦の報酬（勝敗画面に出す）
function rewardHtml(r) {
  if (r.outcome === 'surrender') return '<div class="rewards">降参したため、報酬はありません</div>';
  const lines = [`経験値 +${r.xp}　💰 +${r.gold}${r.packs ? `　🎁 パック +${r.packs}` : ''}`];
  if (r.gifts) lines.push(`🎀 ${HERO_BY_ID[profile.hero.selected].name}のギフト +${r.gifts}（ヒーローのレベル上げに使えます）`);
  if (r.levelUps) {
    lines.push(`<span class="lvup">プレイヤーLv${profile.level}にアップ！</span>　🎁 +${r.levelUpPacks}　💰 +${r.levelUpGold}`);
  }
  if (r.unlocked.length) {
    lines.push(`<span class="lvup">${r.unlocked.map(f => GROWTH.UNLOCK_NAMES[f]).join('・')}が解放されました</span>（${r.unlocked.includes('daily') ? 'タイトル画面・' : ''}コレクション画面で使えます）`);
  }
  if (r.quests && r.quests.length) {
    lines.push(`<span class="lvup">デイリークエスト達成</span>：${r.quests.map(q => q.text).join('／')}<br>タイトルの「デイリークエスト」で報酬を受け取れます`);
  }
  return `<div class="rewards">${lines.join('<br>')}</div>`;
}

// ---------- コレクション ----------

const COL_TABS = { monster: 'モンスター', equip: '装備', flash: 'フラッシュ' };

function collectionCardHtml(def) {
  const own = profile.cards[def.id];
  const c = ownedCard(profile, def.id);
  const badge = own
    ? `<span class="card-own${canUpgrade(profile, def.id).ok ? ' can' : ''}">Lv${own.level}${own.copies ? `　予備${own.copies}` : ''}${canUpgrade(profile, def.id).ok ? ' ⬆' : ''}</span>`
    : '<span class="card-own">未所持</span>';
  return cardFaceHtml(c, { cls: own ? 'owned' : 'unowned', attrs: `data-id="${c.id}"`, extra: badge });
}

// ---------- カード一覧の道具（並び替え・絞り込み。コレクションとデッキ編集で同じものを使う） ----------

// 画面ごとの状態。view: 並び順と絞り込み（cardsort.js）　open: 開いているパネル（'sort' | 'filter' | null）
const cardTools = {
  collection: { view: loadCardView('collection'), open: null, moved: false },
  deck: { view: loadCardView('deck'), open: null, moved: false },
};

// 道具のHTML。shown / total: 表示中の枚数と、全体の枚数。opts.kind: 種類の絞り込みを出す　opts.owned: 所持の絞り込みを出す
function cardToolsHtml(scope, shown, total, opts = {}) {
  const t = cardTools[scope], v = t.view, f = v.filter;
  const def = CARD_SORTS[v.sort];
  const n = cardFilterCount(f);
  const chip = (group, value, label, on, cls = '') => `<button class="ct-chip${on ? ' on' : ''} ${cls}" data-ct="${group}" data-v="${value}">${label}</button>`;
  let panel = '';
  if (t.open === 'sort') {
    panel = `<div class="ct-panel"><div class="ct-row">${Object.keys(CARD_SORTS).map(k => chip('sort', k, CARD_SORTS[k].name, k === v.sort)).join('')}</div>
      <p class="ct-note">同じ値のカードは「色 → レアリティ → コスト → 名前」の順に並びます。攻撃力順・HP順では、装備とフラッシュは最後にまとまります。</p></div>`;
  } else if (t.open === 'filter') {
    const colors = ['none', ...Object.keys(COLORS)];
    const rar = ['elite', 'legend', 'epic', 'rare', 'common'];
    const rarName = k => (k === 'elite' ? 'Elite' : RARITIES[k].name);
    panel = `<div class="ct-panel">
      <div class="ct-row"><b>色</b>${colors.map(c => chip('color', c, c === 'none' ? '無色' : COLORS[c].name, f.colors.includes(c), 'c-' + c)).join('')}</div>
      <div class="ct-row"><b>レア</b>${rar.map(k => chip('rarity', k, rarName(k), f.rarities.includes(k))).join('')}</div>
      ${opts.kind ? `<div class="ct-row"><b>種類</b>${CARD_KIND_ORDER.map(k => chip('kind', k, COL_TABS[k], f.kind === k)).join('')}</div>` : ''}
      <div class="ct-row"><b>攻撃</b>${Object.keys(ATTACK_TYPES).map(k => chip('type', k, `${ATTACK_TYPES[k].icon}${ATTACK_TYPES[k].name}`, f.types.includes(k))).join('')}</div>
      <div class="ct-row"><b>ほか</b>${opts.owned ? chip('owned', 1, '所持のみ', f.owned) : ''}${chip('upgradable', 1, '⬆ 強化できる', f.upgradable)}</div>
    </div>`;
  }
  return `<div class="ct-bar">
      <button class="btn ct-btn${t.open === 'sort' ? ' on' : ''}" data-ct="open" data-v="sort">並び替え：${def.name} ▾</button>
      <button class="btn ct-btn ct-dir" data-ct="dir" aria-label="向きを切り替える">${def.labels[v.reverse ? 1 : 0]} ⇅</button>
      <button class="btn ct-btn${t.open === 'filter' || n ? ' on' : ''}" data-ct="open" data-v="filter">絞り込み${n ? `（${n}）` : ''} ▾</button>
    </div>
    <div class="ct-bar">
      <input class="ct-q" type="search" data-ct="q" value="${esc(f.q)}" placeholder="カード名・スキル名で検索" autocomplete="off">
      <span class="ct-count" data-ct-count>${cardToolsCount(shown, total, n)}</span>
      ${n ? '<button class="btn ct-btn ct-clear" data-ct="clear">絞り込みを解除</button>' : ''}
    </div>${panel}`;
}

// 表示中の枚数（絞り込み中は「42 / 128枚」）
function cardToolsCount(shown, total, n) { return n ? `${shown} / ${total}枚` : `${total}枚`; }

// 道具のボタンが押されたときの処理。状態を変えたら true（並び順が変わったら moved も立てる）
function cardToolsClick(scope, el) {
  const t = cardTools[scope], v = t.view, f = v.filter;
  const btn = el.closest && el.closest('[data-ct]');
  if (!btn || btn.dataset.ct === 'q') return false;
  const kind = btn.dataset.ct, val = btn.dataset.v;
  const toggle = (list, x) => { const i = list.indexOf(x); if (i < 0) list.push(x); else list.splice(i, 1); };
  if (kind === 'open') t.open = t.open === val ? null : val;
  else if (kind === 'sort') { if (v.sort !== val) { v.sort = val; v.reverse = false; } t.open = null; t.moved = true; saveCardView(scope, v); }
  else if (kind === 'dir') { v.reverse = !v.reverse; t.moved = true; saveCardView(scope, v); }
  else if (kind === 'color') toggle(f.colors, val);
  else if (kind === 'rarity') toggle(f.rarities, val);
  else if (kind === 'type') toggle(f.types, val);
  else if (kind === 'kind') f.kind = f.kind === val ? null : val;
  else if (kind === 'owned') f.owned = !f.owned;
  else if (kind === 'upgradable') f.upgradable = !f.upgradable;
  else if (kind === 'clear') { v.filter = cardFilterDefault(); }
  else return false;
  return true;
}

// 並び替えた直後は、カードが軽く入れ替わる動きを付ける（演出スキップのときは無し）
function cardToolsAnimate(scope, ...grids) {
  const t = cardTools[scope];
  if (!t.moved) return;
  t.moved = false;
  if (FX.speed === 'skip') return;
  for (const g of grids) {
    g.classList.remove('resorted');
    void g.offsetWidth; // アニメーションをやり直す
    g.classList.add('resorted');
  }
}

// 色の見出し（標準の並び順のときだけ出す）
function cardGroupHead(c, last) {
  const g = c.color || 'none';
  if (g === last.g) return '';
  last.g = g;
  return `<div class="deck-group c-${g}">${COLORS[g] ? `${COLORS[g].name}：${COLORS[g].theme}` : '無色'}</div>`;
}

function renderCollection() {
  const pool = { monster: MONSTER_DEFS, equip: EQUIP_DEFS, flash: FLASH_DEFS }[colTab];
  const ownedCount = kind => Object.keys(profile.cards).filter(id => CARD_DEFS[id].kind === kind).length;
  const total = { monster: MONSTER_DEFS.length, equip: EQUIP_DEFS.length, flash: FLASH_DEFS.length };
  $('#col-res').innerHTML = resourcesHtml();
  $('#col-tabs').innerHTML = Object.keys(COL_TABS).map(k =>
    `<button class="btn${k === colTab ? ' on' : ''}" data-tab="${k}">${COL_TABS[k]} ${ownedCount(k)}/${total[k]}</button>`).join('');
  const shown = renderCollectionList(pool);
  $('#col-tools').innerHTML = cardToolsHtml('collection', shown, pool.length, { owned: true });
}

// カードの一覧だけを描き直す（検索欄に文字を打っているあいだは、道具を描き直さない）。表示した枚数を返す
function renderCollectionList(pool = { monster: MONSTER_DEFS, equip: EQUIP_DEFS, flash: FLASH_DEFS }[colTab]) {
  const view = cardTools.collection.view;
  const { list } = cardViewList(pool.map(def => ownedCard(profile, def.id)), view, profile);
  const grouped = view.sort === 'color' && !view.reverse;
  const last = {};
  $('#col-list').innerHTML = list.length
    ? list.map(c => (grouped ? cardGroupHead(c, last) : '') + collectionCardHtml(CARD_DEFS[c.id])).join('')
    : '<p class="ct-empty">条件に合うカードがありません。</p>';
  cardToolsAnimate('collection', $('#col-list'));
  return list.length;
}

// カード詳細（強化・分解・作成）
function showCardDetail(id) {
  detailId = id;
  const own = profile.cards[id];
  const c = ownedCard(profile, id);
  const lock = (check, label) => (check.ok ? '' : `<div class="why">${label}：${check.reason}</div>`);
  let upgrade = '';
  if (own) {
    const cost = upgradeCost(profile, id);
    const up = canUpgrade(profile, id);
    upgrade = cost
      ? `<button class="btn primary" data-act="upgrade" ${up.ok ? '' : 'disabled'}>強化 Lv${own.level} → Lv${own.level + 1}<br>
          <small>予備 ${own.copies}/${cost.copies}　💰 ${profile.gold}/${cost.gold}　🔷 ${profile.stones}/${cost.stones}</small></button>${lock(up, '強化できません')}`
      : '<div class="own-row">最大レベルです</div>';
  }
  // 選択スキル：候補から1つ選ぶ（いつでも無料で変えられる）
  let options = '';
  if (c.options) {
    const open = optionUnlocked(profile, id);
    const btn = (k, i) => `<button class="btn opt-btn${c.option === i ? ' on' : ''}" data-act="option" data-index="${i}" ${open ? '' : 'disabled'}>
      ${SKILLS[k.id].icon} <b>${skillLabel(k)}</b><br><small>${SKILLS[k.id].desc(k.x)}</small></button>`;
    const why = !own ? '持っていないカード' : `カードLv${c.optionLevel}で解放（今はLv${own.level}）`;
    options = `<div class="opt-box">
      <div class="tip-sub">選択スキル${open ? '（1つ選ぶ。いつでも無料で変更可）' : ''}</div>
      ${open ? '' : `<div class="why">${why}</div>`}
      ${c.options.map(btn).join('')}
      ${open ? `<button class="btn opt-btn${c.option === null ? ' on' : ''}" data-act="option" data-index="none">なし</button>` : ''}
    </div>`;
  }
  const dis = canDismantle(profile, id);
  const craft = canCraft(profile, id);
  const dismantle = own
    ? `<button class="btn" data-act="dismantle" ${dis.ok ? '' : 'disabled'}>${dis.last ? '最後の1枚を分解' : '予備を1枚分解'}（+${GROWTH.DISMANTLE[c.rarity]}🔷）</button>${lock(dis, '分解できません')}`
    : '';
  showOverlay(`<div class="result detail">
    ${holoCardHtml(c, { size: 'small' })}
    <div class="detail-info">${cardTipHtml(c)}</div>
    ${options}
    <div class="own-row">${own ? `所持：Lv${own.level}　予備 ${own.copies}枚` : '未所持'}</div>
    <div class="res">${resourcesHtml()}</div>
    ${upgrade}
    ${dismantle}
    <button class="btn" data-act="craft" ${craft.ok ? '' : 'disabled'}>${own ? '予備を1枚作成' : 'このカードを作成'}（🔷${craftCost(id)}）</button>${lock(craft, '作成できません')}
    <button class="btn" data-act="close-detail">とじる</button>
  </div>`);
}

// ---------- カードパック ----------

// パックを1つ開ける。演出を見せてから、引いたカードの一覧を出す
let packOpening = false;
// タイトルの「パックを開ける」：2パック以上あれば、1つずつか、まとめて開けるかを選ぶ
// ---------- パック（持っているパック・ショップ・開封） ----------

let packTab = 'own';     // パック画面のタブ：'own' 持っているパック / 'shop' ショップ
let lastPackType = 'normal'; // 直前に開けたパックの種類（「もう1つ開ける」用）

const priceHtml = price => (price.gold ? `💰${price.gold}` : `🔷${price.stones}`);
const ratesText = t => RARITY_ORDER.map(r => `<span class="r-${r}">${RARITIES[r].name} ${Math.round(1000 * packRatesOf(t)[r]) / 10}%</span>`).join('　');

// パック画面：持っているパック（種類ごと）と、ショップ
function choosePack() {
  if (packOpening) return;
  const own = ownedPacks(profile);
  const total = totalPacks(profile);
  if (!total && packTab === 'own') packTab = 'shop';
  const tabs = `<div class="tabs pk-tabs"><button class="btn${packTab === 'own' ? ' on' : ''}" data-act="pack-tab" data-tab="own">持っているパック（${total}）</button><button class="btn${packTab === 'shop' ? ' on' : ''}" data-act="pack-tab" data-tab="shop">ショップ</button></div>`;
  let body;
  if (packTab === 'own') {
    const rows = own.map(({ id, n }) => {
      const t = packType(id);
      const bulk = Math.min(n, GROWTH.PACK_BULK_MAX);
      return `<div class="pk-row">${packArtHtml(id, 'mini')}
        <div class="pk-row-main"><b>${t.name}<span class="pk-n">×${n}</span></b><small>${t.desc}</small>
          <div class="pk-row-btns"><button class="btn small primary" data-act="pack-open" data-type="${id}">1つ開ける</button>
            ${n > 1 ? `<button class="btn small" data-act="pack-bulk" data-type="${id}">まとめて開ける（${bulk}）</button>` : ''}
            <button class="btn small" data-act="pack-info" data-type="${id}">排出率</button></div></div></div>`;
    }).join('');
    body = (rows || '<p>パックを持っていません。対戦の勝利やクエストでもらえます。ショップで買うこともできます。</p>')
      + (own.length > 1 ? `<button class="btn big primary" data-act="pack-all">全部まとめて開ける（${Math.min(total, GROWTH.PACK_BULK_MAX)}パック）</button>` : '');
  } else {
    const rows = shopPacks(profile).map(id => {
      const t = packType(id);
      const can = canBuyPack(profile, id);
      return `<div class="pk-row">${packArtHtml(id, 'mini')}
        <div class="pk-row-main"><b>${t.name}${packCount(profile, id) ? `<span class="pk-n">所持×${packCount(profile, id)}</span>` : ''}</b><small>${t.desc}</small>
          <div class="pk-row-btns"><button class="btn small${can.ok ? ' primary' : ''}" data-act="pack-buy" data-type="${id}" ${can.ok ? '' : 'disabled'}>${priceHtml(t.price)} で買う</button>
            <button class="btn small" data-act="pack-info" data-type="${id}">排出率</button>${can.ok ? '' : `<span class="pk-why">${can.reason}</span>`}</div></div></div>`;
    }).join('');
    body = `<p class="pk-wallet">💰 ${profile.gold}　🔷 ${profile.stones}</p>${rows}<p class="dk-hint">イベントパックは、イベントの報酬でだけ手に入ります。</p>`;
  }
  showOverlay(`<div class="result detail pk-panel">
    <h2>🎁 パック</h2>${tabs}
    <div class="pk-list">${body}</div>
    <button class="btn big" data-act="close-detail">とじる</button>
  </div>`);
}

// 排出率と中身の説明
function showPackInfo(id) {
  const t = packType(id);
  const sure = t.guarantee || 1;
  showOverlay(`<div class="result detail pk-panel">
    <div class="pk-info-art">${packArtHtml(id, 'mini')}</div><h2>${t.name}</h2>
    <p>${t.desc}</p>
    <div class="tip-sub">1枚ごとの排出率</div><p>${ratesText(t)}</p>
    <p>${GROWTH.PACK_SIZE}枚入り。最後の${sure > 1 ? `${sure}枚` : '1枚'}は<b class="r-rare">レア以上</b>が確定（そのときは、コモンを除いた割合で決まる）。</p>
    <p>モンスターが出る割合は約${Math.round(100 * GROWTH.PACK_MONSTER_RATE)}%${t.allow ? '（このパックで出るカードの中から）' : ''}。${t.boost ? `「出やすい」カードは、ほかのカードの${PACK_SHOP.BOOST}倍の出やすさ。` : ''}Elite カードは出ない。</p>
    ${t.gift ? `<p>🎀 ${HERO_BY_ID[t.hero].name}のギフトが${t.gift}つ入っている。</p>` : ''}
    <button class="btn primary" data-act="pack-back">もどる</button>
  </div>`);
}

// 開けたあとの「もう1つ」「まとめて」のボタン（直前に開けた種類）
function packButtonsHtml() {
  const n = packCount(profile, lastPackType);
  const t = packType(lastPackType);
  const bulk = Math.min(n, GROWTH.PACK_BULK_MAX);
  return `${n > 1 ? `<button class="btn primary big" data-act="pack-bulk" data-type="${lastPackType}">${t.name}をまとめて開ける（${bulk}パック）</button>` : ''}
    ${n > 0 ? `<button class="btn big${n > 1 ? '' : ' primary'}" data-act="pack-open" data-type="${lastPackType}">${t.name}をもう1つ開ける（残り${n}）</button>` : ''}
    ${totalPacks(profile) > 0 || true ? '<button class="btn big" data-act="pack-back">パック画面へ</button>' : ''}`;
}

// まとめて開ける：演出は流さず、出たカードを一覧で見せる。type を省略すると、種類をまたいで全部
function showPackBulk(type) {
  if (packOpening) return;
  const pulls = type ? openPacksOf(profile, type, GROWTH.PACK_BULK_MAX) : openAllPacks(profile);
  if (!pulls) return;
  if (type) lastPackType = type;
  sfx('win');
  saveAndRefresh();
  showPackSummary(pulls, pulls.packs, pulls.gifts);
}

async function showPack(type = 'normal') {
  if (packOpening) return;
  const pulls = openPackOf(profile, type);
  if (!pulls) return;
  lastPackType = type;
  saveAndRefresh();
  // 演出を出せるとき（スキップ設定でないとき）は、開封の演出を流す（タップ、またはなぞって開ける）
  if (fxOn()) {
    packOpening = true;
    hideOverlay();
    try { await runPackOpening(pulls, type); } finally { packOpening = false; }
  }
  showPackSummary(pulls, 1, pulls.gift ? [pulls.gift] : []);
}

// 引いたカードの一覧（初めて手に入れたカードには NEW）
//   packs: 開けたパックの数（まとめて開けたときは2以上）　gifts: 入っていたヒーローのギフト [{ hero, n }]
function showPackSummary(pulls, packs = 1, gifts = []) {
  // 同じカードは1枚にまとめ、レアリティの高い順に並べる
  const merged = [];
  for (const p of pulls) {
    const m = merged.find(x => x.id === p.id);
    if (m) { m.n++; m.isNew = m.isNew || p.isNew; } else merged.push({ id: p.id, n: 1, isNew: p.isNew });
  }
  const rank = id => RARITY_ORDER.indexOf(CARD_DEFS[id].rarity);
  if (packs > 1) merged.sort((x, y) => rank(y.id) - rank(x.id) || Number(y.isNew) - Number(x.isNew));
  const cards = merged.map(p => {
    const c = ownedCard(profile, p.id);
    const tag = `${p.isNew ? 'NEW' : '予備+' + p.n}${p.isNew && p.n > 1 ? `　+${p.n - 1}` : ''}`;
    return cardFaceHtml(c, { cls: 'owned', attrs: `data-id="${c.id}"`, extra: `<span class="card-tag${p.isNew ? '' : ' dup'}">${tag}</span>` });
  }).join('');
  const names = packs > 1
    ? RARITY_ORDER.slice().reverse().map(r => [r, pulls.filter(p => CARD_DEFS[p.id].rarity === r).length]).filter(x => x[1])
      .map(x => `<span class="r-${x[0]}">${RARITIES[x[0]].name}×${x[1]}</span>`).join('　')
    : pulls.map(p => `<span class="r-${CARD_DEFS[p.id].rarity}">${RARITIES[CARD_DEFS[p.id].rarity].name}</span>`).join('・');
  const giftSum = {};
  for (const g of gifts || []) giftSum[g.hero] = (giftSum[g.hero] || 0) + g.n;
  const giftText = Object.keys(giftSum).map(h => `🎀 ${HERO_BY_ID[h].name}のギフト +${giftSum[h]}`).join('　');
  const title = pulls.type ? packType(pulls.type).name : 'カードパック';
  showOverlay(`<div class="result${packs > 1 ? ' detail pack-bulk' : ''}">
    <h2>🎁 ${title}${packs > 1 ? ` ×${packs}` : ''}</h2>
    ${packs > 1 ? `<p>${pulls.length}枚（新しいカード ${merged.filter(p => p.isNew).length}種類）</p>` : ''}
    <div class="deck-grid pack-cards">${cards}</div>
    <p>${names}</p>
    ${giftText ? `<p class="lvup">${giftText}</p>` : ''}
    ${packButtonsHtml()}
    <button class="btn big" data-act="close-detail">とじる</button>
  </div>`);
}

// ---------- デイリークエストとログインボーナス ----------

// 日付が変わっていたらクエストを更新し、ログインボーナスを渡す。もらえたら画面を出す
function checkDaily() {
  if (!isUnlocked(profile, 'daily')) return;
  const fresh = refreshDaily(profile);
  const bonus = claimLogin(profile);
  if (!fresh && !bonus) return;
  saveProfile(profile);
  renderTitle();
  if (bonus) { sfx('gem'); showDaily(bonus); }
}

//   bonus: いま受け取ったログインボーナス（あれば上に知らせる）
//   bulk:  いま「まとめて受け取る」で受け取った内容（あれば一覧で知らせる）
function showDaily(bonus, bulk) {
  const d = profile.daily;
  const got = d.loginCount % LOGIN_REWARDS.length || (d.loginCount ? LOGIN_REWARDS.length : 0); // この周でもらった日数
  const days = LOGIN_REWARDS.map((r, i) => `<div class="login-day${i < got ? ' got' : ''}${bonus && bonus.day === i + 1 ? ' now' : ''}">
    <small>${i + 1}日目</small><span>${rewardText(r)}</span></div>`).join('');
  const quests = d.quests.map((q, i) => {
    const def = QUEST_BY_ID[q.id];
    const done = questDone(q);
    const btn = q.claimed ? '<span class="quest-got">受取済み</span>'
      : done ? `<button class="btn primary small" data-act="quest-claim" data-index="${i}">受け取る</button>`
        : canSwapQuest(profile, i) ? `<button class="btn small" data-act="quest-swap" data-index="${i}">交換</button>` : '';
    return `<div class="quest${done ? ' done' : ''}">
      <div class="quest-main"><b>${def.text}</b><small>報酬：${rewardText(def.reward)}</small>
        <div class="xp"><div class="xp-fill" style="width:${Math.round(100 * q.progress / def.n)}%"></div><span>${q.progress} / ${def.n}</span></div></div>
      ${btn}</div>`;
  }).join('');
  showOverlay(`<div class="result detail daily-panel">
    <h2>デイリークエスト</h2>
    ${bonus ? `<div class="rewards"><span class="lvup">ログインボーナス ${bonus.day}日目</span>　${rewardText(bonus.reward)} を受け取りました</div>` : ''}
    ${bulk ? `<div class="rewards"><span class="lvup">${bulk.count}件の報酬を受け取りました</span><br>${rewardText(bulk.total)}${bulk.hero ? `<br><small>🎀ギフトは「${bulk.hero}」に入りました</small>` : ''}</div>` : ''}
    <div class="tip-sub">今日のクエスト（日付が変わると入れ替わる）</div>
    ${quests}
    <button class="btn primary" data-act="quest-claim-all" ${canClaimAll(profile) ? '' : 'disabled'}>まとめて受け取る${canClaimAll(profile) ? `（${dailyStatus(profile).claimable}件）` : ''}</button>
    ${canClaimAll(profile) ? '' : '<p class="hero-note">受け取れる報酬が2つ以上あるときに押せます。</p>'}
    <p class="hero-note">クエストの交換は1日${DAILY.SWAPS}回まで（残り${Math.max(0, DAILY.SWAPS - d.swaps)}回）。降参した対戦は数えません。</p>
    <div class="tip-sub">ログインボーナス（7日周期。日が空いても続きから）</div>
    <div class="login-days">${days}</div>
    <button class="btn" data-act="close-detail">とじる</button>
  </div>`);
}

// ---------- イベント（特殊ルール戦） ----------

function showEvent() {
  if (refreshEvent(profile)) { saveProfile(profile); renderTitle(); }
  const ev = currentEvent();
  const e = profile.event;
  const elite = cardAt(ev.elite);
  const tiers = EVENT_TIERS.map(t => {
    const reward = t.reward.elite ? { card: ev.elite } : t.reward;
    const got = e.claimed.includes(t.wins);
    return `<div class="tier${got ? ' got' : ''}"><b>${t.wins}勝</b><span>${rewardText(reward)}</span><small>${got ? '受取済み' : ''}</small></div>`;
  }).join('');
  const loan = ev.rule.deckColor && !deckIsColor(activeDeck(profile), ev.rule.deckColor);
  const colorNote = ev.rule.deckColor
    ? `<p class="hero-note">${loan ? `使用中のデッキは${COLORS[ev.rule.deckColor].name}のモンスターだけではないので、貸し出しデッキ（${COLORS[ev.rule.deckColor].name}のランダムなデッキ）で戦います。${COLORS[ev.rule.deckColor].name}だけのデッキを使用中にすれば、自分のデッキで戦えます。` : '使用中のデッキで参加できます。'}</p>` : '';
  const status = e.active ? `連戦中：<b>${e.wins}勝 ${e.losses}敗</b>（${e.wins + e.losses + 1}戦目へ）` : '5連戦に挑戦できます（何度でも。各段階の報酬は週に1回）';
  showOverlay(`<div class="result detail event-panel">
    <h2>${ev.icon} ${ev.name}</h2>
    <p class="boss-note"><b>特殊ルール</b>：${ev.desc}</p>
    <p class="hero-note">週替わりのイベント。あと${eventDaysLeft()}日で次のイベントに変わります。${EVENT_CONFIG.BATTLES}連戦で、勝つほど報酬が増えます。${EVENT_CONFIG.MAX_LOSSES}敗で終了（降参も1敗）。相手は後半ほど最初のクリスタルが多くなります。</p>
    ${colorNote}
    ${activeDeckLineHtml('event')}
    <div class="tip-sub">報酬（今週）</div>
    <div class="tiers">${tiers}</div>
    <div class="tip-sub">今週の Elite カード（作成・分解できない、イベント限定）</div>
    <div class="elite-row">${cardFaceHtml(elite, { attrs: `data-id="${elite.id}"` })}<span>${elite.name}<br><small>${owns(profile, elite.id) ? `所持：Lv${cardLevel(profile, elite.id)}　予備${profile.cards[elite.id].copies}（もう1枚もらうと予備が増える）` : '未所持'}</small></span></div>
    <div class="rewards">${status}</div>
    <button class="btn primary big" data-act="event-go">${e.active ? '次の対戦へ' : '挑戦する'}</button>
    <button class="btn" data-act="close-detail">とじる</button>
  </div>`);
}

// イベントの対戦を始める（連戦の途中でなければ、最初から）
function startEventBattle() {
  if (!isUnlocked(profile, 'event')) return;
  refreshEvent(profile);
  if (!profile.event.active) startEventRun(profile);
  saveProfile(profile);
  startBattle({ type: 'event' });
}

// ---------- ヒーロー ----------

let heroView = null; // ヒーロー画面で見ているヒーロー

function showHeroes(id) {
  heroView = id || heroView || profile.hero.selected;
  const data = profile.hero;
  const list = HEROES.map(h => {
    const open = data.unlocked.includes(h.id);
    const cls = `hero-pick c-${h.color}${h.id === heroView ? ' view' : ''}${h.id === data.selected ? ' on' : ''}${open ? '' : ' locked'}`;
    return `<button class="${cls}" data-act="hero-view" data-hero="${h.id}">
      <span class="hero-face">${heroArt(h)}</span>
      <small>${open ? `Lv${data.levels[h.id]}` : '🔒'}</small>
    </button>`;
  }).join('');
  const h = HERO_BY_ID[heroView];
  const open = data.unlocked.includes(h.id);
  const level = data.levels[h.id] || 1;
  const cost = heroLevelCost(level);
  const gifts = data.gifts[h.id] || 0;
  const skills = h.skills.map((k, i) => {
    const ok = heroSkillUnlocked(profile, h.id, i);
    const on = data.selected === h.id && data.skill === i;
    return `<button class="btn opt-btn${on ? ' on' : ''}" data-act="hero-skill" data-index="${i}" ${ok ? '' : 'disabled'}>
      <b>${k.name}</b>${ok ? '' : `　<small class="why">ヒーローLv${HERO_RULES.SKILL_LEVELS[i]}で解放</small>`}<br><small>${k.desc}</small></button>`;
  }).join('');
  const levelUp = !open ? `<div class="why">ステージ ${h.unlock} のボスを倒すと解放されます</div>`
    : cost === null ? '<div class="own-row">最大レベルです</div>'
      : `<button class="btn primary" data-act="hero-levelup" ${gifts >= cost ? '' : 'disabled'}>レベルアップ（🎀ギフト ${gifts}/${cost}）</button>`;
  showOverlay(`<div class="result detail hero-panel">
    <h2>ヒーロー</h2>
    <div class="hero-list">${list}</div>
    <div class="hero-head c-${h.color}"><b>${h.name}</b><span>${COLORS[h.color].name}・${open ? `Lv${level} / ${HERO_RULES.MAX_LEVEL}　🎀${gifts}` : '未解放'}</span></div>
    <p class="hero-note">対応するカード：${CARD_DEFS[h.card].name}（解放時に1枚もらえる）。このヒーローを使って勝つと、ギフトが${HERO_RULES.GIFT_WIN}個もらえる。</p>
    <div class="opt-box"><div class="tip-sub">ヒーロースキル（1つ選んで戦う）</div>${skills}</div>
    ${levelUp}
    <button class="btn" data-act="close-detail">とじる</button>
  </div>`);
}

// ---------- 設定（演出の速さ・効果音） ----------

function renderMuteButton() {
  $('#btn-mute').innerHTML = FX.mute ? ICON.muted : ICON.sound;
}

function showSettings() {
  const speeds = FX_SPEEDS.map(([v, label]) =>
    `<button class="btn${FX.speed === v ? ' on' : ''}" data-act="speed" data-speed="${v}">${label}</button>`).join('');
  const levels = FX_AUTO_LEVELS.map(([v, label]) =>
    `<button class="btn${FX.autoLevel === v ? ' on' : ''}" data-act="auto-level" data-level="${v}">${label}</button>`).join('');
  showOverlay(`<div class="result">
    <h2>設定</h2>
    <p>演出の速さ</p>
    <div class="tabs settings-row">${speeds}</div>
    <p>オートバトルの強さ</p>
    <div class="tabs settings-row">${levels}</div>
    <p class="settings-note">${FX.autoLevel === 'strong' ? 'つよい：先読みして、一番よい手を選ぶ。理由が対戦ログに残る' : 'ふつう：相手のCPUと同じ考え方'}</p>
    <p>効果音</p>
    <button class="btn big" data-act="mute">${FX.mute ? `${ICON.muted} オフ（押すとオンにする）` : `${ICON.sound} オン（押すとオフにする）`}</button>
    <button class="btn big" data-act="sound-test"${FX.mute ? ' disabled' : ''}>${ICON.sound} 音を鳴らしてみる</button>
    <button class="btn big" data-act="more-guide">📖 攻略本を開く</button>
    <button class="btn big primary" data-act="close-detail">とじる</button>
  </div>`);
}

function toggleMute() {
  FX.mute = !FX.mute;
  fxSaveSettings();
  renderMuteButton();
  sfx('tap');
}

// ---------- 操作 ----------

function openStages() {
  hideOverlay();
  renderStages();
  showScreen('stages');
}

$('#btn-start').addEventListener('click', openStages);
$('#btn-stages-back').addEventListener('click', () => { showScreen('title'); renderTitle(); });
$('#stage-list').addEventListener('click', e => {
  const el = e.target.closest('.stage-cell');
  if (el && stageUnlocked(profile, el.dataset.stage)) showStageInfo(el.dataset.stage);
});
$('#btn-free').addEventListener('click', () => {
  if (isUnlocked(profile, 'free')) beginBattle({ type: 'free' });
});

$('#btn-daily').addEventListener('click', () => { checkDaily(); if (isUnlocked(profile, 'daily')) showDaily(); });
$('#btn-event').addEventListener('click', () => { if (isUnlocked(profile, 'event')) showEvent(); });
$('#btn-hero').addEventListener('click', () => { showHeroes(profile.hero.selected); tabOver = 'btn-hero'; renderTabs(); });
$('#btn-settings').addEventListener('click', showSettings);
$('#btn-settings-title').addEventListener('click', showSettings);
$('#btn-mute').addEventListener('click', toggleMute);

$('#btn-collection').addEventListener('click', () => {
  renderCollection();
  showScreen('collection');
});
$('#btn-col-back').addEventListener('click', () => { showScreen('title'); renderTitle(); });
$('#col-tabs').addEventListener('click', e => {
  const tab = e.target.dataset && e.target.dataset.tab;
  if (!tab) return;
  colTab = tab;
  renderCollection();
});
$('#col-list').addEventListener('click', e => {
  const el = e.target.closest('.card');
  if (el) showCardDetail(el.dataset.id);
});
$('#col-tools').addEventListener('click', e => { if (cardToolsClick('collection', e.target)) renderCollection(); });
$('#col-tools').addEventListener('input', e => {
  if (!e.target.dataset || e.target.dataset.ct !== 'q') return;
  cardTools.collection.view.filter.q = e.target.value;
  const pool = { monster: MONSTER_DEFS, equip: EQUIP_DEFS, flash: FLASH_DEFS }[colTab];
  const shown = renderCollectionList(pool);
  const count = $('#col-tools').querySelector && $('#col-tools').querySelector('[data-ct-count]');
  if (count) count.textContent = cardToolsCount(shown, pool.length, cardFilterCount(cardTools.collection.view.filter));
});
$('#btn-pack').addEventListener('click', openPackTab);
// ホーム画面の、新しいボタン
$('#btn-battle').addEventListener('click', () => { const st = nextStageToPlay(); if (st) showStageInfo(st.id); else openStages(); });
$('#btn-home-deck').addEventListener('click', () => showDeckSwitch(null));
$('#btn-login').addEventListener('click', () => { checkDaily(); if (isUnlocked(profile, 'daily')) showDaily(); });
$('#btn-pack-top').addEventListener('click', () => openPackTab());
$('#btn-more').addEventListener('click', showMore);
$('#tab-home').addEventListener('click', () => { hideOverlay(); showScreen('title'); renderTitle(); });
// パックのタブ：開けられるパックがなければ、その旨を知らせる
function openPackTab() {
  packTab = totalPacks(profile) > 0 ? 'own' : 'shop';
  choosePack();
  tabOver = 'btn-pack'; renderTabs();
}

$('#overlay').addEventListener('click', e => {
  const act = e.target.closest && e.target.closest('[data-act]');
  const name = act && act.dataset.act;
  if (name === 'close-detail') { detailId = null; hideOverlay(); }
  if (name === 'more-rules') showRules();
  if (name === 'more-guide') openGuide();
  if (name === 'more-stages') openStages();
  if (name === 'more-settings') showSettings();
  if (name === 'more-reset') confirmReset();
  if (name === 'stages') openStages();
  if (name === 'quest-claim-all') {
    const bulk = claimAllQuests(profile);
    if (bulk) { sfx('win'); saveAndRefresh(); showDaily(null, bulk); }
  }
  if (name === 'quest-claim' && claimQuest(profile, Number(act.dataset.index))) { sfx('gem'); saveAndRefresh(); showDaily(); }
  if (name === 'quest-swap' && swapQuest(profile, Number(act.dataset.index))) { sfx('equip'); saveAndRefresh(); showDaily(); }
  if (name === 'event') { hideOverlay(); showScreen('title'); renderTitle(); showEvent(); }
  if (name === 'event-go') beginBattle({ type: 'event' });
  if (name === 'hero-view') showHeroes(act.dataset.hero);
  if (name === 'hero-skill' && selectHero(profile, heroView, Number(act.dataset.index))) { sfx('equip'); saveAndRefresh(); showHeroes(); }
  if (name === 'hero-levelup') {
    const up = levelUpHero(profile, heroView);
    if (up) { sfx(up.skill ? 'win' : 'gem'); saveAndRefresh(); showHeroes(); }
  }
  if (name === 'speed') {
    FX.speed = act.dataset.speed === 'skip' ? 'skip' : Number(act.dataset.speed);
    fxSaveSettings();
    showSettings();
    renderAuto(); // 対戦画面の速度ボタンの表示も合わせる
  }
  if (name === 'mute') { toggleMute(); showSettings(); }
  if (name === 'auto-level') { FX.autoLevel = act.dataset.level === 'normal' ? 'normal' : 'strong'; fxSaveSettings(); showSettings(); }
  if (name === 'sound-test') sfx('win');
  if (name === 'stage-go' && stageUnlocked(profile, act.dataset.stage)) {
    beginBattle({ type: 'stage', stage: STAGE_BY_ID[act.dataset.stage] }); // 使用中のデッキで、すぐ対戦へ（deckui.js）
  }
  if (name === 'pack-again' || name === 'pack-open') showPack(act.dataset.type || lastPackType);
  if (name === 'pack-bulk') showPackBulk(act.dataset.type || lastPackType);
  if (name === 'pack-all') showPackBulk(null);
  if (name === 'pack-tab') { packTab = act.dataset.tab === 'shop' ? 'shop' : 'own'; choosePack(); }
  if (name === 'pack-back') choosePack();
  if (name === 'pack-info') showPackInfo(act.dataset.type);
  if (name === 'pack-buy' && buyPack(profile, act.dataset.type)) { sfx('gem'); saveAndRefresh(); choosePack(); }
  if (name === 'reset') {
    profile = resetProfile();
    hideOverlay();
    renderTitle();
  }
  if (name === 'upgrade' && upgradeCard(profile, detailId)) { saveAndRefresh(); showCardDetail(detailId); }
  if (name === 'option') {
    const index = act.dataset.index === 'none' ? null : Number(act.dataset.index);
    if (setOption(profile, detailId, index)) { sfx('equip'); saveAndRefresh(); showCardDetail(detailId); }
  }
  if (name === 'craft' && craftCard(profile, detailId)) { saveAndRefresh(); showCardDetail(detailId); }
  if (name === 'dismantle') {
    // 最後の1枚はカードそのものがなくなるので、確認してから
    if (canDismantle(profile, detailId).last) {
      const c = ownedCard(profile, detailId);
      showOverlay(`<div class="result">
        <div class="result-art c-${c.color || 'none'}">${cardArtHtml(c)}</div>
        <p>${c.name}（Lv${c.level}）の最後の1枚を分解します。カードはなくなり、レベルも失われます。よろしいですか？</p>
        <button class="btn danger big" data-act="dismantle-last">分解する（+${GROWTH.DISMANTLE[c.rarity]}🔷）</button>
        <button class="btn big" data-act="back-detail">やめる</button>
      </div>`);
    } else if (dismantleCard(profile, detailId)) { saveAndRefresh(); showCardDetail(detailId); }
  }
  if (name === 'dismantle-last' && dismantleCard(profile, detailId)) { saveAndRefresh(); showCardDetail(detailId); }
  if (name === 'back-detail') showCardDetail(detailId);
});

// 起動時の処理。すべてのスクリプトを読み込み終えてから呼ぶ（タイトルの表示は、あとで読み込む dungeonui.js・puzzleui.js の関数も使うため）。
// index.html のいちばん最後のスクリプト（puzzleui.js）の末尾から呼ばれる
function bootTitle() {
  renderTitle();
  renderMuteButton();
  // 日付が変わっていればクエストを更新し、ログインボーナスを渡す
  checkDaily();
}
