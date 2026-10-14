// ============================================================
// 攻略本（guide.html）を作る道具
//   ゲームのデータファイルと、シミュレーションの結果（guide/sim-*.json）から、1つのHTMLを組み立てる。
//   数値は手で書き写さない。カード・スキル・ステージなどは、すべてゲームのデータから作る。
//   作り方： ./build-guide.sh （シミュレーションもやり直すなら ./build-guide.sh --sim）
// ============================================================

const SIM = {
  a: JSON.parse(read('guide/sim-a.json')), b: JSON.parse(read('guide/sim-b.json')),
  c: JSON.parse(read('guide/sim-c.json')), d: JSON.parse(read('guide/sim-d.json')),
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const R = RARITIES;
const colorName = c => (c ? COLORS[c].name : '無色');
const allCards = [...MONSTERS, ...ELITES, ...ITEMS];
const kindName = { monster: 'モンスター', equip: '装備', flash: 'フラッシュ' };
const skillTag = (k, x) => `${SKILLS[k].icon}${SKILLS[k].name}${x !== undefined && !SKILLS[k].noX ? ' ' + x : ''}`;
const skillsText = list => (list || []).map(k => skillTag(k.id, k.x)).join('　');
const src = (games, what) => `<span class="src">根拠：${games.toLocaleString ? games.toLocaleString() : games}${what}のシミュレーション結果</span>`;
const pctBar = (v, max = 100) => `<span class="bar"><i style="width:${Math.max(0, Math.min(100, 100 * v / max))}%"></i><b>${v}%</b></span>`;

// ---------- カードの見た目（ゲームと同じ絵・同じ色） ----------

function cardArt(c) { return c.kind === 'monster' ? monsterArt(c) : itemArt(c); }
function statsText(c) {
  if (c.kind === 'monster') return `${ATTACK_TYPES[c.type].icon}${c.atk}　❤️${c.hp}${c.armor ? `　🛡️${c.armor}` : ''}`;
  if (c.kind === 'flash') return skillsText(c.skills);
  const parts = [];
  for (const t in c.atk || {}) parts.push(`${ATTACK_TYPES[t].icon}+${c.atk[t]}`);
  if (c.armor) parts.push(`🛡️+${c.armor}`);
  if (c.hp) parts.push(`❤️+${c.hp}`);
  return parts.join('　');
}
// 小さなカード（一覧・デッキ表示用）
function miniCard(id, level = 1, extra = '') {
  const c = cardAt(id, level);
  return `<a class="mc c-${c.color || 'none'} r-${c.rarity}${CARD_DEFS[id].elite ? ' elite' : ''}" href="#card-${id}" title="${esc(c.name)}">
    <span class="mc-cost">${c.cost}</span><span class="mc-art">${cardArt(c)}</span><span class="mc-name">${esc(c.name)}</span><span class="mc-st">${statsText(c)}</span>${extra}</a>`;
}

// ---------- 盤面の図（エンジンで実際に攻撃させて、その結果を書く） ----------
// 図の説明は手で書かず、puzzle.js の盤面づくりと engine.js の攻撃フェーズで起きたことをそのまま文にする。
// だから、図の内容がゲームの動きと食い違うことはない（guide/check.js でも同じ盤面を確かめる）。

const RULE_SCENES = [
  { id: 'order', title: '攻撃はスロット3 → 2 → 1 の順', me: ['y02', 'b02', 'y03'], foe: [{ id: 'g06', hp: 13 }], note: '自分のスロット3（右の後列）から順に攻撃する。' },
  { id: 'melee', title: '近接は前列（スロット1）からだけ', me: ['y03', 'r02'], foe: ['g06'], note: '前列の遠隔モンスターと、後列の近接モンスターは攻撃できない。並べ方が逆。' },
  { id: 'magic', title: '魔法は正面（同じ番号のスロット）を狙う', me: ['y02', 'b02', 'b01'], foe: ['g06', { id: 'g01', hp: 5 }], note: 'スロット2の魔法は相手のスロット2を狙う。正面にいなければ前列を狙う。' },
  { id: 'ranged', title: '遠隔は対角を先に狙う', me: ['y02', 'y03', 'y04'], foe: ['b06', { id: 'g01', hp: 9 }, { id: 'p01', hp: 9 }], fixed: {}, note: 'スロット2からは相手のスロット3、スロット3からは相手のスロット2を狙う。対角にいなければ正面、それもいなければ前列。', start: false },
  { id: 'taunt', title: 'Taunt 持ちがいると、遠隔はそこへ', me: ['y02', 'y03'], foe: ['g06', { id: 'g01', hp: 9 }], note: '大樹の古老は Taunt 持ち。遠隔攻撃は後列ではなく、Taunt 持ちに向かう。', start: false },
  { id: 'compact', title: '倒されると、後ろが前に詰める', me: ['r05'], foe: [{ id: 'g01', hp: 2 }, { id: 'p01', hp: 4 }], note: '連撃の拳闘士（Batter 1）は近接を2回行う。1回目で前列を倒すと、後ろが前に詰め、2回目はその相手に当たる。' },
  { id: 'armor', title: 'アーマーは物理を止め、魔法は素通し', me: ['r07', 'b02'], foe: [{ id: 'y02', item: 'e06', hp: 8 }], note: '魔法（氷柱の見習い）はアーマーを無視してHPを減らす。近接（紅蓮の将軍）はアーマーを削るだけで、余ったダメージは消える。', start: false },
  { id: 'thorns', title: 'Thorns：近接で殴ると跳ね返る', me: ['r02'], foe: ['g04'], note: 'いばらの番人（Thorns 2）を近接で殴ると、殴った側が2ダメージを受ける。' },
];

function sceneState(sc) {
  return buildPuzzle({ id: 'guide', level: 'beginner', goal: { type: 'wipe' }, me: { field: sc.me, crystals: 0 }, foe: { field: sc.foe }, fixed: sc.fixed || {}, start: sc.start });
}
// その盤面で攻撃フェーズを進め、起きた攻撃を [{ from, type, to, dmg, armorDmg, killed, extras }] で返す
function sceneAttacks(sc) {
  const s = sceneState(sc);
  const out = [];
  const slotOf = (p, m) => p.slots.indexOf(m);
  // 攻撃の前の位置を覚えておく（倒れると詰めて番号が変わるため）
  for (const ev of attackPhase(s)) {
    if (ev.kind === 'skip') { out.push({ skip: true, name: ev.attacker.card.name, reason: ev.reason, type: ev.type }); continue; }
    if (ev.kind !== 'attack') continue;
    out.push({ name: ev.attacker.card.name, from: slotOf(s.players[0], ev.attacker), type: ev.type, to: ev.target.card.name, dmg: ev.dmg, armorDmg: ev.armorDmg, killed: ev.killed,
      extras: ev.extras.map(x => ({ kind: x.kind, target: x.target ? x.target.card.name : '', dmg: x.dmg || 0, killed: !!x.killed })) });
  }
  return { attacks: out, idle: s.players[0].slots.filter((m, i) => m && !canAttackFrom(m, i)).map(m => m.card.name) };
}
function sceneBoardHtml(sc) {
  const s = sceneState(sc);
  const cell = (p, i) => {
    const m = p.slots[i];
    if (!m) return `<div class="slot empty"><i>${i + 1}</i></div>`;
    const c = m.card;
    const atks = getAttacks(m).map(a => `${ATTACK_TYPES[a.type].icon}${a.atk}`).join(' ');
    return `<div class="slot c-${c.color}"><i>${i + 1}</i><span class="slot-art">${monsterArt(c)}</span><b>${esc(c.name)}</b><small>${atks}　❤️${m.hp}${m.armor ? `　🛡️${m.armor}` : ''}</small></div>`;
  };
  // 画面と同じ並び：左＝スロット2、中央＝スロット1、右＝スロット3
  const row = (p, cls) => `<div class="field ${cls}">${[1, 0, 2].map(i => cell(p, i)).join('')}</div>`;
  return `<div class="board">${row(s.players[1], 'foe')}<div class="vs">▲ 相手　／　自分 ▼</div>${row(s.players[0], 'me')}</div>`;
}
function sceneResultHtml(sc) {
  const r = sceneAttacks(sc);
  const lines = r.attacks.map(a => {
    if (a.skip) return `<li class="skip">${esc(a.name)}：${a.reason} のため攻撃できない</li>`;
    const res = [a.dmg ? `${a.dmg}ダメージ` : '', a.armorDmg ? `アーマー-${a.armorDmg}` : '', !a.dmg && !a.armorDmg ? 'ダメージ0' : '', a.killed ? '<b class="ko">撃破</b>' : ''].filter(x => x).join('・');
    const ex = a.extras.map(x => `<span class="ex">${SKILLS[x.kind] ? SKILLS[x.kind].name : x.kind}：${esc(x.target)}に${x.dmg}ダメージ${x.killed ? '（撃破）' : ''}</span>`).join('');
    return `<li>スロット${a.from + 1}の<b>${esc(a.name)}</b>（${ATTACK_TYPES[a.type].icon}${ATTACK_TYPES[a.type].name}）→ <b>${esc(a.to)}</b>：${res}${ex}</li>`;
  });
  const idle = r.idle.length ? `<li class="skip">攻撃できない位置にいる：${r.idle.map(esc).join('・')}</li>` : '';
  return `<ol class="atk-log">${lines.join('')}${idle}</ol>`;
}
function ruleSceneHtml(sc) {
  return `<figure class="scene keep" id="scene-${sc.id}"><figcaption>${esc(sc.title)}</figcaption>${sceneBoardHtml(sc)}
    <div class="scene-res"><div class="scene-cap">この盤面でターン終了すると（ゲームの処理で実際に計算した結果）</div>${sceneResultHtml(sc)}<p>${esc(sc.note)}</p></div></figure>`;
}

// ---------- 評価（シミュレーションの結果からランクを付ける） ----------

const RATE3 = Object.fromEntries(SIM.a.cards3.cards.map(c => [c.key, c]));
const RATE1 = Object.fromEntries(SIM.a.cards1.cards.map(c => [c.key, c]));
const ELITE_RATE = Object.fromEntries(SIM.a.elites.cards.map(c => [c.key, c]));
const RANK_RULE = [['S', 55], ['A', 52], ['B', 48], ['C', 0]]; // 採用時の勝率（カードLv3）がこの値以上
function rankOf(id) {
  const r = RATE3[id] || ELITE_RATE[id];
  if (!r) return { rank: '-', rate: null };
  return { rank: RANK_RULE.find(x => r.rate >= x[1])[0], rate: r.rate, n: r.n };
}
const rankBadge = id => { const r = rankOf(id); return `<span class="rank rank-${r.rank}">${r.rank}</span>`; };

// ---------- おすすめデッキ ----------

const TIER_LABEL = { beginner: '初心者向け', middle: '中級者向け', advanced: '上級者向け' };
// 段階ごとの条件の説明（探したときの条件は、シミュレーションの結果に入っている）
const TIER_NOTE = Object.fromEntries(Object.keys(SIM.b.tiers).map(k => { const t = SIM.b.tiers[k]; const top = t.rarities[t.rarities.length - 1];
  return [k, `カードLv${t.level}。${t.rarities.map(r => RARITIES[r].name).join('・')}が使える（${Object.keys(t.cap).map(r => `${RARITIES[r].name}は${t.cap[r]}枚まで`).join('、')}）`]; }));
const GDECKS = SIM.b.decks.map((d, i) => {
  const hero = HERO_BY_ID[d.deck.hero.id];
  const skill = hero.skills.findIndex(k => k.id === d.deck.hero.skill);
  const level = Math.max(...Object.values(d.deck.levels));
  const mons = d.deck.monsters.map(id => cardAt(id, d.deck.levels[id]));
  const types = {};
  mons.forEach(c => { types[c.type] = (types[c.type] || 0) + 1; });
  const all = [...d.deck.monsters, ...d.deck.items];
  const avg = Math.round(10 * all.reduce((n, id) => n + CARD_DEFS[id].cost, 0) / all.length) / 10;
  const colors = Object.keys(COLORS).filter(c => mons.some(m => m.color === c));
  return { ...d, i, hero, skill, level, types, avg, colors, name: `${COLORS[d.main].name}の${{ beginner: '入門', middle: '中級', advanced: '上級' }[d.tier]}デッキ`,
    code: deckToCode({ monsters: d.deck.monsters, items: d.deck.items, hero: hero.id, skill }) };
});
