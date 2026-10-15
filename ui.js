// ============================================================
// 画面まわり（描画・タップ操作・アニメーション・デッキ編集）
// ============================================================

const $ = sel => document.querySelector(sel);
let gamePaused = false;   // ログや辞典を開いている間は true（対戦の進行が止まる）
// 演出速度の設定で伸び縮みする。止まっている間は、再開されるまで待つ
const sleep = async ms => {
  await new Promise(r => setTimeout(r, fxMs(ms)));
  while (gamePaused) await new Promise(r => setTimeout(r, 120));
};
const SLOT_ORDER = [1, 0, 2]; // 画面の並び：左=スロット2、中央=スロット1、右=スロット3

let state = null;
let selectedUid = null;   // 選択中の手札
let inspectUid = null;    // 詳細表示中の場のモンスター
let busy = true;          // 演出中・CPUの番は操作不可
const LOW_MONSTERS = 2;   // 残りモンスターがこの数以下になったら目立たせる
let message = '';
let battleLog = [];       // この対戦のログ（メッセージ欄をタップで一覧表示）

// ---------- 表示用テキスト ----------

// カード上に出すスキルの短い表示（アイコン＋短い説明）
function skillShort(k) { return `${SKILLS[k.id].icon}${SKILLS[k.id].short(k.x)}`; }
function skillsShort(card) { return (card.skills || []).map(skillShort).join(' '); }

function itemText(item) {
  if (item.kind === 'flash') return skillsShort(item);
  const parts = [];
  for (const t in (item.atk || {})) parts.push(`${ATTACK_TYPES[t].icon}+${item.atk[t]}`);
  if (item.armor) parts.push(`🛡️+${item.armor}`);
  if (item.hp) parts.push(`❤️+${item.hp}`);
  return parts.concat((item.skills || []).map(skillShort)).join(' ');
}

function colorName(color) { return color ? COLORS[color].name : '無色'; }

function cardDetail(card) {
  const skills = (card.skills || []).map(k => `${SKILLS[k.id].icon}${skillLabel(k)}`).join(' ');
  if (card.kind === 'monster') {
    const t = ATTACK_TYPES[card.type];
    return `<b>${card.name}</b>（${colorName(card.color)}）💎${card.cost}　${t.icon}${t.name}${card.atk}　❤️${card.hp}　${skills}`;
  }
  if (card.kind === 'flash') {
    const text = card.skills.map(k => `${SKILLS[k.id].icon}${skillLabel(k)}：${SKILLS[k.id].desc(k.x)}`).join(' / ');
    return `<b>${card.name}</b>（フラッシュ）💎${card.cost}　${text}`;
  }
  const who = card.color ? `${colorName(card.color)}のモンスター専用` : '誰でも装備可';
  return `<b>${card.name}</b>（装備・${colorName(card.color)}）💎${card.cost}　${itemText(card)}　<small>${who}</small>`;
}

// 状態異常・強化のバッジ一覧 [{ key, n }]
function statusList(mon) {
  const list = [];
  const num = v => (v === true ? '' : v);
  for (const key of ['inspire', 'shoot', 'rearguard', 'antimagic', 'massbombard', 'trickery']) if (mon.buff[key]) list.push({ key, n: num(mon.buff[key]), good: true });
  if (mon.buff.dive) list.push({ key: 'dive', n: mon.buff.dive, good: true });
  if (mon.buff.aim) list.push({ key: 'aim', n: mon.buff.aim, good: true });
  if (mon.status.fog) list.push({ key: 'fog', n: '', good: true });
  if (mon.phantomPending) list.push({ key: 'phantom', n: '', good: true });
  // 一時的に得たスキル（Poison Halo・Healing Shield など）
  for (const id in mon.buff.grant || {}) list.push({ key: id, n: SKILLS[id].noX ? '' : mon.buff.grant[id], good: true, grant: true });
  for (const key of DEBUFFS) if (mon.status[key]) list.push({ key, n: num(mon.status[key]) });
  return list;
}

// 状態・強化の表示情報（一時的に得たスキルは、スキルの名前とアイコンで出す）
function statusInfo(x) {
  if (!x.grant) return STATUS_INFO[x.key];
  return { name: SKILLS[x.key].name, icon: SKILLS[x.key].icon, text: () => '一時的に得たスキル（次の自分のターン開始まで）' };
}

function monDetail(mon, slot) {
  const atks = getAttacks(mon).map(a => `${ATTACK_TYPES[a.type].icon}${a.atk}`).join(' ');
  const armor = getArmor(mon);
  const idle = canAttackFrom(mon, slot) ? '' : '　<small>💤このスロットでは攻撃できない</small>';
  const item = mon.item ? `　装備：${mon.item.name}` : '';
  const skills = (mon.card.skills || []).map(k => `${SKILLS[k.id].icon}${skillLabel(k)}`).join(' ');
  const status = statusList(mon).map(x => `${statusInfo(x).icon}${statusInfo(x).name}${x.n}`).join(' ');
  return `<b>${nm(mon)}</b>（${colorName(mon.card.color)}）${atks}　❤️${mon.hp}/${mon.maxHp}${armor ? `　🛡️${armor}` : ''}${item}${skills ? `　${skills}` : ''}${status ? `　<span class="warn">${status}</span>` : ''}${idle}`;
}

// ---------- 画面切り替え ----------

// 画面ごとの、光らせるタブ（ホーム・デッキ・コレクション。それ以外の画面ではどれも光らない）
const TAB_OF_SCREEN = { title: 'tab-home', decks: 'btn-deck', deck: 'btn-deck', collection: 'btn-collection' };
let currentScreen = 'title';
function showScreen(name) {
  currentScreen = name;
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === 'screen-' + name));
  $('#app').classList.toggle('in-battle', name === 'battle'); // 対戦中はタブバーを隠す
  renderTabs();
  bgmRefresh(); // 画面に合わせた曲へ（audio.js）
}
// 今いるタブを光らせる。over: パック・ヒーローの小窓を開いているあいだ、そのタブを光らせる
let tabOver = null;
function renderTabs() {
  const on = tabOver || TAB_OF_SCREEN[currentScreen];
  for (const id of ['tab-home', 'btn-deck', 'btn-collection', 'btn-pack', 'btn-hero']) $('#' + id).classList.toggle('on', id === on);
}

function showOverlay(html) {
  const el = $('#overlay');
  el.innerHTML = html;
  el.classList.remove('hidden');
}

function hideOverlay() { $('#overlay').classList.add('hidden'); if (tabOver) { tabOver = null; renderTabs(); } bgmMomentEnd(); }

// 大きな文字の演出。ターンの切り替えと攻撃フェーズは英字の見出しつき
const BANNER_STYLE = {
  'あなたのターン': { main: 'YOUR TURN', cls: 'mine' },
  '相手のターン': { main: 'ENEMY TURN', cls: 'foe' },
  '攻撃フェーズ': { main: 'BATTLE!', cls: 'fight' },
};

async function banner(text, small) {
  const el = $('#banner');
  const style = small ? null : BANNER_STYLE[text];
  el.className = small ? 'small' : style ? `big ${style.cls}` : '';
  el.innerHTML = style ? `<div class="bn-bar"></div><div class="bn-main">${style.main}</div><div class="bn-sub">${text}</div>` : text;
  el.classList.add('show');
  if (style) sfx('turn');
  await sleep(small ? 1500 : 900);
  el.classList.remove('show');
  await sleep(150);
}

// ---------- バトル画面の描画 ----------

function selectedCard() {
  return state.players[0].hand.find(h => h.uid === selectedUid) || null;
}

// タップで選択中の自分の場のモンスターのスロット（いなければ -1）。生贄の対象になる
function selectedFieldSlot() {
  return state.players[0].slots.findIndex(m => m && m.uid === inspectUid);
}

// 選択中のカードの対象にできるスロット。[自分の場, 相手の場]
function targetSlots() {
  const [p, foe] = state.players;
  const h = selectedCard();
  if (busy || !h || costOf(p, h) > p.crystals) return [[], []];
  const all = [0, 1, 2];
  // モンスターは満員でなければどのスロットにも出せる（押し出し・前詰めあり）
  if (h.card.kind === 'monster') return [placementSlot(p, 0) < 0 ? [] : all, []];
  if (h.card.kind === 'equip') return [all.filter(s => p.slots[s] && canEquip(h.card, p.slots[s]) && costOf(p, h, p.slots[s]) <= p.crystals), []];
  if (!flashUsable(p, h.card)) return [[], []]; // 色付きのフラッシュは、その色のモンスターが場に必要
  const mode = flashTarget(h.card);
  // Corrosion は装備を付けた相手だけが対象
  const valid = m => m && (h.card.skills[0].id !== 'corrosion' || m.item);
  // Phantom は場が満員だと使えず、同じ味方に2回は使えない
  const mine = m => m && (h.card.skills[0].id !== 'phantom' || (placementSlot(p, 0) >= 0 && !m.phantomPending));
  return [mode === 'ally' ? all.filter(s => mine(p.slots[s])) : [], mode === 'enemy' ? all.filter(s => valid(foe.slots[s])) : []];
}

// 対象を選ばないフラッシュを選択中か（「使う」ボタンで発動）
function selectedNoTargetFlash() {
  const h = selectedCard();
  return h && h.card.kind === 'flash' && flashTarget(h.card) === 'none' ? h : null;
}

// HPバー。ダメージを受けた直後は、減った分が一瞬白く残ってから縮む（どれだけ減ったかが分かる）
const HP_LAG_MS = 700;
const hpSeen = {}; // uid → { pct: 最後に描いたHPの割合, lag: { from, t } }
function hpBarInner(mon) {
  const pct = Math.max(0, Math.min(100, Math.round(100 * mon.hp / Math.max(1, mon.maxHp))));
  const seen = hpSeen[mon.uid] || (hpSeen[mon.uid] = { pct, lag: null });
  const now = Date.now();
  if (seen.pct > pct) seen.lag = { from: seen.pct, t: now };
  seen.pct = pct;
  let lag = '';
  if (seen.lag && now - seen.lag.t < fxMs(HP_LAG_MS)) {
    lag = `<i class="hp-lag" style="--from:${seen.lag.from}%;--to:${pct}%;animation-delay:-${now - seen.lag.t}ms"></i>`;
  }
  return `${lag}<i class="hp-fill${pct <= 30 ? ' low' : ''}" style="width:${pct}%"></i>`;
}
// 攻撃が当たった瞬間に、そのモンスターのHPバーだけ描き直す
function updateHpBar(mon) {
  const el = monEl(mon.uid);
  const bar = el && el.querySelector && el.querySelector('.hpbar');
  if (bar) bar.innerHTML = hpBarInner(mon);
}

function monHtml(mon, slot) {
  const atks = getAttacks(mon);
  const usable = a => canUseType(mon, a.type, slot) && !(a.type === 'magic' && mon.status.silence) && a.atk > 0;
  const chips = atks.map(a =>
    `<span class="chip${usable(a) ? '' : ' off'}${a.atk > a.base && a.base ? ' up' : a.atk < a.base ? ' down' : ''}">${typeIcon(a.type)}${a.atk}</span>`).join('');
  const idle = mon.status.entangle || !atks.some(usable);
  const armor = getArmor(mon);
  // 数字（攻撃力・HP・アーマー）は、カードの下部に大きくまとめる。HPは一番大きく、最大なら白・減っていれば赤。
  // 攻撃力は、上がっていれば緑・下がっていれば赤（style.css の「場の数字」）。
  // 絵の左端にスキル（本体＋装備）、右端に状態異常・強化のアイコンを縦に並べる
  const skills = [...(mon.card.skills || []), ...((mon.item && mon.item.skills) || [])]
    .map(k => `<span${k.opt ? ' class="opt"' : ''}>${SKILLS[k.id].icon}</span>`).join('');
  const status = statusList(mon)
    .map(x => `<span class="${x.good ? 'good' : 'bad'}">${statusInfo(x).icon}${x.n}</span>`).join('');
  const c = mon.card;
  return `<div class="mon c-${c.color} fr-${c.rarity || 'common'}${idle ? ' idle' : ''}${mon.isPhantom ? ' phantom' : ''}${mon.status.entangle ? ' entangled' : ''}${mon.uid === inspectUid ? ' inspected' : ''}" data-uid="${mon.uid}">
    <div class="mon-in">
      <div class="mon-art">${cardArtHtml(c)}${idle ? '<span class="zzz">Zz</span>' : ''}</div>
      <div class="mon-skills">${skills}</div>
      <div class="mon-status">${status}</div>
      <div class="mon-name">${nm(mon)}</div>
      <div class="mon-atks">${chips}${mon.item ? `<span class="mon-item">${itemArt(mon.item)}</span>` : ''}</div>
      <div class="mon-foot${armor && String(mon.hp).length + String(armor).length >= 3 ? ' tight' : ''}"><span class="hp ${mon.hp >= mon.maxHp ? 'full' : mon.hp * 10 <= mon.maxHp * 3 ? 'low' : 'hurt'}">${ICON.heart}${mon.hp}</span>${armor ? `<span class="ar">${ICON.shield}${armor}</span>` : ''}</div>
      <div class="hpbar">${hpBarInner(mon)}</div>
    </div>
  </div>`;
}

function renderField(pi) {
  const p = state.players[pi];
  const targets = targetSlots()[pi];
  const h = pi === 0 ? selectedCard() : null;
  const summoning = h && h.card.kind === 'monster';
  $('#field-' + pi).innerHTML = SLOT_ORDER.map(s => {
    const mon = p.slots[s];
    const cls = `slot ${s === 0 ? 'front' : 'back'}${targets.includes(s) ? ' target' : ''}`;
    const hint = SLOT_TYPES[s].map(typeIcon).join('');
    // 召喚先の印：押し出しが起きるスロットと、前に詰めて置かれるスロット
    let mark = '';
    if (summoning && targets.includes(s)) {
      if (mon) mark = `<span class="push-mark">${s === 0 ? '◀ 左へ押し出し' : '右へ押し出し ▶'}</span>`;
      else if (placementSlot(p, s) !== s) mark = `<span class="push-mark fill">スロット${placementSlot(p, s) + 1}に詰める</span>`;
    }
    return `<div class="${cls}" data-slot="${s}">
      <span class="slot-tag">${s + 1}</span>
      ${mon ? monHtml(mon, s) : `<span class="slot-hint">${hint}</span>`}${mark}
    </div>`;
  }).join('');
}

function renderInfo(pi) {
  const p = state.players[pi];
  const active = state.phase !== 'over' && state.phase !== 'coin' && state.current === pi;
  const left = monstersLeft(p); // 場＋手札＋山札のモンスター数
  $('#info-' + pi).className = `pinfo ${pi === 0 ? 'me' : 'foe'}${active ? ' active' : ''}${p.hero ? ' has-hero' : ''}`;
  $('#info-' + pi).innerHTML =
    `${p.hero ? `<span class="hero-ico" title="${HERO_SKILL_INFO[p.hero.skill].name}">${heroArt(p.hero)}</span>` : ''}<span class="pname">${p.name}</span><span class="stat">${ICON.hand}${p.hand.length}</span><span class="stat">${ICON.deck}${p.deck.length}</span>`
    + `<span class="left${left <= LOW_MONSTERS ? ' low' : ''}">${ICON.monster}残り ${left}</span><span class="crystal">${ICON.gem}${p.crystals}</span>`;
}

// ---------- カードの見た目 ----------

const typeIcon = type => ICON[type] || '';

// カード下部のステータス（アイコン＋数字）
function cardStatsHtml(c) {
  if (c.kind === 'monster') {
    return `<span class="st">${typeIcon(c.type)}${c.atk}</span><span class="st">${ICON.heart}${c.hp}</span>${c.armor ? `<span class="st">${ICON.shield}${c.armor}</span>` : ''}`;
  }
  if (c.kind === 'flash') return `<span class="st text">${skillsShort(c)}</span>`;
  const parts = [];
  for (const t in (c.atk || {})) parts.push(`<span class="st">${typeIcon(t)}+${c.atk[t]}</span>`);
  if (c.armor) parts.push(`<span class="st">${ICON.shield}+${c.armor}</span>`);
  if (c.hp) parts.push(`<span class="st">${ICON.heart}+${c.hp}</span>`);
  return parts.join('');
}

// スキルの小さなアイコン（数値つき）
function skillIconsHtml(skills) {
  // 選択スキル（opt）は金色の縁で区別する
  return (skills || []).map(k => `<span class="sk${k.opt ? ' opt' : ''}">${SKILLS[k.id].icon}${SKILLS[k.id].noX ? '' : `<b>${k.x}</b>`}</span>`).join('');
}

// カード1枚。枠はレアリティ（銅・銀・金・虹）、背景と宝石は色、形は種類（モンスター・装備・フラッシュ）で変わる
//   cls: 追加クラス / attrs: data-uid などの属性 / extra: 札やバッジなど、枠の外に重ねるHTML
function cardFaceHtml(c, { cls = '', attrs = '', extra = '', cost = c.cost } = {}) {
  const flashSkills = c.kind === 'flash' ? '' : skillIconsHtml(c.skills);
  return `<button class="card k-${c.kind} c-${c.color || 'none'} fr-${c.rarity || 'common'}${c.elite ? ' elite' : ''} ${cls}" ${attrs}>
    <span class="card-in">
      <span class="card-art">${cardArtHtml(c)}</span>
      <span class="card-name">${c.name}</span>
      <span class="card-stat">${cardStatsHtml(c)}</span>
      <span class="card-skills">${flashSkills}</span>
    </span>
    <span class="card-cost">${cost}</span>
    ${c.level > 1 ? `<span class="card-lv">Lv${c.level}</span>` : ''}
    ${extra}
  </button>`;
}

// レベル別ステータス表（ツールチップ用）。前のレベルから変わったところは色を付ける
function levelTableHtml(card) {
  const def = CARD_DEFS[card.id];
  if (!def || def.levels.length < 2) return '';
  const cell = (now, old, text) => (old != null && now !== old ? `<span class="up">${text}</span>` : text);
  const rows = def.levels.map((_, i) => {
    const c = cardAt(card.id, i + 1);
    const prev = i ? cardAt(card.id, i) : null;
    let stat;
    if (c.kind === 'monster') {
      const oldSkill = k => prev && (prev.skills.find(p => p.id === k.id) || {});
      const skills = c.skills.map(k => {
        const text = `${SKILLS[k.id].icon}${SKILLS[k.id].noX ? '' : k.x}`;
        const o = oldSkill(k);
        return prev && (o.id !== k.id || o.x !== k.x) ? `<span class="up">${text}</span>` : text;
      }).join(' ');
      stat = `${cell(c.hp, prev && prev.hp, `❤️${c.hp}`)} ${cell(c.atk, prev && prev.atk, `${ATTACK_TYPES[c.type].icon}${c.atk}`)}`
        + `${c.armor ? ` ${cell(c.armor, prev && prev.armor, `🛡️${c.armor}`)}` : ''} ${skills}`;
    } else {
      const text = `${itemText(c)}${c.cost !== def.cost ? ` 💎${c.cost}` : ''}`;
      stat = prev && text !== `${itemText(prev)}${prev.cost !== def.cost ? ` 💎${prev.cost}` : ''}` ? `<span class="up">${text}</span>` : text;
    }
    return `<li class="${c.level === card.level ? 'cur' : ''}"><b>Lv${c.level}</b> ${stat}</li>`;
  });
  return `<div class="tip-sub">レベル別ステータス</div><ul class="tip-levels">${rows.join('')}</ul>`;
}

function handCardHtml(h, p) {
  const cost = costOf(p, h); // Equilibrium や、そのカードにかかった効果で、コストが変わっていることがある
  const blocked = h.card.kind === 'flash' && !flashUsable(p, h.card);
  const cls = `${h.uid === selectedUid ? 'selected' : ''}${cost > p.crystals || blocked ? ' pricey' : ''}${cost < h.card.cost ? ' cheaper' : cost > h.card.cost ? ' dearer' : ''}`;
  return cardFaceHtml(h.card, { cls, attrs: `data-uid="${h.uid}"`, cost });
}

function renderDetail() {
  const p = state.players[0];
  const h = selectedCard();
  let html = '<span class="dim">カードをタップして選択。長押し（PCはカーソルを合わせる）で詳しい説明。</span>';
  if (h) {
    let hint;
    const [mine, foes] = targetSlots();
    if (costOf(p, h) > p.crystals) hint = '💎が足りません（生贄でクリスタルにできます）';
    else if (h.card.junk) hint = 'このカードは使えません（生贄にはできます）';
    else if (h.card.kind === 'flash' && !flashUsable(p, h.card)) hint = `${colorName(h.card.color)}のモンスターが自分の場にいるときだけ使えます`;
    else if (selectedNoTargetFlash()) hint = '「使う」ボタンで発動';
    else if (!mine.length && !foes.length) {
      hint = { monster: 'モンスターが3体いっぱいで出せません', equip: '装備できるモンスターがいません', flash: '対象にできるモンスターがいません' }[h.card.kind];
    } else {
      hint = {
        monster: 'スロットをタップして召喚（モンスターがいる場所に出すと後ろへ押し出す）',
        equip: '光っているモンスターをタップして装備（装備済みなら古い装備は捨て札）',
        flash: '光っているモンスターをタップして発動',
      }[h.card.kind];
    }
    html = `${cardDetail(h.card)}<br><span class="hint">${hint}</span>`;
  } else if (inspectUid) {
    for (const pl of state.players) {
      pl.slots.forEach((m, s) => { if (m && m.uid === inspectUid) html = monDetail(m, s); });
    }
    if (!busy && selectedFieldSlot() >= 0 && !p.sacrificed) {
      html += `<br><span class="hint">「生贄」でこのモンスターを+${sacGain(CONFIG.SACRIFICE_MONSTER)}💎に換えられます（装備も失われる）</span>`;
    }
  }
  if (!busy && state.current === 0 && p.slots.every(m => !m)) {
    html = `<span class="warn">⚠️ 場が空のままターンを終えると、手札か山札からランダムに1枚捨てられます</span><br>${html}`;
  }
  $('#detail').innerHTML = html;
}

// 場を描き直し、位置が変わったモンスターはスライド、新しく出たモンスターはポップさせる
function renderFields() {
  const before = new Map();
  document.querySelectorAll('.mon').forEach(el => before.set(el.dataset.uid, el.getBoundingClientRect()));
  renderField(0);
  renderField(1);
  document.querySelectorAll('.mon').forEach(el => {
    if (!el.animate) return;
    const old = before.get(el.dataset.uid);
    if (!old) {
      el.animate([{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
      return;
    }
    const now = el.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (dx || dy) {
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'ease-in-out' });
    }
  });
}

// 特殊ルール：生贄でもらえるクリスタルの倍率
const sacMult = () => (state && state.rules.sacrificeMult) || 1;
// 生贄でもらえるクリスタル（特殊ルールの倍率と、お守りを含む）。pi: 生贄にする側
const sacGain = (base, pi = 0) => (state ? sacrificeCrystals(state.players[pi], base) : base);

// 消耗ダメージの予告・バッジ（上部バー）
function attritionBadge() {
  const dmg = attritionDamage(state.turn, state);
  if (dmg) return `<span class="attr-badge">🔥 消耗ダメージ：${dmg}</span>`;
  const until = attritionStart(state) - state.turn;
  if (until <= CONFIG.ATTRITION_NOTICE) return `<span class="attr-warn">あと${until}ターンで消耗ダメージが始まります</span>`;
  return '';
}

// ツールチップ用：次のターンに場のモンスターが受ける消耗ダメージ
function attritionTipRow() {
  const next = attritionDamage(state.turn + 1, state);
  if (next) return `<div class="tip-row down">🔥 次のターンの消耗ダメージ：<b>${next}</b>（場にいるモンスター全員。アーマー無視）</div>`;
  const until = attritionStart(state) - state.turn;
  if (until <= CONFIG.ATTRITION_NOTICE) return `<div class="tip-row down">🔥 あと${until}ターンで消耗ダメージが始まります</div>`;
  return '';
}

// 地形の表示（アイコン・名前・効果）
function terrainHtml(t) {
  return t ? `<b>${t.icon} ${t.name}</b><span>${t.desc}</span>` : '';
}

// ターン開始時の地形の効果の演出（火山の熱・世界樹の回復・落雷）
async function playTerrain() {
  const events = state.terrainEvents;
  const t = state.terrain;
  const fallen = events.filter(e => e.killed).map(e => nm(e.target));
  const what = { burn: e => `🔥-${e.dmg}`, storm: e => `⚡-${e.dmg}`, regen: e => (e.heal ? `+${e.heal}` : '☣️↓') };
  const text = events[0].kind === 'burn' ? `赤以外のモンスターに${events[0].dmg}ダメージ`
    : events[0].kind === 'storm' ? `${nm(events[0].target)}に落雷（${events[0].dmg}ダメージ）` : 'モンスターを回復';
  say(`${t.icon} ${t.name}：${text}${fallen.length ? `　${fallen.join('・')}が倒れた` : ''}`);
  $('#message').textContent = message;
  $('#terrain-bar').classList.remove('pulse');
  void $('#terrain-bar').offsetWidth;
  $('#terrain-bar').classList.add('pulse');
  sfx(events[0].kind === 'regen' ? 'heal' : events[0].kind === 'storm' ? 'magic' : 'burn');
  for (const ev of events) {
    const el = monEl(ev.target.uid);
    if (!el) continue;
    if (ev.kind === 'regen') { fxHeal(el); floatText(el, what.regen(ev), 'heal'); }
    else { el.classList.add('hit'); floatText(el, what[ev.kind](ev), 'burn'); }
  }
  await sleep(650);
  let anyDead = false;
  for (const ev of events) {
    const el = ev.killed && monEl(ev.target.uid);
    if (el) { fxDeath(el); anyDead = true; }
  }
  if (anyDead) await sleep(450);
  render();
}

// ターン開始時の消耗ダメージの演出（全員同時）
async function playAttrition() {
  const events = state.attrition;
  const dmg = events[0].dmg;
  const fallen = events.filter(e => e.killed).map(e => nm(e.target));
  say(`🔥 消耗ダメージ ${dmg}：場のモンスター全員に${dmg}ダメージ${fallen.length ? `　${fallen.join('・')}が倒れた` : ''}`);
  $('#message').textContent = message;
  fxAttrition(); // 画面の端が赤く燃える
  for (const ev of events) {
    const el = monEl(ev.target.uid);
    if (!el) continue;
    el.classList.add('hit');
    floatText(el, `🔥-${ev.dmg}`, 'burn');
  }
  await sleep(650);
  let anyDead = false;
  for (const ev of events) {
    const el = ev.killed && monEl(ev.target.uid);
    if (el) { fxDeath(el); anyDead = true; }
  }
  if (anyDead) await sleep(450);
  render();
  await sleep(250);
}

// ---------- 手札の並べ方 ----------

const HAND_GAP = 6;          // 収まるときのカードの間隔
const HAND_MIN_VISIBLE = 40; // 重ねるときでも、1枚あたり最低これだけは見せる（タップできる幅）

// 手札が多いときはカードを重ねて、なるべく画面内に収める。それでも入りきらないぶんは横スクロール
function layoutHand() {
  const hand = $('#hand');
  const n = state.players[0].hand.length;
  $('#hand-count').textContent = `手札 ${n}枚`;
  const first = hand.querySelector && hand.querySelector('.card');
  if (first && hand.clientWidth) {
    const w = first.offsetWidth;
    const style = getComputedStyle(hand);
    const room = hand.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const step = n > 1 ? Math.max(HAND_MIN_VISIBLE, Math.min(w + HAND_GAP, (room - w) / (n - 1))) : w;
    hand.style.setProperty('--hand-gap', `${Math.floor(step - w)}px`);
  }
  updateHandFade();
}

// スクロールできる方向の端に影を出す
function updateHandFade() {
  const hand = $('#hand');
  const wrap = $('#hand-wrap');
  wrap.classList.toggle('more-left', hand.scrollLeft > 2);
  wrap.classList.toggle('more-right', hand.scrollLeft + hand.clientWidth < hand.scrollWidth - 2);
}

function render() {
  // 手札のカードを選んでいる間は、ツールチップの中も押せないようにする（下のモンスターを確実に押せるように）
  $('#tip').classList.toggle('pick', selectedUid !== null);
  const p = state.players[0];
  const stageTag = battleMode.type === 'stage' ? `<span class="stage-tag">${battleMode.stage.id}</span>`
    : battleMode.type === 'event' ? `<span class="stage-tag event">EVENT ${battleMode.n}/${EVENT_CONFIG.BATTLES}</span>` : '';
  $('#turn-label').innerHTML = `${stageTag}${state.turn ? `<span class="turn-plate">ターン <b>${state.turn}</b></span>${attritionBadge()}` : ''}`;
  renderInfo(0);
  renderInfo(1);
  renderFields();
  $('#message').textContent = message;
  $('#hand').innerHTML = p.hand.map(h => handCardHtml(h, p)).join('');
  $('#hand').classList.toggle('locked', busy);
  bgmBattleMood(); // 戦況に合わせて BGM のパートを足す（audio.js）
  layoutHand();
  renderDetail();

  const h = selectedCard();
  const fieldSlot = selectedFieldSlot();
  const gain = h ? sacGain(sacrificeGain(h.card)) : fieldSlot >= 0 ? sacGain(CONFIG.SACRIFICE_MONSTER) : 0;
  const sac = $('#btn-sacrifice');
  sac.textContent = p.sacrificed ? '生贄（使用済み）' : gain ? `生贄（+${gain}💎）` : '生贄';
  sac.disabled = busy || !gain || p.sacrificed;
  const use = $('#btn-use');
  use.classList.toggle('hidden', !selectedNoTargetFlash());
  use.disabled = busy || !h || costOf(p, h) > p.crystals || !flashUsable(p, h.card);
  $('#btn-end').disabled = busy;
  $('#btn-surrender').disabled = busy;
  refreshTip();
}

function foeName() { return state.players[1].name; }

function say(text) {
  message = text;
  if (text) battleLog.push(text);
}

// 攻撃の種類と理由（本体の攻撃か、武器やスキルによる追加攻撃か）
function attackLabel(ev) {
  const t = ATTACK_TYPES[ev.type];
  if (ev.source === 'weapon') return `装備の攻撃（${t.icon}${t.name}）`;
  if (ev.source === 'batter') return `Batter 追加攻撃（${t.icon}${t.name}）`;
  if (ev.source === 'craze') return `Craze 追加攻撃（${t.icon}${t.name}）`;
  return `${t.icon}${t.name}`;
}

// 名前（同じカードが2体いるときは ①② を付けて区別する）。場のモンスターにも、手札の1枚にも使える
function nm(x) { return x.card.name + (COPY_MARK[x.copy] || ''); }

// ---------- ゲーム進行 ----------

// いまの対戦の種類。{ type: 'stage', stage } または { type: 'free' }
let battleMode = { type: 'free' };

// 対戦を始める。mode を省略すると、前回と同じ相手ともう一度
async function startBattle(mode) {
  if (mode && mode.type) battleMode = mode;
  const stage = battleMode.type === 'stage' ? battleMode.stage : null;
  // 自分は持っているレベルのカードで戦う。
  // 相手は、ステージならそのステージのデッキ、フリー対戦なら今のデッキの強さに合わせたデッキ
  // 地形：ステージは決まった地形、フリー対戦とイベントはランダム
  const foeSetup = { name: 'CPU', income: 0, bonus: 0 };
  if (battleMode.type === 'event') {
    // イベント：今週の特殊ルールで戦う。デッキはルールによっては貸し出し
    const ev = eventBattle(profile);
    battleMode.n = ev.n; battleMode.event = ev.event; battleMode.loaner = ev.deck.loaner;
    battleMode.deckName = ev.deck.loaner ? '貸し出しデッキ' : activeDeck(profile).name;
    state = newGame(ev.deck, ev.foeDeck, Math.random, { terrain: randomTerrain(), rules: ev.event.rule });
    Object.assign(foeSetup, { name: `イベントの挑戦者（${ev.n}戦目）`, bonus: ev.bonus });
  } else if (battleMode.type === 'dungeon') {
    // ダンジョン：ダンジョンの中だけのデッキとお守りで戦う。相手はそのマスの敵
    const run = profile.dungeon.run, foe = run.pending.foe, place = runPlace(run);
    battleMode.deckName = 'ダンジョンのデッキ';
    battleMode.label = `ダンジョン ${place.chapter}章 ${place.row}マス目${run.trial ? `（試練${run.trial}）` : ''}`;
    state = newGame(runDeckForBattle(run), foe.deck, Math.random, { terrain: foe.terrain, charms: runBattleCharms(run) });
    Object.assign(foeSetup, { name: foe.name, income: foe.income, bonus: foe.bonus });
  } else {
    battleMode.deckName = activeDeck(profile).name; // 使用中のデッキ（対戦前に選んだデッキ）で戦う
    state = newGame(deckForBattle(profile), stage ? stageDeck(stage) : cpuDeckFor(profile), Math.random,
      { terrain: stage ? stage.terrain : randomTerrain() });
    // ステージの補正：income=毎ターンのクリスタル増減、bonus=最初に持っているクリスタル
    if (stage) Object.assign(foeSetup, { name: stage.enemy, income: stage.income || 0, bonus: stage.bonus || 0 });
  }
  const foe = state.players[1];
  foe.name = foeSetup.name;
  foe.bonusIncome = foeSetup.income;
  applyStartBonus(foe, foeSetup.bonus);
  selectedUid = inspectUid = null;
  busy = true;
  battleLog = [];
  autoRunning = false;
  renderAuto();
  $('#battle-bg').innerHTML = sceneHtml(sceneNameFor(battleMode, state.terrain)); // 地形に合わせた背景
  $('#terrain-bar').innerHTML = `<div class="tb-row">${terrainHtml(state.terrain)}<span id="first-tag"></span></div>`
    + (battleMode.type === 'dungeon' ? battleCharmsHtml() : '')
    + (battleMode.type === 'event' ? `<div class="tb-row rule"><b>${battleMode.event.icon} ${battleMode.event.name}</b><span>${battleMode.event.desc}${battleMode.loaner ? '（貸し出しデッキ）' : ''}</span></div>` : '');
  say('');
  hideOverlay();
  showScreen('battle');
  render();

  await playCoinToss(stage);
  await beginTurn();
}

// ---------- コイントス ----------
// 青い面＝あなた、赤い面＝相手。投げ上げて、出た面の側が先攻。タップでスキップできる。
let coinSkip = null; // 演出中だけ入っている：呼ぶと残りを飛ばす

// コインの片面：色・ヒーローのアイコン・名前
function coinFaceHtml(pi) {
  const p = state.players[pi];
  const art = p.hero ? heroArt(p.hero) : ICON.monster;
  return `<div class="coin-face ${pi === 0 ? 'me' : 'foe'}"><span class="coin-art">${art}</span><b>${pi === 0 ? 'あなた' : 'CPU'}</b></div>`;
}

// 先攻の表示（対戦画面の上部に、対戦中ずっと出す）
function firstTagHtml() {
  const { first } = coinToss(state);
  return `<span class="first-tag ${first === 0 ? 'me' : 'foe'}">先攻：${state.players[first].name}</span>`;
}

async function playCoinToss(stage) {
  const toss = coinToss(state);
  const mine = toss.first === 0;
  const names = ['あなた', 'CPU']; // コインの面の文字に合わせる（相手の名前は長いことがあるので、ここでは CPU と呼ぶ）
  // オートのときは短くする（2倍速・スキップは sleep の側で短くなる）
  const k = FX.auto ? 0.5 : 1;
  let skipped = false, wake = null;
  coinSkip = () => { skipped = true; if (wake) wake(); };
  // スキップされるまで待つ（タップされたら、残りの待ちは全部飛ばす）
  const wait = ms => (skipped ? Promise.resolve() : Promise.race([sleep(ms * k), new Promise(r => { wake = r; })]));
  const intro = stage && stage.boss ? `<div class="boss-intro">${bossArt(stage.id)}<div class="boss-name">${stage.enemy}</div></div>` : '';
  const spin = fxOn() && !fxReduced();
  // 表（青）で止まるなら回転はちょうど何回転か、裏（赤）なら半回転ぶん多い
  const end = (FX.auto || FX.speed !== 1 ? 3 : 5) * 360 + (mine ? 0 : 180);
  showOverlay(`<div class="coin-box">${intro}
    <p class="coin-rule"><span class="me">青</span>が出たら あなたが先攻　<span class="foe">赤</span>が出たら ${names[1]}が先攻</p>
    <div class="coin-stage"><div id="coin" class="coin3d" style="--end:${end}deg;--ms:${Math.max(1, fxMs(1100 * k))}ms">${coinFaceHtml(0)}${coinFaceHtml(1)}</div></div>
    <p id="coin-text" class="coin-result">コイントス…</p>
    <p id="coin-bonus" class="coin-bonus"></p>
    <small class="coin-hint">タップでスキップ</small>
  </div>`);
  const coin = $('#coin');
  await wait(450);
  if (spin && !skipped) {
    coin.classList.add('toss'); // 回転しながら上がって落ちる。止まる直前はゆっくり回る
    sfx('gem');
    await wait(1100);
  }
  // 出た面を大きく見せて、結果を大きな文字で出す
  coin.classList.remove('toss');
  coin.classList.add('landed', mine ? 'me' : 'foe');
  sfx(mine ? 'turn' : 'tap');
  $('#coin-text').textContent = mine ? 'あなたが先攻！' : `${names[1]}が先攻`;
  $('#coin-text').classList.add('show', mine ? 'me' : 'foe');
  $('#coin-bonus').textContent = toss.bonus ? `後攻ボーナス：${names[toss.second]}はクリスタル+${toss.bonus}${toss.lateBonus ? `（ターン${toss.lateTurn}にも+${toss.lateBonus}）` : ''}` : '';
  await (skipped ? sleep(350) : wait(750));
  coinSkip = null;
  hideOverlay();
  const tag = $('#first-tag');
  if (tag) tag.innerHTML = firstTagHtml();
}

async function beginTurn() {
  const result = startTurn(state);
  busy = true;
  selectedUid = null;
  const mine = state.current === 0;
  battleLog.push(`── ターン${state.turn}（${mine ? 'あなた' : foeName()}）──`);
  if (state.attrition.length) await playAttrition();
  if (state.terrainEvents.length) await playTerrain();
  if (!result && state.startEvents.length) {
    render();
    await playSkillEvents(state.startEvents);
  }
  if (result) {
    render();
    await sleep(500);
    showResult(result);
    return;
  }
  if (state.lateBonus) { battleLog.push(`💎 後攻ボーナス：${mine ? 'あなた' : foeName()}のクリスタル +${state.lateBonus}`); render(); fxCrystalGain($('#info-' + state.current), state.lateBonus); }
  const until = attritionStart(state) - state.turn;
  if (until > 0 && until <= CONFIG.ATTRITION_NOTICE) battleLog.push(`🔥 あと${until}ターンで消耗ダメージが始まります`);
  say(mine ? 'あなたのターン：カードを出して「ターン終了」' : `${foeName()}のターン`);
  render();
  await banner(mine ? 'あなたのターン' : '相手のターン');
  if (mine && FX.auto && battleMode.type !== 'puzzle') {
    await autoPlay(0); // オートバトル：自分の番も自動で進める（パズルでは使えない）
  } else if (mine) {
    busy = false;
    render();
  } else {
    await cpuTurn();
  }
}

// CPUの番
function cpuTurn() { return autoPlay(1); }

// 1人ぶんの番を自動で進める（カードを出す・装備・フラッシュ・生贄 → ターン終了）。
//   pi = 1: CPU　pi = 0: オートバトル（自分の番）。オートは、途中でオフにされたら次の行動の前に止まり、手動に戻る
let autoRunning = false; // 自分の番を自動で進めている最中か
async function autoPlay(pi) {
  const st = state;
  const p = state.players[pi];
  const who = p.name;
  const mine = pi === 0;
  // オートをやめる・対戦が終わった・別の対戦が始まった、のどれかなら手を止める
  const stop = () => state !== st || state.phase !== 'play' || state.current !== pi;
  const handBack = () => { autoRunning = false; if (state === st && state.phase === 'play') { busy = false; render(); } };
  if (mine) autoRunning = true;
  await sleep(400);
  for (;;) {
    if (stop()) { if (mine) autoRunning = false; return; }
    if (mine && !FX.auto) { handBack(); return; }
    // オート（つよい）は、先読みの計算を小分けに進めてから動く（画面を固めない）
    const strong = mine && FX.autoLevel === 'strong';
    if (strong && !autoPlanReady(state)) {
      await autoThink(state);
      if (stop()) { autoRunning = false; return; }
      if (!FX.auto) { handBack(); return; }
    }
    const action = mine ? autoActionFor(state, FX.autoLevel) : cpuNextAction(state);
    if (!action) break;
    const h = p.hand.find(c => c.uid === action.uid);
    const victim = action.type === 'sacrificeField' ? p.slots[action.slot] : null;
    if (victim) await fxSacrifice(monEl(victim.uid)); // 炎に包まれて消える
    const done = applyAction(state, pi, action);
    if (action.type === 'monster') sfx('summon');
    if (action.type === 'equip') sfx('equip');
    if (action.type === 'sacrifice' || victim) { render(); fxCrystalGain($('#info-' + pi), victim ? sacGain(CONFIG.SACRIFICE_MONSTER, pi) : sacGain(sacrificeGain(h.card), pi)); }
    if (victim) say(`${who}：場の${nm(victim)}を生贄にした（+${sacGain(CONFIG.SACRIFICE_MONSTER, pi)}💎）`);
    if (action.type === 'flash') await showFlash(done, who);
    if (state.result) { if (mine) autoRunning = false; await sleep(500); showResult(state.result); return; }
    if (action.type === 'monster') say(`${who}：${nm(h)}をスロット${action.slot + 1}に召喚`);
    if (action.type === 'equip') say(`${who}：${nm(p.slots[action.slot])}に${nm(h)}を装備`);
    if (done.events && done.events.length) { render(); await playSkillEvents(done.events); }
    if (action.type === 'sacrifice') say(`${who}：カードを1枚生贄にした（+${sacGain(sacrificeGain(h.card), pi)}💎）`);
    busy = true; // showFlash などが操作を戻していても、自動で進めている間は操作できないようにする
    render();
    await sleep(750);
  }
  if (stop()) { if (mine) autoRunning = false; return; }
  if (mine) {
    if (!FX.auto) { handBack(); return; } // 最後の待ちの間にオフにされた：ターン終了は自分で押す
    autoRunning = false;
  }
  await endTurn();
}

// オートの表示（ボタンが光る・「AUTO」の札）と、演出速度のボタン
function renderAuto() {
  $('#btn-auto').classList.toggle('on', FX.auto);
  $('#btn-auto').textContent = FX.auto ? 'オート中' : 'オート';
  $('#screen-battle').classList.toggle('auto', FX.auto);
  $('#btn-speed').textContent = (FX_SPEEDS.find(x => x[0] === FX.speed) || FX_SPEEDS[0])[1];
}

// オートのオン・オフ。自分の番の途中でオンにしたら、その場から自動で進める。
// オフにしたら、いまの行動が終わったところで手動に戻る
function toggleAuto() {
  FX.auto = !FX.auto;
  fxSaveSettings();
  renderAuto();
  if (!state || state.phase !== 'play') return;
  if (FX.auto && state.current === 0 && !busy && !autoRunning) {
    busy = true;
    selectedUid = inspectUid = null;
    hideOverlay();
    say('オート：自分の番を自動で進めます');
    render();
    autoPlay(0);
  } else if (!FX.auto && autoRunning) {
    say('オートをオフにしました。いまの行動が終わったら手動に戻ります');
    $('#message').textContent = message;
  }
}

// 演出速度を切り替える（1倍 → 2倍 → スキップ）。オート中でも切り替えられる
function cycleSpeed() {
  const i = FX_SPEEDS.findIndex(x => x[0] === FX.speed);
  FX.speed = FX_SPEEDS[(i + 1) % FX_SPEEDS.length][0];
  fxSaveSettings();
  renderAuto();
}

function monEl(uid) { return document.querySelector(`.mon[data-uid="${uid}"]`); }

// モンスターの上に数字などを浮かべる
//   同じモンスターに続けて出るときは、重ならないように少しずらして、少し遅らせて出す
const POP_OFFSETS = [[0, 0], [-24, -16], [24, -16], [-34, -34], [34, -34], [0, -40]];
function floatText(el, text, cls, size) {
  const num = document.createElement('div');
  num.className = 'dmg' + (cls ? ' ' + cls : '');
  num.textContent = text;
  const host = el.parentNode;
  if (!/\btag\b/.test(cls || '') && num.style) {
    const now = Date.now();
    if (!host.popAt || now - host.popAt > fxMs(650)) host.popN = 0; // 少し間が空いたら、また真ん中から
    const i = host.popN || 0;
    host.popN = i + 1;
    host.popAt = now;
    const [ox, oy] = POP_OFFSETS[i % POP_OFFSETS.length];
    num.style.setProperty('--ox', ox + 'px');
    num.style.setProperty('--oy', oy + 'px');
    if (i) num.style.animationDelay = `${fxMs(i * 80)}ms`;
    if (size) num.style.fontSize = size + 'px';
  }
  host.appendChild(num);
  return num;
}

// ダメージの結果を数字で出す。大きいダメージほど大きく太く、撃破の一撃は特に大きく。
// アーマーで受けた分・盾で軽減した分・ブロックなどは、別の表示にする。
//   type: 攻撃の種類（数字の色）　icon: スキルのアイコン（Thorns など）
// ダメージの数字の要素を返す（カオスのスロット演出用。数字を出さなかったら null）
function popDamage(el, ev, type, icon = '') {
  if (ev.missed || ev.dodged) { floatText(el, 'MISS', 'word miss'); return null; }
  if (ev.fogged) { floatText(el, 'GUARD', 'word guard'); return null; }
  if (ev.reflected) { floatText(el, ev.deflected ? '🏓REFLECT' : '🪞REFLECT', 'word guard'); return null; }
  if (ev.guarded) { floatText(el, '🌩️GUARD', 'word guard'); return null; }
  if (ev.blocked) { floatText(el, '🛡️BLOCK', 'word block'); return null; }
  if (ev.shielded) floatText(el, `-${ev.shielded} 軽減`, 'small');
  if (ev.armorDmg > 0) floatText(el, `🛡️-${ev.armorDmg}`, 'armor');
  if (!ev.dmg) {
    if (!ev.armorDmg) floatText(el, ev.shielded ? 'GUARD' : `${icon}-0`, ev.shielded ? 'word guard' : `${dmgClass(type)} zero`);
    return null;
  }
  const size = Math.min(52, 24 + ev.dmg * 2.6) + (ev.killed ? 8 : 0);
  return floatText(el, `${icon}-${ev.dmg}`, `${dmgClass(type)}${ev.dmg >= 5 ? ' heavy' : ''}${ev.killed ? ' ko' : ''}`, size);
}

// ダメージ結果の表示：[浮かべる文字, 追加クラス, ログ用の文]
function damageText(ev) {
  if (ev.missed) return ['ミス', 'blocked', `${state.terrain.name}で外れた！`];
  if (ev.dodged) return ['回避', 'blocked', 'Flyingで回避！'];
  if (ev.fogged) return ['FOG', 'blocked', 'Fogでダメージ0（Fogが解けた）'];
  if (ev.reflected) return ['反射', 'blocked', ev.deflected ? 'Deflectで跳ね返された！' : 'Magic Reflectで受けなかった！'];
  if (ev.guarded) return ['ガード', 'blocked', 'Static Guardで防がれた！'];
  if (ev.blocked) return ['ブロック', 'blocked', 'アーマーでブロック！'];
  const notes = [];
  if (ev.shielded) notes.push(`Shieldで-${ev.shielded}`);
  if (ev.antiAir) notes.push(`Anti-Air +${ev.antiAir}`);
  if (ev.seeThrough) notes.push('See-throughで防御スキル無視');
  if (ev.bombard) notes.push(`Bombard +${ev.bombard}`);
  if (ev.ambush) notes.push(`Ambush +${ev.ambush}`);
  if (ev.exploit) notes.push(`Exploit +${ev.exploit}`);
  if (ev.trickery) notes.push('Trickeryで最大値');
  if (ev.heroBonus) notes.push(`ヒーロースキル +${ev.heroBonus}`);
  const note = notes.length ? `（${notes.join('、')}）` : '';
  if (ev.armorDmg > 0 && ev.dmg > 0) return [`-${ev.dmg}`, '', `アーマーを破壊して${ev.dmg}ダメージ（Piercing）${note}`];
  if (ev.armorDmg > 0) return [`🛡️-${ev.armorDmg}`, 'armor', `アーマーに${ev.armorDmg}ダメージ${note}`];
  if (ev.dmg === 0 && ev.shielded) return ['ガード', 'blocked', 'Shieldで防いだ'];
  return [`-${ev.dmg}`, '', `${ev.dmg}ダメージ${note}`];
}

// 1体に効果を見せる：数字を浮かべ、倒れたら撃破演出
async function showOn(mon, text, cls, opts = {}) {
  const el = monEl(mon.uid);
  if (!el) return;
  if (opts.hit) { el.classList.add('hit'); sfx('hit'); }
  if (opts.fx) opts.fx(el); // 効果ごとの演出（回復の光、泡など）
  if (opts.ev) { popDamage(el, opts.ev, opts.type, opts.icon); updateHpBar(mon); } // ダメージは、数字が弾ける表示
  else floatText(el, text, cls);
  await sleep(opts.wait === undefined ? 480 : opts.wait);
  if (opts.killed) {
    fxDeath(el);
    await sleep(420);
  }
}

function healText(r) {
  const parts = [];
  if (r.cured) parts.push(`Diseaseを${r.cured}減らした`);
  if (r.heal || !r.cured) parts.push(`${r.heal}回復`);
  return parts.join('、');
}

// ヒーローのアイコンを光らせる（ヒーロースキルが発動したとき）
function heroGlow(pi) {
  const el = document.querySelector(`#info-${pi} .hero-ico`);
  if (!el || !el.classList) return;
  el.classList.remove('glow');
  void el.offsetWidth;
  el.classList.add('glow');
  sfx('buff');
}

// ヒーロースキルのログ文
function heroEventText(ev) {
  const k = HERO_SKILL_INFO[ev.id];
  const names = (ev.targets || []).map(t => nm(t)).join('・');
  const body = {
    heal: () => `${nm(ev.target)}を${healText(ev)}`,
    cleanse: () => `${names}のデバフを解除`,
    fog: () => `${nm(ev.target)}がFog状態に`,
    disease: () => `${ev.target ? nm(ev.target) : '敵全員'}にDisease ${ev.x}`,
    gain: () => `敵を倒してクリスタル+${ev.gain}`,
    grant: () => `${nm(ev.target)}がDisease 1を得た`,
  }[ev.effect]();
  return `ヒーロースキル「${k.name}」：${body}`;
}

// 場に出たとき・ターン開始時のスキルのログ文
function skillEventText(ev) {
  const src = ev.source ? nm(ev.source) : '';
  const name = id => SKILLS[id].name;
  switch (ev.kind) {
    case 'hero': return heroEventText(ev);
    case 'silence': return `${src}のSilence：敵全員が${ev.x}ターン、魔法攻撃とHealを使えない`;
    case 'heal': return `${src}の${name(ev.skill)}：${nm(ev.target)}を${healText(ev)}`;
    case 'cleanse': return `${src}の${name(ev.skill)}：${ev.targets.map(t => nm(t)).join('・')}のデバフを解除`;
    case 'rearguard': return `${src}のRearguard：後列にいるので、自分のスキルの数値+${ev.x}`;
    case 'poisonhalo': return `${src}のPoison Halo：${ev.targets.map(t => nm(t)).join('・')}がOutbreak／Diseaseを得た`;
    case 'trickery': return `${src}のTrickery：このターン、同じ色の味方のカオスダメージが最大値に`;
    case 'antimagic': return `${src}のAnti-Magic Shield：味方全員が受ける魔法ダメージ-${ev.x}`;
    case 'toxicfog': return `${src}のToxic Fog：敵全員にDisease ${ev.x}`;
    case 'massbombard': return `${src}のMass Bombard：Flyingを持つ味方の対地攻撃+${ev.x}`;
    case 'healingshield': return `Healing Shield：${nm(ev.target)}が${SKILLS[ev.shield].name} ${ev.x}を得た`;
    case 'fear':
      if (ev.immune) return `${src}のFear：${nm(ev.target)}はInspireを受けていて効かない`;
      return `${src}のFear：${nm(ev.target)}と${nm(ev.other)}の位置を入れ替えた`;
    case 'menace': return `Menace：位置が変わった${nm(ev.target)}に${ev.dmg}の固定ダメージ${ev.killed ? '　撃破！' : ''}`;
    case 'outbreakhalo': return `${src}のOutbreak Halo：Disease 状態の${nm(ev.target)}に${ev.dmg}の魔法ダメージ${ev.killed ? '　撃破！' : ''}`;
    case 'sick': return `Disease：${nm(ev.target)}に、スタック数ぶんの${ev.dmg}の魔法ダメージ${ev.killed ? '　撃破！' : ''}`;
    case 'phantom': return `Phantom：${src}の分身が現れた（攻撃フェーズの終わりに消える）`;
    case 'phantomend': return `Phantom：${ev.targets.map(t => nm(t)).join('・')}の分身が消えた`;
    case 'dive': return `Dive：Flying を持つ${nm(ev.target)}の近接・遠隔攻撃+${ev.x}`;
    case 'inspire': return `${src}のInspire：味方全員の近接攻撃+${ev.x}`;
    case 'shoot': return `${src}のShoot Command：味方全員の遠隔攻撃+${ev.x}、ブロックされない`;
    case 'demoralize': return `${src}のDemoralize：敵全員の近接・遠隔攻撃-${ev.x}`;
    case 'suppress': return `${src}のSuppress Magic：敵全員の魔法攻撃-${ev.x}`;
    case 'entangle':
      if (ev.immune) return `${src}のEntangle：${nm(ev.target)}はPerseveranceで無効`;
      return `${src}のEntangle：${nm(ev.target)}を${ev.success ? '拘束した！' : '拘束できなかった'}`;
    case 'skip': return `${src}：${ev.reason === 'silence' ? 'Silence' : 'Disease'}で${name(ev.skill)}を使えない`;
    case 'backfire': return `${src}のBackfire：相手の山札に「がらくた」を${ev.x}枚、自分の山札にも1枚入れた`;
    case 'spellforge': return `${src}のSpell Forge：自分の山札に「${ev.item.name}」を入れた`;
    case 'apothecary': return `${src}のApothecary：自分の山札に「${ev.item.name}」を入れた`;
    case 'fortune': return `${src}のFortune：${ev.item.junk ? `凶。相手の山札に「${ev.item.name}」を入れた` : `吉。自分の山札に「${ev.item.name}」を入れた`}`;
    case 'tinker': return `${src}のTinker：自分の山札に「${ev.item.name}」を入れた（コスト-${ev.x}）`;
    case 'opportunist': return `Opportunist：${nm(ev.target)}の攻撃力と最大HPが+${ev.x}`;
    case 'vanguardcall': return `${src}のVanguard Call：前列に${nm(ev.target)}を呼んだ`;
    case 'sortie': return `${src}のSortie：${nm(ev.target)}を呼んだ（このターンの終わりに消える）`;
    case 'tokenend': return `${ev.targets.map(t => nm(t)).join('・')}が消えた`;
    case 'burden': return `${nm(ev.target)}が倒された：持ち主のクリスタル-${ev.x}`;
    case 'attunement': return `Attunement：このターンに味方が回復されたので、${ev.count}枚のコスト-${ev.x}`;
    case 'illomen': return `Ill Omen：引いたカードのコスト+${ev.x}`;
    case 'evacuate': return `Evacuate：${nm(ev.target)}を山札に戻した（コスト-${ev.x}）`;
    case 'fallback': return `Fall Back：${nm(ev.target)}は山札に戻った（次に出すときのコスト+${ev.x}）`;
    case 'vanguard': return `${src}のVanguard：前列にいるので、自分のスキルの数値+${ev.x}`;
    case 'steadyaim': return `${src}のSteady Aim：ダメージを受けていないので、遠隔攻撃+${ev.x}`;
    case 'jinx': return `${src}のJinx：敵全員のカオス攻撃-${ev.x}`;
    case 'burning': return `燃焼：${nm(ev.target)}に${ev.dmg}の魔法ダメージ${ev.killed ? '　撃破！' : ''}`;
    case 'laststand': return `Last Stand：${nm(ev.target)}は倒されず、HPが全回復！`;
    case 'grudge': return `Grudge：${nm(ev.target)}の近接攻撃が+${ev.x}`;
    case 'partinggift': return `${src}のParting Gift：${nm(ev.target)}を${healText(ev)}`;
    case 'finalbow': return `${src}のFinal Bow：${nm(ev.target)}に${ev.dmg}の固定ダメージ${ev.killed ? '　撃破！' : ''}`;
    default: return SKILLS[ev.kind] ? `${src ? src + 'の' : ''}${SKILLS[ev.kind].name}` : '';
  }
}

// スキルの発動を順番に見せる（ターン開始時・登場時）
async function playSkillEvents(events) {
  for (const ev of events) {
    say(skillEventText(ev));
    $('#message').textContent = message;
    if (ev.source) {
      const el = monEl(ev.source.uid);
      if (el && ev.kind !== 'skip' && SKILLS[ev.skill || ev.kind]) floatText(el, SKILLS[ev.skill || ev.kind].name, 'tag');
    }
    if (ev.kind === 'hero') heroGlow(ev.side === 'foe' ? 1 - state.current : state.current); // ヒーローのアイコンが光る
    if (ev.kind === 'hero' && ev.effect === 'heal') { await showOn(ev.target, ev.heal ? `+${ev.heal}` : '☣️↓', 'heal', { fx: fxHeal }); render(); continue; }
    if (['phantom', 'vanguardcall', 'sortie'].includes(ev.kind)) { render(); sfx('summon'); }           // 分身を場に描いてから光らせる
    if (ev.kind === 'phantomend' || ev.kind === 'tokenend') ev.targets.forEach(t => { const el = monEl(t.uid); if (el) el.classList.add('dying'); });
    if (['menace', 'outbreakhalo', 'sick', 'burning', 'finalbow'].includes(ev.kind)) {
      // ダメージを与える効果（Menace・Final Bow は固定ダメージ、Outbreak Halo・Disease・燃焼は魔法ダメージ）
      const solid = ev.kind === 'menace' || ev.kind === 'finalbow';
      const icon = ev.kind === 'sick' ? STATUS_INFO.disease.icon : ev.kind === 'burning' ? STATUS_INFO.burn.icon : SKILLS[ev.kind].icon;
      await showOn(ev.target, ev.fogged ? 'FOG' : `-${ev.dmg}`, dmgClass(solid ? 'melee' : 'magic'),
        { hit: true, killed: ev.killed, fx: solid ? () => fxShake() : fxOutbreak, ev, type: solid ? 'melee' : 'magic', icon });
    } else if (ev.kind === 'partinggift') await showOn(ev.target, ev.heal ? `+${ev.heal}` : '☣️↓', 'heal', { fx: fxHeal });
    else if (ev.kind === 'heal') await showOn(ev.target, ev.heal ? `+${ev.heal}` : '☣️↓', 'heal', { fx: fxHeal });
    else if (ev.kind === 'entangle') await showOn(ev.target, ev.success ? '🕸️拘束' : 'ミス', ev.success ? 'armor' : 'blocked', { fx: el => fxEntangle(el, ev.success), wait: 700 });
    else if (ev.targets && ev.targets.length) {
      const icon = ev.kind === 'hero' ? { cleanse: '🧼', fog: '💨', disease: '☣️', grant: '☣️' }[ev.effect] : STATUS_INFO[ev.kind] ? STATUS_INFO[ev.kind].icon : SKILLS[ev.kind] ? SKILLS[ev.kind].icon : '🧼';
      const good = !['demoralize', 'suppress', 'silence', 'toxicfog', 'fear', 'jinx'].includes(ev.kind) && !(ev.kind === 'hero' && ev.effect === 'disease');
      const els = ev.targets.map(t => monEl(t.uid)).filter(Boolean);
      // 全員が一瞬光る（強化は金、弱体は紫）。Silence は口元に×印
      fxGlow(els, ev.kind === 'cleanse' ? 'cleanse' : good ? 'buff' : 'debuff');
      if (ev.kind === 'silence') els.forEach(fxSilence);
      sfx(ev.kind === 'silence' ? 'silence' : ev.kind === 'cleanse' ? 'heal' : good ? 'buff' : 'debuff');
      els.forEach(el => floatText(el, icon, good ? 'heal' : 'armor'));
      await sleep(560);
    } else await sleep(450);
    render();
    await sleep(120);
  }
}

// フラッシュカードの演出（プレイフェーズ中に再生）
async function showFlash(ev, who) {
  const wasBusy = busy;
  busy = true;
  const id = ev.skill.id;
  let text = `${who}：${nm(ev)}`;
  const shows = []; // [モンスター, 文字, クラス, オプション]
  if (id === 'reinforcement') text += `（クリスタル+${ev.gain}）`;
  else if (id === 'heal') {
    text += ` → ${nm(ev.target)}：${healText(ev)}`;
    shows.push([ev.target, ev.heal ? `+${ev.heal}` : '☣️↓', 'heal', { fx: fxHeal }]);
  } else if (id === 'groupheal') {
    const healed = ev.group.filter(g => g.heal || g.cured);
    text += `：味方全員を回復（${healed.map(g => `${nm(g.target)} ${healText(g)}`).join('、') || '回復する味方なし'}）`;
    healed.forEach(g => shows.push([g.target, g.heal ? `+${g.heal}` : '☣️↓', 'heal', { fx: fxHeal }]));
  } else if (id === 'groupdisease') {
    text += `：敵全員にDisease ${ev.skill.x}${ev.group.some(g => g.immune) ? '（Perseveranceには無効）' : ''}`;
    ev.group.forEach(g => shows.push([g.target, g.immune ? '無効' : `☣️+${g.x}`, g.immune ? 'blocked' : 'armor', g.immune ? {} : { fx: fxDisease }]));
  } else if (id === 'purge') {
    text += `：試合中に足されたカードを${ev.purged}枚取り除いた`;
  } else if (id === 'swarm') {
    text += `：${ev.summoned.length}体の${nm(ev.summoned[0])}で場を埋めた（次の自分のターン開始時に消える）`;
  } else if (id === 'unwelcomegift') {
    text += `：相手の前列に${nm(ev.summoned[0])}を置いた（攻撃できない。倒されると持ち主のクリスタル-1）`;
  } else if (id === 'tax') {
    text += `：相手の手札のアイテム${ev.taxed}枚のコスト+${ev.skill.x}`;
  } else if (id === 'unsummon' || id === 'retreat' || id === 'regroup') {
    text += ` → ${nm(ev.target)}を山札に戻した${id === 'regroup' ? `（コスト-${ev.skill.x}）` : ''}${ev.target.item ? `（${ev.target.item.name}も山札へ）` : ''}`;
    shows.push([ev.target, '↩️', 'armor', { fx: el => { sfx('dodge'); el.classList.add('dying'); }, wait: 500 }]);
  } else if (id === 'terminate') {
    text += ` → ${nm(ev.target)}を${ev.target.item ? '装備ごと' : ''}破壊した`;
    shows.push([ev.target, '✂️', 'blocked', { hit: true, killed: true, fx: () => fxShake() }]);
  } else if (id === 'corrosion') {
    text += ` → ${nm(ev.target)}の${ev.destroyed[0].name}を破壊した`;
    shows.push([ev.target, '🧪', 'armor', { fx: fxShieldBreak }]);
  } else if (id === 'masscorrosion') {
    text += `：敵の装備をすべて破壊（${ev.group.map(g => g.item.name).join('、') || '装備なし'}）`;
    ev.group.forEach(g => shows.push([g.target, '⚗️', 'armor', { fx: fxShieldBreak }]));
  } else if (id === 'phantom') {
    text += ` → ${nm(ev.target)}：攻撃フェーズの最初に分身が現れる`;
    shows.push([ev.target, '👥', 'heal', { fx: () => sfx('buff') }]);
  } else if (id === 'stall') {
    text += ev.immune ? ` → ${nm(ev.target)}はPerseveranceで無効` : ` → ${nm(ev.target)}は${ev.skill.x}ターンのあいだ攻撃できない`;
    shows.push([ev.target, ev.immune ? '無効' : '⏳', ev.immune ? 'blocked' : 'armor', ev.immune ? {} : { fx: el => { sfx('debuff'); fxGlow([el], 'debuff'); } }]);
  } else if (id === 'plagueburst') {
    text += `：Disease の敵に、スタック×${ev.skill.x}の魔法ダメージ（${ev.group.map(g => `${nm(g.target)} ${g.fogged ? 'FOG' : g.dmg}`).join('、') || 'Disease の敵なし'}）`;
    ev.group.forEach(g => shows.push([g.target, g.fogged ? 'FOG' : `-${g.dmg}`, dmgClass('magic'), { hit: true, killed: g.killed, fx: fxOutbreak, ev: g, type: 'magic', icon: '💥' }]));
  } else if (id === 'lingeringfog') {
    text += ` → ${nm(ev.target)}がFog状態に（次に受ける攻撃のダメージが0）`;
    shows.push([ev.target, '💨', 'heal', { fx: () => sfx('buff') }]);
  } else {
    const [num, cls, log] = damageText(ev);
    text += ` → ${nm(ev.target)}：${log}${ev.killed ? '　撃破！' : ''}`;
    const magic = id === 'lightning';
    // ライトニングは雷が落ちる。スマイトは打撃。アーマーを割ったら盾が砕ける
    const fx = el => {
      if (fxOn()) { const p = fxCenter(el); fxSpawn(magic ? 'fx-bolt gold' : 'fx-slash', p.x, magic ? p.y - p.h * 0.2 : p.y, magic ? FX_BOLT : FX_SLASH, 380); }
      if (ev.armorDmg > 0 && ev.target.armor === 0) fxShieldBreak(el);
      if (!magic && ev.dmg >= 5) fxShake();
    };
    shows.push([ev.target, num, `${cls} ${dmgClass(magic ? 'magic' : 'melee')}`, { hit: true, killed: ev.killed, fx, ev, type: magic ? 'magic' : 'melee' }]);
  }
  sfx(id === 'reinforcement' ? 'gem' : id === 'lightning' ? 'chaos' : 'flash');
  if (id === 'reinforcement') fxCrystalGain($(who === 'あなた' ? '#info-0' : '#info-1'), ev.gain);
  say(text);
  $('#message').textContent = message;
  await Promise.all(shows.map(([mon, t, cls, opts]) => showOn(mon, t, cls, opts)));
  for (const x of ev.extras || []) await playExtra(x); // 続いて起きた効果（Menace・Healing Shield）
  busy = wasBusy;
  render();
}

// プレイヤーが出したカードの「場に出たとき」のスキルを見せる
async function playEnterEvents(events) {
  busy = true;
  render();
  await playSkillEvents(events);
  busy = false;
  render();
}

// プレイヤーがフラッシュを使う
async function useFlash(h, slot) {
  const ev = playFlash(state, 0, h.uid, slot);
  if (!ev) {
    say('💎が足りません');
    render();
    return;
  }
  selectedUid = null;
  await showFlash(ev, 'あなた');
  if (state.result) { await sleep(500); showResult(state.result); }
}

const SKIP_TEXT = {
  entangle: 'Entangleで拘束されていて行動できない',
  silence: 'Silenceで魔法攻撃できない',
  suppress: 'Suppress Magicで魔法攻撃力が0のため攻撃できない',
  demoralize: 'Demoralizeで攻撃力が0のため攻撃できない',
  jinx: 'Jinxでカオス攻撃力が0のため攻撃できない',
  stall: 'Stallで足止めされていて攻撃できない',
};

// 攻撃に続いて起きる「得をする効果」の文（名前, イベント）
const EXTRA_GAIN = {
  grudge: (n, x) => `Grudge：${n}の近接攻撃が永続で+${x.x}`,
  keeneye: (n, x) => `Keen Eye：${n}の遠隔攻撃が永続で+${x.x}`,
  leech: (n, x) => `Leech：${n}のHPと最大HPが+${x.x}`,
  harvest: (n, x) => `Harvest：${n}が敵を倒して、クリスタル+${x.x}`,
  laststand: n => `Last Stand：${n}は倒されず、HPが全回復！`,
  opportunist: (n, x) => `Opportunist：${n}の攻撃力と最大HPが+${x.x}`,
  burden: (n, x) => `${n}が倒された：持ち主のクリスタル-${x.x}`,
  evacuate: (n, x) => `Evacuate：${n}を山札に戻した（コスト-${x.x}）`,
  partinggift: (n, x) => `Parting Gift：${n}を${healText(x)}`,
};

// 攻撃に続いて起きたスキルの効果（Thorns・Doublestrike など）を1つ再生する
async function playExtra(x) {
  const name = nm(x.target);
  let text, float, cls = '', opts = { hit: true, killed: x.killed };
  if (x.kind === 'swallow') {
    text = `Swallow：${name}の攻撃力と最大HPが+${x.x}`;
    float = `🍖+${x.x}`; cls = 'heal'; opts = { fx: () => sfx('buff') };
  } else if (x.kind === 'disease') {
    text = x.immune ? `Disease：${name}はPerseveranceで無効` : `Disease：${name}がDisease状態に（スタック${x.target.status.disease || x.x}）`;
    float = x.immune ? '無効' : `☣️+${x.x}`; cls = x.immune ? 'blocked' : 'armor'; opts = x.immune ? {} : { fx: fxDisease };
  } else if (x.kind === 'hero') {
    heroGlow(x.side === 'foe' ? 1 - state.current : state.current);
    text = heroEventText(x);
    float = x.effect === 'gain' ? `💎+${x.gain}` : x.effect === 'heal' ? (x.heal ? `+${x.heal}` : '☣️↓') : `☣️+${x.x}`;
    cls = x.effect === 'disease' ? 'armor' : 'heal';
    opts = { fx: x.effect === 'heal' ? fxHeal : x.effect === 'disease' ? fxDisease : () => fxCrystalGain($(`#info-${state.current}`), x.gain) };
  } else if (EXTRA_GAIN[x.kind]) {
    // 自分が強くなる・得をする効果（永続の成長、クリスタル、踏みとどまり、回復）
    text = EXTRA_GAIN[x.kind](name, x);
    float = x.kind === 'harvest' ? `💎+${x.x}` : x.kind === 'burden' ? `💎-${x.x}` : x.kind === 'evacuate' ? '🪂' : x.kind === 'laststand' ? '🕯️全回復' : x.kind === 'partinggift' ? (x.heal ? `+${x.heal}` : '☣️↓') : `${SKILLS[x.kind].icon}+${x.x}`;
    cls = 'heal';
    opts = { fx: x.kind === 'partinggift' ? fxHeal : x.kind === 'harvest' ? () => fxCrystalGain($(`#info-${state.current}`), x.x) : () => sfx('buff') };
  } else if (x.kind === 'scorch') {
    text = x.immune ? `Scorch：${name}はPerseveranceで無効` : `Scorch：${name}が燃焼に（スタック${x.target.status.burn || x.x}）`;
    float = x.immune ? '無効' : `🔥+${x.x}`; cls = x.immune ? 'blocked' : 'armor'; opts = x.immune ? {} : { fx: fxDisease };
  } else if (x.kind === 'dive' || x.kind === 'healingshield') {
    text = skillEventText(x);
    float = x.kind === 'dive' ? `🦅+${x.x}` : `${SKILLS[x.shield].icon}+${x.x}`; cls = 'heal'; opts = { fx: () => sfx('buff') };
  } else {
    const label = {
      thorns: `Thorns ${x.x}`, doublestrike: 'Doublestrike', outbreak: 'Outbreak（Diseaseのぶん追加）',
      menace: 'Menace（位置が変わった）', magicblast: 'Magic Blast', shieldspike: `Shield Spike ${x.x}`, magicreflect: 'Magic Reflect（跳ね返し）',
      counter: 'Counter-Attack（反撃）', crosscounter: 'Cross-Counter-Attack（反撃）', magiccounter: 'Magic Counter（反撃）', opportunity: 'Opportunity（射撃）',
      deflect: 'Deflect（跳ね返し）', staticguard: `Static Guard ${x.x}`, echo: 'Echo（こだま）', trample: 'Trample（余りのダメージ）', luckyshot: `Lucky Shot ${x.x}`, finalbow: 'Final Bow',
    }[x.kind] || (SKILLS[x.kind] ? SKILLS[x.kind].name : x.kind);
    const magic = ['outbreak', 'magicblast', 'magicreflect', 'echo', 'staticguard'].includes(x.kind);
    const [num, c, log] = damageText(x);
    text = `${label}：${name}に${magic && !x.fogged ? `${x.dmg}の魔法ダメージ` : x.kind === 'menace' || x.kind === 'luckyshot' || x.kind === 'finalbow' ? `${x.dmg}の固定ダメージ` : log}${x.killed ? '　撃破！' : ''}`;
    float = num; cls = `${c} ${dmgClass(magic ? 'magic' : x.kind === 'opportunity' || x.kind === 'deflect' ? 'ranged' : 'melee')}`;
    // 数字にはスキルのアイコンを付ける（Thorns・Outbreak など）
    Object.assign(opts, { ev: x, type: magic ? 'magic' : x.kind === 'opportunity' ? 'ranged' : 'melee', icon: SKILLS[x.kind] ? SKILLS[x.kind].icon : '' });
    // 反撃は斬撃、魔法の跳ね返し・爆発は光、Menace は画面の揺れ、Shield Spike はトゲ
    if (['counter', 'crosscounter', 'magiccounter'].includes(x.kind)) opts.fx = el => { sfx('melee'); if (fxOn()) { const p = fxCenter(el); fxSpawn('fx-slash', p.x, p.y, FX_SLASH, 340); } };
    if (['magicblast', 'magicreflect', 'echo', 'staticguard'].includes(x.kind)) opts.fx = el => { sfx('magic'); if (fxOn()) { const p = fxCenter(el); fxSpawn('fx-burst magic', p.x, p.y, '', 460); } };
    if (x.kind === 'menace') opts.fx = () => { sfx('debuff'); fxShake(); };
    if (x.kind === 'shieldspike') opts.fx = () => fxThorns(monEl(x.source.uid));
    if (x.kind === 'opportunity') opts.fx = () => sfx('ranged');
    if (x.dodged) opts = { fx: fxMiss, ev: fxOn() ? null : x };
    else if (x.kind === 'outbreak') opts.fx = fxOutbreak;
    else if (x.kind === 'thorns') opts.fx = () => fxThorns(monEl(x.source.uid)); // トゲが光って、攻撃者にダメージ
    else if (x.kind === 'doublestrike') opts.fx = el => { sfx('melee'); if (fxOn()) { const p = fxCenter(el); fxSpawn('fx-slash', p.x, p.y, FX_SLASH, 340); } };
    if (!x.dodged && x.armorDmg > 0 && x.target.armor === 0) { const base = opts.fx; opts.fx = el => { if (base) base(el); fxShieldBreak(el); }; }
  }
  say(text);
  $('#message').textContent = message;
  await showOn(x.target, float, cls, opts);
}

async function playAttack(ev) {
  const a = monEl(ev.attacker.uid);
  if (ev.kind === 'skip') {
    // 攻撃できなかった理由を出す
    say(`${nm(ev.attacker)}：${SKIP_TEXT[ev.reason]}`);
    $('#message').textContent = message;
    if (a) {
      floatText(a, ev.reason === 'entangle' ? '🕸️' : '✖', 'blocked');
      if (ev.reason === 'silence') fxSilence(a);
    }
    sfx('silence');
    await sleep(650);
    return;
  }
  const t = monEl(ev.target.uid);
  const [num, cls, log] = damageText(ev);
  say(`${nm(ev.attacker)}：${attackLabel(ev)} → ${nm(ev.target)} ${log}${ev.killed ? '　撃破！' : ''}`);
  $('#message').textContent = message;
  if (a) {
    // 追加攻撃は、攻撃側に理由の札を出す
    if (ev.source === 'weapon') floatText(a, '装備', 'tag');
    if (ev.source === 'batter') floatText(a, 'Batter', 'tag');
    if (ev.source === 'craze') floatText(a, 'Craze', 'tag');
  }
  if (ev.heroUsed) heroGlow(state.current); // 攻撃にヒーロースキルが乗った
  // 攻撃の種類ごとの演出（魔法陣と光の弾・渦と雷・矢・踏み込みと斬撃）。着弾の瞬間まで待つ
  if (fxOn()) await fxAttack(ev.type, a, t, ev);
  else {
    sfx(ev.type);
    if (a) a.classList.add('attacking');
    await sleep(330);
  }
  if (t) {
    if (ev.dodged && !ev.missed) fxMiss(t);   // 残像と、横に流れる「MISS」
    else if (ev.missed) sfx('dodge');
    else if (ev.blocked) sfx('block');
    else if (ev.fogged) sfx('block');
    else {
      t.classList.add('hit');
      sfx('hit');
      if (ev.armorDmg > 0 && ev.target.armor === 0) fxShieldBreak(t); // アーマーを割った：盾が割れて「BREAK」
      // 命中の演出（魔法は波紋、遠隔は火花と押し返し、近接は白い光・揺れ・ヒットストップ）
      await fxImpact(ev.type, a, t, ev);
    }
    // 数字：攻撃の種類で色が変わり、大きいダメージほど大きい。カオスはスロットのように回ってから止まる
    if (!(ev.dodged && !ev.missed && fxOn())) {
      const el = popDamage(t, ev, ev.type);
      if (el && ev.type === 'chaos') fxSpinNumber(el, `-${ev.dmg}`);
    }
    updateHpBar(ev.target); // HPバーは、減った分が白く残ってから減る
  }
  await sleep(ev.type === 'chaos' ? 760 : 520);
  if (ev.killed && t) {
    fxDeath(t); // 光の粒になって消える
    await sleep(450);
  }
  for (const x of ev.extras) await playExtra(x);
}

async function endTurn() {
  busy = true;
  selectedUid = inspectUid = null;
  render();
  const foeHasMonsters = state.players[1 - state.current].slots.some(m => m);
  if (foeHasMonsters) await banner('攻撃フェーズ');
  else if (state.players[state.current].slots.some(m => m)) say('相手の場が空なので攻撃フェーズはスキップ');
  let attackCount = 0;
  for (const ev of attackPhase(state)) {
    if (ev.kind === 'phase') { await playSkillEvents(ev.events); continue; } // 攻撃フェーズ開始時のスキル（Mass Bombard）
    attackCount++;
    await playAttack(ev);
    render();
    await sleep(220);
  }
  if (foeHasMonsters && !attackCount) {
    say(`${state.players[state.current].name}：この並びでは攻撃できるモンスターがいない`);
    render();
    await sleep(700);
  }
  // 詰めパズル：攻撃フェーズが終わったら、目標を達成したかを判定する（残りモンスター数では決着しない）
  if (battleMode.type === 'puzzle') { await puzzleAfterAttack(); return; }
  const result = finishTurn(state);
  if (state.endEvents.length) await playSkillEvents(state.endEvents); // ターン終了時のスキル（Outbreak Halo）
  if (state.penalty) {
    // 場が空のペナルティで捨てられたカードを見せる
    const { player, card, from } = state.penalty;
    const text = `${from === 'hand' ? '手札' : '山札'}から${nm(state.penalty)}が捨てられました`;
    say(`${state.players[player].name}：場が空のペナルティ。${text}`);
    render();
    await banner(`${state.players[player].name}：${text}`, true);
  }
  render();
  if (result) {
    await sleep(500);
    showResult(result);
  } else {
    await beginTurn();
  }
}

function showResult(result) {
  busy = true;
  render();
  const win = result.winner === 0;
  const reason = {
    wipeout: `${result.attrition ? '消耗ダメージで' : result.terrain ? '地形の効果で' : ''}${win ? '相手' : '自分'}のモンスターがすべていなくなりました（場・手札・山札）`,
    both: `${result.attrition ? '消耗ダメージで' : ''}両者のモンスターが同時にすべていなくなりました。そのターンの手番だった${win ? 'あなた' : foeName()}の勝ちです`,
    surrender: '降参しました',
  }[result.reason];
  const reasonText = result.penalty
    ? `場が空のペナルティで、${win ? '相手' : '自分'}の最後のモンスターが捨てられました`
    : reason;
  const cls = win ? 'win' : 'lose';
  // 報酬は1試合に1回だけ渡して保存する
  if (!state.reward) {
    bgmMoment('result'); // 曲を止めて、勝利・敗北のジングル（BGM がオフなら効果音）
    if (!bgmJingle(win ? 'win' : 'lose')) sfx(win ? 'win' : 'lose');
    // ダンジョンの戦闘では、通常の報酬（経験値・ゴールド）は出ない。結果は挑戦に反映する
    const dungeon = battleMode.type === 'dungeon';
    state.reward = dungeon ? null : battleReward(profile, result.reason === 'surrender' ? 'surrender' : win ? 'win' : 'loss');
    if (dungeon) dungeonAfterBattle(win);
    // ステージをクリアしたら、星評価と初クリア報酬を記録する
    if (win && battleMode.type === 'stage') {
      state.stageResult = recordStageClear(profile, battleMode.stage.id, monstersLeft(state.players[0]));
      state.stageResult.heroes = unlockHeroes(profile); // ボスを倒すと、新しいヒーローが解放される
    }
    recordHistory(state, win, battleMode); // 対戦履歴に残す
    // イベント：成績を記録し、届いた段階の報酬を渡す（降参は負け）
    if (battleMode.type === 'event') state.eventResult = recordEventBattle(profile, win);
    // デイリークエストの進み具合（降参した対戦は数えない）
    if (result.reason !== 'surrender' && state.reward) state.reward.quests = questProgress(profile, battleStats(state, win, battleMode, state.decks[0])); // 実際に使ったデッキ（貸し出しならそのデッキ）の色で数える
    saveProfile(profile);
  }
  showOverlay(`<div class="result ${cls}">
    <div class="result-icon">${win ? '🏆' : '💀'}</div>
    <h2>${win ? '勝利！' : '敗北…'}</h2>
    <p>${reasonText}</p>
    ${stageResultHtml(state.stageResult)}${eventResultHtml(state.eventResult)}
    ${state.reward ? rewardHtml(state.reward) : ''}
    ${resultButtonsHtml(win)}
  </div>`);
}

// ---------- バトル画面の操作 ----------

// 手札のスクロール：スマホは指でスワイプ、PCはホイール・ドラッグ・スクロールバー
let handDrag = null;      // マウスでドラッグ中 { x, left, moved }
let handScrolled = false; // 直前の操作がスクロールだった（そのクリックでは選択しない）

$('#hand').addEventListener('scroll', updateHandFade);
$('#hand').addEventListener('wheel', e => {
  const hand = $('#hand');
  if (hand.scrollWidth <= hand.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  hand.scrollLeft += e.deltaY; // 縦ホイールを横スクロールにする
  e.preventDefault();
}, { passive: false });
$('#hand').addEventListener('pointerdown', e => {
  handScrolled = false;
  handDrag = { x: e.clientX, left: $('#hand').scrollLeft, moved: false, mouse: e.pointerType === 'mouse' };
});
$('#hand').addEventListener('pointermove', e => {
  if (!handDrag) return;
  const dx = e.clientX - handDrag.x;
  if (Math.abs(dx) > 6) handDrag.moved = true;
  // マウスはドラッグでスクロール（タッチはブラウザのスワイプに任せる）
  if (handDrag.mouse && handDrag.moved && e.buttons === 1) {
    $('#hand').scrollLeft = handDrag.left - dx;
    $('#hand').classList.add('dragging');
  }
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  $('#hand').addEventListener(type, () => {
    if (!handDrag) return;
    // 指やマウスが動いた、またはスクロール位置が変わったなら、タップ（選択）としては扱わない
    handScrolled = handDrag.moved || Math.abs($('#hand').scrollLeft - handDrag.left) > 4;
    handDrag = null;
    $('#hand').classList.remove('dragging');
  });
}
if (typeof window !== 'undefined') window.addEventListener('resize', () => { if (state) layoutHand(); });

$('#hand').addEventListener('click', e => {
  const el = e.target.closest('.card');
  if (handScrolled) { handScrolled = false; return; }
  if (!el || busy) return;
  const uid = Number(el.dataset.uid);
  selectedUid = selectedUid === uid ? null : uid;
  inspectUid = null;
  sfx('tap');
  render();
});

$('#field-0').addEventListener('click', e => {
  const el = e.target.closest('.slot');
  if (!el) return;
  const slot = Number(el.dataset.slot);
  const p = state.players[0];
  const mon = p.slots[slot];
  const h = busy ? null : selectedCard();

  if (h && h.card.kind === 'monster') {
    const at = placementSlot(p, slot);
    const done = playMonster(state, 0, h.uid, slot);
    if (done) {
      sfx('summon');
      say(`${nm(h)}をスロット${at + 1}に召喚${mon ? `（${nm(mon)}たちは後ろへ）` : ''}`);
      selectedUid = null;
      if (done.events.length) { playEnterEvents(done.events); return; }
    } else {
      say(at < 0 ? 'モンスターが3体いっぱいで出せません' : '💎が足りません');
    }
  } else if (h && h.card.kind === 'flash' && mon && flashTarget(h.card) === 'ally') {
    useFlash(h, slot);
    return;
  } else if (h && h.card.kind === 'equip' && mon) {
    const old = mon.item;
    const done = equipItem(state, 0, h.uid, slot);
    if (done) {
      sfx('equip');
      say(`${nm(mon)}に${nm(h)}を装備${old ? `（${old.name}は捨て札）` : ''}`);
      selectedUid = null;
      if (done.events.length) { playEnterEvents(done.events); return; }
    } else if (!canEquip(h.card, mon)) {
      say(`${colorName(h.card.color)}のモンスターにしか装備できません`);
    } else {
      say('💎が足りません');
    }
  } else if (mon) {
    inspectUid = mon.uid;
    selectedUid = null;
  }
  render();
});

$('#field-1').addEventListener('click', e => {
  const el = e.target.closest('.slot');
  if (!el) return;
  const slot = Number(el.dataset.slot);
  const mon = state.players[1].slots[slot];
  if (!mon) return;
  const h = busy ? null : selectedCard();
  if (h && h.card.kind === 'flash' && flashTarget(h.card) === 'enemy') {
    useFlash(h, slot);
    return;
  }
  inspectUid = mon.uid;
  selectedUid = null;
  render();
});

$('#btn-sacrifice').addEventListener('click', () => {
  const p = state.players[0];
  const h = selectedCard();
  if (busy || p.sacrificed) return;
  if (h) {
    const gain = sacGain(sacrificeGain(h.card));
    // カードが炎に包まれて消え、クリスタルが増える
    burnThen(document.querySelector(`#hand .card[data-uid="${h.uid}"]`), () => {
      if (sacrifice(state, 0, h.uid)) {
        say(`${nm(h)}を生贄にした（+${gain}💎）`);
        selectedUid = null;
        render();
        fxCrystalGain($('#info-0'), gain);
      } else render();
    });
    return;
  }
  // 場のモンスターは確認してから
  const mon = p.slots[selectedFieldSlot()];
  if (!mon) return;
  showOverlay(`<div class="result">
    <div class="result-art c-${mon.card.color}">${cardArtHtml(mon.card)}</div>
    <p>${nm(mon)}を生贄にして+${sacGain(CONFIG.SACRIFICE_MONSTER)}クリスタル。装備も失われます。よろしいですか？</p>
    <button class="btn danger big" data-act="sacrifice-field">生贄にする</button>
    <button class="btn big" data-act="cancel">やめる</button>
  </div>`);
});

// 生贄の演出（炎）を見せてから、続きの処理を行う。演出を出さないときはすぐ行う
function burnThen(el, run) {
  if (!fxOn() || !el) { run(); return; }
  busy = true;
  fxSacrifice(el).then(() => { busy = false; run(); });
}

function sacrificeSelectedMonster() {
  const slot = selectedFieldSlot();
  const mon = state.players[0].slots[slot];
  hideOverlay();
  if (busy || !mon) return;
  if (mon.isToken) { say(`${nm(mon)}は召喚モンスターなので、生贄にできません`); render(); return; }
  burnThen(monEl(mon.uid), () => {
    if (sacrificeField(state, 0, slot)) {
      const back = (state.sacEvents || []).map(skillEventText).filter(t => t).join('　');
      say(`場の${nm(mon)}を生贄にした（+${sacGain(CONFIG.SACRIFICE_MONSTER)}💎）${mon.item ? `　${mon.item.name}も失われた` : ''}${back ? '　' + back : ''}`);
      inspectUid = null;
      render();
      fxCrystalGain($('#info-0'), sacGain(CONFIG.SACRIFICE_MONSTER));
    } else render();
  });
}

// コイントスの演出中に画面をタップすると、残りを飛ばす
$('#overlay').addEventListener('click', () => { if (coinSkip) coinSkip(); });
$('#btn-auto').addEventListener('click', toggleAuto);
$('#btn-speed').addEventListener('click', cycleSpeed);

// メッセージ欄をタップでも、対戦ログが開く
$('#message').addEventListener('click', () => {
  if (!state || state.phase === 'over' || state.phase === 'coin') return;
  openLog();
});

// プレイヤー情報のヒーローをタップすると、ヒーロースキルの説明を出す
for (const pi of [0, 1]) {
  $('#info-' + pi).addEventListener('click', () => {
    const hero = state && state.players[pi].hero;
    if (!hero) return;
    const k = HERO_SKILL_INFO[hero.skill];
    message = `${hero.name}のヒーロースキル「${k.name}」：${k.desc}`;
    $('#message').textContent = message;
  });
}

$('#btn-use').addEventListener('click', () => {
  const h = selectedNoTargetFlash();
  if (!busy && h) useFlash(h, -1);
});

$('#btn-end').addEventListener('click', () => { if (!busy) endTurn(); });

$('#btn-surrender').addEventListener('click', () => {
  if (busy) return;
  showOverlay(`<div class="result">
    <h2>降参しますか？</h2>
    <button class="btn danger big" data-act="surrender">降参する</button>
    <button class="btn big" data-act="cancel">つづける</button>
  </div>`);
});

$('#overlay').addEventListener('click', e => {
  const act = e.target.dataset && e.target.dataset.act;
  if (act === 'restart') startBattle();
  if (act === 'title') { hideOverlay(); showScreen('title'); renderTitle(); checkDaily(); }
  if (act === 'cancel') hideOverlay();
  if (act === 'sacrifice-field') sacrificeSelectedMonster();
  if (act === 'surrender') showResult(surrender(state, 0));
});

// ---------- 詳細ツールチップ（PC：カーソルを合わせる／スマホ：長押し） ----------

const SLOT_NAMES = ['スロット1（前列・中央）', 'スロット2（後列・左）', 'スロット3（後列・右）'];
const TYPE_PLACE = {
  melee: 'スロット1（前列）でのみ攻撃できる。前列の敵を攻撃',
  ranged: 'スロット2・3（後列）でのみ攻撃できる。対角の敵を優先',
  magic: 'どのスロットからでも攻撃できる。正面の敵をアーマー無視で攻撃',
  chaos: 'どのスロットからでも攻撃できる。ランダムな敵に1〜攻撃力のダメージ',
};
const FLASH_TARGET_TEXT = { enemy: '相手のモンスター1体', ally: '自分のモンスター1体', none: '対象なし（「使う」ボタンで発動）' };

function tipHead(card, sub) {
  // レアリティ・レベルはカードが持っていれば表示する
  const rarity = card.rarity ? `<span class="r-${card.rarity}">${RARITIES[card.rarity].icon}${RARITIES[card.rarity].name}</span>` : '';
  const extra = [rarity, card.level ? `Lv${card.level}${card.maxLevel ? ` / 最大Lv${card.maxLevel}` : ''}` : ''].filter(Boolean).join(' ');
  return `<div class="tip-head c-${card.color || 'none'}">
    <span class="tip-icon">${cardArtHtml(card)}</span>
    <div class="tip-title"><b>${card.name}</b><small>${[sub, extra].filter(Boolean).join('・')}</small></div>
    <span class="tip-cost">💎${card.cost}</span>
  </div>`;
}

function skillLines(skills) {
  // スキル名をタップすると、辞典の該当ページが開く
  return (skills || []).map(k => `<li${k.opt ? ' class="opt-skill"' : ''}>${SKILLS[k.id].icon}<b class="lk" data-dict="skill:${k.id}">${skillLabel(k)}</b>${k.opt ? '<span class="opt-tag">選択スキル</span>' : ''}：${SKILLS[k.id].desc(k.x)}</li>`);
}

function equipLines(item) {
  const lines = [];
  for (const t in (item.atk || {})) {
    lines.push(`<li>${ATTACK_TYPES[t].icon}<b>${ATTACK_TYPES[t].name}攻撃 +${item.atk[t]}</b>：${ATTACK_TYPES[t].name}攻撃を持たないモンスターには、${ATTACK_TYPES[t].name}攻撃${item.atk[t]}を追加する</li>`);
  }
  if (item.armor) lines.push(`<li>🛡️<b>アーマー +${item.armor}</b>：物理ダメージを肩代わりする盾ゲージ（魔法は防げない）</li>`);
  if (item.hp) lines.push(`<li>❤️<b>体力 +${item.hp}</b></li>`);
  return lines.concat(skillLines(item.skills));
}

// 同色割引の比較：色付き版には無色版を、無色版には色付き版を並べて見せる
function variantNoteHtml(card) {
  if (card.base && CARD_DEFS[card.base]) {
    const b = CARD_DEFS[card.base];
    return `<div class="tip-row up">同色割引：無色版「${b.name}」はコスト${b.cost}（同じ効果で1安い）</div>`;
  }
  const colored = Object.values(CARD_DEFS).filter(d => d.base === card.id);
  if (!colored.length) return '';
  return `<div class="tip-note">色付き版：${colored.map(d => `${COLORS[d.color].name}「${d.name}」コスト${d.cost}`).join('、')}</div>`;
}

// 選択スキルの候補（選んでいるものに印。解放レベル未満なら、その旨を出す）
function optionNoteHtml(card) {
  if (!card.options) return '';
  const open = optionAvailable(card.id, card.level);
  const list = card.options.map((k, i) =>
    `<li class="${card.option === i ? 'opt-skill' : 'dim'}">${card.option === i ? '◉' : '○'} ${SKILLS[k.id].icon}<b>${skillLabel(k)}</b></li>`).join('');
  return `<div class="tip-sub">選択スキルの候補${open ? '（コレクションで1つ選べる）' : `（カードLv${card.optionLevel}で解放）`}</div><ul>${list}</ul>`;
}

// 手札・デッキ編集のカード
function cardTipHtml(card) {
  if (card.kind === 'monster') {
    const t = ATTACK_TYPES[card.type];
    return `${tipHead(card, `モンスター・${colorName(card.color)}`)}
      <div class="tip-row">❤️ HP <b>${card.hp}</b>　${t.icon}${t.name} <b>${card.atk}</b>${card.armor ? `　🛡️ アーマー <b>${card.armor}</b>` : ''}</div>
      <ul><li>${t.icon}${t.name}：${TYPE_PLACE[card.type]}</li>${skillLines(card.skills).join('')}</ul>
      ${optionNoteHtml(card)}
      ${levelTableHtml(card)}`;
  }
  if (card.kind === 'equip') {
    const who = card.color ? `${colorName(card.color)}のモンスターのみ` : 'すべての色のモンスター';
    return `${tipHead(card, `装備・${colorName(card.color)}`)}
      <ul>${equipLines(card).join('')}</ul>
      <div class="tip-row">装備できる色：<b>${who}</b></div>
      ${optionNoteHtml(card)}
      ${variantNoteHtml(card)}
      ${levelTableHtml(card)}
      <div class="tip-note">1体につき1個。付け替えると古い装備は捨て札。</div>`;
  }
  // じゃまカード（がらくた・凶札）：使えない
  if (card.junk) return `${tipHead(card, 'じゃまカード')}
    <ul><li>使えないカード。相手のスキルで、山札に入れられた。</li><li>生贄にはできる（クリスタル+${CONFIG.SACRIFICE_ITEM}）。</li></ul>`;
  return `${tipHead(card, `フラッシュ（使い切り）・${colorName(card.color)}`)}
    <ul>${skillLines(card.skills).join('')}</ul>
    <div class="tip-row">対象：<b>${FLASH_TARGET_TEXT[flashTarget(card)]}</b></div>
    ${card.color ? `<div class="tip-row">使える条件：<b>${colorName(card.color)}のモンスターが自分の場にいるとき</b></div>` : ''}
    ${variantNoteHtml(card)}
    ${levelTableHtml(card)}`;
}

// 場のモンスター（今のステータス）
function monTipHtml(mon, slot, owner) {
  const c = mon.card;
  const item = mon.item;
  const hpNote = item && item.hp ? `<span class="up">（${item.name} +${item.hp}）</span>` : '';
  // 攻撃タイプごとの攻撃力。変化している値は「元 → 今（理由）」を色付きで出す
  const atkRows = getAttacks(mon).map(a => {
    const t = ATTACK_TYPES[a.type];
    let value = `<b>${a.atk}</b>`;
    if (a.mods.length) {
      const cls = a.atk > a.base ? 'up' : a.atk < a.base ? 'down' : '';
      const why = a.mods.map(m => `<span class="${m.x > 0 ? 'up' : 'down'}">${m.label} ${m.x > 0 ? '+' : ''}${m.x}</span>`).join('、');
      value = `${a.base} → <b class="${cls}">${a.atk}</b>（${why}）`;
    }
    let block = '';
    if (!canUseType(mon, a.type, slot)) block = `🚫 この位置では${t.name}攻撃できません`;
    else if (a.type === 'magic' && mon.status.silence) block = '🔇 Silenceで魔法攻撃できません';
    else if (a.atk <= 0) block = '🚫 攻撃力が0のため攻撃できません';
    return `<li class="${block ? 'off' : ''}">${t.icon}${t.name} ${value}${block ? `<br><span class="down">${block}</span>` : ''}</li>`;
  });
  const skills = skillLines(c.skills);
  const status = statusList(mon).map(x => {
    const info = statusInfo(x);
    return `<li class="${x.good ? 'up' : 'down'}">${info.icon}<b>${info.name}${x.n === '' ? '' : ' ' + x.n}</b>：${info.text(x.n)}</li>`;
  });
  let note = '';
  if (mon.status.entangle) note = '🕸️ 拘束されていて、攻撃もスキルも使えません';
  else if (!canAttackFrom(mon, slot)) note = '💤 前が倒れて繰り上がるまで攻撃しません（盾として残ります）';
  return `${tipHead(mon.copy ? { ...c, name: nm(mon) } : c, `${colorName(c.color)}・${owner}の${SLOT_NAMES[slot]}`)}
    <div class="tip-row">❤️ HP <b>${mon.hp}</b> / ${mon.maxHp}${hpNote}${mon.bonusAtk ? `<span class="up">（Swallow +${mon.bonusAtk}）</span>` : ''}　🛡️ アーマー <b>${mon.armor}</b></div>
    <div class="tip-sub">攻撃</div><ul>${atkRows.join('')}</ul>
    ${note ? `<div class="tip-note">${note}</div>` : ''}
    ${skills.length ? `<div class="tip-sub">スキル${mon.status.entangle ? '（拘束中は無効）' : ''}</div><ul>${skills.join('')}</ul>` : ''}
    <div class="tip-sub">装備</div>
    ${item ? `<div class="tip-row"><span class="tip-mini">${itemArt(item)}</span><b>${item.name}</b></div><ul>${equipLines(item).join('')}</ul>` : '<div class="tip-row dim">なし</div>'}
    <div class="tip-sub">状態異常・強化</div>
    ${status.length ? `<ul>${status.join('')}</ul>` : '<div class="tip-row dim">なし</div>'}
    ${attritionTipRow()}`;
}

// 表示中の対象。{ type: 'mon' | 'hand' | 'deck', key }
let tipRef = null;

function tipRefOf(el) {
  if (el.classList.contains('mon')) return { type: 'mon', key: Number(el.dataset.uid) };
  if (el.dataset.uid) return { type: 'hand', key: Number(el.dataset.uid) };
  return { type: 'deck', key: el.dataset.id, lv: Number(el.dataset.lv) || 0 }; // lv: ダンジョンなど、手持ちとは別のレベルで見せるとき
}

function tipElOf(ref) {
  if (ref.type === 'mon') return monEl(ref.key);
  if (ref.type === 'hand') return document.querySelector(`#hand .card[data-uid="${ref.key}"]`);
  // 同じカードが複数の画面にあるので、いま見えているものを選ぶ
  return [...document.querySelectorAll(`.deck-grid .card[data-id="${ref.key}"]`)].find(el => el.offsetParent !== null) || null;
}

function tipHtmlOf(ref) {
  if (ref.type === 'deck') return CARD_DEFS[ref.key] ? cardTipHtml(ref.lv ? cardAt(ref.key, ref.lv) : ownedCard(profile, ref.key)) : null;
  if (!state) return null;
  if (ref.type === 'hand') {
    const h = state.players[0].hand.find(c => c.uid === ref.key);
    if (!h) return null;
    return cardTipHtml(h.card) + (h.card.kind === 'monster' ? attritionTipRow() : '');
  }
  for (const pl of state.players) {
    const slot = pl.slots.findIndex(m => m && m.uid === ref.key);
    if (slot >= 0) return monTipHtml(pl.slots[slot], slot, pl.name);
  }
  return null;
}

function hideTip() {
  tipRef = null;
  $('#tip').classList.remove('show');
}

// 対象の上（入らなければ下）に出し、画面の端からはみ出さないように寄せる
function showTip(ref) {
  const el = tipElOf(ref);
  const html = tipHtmlOf(ref);
  if (!el || !html) { hideTip(); return; }
  const tip = $('#tip');
  tipRef = ref;
  tip.innerHTML = html;
  tip.classList.add('show');
  const app = $('#app').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight, gap = 8;
  const left = Math.max(gap, Math.min(r.left - app.left + r.width / 2 - w / 2, app.width - w - gap));
  let top = r.top - app.top - h - gap;
  if (top < gap) top = r.bottom - app.top + gap;
  if (top + h > app.height - gap) top = Math.max(gap, app.height - h - gap);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

// 描き直しのたびに中身を最新にする（攻撃アニメーション中もHPなどが追従する）
function refreshTip() {
  if (!tipRef) return;
  const html = tipHtmlOf(tipRef);
  if (html) $('#tip').innerHTML = html;
  else hideTip();
}

let tipHideTimer = null;
const tipTarget = e => (e.target.closest ? e.target.closest('.mon, .card') : null);

// PC：カーソルを合わせると表示、外すと消える
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  clearTimeout(tipHideTimer);
  if (e.target.closest && e.target.closest('#tip')) return; // ツールチップの上にいる間は消さない（スキル名を押せるように）
  const el = tipTarget(e);
  if (el) showTip(tipRefOf(el));
  else tipHideTimer = setTimeout(hideTip, 260);          // 少し待ってから消す（ツールチップへ移動する時間）
});
document.documentElement.addEventListener('mouseleave', hideTip);

// スマホ：長押しで表示、指を離すと消える。長押し後のタップ扱い（選択・配置）は打ち消す
const LONG_PRESS_MS = 450;
let pressTimer = null;
let pressAt = null;
let suppressClick = false;

function cancelPress() {
  clearTimeout(pressTimer);
  pressTimer = null;
}

document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  if (e.target.closest && e.target.closest('#tip')) return; // ツールチップの中のスキル名をタップできるように
  hideTip();
  cancelPress();
  const el = tipTarget(e);
  if (!el) return;
  // 手札のカードを選んでいる間（出す・装備する・使う相手を選んでいる間）は、場のモンスターやスロットを
  // 長めに押しても説明を出さない。タップがそのまま「ここに使う」になる
  if (selectedUid !== null && el.closest('.field')) return;
  const ref = tipRefOf(el);
  pressAt = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    pressTimer = null;
    suppressClick = true;
    showTip(ref);
  }, LONG_PRESS_MS);
});
document.addEventListener('pointermove', e => {
  if (pressTimer && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 10) cancelPress();
});
for (const type of ['pointerup', 'pointercancel']) {
  document.addEventListener(type, e => {
    if (e.pointerType === 'mouse') return;
    cancelPress();
    // 長押しで出したツールチップは、指を離しても残す（次に別の場所をタップすると消える）
    setTimeout(() => { suppressClick = false; }, 350);
  });
}
document.addEventListener('click', e => {
  if (!suppressClick) return;
  suppressClick = false;
  e.stopPropagation();
  e.preventDefault();
}, true);
document.addEventListener('contextmenu', e => { if (tipTarget(e)) e.preventDefault(); });

