// ============================================================
// ダンジョン（ローグライクモード）のしくみ（画面には触らない）
//   手持ちのコレクションとは関係なく、ダンジョンの中だけのデッキで全3章を進む。
//   挑戦中のデータは profile.dungeon.run に入れ、1歩ごとにセーブする（途中で閉じても続きから再開できる）。
//   乱数は run.seed から作る（同じ挑戦を読み込み直しても、同じマップ・同じ候補になる）。
//   対戦のルールは通常と同じ。お守りの効果は engine.js の charm() で働く。
// ============================================================

const DUNGEON = {
  CHAPTERS: 3,
  ROWS: 9,                 // 1章のマスの数（8マス進んで、9マス目がボス）
  LIVES: 3,                // 命
  START_MONSTERS: 4, START_ITEMS: 4,
  COINS: { battle: 25, elite: 45, boss: 70 },
  PRICE: { common: 30, rare: 55, epic: 90, legend: 140, charm: 110 },
  // 挑戦が終わったときに持ち帰れる報酬（進んだマス1つごと＋クリアのボーナス。試練1つにつき+10%）
  REWARD: { goldPerFloor: 10, stonesPerFloor: 1, clearGold: 200, clearStones: 25, trialBonus: 0.1 },
  // マスの種類の出やすさ（最初の行は戦闘、最後の行はボス）
  WEIGHTS: { battle: 46, elite: 12, smith: 10, shrine: 10, shop: 10, mystery: 12 },
  MAX_TRIAL: 10,
};

const DUNGEON_NODES = {
  battle: { name: '戦闘', icon: '⚔️', desc: '勝つと、3枚の中から1枚選んでデッキに加えられる' },
  elite: { name: '強敵', icon: '💀', desc: '強い相手。勝つと、レア以上が確定の3枚から選べて、お守りも1つ手に入る' },
  smith: { name: '鍛冶屋', icon: '⚒️', desc: 'デッキのカード1枚をレベルアップ（ダンジョンの中だけ）' },
  shrine: { name: '祠', icon: '⛩️', desc: 'デッキからカードを1枚取り除く、または命を1つ回復' },
  shop: { name: '商人', icon: '🛒', desc: 'コインで、カードやお守りを買える' },
  mystery: { name: '謎のマス', icon: '❓', desc: '何が起きるかは、入ってみてのお楽しみ' },
  boss: { name: 'ボス', icon: '👑', desc: '章の最後。勝つと、お守りを1つ選べる' },
};

// 章ごとのテーマ。size: 章の前半の敵のデッキの枚数 [モンスター, アイテム]（5マス目からは1枚ずつ増え、強敵はさらに1枚多い）、strong: コモン以外のカードの枚数
const DUNGEON_CHAPTERS = [
  {
    name: '獣の洞窟', icon: '🕳️', colors: ['red', 'green'], size: [3, 3], level: 1, rarity: 'rare', strong: 0,
    odds: { common: 72, rare: 24, epic: 4, legend: 0 },
    boss: {
      name: '洞窟の主グロム', skill: 'boss_charge', stage: '1-10', terrain: 'hill', level: 1, bonus: 0,
      feature: '赤の近接特化。前列の近接攻撃が強い。',
      deck: { monsters: ['r01', 'r02', 'r03', 'r03', 'r04'], items: ['e01', 'e11', 'e04', 'f01', 'f04'] },
    },
  },
  {
    name: '霧の回廊', icon: '🌫️', colors: ['blue', 'yellow'], size: [4, 4], level: 1, rarity: 'epic', strong: 2,
    odds: { common: 50, rare: 34, epic: 13, legend: 3 },
    boss: {
      name: '回廊の番人ミラ', skill: 'boss_fog', stage: '2-10', terrain: 'deepmist', level: 2, bonus: 0,
      feature: '青の魔法封じ。Silence で魔法と回復を止め、ときどき Fog で攻撃を消してくる。',
      deck: { monsters: ['b01', 'b02', 'b03', 'b04', 'b04', 'b05', 'b06'], items: ['e13', 'e14', 'e03', 'e06', 'e05', 'f14', 'f07'] },
    },
  },
  {
    name: '奈落の玉座', icon: '🏯', colors: ['purple', 'red'], size: [5, 5], level: 2, rarity: 'legend', strong: 1, // カードを増やしたあと、クリア率が約40%になるように決め直した値
    odds: { common: 34, rare: 36, epic: 22, legend: 8 },
    boss: {
      name: '奈落の王ザガン', skill: 'boss_plague', stage: '5-10', terrain: 'throne', level: 3, bonus: -1, // Disease が毎ターンのダメージになって強くなったぶん、最初のクリスタルを減らしている
      feature: '紫の Disease 特化。毎ターン、こちらの全員に Disease を広げてくる。',
      deck: { monsters: ['p02', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08'], items: ['e19', 'e20', 'e10', 'e06', 'f05', 'f12', 'f09', 'f13'] },
    },
  },
];

// お守り：挑戦中ずっと効く。battle: 対戦中に engine.js が見るもの / それ以外はダンジョンの進行に効く
const DUNGEON_CHARMS = [
  { id: 'gem', name: '導きの水晶', icon: '🔹', battle: true, desc: '対戦開始時のクリスタル+1' },
  { id: 'hand', name: '旅人の地図', icon: '🗺️', battle: true, desc: '対戦開始時の手札+1枚' },
  { id: 'first_hp', name: '先駆けの腕輪', icon: '📿', battle: true, desc: 'その対戦で最初に出したモンスターのHP+2' },
  { id: 'first_armor', name: '先駆けの盾', icon: '🛡️', battle: true, desc: 'その対戦で最初に出したモンスターのアーマー+2' },
  { id: 'sac_plus', name: '供物の皿', icon: '🍽️', battle: true, desc: '生贄でもらえるクリスタルが、さらに+1' },
  { id: 'tri_color', name: '三色の誓い', icon: '🎗️', battle: true, desc: '自分の場の3体がすべて同じ色のとき、全員の攻撃+1' },
  { id: 'fallen_plus', name: '弔いの鈴', icon: '🔔', battle: true, desc: '自分のモンスターが倒されたときのクリスタル+1が、もう1つ増える' },
  { id: 'front_melee', name: '闘士の帯', icon: '🥋', battle: true, desc: '前列（スロット1）にいる味方の近接攻撃+1' },
  { id: 'back_ranged', name: '鷹の羽飾り', icon: '🪶', battle: true, desc: '後列（スロット2・3）にいる味方の遠隔攻撃+1' },
  { id: 'chaos_min', name: '歪んだサイコロ', icon: '🎲', battle: true, desc: '味方のカオス攻撃のダメージが、最低でも2になる' },
  { id: 'guard', name: '魔除けの札', icon: '🧿', battle: true, desc: '味方が受ける魔法ダメージ-1' },
  { id: 'tough', name: '岩の心臓', icon: '🪨', battle: true, desc: '前列（スロット1）にいる味方が受ける物理ダメージ-1' },
  { id: 'regen', name: '若葉のしずく', icon: '🌱', battle: true, desc: '自分のターン開始時、最もHPの低い味方を1回復する' },
  { id: 'late_income', name: '砂時計', icon: '⌛', battle: true, desc: 'ターン9以降、自分のターン開始時にもらえるクリスタル+1' },
  { id: 'attrition', name: '長旅の外套', icon: '🧥', battle: true, desc: '自分のモンスターが受ける消耗ダメージ-1' },
  { id: 'bounty', name: '狩人の証', icon: '🏹', battle: true, desc: '味方が攻撃で敵を倒すと、クリスタル+1' },
  { id: 'coin_plus', name: '金の招き猫', icon: '🐱', desc: '戦闘に勝ったときのコインが1.5倍' },
  { id: 'discount', name: '商人の割符', icon: '🏷️', desc: '商人の値段が25%引き' },
  { id: 'scout', name: '遠見の筒', icon: '🔭', desc: '戦闘のあとに選べるカードの候補が4枚になる' },
  { id: 'smith', name: '名工の槌', icon: '🔨', desc: '鍛冶屋で、カードを2枚レベルアップできる' },
  { id: 'lucky', name: '四つ葉', icon: '🍀', desc: '戦闘のあとに選べるカードのうち、1枚はレア以上になる' },
  { id: 'heart', name: '命の実', icon: '🍎', desc: '手に入れたとき、命の上限と命が1つ増える' },
];
const CHARM_BY_ID = {};
DUNGEON_CHARMS.forEach(c => { CHARM_BY_ID[c.id] = c; });

// 試練（難易度）。試練nでは、1〜nまでのすべてが重なる
// from: その補正がかかり始める章（1〜3。省略すると1章から）。こちらは全カードLv1で始まるので、きつい補正は後の章からにしている
const DUNGEON_TRIALS = [
  { desc: '敵の最初のクリスタル+1', mod: { foeBonus: 1 } },
  { desc: '強敵のマスが増える', mod: { elite: 10 } },
  { desc: '3章では、敵のデッキが1枚ずつ増える', mod: { foeSize: 1 }, from: 3 },
  { desc: '命が2つで始まる', mod: { lives: -1 } },
  { desc: '戦闘でもらえるコインが25%減る', mod: { coin: -0.25 } },
  { desc: '3章のボスのカードのレベル+1', mod: { bossLevel: 1 }, from: 3 },
  { desc: '2章から、敵の最初のクリスタルがさらに+1', mod: { foeBonus: 1 }, from: 2 },
  { desc: '祠で命を回復できない', mod: { noHeal: 1 } },
  { desc: '強敵のカードのレベル+1', mod: { eliteLevel: 1 } },
  { desc: '3章では、敵が毎ターンもらえるクリスタル+1', mod: { foeIncome: 1 }, from: 3 },
];

// その試練でかかる補正の合計。chapter（0〜2）を渡すと、その章でかかるぶんだけ。省略すると、最後の章までのすべて
function trialMods(trial, chapter = DUNGEON.CHAPTERS - 1) {
  const m = { foeBonus: 0, elite: 0, foeLevel: 0, foeSize: 0, eliteLevel: 0, lives: 0, coin: 0, bossLevel: 0, noHeal: 0, foeIncome: 0 };
  DUNGEON_TRIALS.slice(0, trial).forEach(t => { if ((t.from || 1) <= chapter + 1) for (const k in t.mod) m[k] += t.mod[k]; });
  return m;
}

// ---------- セーブデータ ----------

function newDungeonData() {
  return { run: null, best: { floor: 0, trial: 0, cleared: false }, clears: 0, maxTrial: 0, lastClear: null };
}

// 読み込んだデータを点検する（古いセーブにはないので初期値を補う。壊れた挑戦は捨てる）
function sanitizeDungeonData(d) {
  const out = newDungeonData();
  if (!d || typeof d !== 'object') return out;
  const int = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : lo);
  out.clears = int(d.clears, 0, 1e6);
  out.maxTrial = int(d.maxTrial, 0, DUNGEON.MAX_TRIAL);
  if (d.best && typeof d.best === 'object') out.best = { floor: int(d.best.floor, 0, DUNGEON.CHAPTERS * DUNGEON.ROWS), trial: int(d.best.trial, 0, DUNGEON.MAX_TRIAL), cleared: !!d.best.cleared };
  const okDeck = k => k && Array.isArray(k.monsters) && Array.isArray(k.items) && [...k.monsters, ...k.items].every(id => CARD_DEFS[id]);
  if (d.lastClear && okDeck(d.lastClear.deck) && HERO_BY_ID[d.lastClear.hero]) out.lastClear = d.lastClear;
  const r = d.run;
  if (r && typeof r === 'object' && okDeck(r.deck) && HERO_BY_ID[r.hero] && r.map && Array.isArray(r.map.nodes) && r.map.nodes.length
      && Array.isArray(r.charms) && r.charms.every(id => CHARM_BY_ID[id]) && Number.isFinite(r.seed) && r.lives > 0 && !r.over) {
    out.run = r;
    // 選択スキル（古いセーブにはない）：デッキにないカード・候補にない番号は捨てる
    const has = id => [...r.deck.monsters, ...r.deck.items].includes(id) && CARD_DEFS[id].options;
    const opts = r.deck.options && typeof r.deck.options === 'object' ? r.deck.options : {};
    r.deck.options = {};
    for (const id in opts) if (has(id) && Number.isInteger(opts[id]) && CARD_DEFS[id].options[opts[id]]) r.deck.options[id] = opts[id];
    if (r.optAsk != null) r.optAsk = Array.isArray(r.optAsk) ? r.optAsk.filter(id => has(id) && r.deck.options[id] == null) : [];
  }
  return out;
}

// ---------- 乱数 ----------

// 挑戦の乱数。使うたびに run.seed が進む（セーブされるので、読み込み直しても同じ続きになる）
function runRng(run) {
  return () => { run.seed = (run.seed * 1664525 + 1013904223) >>> 0; return run.seed / 4294967296; };
}
const pickOne = (list, rng) => list[Math.floor(rng() * list.length)];
function pickWeighted(weights, rng) {
  const keys = Object.keys(weights).filter(k => weights[k] > 0);
  let x = rng() * keys.reduce((n, k) => n + weights[k], 0);
  for (const k of keys) { x -= weights[k]; if (x < 0) return k; }
  return keys[keys.length - 1];
}

// ---------- マップ ----------

// 1章ぶんのマップ。行0がスタート側、最後の行がボス。各マスは次の行の1〜2マスにつながる
//   nodes: [{ id, row, col, type, next: [id] }]（col は 0〜2）
function makeDungeonMap(run) {
  const rng = runRng(run);
  const weights = { ...DUNGEON.WEIGHTS };
  weights.elite += trialMods(run.trial).elite;
  const rows = [];
  const nodes = [];
  for (let row = 0; row < DUNGEON.ROWS; row++) {
    const boss = row === DUNGEON.ROWS - 1;
    const count = boss ? 1 : row === 0 ? 2 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2);
    const cols = boss ? [1] : count === 3 ? [0, 1, 2] : pickOne([[0, 1], [1, 2], [0, 2]], rng);
    rows.push(cols.map(col => {
      let type = boss ? 'boss' : row === 0 ? 'battle' : pickWeighted(weights, rng);
      if (type === 'elite' && row < 2) type = 'battle';                 // 強敵は3マス目から
      if (row === DUNGEON.ROWS - 2 && type !== 'shrine' && type !== 'smith') type = rng() < 0.5 ? 'shrine' : 'smith'; // ボスの前は、立て直せるマス
      const node = { id: nodes.length, row, col, type, next: [] };
      nodes.push(node);
      return node;
    }));
  }
  // つなぐ：となりの列（同じ列か、1つとなり）へ。どのマスにも、入る道と出る道が必ずある
  for (let row = 0; row < DUNGEON.ROWS - 1; row++) {
    const here = rows[row], there = rows[row + 1];
    for (const n of here) {
      const near = there.filter(t => Math.abs(t.col - n.col) <= 1);
      const options = near.length ? near : there;
      n.next.push(pickOne(options, rng).id);
      if (options.length > 1 && rng() < 0.5) { const other = pickOne(options.filter(t => !n.next.includes(t.id)), rng); if (other) n.next.push(other.id); }
    }
    for (const t of there) {
      if (here.some(n => n.next.includes(t.id))) continue;
      const from = here.slice().sort((a, b) => Math.abs(a.col - t.col) - Math.abs(b.col - t.col))[0];
      from.next.push(t.id);
    }
    here.forEach(n => n.next.sort((a, b) => a - b));
  }
  // 同じ行が同じ種類ばかりにならないように：戦闘が1つもない行（2〜6行目）には、戦闘を1つ入れる
  for (let row = 1; row < DUNGEON.ROWS - 2; row++) {
    if (!rows[row].some(n => n.type === 'battle' || n.type === 'elite')) rows[row][0].type = 'battle';
  }
  return { nodes };
}

// 今から進めるマスの id（スタート前は最初の行のすべて）
function dungeonChoices(run) {
  if (run.pending || run.over) return [];
  if (run.at == null) return run.map.nodes.filter(n => n.row === 0).map(n => n.id);
  return run.map.nodes[run.at].next.slice();
}

// ---------- デッキ ----------

const runCards = run => [...run.deck.monsters, ...run.deck.items];
const runKey = id => (CARD_DEFS[id].kind === 'monster' ? 'monsters' : 'items');
const runMax = id => (CARD_DEFS[id].kind === 'monster' ? CONFIG.DECK_MONSTERS : CONFIG.DECK_ITEMS);
const runLevel = (run, id) => run.deck.levels[id] || 1;
// そのカードを、まだデッキに入れられるか（同じカードは2枚まで・レジェンドは1枚まで）
const runCanHold = (run, id) => run.deck[runKey(id)].filter(x => x === id).length < copyLimit(id);
// そのカードの枠（モンスター8・アイテム8）がいっぱいか
const runFull = (run, id) => run.deck[runKey(id)].length >= runMax(id);

// ---------- 選択スキル（ダンジョンの中だけ） ----------
//   ダンジョンのカードはLv1から始まるので、レベルの条件なしで最初から選べる。
//   選んだものは run.deck.options（{ カードid: 番号 }）に入り、通常のコレクションの選択（profile.options）とは別。
//   カードを手に入れたとき、まだ選んでいなければ run.optAsk（選ぶのを待っているカードid の列）に積む。画面はその場で選ばせる。

const runHasOptions = id => !!(CARD_DEFS[id] && CARD_DEFS[id].options);
const runOption = (run, id) => { const o = (run.deck.options || {})[id]; return o == null ? null : o; };
// 選ぶのを待っているカード（なければ null）
const runOptionAsk = run => (run.optAsk && run.optAsk.length ? run.optAsk[0] : null);

// 選択スキルを選ぶ（いつでも無料で変えられる）。index に null を渡すと「なし」に戻す
function runSetOption(run, id, index) {
  if (!runCards(run).includes(id) || !runHasOptions(id)) return false;
  if (index !== null && !CARD_DEFS[id].options[index]) return false;
  run.deck.options = run.deck.options || {};
  if (index === null) delete run.deck.options[id];
  else run.deck.options[id] = index;
  runSkipOption(run, id);
  return true;
}
// 今は選ばない（あとでデッキ確認画面から選べる）
function runSkipOption(run, id) {
  if (run.optAsk) run.optAsk = run.optAsk.filter(x => x !== id);
}

// 手に入れたカードが選択スキルを持っていて、まだ選んでいなければ、選ぶのを待つ列に積む
function runAskOption(run, id) {
  if (!runHasOptions(id) || runOption(run, id) !== null) return;
  run.optAsk = run.optAsk || [];
  if (!run.optAsk.includes(id)) run.optAsk.push(id);
}

// デッキから最後の1枚がなくなったカードの、レベルアップと選択スキルを消す
function runForget(run, id) {
  if (runCards(run).includes(id)) return;
  delete run.deck.levels[id];
  if (run.deck.options) delete run.deck.options[id];
  runSkipOption(run, id);
}

// カードを加える。枠がいっぱいのときは replace（入れ替えるカードの位置）が必要。加えられたら true
function runAddCard(run, id, replace) {
  if (!CARD_DEFS[id] || CARD_DEFS[id].elite) return false;
  const list = run.deck[runKey(id)];
  if (runFull(run, id)) {
    if (!(replace >= 0 && replace < list.length)) return false;
    const old = list[replace];
    if (old !== id && !runCanHold(run, id)) return false;
    list.splice(replace, 1, id);
    runForget(run, old); // 外したカードのレベルアップと選択スキルは消える
    runAskOption(run, id);
    return true;
  }
  if (!runCanHold(run, id)) return false;
  list.push(id);
  runAskOption(run, id);
  return true;
}

// カードを1枚取り除く。モンスターは最後の1体を消せない
function runRemoveCard(run, key, index) {
  const list = run.deck[key];
  if (!list || !(index >= 0 && index < list.length)) return false;
  if (key === 'monsters' && list.length <= 1) return false;
  const [old] = list.splice(index, 1);
  runForget(run, old);
  return true;
}

// レベルアップできるカードの id（重複なし）
function runUpgradable(run) { return [...new Set(runCards(run))].filter(id => runLevel(run, id) < maxLevel(id)); }
function runUpgrade(run, id) {
  if (!runCards(run).includes(id) || runLevel(run, id) >= maxLevel(id)) return false;
  run.deck.levels[id] = runLevel(run, id) + 1;
  return true;
}

// 対戦に持っていくデッキ（ダンジョンの中のレベル。手持ちのコレクションのレベルは使わない）
function runDeckForBattle(run) {
  const hero = HERO_BY_ID[run.hero];
  const levels = {};
  runCards(run).forEach(id => { levels[id] = runLevel(run, id); });
  // 選択スキルはダンジョンの中で選んだもの（レベルの条件なし）。手持ちのコレクションの選択は使わない
  const options = {};
  runCards(run).forEach(id => { if (runOption(run, id) !== null) options[id] = runOption(run, id); });
  return { monsters: run.deck.monsters.slice(), items: run.deck.items.slice(), levels, options, freeOptions: true, hero: { id: hero.id, name: hero.name, skill: hero.skills[run.skill].id } };
}

const dungeonPool = () => [...MONSTERS, ...ITEMS].filter(c => !c.elite);

// 開始時のデッキ：ヒーローの色を中心に、コモンのモンスター4枚＋アイテム4枚
function startDeck(heroId, rng) {
  const color = HERO_BY_ID[heroId].color;
  const commons = MONSTERS.filter(c => c.rarity === 'common');
  const mine = shuffle(commons.filter(c => c.color === color), rng);
  const cheap = mine.filter(c => c.cost <= CONFIG.CRYSTALS_PER_TURN);
  const monsters = [cheap[0] || mine[0]];
  for (const c of mine) if (monsters.length < DUNGEON.START_MONSTERS - 1 && !monsters.includes(c)) monsters.push(c);
  monsters.push(shuffle(commons.filter(c => c.color !== color && c.cost <= CONFIG.CRYSTALS_PER_TURN), rng)[0]);
  const items = ITEMS.filter(c => c.rarity === 'common' && (!c.color || c.color === color));
  const equips = shuffle(items.filter(c => c.kind === 'equip'), rng), flashes = shuffle(items.filter(c => c.kind === 'flash'), rng);
  return { monsters: monsters.map(c => c.id), items: [equips[0], equips[1], flashes[0], flashes[1]].map(c => c.id), levels: {}, options: {} };
}

// 報酬や商人に並ぶカードの候補（n枚。重複なし）。minRarity: これ以上のレアリティだけ
function cardOffers(run, n, opts = {}) {
  const rng = runRng(run);
  const order = RARITY_ORDER;
  const odds = { ...DUNGEON_CHAPTERS[run.chapter].odds };
  const min = order.indexOf(opts.minRarity || 'common');
  order.forEach((r, i) => { if (i < min) odds[r] = 0; });
  if (!order.some(r => odds[r] > 0)) odds[order[Math.max(min, 1)]] = 1;
  const color = HERO_BY_ID[run.hero].color;
  const out = [];
  for (let i = 0; i < n; i++) {
    const wantMonster = rng() < 0.55;
    // 候補の1枚目（お守り「四つ葉」）は、レア以上にする
    const o = i === 0 && opts.lucky ? { ...odds, common: 0, rare: odds.rare || 1 } : odds;
    for (let tries = 0; tries < 20; tries++) {
      const rarity = pickWeighted(o, rng);
      const mineOnly = rng() < 0.5; // 半分は、ヒーローの色（アイテムは無色も）から
      const pool = dungeonPool().filter(c => c.rarity === rarity && (c.kind === 'monster') === wantMonster
        && (!mineOnly || c.color === color || (!c.color && c.kind !== 'monster'))
        && !out.includes(c.id) && runCanHold(run, c.id));
      if (pool.length) { out.push(pickOne(pool, rng).id); break; }
    }
  }
  return out;
}

// まだ持っていないお守りの候補（n個）
function charmOffers(run, n) {
  const rng = runRng(run);
  return shuffle(DUNGEON_CHARMS.filter(c => !run.charms.includes(c.id)), rng).slice(0, n).map(c => c.id);
}

function runGainCharm(run, id) {
  if (!CHARM_BY_ID[id] || run.charms.includes(id)) return false;
  run.charms.push(id);
  if (id === 'heart') { run.maxLives++; run.lives++; }
  return true;
}

// ---------- 敵 ----------

// そのマスの敵。{ name, deck, terrain, bonus, income }
function dungeonFoe(run, node) {
  const rng = runRng(run);
  const ch = DUNGEON_CHAPTERS[run.chapter];
  const mods = trialMods(run.trial, run.chapter);
  if (node.type === 'boss') {
    const b = ch.boss;
    const level = b.level + mods.foeLevel + mods.bossLevel;
    const levels = {};
    [...b.deck.monsters, ...b.deck.items].forEach(id => { levels[id] = Math.min(level, maxLevel(id)); });
    const deck = { monsters: b.deck.monsters.slice(), items: b.deck.items.slice(), levels };
    deck.options = randomOptions(deck, rng);
    deck.hero = { id: 'boss', name: b.name, skill: b.skill, boss: b.stage };
    return { name: b.name, deck, terrain: b.terrain, bonus: b.bonus + mods.foeBonus, income: mods.foeIncome, boss: true };
  }
  const elite = node.type === 'elite';
  const level = ch.level + mods.foeLevel + (elite ? 1 + mods.eliteLevel : 0);
  const maxR = RARITY_ORDER.indexOf(ch.rarity);
  const rank = c => RARITY_ORDER.indexOf(c.rarity);
  const strongN = ch.strong + (elite ? 2 : 0);
  const pick = (pool, fits, n) => {
    const ok = shuffle(pool.filter(c => rank(c) <= maxR), rng);
    const mine = ok.filter(fits), other = ok.filter(c => !fits(c));
    const strong = mine.filter(c => rank(c) > 0).sort((a, b) => rank(b) - rank(a)).slice(0, strongN);
    const rest = [...mine.filter(c => rank(c) === 0), ...other.filter(c => rank(c) === 0), ...mine.filter(c => rank(c) > 0 && !strong.includes(c))];
    return [...strong, ...rest].slice(0, n).map(c => c.id);
  };
  const grow = (node.row >= 4 ? 1 : 0) + (elite ? 1 : 0) + mods.foeSize;
  const size = [Math.min(CONFIG.DECK_MONSTERS, ch.size[0] + grow), Math.min(CONFIG.DECK_ITEMS, ch.size[1] + grow)];
  const monsters = pick(MONSTERS, c => ch.colors.includes(c.color), size[0]);
  const early = id => CARD_DEFS[id].cost <= CONFIG.CRYSTALS_PER_TURN;
  if (!monsters.some(early)) monsters[monsters.length - 1] = shuffle(MONSTERS.filter(c => c.rarity === 'common' && c.cost <= CONFIG.CRYSTALS_PER_TURN && ch.colors.includes(c.color) && !monsters.includes(c.id)), rng)[0].id;
  const items = pick(ITEMS, c => !c.color || ch.colors.includes(c.color), size[1]);
  const levels = {};
  [...monsters, ...items].forEach(id => { levels[id] = Math.min(level, maxLevel(id)); });
  const deck = { monsters, items, levels };
  deck.options = randomOptions(deck, rng);
  const hero = HEROES.find(h => h.color === ch.colors[0]);
  deck.hero = run.chapter === 0 && !elite ? null : { id: hero.id, name: hero.name, skill: hero.skills[Math.min(run.chapter, 2)].id };
  const names = elite ? ['歴戦の番兵', '飢えた大型獣', '呪われた騎士'] : ['洞窟の群れ', 'さまよう兵士', '迷宮の住人', '見張りの一団'];
  return { name: `${elite ? '強敵：' : ''}${pickOne(names, rng)}`, deck, terrain: randomTerrain(rng), bonus: (elite ? 1 : 0) + mods.foeBonus, income: mods.foeIncome, boss: false };
}

// ---------- 挑戦の進行 ----------

// 新しい挑戦を始める。始められなければ null（ヒーロー未解放・試練が未解放・挑戦中）
function startDungeon(profile, heroId, skill = 0, trial = 0, seed = Math.floor(Math.random() * 4294967296)) {
  const d = profile.dungeon;
  if (d.run || !heroSkillUnlocked(profile, heroId, skill) || !(trial >= 0 && trial <= d.maxTrial)) return null;
  const lives = Math.max(1, DUNGEON.LIVES + trialMods(trial).lives);
  const run = {
    v: 1, hero: heroId, skill, trial, seed: seed >>> 0, lives, maxLives: lives, coins: 0,
    chapter: 0, floor: 0, at: null, map: null, pending: null, deck: null, charms: [], over: null,
    stats: { wins: 0, losses: 0 },
  };
  run.deck = startDeck(heroId, runRng(run));
  run.map = makeDungeonMap(run);
  d.run = run;
  return run;
}

// 今いるマスの「何章の何マス目か」
function runPlace(run) {
  const row = run.pending ? run.map.nodes[run.pending.node].row : run.at == null ? -1 : run.map.nodes[run.at].row;
  return { chapter: run.chapter + 1, row: row + 1, rows: DUNGEON.ROWS };
}

// マスに入る。そのマスでやること（run.pending）を用意する
function enterNode(run, id) {
  if (!dungeonChoices(run).includes(id)) return false;
  const node = run.map.nodes[id];
  const p = { node: id, type: node.type, phase: node.type, steps: [], notes: [] };
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    p.phase = 'battle';
    p.foe = dungeonFoe(run, node);
  } else if (node.type === 'shop') {
    const cards = cardOffers(run, 3);
    p.stock = [...cards.map(c => ({ kind: 'card', id: c, sold: false })), ...charmOffers(run, 2).map(c => ({ kind: 'charm', id: c, sold: false }))];
  } else if (node.type === 'smith') {
    p.left = run.charms.includes('smith') ? 2 : 1;
  } else if (node.type === 'mystery') {
    const rng = runRng(run);
    const usable = DUNGEON_EVENTS.filter(e => !e.when || e.when(run));
    p.event = pickOne(usable, rng).id;
  }
  run.pending = p;
  return true;
}

// 商人の値段（お守り「商人の割符」で25%引き）
function shopPrice(run, item) {
  const base = item.kind === 'charm' ? DUNGEON.PRICE.charm : DUNGEON.PRICE[CARD_DEFS[item.id].rarity];
  return Math.round(base * (run.charms.includes('discount') ? 0.75 : 1));
}

// 戦闘でもらえるコイン
function battleCoins(run, type) {
  const mult = (run.charms.includes('coin_plus') ? 1.5 : 1) * (1 + trialMods(run.trial).coin);
  return Math.round(DUNGEON.COINS[type] * mult);
}

// 対戦の結果を反映する。
//   勝ち：コイン＋報酬の選択（steps）へ　負け：命が1つ減る。0になったら挑戦終了（run.over = 'dead'）
function dungeonBattleEnd(run, win) {
  const p = run.pending;
  if (!p || p.phase !== 'battle') return false;
  if (win) {
    run.stats.wins++;
    p.coins = battleCoins(run, p.type);
    run.coins += p.coins;
    const n = run.charms.includes('scout') ? 4 : 3;
    p.steps.push({ kind: 'card', offers: cardOffers(run, n, { minRarity: p.type === 'battle' ? 'common' : 'rare', lucky: run.charms.includes('lucky') }) });
    if (p.type === 'elite') { const [c] = charmOffers(run, 1); if (c) { runGainCharm(run, c); p.notes.push(['charm', c]); } }
    if (p.type === 'boss') { const offers = charmOffers(run, 3); if (offers.length) p.steps.push({ kind: 'charm', offers }); }
    p.phase = 'reward';
  } else {
    run.stats.losses++;
    run.lives--;
    if (run.lives <= 0) { run.over = 'dead'; p.phase = 'dead'; } else p.phase = 'lost';
  }
  return true;
}

// 負けたあと：同じ戦闘をやり直す（相手は同じ）
function dungeonRetry(run) {
  if (!run.pending || run.pending.phase !== 'lost') return false;
  run.pending.phase = 'battle';
  return true;
}
// 負けたあと：戦わずに次へ進む（報酬なし）。ボスは飛ばせない
function dungeonSkip(run) {
  if (!run.pending || run.pending.phase !== 'lost' || run.pending.type === 'boss') return false;
  run.pending.steps = [];
  run.pending.phase = 'skipped';
  return leaveNode(run);
}

// 報酬の選択を1つ進める。choice: 取るカード／お守りの id（null なら取らない）。replace: 枠がいっぱいのとき入れ替える位置
function dungeonChoose(run, choice, replace) {
  const p = run.pending;
  const step = p && p.steps[0];
  if (!step) return false;
  if (choice != null) {
    if (!step.offers.includes(choice)) return false;
    if (step.kind === 'card' && !runAddCard(run, choice, replace)) return false;
    if (step.kind === 'charm' && !runGainCharm(run, choice)) return false;
  }
  p.steps.shift();
  return true;
}

// マスを出る（そのマスを通過したことにする）。ボスなら次の章へ。最後のボスならクリア
function leaveNode(run) {
  const p = run.pending;
  if (!p || p.steps.length || p.phase === 'battle' || p.phase === 'lost' || p.phase === 'dead') return false;
  const boss = p.type === 'boss';
  run.at = p.node;
  run.path = [...(run.path || []), p.node]; // 通ってきたマス（マップの表示用）
  run.pending = null;
  run.floor++;
  if (boss) {
    if (run.chapter >= DUNGEON.CHAPTERS - 1) { run.over = 'clear'; return true; }
    run.chapter++;
    run.at = null;
    run.path = [];
    run.map = makeDungeonMap(run);
  }
  return true;
}

// 鍛冶屋：1枚レベルアップ
function smithUpgrade(run, id) {
  const p = run.pending;
  if (!p || p.type !== 'smith' || p.left <= 0 || !runUpgrade(run, id)) return false;
  p.left--;
  return true;
}

// 祠：カードを1枚取り除く、または命を1つ回復（どちらか1回）
function shrineRemove(run, key, index) {
  const p = run.pending;
  if (!p || p.type !== 'shrine' || p.used || !runRemoveCard(run, key, index)) return false;
  p.used = true;
  return true;
}
function shrineCanHeal(run) { return run.lives < run.maxLives && !trialMods(run.trial).noHeal; }
function shrineHeal(run) {
  const p = run.pending;
  if (!p || p.type !== 'shrine' || p.used || !shrineCanHeal(run)) return false;
  run.lives++;
  p.used = true;
  return true;
}

// 商人：買う。カードは枠がいっぱいなら replace が必要
function shopBuy(run, index, replace) {
  const p = run.pending;
  const item = p && p.type === 'shop' ? p.stock[index] : null;
  if (!item || item.sold) return false;
  const price = shopPrice(run, item);
  if (run.coins < price) return false;
  if (item.kind === 'card' ? !runAddCard(run, item.id, replace) : !runGainCharm(run, item.id)) return false;
  run.coins -= price;
  item.sold = true;
  return true;
}

// ---------- 謎のマスのできごと ----------
// options: [{ text, can(run), run(run, rng) → 結果の文 }]。選ぶと1回だけ実行され、あとはマスを出るだけになる

const upgradeRandom = (run, rng, n) => shuffle(runUpgradable(run), rng).slice(0, n).filter(id => runUpgrade(run, id)).map(id => CARD_DEFS[id].name);
const DUNGEON_EVENTS = [
  {
    id: 'pact', name: '血の契約', icon: '🩸', text: '古い祭壇に、赤く光る契約書が置かれている。',
    when: run => run.lives > 1,
    options: [
      { text: '命を1つ差し出す（レジェンドのカードを1枚得る）', run: (run) => { run.lives--; const [id] = cardOffers(run, 1, { minRarity: 'legend' }); if (id) run.pending.steps.push({ kind: 'card', offers: [id] }); return '命を1つ失った。祭壇の上に、1枚のカードが現れた。'; } },
      { text: '立ち去る', run: () => '何も起きなかった。' },
    ],
  },
  {
    id: 'spring', name: '澄んだ泉', icon: '⛲', text: '静かな泉がわいている。底には、だれかが投げたコインが光っている。',
    options: [
      { text: '水を飲む（命を1つ回復）', can: run => run.lives < run.maxLives, run: (run) => { run.lives++; return '体が軽くなった。命が1つ回復した。'; } },
      { text: 'コインを拾う（コイン+40）', run: (run) => { run.coins += 40; return 'コインを40枚拾った。'; } },
    ],
  },
  {
    id: 'training', name: '古い訓練場', icon: '🎯', text: '使われなくなった訓練場に、まだ道具が残っている。',
    options: [
      { text: '鍛える（ランダムなカード2枚をレベルアップ）', can: run => runUpgradable(run).length > 0, run: (run, rng) => { const up = upgradeRandom(run, rng, 2); return up.length ? `${up.join('・')}がレベルアップした。` : '鍛えられるカードがなかった。'; } },
      { text: '道具を売る（コイン+30）', run: (run) => { run.coins += 30; return '道具を売って、コインを30枚得た。'; } },
    ],
  },
  {
    id: 'gamble', name: '怪しい賭け', icon: '🎰', text: 'フードの男が、にやりと笑って箱を差し出す。「当たればお守り、外れれば…」',
    when: run => run.lives > 1,
    options: [
      { text: '箱を開ける（半分の確率でお守り、半分の確率で命を1つ失う）', run: (run, rng) => { if (rng() < 0.5) { const [c] = charmOffers(run, 1); if (c) { runGainCharm(run, c); return `当たり！「${CHARM_BY_ID[c].name}」を手に入れた。`; } run.coins += 60; return '当たり！コインを60枚手に入れた。'; } run.lives--; return '外れ…。箱から飛び出した罠で、命を1つ失った。'; } },
      { text: '断る', run: () => '男は肩をすくめて、闇に消えた。' },
    ],
  },
  {
    id: 'chest', name: '置き去りの宝箱', icon: '🧰', text: 'ほこりをかぶった宝箱がある。',
    options: [
      { text: '開ける（レア以上のカードを1枚選べる）', run: (run) => { run.pending.steps.push({ kind: 'card', offers: cardOffers(run, 2, { minRarity: 'rare' }) }); return '中には、カードが入っていた。'; } },
      { text: '売り払う（コイン+50）', run: (run) => { run.coins += 50; return '宝箱ごと売って、コインを50枚得た。'; } },
    ],
  },
  {
    id: 'mirror', name: '写しの鏡', icon: '🪞', text: '鏡に、自分のデッキのカードが映っている。',
    options: [
      { text: '鏡に触れる（デッキのランダムなコモン1枚が、レア以上のカードに変わる）', can: run => runCards(run).some(id => CARD_DEFS[id].rarity === 'common'), run: (run, rng) => {
        const commons = runCards(run).filter(id => CARD_DEFS[id].rarity === 'common');
        const old = pickOne(commons, rng);
        const monster = CARD_DEFS[old].kind === 'monster';
        const pool = dungeonPool().filter(c => c.rarity !== 'common' && c.rarity !== 'legend' && (c.kind === 'monster') === monster && runCanHold(run, c.id));
        const fresh = pickOne(pool, rng);
        const list = run.deck[runKey(old)];
        list.splice(list.indexOf(old), 1, fresh.id);
        runForget(run, old);
        runAskOption(run, fresh.id);
        return `${CARD_DEFS[old].name}が、${fresh.name}に変わった。`;
      } },
      { text: '立ち去る', run: () => '鏡は静かに曇っていった。' },
    ],
  },
  {
    id: 'peddler', name: '道に迷った行商人', icon: '🎒', text: '道を教えると、行商人はお礼をしたいと言う。',
    options: [
      { text: 'コインをもらう（コイン+35）', run: (run) => { run.coins += 35; return 'コインを35枚もらった。'; } },
      { text: '品物をもらう（ランダムなカードを1枚選べる）', run: (run) => { run.pending.steps.push({ kind: 'card', offers: cardOffers(run, 3) }); return '行商人が、かばんからカードを取り出した。'; } },
    ],
  },
];
const DUNGEON_EVENT_BY_ID = {};
DUNGEON_EVENTS.forEach(e => { DUNGEON_EVENT_BY_ID[e.id] = e; });

// 謎のマスの選択肢を選ぶ
function mysteryChoose(run, index) {
  const p = run.pending;
  if (!p || p.type !== 'mystery' || p.result != null) return false;
  const opt = DUNGEON_EVENT_BY_ID[p.event].options[index];
  if (!opt || (opt.can && !opt.can(run))) return false;
  p.result = opt.run(run, runRng(run));
  if (run.lives <= 0) { run.over = 'dead'; p.phase = 'dead'; }
  return true;
}

// 対戦中に効くお守りの id（engine.js の newGame に渡す）
function runBattleCharms(run) { return run.charms.filter(id => CHARM_BY_ID[id].battle); }

// ---------- 終わりと記録 ----------

// 持ち帰れる報酬（ゴールドと魔石だけ）
function dungeonReward(run) {
  const R = DUNGEON.REWARD;
  const clear = run.over === 'clear';
  const mult = 1 + R.trialBonus * run.trial;
  return {
    gold: Math.round((run.floor * R.goldPerFloor + (clear ? R.clearGold : 0)) * mult),
    stones: Math.round((run.floor * R.stonesPerFloor + (clear ? R.clearStones : 0)) * mult),
  };
}

// 挑戦を終える（クリア・命が0・あきらめる）。報酬を渡し、記録を更新して、挑戦中のデータを消す。まとめを返す
function endDungeon(profile, reason, now = new Date()) {
  const d = profile.dungeon;
  const run = d.run;
  if (!run) return null;
  if (!run.over) run.over = reason || 'quit';
  const clear = run.over === 'clear';
  const reward = dungeonReward(run);
  profile.gold += reward.gold;
  profile.stones += reward.stones;
  const better = run.floor > d.best.floor || (run.floor === d.best.floor && run.trial > d.best.trial);
  if (better) d.best = { floor: run.floor, trial: run.trial, cleared: clear };
  let unlocked = null;
  if (clear) {
    d.clears++;
    d.lastClear = { hero: run.hero, skill: run.skill, trial: run.trial, t: now.getTime(), charms: run.charms.slice(), deck: { monsters: run.deck.monsters.slice(), items: run.deck.items.slice(), levels: { ...run.deck.levels }, options: { ...(run.deck.options || {}) } } };
    if (run.trial >= d.maxTrial && d.maxTrial < DUNGEON.MAX_TRIAL) { d.maxTrial = run.trial + 1; unlocked = d.maxTrial; }
  }
  d.run = null;
  return { result: run.over, floor: run.floor, chapter: run.chapter + 1, trial: run.trial, reward, record: better, unlocked, wins: run.stats.wins, losses: run.stats.losses };
}
