// ============================================================
// カードの共通定義
// カード本体のデータは cards-monsters.js / cards-items.js にある。
// ============================================================

// 色（5色）と、それぞれの個性
const COLORS = {
  red:    { name: '赤', theme: '近接・Inspire' },
  blue:   { name: '青', theme: '魔法・Silence' },
  green:  { name: '緑', theme: 'Heal・Entangle' },
  yellow: { name: '黄', theme: '遠隔・Shoot Command' },
  purple: { name: '紫', theme: 'カオス・Disease' },
};

// 攻撃タイプ
const ATTACK_TYPES = {
  melee:  { name: '近接',   icon: '⚔️' },
  ranged: { name: '遠隔',   icon: '🏹' },
  magic:  { name: '魔法',   icon: '🔮' },
  chaos:  { name: 'カオス', icon: '🌀' },
};

// レアリティ（最大レベルはカードの levels の行数で決まる）
const RARITIES = {
  common: { name: 'コモン',     icon: '◆' },
  rare:   { name: 'レア',       icon: '◆' },
  epic:   { name: 'エピック',   icon: '◆' },
  legend: { name: 'レジェンド', icon: '★' },
};

// 定義に種別を付けて、id で引けるようにする
const CARD_DEFS = {};
MONSTER_DEFS.forEach(d => { d.kind = 'monster'; });
EQUIP_DEFS.forEach(d => { d.kind = 'equip'; });
FLASH_DEFS.forEach(d => { d.kind = 'flash'; });
[...MONSTER_DEFS, ...EQUIP_DEFS, ...FLASH_DEFS].forEach(d => { CARD_DEFS[d.id] = d; });

function maxLevel(id) { return CARD_DEFS[id].levels.length; }

// 指定レベルのカード。定義の共通部分に、そのレベルの行（hp・atk・skills など）を重ねたもの。
// ゲーム中はこの形のカードを使う（card.hp / card.atk / card.skills / card.level …）
//   option: 選択スキルの番号（def.options の何番目か）。カードレベルが optionLevel 以上のときだけ有効で、
//           選んだスキルは skills の最後に { …, opt: true } として加わる
const cardCache = {};
function cardAt(id, level = 1, option = null) {
  const def = CARD_DEFS[id];
  const lv = Math.max(1, Math.min(level, def.levels.length));
  const opt = optionAvailable(id, lv) && option != null && def.options[option] ? option : null;
  const key = id + '@' + lv + (opt === null ? '' : '#' + opt);
  if (!cardCache[key]) {
    const { levels, ...base } = def;
    const card = { skills: [], ...base, ...levels[lv - 1], level: lv, maxLevel: levels.length, option: opt };
    if (opt !== null) card.skills = [...card.skills, { ...def.options[opt], opt: true }];
    cardCache[key] = card;
  }
  return cardCache[key];
}

// そのレベルで選択スキルを選べるか
function optionAvailable(id, level) {
  const def = CARD_DEFS[id];
  return !!(def && def.options && level >= (def.optionLevel || 3));
}

// Lv1 のカード一覧（デッキ編集の一覧などで使う）
// MONSTERS は Elite（イベント限定）を除いた一覧。CPUのデッキなどの抽選にはこれを使う
const MONSTERS = MONSTER_DEFS.filter(d => !d.elite).map(d => cardAt(d.id));
const ELITES = MONSTER_DEFS.filter(d => d.elite).map(d => cardAt(d.id));
const EQUIPS = EQUIP_DEFS.map(d => cardAt(d.id));
const FLASHES = FLASH_DEFS.map(d => cardAt(d.id));
const ITEMS = [...EQUIPS, ...FLASHES]; // アイテムデッキに入れられるカード
const CARD_BY_ID = {};
[...MONSTERS, ...ELITES, ...ITEMS].forEach(c => { CARD_BY_ID[c.id] = c; });

// 召喚モンスター（スキルで場に呼び出される。デッキには入らず、コレクションにも出ない）
//   倒されてもクリスタルは入らず、勝敗の「残りモンスター」にも数えない。生贄にはできない。
//   x: 呼び出したスキルの数値（どの数値に使うかは、種類ごとに決まっている）
//   noAttack: 攻撃できない　burden: 倒されたとき、持ち主がクリスタルを失う
const TOKEN_DEFS = {
  tk1: { name: '小さなゴーレム', icon: '🗿', make: x => ({ atk: 1, hp: x }) },
  tk2: { name: '突撃ゴーレム', icon: '🪨', make: x => ({ atk: x, hp: 1, skills: [{ id: 'reach' }, { id: 'antiair', x: 1 }] }) }, // 後ろの空きに現れ、Reach で後列から殴る
  tk3: { name: '身代わりゴーレム', icon: '🧱', make: x => ({ atk: 1, hp: x }) },
  tk4: { name: '重荷ゴーレム', icon: '⚓', make: x => ({ atk: 0, hp: x, noAttack: true, burden: 1 }) },
};
const tokenCache = {};
function tokenCard(id, x = 1) {
  const key = id + '@' + x;
  if (!tokenCache[key]) {
    const def = TOKEN_DEFS[id];
    tokenCache[key] = { id, name: def.name, icon: def.icon, kind: 'monster', token: true, type: 'melee', cost: 0, color: null, rarity: 'common', level: 1, maxLevel: 1, option: null, skills: [], ...def.make(x) };
  }
  return tokenCache[key];
}
Object.keys(TOKEN_DEFS).forEach(id => { CARD_BY_ID[id] = tokenCard(id); }); // ログなどで名前を引けるように

// 特別カード（スキルで、試合中に山札へ足されるカード。デッキには入らず、コレクションにも出ない）
//   junk: じゃまカード。使えない。生贄にはできる（アイテムと同じ）
//   x: 足したスキルの数値（ダメージや回復量になる）
const SPECIAL_DEFS = {
  sp1: { name: 'がらくた', icon: '🗑️', make: () => ({ junk: true, cost: 0, skills: [] }) },
  sp2: { name: '凶札', icon: '🀫', make: () => ({ junk: true, cost: 0, skills: [] }) },
  sp3: { name: '火の玉', icon: '☄️', make: x => ({ cost: 1, skills: [{ id: 'smite', x }] }) },
  sp4: { name: '薬びん', icon: '🧴', make: x => ({ cost: 0, skills: [{ id: 'heal', x }] }) },
  sp5: { name: '吉札', icon: '🎴', make: x => ({ cost: 0, skills: [{ id: 'reinforcement', x }] }) },
};
const specialCache = {};
function specialCard(id, x = 1) {
  const key = id + '@' + x;
  if (!specialCache[key]) {
    const def = SPECIAL_DEFS[id];
    specialCache[key] = { id, name: def.name, icon: def.icon, kind: 'flash', special: true, color: null, rarity: 'common', level: 1, maxLevel: 1, option: null, ...def.make(x) };
  }
  return specialCache[key];
}
Object.keys(SPECIAL_DEFS).forEach(id => { CARD_BY_ID[id] = specialCard(id, 3); });

// スターターデッキ（コモン中心。モンスター8 + アイテム8）
//   levels: { カードid: レベル } を付けると、そのレベルのカードで戦う（省略したカードはLv1）
const DEFAULT_DECK = {
  monsters: ['r01', 'r02', 'r03', 'b02', 'b03', 'g02', 'y02', 'p02'],
  items:    ['e01', 'e02', 'e03', 'e04', 'e05', 'f01', 'f03', 'f04'],
};
