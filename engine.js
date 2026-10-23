// ============================================================
// ゲームルール本体（画面には触らない）
// ============================================================

const CONFIG = {
  INITIAL_HAND: 4,        // 初期手札
  CRYSTALS_PER_TURN: 3,   // ターン開始時にもらえるクリスタル
  DECK_MONSTERS: 8,
  DECK_ITEMS: 8,
  DECK_COPIES: 2,         // 同じカードをデッキに入れられる枚数
  DECK_COPIES_LEGEND: 1,  // レジェンドは1枚まで（2枚入れると強くなりすぎるため）
  SACRIFICE_ITEM: 1,      // 生贄で得るクリスタル
  SACRIFICE_MONSTER: 2,
  SECOND_PLAYER_BONUS: 1, // 後攻が最初から持っているクリスタル（先攻有利の補正）
  SECOND_PLAYER_LATE: { turn: 8, bonus: 1 }, // 後攻は、このターン（自分の4回目の番）の開始時にも、クリスタルをもらう。先攻勝率を50%に近づけるための補正
  FALLEN_CRYSTAL: 1,      // 場のモンスターが倒されたとき、持ち主がもらえるクリスタル（0にすると、このルールなし）
  RANGED_BLOCK_CHANCE: 0.25, // アーマー持ちが遠隔攻撃をブロックする確率
  FLYING_DODGE_MELEE: 0.5,   // Flying が近接攻撃・Doublestrike を回避する確率
  FLYING_DODGE_RANGED: 0.25, // Flying が遠隔攻撃を回避する確率
  ENTANGLE_CHANCE: 0.5,      // Entangle が成功する確率
  COUNTER_CHANCE: 0.5,       // Counter-Attack・Magic Counter が発動する確率
  CROSS_COUNTER_MAX: 3,      // Cross-Counter-Attack が1ターンに発動できる回数
  MAGIC_REFLECT_CHANCE: 0.75, // Magic Reflect が発動する確率
  MAGIC_REFLECT_MAX: 5,       // Magic Reflect が1ターンに発動できる回数
  DEFLECT_CHANCE: 0.75,       // Deflect が遠隔攻撃を跳ね返す確率
  GROW_CAP: 6,                // 永続で育つスキル（Grudge・Keen Eye・Bloom・Leech）で、1体が増やせる合計の上限
  ECHO_MAX: 3,                // Echo が跳ねる回数の上限
  ATTRITION_START: 27,    // このターンから、ターン開始時に場の全モンスターが消耗ダメージを受ける
  ATTRITION_STEP: 4,      // 消耗ダメージが+1されるターン間隔
  ATTRITION_NOTICE: 3,    // 開始の何ターン前から予告するか（CPUもここから決めにいく）
  AUTO_KEEP_MONSTERS: 5,  // オートバトル（自分の番の自動操作）は、残りモンスターがこの数以下ならモンスターを生贄にしない
  CPU_KEEP_MONSTERS: 3,   // CPUは残りモンスターがこの数以下ならモンスターを生贄にしない
};

// スロットごとに攻撃できるタイプ（添字0=スロット1=前列中央、1=スロット2=左、2=スロット3=右）
const SLOT_TYPES = [
  ['melee', 'magic', 'chaos'],
  ['ranged', 'magic', 'chaos'],
  ['ranged', 'magic', 'chaos'],
];

let uidSeq = 1;

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makePlayer(name, isCpu, deckIds, rng) {
  // デッキは { monsters: [id], items: [id], levels: { id: レベル } }。levels にないカードはLv1
  const levels = deckIds.levels || {};
  const options = deckIds.options || {}; // options: { id: 選択スキルの番号 }
  const freeOptions = !!deckIds.freeOptions; // true なら選択スキルにレベルの条件がない（ダンジョンのデッキ）
  // 同じカードが2枚入っていても、1枚ずつ別の番号（uid）を持つ別々のカードとして扱う。
  // copy: 同じカードが複数あるときの通し番号（1, 2）。1枚だけなら 0。ログや表示で「①②」と区別するのに使う
  const ids = [...deckIds.monsters, ...deckIds.items];
  const seen = {};
  const deck = ids.map(id => {
    seen[id] = (seen[id] || 0) + 1;
    return { uid: uidSeq++, card: cardAt(id, levels[id] || 1, options[id], freeOptions), copy: ids.indexOf(id) !== ids.lastIndexOf(id) ? seen[id] : 0 };
  });
  // 初手に1ターン目から出せるモンスターが1体は入るように切り直す（事故負け防止）
  const openable = h => h.card.kind === 'monster' && h.card.cost <= CONFIG.CRYSTALS_PER_TURN;
  for (let i = 0; i < 30; i++) {
    shuffle(deck, rng);
    if (!deck.some(openable) || deck.slice(0, CONFIG.INITIAL_HAND).some(openable)) break;
  }
  return {
    name, isCpu,
    hero: deckIds.hero || null, // ヒーロー { id, name, skill: ヒーロースキルのid }（なければ null）
    hand: deck.splice(0, CONFIG.INITIAL_HAND),
    deck,
    crystals: 0,
    slots: [null, null, null],
    discard: [],            // 捨て札（外された装備・使ったフラッシュ）
    sacrificed: false,
  };
}

// 確率の判定。パズル（state.fixed あり）では運をなくし、問題ごとに決めた結果（state.fixed[key]）を返す
//   key: miss=地形で外れる / dodge=Flying の回避 / block=遠隔のブロック / reflect=Magic Reflect / counter=Counter-Attack・Magic Counter / entangle=Entangle
function roll(state, key, chance) { return state.fixed ? !!state.fixed[key] : state.rng() < chance; }
// n個の中からランダムに選ぶ番号。パズルでは、いつも最初（前から数えて最初）を選ぶ
function pickRandom(state, n) { return state.fixed ? 0 : Math.floor(state.rng() * n); }

// お守り（ダンジョン専用の特殊効果。dungeon.js）を、そのプレイヤーが持っているか。通常の対戦では誰も持っていない
function charm(p, id) { return !!(p && p.charms && p.charms[id]); }

//   opts.terrain: 地形のid（terrains.js）。省略すると地形なし
//   opts.charms:  プレイヤー0が持っているお守りの id の一覧（ダンジョン）
function newGame(playerDeck, cpuDeck, rng = Math.random, opts = {}) {
  const state = {
    rng,
    terrain: TERRAIN_BY_ID[opts.terrain] || null,
    rules: opts.rules || {}, // イベントの特殊ルール（events.js）。通常の対戦では空
    decks: [playerDeck, cpuDeck], // 両者のデッキ（対戦履歴に残す）
    log: [],         // 対戦ログ（コンパクトな配列の並び。形式は下の「対戦ログの記録」を参照）
    moveBuf: [],     // 詰めで動いたモンスター（次のログの直後に書き出す）
    fallBuf: [],     // 倒されてクリスタルをもらった記録（次のログの直後に書き出す）
    tally: [{ dmg: 0, kills: 0, by: {} }, { dmg: 0, kills: 0, by: {} }], // 試合のまとめ用：与えたダメージ・倒した数・モンスターごとの与ダメージ
    stats: [{}, {}], // プレイヤーごとに数えた値（クエスト用）：kill_攻撃タイプ・dodge・flash・equip
    turn: 0,
    current: rng() < 0.5 ? 0 : 1,   // コイントス
    phase: 'coin',                  // coin → play → attack → … → over
    result: null,
    players: [
      makePlayer('あなた', false, playerDeck, rng),
      makePlayer('CPU', true, cpuDeck, rng),
    ],
  };
  state.players[1 - state.current].crystals = CONFIG.SECOND_PLAYER_BONUS;
  if (opts.charms && opts.charms.length) {
    const me = state.players[0];
    me.charms = {};
    opts.charms.forEach(id => { me.charms[id] = true; });
    if (charm(me, 'gem')) me.crystals += 1;                                   // 対戦開始時のクリスタル+1
    if (charm(me, 'hand') && me.deck.length) me.hand.push(me.deck.shift());   // 最初の手札+1
  }
  state.first = state.current;                 // コイントスで決まった先攻（対戦中ずっと変わらない）
  state.log.push(['C', state.first]);          // 対戦ログの最初に、コイントスの結果を残す
  state.players.forEach(p => { p.terrain = state.terrain; p.rules = state.rules; }); // モンスターから（持ち主を通して）地形を見られるようにする
  linkPlayers(state);
  return state;
}

// ---------- 対戦ログの記録 ----------
// state.log に、起きたことを短い配列で順に記録する（表示は battlelog.js）。モンスターは「持ち主の番号＋カードid」で表す。
//   ['C', 先攻]                                 コイントスの結果（ログの最初）
//   ['T', ターン, 手番]                         ターンの開始
//   ['P', 側, カードid, スロット, [押し出された]]   モンスターを出した
//   ['E', 側, 装備id, 対象, 外した装備id|0]       装備した
//   ['F', 側, カードid, 対象|0, {結果}]           フラッシュを使った
//   ['S', 側, カードid, もらったクリスタル, 場か]   生贄にした
//   ['A', 側, 攻撃者, 種類, 対象, {結果}]          攻撃
//   ['s', 側, モンスター, 理由, 種類]              攻撃できなかった
//   ['k', 側, 種類, 発動者|0, [対象], {結果}]      スキルなどの効果（単独）
//   ['x', …同じ…]                               直前の行動に続いて起きた効果
//   ['B', ダメージ, [[対象, 倒れたか]]]            消耗ダメージ
//   ['L', 側, 種類, [[対象, 量, 倒れたか]]]        地形の効果
//   ['M', 側, [詰めて動いたモンスター]]
//   ['X', 側, モンスター, 状態]                   状態異常が解けた
//   ['Y', 側, カードid, 'hand'/'deck']           場が空のペナルティ
//   ['W', 側, 数]                                後攻ボーナス（2回目）のクリスタル
//   ['G', 側, モンスター, 数]                     場で倒されて、持ち主がクリスタルをもらった
//   ['N', 側, 種類, …]                           オート（つよい）の判断理由（autoai.js）
//   ['R', 勝者, 理由]                            決着
function logRef(state, mon) {
  if (!mon) return 0;
  const side = state.players.indexOf(mon.owner);
  return (side < 0 ? 0 : side) + logCardRef(mon);
}
// カードid（同じカードが複数あるときは「~番号」を付ける）。mon: 場のモンスター、または手札・山札の1枚
function logCardRef(mon) { return mon.card.id + (mon.copy ? '~' + mon.copy : ''); }

// 書き出したあとに、詰めの移動を続けて書き、決着の行をいちばん最後に回す
function logPush(state, ...entries) {
  if (!state.log) return;
  state.log.push(...entries);
  for (const [side, refs] of state.moveBuf) state.log.push(['M', side, refs]);
  state.moveBuf = [];
  if (state.fallBuf && state.fallBuf.length) { state.log.push(...state.fallBuf); state.fallBuf = []; }
  const i = state.log.findIndex(e => e[0] === 'R');
  if (i >= 0 && i < state.log.length - 1) state.log.push(state.log.splice(i, 1)[0]);
}

// イベントの結果を、短い名前の項目にまとめる（0や false は書かない）
function logOpts(state, ev) {
  const o = {};
  const put = (k, v) => { if (v) o[k] = v === true ? 1 : v; };
  if (ev.x != null) o.x = ev.x;
  put('d', ev.dmg); put('a', ev.armorDmg); put('sh', ev.shielded); put('h', ev.heal); put('c', ev.cured); put('g', ev.gain);
  put('K', ev.killed); put('dg', ev.dodged); put('ms', ev.missed); put('bl', ev.blocked); put('fg', ev.fogged); put('rf', ev.reflected); put('gd', ev.guarded); put('im', ev.immune);
  put('u', ev.unsummoned); if (ev.taxed != null) { o.tx = ev.taxed; o.x = ev.skill.x; } if (ev.purged != null) o.pg = ev.purged; if (ev.summoned && ev.summoned[0]) { o.sm = ev.summoned[0].card.id; o.sn = ev.summoned.length; } put('tr', ev.trickery); put('st', ev.seeThrough); put('hb', ev.heroBonus);
  if (ev.success != null) o.ok = ev.success ? 1 : 0;
  if (ev.skill) o.sk = typeof ev.skill === 'string' ? ev.skill : ev.skill.id;
  put('rs', ev.reason); put('ef', ev.effect); put('id', ev.id); put('sd', ev.shield);
  if (ev.other) o.ot = logRef(state, ev.other);
  if (ev.item) o.it = ev.item.id;
  if (ev.kind === 'attack' && ev.source !== 'base') o.src = ev.source;
  return o;
}

// スキルなどの効果1つ。code: 'k'=単独 / 'x'=直前の行動に続く効果
function logSkill(state, ev, code = 'k') {
  const src = ev.source && ev.source.card ? ev.source : null;
  const first = src || ev.target || (ev.targets || [])[0];
  const side = ev.kind === 'hero' ? (ev.side === 'foe' ? 1 - state.current : state.current)
    : src ? state.players.indexOf(src.owner) : state.current;
  const targets = ev.targets || (ev.target ? [ev.target] : []);
  return [code, first && side < 0 ? state.current : side, ev.kind, logRef(state, src), targets.map(t => logRef(state, t)), logOpts(state, ev)];
}

// 攻撃フェーズのイベント1つ
function logAttackEvent(state, ev) {
  const side = state.current;
  if (ev.kind === 'phase') return logPush(state, ...ev.events.map(e => logSkill(state, e)));
  if (ev.kind === 'skip') return logPush(state, ['s', side, logRef(state, ev.attacker), ev.reason, ev.type || 0]);
  logPush(state, ['A', side, logRef(state, ev.attacker), ev.type, logRef(state, ev.target), logOpts(state, ev)],
    ...ev.extras.map(x => logSkill(state, x, 'x')));
}

// クエスト用に数える
function countStat(state, p, key, n = 1) {
  const s = state.stats && state.stats[state.players.indexOf(p)];
  if (s && n) s[key] = (s[key] || 0) + n;
}

// 地形の効果（地形がなければ空）。p はプレイヤー
function terrainFx(p) { return (p && p.terrain && p.terrain.fx) || {}; }

// ターン開始時の地形の効果（手番のプレイヤーの場にかかる）：火山の熱・世界樹の回復・落雷
function applyTerrain(state) {
  const p = state.players[state.current];
  const fx = terrainFx(p);
  const events = [];
  const hurt = (mon, dmg, kind) => {
    mon.hp -= dmg;
    const killed = !survives(state, mon);
    if (killed) { removeMonster(p, p.slots.indexOf(mon)); fallen(state, p, mon); }
    events.push({ kind, target: mon, dmg, killed });
  };
  const side = state.current;
  if (fx.burn) p.slots.filter(m => m && m.card.color !== fx.burnImmune).forEach(m => hurt(m, fx.burn, 'burn'));
  if (fx.regen) {
    for (const m of p.slots.filter(x => x && (x.hp < x.maxHp || x.status.disease))) events.push({ kind: 'regen', ...healMonster(m, fx.regen) });
  }
  if (fx.storm) {
    const pool = p.slots.filter(m => m && !baseSkillX(m, 'flying'));
    if (pool.length) hurt(pool[pickRandom(state, pool.length)], fx.storm, 'storm');
  }
  for (const kind of ['burn', 'regen', 'storm']) {
    const list = events.filter(e => e.kind === kind);
    if (list.length) logPush(state, ['L', side, kind, list.map(e => [logRef(state, e.target), e.dmg || e.heal || 0, e.killed ? 1 : 0])]);
  }
  return events;
}

// プレイヤーから相手プレイヤーを見られるようにする（相手の場のスキルで、手札のコストが変わるため）。
// 保存や複製に巻き込まれないよう、数えられない項目にしておく。状態を複製したら、もう一度呼ぶ
function linkPlayers(state) {
  state.players.forEach((p, i) => Object.defineProperty(p, 'opp', { value: state.players[1 - i], enumerable: false, writable: true, configurable: true }));
}

// コイントスの結果：{ first: 先攻, second: 後攻, bonus: 後攻が最初に多く持つクリスタル }
function coinToss(state) {
  const late = CONFIG.SECOND_PLAYER_LATE || { turn: 0, bonus: 0 };
  return { first: state.first, second: 1 - state.first, bonus: CONFIG.SECOND_PLAYER_BONUS, lateTurn: late.turn, lateBonus: late.bonus };
}

// そのターンの消耗ダメージ量（開始前は0）。試合が長引くほど増えていく
//   state を渡すと、特殊ルール（消耗ダメージの開始ターン）を反映する
function attritionStart(state) { return (state && state.rules && state.rules.attritionStart) || CONFIG.ATTRITION_START; }
function attritionDamage(turn, state) {
  const start = attritionStart(state);
  if (turn < start) return 0;
  return 1 + Math.floor((turn - start) / CONFIG.ATTRITION_STEP);
}

// 場にいる全モンスター（両者）に消耗ダメージ。アーマーなどを無視した固定ダメージで、
// スキルは発動しない。倒れたら後ろが前に詰める。演出用のイベント一覧を返す
function applyAttrition(state) {
  const dmg = attritionDamage(state.turn, state);
  const events = [];
  if (!dmg) return events;
  for (const p of state.players) {
    const own = Math.max(0, dmg - (charm(p, 'attrition') ? 1 : 0)); // お守り：自分が受ける消耗ダメージ-1
    for (const mon of own ? p.slots.filter(m => m) : []) {
      mon.hp -= own;
      const killed = !survives(state, mon);
      if (killed) { removeMonster(p, p.slots.indexOf(mon)); fallen(state, p, mon); }
      events.push({ target: mon, dmg: own, killed });
    }
  }
  return events;
}

// ターン開始：消耗ダメージ → ターン開始時スキル → クリスタル → ドロー → 勝敗判定。
// 決着がつけば result を返す
function startTurn(state) {
  const p = state.players[state.current];
  state.turn++;
  state.phase = 'play';
  logPush(state, ['T', state.turn, state.current]);
  state.attrition = applyAttrition(state);
  if (state.attrition.length) logPush(state, ['B', state.attrition[0].dmg, state.attrition.map(e => [logRef(state, e.target), e.killed ? 1 : 0])]);
  state.terrainEvents = applyTerrain(state);
  state.players.forEach(pl => pl.slots.forEach(m => { if (m) { m.counters = 0; m.reflects = 0; m.guardUsed = false; } })); // Cross-Counter-Attack・Magic Reflect の回数
  p.healed = false; // Attunement 用：このターンに味方が回復されたか（ターン開始時の回復から数える）
  state.startEvents = startOfTurnSkills(state);
  logPush(state, ...state.startEvents.map(e => logSkill(state, e)));
  p.crystals += CONFIG.CRYSTALS_PER_TURN + (p.bonusIncome || 0) + (state.rules.income || 0); // bonusIncome: ボス補正、rules.income: 特殊ルール
  payDebt(p); // ステージの補正（最初のクリスタルが少ない相手）
  // 後攻ボーナス（2回目）：先攻有利の補正
  const late = CONFIG.SECOND_PLAYER_LATE;
  if (late && late.bonus && state.turn === late.turn && state.current !== state.first && !state.noResult) {
    p.crystals += late.bonus;
    logPush(state, ['W', state.current, late.bonus]);
    state.lateBonus = late.bonus; // 画面で知らせる用
  } else state.lateBonus = 0;
  if (charm(p, 'late_income') && state.turn >= 9) p.crystals += 1;                     // お守り：ターン9以降、毎ターン+1
  if (charm(p, 'regen')) heroHeal(p, 'charm', 1);                                      // お守り：最もHPの低い味方を1回復
  p.sacrificed = false;
  if (p.deck.length) {
    const drawn = p.deck.shift();
    // Ill Omen（相手の場）：引いたカードのコスト+X（いちばん強いものだけ）
    const omen = Math.max(0, ...state.players[1 - state.current].slots.map(m => (m ? skillX(m, 'illomen') : 0)));
    if (omen) { drawn.mod = (drawn.mod || 0) + omen; state.startEvents.push({ kind: 'illomen', x: omen, side: 'foe' }); }
    p.hand.push(drawn);
  }
  // ドロー後の判定（生贄や消耗ダメージで残り0体になった場合はここで決着。同時なら手番側の勝ち）
  const result = checkResult(state, true);
  if (result && state.attrition.some(e => e.killed)) result.attrition = true;
  if (result && state.terrainEvents.some(e => e.killed)) result.terrain = true;
  return result;
}

// ---------- ステータス計算 ----------

// カード + 装備から攻撃一覧 [{type, atk, source}] を作る（先頭が本体の攻撃）。
// 装備の攻撃力は、本体と同じタイプなら本体に加算、違うタイプなら別の攻撃として追加する。
function attacksFor(card, item) {
  const list = [{ type: card.type, atk: card.atk, source: 'base' }];
  for (const type in (item && item.atk) || {}) {
    if (type === card.type) list[0].atk += item.atk[type];
    else list.push({ type, atk: item.atk[type], source: 'weapon' });
  }
  return list;
}

// 場に出たモンスター。
//   bonusAtk: Swallow などで永続的に増えた攻撃力
//   buff:     味方からの強化 { inspire: X, shoot: X }（次の自分のターン開始まで）
//   status:   状態異常 { disease: スタック数, entangle: true, silence: 残りターン, demoralize: X, suppress: X }
function makeMonster(uid, card) {
  return {
    uid, card, hp: card.hp, maxHp: card.hp, armor: card.armor || 0, item: null,
    bonusAtk: 0, buff: {}, status: {},
  };
}

// 起きたことを、いま記録中の一覧（攻撃の extras や、ターン開始時のイベント）に足す
function note(state, ev) { if (state && state.sink) state.sink.push(ev); }

// 永続で育つスキルの上限つき加算。実際に増やせた数を返す
function growBy(mon, x) {
  const n = Math.max(0, Math.min(x, CONFIG.GROW_CAP - (mon.grown || 0)));
  mon.grown = (mon.grown || 0) + n;
  return n;
}

// HPが0以下になったモンスターが、倒されずに済むか（Last Stand：最初の1回だけ、HP全回復で踏みとどまる）
function survives(state, mon) {
  if (mon.hp > 0) return true;
  if (mon.stood || !hasSkill(mon, 'laststand')) return false;
  mon.stood = true;
  mon.hp = mon.maxHp;
  note(state, { kind: 'laststand', target: mon, targets: [mon] });
  return true;
}

// そのプレイヤーが、そのヒーロースキルを使っているか
function heroIs(p, skill) { return !!(p && p.hero && p.hero.skill === skill); }

// モンスターに持ち主（プレイヤー）を覚えさせる。ヒーロースキルの判定に使う
// （列挙されないプロパティにして、表示や比較には出ないようにする）
function setOwner(mon, p) {
  Object.defineProperty(mon, 'owner', { value: p, enumerable: false, writable: true, configurable: true });
  return mon;
}

// ヒーロースキルで数値が+1になるスキル（持っているスキルだけが対象）
const HERO_SKILL_BONUS = { healplus: 'heal', command: 'shoot', virulence: 'disease', warcry: 'inspire' };

// カードに書かれたままのスキルの数値（本体＋装備の合計。持っていなければ0。数値なしのスキルは1）
function baseSkillX(mon, id) {
  let x = (mon.perm && mon.perm[id]) || 0; // ヒーロースキルなどで得た、消えないスキル
  if (id === 'thorns' && heroIs(mon.owner, 'boss_thorns')) x += 1; // ボス専用：味方全員が Thorns 1 を得る
  const granted = mon.owner && mon.owner.rules && mon.owner.rules.grant; // 特殊ルール：全モンスターがそのスキルを持つ
  for (const src of [mon.card, mon.item]) {
    for (const k of (src && src.skills) || []) if (k.id === id) x += k.x === undefined ? 1 : k.x;
  }
  if (!x && granted && granted[id]) x = granted[id];
  return x + ((mon.buff.grant && mon.buff.grant[id]) || 0); // 一時的に与えられたスキルも含む
}

// Rearguard・Vanguard で数値が増えないスキル（コストを決める Equilibrium と、Rearguard・Vanguard 自身）
const NO_REARGUARD = ['rearguard', 'vanguard', 'equilibrium'];
// Overlord：攻撃そのもの以外のスキルが2回ぶん発動する（数値のあるスキルは数値が2倍。Fear は2回入れ替える）。
// 数値のないスキルと、コストを決める Equilibrium・Rearguard は変わらない
const overlordDoubles = id => !SKILLS[id].noX && !NO_REARGUARD.includes(id);

// 今のスキルの数値。拘束（Entangle）されているあいだは、すべてのスキルを失う。
// Rearguard（後列でスキル+X）と Overlord（数値のあるスキル2倍）はここで反映する
function skillX(mon, id) {
  if (mon.status.entangle) return 0;
  let x = baseSkillX(mon, id);
  if (!x) return 0;
  const hero = mon.owner && mon.owner.hero;
  if (hero && HERO_SKILL_BONUS[hero.skill] === id) x += 1; // ヒーロースキル：そのスキルの数値+1
  if ((id === 'heal' || id === 'groupheal') && terrainFx(mon.owner).healColor === mon.card.color) x += 1; // 地形（森）
  if (!SKILLS[id].noX && !NO_REARGUARD.includes(id)) x += mon.buff.rearguard || 0;
  if (overlordDoubles(id) && baseSkillX(mon, 'overlord')) x *= 2;
  return x;
}

function hasSkill(mon, id) { return skillX(mon, id) > 0; }

// 今の攻撃一覧 [{type, source, base, atk, mods}]。
// base は本体の素の攻撃力、mods は変化の内訳 [{label, x}]（装備・Swallow・強化・弱体）
function getAttacks(mon) {
  return attacksFor(mon.card, mon.item).map(a => {
    const base = a.source === 'base' ? mon.card.atk : 0;
    const mods = [];
    const add = (label, x) => { if (x) mods.push({ label, x }); };
    add(mon.item ? mon.item.name : '', a.atk - base);
    add('Swallow', mon.bonusAtk);
    add('Bloom・Leech', mon.growAll || 0);
    if (a.type === 'melee') {
      add('Fury', Math.min(skillX(mon, 'fury'), mon.maxHp - mon.hp)); // 失ったHPぶん（上限X）
      add('Grudge', mon.growMelee || 0);
      add('Inspire', mon.buff.inspire || 0);
      add('Demoralize', -(mon.status.demoralize || 0));
    }
    if (a.type === 'ranged') {
      add('Shoot Command', mon.buff.shoot || 0);
      add('Keen Eye', mon.growRanged || 0);
      add('Steady Aim', mon.buff.aim || 0);
      add('Demoralize', -(mon.status.demoralize || 0));
    }
    if (a.type === 'chaos') add('Jinx', -(mon.status.jinx || 0));
    if (a.type === 'melee' || a.type === 'ranged') add('Dive', mon.buff.dive || 0);
    // 地形・ヒーロースキルによる攻撃力の強化
    const p = mon.owner;
    const land = terrainFx(p).atk;
    if (land && land[a.type]) add(p.terrain.name, land[a.type]);
    if (a.type === 'ranged' && heroIs(p, 'volley')) add('一斉射撃', 1);
    if (a.type === 'magic' && heroIs(p, 'surge')) add('魔力の奔流', 1);
    if ((a.type === 'melee' || a.type === 'ranged') && heroIs(p, 'boss_sky') && baseSkillX(mon, 'flying')) add('天空の覇者', 1);
    // お守り：自分の場の3体が同じ色なら、全員の攻撃+1
    if (charm(p, 'tri_color') && p.slots.every(m => m && m.card.color === p.slots[0].card.color)) add('三色の誓い', 1);
    if (a.type === 'magic') add('Suppress Magic', -(mon.status.suppress || 0));
    const atk = Math.max(0, base + mods.reduce((n, m) => n + m.x, 0));
    return { type: a.type, source: a.source, base, atk, mods };
  });
}

// その攻撃タイプを、そのスロットから使えるか（タイプごとに別々に判定する）
function canUseType(mon, type, slot) {
  return SLOT_TYPES[slot].includes(type) || (type === 'melee' && hasSkill(mon, 'reach')) || (type === 'ranged' && hasSkill(mon, 'pointblank'));
}

// その位置で1つでも攻撃できるか
function canAttackFrom(mon, slot) {
  return getAttacks(mon).some(a => canUseType(mon, a.type, slot));
}

// 1体が行動するときの攻撃の順番：魔法 → カオス → 遠隔 → 近接
// （本体の攻撃か装備の攻撃かには関係なく、攻撃の種類で並べる）
const ATTACK_ORDER = ['magic', 'chaos', 'ranged', 'melee'];

// 1回の行動で行う攻撃の一覧。そのスロットで使えるタイプだけが対象で、ATTACK_ORDER の順に並ぶ。
// 追加攻撃（Batter）は、元になる近接攻撃の直後に入る。
// source: base=本体の攻撃 / weapon=装備による別タイプの攻撃 / batter=Batterの追加攻撃
// 発動できない攻撃は { skip: 理由 } として入れる（ログに理由を出すため）
function actionAttacks(mon, slot) {
  const list = [];
  const sorted = getAttacks(mon).sort((a, b) => ATTACK_ORDER.indexOf(a.type) - ATTACK_ORDER.indexOf(b.type));
  for (const a of sorted) {
    if (!canUseType(mon, a.type, slot)) continue;
    if (a.type === 'magic' && mon.status.silence) { list.push({ skip: 'silence', type: a.type }); continue; }
    if (a.atk <= 0) { list.push({ skip: a.type === 'magic' ? 'suppress' : a.type === 'chaos' ? 'jinx' : 'demoralize', type: a.type }); continue; }
    list.push(a);
    if (a.type === 'melee') {
      for (let i = 0; i < skillX(mon, 'batter'); i++) list.push({ type: a.type, atk: a.atk, source: 'batter' });
    }
    if (a.type === 'ranged') { // Craze：遠隔攻撃をX回追加で行う
      for (let i = 0; i < skillX(mon, 'craze'); i++) list.push({ type: a.type, atk: a.atk, source: 'craze' });
    }
    if (a.type === 'magic') { // Recast：魔法攻撃をX回追加で行う
      for (let i = 0; i < skillX(mon, 'recast'); i++) list.push({ type: a.type, atk: a.atk, source: 'recast' });
    }
    if (a.type === 'chaos') { // Scatter：カオス攻撃をX回追加で行う
      for (let i = 0; i < skillX(mon, 'scatter'); i++) list.push({ type: a.type, atk: a.atk, source: 'scatter' });
    }
  }
  return list;
}
function getArmor(mon) { return mon.armor; }

// 装備済みでも付けられる（古い装備は捨て札になる）
function canEquip(item, mon) {
  return !item.color || item.color === mon.card.color;
}

// ---------- プレイフェーズの行動 ----------

function handCard(state, pi, uid) {
  if (state.phase !== 'play' || state.current !== pi) return null;
  return state.players[pi].hand.find(h => h.uid === uid) || null;
}

function removeFromHand(p, h) {
  p.hand.splice(p.hand.indexOf(h), 1);
}

// 今のコスト。Equilibrium 持ちが場にいると、同じ色の手札のモンスターのコストがXになる
//   x: 手札・山札の1枚（{ uid, card, mod }）か、カードそのもの。
//   mod は、そのカード1枚だけにかかったコストの増減（山札に戻っても、手札に来ても、ついてまわる）。
//   下げる効果では1より安くならない（もとが0のカードは0のまま）。上げる効果に上限はない
function cardMod(x) { return x && x.card ? x.mod || 0 : 0; }
//   mon: 装備を付ける相手（Featherweight の割引は、相手によって変わる）。
//        省略したときは、いま場にいる中で、いちばん安く付けられる相手に付けるときの値
function costOf(p, x, mon) {
  const card = x.card || x;
  const mod = cardMod(x);
  let cost = card.cost + mod;
  let cut = mod < 0;
  if (card.kind === 'equip') {
    // Quartermaster：場にいる間、手札の装備のコスト-X（いちばん強いものだけ）
    const qm = Math.max(0, ...p.slots.map(m => (m ? skillX(m, 'quartermaster') : 0)));
    // Featherweight：このモンスターに、同じ色の装備を付けるとき、コスト-X
    const fw = m => (m && card.color && m.card.color === card.color && canEquip(card, m) ? skillX(m, 'featherweight') : 0);
    const light = mon ? fw(mon) : Math.max(0, ...p.slots.map(fw));
    cost -= qm + light;
    cut = cut || qm + light > 0;
  }
  if (cut) cost = Math.max(Math.min(card.cost, 1), cost); // 下げる効果では1より安くならない
  if (card.kind !== 'monster') return cost;
  for (const m of p.slots) {
    const x = m && !m.fresh && m.card.color === card.color ? skillX(m, 'equilibrium') : 0; // 出したターンはまだ効かない
    if (x) cost = Math.min(cost, x);
  }
  // Crosscurrent（相手の場）：手札のモンスターのコストが、X未満ならXになる（いちばん強いものだけ）
  const cross = p.opp ? Math.max(0, ...p.opp.slots.map(m => (m ? skillX(m, 'crosscurrent') : 0))) : 0;
  return Math.max(cost, cross);
}

// 場は「スロット1 → 2 → 3」の1列。モンスターは常に前から詰めて並ぶ。
// 指定したスロットに新しいモンスターが実際に入る位置を返す（満員なら -1）。
// 空きスロットを指定した場合は、前が空いていればそこまで前に詰める。
function placementSlot(p, slot) {
  const count = p.slots.filter(m => m).length;
  return count >= 3 ? -1 : Math.min(slot, count);
}

// 指定スロットに出す。そこにモンスターがいれば、そのモンスターと後ろは1つずつ後ろへずれる
function playMonster(state, pi, uid, slot) {
  const p = state.players[pi];
  const h = handCard(state, pi, uid);
  const at = placementSlot(p, slot);
  if (!h || h.card.kind !== 'monster' || at < 0 || costOf(p, h) > p.crystals) return false;
  p.crystals -= costOf(p, h);
  removeFromHand(p, h);
  const mon = setOwner(makeMonster(h.uid, h.card), p);
  mon.fresh = true; // このターンに出した（次の自分のターン開始まで）
  if (h.mod) mon.costMod = h.mod; // このカードにかかっているコストの増減（山札に戻るときに持っていく）
  if (h.copy) mon.copy = h.copy;
  // お守り：その対戦で最初に出したモンスターを強くする
  if (p.charms && !p.playedFirst) {
    p.playedFirst = true;
    if (charm(p, 'first_hp')) { mon.hp += 2; mon.maxHp += 2; }
    if (charm(p, 'first_armor')) mon.armor += 2;
  }
  const pushed = p.slots.slice(at).filter(m => m); // 後ろへ押し出されるモンスター
  p.slots.splice(at, 0, mon);
  p.slots.length = 3;
  const events = onEnter(state, pi, mon, h.card);
  // ヒーロースキル「蝕む刃」：近接・カオスの味方は、出したときに Disease 1（スキル）を得る
  if (heroIs(p, 'venomblade') && (h.card.type === 'melee' || h.card.type === 'chaos')) {
    mon.perm = { disease: 1 };
    events.push({ kind: 'hero', id: 'venomblade', effect: 'grant', target: mon, targets: [mon] });
  }
  logPush(state, ['P', pi, logCardRef(h), at, pushed.map(m => logRef(state, m))], ...events.map(e => logSkill(state, e, 'x')));
  return { slot: at, events };
}

// 召喚モンスターを場に呼び出す（満員なら何も起きず null）。
//   front: 前列に割り込ませる（いたモンスターは1つずつ後ろへ）。false なら、いちばん後ろの空きに置く
//   expire: 'turnEnd' 持ち主のターン終了時に消える / 'nextTurn' 持ち主の次のターン開始時に消える
function summonToken(state, owner, id, x, front, expire) {
  const count = owner.slots.filter(m => m).length;
  if (count >= 3) return null;
  const mon = setOwner(makeMonster(uidSeq++, tokenCard(id, x)), owner);
  mon.isToken = true;
  if (expire) mon.expire = expire;
  if (front) {
    const moved = owner.slots.filter(m => m);
    owner.slots.splice(0, 0, mon);
    owner.slots.length = 3;
    if (moved.length && state.moveBuf) state.moveBuf.push([state.players.indexOf(owner), moved.map(m => logRef(state, m))]);
    menaceOnMove(state, owner, moved); // 押し出された相手には Menace が入る
  } else owner.slots[count] = mon;
  return mon;
}

// 期限の来た召喚モンスターを場から消す。消えたモンスターの一覧を返す
function expireTokens(p, when) {
  const gone = p.slots.filter(m => m && m.isToken && m.expire === when);
  gone.forEach(m => removeMonster(p, p.slots.indexOf(m)));
  return gone;
}

// Fear：敵の前列を、敵の後列のランダムな1体と入れ替える（Inspire を受けている敵には効かない）。
// 位置が変わった敵には Menace が発動する。Overlord 持ちは2回入れ替える
function fearSwap(state, foe, m, events) {
  for (let i = 0; i < (baseSkillX(m, 'overlord') ? 2 : 1); i++) {
    const front = foe.slots[0];
    const backs = [1, 2].filter(s => foe.slots[s] && !foe.slots[s].buff.inspire);
    if (!front || !backs.length) break;
    if (front.buff.inspire) { events.push({ kind: 'fear', source: m, target: front, immune: true }); break; }
    const s = backs[pickRandom(state, backs.length)];
    const other = foe.slots[s];
    foe.slots[0] = other;
    foe.slots[s] = front;
    events.push({ kind: 'fear', source: m, target: front, other, targets: [front, other] });
    menaceOnMove(state, foe, [front, other]);
  }
}

// 場に出たとき（装備は付けたとき）に発動するスキル：Silence と Fear
function onEnter(state, pi, mon, source) {
  const events = [];
  if ((source.skills || []).some(k => k.id === 'fear') && !mon.status.entangle) {
    state.sink = events; // 入れ替えで起きた Menace も、続けて記録する
    fearSwap(state, state.players[1 - pi], mon, events);
    state.sink = null;
  }
  // Backfire：場に出たとき、相手の山札に「がらくた」をX枚、自分の山札にも1枚入れる
  const junk = (source.skills || []).filter(k => k.id === 'backfire').reduce((n, k) => n + k.x, 0);
  if (junk && source.kind === 'monster' && !mon.status.entangle) {
    state.sink = events;
    const me = state.players[pi], foe = state.players[1 - pi];
    for (let i = 0; i < junk; i++) addToDeck(state, me, foe, specialCard('sp1'));
    addToDeck(state, me, me, specialCard('sp1'));
    state.sink = null;
    events.unshift({ kind: 'backfire', source: mon, x: junk });
  }
  // Vanguard Call：場に出たとき、自分の前列に「小さなゴーレム」（HP X）を呼ぶ
  const call = (source.skills || []).filter(k => k.id === 'vanguardcall').reduce((n, k) => n + k.x, 0);
  if (call && source.kind === 'monster' && !mon.status.entangle) {
    const token = summonToken(state, state.players[pi], 'tk1', call, true);
    if (token) events.push({ kind: 'vanguardcall', source: mon, target: token, targets: [token] });
  }
  const x = (source.skills || []).filter(k => k.id === 'silence').reduce((n, k) => n + k.x, 0);
  if (x && !mon.status.entangle) {
    const targets = state.players[1 - pi].slots.filter(m => m && !hasSkill(m, 'perseverance'));
    targets.forEach(m => { m.status.silence = Math.max(m.status.silence || 0, x); });
    events.push({ kind: 'silence', source: mon, x, targets });
  }
  return events;
}

function equipItem(state, pi, uid, slot) {
  const p = state.players[pi];
  const h = handCard(state, pi, uid);
  const mon = p.slots[slot];
  if (!h || h.card.kind !== 'equip' || !mon || !canEquip(h.card, mon) || costOf(p, h, mon) > p.crystals) return false;
  p.crystals -= costOf(p, h, mon);
  removeFromHand(p, h);
  const old = mon.item;
  if (old) {
    // 古い装備は捨て札へ。体力ボーナスも外れる（それで倒れることはない）。アーマーは張り直し
    p.discard.push(old);
    mon.maxHp -= old.hp || 0;
    mon.hp = Math.max(1, Math.min(mon.hp, mon.maxHp));
    mon.armor = mon.card.armor || 0;
  }
  mon.item = h.card;
  // Enchant Armor：アーマー装備を付けているとき、アーマーが+X
  mon.armor += (h.card.armor || 0) + (h.card.armor ? skillX(mon, 'enchantarmor') : 0);
  mon.hp += h.card.hp || 0;
  mon.maxHp += h.card.hp || 0;
  countStat(state, p, 'equip');
  const events = [...onEnter(state, pi, mon, h.card), ...heroFirstAid(p)];
  logPush(state, ['E', pi, h.card.id, logRef(state, mon), old ? old.id : 0], ...events.map(e => logSkill(state, e, 'x')));
  return { old, events };
}

// 相手（CPU）の最初のクリスタルの補正（ステージの bonus）。プラスならそのまま足す。
// マイナスなら「借り」にして、持っているクリスタルと、これからもらうクリスタルから引いていく（表示がマイナスにならないように）
function applyStartBonus(p, bonus) {
  if (bonus >= 0) { p.crystals += bonus; return; }
  p.debt = (p.debt || 0) - bonus;
  payDebt(p);
}
function payDebt(p) {
  if (!p.debt) return;
  const pay = Math.min(p.debt, p.crystals);
  p.crystals -= pay;
  p.debt -= pay;
}

// 生贄でもらえるクリスタル（特殊ルールの倍率と、お守りの+1を含む）
function sacrificeCrystals(p, base) {
  return base * ((p.rules && p.rules.sacrificeMult) || 1) + (charm(p, 'sac_plus') ? 1 : 0);
}

function sacrificeGain(card) {
  return card.kind === 'monster' ? CONFIG.SACRIFICE_MONSTER : CONFIG.SACRIFICE_ITEM;
}

// 生贄は手札・場を合わせて1ターンに1回だけ。生贄にしたカードはゲームから除外（捨て札にも行かない）
function afterSacrifice(p, gain) {
  p.crystals += sacrificeCrystals(p, gain); // 特殊ルール：生贄のクリスタルがn倍／お守り：+1
  p.sacrificed = true;
  // 生贄で残り0体になっても、その場では負けにしない（次のターン開始時のドロー後に判定）
  if (monstersLeft(p) === 0) p.wipedBySacrifice = true;
  return true;
}

// 手札のカードを生贄にする
function sacrifice(state, pi, uid) {
  const p = state.players[pi];
  const h = handCard(state, pi, uid);
  if (!h || p.sacrificed) return false;
  removeFromHand(p, h);
  logPush(state, ['S', pi, logCardRef(h), sacrificeCrystals(p, sacrificeGain(h.card)), 0]);
  return afterSacrifice(p, sacrificeGain(h.card));
}

// 場のモンスターを生贄にする。装備も一緒に除外され、後ろのモンスターが前に詰める
function sacrificeField(state, pi, slot) {
  const p = state.players[pi];
  if (state.phase !== 'play' || state.current !== pi || p.sacrificed || !p.slots[slot] || p.slots[slot].isToken) return false; // 召喚モンスターは生贄にできない
  const gone = p.slots[slot];
  const moved = p.slots.slice(slot + 1).filter(m => m);
  removeMonster(p, slot);
  if (moved.length) state.moveBuf.push([pi, moved.map(m => logRef(state, m))]);
  logPush(state, ['S', pi, logCardRef(gone), sacrificeCrystals(p, CONFIG.SACRIFICE_MONSTER), 1]);
  // Fall Back：場で生贄にされたとき、山札に戻る（次に出すときのコスト+X）。なければ Evacuate を確かめる
  const back = skillX(gone, 'fallback');
  const events = [];
  state.sink = events;
  if (back) { intoDeck(state, p, gone.card, gone.copy || 0, (gone.costMod || 0) + back); note(state, { kind: 'fallback', target: gone, x: back }); }
  else evacuate(state, p, gone);
  state.sink = null;
  if (events.length) logPush(state, ...events.map(e => logSkill(state, e, 'x')));
  state.sacEvents = events; // 画面で知らせる用
  return afterSacrifice(p, CONFIG.SACRIFICE_MONSTER);
}

// ---------- ダメージ ----------

// 場のモンスターが倒された：持ち主がクリスタルをもらう（原因は問わない。攻撃・反撃・フラッシュ・消耗ダメージ・地形など）。
// 生贄・山札に戻す（Unsummon / Retreat）・場が空のペナルティ・Phantom の分身は対象外（ここを呼ばない／分身は数えない）
//   silent: 倒されたときのスキルを発動させない（Terminate）
function fallen(state, owner, mon, silent) {
  if (mon.isPhantom) return 0;
  // 召喚モンスター：クリスタルは入らず、倒された数にも数えない。「重荷」なら、持ち主がクリスタルを失う
  if (mon.isToken) {
    const lose = Math.min(owner.crystals, mon.card.burden || 0);
    if (lose > 0) { owner.crystals -= lose; note(state, { kind: 'burden', target: mon, x: lose, side: owner === state.players[state.current] ? undefined : 'foe' }); }
    return 0;
  }
  const n = CONFIG.FALLEN_CRYSTAL && CONFIG.FALLEN_CRYSTAL + (charm(owner, 'fallen_plus') ? 1 : 0); // お守り：もう1つ増える
  if (state.deaths) state.deaths[state.players.indexOf(owner)]++; // 場で倒された数（パズルの目標の判定に使う）
  if (n) {
    owner.crystals += n;
    if (state.log && state.fallBuf) state.fallBuf.push(['G', state.players.indexOf(owner), logRef(state, mon), n]);
  }
  if (!silent) { onDeath(state, owner, mon); evacuate(state, owner, mon); }
  return n || 0;
}

// 試合中に、山札へカードを足す（by：足したプレイヤー / to：足される山札の持ち主）。足した1枚を返す。
// Opportunist：相手が山札にカードを足すたび、すべての攻撃力と最大HPが永続で+X（育つスキルの上限に含む）
function addToDeck(state, by, to, card, mod = 0) {
  const entry = intoDeck(state, to, card, 0, mod);
  entry.added = true; // 試合中に足されたカード（Purge で取り除ける）
  const watcher = state.players[1 - state.players.indexOf(by)];
  for (const m of watcher.slots.filter(x => x)) {
    const g = growBy(m, skillX(m, 'opportunist'));
    if (!g) continue;
    m.growAll = (m.growAll || 0) + g; m.maxHp += g; m.hp += g;
    note(state, { kind: 'opportunist', target: m, x: g, targets: [m] });
  }
  return entry;
}

// Evacuate：ほかの Flying 持ちの味方が倒されるか生贄にされたとき、そのモンスターを山札に戻し、コスト-X（装備は失う）
function evacuate(state, owner, mon) {
  if (mon.isPhantom || mon.isToken || !baseSkillX(mon, 'flying')) return false;
  const x = Math.max(0, ...owner.slots.map(m => (m && m !== mon ? skillX(m, 'evacuate') : 0)));
  if (!x) return false;
  intoDeck(state, owner, mon.card, mon.copy || 0, (mon.costMod || 0) - x);
  note(state, { kind: 'evacuate', target: mon, x });
  return true;
}

// 倒されたときのスキル（拘束されているあいだはスキルを失うので、発動しない）
//   Parting Gift：傷ついた味方全員をX回復　／　Final Bow：敵全員にXの固定ダメージ
function onDeath(state, owner, mon) {
  const foe = state.players[1 - state.players.indexOf(owner)];
  const gift = skillX(mon, 'partinggift');
  if (gift) {
    for (const t of owner.slots.filter(m => m && (m.hp < m.maxHp || m.status.disease))) note(state, { kind: 'partinggift', source: mon, ...healMonster(t, gift) });
  }
  const dmg = skillX(mon, 'finalbow');
  if (dmg > 0 && foe) {
    for (const t of foe.slots.filter(m => m)) {
      const slot = foe.slots.indexOf(t);
      if (slot < 0) continue; // 先に倒れた仲間の効果で、もういない
      note(state, { kind: 'finalbow', source: mon, target: t, x: dmg, ...dealDamage(state, foe, slot, dmg, false, false, false, { fixed: true }) });
    }
  }
}

// 倒れたモンスターを取り除き、後ろを前に詰める（2→1、3→2）
function removeMonster(p, slot) {
  for (let s = slot; s < 2; s++) p.slots[s] = p.slots[s + 1];
  p.slots[2] = null;
}

// 場から取り除く（撃破・破壊・山札へ戻すなど）。後ろが詰めるので、位置が変わった相手には Menace が発動する
function takeOff(state, owner, slot) {
  const moved = owner.slots.slice(slot + 1).filter(m => m);
  removeMonster(owner, slot);
  if (moved.length && state.moveBuf) state.moveBuf.push([state.players.indexOf(owner), moved.map(m => logRef(state, m))]); // 詰めによる移動
  menaceOnMove(state, owner, moved);
}

// Menace：自分のターン中、位置が変わった敵モンスターにXの固定ダメージ（アーマーや軽減を無視）
function menaceOnMove(state, owner, moved) {
  const me = state.players[state.current];
  if (owner === me || state.phase === 'over') return;
  const x = me.slots.reduce((n, m) => n + (m ? skillX(m, 'menace') : 0), 0);
  if (!x) return;
  for (const mon of moved) {
    const slot = owner.slots.indexOf(mon);
    if (slot < 0) continue;
    mon.hp -= x;
    const killed = !survives(state, mon);
    if (state.sink) state.sink.push({ kind: 'menace', target: mon, x, dmg: x, armorDmg: 0, shielded: 0, killed });
    if (killed) { takeOff(state, owner, slot); fallen(state, owner, mon); }
  }
}

// owner の slot にいるモンスターへダメージ。
//   Fog 状態なら、このダメージを0にして Fog が解ける。
//   物理ダメージは Shield・Sacred Shield で減り、まずアーマー（盾ゲージ）を削る。アーマーを割った
//   超過分はHPに届かない（piercing のときだけ届く）。
//   魔法ダメージはアーマーを無視し、Mirror Shield・Sacred Shield・Anti-Magic Shield で減る。
//   noShield: Shield と Fog を無視する（See-through）
//   opts.fixed: 固定ダメージ（カオス攻撃など）。盾・アーマー・お守りの軽減を無視してHPに届く（Fog だけは防げる）
//   opts.noArmor: アーマーを無視する（Sunder）　opts.noMirror: Mirror Shield を無視する（Spellpierce）
function dealDamage(state, owner, slot, amount, magic, piercing, noShield, opts = {}) {
  const fixed = !!opts.fixed;
  const mon = owner.slots[slot];
  const r = { dmg: 0, armorDmg: 0, shielded: 0, fogged: false, killed: false };
  if (mon.status.fog && !noShield) {
    delete mon.status.fog;
    r.fogged = true;
    return r;
  }
  const cut = magic
    ? (opts.noMirror ? 0 : skillX(mon, 'mirrorshield')) + skillX(mon, 'sacredshield') + (mon.buff.antimagic || 0) + (heroIs(owner, 'ward') ? 1 : 0)
    : (noShield ? 0 : skillX(mon, 'shield')) + skillX(mon, 'sacredshield');
  // お守り：受ける魔法ダメージ-1／前列が受ける物理ダメージ-1
  const charmCut = (magic && charm(owner, 'guard') ? 1 : 0) + (!magic && slot === 0 && charm(owner, 'tough') ? 1 : 0);
  r.shielded = fixed ? 0 : Math.min(amount, cut + charmCut);
  amount -= r.shielded;
  if (!magic && !fixed && !opts.noArmor && mon.armor > 0) {
    r.armorDmg = Math.min(mon.armor, amount);
    mon.armor -= r.armorDmg;
    amount = piercing ? amount - r.armorDmg : 0;
  }
  if (amount > 0) {
    r.dmg = amount;
    mon.hp -= amount;
  }
  if (r.dmg + r.armorDmg > 0) mon.wasHit = true; // Steady Aim 用：ダメージを受けた
  r.over = mon.hp < 0 ? -mon.hp : 0;               // 倒したときの余り（Trample 用）
  if (!survives(state, mon)) {
    r.killed = true;
    takeOff(state, owner, slot);
    fallen(state, owner, mon);
  } else {
    if (r.dmg + r.armorDmg > 0 && hasSkill(mon, 'fog')) mon.status.fog = true; // Fog：ダメージを受けると Fog 状態になる
    // Grudge：ダメージを受けるたび、近接攻撃が永続で+X
    const g = r.dmg > 0 ? growBy(mon, skillX(mon, 'grudge')) : 0;
    if (g) { mon.growMelee = (mon.growMelee || 0) + g; note(state, { kind: 'grudge', target: mon, x: g, targets: [mon] }); }
  }
  // 試合のまとめ用：相手側が与えたダメージ（アーマーを削ったぶんも含む）と倒した数
  const tally = state.tally && state.tally[1 - state.players.indexOf(owner)];
  if (tally) { tally.dmg += r.dmg + r.armorDmg; if (r.killed) tally.kills++; }
  return r;
}

// 回復。Disease 状態なら、まずスタックを減らすのに使われ、残りでHPを回復する
function healMonster(mon, x) {
  // 地形（毒沼）：スタックは減らない。回復はスタックのぶんだけ打ち消される
  const stay = terrainFx(mon.owner).diseaseStay;
  const cured = Math.min(x, mon.status.disease || 0);
  if (cured && !stay) mon.status.disease -= cured;
  if (!mon.status.disease) delete mon.status.disease;
  const heal = Math.min(x - cured, mon.maxHp - mon.hp);
  mon.hp += heal;
  // Bloom：回復されるたび、攻撃と最大HPが永続で+X
  const bloom = heal + cured > 0 ? growBy(mon, skillX(mon, 'bloom')) : 0;
  if (bloom) { mon.growAll = (mon.growAll || 0) + bloom; mon.maxHp += bloom; mon.hp += bloom; }
  if (heal + cured > 0 && mon.owner) mon.owner.healed = true; // Attunement 用
  return { target: mon, heal, cured: stay ? 0 : cured, bloom };
}

const DEBUFFS = ['disease', 'entangle', 'silence', 'demoralize', 'suppress', 'jinx', 'stall', 'burn'];
const debuffCount = mon => DEBUFFS.filter(k => mon.status[k]).length;

// Disease を与える（Perseverance 持ちには効かない）。与えたら true
function addDisease(mon, x) {
  if (hasSkill(mon, 'perseverance')) return false;
  mon.status.disease = (mon.status.disease || 0) + x;
  return true;
}

// 燃焼を与える（Perseverance 持ちには効かない）。与えたら true
function addBurn(mon, x) {
  if (hasSkill(mon, 'perseverance')) return false;
  mon.status.burn = (mon.status.burn || 0) + x;
  return true;
}

// Mending Aura：味方の Heal・Group Heal の回復量+X（いちばん強いものだけ）。回復した味方の弱体も解く
const MENDED = ['entangle', 'silence', 'demoralize', 'suppress', 'jinx', 'stall'];
function mendingAura(p) { return Math.max(0, ...p.slots.filter(m => m).map(m => skillX(m, 'mendingaura'))); }
function mend(p, target) { if (mendingAura(p)) MENDED.forEach(k => delete target.status[k]); }

// ヒーロースキルの回復：最もHPの低い味方を回復する（回復する必要がなければ何も起きない）
function heroHeal(p, id, x) {
  const t = p.slots.filter(m => m).sort((a, b) => a.hp - b.hp).find(m => m.hp < m.maxHp || m.status.disease);
  return t ? [{ kind: 'hero', id, effect: 'heal', ...healMonster(t, x) }] : [];
}

// ヒーロースキル「応急の心得」：装備やフラッシュを使うたびに、最もHPの低い味方を3回復
function heroFirstAid(p) { return heroIs(p, 'firstaid') ? heroHeal(p, 'firstaid', 3) : []; }

// 一時的にスキルを与える（次の自分のターン開始まで）
function grantSkill(mon, id, x) {
  mon.buff.grant = mon.buff.grant || {};
  mon.buff.grant[id] = (mon.buff.grant[id] || 0) + x;
}

// Healing Shield：回復したとき、相手ターン終了まで盾のスキルを得る（どの盾かはカードごとに指定）
//   skills: 回復した側（モンスターなら本体＋装備、フラッシュならそのカード）のスキル一覧
//   receiver: 盾を得るモンスター（モンスターの回復なら自分、フラッシュなら回復した味方）
function healingShield(skills, receiver) {
  const k = skills.find(s => s.id === 'healingshield');
  if (!k) return null;
  const shield = k.shield || 'shield';
  grantSkill(receiver, shield, k.x);
  return { kind: 'healingshield', target: receiver, shield, x: k.x, targets: [receiver] };
}

const allSkills = mon => [...(mon.card.skills || []), ...((mon.item && mon.item.skills) || [])];

// 装備を破壊する（捨て札へ）。体力ボーナスとアーマーも失う
function destroyItem(owner, mon) {
  const item = mon.item;
  if (!item) return null;
  owner.discard.push(item);
  mon.maxHp -= item.hp || 0;
  mon.hp = Math.max(1, Math.min(mon.hp, mon.maxHp));
  mon.armor = Math.min(mon.armor, mon.card.armor || 0);
  mon.item = null;
  return item;
}

// カードを山札のランダムな位置に戻す（mod：そのカードにかかっているコストの増減）。戻した1枚を返す
function intoDeck(state, owner, card, copy = 0, mod = 0) {
  const entry = { uid: uidSeq++, card, copy };
  if (mod) entry.mod = mod;
  owner.deck.splice(Math.floor(state.rng() * (owner.deck.length + 1)), 0, entry);
  return entry;
}

// ---------- ターン開始時のスキル ----------

// 手番プレイヤーの支援・妨害スキルを発動する。ログ・演出用のイベント一覧を返す。
// 拘束されているモンスターはスキルを使えない（skillX が0を返す）。
// 発動順：Rearguard → Dive → Cleanse → Heal（＋Healing Shield）→ Poison Halo → Trickery → Inspire / Shoot Command
//        → Anti-Magic Shield → Demoralize / Suppress Magic → Toxic Fog → Entangle
function startOfTurnSkills(state) {
  const me = state.players[state.current];
  const foe = state.players[1 - state.current];
  const events = [];
  state.sink = events;
  const allies = () => me.slots.filter(m => m);
  const enemies = () => foe.slots.filter(m => m);

  // 前の自分のターンにかけた強化・弱体は、ここで切れる
  allies().forEach(m => { m.buff = {}; delete m.fresh; });
  // 前の自分のターンに呼んだ「身代わりゴーレム」（Swarm）は、ここで消える
  const faded = expireTokens(me, 'nextTurn');
  if (faded.length) events.push({ kind: 'tokenend', targets: faded });
  // Sortie：場に空きがあれば、いちばん後ろの空きに「突撃ゴーレム」（近接X・HP1・Reach）を呼ぶ。このターンの終わりに消える
  // （前列に割り込ませると、もとの前列の近接が攻撃できなくなるので、後ろに置いて Reach で殴らせる）
  for (const m of allies()) {
    const x = skillX(m, 'sortie');
    const token = x ? summonToken(state, me, 'tk2', x, false, 'turnEnd') : null;
    if (token) events.push({ kind: 'sortie', source: m, target: token, targets: [token] });
  }
  enemies().forEach(m => { delete m.status.demoralize; delete m.status.suppress; delete m.status.jinx; });
  // Rearguard：後列にいるモンスターは、自分のスキルの数値が+X（相手ターン終了まで）
  me.slots.forEach((m, slot) => {
    const x = m && slot > 0 && !m.status.entangle ? baseSkillX(m, 'rearguard') : 0;
    if (!x) return;
    m.buff.rearguard = x;
    events.push({ kind: 'rearguard', source: m, x, targets: [m] });
  });
  // Vanguard：前列にいるモンスターは、自分のスキルの数値が+X（相手ターン終了まで）
  const lead = me.slots[0];
  const van = lead && !lead.status.entangle ? baseSkillX(lead, 'vanguard') : 0;
  if (van) { lead.buff.rearguard = (lead.buff.rearguard || 0) + van; events.push({ kind: 'vanguard', source: lead, x: van, targets: [lead] }); }
  // Steady Aim：前の相手ターンにダメージを受けていなければ、遠隔攻撃+X（相手ターン終了まで）
  for (const m of allies()) {
    const x = m.wasHit ? 0 : skillX(m, 'steadyaim');
    if (x) { m.buff.aim = x; events.push({ kind: 'steadyaim', source: m, x, targets: [m] }); }
    m.wasHit = false;
  }
  // Dive / Group Dive：Flying を持つ味方は、近接・遠隔攻撃+X（相手ターン終了まで）。Group Dive は味方全員に Dive を配る
  const groupDive = Math.max(0, ...allies().map(m => skillX(m, 'groupdive')));
  for (const m of allies()) {
    const x = hasSkill(m, 'flying') ? skillX(m, 'dive') + groupDive : 0;
    if (!x) continue;
    m.buff.dive = x;
    events.push({ kind: 'dive', source: m, target: m, x, targets: [m] });
  }

  // Cleanse / Mass Cleanse（ほかのスキルより先。解除された味方はこのターンからスキルを使える）
  for (const m of allies()) {
    const hurt = allies().filter(t => debuffCount(t) > 0);
    if (!hurt.length) break;
    let targets = [];
    const mass = hasSkill(m, 'masscleanse');
    if (mass) targets = hurt;
    else if (hasSkill(m, 'cleanse')) targets = [hurt.sort((x, y) => debuffCount(y) - debuffCount(x))[0]];
    if (!targets.length) continue;
    targets.forEach(t => { DEBUFFS.forEach(k => delete t.status[k]); });
    events.push({ kind: 'cleanse', skill: mass ? 'masscleanse' : 'cleanse', source: m, targets });
  }

  // Regenerate：自分をX回復
  for (const m of allies()) {
    const x = skillX(m, 'regenerate');
    if (x && (m.hp < m.maxHp || m.status.disease)) events.push({ kind: 'heal', source: m, skill: 'regenerate', ...healMonster(m, x) });
  }
  // Heal / Group Heal（Silence 状態では使えない）。回復したら Healing Shield で盾を得る
  const aura = mendingAura(me);
  for (const m of allies()) {
    const one = skillX(m, 'heal') && skillX(m, 'heal') + aura;
    const all = skillX(m, 'groupheal') && skillX(m, 'groupheal') + aura;
    if (!one && !all) continue;
    if (m.status.silence) { events.push({ kind: 'skip', source: m, skill: one ? 'heal' : 'groupheal', reason: 'silence' }); continue; }
    const need = t => (t.maxHp - t.hp) + (t.status.disease || 0);
    const before = events.length;
    if (one) {
      const t = allies().filter(x => need(x) > 0).sort((x, y) => x.hp - y.hp || need(y) - need(x))[0]; // 傷ついた味方のうち、HPが最も低い1体
      if (t) { events.push({ kind: 'heal', source: m, skill: 'heal', ...healMonster(t, one) }); mend(me, t); }
    }
    if (all) {
      for (const t of allies()) if (need(t) > 0) { events.push({ kind: 'heal', source: m, skill: 'groupheal', ...healMonster(t, all) }); mend(me, t); }
    }
    if (events.length > before) {
      const hs = healingShield(allSkills(m), m);
      if (hs) events.push({ ...hs, source: m });
    }
  }

  // ヒーロースキル「癒しの風」：最もHPの低い味方を2回復
  if (heroIs(me, 'breeze')) events.push(...heroHeal(me, 'breeze', 2));
  // ボス専用「霧の帳」：ランダムな味方1体が Fog 状態になる
  if (heroIs(me, 'boss_fog') && Math.floor(state.turn / 2) % 3 === 0) { // 3ターンに1度
    const clear = allies().filter(m => !m.status.fog);
    const t = clear[pickRandom(state, clear.length)];
    if (t) { t.status.fog = true; events.push({ kind: 'hero', id: 'boss_fog', effect: 'fog', target: t, targets: [t] }); }
  }
  // ボス専用「蔓延」：敵全員に Disease 1
  if (heroIs(me, 'boss_plague') && enemies().length) {
    events.push({ kind: 'hero', id: 'boss_plague', effect: 'disease', x: 1, targets: enemies().filter(t => addDisease(t, 1)) });
  }

  // Poison Halo：Disease（スキル）を持つ味方は Outbreak を得て、Outbreak を持つ味方は Disease X を得る
  for (const m of allies()) {
    const x = skillX(m, 'poisonhalo');
    if (!x) continue;
    const withDisease = allies().filter(t => baseSkillX(t, 'disease') > 0 && !baseSkillX(t, 'outbreak'));
    const withOutbreak = allies().filter(t => baseSkillX(t, 'outbreak') > 0 && !baseSkillX(t, 'disease'));
    withDisease.forEach(t => grantSkill(t, 'outbreak', 1));
    withOutbreak.forEach(t => grantSkill(t, 'disease', x));
    if (withDisease.length + withOutbreak.length) events.push({ kind: 'poisonhalo', source: m, x, targets: [...withDisease, ...withOutbreak] });
  }

  // 全体にかかる強化・弱体は、最も強いものだけ適用。Disease 状態の使い手は使えない
  const DISEASE_BLOCKED = ['inspire', 'shoot', 'demoralize', 'suppress', 'jinx', 'trickery'];
  const warcry = heroIs(me, 'warcry'); // ヒーロースキル「不屈の鬨」：Disease 状態でも Inspire を使える
  for (const m of allies()) {
    if (!m.status.disease) continue;
    for (const id of DISEASE_BLOCKED) {
      if (skillX(m, id) && !(warcry && id === 'inspire')) events.push({ kind: 'skip', source: m, skill: id, reason: 'disease' });
    }
  }
  // Trickery：このターン、同じ色の味方のカオス（ランダム）ダメージが最大値になる
  for (const m of allies()) {
    if (!hasSkill(m, 'trickery') || m.status.disease) continue;
    const targets = allies().filter(t => t.card.color === m.card.color);
    targets.forEach(t => { t.buff.trickery = true; });
    events.push({ kind: 'trickery', source: m, targets });
  }
  const strongest = (id, blocked) => allies()
    .filter(m => !(blocked && m.status.disease))
    .map(m => ({ source: m, x: skillX(m, id) }))
    .sort((a, b) => b.x - a.x)[0];
  for (const id of ['inspire', 'shoot']) {
    const best = strongest(id, !(warcry && id === 'inspire'));
    if (!best || !best.x) continue;
    allies().forEach(m => { m.buff[id] = best.x; });
    events.push({ kind: id, source: best.source, x: best.x, targets: allies() });
  }
  // Anti-Magic Shield：相手ターン終了まで、味方全員が受ける魔法ダメージをX減らす
  const am = strongest('antimagic', false);
  if (am && am.x) {
    allies().forEach(m => { m.buff.antimagic = am.x; });
    events.push({ kind: 'antimagic', source: am.source, x: am.x, targets: allies() });
  }
  for (const id of ['demoralize', 'suppress', 'jinx']) { // Jinx：敵全員のカオス攻撃-X
    const best = strongest(id, true);
    if (!best || !best.x) continue;
    const targets = enemies().filter(m => !hasSkill(m, 'perseverance'));
    targets.forEach(m => { m.status[id] = best.x; });
    events.push({ kind: id, source: best.source, x: best.x, targets });
  }

  // Toxic Fog：敵全員に Disease X
  for (const m of allies()) {
    const x = skillX(m, 'toxicfog');
    if (!x) continue;
    const targets = enemies().filter(t => addDisease(t, x));
    events.push({ kind: 'toxicfog', source: m, x, targets });
  }

  // Entangle：正面の敵（いなければ前列の敵）を一定確率で拘束
  for (const m of allies()) {
    if (!hasSkill(m, 'entangle')) continue;
    const target = foe.slots[me.slots.indexOf(m)] || foe.slots[0];
    if (!target) break;
    const immune = hasSkill(target, 'perseverance');
    const success = !immune && roll(state, 'entangle', CONFIG.ENTANGLE_CHANCE);
    if (success) target.status.entangle = true;
    events.push({ kind: 'entangle', source: m, target, success, immune });
  }
  state.sink = null;
  return events;
}

// ターン終了時。Outbreak Halo：Disease 状態の敵全員にXの魔法ダメージ（スタックは減らない）。
// そのあと Disease：手番プレイヤーのモンスターは、スタック数ぶんの魔法ダメージを受ける（スタックは減らない）
function endOfTurnSkills(state) {
  const me = state.players[state.current];
  const foe = state.players[1 - state.current];
  const events = [];
  state.sink = events;
  for (const m of me.slots.filter(x => x)) {
    const x = skillX(m, 'outbreakhalo');
    if (!x) continue;
    for (const t of foe.slots.filter(y => y && y.status.disease)) {
      const slot = foe.slots.indexOf(t);
      if (slot < 0) continue;
      events.push({ kind: 'outbreakhalo', source: m, target: t, x, ...dealDamage(state, foe, slot, x, true) });
    }
  }
  for (const t of me.slots.filter(y => y && y.status.disease)) {
    const slot = me.slots.indexOf(t);
    if (slot < 0) continue;
    const x = t.status.disease;
    events.push({ kind: 'sick', target: t, x, ...dealDamage(state, me, slot, x, true) });
  }
  // 山札にカードを足すスキル（どれも1ターンに1枚。同じスキルの持ち主が何体いても、いちばん強い1体ぶんだけ）
  const best = id => me.slots.filter(y => y).map(m => ({ m, x: skillX(m, id) })).sort((a, b) => b.x - a.x)[0];
  const adders = [
    // Spell Forge：自分の山札に「火の玉」（敵1体にXダメージ）／ Apothecary：自分の山札に「薬びん」（味方1体をX回復）
    ['spellforge', b => addToDeck(state, me, me, specialCard('sp3', b.x))],
    ['apothecary', b => addToDeck(state, me, me, specialCard('sp4', b.x))],
    // Fortune：半々で、相手の山札に「凶札」（じゃまカード）か、自分の山札に「吉札」（クリスタル+X）
    ['fortune', b => (roll(state, 'fortune', 0.5) ? addToDeck(state, me, me, specialCard('sp5', b.x)) : addToDeck(state, me, foe, specialCard('sp2')))],
    // Tinker：自分の山札に、ランダムなコモンの装備（無色か、持ち主と同じ色）を1枚。コスト-X
    ['tinker', b => { const pool = EQUIPS.filter(c => c.rarity === 'common' && (!c.color || c.color === b.m.card.color)); return addToDeck(state, me, me, pool[pickRandom(state, pool.length)], -b.x); }],
  ];
  for (const [id, add] of adders) {
    const b = best(id);
    if (!b || !b.x) continue;
    const entry = add(b);
    events.push({ kind: id, source: b.m, x: b.x, item: entry.card, side: foe.deck.includes(entry) ? 'foe' : undefined });
  }
  // Attunement：このターンに味方が回復されていれば、このカードのコスト-X（手札・山札・場のどこにいても）
  if (me.healed) {
    const xOf = card => (card.skills || []).filter(k => k.id === 'attunement').reduce((n, k) => n + k.x, 0);
    let count = 0, amount = 0;
    for (const h of [...me.hand, ...me.deck]) { const x = xOf(h.card); if (x) { h.mod = (h.mod || 0) - x; count++; amount = x; } }
    for (const m of me.slots.filter(y => y)) { const x = xOf(m.card); if (x) { m.costMod = (m.costMod || 0) - x; count++; amount = x; } }
    if (count) events.push({ kind: 'attunement', x: amount, count });
  }
  // 燃焼：どちらのターンの終わりにも、燃えているモンスター（両者）がスタック数ぶんの魔法ダメージを受け、スタックが1減る
  for (const p of [me, foe]) {
    for (const t of p.slots.filter(y => y && y.status.burn)) {
      const slot = p.slots.indexOf(t);
      if (slot < 0) continue;
      const x = t.status.burn;
      if (x > 1) t.status.burn = x - 1; else delete t.status.burn;
      events.push({ kind: 'burning', target: t, x, ...dealDamage(state, p, slot, x, true) });
    }
  }
  // このターンだけの召喚モンスター（Sortie の突撃ゴーレム）が消える
  const leaving = expireTokens(me, 'turnEnd');
  if (leaving.length) events.push({ kind: 'tokenend', targets: leaving });
  state.sink = null;
  return events;
}

// ターン終了時：手番プレイヤーのモンスターの拘束が解け、Silence の残りターンが減る
function endOfTurnStatuses(p) {
  for (const m of p.slots) {
    if (!m) continue;
    delete m.status.entangle;
    if (m.status.silence && --m.status.silence <= 0) delete m.status.silence;
    if (m.status.stall && --m.status.stall <= 0) delete m.status.stall;
  }
}

// ---------- フラッシュカード（使い切り） ----------

// 対象の取り方：enemy=相手モンスター1体 / ally=自分のモンスター1体 / none=対象なし
const FLASH_TARGET = {
  smite: 'enemy', lightning: 'enemy', unsummon: 'enemy', corrosion: 'enemy', terminate: 'enemy', stall: 'enemy',
  heal: 'ally', retreat: 'ally', regroup: 'ally', lingeringfog: 'ally', phantom: 'ally',
  reinforcement: 'none', groupheal: 'none', groupdisease: 'none', masscorrosion: 'none', plagueburst: 'none', tax: 'none', swarm: 'none', unwelcomegift: 'none', purge: 'none',
};

function flashTarget(card) { return card.skills[0] ? FLASH_TARGET[card.skills[0].id] : undefined; } // じゃまカードは使えない

// 色付きのフラッシュは、その色のモンスターが自分の場にいるときだけ使える（無色はいつでも）
function flashUsable(p, card) {
  if (card.junk) return false; // じゃまカードは使えない（生贄にはできる）
  return !card.color || p.slots.some(m => m && m.card.color === card.color);
}

// フラッシュを使う。成功したら演出用のイベントを返す（失敗は null）
function playFlash(state, pi, uid, slot) {
  const p = state.players[pi];
  const foe = state.players[1 - pi];
  const h = handCard(state, pi, uid);
  if (!h || h.card.kind !== 'flash' || costOf(p, h) > p.crystals || !flashUsable(p, h.card)) return null;
  const skill = h.card.skills[0];
  const id = skill.id;
  const mode = flashTarget(h.card);
  const target = mode === 'enemy' ? foe.slots[slot] : mode === 'ally' ? p.slots[slot] : null;
  if (mode !== 'none' && !target) return null;
  // Corrosion は装備を付けた相手にだけ使える
  if (id === 'corrosion' && !target.item) return null;
  // Swarm は自分の場に、Unwelcome Gift は相手の場に、空きがあるときだけ使える
  if (id === 'swarm' && placementSlot(p, 0) < 0) return null;
  if (id === 'unwelcomegift' && placementSlot(foe, 0) < 0) return null;
  // Phantom は、自分の場が満員でなく、まだ分身の予約がない味方にだけ使える
  if (id === 'phantom' && (placementSlot(p, 0) < 0 || target.phantomPending)) return null;

  p.crystals -= costOf(p, h);
  removeFromHand(p, h);
  p.discard.push(h.card);
  // group: 全体効果の対象ごとの結果 / extras: 続いて起きた効果（Menace など）
  const ev = { card: h.card, skill, target, dmg: 0, armorDmg: 0, shielded: 0, heal: 0, cured: 0, gain: 0, killed: false, group: [], extras: [] };
  state.sink = ev.extras;
  if (id === 'smite') Object.assign(ev, dealDamage(state, foe, slot, skill.x, false));
  if (id === 'lightning') Object.assign(ev, dealDamage(state, foe, slot, skill.x, true)); // Magic Reflect は発動しない
  if (id === 'heal') {
    Object.assign(ev, healMonster(target, skill.x + mendingAura(p)));
    mend(p, target);
    const hs = healingShield(h.card.skills, target); // フラッシュの Healing Shield は、回復した味方が盾を得る
    if (hs) ev.extras.push(hs);
  }
  if (id === 'groupheal') ev.group = p.slots.filter(m => m).map(m => { const r = healMonster(m, skill.x + mendingAura(p)); mend(p, m); return r; });
  // Stall：敵1体がXターンのあいだ攻撃できない（Perseverance 持ちには効かない）
  if (id === 'stall') {
    if (hasSkill(target, 'perseverance')) ev.immune = true;
    else target.status.stall = Math.max(target.status.stall || 0, skill.x);
  }
  // Plague Burst：Disease 状態の敵全員に、スタック数×Xの魔法ダメージ（スタックは減らない）
  if (id === 'plagueburst') {
    for (const m of foe.slots.filter(x => x && x.status.disease)) {
      const at = foe.slots.indexOf(m);
      if (at < 0) continue;
      const x = m.status.disease * skill.x;
      ev.group.push({ target: m, x, ...dealDamage(state, foe, at, x, true) });
    }
  }
  if (id === 'groupdisease') {
    ev.group = foe.slots.filter(m => m).map(m => ({ target: m, x: skill.x, immune: !addDisease(m, skill.x) }));
  }
  if (id === 'reinforcement') {
    ev.gain = skill.x;
    p.crystals += skill.x;
  }
  if (id === 'corrosion') ev.destroyed = [destroyItem(foe, target)];
  if (id === 'masscorrosion') {
    ev.group = foe.slots.filter(m => m && m.item).map(m => ({ target: m, item: destroyItem(foe, m) }));
  }
  if (id === 'terminate') {
    // モンスター1体と、その装備を破壊する
    destroyItem(foe, target);
    takeOff(state, foe, slot);
    fallen(state, foe, target, true); // 倒されたときのスキルは発動しない
    ev.killed = true;
  }
  // Swarm：自分の場の空きを「身代わりゴーレム」（HP X）で埋める。次の自分のターン開始時に消える
  if (id === 'swarm') {
    ev.summoned = [];
    for (let t; (t = summonToken(state, p, 'tk3', skill.x, false, 'nextTurn'));) ev.summoned.push(t);
  }
  // Unwelcome Gift：相手の前列に「重荷ゴーレム」（HP X。攻撃できない。倒されると持ち主がクリスタルを失う）を置く
  if (id === 'unwelcomegift') ev.summoned = [summonToken(state, foe, 'tk4', skill.x, true)];
  // Purge：両者の手札と山札から、試合中に足されたカードをすべて取り除く
  if (id === 'purge') {
    ev.purged = 0;
    for (const pl of state.players) for (const pile of ['hand', 'deck']) {
      ev.purged += pl[pile].filter(c => c.added).length;
      pl[pile] = pl[pile].filter(c => !c.added);
    }
  }
  // Tax：相手の手札のアイテム（装備・フラッシュ）のコスト+X
  if (id === 'tax') {
    const hit = foe.hand.filter(c => c.card.kind !== 'monster');
    hit.forEach(c => { c.mod = (c.mod || 0) + skill.x; });
    ev.taxed = hit.length;
  }
  if (id === 'unsummon' || id === 'retreat' || id === 'regroup') {
    // モンスターを持ち主の山札に戻す。装備も山札に戻る。ダメージや状態はリセット（Regroup は、戻したモンスターのコスト-X）
    const owner = id === 'unsummon' ? foe : p;
    if (target.item) intoDeck(state, owner, target.item);
    // 召喚モンスターは山札に入らず、そのまま消える
    if (!target.isToken) intoDeck(state, owner, target.card, target.copy || 0, (target.costMod || 0) - (id === 'regroup' ? skill.x : 0));
    takeOff(state, owner, slot);
    ev.unsummoned = true;
  }
  if (id === 'lingeringfog') target.status.fog = true;
  if (id === 'phantom') target.phantomPending = true; // 分身は攻撃フェーズの最初に現れる
  ev.extras.push(...heroFirstAid(p));
  countStat(state, p, 'flash');
  state.sink = null;
  if (id === 'terminate' && state.tally) state.tally[pi].kills++;
  logPush(state, ['F', pi, h.card.id, logRef(state, target), { ...logOpts(state, ev), sk: undefined, ds: ev.destroyed && ev.destroyed[0] ? ev.destroyed[0].id : undefined }],
    ...ev.group.map(g => logSkill(state, { kind: id, ...g }, 'x')), ...ev.extras.map(x => logSkill(state, x, 'x')));
  ev.result = checkResult(state); // フラッシュで敵を倒した直後にも勝敗を判定する
  return ev;
}

// ---------- 攻撃フェーズ ----------

// 攻撃対象のスロット番号を返す（いなければ -1）
//   sharp: Taunt と Stealth を無視する（ヒーロースキル「鷹の目」の遠隔攻撃）
//   cull: カオスが、HPの最も低い敵を狙う（Cull）
function pickTarget(state, type, mySlot, foe, sharp, cull) {
  const alive = [0, 1, 2].filter(s => foe.slots[s]);
  if (!alive.length) return -1;
  // カオス：ランダムな敵（Cull があれば、HPの最も低い敵。同じなら前にいるほう）
  if (type === 'chaos') return cull ? alive.slice().sort((a, b) => foe.slots[a].hp - foe.slots[b].hp)[0] : alive[pickRandom(state, alive.length)];
  // 近接：前列（スロット1）
  if (type === 'melee') return alive[0];
  // 遠隔・魔法は、後列にいる Stealth 持ちを狙えない（前列は必ず狙える）
  const open = alive.filter(s => s === 0 || sharp || !hasSkill(foe.slots[s], 'stealth'));
  if (type === 'ranged') {
    // Taunt 持ちがいれば最優先。いなければ 対角 → 正面 → 前列
    const order = (mySlot === 1 ? [2, 1, 0] : [1, 2, 0]).filter(s => open.includes(s));
    const taunt = sharp ? undefined : order.find(s => hasSkill(foe.slots[s], 'taunt'));
    return taunt !== undefined ? taunt : order[0];
  }
  // 魔法：正面（同じ番号のスロット）。いなければ前列
  return open.includes(mySlot) ? mySlot : open[0];
}

// 隣り合うスロット（画面の並び：左=スロット2、中央=スロット1、右=スロット3）
const ADJACENT = [[1, 2], [0], [0]];

// 攻撃を1回解決する。結果のイベントを返す（extras に続いて起きた効果が順に入る）
// 処理順：対象の決定 → 回避（Flying。回避したら Dive）→ ブロック（遠隔とアーマー）
//   → ダメージの計算（カオスの乱数・Trickery・Anti-Air・Bombard）→ ダメージ（Fog・盾・アーマー）
//   → Magic Reflect（受けずに返す）→ Outbreak → Disease → Magic Blast → Thorns → Shield Spike
//   → 反撃（Cross-Counter / Counter / Magic Counter）→ Opportunity → Doublestrike → Swallow
// 途中で位置が変わった敵には、そのつど Menace が入る
//   forced: 狙う相手のスロットを決めておく（Arrow Rain）
function resolveAttack(state, me, foe, mon, from, a, forced) {
  const rng = state.rng;
  const hawkeye = a.type === 'ranged' && heroIs(me, 'hawkeye'); // 「鷹の目」：Taunt・Stealth 無視、ブロックされない
  // Point Blank：前列からの遠隔攻撃は、相手の前列を狙い、ブロックされない
  const pointBlank = a.type === 'ranged' && from === 0 && hasSkill(mon, 'pointblank');
  const t = forced !== undefined ? forced : pointBlank ? foe.slots.findIndex(m => m)
    : pickTarget(state, a.type, from, foe, hawkeye, a.type === 'chaos' && hasSkill(mon, 'cull'));
  const target = foe.slots[t];
  const ev = {
    kind: 'attack', attacker: mon, target, type: a.type, source: a.source,
    dodged: false, blocked: false, dmg: 0, armorDmg: 0, shielded: 0, fogged: false, killed: false, extras: [],
  };
  state.sink = ev.extras;
  const now = getAttacks(mon).find(x => x.type === a.type); // Swallow で増えた分も反映
  let amount = now ? now.atk : a.atk;
  const physical = a.type !== 'magic';
  const direct = a.type === 'melee' || a.type === 'ranged';
  const antiAir = skillX(mon, 'antiair');
  const flies = hasSkill(target, 'flying');
  // See-through：攻撃のとき、相手の防御スキル（Counter-Attack・Cross-Counter-Attack・Flying・Fog・Opportunity・Shield・Thorns）を無視する
  const see = hasSkill(mon, 'seethrough');
  if (see) ev.seeThrough = true;
  // Flying を持たず Anti-Air もない攻撃者の攻撃は、回避されることがある
  const canDodge = m => hasSkill(m, 'flying') && !hasSkill(mon, 'flying') && !antiAir && !see;

  // 地形（霧）：遠隔攻撃が外れることがある
  const land = terrainFx(me);
  if (a.type === 'ranged' && land.rangedMiss && roll(state, 'miss', land.rangedMiss)) {
    ev.dodged = ev.missed = true;
    state.sink = null;
    return ev;
  }
  const up = land.flyingDodge || 0; // 地形（天空）：Flying の回避率が上がる
  const dodge = a.type === 'melee' ? CONFIG.FLYING_DODGE_MELEE + up : a.type === 'ranged' ? CONFIG.FLYING_DODGE_RANGED + up : 0;
  if (dodge && canDodge(target) && roll(state, 'dodge', dodge)) {
    ev.dodged = true;
    countStat(state, foe, 'dodge');
    state.sink = null;
    return ev;
  }
  // 遠隔はアーマー持ちに一定確率でブロックされる（Shoot Command 中はブロックされない）
  if (a.type === 'ranged' && target.armor > 0 && !mon.buff.shoot && !hawkeye && !pointBlank && roll(state, 'block', CONFIG.RANGED_BLOCK_CHANCE)) {
    ev.blocked = true;
    state.sink = null;
    return ev;
  }
  // カオスは 1〜攻撃力。Trickery を受けていれば最大値
  // カオスは 1〜攻撃力。パズルでは、問題で決めた値（指定がなければ最大値）
  if (a.type === 'chaos') amount = mon.buff.trickery ? amount : state.fixed ? Math.min(amount, state.fixed.chaos || amount) : 1 + Math.floor(rng() * amount);
  if (a.type === 'chaos' && mon.buff.trickery) ev.trickery = true;
  const maxRoll = a.type === 'chaos' && now && amount >= now.atk; // カオスが最大値で出た（Lucky Shot 用）
  if (flies && antiAir) { amount += antiAir; ev.antiAir = antiAir; }
  // Bombard / Mass Bombard：Flying 持ちが、Flying を持たない敵を近接・遠隔で攻撃するとき追加ダメージ
  if (direct && hasSkill(mon, 'flying') && !flies) {
    const b = skillX(mon, 'bombard') + (mon.buff.massbombard || 0);
    if (b) { amount += b; ev.bombard = b; }
  }

  // ヒーロースキル「先陣の誉れ」：前列にいる味方の近接攻撃+1
  if (a.type === 'melee' && from === 0 && (heroIs(me, 'vanguard') || heroIs(me, 'boss_charge'))) { amount += 1; ev.heroBonus = 1; }
  if (hawkeye || ev.heroBonus) ev.heroUsed = me.hero.skill;
  // お守り：前列の近接+1／後列からの遠隔+1／カオスのダメージは最低2
  if (a.type === 'melee' && from === 0 && charm(me, 'front_melee')) amount += 1;
  if (a.type === 'ranged' && from > 0 && charm(me, 'back_ranged')) amount += 1;
  if (a.type === 'chaos' && charm(me, 'chaos_min')) amount = Math.max(amount, 2);

  // Ambush：後列の敵へのダメージ+X　／　Exploit：魔法攻撃のとき、相手の状態異常1つにつき+X
  const ambush = t > 0 ? skillX(mon, 'ambush') : 0;
  if (ambush) { amount += ambush; ev.ambush = ambush; }
  const exploit = a.type === 'magic' ? skillX(mon, 'exploit') * debuffCount(target) : 0;
  if (exploit) { amount += exploit; ev.exploit = exploit; }

  const piercing = hasSkill(mon, 'piercing');
  const sunder = a.type === 'melee' && hasSkill(mon, 'sunder');           // 近接がアーマーを無視する
  const spellpierce = a.type === 'magic' && hasSkill(mon, 'spellpierce'); // 魔法が Magic Reflect と Mirror Shield を無視する
  const stacks = target.status.disease || 0;
  const neighbors = a.type === 'magic' ? ADJACENT[t].map(s => foe.slots[s]).filter(Boolean) : [];
  // Magic Reflect：魔法攻撃を75%で受けず、同じダメージを攻撃者に返す（Disease 状態では使えない。1ターンに5回まで）
  const reflects = a.type === 'magic' && !spellpierce && hasSkill(target, 'magicreflect') && !target.status.disease
    && (target.reflects || 0) < CONFIG.MAGIC_REFLECT_MAX && roll(state, 'reflect', CONFIG.MAGIC_REFLECT_CHANCE);
  // Deflect：遠隔攻撃を75%で受けず、同じダメージを攻撃者に返す
  const deflects = a.type === 'ranged' && hasSkill(target, 'deflect') && roll(state, 'deflect', CONFIG.DEFLECT_CHANCE);
  // Static Guard：相手のターン中、最初の攻撃を1回だけ防ぎ、攻撃者にXの魔法ダメージ（See-through には効かない）
  const guard = !reflects && !deflects && !see && !target.guardUsed ? skillX(target, 'staticguard') : 0;
  const avoided = reflects || deflects || guard > 0;
  if (reflects) { target.reflects = (target.reflects || 0) + 1; ev.reflected = true; }
  else if (deflects) ev.reflected = ev.deflected = true;
  else if (guard) { target.guardUsed = true; ev.guarded = true; }
  else Object.assign(ev, dealDamage(state, foe, t, amount, !physical, piercing, see, { fixed: a.type === 'chaos', noArmor: sunder, noMirror: spellpierce })); // カオスは固定ダメージ
  let kills = ev.killed ? 1 : 0;
  const hurt = ev.dmg + ev.armorDmg > 0; // ダメージを受けた（アーマーだけ削れた場合も含む）
  const onField = m => me.slots.includes(m) || foe.slots.includes(m);
  // 攻撃者にダメージを返す（反撃・反射など）。これ自体は、さらに反撃を呼ばない
  const strikeBack = (kind, source, amt, magic) => {
    if (!me.slots.includes(mon) || amt <= 0) return;
    const r = dealDamage(state, me, me.slots.indexOf(mon), amt, magic);
    ev.extras.push({ kind, source, target: mon, x: amt, ...r });
    if (r.killed && onField(source)) swallow(source, 1, ev);
  };

  if (reflects) strikeBack('magicreflect', target, amount, true);
  if (deflects) strikeBack('deflect', target, amount, false);
  if (guard) strikeBack('staticguard', target, guard, true);
  // Outbreak：スタック数ぶんの追加魔法ダメージ（スタックは減らない）
  if (!ev.killed && !avoided && stacks && hasSkill(mon, 'outbreak')) {
    const r = dealDamage(state, foe, foe.slots.indexOf(target), stacks, true);
    ev.extras.push({ kind: 'outbreak', target, ...r });
    if (r.killed) kills++;
  }
  // Scorch：近接・遠隔のダメージを与えた敵を燃焼にする
  const scorch = direct && hurt && foe.slots.includes(target) ? skillX(mon, 'scorch') : 0;
  if (scorch) ev.extras.push({ kind: 'scorch', target, x: scorch, immune: !addBurn(target, scorch) });
  // Disease：物理ダメージを与えた敵に付与
  const disease = skillX(mon, 'disease');
  if (disease && physical && hurt && foe.slots.includes(target)) {
    const immune = !addDisease(target, disease);
    ev.extras.push({ kind: 'disease', target, x: disease, immune });
  }
  // Magic Blast：魔法攻撃のとき、隣の敵にも追加の魔法ダメージ（Magic Reflect は発動しない）
  const blast = a.type === 'magic' && !avoided ? skillX(mon, 'magicblast') : 0;
  for (const n of blast ? neighbors : []) {
    if (!foe.slots.includes(n)) continue;
    const r = dealDamage(state, foe, foe.slots.indexOf(n), blast, true);
    ev.extras.push({ kind: 'magicblast', target: n, x: blast, ...r });
    if (r.killed) kills++;
  }
  // Echo：魔法が当たると、半分（切り上げ）のダメージがランダムな敵へ跳ねる。最大3回、ダメージが1になるまで
  if (a.type === 'magic' && hurt && hasSkill(mon, 'echo')) {
    let d = amount;
    for (let i = 0; i < CONFIG.ECHO_MAX && d > 1; i++) {
      d = Math.ceil(d / 2);
      const pool = [0, 1, 2].filter(s2 => foe.slots[s2]);
      if (!pool.length) break;
      const s2 = pool[pickRandom(state, pool.length)];
      const victim = foe.slots[s2];
      const r = dealDamage(state, foe, s2, d, true);
      ev.extras.push({ kind: 'echo', target: victim, x: d, ...r });
      if (r.killed) kills++;
    }
  }
  // Trample：近接・遠隔で倒したとき、余ったダメージを、ほかの敵に分けて与える（物理）
  if (direct && ev.killed && ev.over > 0 && hasSkill(mon, 'trample')) {
    const rest = foe.slots.filter(m => m);
    rest.forEach((victim, i) => {
      const share = Math.floor(ev.over / rest.length) + (i < ev.over % rest.length ? 1 : 0);
      const at = foe.slots.indexOf(victim);
      if (!share || at < 0) return;
      const r = dealDamage(state, foe, at, share, false);
      ev.extras.push({ kind: 'trample', target: victim, x: share, ...r });
      if (r.killed) kills++;
    });
  }
  // Lucky Shot：カオスが最大値で当たると、ランダムな敵にXの固定ダメージ
  const lucky = maxRoll && hurt ? skillX(mon, 'luckyshot') : 0;
  const luckyPool = lucky ? [0, 1, 2].filter(s2 => foe.slots[s2]) : [];
  if (luckyPool.length) {
    const s2 = luckyPool[pickRandom(state, luckyPool.length)];
    const victim = foe.slots[s2];
    const r = dealDamage(state, foe, s2, lucky, false, false, false, { fixed: true });
    ev.extras.push({ kind: 'luckyshot', target: victim, x: lucky, ...r });
    if (r.killed) kills++;
  }
  if (me.slots.includes(mon) && hurt) {
    // Leech：攻撃が当たるたび、HPと最大HPが永続で+X　／　Keen Eye：遠隔が当たるたび、遠隔攻撃が永続で+X
    const leech = growBy(mon, skillX(mon, 'leech'));
    if (leech) { mon.maxHp += leech; mon.hp += leech; ev.extras.push({ kind: 'leech', target: mon, x: leech }); }
    const keen = a.type === 'ranged' ? growBy(mon, skillX(mon, 'keeneye')) : 0;
    if (keen) { mon.growRanged = (mon.growRanged || 0) + keen; ev.extras.push({ kind: 'keeneye', target: mon, x: keen }); }
  }
  if (!ev.fogged) {
    // Thorns：近接攻撃を受けたら攻撃者にダメージ（アーマーから削る）
    if (a.type === 'melee' && !see) strikeBack('thorns', target, skillX(target, 'thorns'), false);
    if (hurt) {
      // Shield Spike：ダメージを受けるたびに攻撃元へ返す（攻撃元も Shield Spike 持ちなら発動しない）
      if (!hasSkill(mon, 'shieldspike')) strikeBack('shieldspike', target, skillX(target, 'shieldspike'), false);
      // 反撃：生き残っていれば、自分の近接攻撃力で殴り返す
      const melee = foe.slots.includes(target) ? getAttacks(target).find(x => x.type === 'melee') : null;
      if (melee && melee.atk > 0) {
        let counter = '';
        if (a.type === 'melee' && !see) {
          if (hasSkill(target, 'crosscounter') && (target.counters || 0) < CONFIG.CROSS_COUNTER_MAX) {
            target.counters = (target.counters || 0) + 1;
            counter = 'crosscounter';
          } else if (hasSkill(target, 'counter') && roll(state, 'counter', CONFIG.COUNTER_CHANCE)) counter = 'counter';
        } else if (a.type === 'magic' && hasSkill(target, 'magiccounter') && roll(state, 'counter', CONFIG.COUNTER_CHANCE)) counter = 'magiccounter';
        if (counter) strikeBack(counter, target, melee.atk, false);
      }
    }
  }
  // Opportunity：後列からの近接攻撃（Reach）をした敵に、遠隔攻撃を1回行う
  if (a.type === 'melee' && from > 0 && !see) {
    for (const o of foe.slots.filter(m => m && hasSkill(m, 'opportunity'))) {
      const shot = getAttacks(o).find(x => x.type === 'ranged');
      if (shot && shot.atk > 0) strikeBack('opportunity', o, shot.atk, false);
    }
  }
  // Doublestrike：近接攻撃が当たったら、ランダムな後列の敵に追加ダメージ
  const ds = me.slots.includes(mon) ? skillX(mon, 'doublestrike') : 0;
  const back = [1, 2].filter(s => foe.slots[s]);
  if (ds && a.type === 'melee' && back.length && !ev.fogged) {
    const s = back[pickRandom(state, back.length)];
    const victim = foe.slots[s];
    const x = { kind: 'doublestrike', target: victim, dodged: false, dmg: 0, armorDmg: 0, shielded: 0, killed: false };
    if (canDodge(victim) && roll(state, 'dodge', CONFIG.FLYING_DODGE_MELEE + up)) x.dodged = true;
    else Object.assign(x, dealDamage(state, foe, s, ds, false, piercing));
    ev.extras.push(x);
    if (x.killed) kills++;
  }
  if (me.slots.includes(mon)) swallow(mon, kills, ev);
  countStat(state, me, 'kill_' + a.type, kills);
  const tally = state.tally && state.tally[state.players.indexOf(me)];
  if (tally) tally.by[mon.card.id] = (tally.by[mon.card.id] || 0) + ev.dmg + ev.armorDmg;
  // ヒーロースキル「戦利品」：味方が攻撃で敵を倒すたびに、クリスタル+1
  if (kills && heroIs(me, 'spoils')) {
    me.crystals += kills;
    ev.extras.push({ kind: 'hero', id: 'spoils', effect: 'gain', gain: kills, target: mon });
  }
  // Harvest：このモンスターが敵を倒すたび、クリスタル+X
  const harvest = kills && me.slots.includes(mon) ? skillX(mon, 'harvest') * kills : 0;
  if (harvest) { me.crystals += harvest; ev.extras.push({ kind: 'harvest', target: mon, x: harvest, gain: harvest }); }
  if (kills && charm(me, 'bounty')) me.crystals += 1; // お守り：攻撃で敵を倒すとクリスタル+1（1回の攻撃につき1）
  // ヒーロースキル「道連れの病」：Disease を持つ味方が倒されたら、倒した敵に Disease 2
  if (ev.killed && heroIs(foe, 'contagion') && baseSkillX(target, 'disease') && me.slots.includes(mon) && addDisease(mon, 2)) {
    ev.extras.push({ kind: 'hero', id: 'contagion', effect: 'disease', x: 2, target: mon, side: 'foe' });
  }
  state.sink = null;
  return ev;
}

// Swallow：敵を倒すたび、全攻撃力と最大HPが永続的に増える
function swallow(mon, kills, ev) {
  const x = skillX(mon, 'swallow') * kills;
  if (!x) return;
  mon.bonusAtk += x;
  mon.maxHp += x;
  mon.hp += x;
  ev.extras.push({ kind: 'swallow', target: mon, x });
}

// 攻撃を1回ずつ進めるジェネレータ。yield のたびに状態は更新済み。
// 画面側は受け取ったイベントでアニメーションを再生する。
//   { kind: 'attack', ... }  攻撃1回
//   { kind: 'skip', attacker, reason }  攻撃できなかった理由（entangle / silence / suppress / demoralize）
//   { kind: 'phase', events }  攻撃フェーズの開始時・終了時の効果（Phantom の分身、Mass Bombard）
// 攻撃フェーズ。起きたことを1つずつ返しながら、対戦ログにも記録する
function* attackPhase(state) {
  for (const ev of attackPhaseAll(state)) {
    logAttackEvent(state, ev);
    yield ev;
  }
}

function* attackPhaseAll(state) {
  const me = state.players[state.current];
  const foe = state.players[1 - state.current];
  state.phase = 'attack';
  // ヒーロースキル「清めの儀」：攻撃フェーズ開始時、味方全員のデバフを解除
  if (heroIs(me, 'purify')) {
    const targets = me.slots.filter(m => m && debuffCount(m) > 0);
    targets.forEach(t => { DEBUFFS.forEach(k => delete t.status[k]); });
    if (targets.length) yield { kind: 'phase', events: [{ kind: 'hero', id: 'purify', effect: 'cleanse', targets }] };
  }
  // Phantom：攻撃フェーズの最初に分身が現れる（一番後ろの空きスロット。同じHP・攻撃力・装備・スキル）
  const born = [];
  for (const mon of me.slots.filter(m => m && m.phantomPending)) {
    delete mon.phantomPending;
    const at = placementSlot(me, 2);
    if (at < 0 || !foe.slots.some(m => m)) continue; // 満員、または攻撃する相手がいなければ現れない
    const copy = { ...makeMonster(uidSeq++, mon.card), hp: mon.hp, maxHp: mon.maxHp, armor: mon.armor, item: mon.item, bonusAtk: mon.bonusAtk, buff: { ...mon.buff }, isPhantom: true, copy: mon.copy || 0 };
    setOwner(copy, me);
    me.slots[at] = copy;
    born.push({ kind: 'phantom', source: mon, target: copy, targets: [copy] });
  }
  if (born.length) yield { kind: 'phase', events: born };
  yield* attackPhaseMain(state, me, foe);
  // 分身は攻撃フェーズの終わりに自滅する
  const gone = me.slots.filter(m => m && m.isPhantom);
  if (gone.length) {
    yield { kind: 'phase', events: [{ kind: 'phantomend', targets: gone }] };
    gone.forEach(m => removeMonster(me, me.slots.indexOf(m)));
  }
}

function* attackPhaseMain(state, me, foe) {
  // Mass Bombard：攻撃フェーズ開始時、Flying を持つ味方全員が追加ダメージを得る（最も強いものだけ）
  const mb = me.slots.filter(m => m).map(m => ({ source: m, x: skillX(m, 'massbombard') })).sort((a, b) => b.x - a.x)[0];
  if (mb && mb.x && foe.slots.some(m => m)) {
    const targets = me.slots.filter(m => m && hasSkill(m, 'flying'));
    targets.forEach(m => { m.buff.massbombard = mb.x; });
    if (targets.length) yield { kind: 'phase', events: [{ kind: 'massbombard', source: mb.source, x: mb.x, targets }] };
  }
  // 行動順は開始時にモンスターで確定させる（スロット3→2→1）。
  // 途中で移動が起きても順番は変えず、各モンスターが行動するのは1回だけ。
  const order = me.slots.filter(m => m).reverse();
  for (const mon of order) {
    const slot = me.slots.indexOf(mon);
    if (slot < 0) continue; // 行動前に倒された
    if (!foe.slots.some(m => m)) return;
    if (mon.status.entangle) { yield { kind: 'skip', attacker: mon, reason: 'entangle' }; continue; }
    if (mon.status.stall) { yield { kind: 'skip', attacker: mon, reason: 'stall' }; continue; } // Stall：攻撃できない
    if (mon.card.noAttack) continue; // 重荷ゴーレムは攻撃しない
    let followed = false; // Follow Through は1ターンに1回
    // 本体の攻撃＋武器の攻撃＋スキルの追加攻撃を、行動時点のスロットのルールでまとめて行う
    for (const a of actionAttacks(mon, slot)) {
      const from = me.slots.indexOf(mon);
      if (from < 0) break; // 行動の途中で倒された（Thorns など）
      if (!foe.slots.some(m => m)) return;
      if (a.skip) { yield { kind: 'skip', attacker: mon, reason: a.skip, type: a.type }; continue; }
      // Arrow Rain：遠隔攻撃が、後列の敵全員に当たる（Taunt・Stealth を無視。後列がいなければふつうに狙う）
      const rain = a.type === 'ranged' && from > 0 && hasSkill(mon, 'arrowrain') ? foe.slots.slice(1).filter(m => m) : [];
      if (rain.length) {
        for (const victim of rain) {
          const at = foe.slots.indexOf(victim);
          if (at < 0 || !me.slots.includes(mon)) continue;
          yield resolveAttack(state, me, foe, mon, me.slots.indexOf(mon), { ...a, source: a.source === 'base' ? 'arrowrain' : a.source }, at);
        }
        continue;
      }
      const ev = resolveAttack(state, me, foe, mon, from, a);
      yield ev;
      // Follow Through：近接攻撃でHPを削れなかったら、もう1回近接攻撃
      if (a.type === 'melee' && !followed && !ev.dmg && me.slots.includes(mon) && foe.slots.some(m => m) && hasSkill(mon, 'followthrough')) {
        followed = true;
        yield resolveAttack(state, me, foe, mon, me.slots.indexOf(mon), { ...a, source: 'followthrough' });
      }
    }
  }
}

// ---------- 勝敗 ----------

// 残りモンスター数（場＋手札＋山札）。生贄にしたカードは除外されているので数えない
function monstersLeft(p) {
  const inPile = pile => pile.filter(h => h.card.kind === 'monster').length;
  return p.slots.filter(m => m && !m.isToken).length + inPile(p.hand) + inPile(p.deck); // 召喚モンスターは数えない
}

// 場・手札・山札のどこにもモンスターがいない側の負け。引き分けはなく、
// 両者が同時にいなくなった場合は、そのターンの行動側の勝ち。
// 決着がついていれば result を返す（ついていなければ null）。
// 生贄で自分の残りが0体になった手番プレイヤーの負けは、ターン開始時（atTurnStart）まで持ち越す。
function checkResult(state, atTurnStart = false) {
  if (state.noResult) return null; // パズル：残りモンスター数では決着しない（目標だけで判定する）
  const zero = state.players.map(p => monstersLeft(p) === 0);
  const [a, b] = zero;
  if (!a && !b) return null;
  const cur = state.current;
  if (!atTurnStart && zero[cur] && !zero[1 - cur] && state.players[cur].wipedBySacrifice) return null;
  state.phase = 'over';
  state.result = a && b ? { winner: cur, reason: 'both' } : { winner: a ? 1 : 0, reason: 'wipeout' };
  logPush(state, ['R', state.result.winner, state.result.reason]);
  return state.result;
}

// 場が空のペナルティ：手札と山札を合わせた全カードからランダムに1枚、ゲームから除外する。
// （選べない・クリスタルはもらえない。）捨てたカードの情報を返す。1枚もなければ null
function emptyFieldPenalty(state, pi) {
  const p = state.players[pi];
  const total = p.hand.length + p.deck.length;
  if (p.slots.some(m => m) || total === 0 || state.noResult) return null; // パズルでは、場が空のペナルティもなし
  // 試合中に足されたカード（がらくた・火の玉など）は、ほかのカードが残っているあいだは捨てる対象にしない。
  // （相手にカードを足されたせいで、ペナルティが軽くなってしまわないように）
  const all = [...p.hand, ...p.deck];
  const pool = all.some(c => !c.added) ? all.filter(c => !c.added) : all;
  const h = pool[Math.floor(state.rng() * pool.length)];
  const fromHand = p.hand.includes(h);
  if (fromHand) p.hand.splice(p.hand.indexOf(h), 1); else p.deck.splice(p.deck.indexOf(h), 1);
  return { player: pi, card: h.card, copy: h.copy || 0, from: fromHand ? 'hand' : 'deck' };
}

// ターン終了（攻撃フェーズ後）：場が空ならペナルティ → 勝敗判定。
// 決着がつけば result を返し、つかなければ手番を交代して null
function finishTurn(state) {
  state.endEvents = endOfTurnSkills(state);
  logPush(state, ...state.endEvents.map(e => logSkill(state, e)));
  // ターン終了で解ける状態異常（Entangle、残り1ターンの Silence）
  const me = state.players[state.current];
  const fading = me.slots.filter(m => m).flatMap(m => [m.status.entangle && [m, 'entangle'], m.status.silence === 1 && [m, 'silence']].filter(x => x));
  endOfTurnStatuses(me);
  logPush(state, ...fading.map(([m, st]) => ['X', state.current, logRef(state, m), st]));
  state.penalty = emptyFieldPenalty(state, state.current);
  if (state.penalty) logPush(state, ['Y', state.current, logCardRef(state.penalty), state.penalty.from]);
  const result = checkResult(state);
  if (result) {
    if (state.penalty && state.penalty.card.kind === 'monster' && result.winner !== state.current) result.penalty = true;
    return result;
  }
  state.current = 1 - state.current;
  return null;
}

function surrender(state, pi) {
  state.phase = 'over';
  state.result = { winner: 1 - pi, reason: 'surrender' };
  logPush(state, ['R', state.result.winner, 'surrender']);
  return state.result;
}

// ---------- CPU ----------

// 相手の場の特徴（スキルを考えた配置・カード選びに使う）
function foeTraits(foe) {
  const mons = foe.slots.filter(m => m);
  const attacksWith = type => mons.some(m => getAttacks(m).some(a => a.type === type));
  return {
    flying: mons.some(m => hasSkill(m, 'flying')),
    armor: mons.some(m => m.armor > 0),
    caster: attacksWith('magic') || mons.some(m => skillX(m, 'heal') || skillX(m, 'groupheal')),
    melee: attacksWith('melee'),
    reflect: mons.some(m => hasSkill(m, 'magicreflect') || hasSkill(m, 'magiccounter') || hasSkill(m, 'mirrorshield')),
  };
}

// 相手の場に刺さるカードほど高い値（Flying には Anti-Air、魔法や回復には Silence など）
function counterBonus(card, t) {
  const has = id => (card.skills || []).some(k => k.id === id);
  let bonus = 0;
  if (t.flying) bonus += has('antiair') ? 3 : (card.type === 'magic' || card.type === 'chaos' || has('flying')) ? 1 : 0;
  if (t.caster) bonus += has('silence') ? 3 : has('suppress') ? 1 : 0;
  if (t.melee && (has('thorns') || has('demoralize'))) bonus += 1.5;
  if (t.armor && (card.type === 'magic' || has('piercing'))) bonus += 1;
  if (t.reflect && card.type === 'magic') bonus -= 2;            // Magic Reflect 持ちには魔法を避ける
  // Fear（位置を入れ替える）と Menace（位置が変わった敵にダメージ）は組み合わせる
  const mine = id => (t.own || []).some(c => (c.skills || []).some(k => k.id === id));
  if ((has('menace') && mine('fear')) || (has('fear') && mine('menace'))) bonus += 2.5;
  return bonus;
}

// 装備をそのモンスターに付けたときの価値（0以下なら付ける意味なし）。
//   target: 場のモンスター、またはカード（手札のモンスターを想定するとき）
//   rush:   消耗ダメージが近いとき。守りの装備より攻撃の装備を優先する
//   t:      相手の場の特徴（foeTraits）
function itemScore(item, target, slot, rush, t = {}) {
  const mon = target.card ? target : makeMonster(0, target);
  const equipped = { ...mon, item };
  const usable = (m, a) => slot === undefined || canUseType(m, a.type, slot);
  const sum = m => getAttacks(m).reduce((n, a) => n + a.atk * (usable(m, a) ? 1 : 0.5), 0);
  let value = sum(equipped) - sum(mon) // Reach で攻撃できるようになる分もここに入る
    + ((item.armor || 0) * 0.8 + (item.hp || 0) * 0.4) * (rush ? 0.4 : 1);
  const melee = getAttacks(equipped).find(a => a.type === 'melee');
  for (const k of item.skills || []) {
    const x = k.x === undefined ? 1 : k.x;
    switch (k.id) {
      case 'reach': break;
      case 'batter': value += melee && usable(equipped, melee) ? melee.atk * x : 0.3; break;
      case 'antiair': value += t.flying ? x + 1 : 0.3; break;
      case 'silence': value += t.caster ? 3 : 0.5; break;
      case 'piercing': value += t.armor ? 1.5 : 0.5; break;
      case 'thorns': value += x * (slot ? 0.4 : 1); break;      // 近接を受ける前列で活きる
      case 'stealth': value += slot === 0 ? 0.3 : 1.5; break;   // 後列で活きる
      case 'flying': value += 2; break;
      case 'sunder': value += t.armor ? 2 : 0.5; break;
      case 'pointblank': case 'followthrough': case 'cull': value += 1; break;
      case 'fury': case 'harvest': case 'mendingaura': case 'partinggift': case 'fallback': value += 1; break;
      case 'steadyaim': case 'ambush': value += slot === 0 ? 0.3 : x; break; // 後列の射手で活きる
      default: value += x;
    }
  }
  return value;
}

// 並び（前から順）で出せる攻撃力の合計
function lineupAttack(line) {
  return line.reduce((sum, m, s) => sum + getAttacks(m)
    .filter(a => canUseType(m, a.type, s))
    .reduce((n, a) => n + a.atk, 0), 0);
}

// 並びの強さ：攻撃力に、スキルを活かせる位置取りの評価を足す
function lineupScore(line) {
  let score = lineupAttack(line);
  line.forEach((m, s) => {
    const tough = m.hp + m.armor + skillX(m, 'shield') * 3;
    if (s === 0) {
      score += tough * 0.05;                                   // 前列は頑丈なほうがよい
      score += skillX(m, 'thorns') * 0.5;                      // Thorns は近接を受ける前列で
      if (hasSkill(m, 'flying')) score += 0.8;                 // Flying は近接を回避できる前列で
      if (hasSkill(m, 'taunt') && tough >= 8) score += 1.5;    // 頑丈な Taunt が前で攻撃を集める
    } else if (hasSkill(m, 'stealth')) {
      score += 1.5;                                            // Stealth は後列で隠れる
    }
  });
  return score;
}

// 新しいモンスターをどこに差し込むと並びが一番強くなるか（押し出しも使う）
function cpuSlotFor(card, slots) {
  const line = slots.filter(m => m);
  const fresh = makeMonster(0, card);
  let best = 0;
  let bestScore = -1;
  for (let at = 0; at <= line.length; at++) {
    const next = line.slice();
    next.splice(at, 0, fresh);
    const score = lineupScore(next);
    if (score > bestScore) { best = at; bestScore = score; }
  }
  return best;
}

//   keep: 残りモンスターがこの数以下なら、手札のモンスターは生贄にしない（オート用。CPUは指定なし）
function cpuPickSacrifice(p, keep) {
  const mons = p.hand.filter(h => h.card.kind === 'monster');
  const equips = p.hand.filter(h => h.card.kind === 'equip');
  const items = p.hand.filter(h => h.card.kind !== 'monster');
  // 自分のどのモンスターにも付ける意味がない装備
  const owned = [...p.slots.filter(m => m && !m.item).map(m => m.card), ...mons.map(h => h.card)];
  const useless = equips.find(h => !owned.some(c =>
    (!h.card.color || h.card.color === c.color) && itemScore(h.card, c) > 0));
  if (useless) return useless;
  const cost = h => costOf(p, h);
  const byCost = list => list.slice().sort((x, y) => cost(x) - cost(y));
  const cheapItem = byCost(items)[0];
  const cheapest = byCost(mons)[0];
  // あと少しでモンスターを出せるなら、安いアイテムをクリスタルに換える
  if (p.slots.some(s => !s) && cheapItem && mons.some(h => cost(h) > p.crystals
      && cost(h) <= p.crystals + CONFIG.SACRIFICE_ITEM)) return cheapItem;
  // 場が空で、出せるモンスターがいないとき（場が空のままターンを終えるとカードを1枚失う）
  if (p.slots.every(s => !s)) {
    // モンスターを生贄にしてでも、いちばん安いモンスターを出す
    if (cheapest && mons.length > 1 && (keep == null || monstersLeft(p) > keep)
        && cost(cheapest) <= p.crystals + CONFIG.SACRIFICE_MONSTER) return byCost(mons)[mons.length - 1];
    // そうでなければ、モンスター以外のカードをクリスタルに換えて次に備える
    if (cheapItem) return byCost(equips)[0] || cheapItem;
  }
  return null;
}

// フラッシュを使う対象スロットを返す（対象なしは -1、使わないなら null）
function cpuFlashSlot(state, card) {
  const p = state.players[state.current];
  const foe = state.players[1 - state.current];
  const skill = card.skills[0];
  if (!skill) return null; // じゃまカードは使えない
  const slotsOf = pl => [0, 1, 2].filter(s => pl.slots[s]);
  if (skill.id === 'reinforcement') return skill.x > card.cost ? -1 : null;
  const lost = s => p.slots[s].maxHp - p.slots[s].hp;
  if (skill.id === 'heal') {
    const s = slotsOf(p).sort((a, b) => lost(b) - lost(a))[0];
    return s !== undefined && lost(s) >= Math.min(skill.x, 3) ? s : null;
  }
  if (skill.id === 'groupheal') {
    return slotsOf(p).reduce((n, s) => n + Math.min(skill.x, lost(s)), 0) >= skill.x + 1 ? -1 : null;
  }
  if (skill.id === 'groupdisease') {
    return slotsOf(foe).filter(s => !hasSkill(foe.slots[s], 'perseverance')).length >= 2 ? -1 : null;
  }
  const value = s => foe.slots[s].card.cost + (foe.slots[s].item ? foe.slots[s].item.cost + 1 : 0);
  if (skill.id === 'unsummon' || skill.id === 'terminate') {
    // 装備つき・コストの高い相手を狙う（安いモンスターには使わない）
    const s = slotsOf(foe).sort((a, b) => value(b) - value(a))[0];
    return s !== undefined && value(s) >= card.cost + (skill.id === 'terminate' ? 0 : 2) ? s : null;
  }
  if (skill.id === 'corrosion') {
    const s = slotsOf(foe).filter(x => foe.slots[x].item)
      .sort((a, b) => foe.slots[b].item.cost + foe.slots[b].armor - foe.slots[a].item.cost - foe.slots[a].armor)[0];
    return s === undefined ? null : s;
  }
  if (skill.id === 'masscorrosion') return slotsOf(foe).filter(s => foe.slots[s].item).length >= 2 ? -1 : null;
  if (skill.id === 'stall') {
    // いちばん攻撃力の高い相手を止める（もう止まっている相手、攻撃できない相手には使わない）
    const power = x => (foe.slots[x].status.stall || foe.slots[x].status.entangle ? 0 : getAttacks(foe.slots[x]).reduce((n, a) => n + (canUseType(foe.slots[x], a.type, x) ? a.atk : 0), 0));
    const s = slotsOf(foe).sort((a, b) => power(b) - power(a))[0];
    return s !== undefined && power(s) >= 3 ? s : null;
  }
  if (skill.id === 'plagueburst') {
    const total = slotsOf(foe).reduce((n, s) => n + (foe.slots[s].status.disease || 0) * skill.x, 0);
    return total >= card.cost * 2 + 2 || slotsOf(foe).some(s => (foe.slots[s].status.disease || 0) * skill.x >= foe.slots[s].hp) ? -1 : null;
  }
  if (skill.id === 'swarm') return slotsOf(p).length <= 1 && slotsOf(foe).length ? -1 : null; // 場が手薄なときの壁
  if (skill.id === 'unwelcomegift') {
    // 相手の前列が近接で殴ってくるとき、その前に割り込ませて攻撃を止める
    const front = foe.slots[0];
    return front && placementSlot(foe, 0) >= 0 && getAttacks(front).some(a => a.type === 'melee' && a.atk >= 2) && !hasSkill(front, 'reach') ? -1 : null;
  }
  if (skill.id === 'purge') return [...p.hand, ...p.deck].some(c => c.added && c.card.junk) || p.hand.filter(c => c.added && c.card.junk).length ? -1 : null; // 自分の側にじゃまカードがあるときだけ
  if (skill.id === 'tax') return foe.hand.length >= 3 ? -1 : null; // 相手の手札は見ない。枚数が多いときに使う
  if (skill.id === 'retreat' || skill.id === 'regroup') {
    // 瀕死の強いモンスターを山札に戻して立て直す（場が1体のときは戻さない）
    const s = slotsOf(p).filter(x => p.slots[x].hp <= 2 && p.slots[x].card.cost >= 4)[0];
    return s !== undefined && slotsOf(p).length > 1 ? s : null;
  }
  if (skill.id === 'phantom') {
    // 攻撃力のいちばん高い味方の分身を作る（場が満員、または相手がいなければ使わない）
    if (placementSlot(p, 0) < 0 || !slotsOf(foe).length) return null;
    const power = x => (p.slots[x].phantomPending ? -1 : getAttacks(p.slots[x]).reduce((n, a) => n + a.atk, 0));
    const s = slotsOf(p).sort((a, b) => power(b) - power(a))[0];
    return s !== undefined && power(s) > 0 ? s : null;
  }
  if (skill.id === 'lingeringfog') {
    const s = slotsOf(p).filter(x => !p.slots[x].status.fog)[0]; // 前にいる味方から
    return s === undefined || !slotsOf(foe).length ? null : s;
  }
  // ダメージ系：倒せる相手を優先。いなければHPに一番通る相手
  const magic = skill.id === 'lightning';
  const hpDmg = m => (!magic && m.armor > 0 ? 0 : skill.x);
  const score = s => {
    const m = foe.slots[s];
    return (hpDmg(m) >= m.hp ? 100 + m.card.cost : 0) + hpDmg(m) - m.hp / 100;
  };
  const s = slotsOf(foe).sort((a, b) => score(b) - score(a))[0];
  return s === undefined ? null : s;
}

// CPUの次の一手を返す。何もすることがなければ null（＝ターン終了）
//   opts.keep: オート用。残りモンスターがこの数以下なら、モンスターを生贄にしない（省略するとCPUの基準）
function cpuNextAction(state, opts = {}) {
  if (state.phase !== 'play') return null;
  const p = state.players[state.current];
  const affordable = h => costOf(p, h) <= p.crystals;
  // 消耗ダメージが近づいたら、試合を決めにいく（攻撃力の高いモンスター・攻撃の装備を優先）
  const rush = state.turn >= attritionStart(state) - CONFIG.ATTRITION_NOTICE;
  const traits = foeTraits(state.players[1 - state.current]);
  traits.own = [...p.slots.filter(m => m).map(m => m.card), ...p.hand.map(h => h.card)]; // 自分の場と手札（組み合わせの判断用）
  // 出す優先度：コストの高い順。相手の場に刺さるスキル（Flying に Anti-Air など）を持つカードは優先
  const power = h => (rush ? h.card.atk * 10 : 0) + h.card.cost + counterBonus(h.card, traits);

  // 1. モンスターを出す（スロット1が空なら、そこで攻撃できるタイプを優先。あとはコストの高い順）
  if (p.slots.some(s => !s)) {
    const frontEmpty = !p.slots[0];
    const front = h => (SLOT_TYPES[0].includes(h.card.type) ? 1 : 0);
    const playable = p.hand
      .filter(h => h.card.kind === 'monster' && affordable(h))
      .sort((a, b) => (frontEmpty && front(b) - front(a)) || power(b) - power(a));
    if (playable.length) {
      return { type: 'monster', uid: playable[0].uid, slot: cpuSlotFor(playable[0].card, p.slots) };
    }
  }

  // 2. 装備できるアイテムを強い順に付ける
  let best = null;
  for (const h of p.hand) {
    if (h.card.kind !== 'equip' || !affordable(h)) continue;
    for (let s = 0; s < 3; s++) {
      const mon = p.slots[s];
      if (!mon || mon.item || !canEquip(h.card, mon) || costOf(p, h, mon) > p.crystals) continue;
      const score = itemScore(h.card, mon, s, rush, traits);
      if (score > 0 && (!best || score > best.score)) best = { score, uid: h.uid, slot: s };
    }
  }
  if (best) return { type: 'equip', uid: best.uid, slot: best.slot };

  // 3. フラッシュを使う
  for (const h of p.hand) {
    if (h.card.kind !== 'flash' || !affordable(h) || !flashUsable(p, h.card)) continue;
    const slot = cpuFlashSlot(state, h.card);
    if (slot !== null) return { type: 'flash', uid: h.uid, slot };
  }

  // 4. 不要なカードを生贄にする（手札 → 場の順に検討）
  if (!p.sacrificed) {
    const fodder = cpuPickSacrifice(p, opts.keep);
    if (fodder) return { type: 'sacrifice', uid: fodder.uid };
    const slot = cpuPickFieldSacrifice(state, opts.keep);
    if (slot >= 0) return { type: 'sacrificeField', slot };
  }
  return null;
}

// 場のモンスターを生贄にするスロットを返す（しないなら -1）
function cpuPickFieldSacrifice(state, keep = CONFIG.CPU_KEEP_MONSTERS) {
  const p = state.players[state.current];
  const foe = state.players[1 - state.current];
  const mine = [0, 1, 2].filter(s => p.slots[s] && !p.slots[s].isToken); // 召喚モンスターは生贄にできない
  // 場が1体のときは生贄にしない
  if (mine.length < 2) return -1;
  // 膠着の解消：場の誰も攻撃できず、手札のモンスターでも直せないときは、
  // 邪魔になっているモンスターを生贄にして並びを詰め直す（例：前列の遠隔を外して、後ろの近接を前に出す）
  const line = p.slots.filter(m => m);
  if (lineupAttack(line) === 0 && !p.hand.some(h => h.card.kind === 'monster')) {
    const after = s => lineupAttack(line.filter((m, i) => i !== s));
    const best = mine.slice().sort((a, b) => after(b) - after(a))[0];
    if (after(best) > 0) return best;
  }
  // それ以外は、残りモンスターが少ないときは生贄にしない
  if (monstersLeft(p) <= keep) return -1;
  // 消耗ダメージが始まったら、残りモンスター数で相手に勝っているときだけ
  if (attritionDamage(state.turn, state) > 0 && monstersLeft(p) <= monstersLeft(foe)) return -1;
  const canAttack = s => canAttackFrom(p.slots[s], s);
  const threat = Math.max(0, ...foe.slots.filter(m => m).map(m => Math.max(...getAttacks(m).map(a => a.atk))));
  // 攻撃できない位置にいて、次の一撃でほぼ倒される
  const doomed = mine.find(s => !canAttack(s) && p.slots[s].armor === 0 && p.slots[s].hp <= threat);
  // 倒されればクリスタルをもらえるので、生贄のクリスタルで今すぐ手札のモンスターを出せるときだけ生贄にする
  // （そうでなければ、倒されるのを待つ：相手の攻撃を1回受け止めたうえでクリスタルが入る）
  const gain = CONFIG.SACRIFICE_MONSTER * ((p.rules && p.rules.sacrificeMult) || 1);
  const unlocks = p.hand.some(h => h.card.kind === 'monster' && costOf(p, h) > p.crystals && costOf(p, h) <= p.crystals + gain);
  if (doomed !== undefined && (!CONFIG.FALLEN_CRYSTAL || unlocks)) return doomed;
  // +2クリスタルで、手札の強いモンスターを出せるようになる（生贄にするのは一番安いモンスター）
  const victim = mine.slice().sort((a, b) =>
    (canAttack(a) - canAttack(b)) || p.slots[a].card.cost - p.slots[b].card.cost)[0];
  const strong = p.hand.some(h => h.card.kind === 'monster'
    && costOf(p, h) > p.crystals && costOf(p, h) <= p.crystals + CONFIG.SACRIFICE_MONSTER
    && h.card.cost >= p.slots[victim].card.cost + 2);
  return strong ? victim : -1;
}

// オートバトル：自分の番を自動で進めるときの次の行動。考え方はCPUと同じで、
// 残りモンスターが少ないときにモンスターを生贄にしない点だけ慎重にしている
function autoNextAction(state) {
  return cpuNextAction(state, { keep: CONFIG.AUTO_KEEP_MONSTERS });
}

function applyAction(state, pi, action) {
  if (action.type === 'monster') return playMonster(state, pi, action.uid, action.slot);
  if (action.type === 'equip') return equipItem(state, pi, action.uid, action.slot);
  if (action.type === 'flash') return playFlash(state, pi, action.uid, action.slot);
  if (action.type === 'sacrifice') return sacrifice(state, pi, action.uid);
  if (action.type === 'sacrificeField') return sacrificeField(state, pi, action.slot);
  return false;
}

// そのカードをデッキに入れられる枚数（レジェンドは1枚、ほかは2枚）
function copyLimit(id) {
  const def = CARD_DEFS[id];
  return def && def.rarity === 'legend' ? CONFIG.DECK_COPIES_LEGEND : CONFIG.DECK_COPIES;
}

// CPU用のデッキをランダムに組む（選んだモンスターに装備できるアイテムを優先）
//   opts.rarities: 使ってよいレアリティ（省略時はすべて）
//   opts.level:    カードのレベル（各カードの最大レベルまで。省略時はLv1）
function randomDeck(rng = Math.random, opts = {}) {
  const allow = c => !opts.rarities || opts.rarities.includes(c.rarity);
  // opts.pairs: 同じカードを2枚入れる組の数（モンスター・アイテムそれぞれ）。省略時は0（すべて1枚ずつ）
  const withPairs = list => {
    // 2枚にできるカード（レジェンド以外）のうち先頭の n 種類を2枚ずつにし、そのぶん、並びの後ろのカードを抜く
    // （list はシャッフル済みなので、どのカードが2枚になり、どれが抜けるかはランダム。レアリティで偏らない）
    const dups = list.filter(c => copyLimit(c.id) > 1).slice(0, Math.min(opts.pairs || 0, Math.floor(list.length / 2)));
    if (!dups.length) return list;
    const rest = list.filter(c => !dups.includes(c)).slice(0, list.length - dups.length * 2);
    return [...dups, ...dups, ...rest];
  };
  const monsters = withPairs(shuffle(MONSTERS.filter(allow), rng).slice(0, CONFIG.DECK_MONSTERS));
  const colors = new Set(monsters.map(m => m.color));
  const usable = c => (!c.color || colors.has(c.color) ? 1 : 0);
  const items = shuffle(ITEMS.filter(allow), rng)
    .sort((a, b) => usable(b) - usable(a))
    .slice(0, CONFIG.DECK_ITEMS);
  const itemList = withPairs(items);
  const levels = {};
  if (opts.level > 1) [...monsters, ...items].forEach(c => { levels[c.id] = Math.min(opts.level, maxLevel(c.id)); });
  const deck = { monsters: monsters.map(c => c.id), items: itemList.map(c => c.id), levels };
  deck.options = randomOptions(deck, rng);
  return deck;
}

// デッキの中で選択スキルを選べるカードに、ランダムに1つずつ選ぶ（CPU用）
function randomOptions(deck, rng) {
  const options = {};
  for (const id of [...deck.monsters, ...deck.items]) {
    if (optionAvailable(id, (deck.levels || {})[id] || 1)) options[id] = Math.floor(rng() * CARD_DEFS[id].options.length);
  }
  return options;
}
