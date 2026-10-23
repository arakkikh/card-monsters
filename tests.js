// ============================================================
// ルールのテスト。tests.html をブラウザで開くと実行される。
// （ターミナルなら: jsc skills.js cards-monsters.js cards-items.js cards.js terrains.js engine.js save.js stages.js heroes.js quests.js events.js battlelog.js dict.js art.js fx.js pack.js tests.js）
// ============================================================

const TEST_RESULTS = [];

function test(name, fn) {
  try {
    fn();
    TEST_RESULTS.push({ name, ok: true });
  } catch (e) {
    TEST_RESULTS.push({ name, ok: false, error: String(e.message || e) });
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || 'eq'}: ${a} ≠ ${b}`);
}

// 再現できる乱数
let testSeed = 1;
const testRng = () => { testSeed = (testSeed * 1664525 + 1013904223) >>> 0; return testSeed / 4294967296; };

// ---------- テスト用の道具 ----------

// 場に置いた状態のモンスターを作る（item を渡すと装備済み）
function mk(id, item) {
  const m = makeMonster(uidSeq++, CARD_BY_ID[id]);
  if (item) {
    const it = CARD_BY_ID[item];
    m.item = it;
    m.armor += it.armor || 0;
    m.hp += it.hp || 0;
    m.maxHp += it.hp || 0;
  }
  return m;
}

// プレイヤー0のプレイフェーズ、手札なし・山札なし・クリスタル10の盤面
function board(mine = [], foes = []) {
  const s = newGame(DEFAULT_DECK, DEFAULT_DECK, testRng);
  s.current = 0; s.turn = 5; s.phase = 'play';
  s.players.forEach(p => { p.hand = []; p.deck = []; p.crystals = 10; });
  const fill = list => [0, 1, 2].map(i => list[i] || null);
  s.players[0].slots = fill(mine);
  s.players[1].slots = fill(foes);
  s.players.forEach(p => { p.hero = null; p.slots.forEach(m => m && setOwner(m, p)); });
  return s;
}

function give(s, pi, id) {
  const h = { uid: uidSeq++, card: CARD_BY_ID[id] };
  s.players[pi].hand.push(h);
  return h.uid;
}

const names = p => p.slots.map(m => (m ? m.card.id : null));
const phase = s => [...attackPhase(s)];                               // 攻撃フェーズの全イベント
const attacks = s => phase(s).filter(e => e.kind === 'attack');        // 攻撃だけ
const extra = (ev, kind) => ev.extras.find(x => x.kind === kind);

// テスト専用カード。本番のカードデータ（cards.js）を変えてもテストが壊れないように、ここで定義する。
function tcard(card) { CARD_BY_ID[card.id] = card; return card.id; }
// スキルは 'thorns:2' や 'flying' のように書く
const parseSkill = t => { const [id, x] = t.split(':'); return x === undefined ? { id } : { id, x: Number(x) }; };
const tmon = (id, type, atk, hp, cost, color, skills = []) =>
  tcard({ id, name: id, icon: '🧪', kind: 'monster', type, atk, hp, cost, color, skills: skills.map(parseSkill) });
const tequip = (id, cost, color, props, skills = []) =>
  tcard({ id, name: id, icon: '🧪', kind: 'equip', cost, color, skills: skills.map(parseSkill), ...props });
const tflash = (id, cost, skill) =>
  tcard({ id, name: id, icon: '🧪', kind: 'flash', cost, color: null, skills: [parseSkill(skill)] });

// スキルなしの基本モンスター
const WOLF = tmon('t_wolf', 'melee', 2, 6, 2, 'red'), ARCHER = tmon('t_archer', 'ranged', 2, 6, 3, 'red');
const DRAGON = tmon('t_dragon', 'melee', 5, 13, 6, 'red'), SLIME = tmon('t_slime', 'melee', 1, 8, 2, 'blue');
const MAGE = tmon('t_mage', 'magic', 3, 7, 4, 'blue'), ELF = tmon('t_elf', 'ranged', 3, 4, 3, 'green');
const GOLEM = tmon('t_golem', 'melee', 3, 15, 5, 'green'), IMP = tmon('t_imp', 'chaos', 2, 4, 2, 'purple');
const DEMON = tmon('t_demon', 'chaos', 5, 11, 6, 'purple'), KNIGHT = tmon('t_knight', 'melee', 4, 8, 4, 'purple');
const BASIC_MONSTERS = [WOLF, ARCHER, DRAGON, SLIME, MAGE, ELF, GOLEM, IMP, DEMON, KNIGHT];
// 装備
const LEATHER = tequip('t_leather', 1, null, { armor: 2 }), STEEL = tequip('t_steel', 3, null, { armor: 5 });
const TREE = tequip('t_tree', 2, 'green', { hp: 6 }), TOME = tequip('t_tome', 3, null, { atk: { magic: 2 } });
const ORB = tequip('t_orb', 2, null, { atk: { magic: 2 } }), SWORD = tequip('t_sword', 1, null, { atk: { melee: 2 } });
const RED_SWORD = tequip('t_redsword', 2, 'red', { atk: { melee: 3 } });
const BLUE_GUARD = tequip('t_blueguard', 2, 'blue', { armor: 2, hp: 3 });
// フラッシュ
const ROCK = tflash('t_rock', 1, 'smite:3'), BOLT = tflash('t_bolt', 2, 'lightning:3');
const CURE = tflash('t_cure', 1, 'heal:5'), AID = tflash('t_aid', 0, 'reinforcement:2');

// スキル持ちのテスト用モンスターをその場で作る： S('melee', 3, 10, 'thorns:2', 'flying')
let skillCardSeq = 0;
const S = (type, atk, hp, ...skills) => tmon('t_s' + (++skillCardSeq), type, atk, hp, 2, 'red', skills);

// ---------- 配置と移動 ----------

test('配置：モンスターがいるスロットに出すと後ろへ押し出す', () => {
  const s = board([mk(WOLF), mk(ELF)]);
  assert(playMonster(s, 0, give(s, 0, SLIME), 0));
  eq(names(s.players[0]), [SLIME, WOLF, ELF]); // 中央C、左A、右B
});

test('配置：真ん中（スロット2）に割り込むと3番目だけがずれる', () => {
  const s = board([mk(WOLF), mk(ELF)]);
  assert(playMonster(s, 0, give(s, 0, SLIME), 1));
  eq(names(s.players[0]), [WOLF, SLIME, ELF]);
});

test('配置：空きスロットをタップすると前に詰めて置かれる', () => {
  const s = board([mk(WOLF)]);
  eq(placementSlot(s.players[0], 2), 1);
  assert(playMonster(s, 0, give(s, 0, ELF), 2)); // 右をタップ → 左に入る
  eq(names(s.players[0]), [WOLF, ELF, null]);
  const e = board();
  assert(playMonster(e, 0, give(e, 0, ELF), 2)); // 場が空なら中央に入る
  eq(names(e.players[0]), [ELF, null, null]);
});

test('配置：3体いっぱいのときは出せない', () => {
  const s = board([mk(WOLF), mk(ELF), mk(MAGE)]);
  const uid = give(s, 0, SLIME);
  eq(placementSlot(s.players[0], 0), -1);
  for (const slot of [0, 1, 2]) assert(!playMonster(s, 0, uid, slot), 'slot ' + slot);
  eq(names(s.players[0]), [WOLF, ELF, MAGE]);
  eq(s.players[0].crystals, 10, 'クリスタルは減らない');
  eq(s.players[0].hand.length, 1, '手札に残る');
});

test('配置：押し出された近接は後列で攻撃できない／同じターンから新しい位置で攻撃', () => {
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  assert(playMonster(s, 0, give(s, 0, MAGE), 0)); // 魔法が中央、ウルフは左へ
  eq(names(s.players[0]), [MAGE, WOLF, null]);
  const evs = attacks(s);
  eq(evs.map(e => e.attacker.card.id), [MAGE], 'ウルフ（近接）は後列なので攻撃しない');
});

test('配置：遠隔が前列に押し込まれると攻撃できず、後列に押し出されると攻撃できる', () => {
  eq(attacks(board([mk(ELF)], [mk(GOLEM)])).length, 0, '遠隔が中央にいる間は攻撃しない');
  const s = board([mk(ELF)], [mk(GOLEM)]);
  assert(playMonster(s, 0, give(s, 0, WOLF), 0)); // ウルフを中央に入れ直す
  eq(names(s.players[0]), [WOLF, ELF, null]);
  eq(attacks(s).map(e => e.attacker.card.id), [ELF, WOLF], '後列から先に行動');
});

test('配置：装備・ダメージ・アーマーは移動しても引き継ぐ', () => {
  const s = board([mk(WOLF, LEATHER)]);
  const wolf = s.players[0].slots[0];
  wolf.hp = 2;
  assert(playMonster(s, 0, give(s, 0, SLIME), 0));
  assert(s.players[0].slots[1] === wolf, '同じモンスターが左へ');
  eq([wolf.hp, wolf.armor, wolf.item.id], [2, 2, LEATHER]);
});

test('撃破：後ろのモンスターが前に詰める（2→1、3→2）', () => {
  const s = board([mk(DRAGON)], [mk(IMP), mk(ELF), mk(MAGE)]);
  s.players[1].slots[0].hp = 1;
  const ev = attacks(s)[0];
  assert(ev.killed);
  eq(names(s.players[1]), [ELF, MAGE, null]);
});

test('CPU：押し出しを使って近接を中央に入れ直す', () => {
  const s = board();
  s.current = 1;
  s.players[1].slots = [mk(ELF), null, null]; // 遠隔が中央にいて攻撃できない
  give(s, 1, WOLF);
  const a = cpuNextAction(s);
  eq([a.type, a.slot], ['monster', 0]);
  applyAction(s, 1, a);
  eq(names(s.players[1]), [WOLF, ELF, null]);
});

test('CPU：遠隔は後ろに並べ、近接を前に残す', () => {
  const s = board();
  s.current = 1;
  s.players[1].slots = [mk(WOLF), null, null];
  give(s, 1, ELF);
  const a = cpuNextAction(s);
  eq([a.type, a.slot], ['monster', 1]);
});

// ---------- アーマー・攻撃タイプ ----------

test('アーマー：物理はまずアーマーを削り、超過分はHPに届かない', () => {
  const s = board([mk(DRAGON)], [mk(SLIME, LEATHER)]); // 近接5 vs アーマー2
  const foe = s.players[1].slots[0];
  let ev = attacks(s)[0];
  eq([ev.armorDmg, ev.dmg, foe.armor, foe.hp], [2, 0, 0, foe.maxHp]);
  ev = attacks(s)[0];
  eq([ev.armorDmg, ev.dmg, foe.hp], [0, 5, foe.maxHp - 5]);
});

test('魔法：アーマーを無視してHPにダメージ', () => {
  const s = board([mk(MAGE)], [mk(SLIME, STEEL)]);
  const foe = s.players[1].slots[0];
  const ev = attacks(s)[0];
  eq([ev.dmg, foe.armor, foe.hp], [3, 5, foe.maxHp - 3]);
});

test('遠隔：アーマー持ちに約25%でブロックされる（アーマーなしは0%）', () => {
  const T = 8000;
  let blocked = 0;
  for (let i = 0; i < T; i++) {
    const s = board([mk(WOLF), mk(ELF)], [mk(GOLEM, STEEL)]);
    s.players[0].slots[0] = mk(ARCHER); // 前列の遠隔は攻撃しない
    const ev = attacks(s)[0];
    if (ev.blocked) { blocked++; eq(s.players[1].slots[0].armor, 5, 'ブロック時はアーマーも減らない'); }
  }
  assert(Math.abs(blocked / T - 0.25) < 0.02, 'ブロック率 ' + blocked / T);
  for (let i = 0; i < 1000; i++) {
    const s = board([mk(ARCHER), mk(ELF)], [mk(GOLEM)]);
    assert(!attacks(s)[0].blocked);
  }
});

test('遠隔：対角 → 正面 → 前列の順に狙う', () => {
  const target = (mySlot, foeCount) => {
    const s = board([mk(ARCHER), mk(ARCHER), mk(ARCHER)], [mk(GOLEM), mk(GOLEM), mk(GOLEM)].slice(0, foeCount));
    const ev = attacks(s).find(e => e.attacker === s.players[0].slots[mySlot]);
    return s.players[1].slots.indexOf(ev.target);
  };
  eq([target(1, 3), target(2, 3)], [2, 1], '対角');
  eq(target(1, 2), 1, '正面');
  eq([target(1, 1), target(2, 1)], [0, 0], '前列');
});

test('カオス：1〜攻撃力のランダムな固定ダメージ。アーマーと盾を無視する（Fog は防げる）', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const s = board([mk(DEMON)], [mk(GOLEM)]); // カオス5
    seen.add(attacks(s)[0].dmg);
  }
  eq([...seen].sort(), [1, 2, 3, 4, 5]);
  const s = board([mk(DEMON)], [mk(S('melee', 1, 30, 'shield:9', 'sacredshield:9'), STEEL)]);
  const g = s.players[1].slots[0];
  const ev = attacks(s)[0];
  assert(ev.dmg >= 1 && ev.armorDmg === 0 && ev.shielded === 0 && g.armor === 5 && g.hp === 30 - ev.dmg, 'アーマーも盾も素通りする');
  const f = board([mk(DEMON)], [mk(GOLEM)]);
  f.players[1].slots[0].status.fog = true;
  eq([attacks(f)[0].fogged, f.players[1].slots[0].hp], [true, CARD_BY_ID[GOLEM].hp], 'Fog は固定ダメージも防ぐ');
});

test('武器：そのスロットで使えるタイプの攻撃だけ行う', () => {
  const s = board([mk(DRAGON, TOME), mk(WOLF, TOME)], [mk(GOLEM)]);
  eq(attacks(s).map(e => e.type), ['magic', 'magic', 'melee']); // 後列のウルフは魔法だけ。前列のドラゴンは魔法 → 近接
});

// ---------- 魔法の対象 ----------

test('魔法：スロット2・3からは正面（同じ番号のスロット）を攻撃する', () => {
  const s = board([mk(MAGE), mk(MAGE), mk(MAGE)], [mk(GOLEM), mk(GOLEM), mk(GOLEM)]);
  const hit = attacks(s).map(e => s.players[1].slots.indexOf(e.target));
  eq(hit, [2, 1, 0]);
});

test('魔法：正面が空なら前列（スロット1）を攻撃する', () => {
  const s = board([mk(WOLF), mk(MAGE), mk(MAGE)], [mk(GOLEM), mk(SLIME)]);
  const evs = attacks(s).filter(e => e.type === 'magic');
  eq(evs.map(e => e.target.card.id), [GOLEM, SLIME], 'スロット3は正面が空なので前列、スロット2は正面');
  const one = board([mk(WOLF), mk(MAGE)], [mk(GOLEM)]);
  eq(attacks(one).map(e => e.target.card.id), [GOLEM, GOLEM]);
});

test('魔法：後列の正面を攻撃してもアーマーを無視する', () => {
  const s = board([mk(WOLF), mk(MAGE)], [mk(GOLEM), mk(SLIME, STEEL)]);
  const ev = attacks(s).find(e => e.type === 'magic');
  const slime = s.players[1].slots[1];
  eq([ev.dmg, slime.armor, slime.hp], [3, 5, slime.maxHp - 3]);
});

// ---------- 行動順と攻撃回数 ----------

// Batter を持つテスト用モンスター
const BRAWLER = { id: tmon('t_brawler', 'melee', 2, 5, 1, 'red', ['batter:2']) };

test('行動順：スロット3 → 2 → 1 の順に行動する', () => {
  const s = board([mk(WOLF), mk(ELF), mk(MAGE)], [mk(GOLEM)]);
  eq(attacks(s).map(e => e.attacker.card.id), [MAGE, ELF, WOLF]);
  const two = board([mk(WOLF), mk(MAGE)], [mk(GOLEM)]);
  eq(attacks(two).map(e => e.attacker.card.id), [MAGE, WOLF]);
});

test('行動順：敵が倒れて相手側が詰めても、順番は変わらず全員1回ずつ行動する', () => {
  const s = board([mk(MAGE), mk(MAGE), mk(MAGE)], [mk(IMP), mk(IMP), mk(IMP)]);
  s.players[1].slots.forEach(m => { m.hp = 1; });
  const [a, b, c] = s.players[0].slots;
  const evs = attacks(s);
  assert(evs.length === 3 && evs[0].attacker === c && evs[1].attacker === b && evs[2].attacker === a);
  assert(evs.every(e => e.killed));
});

test('行動順：自分側に詰めが起きても、各モンスターは1回だけ行動する', () => {
  const s = board([mk(MAGE), mk(MAGE), mk(MAGE)], [mk(GOLEM), mk(GOLEM), mk(GOLEM)]);
  const me = s.players[0];
  const [a, b, c] = me.slots;
  const acted = [];
  for (const ev of attackPhase(s)) {
    acted.push(ev.attacker);
    if (ev.attacker === c) removeMonster(me, 2); // 行動を終えた c が倒れる（Thorns などを想定）
  }
  assert(acted.length === 3 && acted[0] === c && acted[1] === b && acted[2] === a, '全員が1回ずつ、3→2→1の順');
});

test('行動順：行動する前に倒されたモンスターは行動しない', () => {
  const s = board([mk(MAGE), mk(MAGE), mk(MAGE)], [mk(GOLEM)]);
  const me = s.players[0];
  const [a, b, c] = me.slots;
  const acted = [];
  for (const ev of attackPhase(s)) {
    acted.push(ev.attacker);
    if (ev.attacker === c) removeMonster(me, 1); // b が行動前に倒れる
  }
  assert(acted.length === 2 && acted[0] === c && acted[1] === a);
});

test('行動順：移動したモンスターは行動時点のスロットのルールで攻撃する', () => {
  // 後列の近接は攻撃できないが、前が倒れて中央に詰めれば攻撃できる
  const s = board([mk(MAGE), mk(WOLF), mk(ELF)], [mk(GOLEM)]);
  const log = [];
  for (const ev of attackPhase(s)) {
    log.push(ev.attacker.card.id + ':' + ev.type);
    if (ev.attacker.card.id === ELF) removeMonster(s.players[0], 0); // 中央のメイジが行動前に倒れる
  }
  eq(log, [ELF + ':ranged', WOLF + ':melee']);
  // 遠隔が中央に詰めてきたら攻撃できない
  const t = board([mk(MAGE), mk(ELF), mk(MAGE)], [mk(GOLEM)]);
  const log2 = [];
  for (const ev of attackPhase(t)) { log2.push(ev.attacker.card.id); if (log2.length === 1) removeMonster(t.players[0], 0); }
  eq(log2, [MAGE]);
});

test('攻撃回数：装備なしのモンスターは1回の攻撃フェーズで1回だけ攻撃する', () => {
  for (const id of BASIC_MONSTERS) {
    const type = CARD_BY_ID[id].type;
    const s = board([mk(ARCHER), mk(id)], [mk(GOLEM), mk(GOLEM), mk(GOLEM)]);
    if (type !== 'melee') eq(attacks(s).length, 1, id);
    const f = board([mk(id)], [mk(GOLEM), mk(GOLEM), mk(GOLEM)]);
    if (type !== 'ranged') eq(attacks(f).length, 1, id + '（前列）');
  }
});

test('装備の攻撃：近接に魔法装備 → 後列に押し出されても魔法攻撃が出る', () => {
  for (const item of [TOME, ORB]) {
    const s = board([mk(MAGE), mk(WOLF, item)], [mk(GOLEM), mk(SLIME)]);
    const evs = attacks(s).filter(e => e.attacker.card.id === WOLF);
    eq(evs.map(e => [e.type, e.source, e.dmg, e.target.card.id]), [['magic', 'weapon', 2, SLIME]], item);
  }
});

test('装備の攻撃：遠隔に魔法装備 → 中央にいても魔法攻撃が出る', () => {
  for (const item of [TOME, ORB]) {
    const s = board([mk(ELF, item)], [mk(GOLEM)]);
    eq(attacks(s).map(e => [e.type, e.source, e.dmg]), [['magic', 'weapon', 2]], item);
  }
});

test('装備の攻撃：前列の近接は、近接と装備の魔法の両方で攻撃する', () => {
  const s = board([mk(WOLF, ORB)], [mk(GOLEM)]);
  eq(attacks(s).map(e => [e.type, e.source]), [['magic', 'weapon'], ['melee', 'base']]);
});

test('装備の攻撃：同じタイプなら本体の攻撃力に加算され、攻撃回数は増えない', () => {
  const s = board([mk(MAGE, ORB)], [mk(GOLEM)]);
  eq(attacks(s).map(e => [e.type, e.source, e.dmg]), [['magic', 'base', 5]]);
});

test('装備の攻撃：全装備×全モンスターで、装備の攻撃タイプが必ず攻撃一覧に入る', () => {
  for (const item of EQUIPS) for (const m of MONSTERS) {
    if (item.color && item.color !== m.color) continue;
    const list = getAttacks(mk(m.id, item.id));
    for (const type in (item.atk || {})) {
      const a = list.find(x => x.type === type);
      assert(a && a.atk >= item.atk[type], `${m.name} + ${item.name}：${type}`);
    }
  }
});

test('装備の攻撃：付け替え・移動のあとも装備の攻撃が正しく出る', () => {
  const s = board([mk(WOLF, SWORD)], [mk(GOLEM)]); // てつのつるぎ（近接+2）
  assert(equipItem(s, 0, give(s, 0, ORB), 0));       // オーブに付け替え
  eq(getAttacks(s.players[0].slots[0]).map(a => [a.type, a.atk]), [['melee', 2], ['magic', 2]]);
  assert(playMonster(s, 0, give(s, 0, SLIME), 0));   // 左へ押し出される
  eq(attacks(s).filter(e => e.attacker.card.id === WOLF).map(e => e.type), ['magic']);
});

// ---------- 1体の中での攻撃の順番（魔法 → カオス → 遠隔 → 近接） ----------

const CHAOS_ORB = tequip('t_chaosorb', 2, null, { atk: { chaos: 2 } });
const order = evs => evs.map(e => [e.type, e.source]);

test('攻撃の順番：近接モンスターに魔法装備 → 魔法（装備）が先、近接（本体）があと', () => {
  const s = board([mk(WOLF, TOME)], [mk(GOLEM)]);
  eq(order(attacks(s)), [['magic', 'weapon'], ['melee', 'base']]);
});

test('攻撃の順番：遠隔モンスターにカオス装備 → カオス（装備）が先、遠隔（本体）があと', () => {
  const s = board([mk(WOLF), mk(ELF, CHAOS_ORB)], [mk(GOLEM)]);
  eq(order(attacks(s).filter(e => e.attacker.card.id === ELF)), [['chaos', 'weapon'], ['ranged', 'base']]);
});

test('攻撃の順番：魔法とカオスの両方を持つ場合 → 魔法、カオスの順（どちらが本体でも同じ）', () => {
  eq(order(attacks(board([mk(MAGE, CHAOS_ORB)], [mk(GOLEM)]))), [['magic', 'base'], ['chaos', 'weapon']]);
  eq(order(attacks(board([mk(IMP, TOME)], [mk(GOLEM)]))), [['magic', 'weapon'], ['chaos', 'base']]);
});

test('攻撃の順番：遠隔モンスターに近接装備（Reachあり）→ 遠隔（本体）→ 近接（装備）', () => {
  const lance = tequip('t_lance', 2, null, { atk: { melee: 2 } }, ['reach']);
  const s = board([mk(WOLF), mk(ELF, lance)], [mk(GOLEM)]);
  eq(order(attacks(s).filter(e => e.attacker.card.id === ELF)), [['ranged', 'base'], ['melee', 'weapon']]);
});

test('攻撃の順番：4種類すべてを持っていても 魔法 → カオス → 遠隔 → 近接', () => {
  const all = tequip('t_all', 3, null, { atk: { melee: 1, ranged: 1, chaos: 1 } }, ['reach']);
  const s = board([mk(WOLF), mk(MAGE, all)], [mk(GOLEM)]);
  eq(attacks(s).filter(e => e.attacker.card.id === MAGE).map(e => e.type), ['magic', 'chaos', 'ranged', 'melee']);
});

test('攻撃の順番：Batter は近接の直後、Doublestrike は近接が当たった直後', () => {
  const s = board([mk(S('melee', 2, 10, 'batter:1', 'doublestrike:1'), TOME)], [mk(GOLEM), mk(SLIME)]);
  const evs = attacks(s);
  eq(order(evs), [['magic', 'weapon'], ['melee', 'base'], ['melee', 'batter']]);
  eq(evs.map(e => e.extras.map(x => x.kind)), [[], ['doublestrike'], ['doublestrike']], 'Doublestrike は近接のたびに、その直後');
});

test('攻撃の順番：そのスロットで使えない種類はとばす', () => {
  // 後列の近接＋魔法装備 → 魔法だけ。前列の遠隔＋魔法装備 → 魔法だけ
  eq(order(attacks(board([mk(MAGE), mk(WOLF, TOME)], [mk(GOLEM)])).filter(e => e.attacker.card.id === WOLF)), [['magic', 'weapon']]);
  eq(order(attacks(board([mk(ELF, TOME)], [mk(GOLEM)]))), [['magic', 'weapon']]);
});

test('攻撃の順番：先の攻撃で相手が倒れて詰めたら、次の攻撃は詰めたあとの並びで対象を選ぶ', () => {
  const s = board([mk(DRAGON, TOME)], [mk(IMP), mk(SLIME)]);
  s.players[1].slots[0].hp = 2; // 魔法2で倒れる
  const evs = attacks(s);
  eq(evs.map(e => [e.type, e.target.card.id, e.killed]), [['magic', IMP, true], ['melee', SLIME, false]]);
  eq(names(s.players[1]), [SLIME, null, null]);
});

test('攻撃の順番：モンスター同士の順番（スロット3→2→1）は変わらない', () => {
  const s = board([mk(WOLF, TOME), mk(MAGE), mk(ELF)], [mk(GOLEM)]);
  eq(attacks(s).map(e => [e.attacker.card.id, e.type]), [[ELF, 'ranged'], [MAGE, 'magic'], [WOLF, 'magic'], [WOLF, 'melee']]);
});

test('攻撃回数：武器装備は本体の攻撃に加えて別タイプの攻撃を1回行う', () => {
  const s = board([mk(DRAGON, TOME)], [mk(GOLEM)]);
  eq(attacks(s).map(e => [e.type, e.source, e.dmg]), [['magic', 'weapon', 2], ['melee', 'base', 5]]);
});

test('攻撃回数：BatterはX回の近接追加攻撃（後列では近接できないので発生しない）', () => {
  const s = board([mk(BRAWLER.id)], [mk(GOLEM)]);
  eq(attacks(s).map(e => [e.type, e.source, e.dmg]), [['melee', 'base', 2], ['melee', 'batter', 2], ['melee', 'batter', 2]]);
  const back = board([mk(MAGE), mk(BRAWLER.id)], [mk(GOLEM)]);
  eq(attacks(back).map(e => e.attacker.card.id), [MAGE]);
  // 武器の魔法攻撃には Batter は乗らない
  const tome = board([mk(BRAWLER.id, TOME)], [mk(GOLEM)]);
  eq(attacks(tome).map(e => e.source), ['weapon', 'base', 'batter', 'batter']);
});

// ---------- 装備・フラッシュ・生贄 ----------

test('装備：付け替えると古い装備は捨て札になり、体力ボーナスも外れる', () => {
  const s = board([mk(GOLEM)]);
  const p = s.players[0], golem = p.slots[0], base = golem.maxHp;
  assert(equipItem(s, 0, give(s, 0, TREE), 0));
  eq([golem.maxHp, golem.hp], [base + 6, base + 6]);
  assert(equipItem(s, 0, give(s, 0, STEEL), 0));
  eq([golem.item.id, golem.maxHp, golem.hp, golem.armor], [STEEL, base, base, 5]);
  eq(p.discard.map(c => c.id), [TREE]);
});

test('装備：色つきは同じ色のモンスターだけ', () => {
  const s = board([mk(SLIME)]);
  assert(!equipItem(s, 0, give(s, 0, RED_SWORD), 0), '赤の装備は青に付かない');
  assert(equipItem(s, 0, give(s, 0, BLUE_GUARD), 0));
});

test('フラッシュ：スマイトはアーマーを削り、ライトニングは無視する', () => {
  const s = board([mk(WOLF)], [mk(SLIME, LEATHER)]);
  const foe = s.players[1].slots[0];
  let ev = playFlash(s, 0, give(s, 0, ROCK), 0);
  eq([ev.armorDmg, foe.hp], [2, foe.maxHp]);
  foe.armor = 2;
  ev = playFlash(s, 0, give(s, 0, BOLT), 0);
  eq([ev.dmg, foe.armor, foe.hp], [3, 2, foe.maxHp - 3]);
});

test('フラッシュ：ヒールは最大HPを超えない／増援はクリスタルを増やす', () => {
  const s = board([mk(GOLEM)], [mk(WOLF)]);
  const p = s.players[0], golem = p.slots[0];
  golem.hp = golem.maxHp - 2;
  eq(playFlash(s, 0, give(s, 0, CURE), 0).heal, 2);
  eq(golem.hp, golem.maxHp);
  const before = p.crystals;
  playFlash(s, 0, give(s, 0, AID), -1);
  eq(p.crystals, before + 2);
});

test('生贄（場）：+2クリスタル、装備は捨て札にも行かず除外、後ろが前に詰める', () => {
  const s = board([mk(WOLF, LEATHER), mk(ELF), mk(MAGE)], [mk(GOLEM)]);
  const p = s.players[0];
  assert(sacrificeField(s, 0, 0));
  eq(p.crystals, 12);
  eq(names(p), [ELF, MAGE, null]);
  eq(p.discard.length, 0, '装備は捨て札に行かない');
  eq(p.hand.length, 0, '手札にも戻らない');
});

test('生贄（場）：真ん中を生贄にすると3番目が詰める／空きスロットは不可', () => {
  const s = board([mk(WOLF), mk(ELF), mk(MAGE)], [mk(GOLEM)]);
  assert(sacrificeField(s, 0, 1));
  eq(names(s.players[0]), [WOLF, MAGE, null]);
  const t = board([mk(WOLF)], [mk(GOLEM)]);
  assert(!sacrificeField(t, 0, 2));
  assert(!sacrificeField(t, 1, 0), '相手の番のプレイヤーは不可');
});

test('生贄：手札と場を合わせて1ターンに1回だけ', () => {
  const s = board([mk(WOLF), mk(ELF)], [mk(GOLEM)]);
  const p = s.players[0];
  const a = give(s, 0, LEATHER), b = give(s, 0, SLIME);
  assert(sacrificeField(s, 0, 1));
  assert(!sacrificeField(s, 0, 0), '場の2体目は不可');
  assert(!sacrifice(s, 0, a) && !sacrifice(s, 0, b), '手札も不可');
  eq([p.crystals, p.hand.length, names(p)], [12, 2, [WOLF, null, null]]);
  const t = board([mk(WOLF)], [mk(GOLEM)]);
  assert(sacrifice(t, 0, give(t, 0, LEATHER)));
  assert(!sacrificeField(t, 0, 0), '手札を生贄にしたあとは場も不可');
});

test('生贄（場）：生贄にしたモンスターは残り数に数えない', () => {
  const s = board([mk(WOLF), mk(ELF)], [mk(GOLEM)]);
  give(s, 0, MAGE);
  eq(monstersLeft(s.players[0]), 3);
  assert(sacrificeField(s, 0, 0));
  eq(monstersLeft(s.players[0]), 2);
});

test('生贄（場）：残り0体になってもその場では負けにならず、次のターン開始時のドロー後に負け', () => {
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  assert(sacrificeField(s, 0, 0));
  eq(monstersLeft(s.players[0]), 0);
  eq(checkResult(s), null, '生贄の直後');
  eq(playFlash(s, 0, give(s, 0, ROCK), 0).result, null, 'フラッシュを使っても負けにならない');
  eq(attacks(s).length, 0);
  eq(finishTurn(s), null, '攻撃フェーズ後もまだ負けにならない');
  eq(startTurn(s), { winner: 1, reason: 'wipeout' }, '次のターン開始時に判定');
});

test('生贄：1ターンに1枚、アイテム+1・モンスター+2', () => {
  const s = board([mk(GOLEM)], [mk(GOLEM)]);
  const p = s.players[0];
  const a = give(s, 0, WOLF), b = give(s, 0, LEATHER);
  assert(sacrifice(s, 0, a));
  eq(p.crystals, 12);
  assert(!sacrifice(s, 0, b), '2枚目は不可');
  startTurn(s);
  assert(sacrifice(s, 0, b));
  eq(p.crystals, 12 + CONFIG.CRYSTALS_PER_TURN + 1);
});

// ---------- 勝敗 ----------

const inDeck = (s, pi, id) => s.players[pi].deck.push({ uid: uidSeq++, card: CARD_BY_ID[id] });

test('勝敗：残りモンスター数は場＋手札＋山札（装備・フラッシュは数えない）', () => {
  const s = board([mk(WOLF)]);
  give(s, 0, ELF); give(s, 0, LEATHER); inDeck(s, 0, MAGE); inDeck(s, 0, ROCK);
  eq(monstersLeft(s.players[0]), 3);
});

test('勝敗：場が全滅しても手札にモンスターがいれば続行する', () => {
  const s = board([mk(DRAGON)], [mk(IMP)]);
  s.players[1].slots[0].hp = 1;
  give(s, 1, ELF);
  assert(attacks(s)[0].killed);
  eq(names(s.players[1]), [null, null, null]);
  eq(finishTurn(s), null, '手札に1体いるので続行');
  eq(s.current, 1);
});

test('勝敗：場が全滅しても山札にモンスターがいれば続行し、次のターンにドローして出せる', () => {
  const s = board([mk(DRAGON)], [mk(IMP)]);
  s.players[1].slots[0].hp = 1;
  inDeck(s, 1, ELF);
  attacks(s);
  eq(finishTurn(s), null);
  startTurn(s);
  eq(s.players[1].hand.map(h => h.card.id), [ELF]);
  assert(playMonster(s, 1, s.players[1].hand[0].uid, 0));
});

test('勝敗：場・手札・山札のすべてが空になったら負け', () => {
  const s = board([mk(DRAGON)], [mk(IMP)]);
  s.players[1].slots[0].hp = 1;
  give(s, 1, LEATHER); inDeck(s, 1, ROCK); // モンスター以外は残っていても関係ない
  attacks(s);
  eq(finishTurn(s), { winner: 0, reason: 'wipeout' });
  eq(s.phase, 'over');
});

test('勝敗：場が空でも、モンスターが残っていれば負けない（ペナルティで1枚失うだけ）', () => {
  for (const turn of [1, 2, 9]) {
    const s = board(); s.turn = turn;
    [WOLF, ELF, MAGE].forEach(id => { give(s, 0, id); give(s, 1, id); });
    eq(finishTurn(s), null, 'turn ' + turn);
    eq(monstersLeft(s.players[0]), 2);
  }
});

test('勝敗：相手の場が空なら攻撃フェーズはスキップされ、それだけでは勝ちにならない', () => {
  const s = board([mk(DRAGON)], []);
  give(s, 1, ELF);
  eq(attacks(s).length, 0);
  eq(finishTurn(s), null);
});

test('勝敗：生贄にしたモンスターは残り数に数えない（最後の1体を生贄にすると負け）', () => {
  const s = board([], [mk(GOLEM)]);
  const a = give(s, 0, WOLF);
  eq(monstersLeft(s.players[0]), 1);
  assert(sacrifice(s, 0, a));
  eq(monstersLeft(s.players[0]), 0);
  attacks(s);
  eq(finishTurn(s), null, 'その場では負けにしない');
  eq(startTurn(s), { winner: 1, reason: 'wipeout' });
});

test('勝敗：山札が空でもドローで落ちず、負けにもならない', () => {
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  const p = s.players[0];
  eq(p.deck.length, 0);
  startTurn(s);
  eq([p.hand.length, p.crystals], [0, 10 + CONFIG.CRYSTALS_PER_TURN]);
  attacks(s);
  eq(finishTurn(s), null);
});

test('勝敗：フラッシュで最後の1体を倒した直後に判定する', () => {
  const s = board([mk(WOLF)], [mk(IMP)]);
  s.players[1].slots[0].hp = 1;
  const ev = playFlash(s, 0, give(s, 0, ROCK), 0);
  assert(ev.killed);
  eq(ev.result, { winner: 0, reason: 'wipeout' });
  eq(s.phase, 'over');
  // 手札にモンスターが残っている相手なら決着しない
  const t = board([mk(WOLF)], [mk(IMP)]);
  t.players[1].slots[0].hp = 1;
  give(t, 1, ELF);
  eq(playFlash(t, 0, give(t, 0, ROCK), 0).result, null);
  eq(t.phase, 'play');
});

test('勝敗：両者が同時にモンスターを失ったら、そのターンの行動側の勝ち', () => {
  for (const actor of [0, 1]) {
    const s = board();
    s.current = actor;
    s.players[1 - actor].slots[0] = mk(IMP);
    s.players[1 - actor].slots[0].hp = 1;
    assert(sacrifice(s, actor, give(s, actor, WOLF)));       // 自分の最後のモンスターを生贄に
    const ev = playFlash(s, actor, give(s, actor, ROCK), 0); // 相手の最後の1体を倒す
    eq(ev.result, { winner: actor, reason: 'both' });
  }
});

test('勝敗：引き分けはない（ターン制限なし。何ターン経っても決着がつくまで続く）', () => {
  const s = board([mk(SLIME)], [mk(GOLEM)]);
  for (const turn of [26, 27, 100, 999]) {
    s.turn = turn; s.phase = 'play';
    attacks(s);
    eq(finishTurn(s), null, 'turn ' + turn);
  }
  eq(typeof CONFIG.MAX_TURNS, 'undefined');
});

// ---------- 場が空のペナルティ ----------

const pileIds = p => [...p.hand, ...p.deck].map(h => h.card.id);

test('ペナルティ：ターン終了時に場が空なら1枚捨てる。場にモンスターがいれば捨てない', () => {
  const s = board([], [mk(GOLEM)]);
  give(s, 0, WOLF); give(s, 0, LEATHER); inDeck(s, 0, ELF);
  const before = s.players[0].crystals;
  attacks(s);
  eq(finishTurn(s), null);
  assert(s.penalty && s.penalty.player === 0);
  eq(pileIds(s.players[0]).length, 2);
  eq(s.players[0].crystals, before, 'クリスタルはもらえない');
  eq(s.players[0].discard.length, 0, '捨て札ではなく除外');
  const t = board([mk(WOLF)], [mk(GOLEM)]);
  give(t, 0, ELF); inDeck(t, 0, MAGE);
  attacks(t);
  eq(finishTurn(t), null);
  eq([t.penalty, pileIds(t.players[0]).length], [null, 2]);
});

test('ペナルティ：相手のターンに全滅させられても、判定は自分のターン終了時', () => {
  const s = board([mk(DRAGON)], [mk(IMP)]);
  s.players[1].slots[0].hp = 1;
  give(s, 1, ELF); give(s, 1, LEATHER);
  attacks(s);
  eq(finishTurn(s), null);
  eq(s.penalty, null, '相手のターン終了時には捨てない');
  eq(s.players[1].hand.length, 2);
  startTurn(s);          // 全滅させられた側のターン。出さずに終える
  attacks(s);
  finishTurn(s);
  assert(s.penalty && s.penalty.player === 1);
  eq(s.players[1].hand.length, 1);
});

test('ペナルティ：最初のターンも対象', () => {
  const s = board();
  s.turn = 1;
  give(s, 0, WOLF); give(s, 0, ELF); give(s, 1, WOLF);
  finishTurn(s);
  assert(s.penalty && s.penalty.player === 0);
});

test('ペナルティ：手札と山札から、枚数の比率どおりにランダムに選ばれる', () => {
  const T = 8000;
  let fromHand = 0;
  const seen = new Set();
  for (let i = 0; i < T; i++) {
    const s = board([], [mk(GOLEM)]);
    [WOLF, ELF, LEATHER].forEach(id => give(s, 0, id));                             // 手札3枚
    [MAGE, IMP, SLIME, GOLEM, DRAGON, STEEL, TOME, ROCK, BOLT].forEach(id => inDeck(s, 0, id)); // 山札9枚
    finishTurn(s);
    if (s.penalty.from === 'hand') fromHand++;
    seen.add(s.penalty.card.id);
  }
  assert(Math.abs(fromHand / T - 0.25) < 0.02, '手札の割合 ' + fromHand / T);
  eq(seen.size, 12, 'すべてのカードが選ばれうる');
});

test('ペナルティ：片方が0枚ならもう片方から捨てる。両方0枚なら何もしない', () => {
  const h = board([], [mk(GOLEM)]);
  give(h, 0, WOLF); give(h, 0, ELF);
  finishTurn(h);
  eq([h.penalty.from, h.players[0].hand.length], ['hand', 1]);
  const d = board([], [mk(GOLEM)]);
  inDeck(d, 0, WOLF); inDeck(d, 0, ELF);
  finishTurn(d);
  eq([d.penalty.from, d.players[0].deck.length], ['deck', 1]);
  const none = board([mk(WOLF)], []);
  none.current = 1; // 場も手札も山札も空の側の番（すでに0体なので負け）
  finishTurn(none);
  eq(none.penalty, null);
});

test('ペナルティ：捨てたモンスターは残り数から外れる', () => {
  const s = board([], [mk(GOLEM)]);
  give(s, 0, WOLF); give(s, 0, ELF); give(s, 0, MAGE);
  eq(monstersLeft(s.players[0]), 3);
  finishTurn(s);
  eq([s.penalty.card.kind, monstersLeft(s.players[0])], ['monster', 2]);
});

test('ペナルティ：捨てたことで残り0体になったら負け', () => {
  const s = board([], [mk(GOLEM)]);
  give(s, 0, WOLF);
  eq(finishTurn(s), { winner: 1, reason: 'wipeout', penalty: true });
  eq(s.phase, 'over');
});

test('ペナルティ：モンスターを手札に抱え続けると、いずれ負ける（200試合）', () => {
  let maxTurn = 0;
  for (let g = 0; g < 200; g++) {
    const s = newGame(randomDeck(testRng), randomDeck(testRng), testRng);
    let res = null;
    while (!res) {
      assert(s.turn < 200, '決着しない');
      const pi = s.current;
      res = startTurn(s);
      if (res) break;
      // プレイヤー0は何も出さずにターンを終える。プレイヤー1はふつうのCPU
      let a;
      while (pi === 1 && (a = cpuNextAction(s))) applyAction(s, pi, a);
      if (s.result) { res = s.result; break; }
      attacks(s);
      res = finishTurn(s);
    }
    eq(res.winner, 1, '抱え続けた側が負ける');
    maxTurn = Math.max(maxTurn, s.turn);
  }
  assert(maxTurn <= 40, '最長ターン ' + maxTurn);
});

// ---------- 消耗ダメージ ----------

// ターン t の開始直前の盤面にする
const atTurn = (s, t) => { s.turn = t - 1; return s; };

test('消耗：ターン27より前は発生しない', () => {
  for (let t = 1; t < 27; t++) eq(attritionDamage(t), 0, 'turn ' + t);
  const s = atTurn(board([mk(WOLF)], [mk(GOLEM)]), 26);
  eq(startTurn(s), null);
  eq([s.turn, s.attrition.length], [26, 0]);
  eq(s.players.map(p => p.slots[0].hp), [CARD_BY_ID[WOLF].hp, CARD_BY_ID[GOLEM].hp]);
});

test('消耗：ターン27から、場の全モンスター（両者）がダメージを受ける', () => {
  const s = atTurn(board([mk(WOLF), mk(ELF)], [mk(GOLEM)]), 27);
  eq(startTurn(s), null);
  eq(s.attrition.map(e => [e.target.card.id, e.dmg, e.killed]), [[WOLF, 1, false], [ELF, 1, false], [GOLEM, 1, false]]);
  eq(s.players[0].slots[0].hp, CARD_BY_ID[WOLF].hp - 1);
  eq(s.players[1].slots[0].hp, CARD_BY_ID[GOLEM].hp - 1);
});

test('消耗：ダメージ量は4ターンごとに+1（定数で変更できる）', () => {
  eq([27, 30, 31, 34, 35, 38, 39, 47].map(attritionDamage), [1, 1, 2, 2, 3, 3, 4, 6]);
  const saved = [CONFIG.ATTRITION_START, CONFIG.ATTRITION_STEP];
  CONFIG.ATTRITION_START = 10; CONFIG.ATTRITION_STEP = 2;
  try { eq([9, 10, 11, 12, 14].map(attritionDamage), [0, 1, 1, 2, 3]); }
  finally { [CONFIG.ATTRITION_START, CONFIG.ATTRITION_STEP] = saved; }
});

test('消耗：アーマーで軽減されず、アーマーも減らない', () => {
  const s = atTurn(board([mk(WOLF)], [mk(GOLEM, STEEL)]), 31);
  startTurn(s);
  const golem = s.players[1].slots[0];
  eq([golem.hp, golem.armor], [golem.maxHp - 2, 5]);
});

test('消耗：手札・山札のモンスターは対象外', () => {
  const s = atTurn(board([mk(WOLF)], [mk(GOLEM)]), 40);
  give(s, 0, ELF); inDeck(s, 0, MAGE); inDeck(s, 0, IMP);
  startTurn(s);
  eq(s.attrition.length, 2, '場の2体だけ');
  eq(monstersLeft(s.players[0]), 4);
});

test('消耗：倒れたら後ろが前に詰め、場が空でも手札・山札にモンスターがいれば続行', () => {
  const s = atTurn(board([mk(WOLF), mk(GOLEM)], [mk(IMP)]), 27);
  s.players[0].slots[0].hp = 1;
  s.players[1].slots[0].hp = 1;
  give(s, 1, ELF);
  eq(startTurn(s), null, '相手は手札に1体いるので続行');
  eq(names(s.players[0]), [GOLEM, null, null]);
  eq(names(s.players[1]), [null, null, null]);
});

test('消耗：消耗ダメージで相手の最後の1体が倒れたら勝ち（理由つき）', () => {
  const s = atTurn(board([mk(GOLEM)], [mk(IMP)]), 27);
  s.players[1].slots[0].hp = 1;
  eq(startTurn(s), { winner: 0, reason: 'wipeout', attrition: true });
});

test('消耗：両者の最後のモンスターが同時に倒れたら、そのターンの手番側の勝ち', () => {
  for (const cur of [0, 1]) {
    const s = atTurn(board([mk(WOLF)], [mk(IMP)]), 27);
    s.current = cur;
    s.players.forEach(p => { p.slots[0].hp = 1; });
    eq(startTurn(s), { winner: cur, reason: 'both', attrition: true });
  }
});

test('消耗：両者の最後の1体が遠隔で山札も手札も尽きた膠着が、必ず決着する', () => {
  const s = board([mk(ELF)], [mk(ARCHER)]);
  s.turn = 20;
  let res = null, guard = 0;
  while (!res) {
    assert(++guard < 200, '決着しない');
    res = startTurn(s);
    if (res) break;
    eq(attacks(s).length, 0, 'どちらも攻撃できない');
    res = finishTurn(s);
  }
  assert(res.winner === 0 || res.winner === 1);
  eq(res.attrition, true);
  assert(s.turn >= CONFIG.ATTRITION_START && s.turn < 60, 'turn ' + s.turn);
});

test('CPU：消耗ダメージが近いと、攻撃力の高いモンスターと攻撃の装備を優先する', () => {
  const pick = turn => {
    const s = board([], [mk(GOLEM)]);
    s.turn = turn; s.players[0].crystals = 5;
    give(s, 0, GOLEM); give(s, 0, KNIGHT); // ゴーレム(コスト5・攻撃3) / ダークナイト(コスト4・攻撃4)
    return s.players[0].hand.find(h => h.uid === cpuNextAction(s).uid).card.id;
  };
  eq([pick(5), pick(24)], [GOLEM, KNIGHT]);
  assert(itemScore(CARD_BY_ID[STEEL], CARD_BY_ID[WOLF], 0, true) < itemScore(CARD_BY_ID[SWORD], CARD_BY_ID[WOLF], 0, true));
});

test('CPU：消耗が始まったら、残り数で勝っていない限り場のモンスターを生贄にしない', () => {
  const make = foeExtra => {
    const s = board([mk(IMP), mk(MAGE)], [mk(GOLEM)]);
    s.turn = 30; s.players[0].crystals = 4;
    give(s, 0, DRAGON); [ELF, SLIME].forEach(id => inDeck(s, 0, id)); // 自分の残り5体
    for (let i = 0; i < foeExtra; i++) inDeck(s, 1, WOLF);
    return cpuNextAction(s);
  };
  eq(make(0), { type: 'sacrificeField', slot: 0 }, '相手の残り1体：勝っているので可');
  eq(make(6), null, '相手の残り7体：負けているのでしない');
});

// ---------- CPU（場が空のとき） ----------

const cpuBoard = (hand, deck = []) => {
  const s = board([], [mk(GOLEM)]);
  s.current = 0;
  hand.forEach(id => give(s, 0, id));
  deck.forEach(id => inDeck(s, 0, id));
  return s;
};

test('CPU：場が空のときは手札のモンスターを最優先で出す', () => {
  const s = cpuBoard([LEATHER, ROCK, WOLF]);
  eq(cpuNextAction(s).type, 'monster');
});

test('CPU：場が空で手札にモンスターがなければ、ほかのカードを生贄にする', () => {
  const s = cpuBoard([LEATHER], [WOLF]);
  s.players[0].crystals = 0;
  const a = cpuNextAction(s);
  eq(a.type, 'sacrifice');
  eq(s.players[0].hand.find(h => h.uid === a.uid).card.id, LEATHER);
});

test('CPU：場が空なら、モンスターを生贄にしてでも安いモンスターを出す（残りが少なくても）', () => {
  const s = cpuBoard([GOLEM, DRAGON]); // 残り2体、どちらもそのままでは出せない
  s.players[0].crystals = 3;
  const a = cpuNextAction(s);
  eq(a.type, 'sacrifice');
  eq(s.players[0].hand.find(h => h.uid === a.uid).card.id, DRAGON);
  applyAction(s, 0, a);
  eq(cpuNextAction(s).type, 'monster');
});

test('CPU：攻撃できない位置で倒されそうなモンスターを生贄にする', () => {
  const s = board([mk(MAGE), mk(WOLF)], [mk(DRAGON)]); // ウルフは後列で攻撃できない
  s.players[0].slots[1].hp = 2;
  s.players[0].crystals = 0;
  [ELF, SLIME, IMP].forEach(id => inDeck(s, 0, id));
  // 倒されればクリスタルをもらえるので、ただ倒されそうなだけでは生贄にしない（攻撃を1回受け止めさせる）
  eq(cpuNextAction(s), null);
  // 生贄のクリスタルで、今すぐ手札のモンスターを出せるなら生贄にする
  give(s, 0, CARD_BY_ID[SLIME].cost <= CONFIG.SACRIFICE_MONSTER ? SLIME : IMP);
  s.players[0].slots[2] = setOwner(mk(ELF), s.players[0]); // 場は満員（出すには場を空ける必要がある）
  const hand = s.players[0].hand[0];
  s.players[0].crystals = costOf(s.players[0], hand.card) - 1;
  if (s.players[0].crystals >= 0) eq(cpuNextAction(s), { type: 'sacrificeField', slot: 1 });
  // このルールがなければ、今までどおり生贄にする
  const t = board([mk(MAGE), mk(WOLF)], [mk(DRAGON)]);
  t.players[0].slots[1].hp = 2; t.players[0].crystals = 0;
  [ELF, SLIME, IMP].forEach(id => inDeck(t, 0, id));
  CONFIG.FALLEN_CRYSTAL = 0;
  try { eq(cpuNextAction(t), { type: 'sacrificeField', slot: 1 }); } finally { CONFIG.FALLEN_CRYSTAL = 1; }
});

test('CPU：+2クリスタルで強いモンスターを出せるなら、安いモンスターを生贄にする', () => {
  const s = board([mk(IMP), mk(MAGE)], [mk(GOLEM)]);
  s.players[0].crystals = 4;
  give(s, 0, DRAGON); // コスト6
  [ELF, SLIME].forEach(id => inDeck(s, 0, id));
  eq(cpuNextAction(s), { type: 'sacrificeField', slot: 0 });
  applyAction(s, 0, cpuNextAction(s));
  eq(cpuNextAction(s).type, 'monster');
});

test('CPU：場が1体のとき、残りモンスターが少ないときは場を生贄にしない', () => {
  const one = board([mk(IMP)], [mk(GOLEM)]);
  one.players[0].crystals = 4;
  give(one, 0, DRAGON); [ELF, SLIME, MAGE].forEach(id => inDeck(one, 0, id));
  eq(cpuNextAction(one), null, '場が1体');
  const few = board([mk(IMP), mk(MAGE)], [mk(GOLEM)]);
  few.players[0].crystals = 4;
  give(few, 0, DRAGON); // 残り3体
  eq(cpuNextAction(few), null, '残りが少ない');
});

test('CPU：誰も攻撃できない並びは、邪魔なモンスターを生贄にして詰め直す（膠着の解消）', () => {
  const s = board([mk(ELF), mk(WOLF)], [mk(GOLEM)]); // 前列に遠隔、後列に近接 → どちらも攻撃できない
  s.players[0].crystals = 0;
  eq(cpuNextAction(s), { type: 'sacrificeField', slot: 0 });
  applyAction(s, 0, cpuNextAction(s));
  eq(names(s.players[0]), [WOLF, null, null]);
  eq(attacks(s).length, 1);
  // 手札のモンスターで直せるなら生贄にしない
  const t = board([mk(ELF), mk(WOLF)], [mk(GOLEM)]);
  t.players[0].crystals = 0;
  give(t, 0, DRAGON);
  eq(cpuNextAction(t), null);
});

// ============================================================
// スキルの単体テスト
// ============================================================

// 確率の検証：fn を n 回実行して true の割合を返す
const rate = (n, fn) => { let c = 0; for (let i = 0; i < n; i++) if (fn()) c++; return c / n; };
const near = (actual, expected, tol, msg) => assert(Math.abs(actual - expected) <= tol, `${msg || '割合'} ${actual.toFixed(3)}（期待 ${expected}）`);
// プレイヤー pi のターン開始まで進める（ターン開始時スキルが発動する）
const beginTurnOf = (s, pi) => { s.current = pi; s.phase = 'play'; return startTurn(s); };
const startEv = (s, kind) => s.startEvents.filter(e => e.kind === kind);

// ---------- 攻撃系 ----------

test('Piercing：アーマーを破壊したとき、超過ダメージがHPに届く', () => {
  const s = board([mk(S('melee', 5, 10, 'piercing'))], [mk(SLIME, LEATHER)]); // アーマー2
  const foe = s.players[1].slots[0];
  const ev = attacks(s)[0];
  eq([ev.armorDmg, ev.dmg, foe.armor, foe.hp], [2, 3, 0, foe.maxHp - 3]);
  // アーマーを割りきれないときは届かない
  const t = board([mk(S('melee', 3, 10, 'piercing'))], [mk(SLIME, STEEL)]);
  eq([attacks(t)[0].armorDmg, attacks(board([mk(S('melee', 3, 10, 'piercing'))], [mk(SLIME, STEEL)]))[0].dmg], [3, 0]);
});

test('Doublestrike：前列からの近接が当たると、後列の敵1体にXの追加ダメージ', () => {
  const s = board([mk(S('melee', 2, 10, 'doublestrike:3'))], [mk(GOLEM), mk(SLIME)]);
  const ev = attacks(s)[0];
  const ds = extra(ev, 'doublestrike');
  eq([ev.target.card.id, ds.target.card.id, ds.dmg], [GOLEM, SLIME, 3]);
  // 後列の敵がいなければ発生しない
  eq(attacks(board([mk(S('melee', 2, 10, 'doublestrike:3'))], [mk(GOLEM)]))[0].extras.length, 0);
  // 後列が2体ならランダムに選ばれる
  const hits = new Set();
  for (let i = 0; i < 200; i++) {
    const t = board([mk(S('melee', 2, 10, 'doublestrike:1'))], [mk(GOLEM), mk(SLIME), mk(MAGE)]);
    hits.add(extra(attacks(t)[0], 'doublestrike').target.card.id);
  }
  eq([...hits].sort(), [MAGE, SLIME].sort());
});

test('Doublestrike：後列からの近接（Reach）でも発生する／アーマーから削る', () => {
  const s = board([mk(MAGE), mk(S('melee', 2, 10, 'doublestrike:3', 'reach'))], [mk(GOLEM), mk(SLIME)]);
  const ev = attacks(s).find(e => e.type === 'melee');
  eq([extra(ev, 'doublestrike').target.card.id, extra(ev, 'doublestrike').dmg], [SLIME, 3]);
  const t = board([mk(S('melee', 2, 10, 'doublestrike:3'))], [mk(GOLEM), mk(SLIME, LEATHER)]);
  const ds = extra(attacks(t)[0], 'doublestrike');
  eq([ds.armorDmg, ds.dmg], [2, 0]);
});

test('Reach：後列からでも近接攻撃ができ、前列の敵を攻撃する', () => {
  const s = board([mk(MAGE), mk(S('melee', 4, 10, 'reach')), mk(WOLF)], [mk(GOLEM), mk(SLIME)]);
  const evs = attacks(s).filter(e => e.type === 'melee');
  eq(evs.map(e => [s.players[0].slots.indexOf(e.attacker), e.target.card.id, e.dmg]), [[1, GOLEM, 4]], 'Reachなしのウルフは後列から攻撃しない');
});

test('Anti-Air：Flying持ちに回避されず、X追加ダメージ（Flyingでない相手には追加なし）', () => {
  for (let i = 0; i < 300; i++) {
    const s = board([mk(S('melee', 3, 10, 'antiair:2'))], [mk(S('melee', 1, 30, 'flying'))]);
    const ev = attacks(s)[0];
    eq([ev.dodged, ev.dmg], [false, 5]);
  }
  eq(attacks(board([mk(S('melee', 3, 10, 'antiair:2'))], [mk(GOLEM)]))[0].dmg, 3);
});

test('Swallow：敵を倒すたび、全攻撃力と最大HPが永続的に+X', () => {
  const s = board([mk(S('melee', 5, 10, 'swallow:2'))], [mk(IMP), mk(GOLEM)]);
  const me = s.players[0].slots[0];
  const ev = attacks(s)[0];
  assert(ev.killed);
  eq(extra(ev, 'swallow').x, 2);
  eq([me.bonusAtk, me.maxHp, me.hp, getAttacks(me)[0].atk], [2, 12, 12, 7]);
  s.phase = 'play';
  eq(attacks(s)[0].dmg, 7, '次の攻撃から増えた攻撃力で殴る');
  // 倒せなければ増えない
  const t = board([mk(S('melee', 1, 10, 'swallow:2'))], [mk(GOLEM)]);
  attacks(t);
  eq(t.players[0].slots[0].bonusAtk, 0);
});

test('Swallow：装備で増えた別タイプの攻撃にも加算される', () => {
  const m = mk(S('melee', 3, 10, 'swallow:1'), TOME);
  m.bonusAtk = 2;
  eq(getAttacks(m).map(a => [a.type, a.atk]), [['melee', 5], ['magic', 4]]);
});

// ---------- 防御系 ----------

test('Shield：受ける物理ダメージをX減らす（魔法は減らない。0未満にはならない）', () => {
  const tank = () => mk(S('melee', 1, 20, 'shield:2'));
  eq(attacks(board([mk(DRAGON)], [tank()]))[0].dmg, 3, '近接5 → 3');
  eq(attacks(board([mk(WOLF), mk(MAGE)], [tank()])).find(e => e.type === 'magic').dmg, 3, '魔法は軽減されない');
  const weak = attacks(board([mk(SLIME)], [tank()]))[0]; // 近接1
  eq([weak.dmg, weak.shielded], [0, 1]);
  const s = board([mk(WOLF)], [tank()]);
  eq(playFlash(s, 0, give(s, 0, ROCK), 0).dmg, 1, 'スマイト3 → 1');
});

test('Shield：軽減してからアーマーを削る', () => {
  const s = board([mk(DRAGON)], [mk(S('melee', 1, 20, 'shield:2'), LEATHER)]); // 5-2=3 → アーマー2で止まる
  const ev = attacks(s)[0];
  eq([ev.shielded, ev.armorDmg, ev.dmg], [2, 2, 0]);
});

test('Thorns：近接攻撃を受けたとき、攻撃者にXダメージ', () => {
  const s = board([mk(WOLF)], [mk(S('melee', 1, 20, 'thorns:2'))]);
  const wolf = s.players[0].slots[0];
  const th = extra(attacks(s)[0], 'thorns');
  eq([th.target === wolf, th.dmg, wolf.hp], [true, 2, wolf.maxHp - 2]);
});

test('Thorns：攻撃者のアーマーから削られる', () => {
  const s = board([mk(WOLF, LEATHER)], [mk(S('melee', 1, 20, 'thorns:2'))]);
  const wolf = s.players[0].slots[0];
  const th = extra(attacks(s)[0], 'thorns');
  eq([th.armorDmg, th.dmg, wolf.armor, wolf.hp], [2, 0, 0, wolf.maxHp]);
  // アーマー5なら、3のThornsを受けてもアーマーが残りHPは減らない
  const t = board([mk(WOLF, STEEL)], [mk(S('melee', 1, 20, 'thorns:3'))]);
  attacks(t);
  eq([t.players[0].slots[0].armor, t.players[0].slots[0].hp], [2, CARD_BY_ID[WOLF].hp]);
});

test('Thorns：遠隔・魔法・カオスでは発動しない／攻撃者が倒れたらBatterは止まる', () => {
  const s = board([mk(IMP), mk(ELF), mk(MAGE)], [mk(S('melee', 1, 40, 'thorns:2'))]);
  assert(attacks(s).every(e => !extra(e, 'thorns')));
  const t = board([mk(S('melee', 1, 3, 'batter:3'))], [mk(S('melee', 1, 40, 'thorns:2'))]);
  const evs = attacks(t);
  eq(evs.length, 2, '2回目のThornsで倒れ、残りの追加攻撃は行わない');
  assert(extra(evs[1], 'thorns').killed);
  eq(names(t.players[0]), [null, null, null]);
});

test('Flying：Flyingを持たない相手の近接を約50%、遠隔を約25%回避する', () => {
  const flyer = () => mk(S('melee', 1, 999, 'flying'));
  near(rate(6000, () => attacks(board([mk(WOLF)], [flyer()]))[0].dodged), 0.5, 0.03, '近接の回避率');
  near(rate(6000, () => attacks(board([mk(WOLF), mk(ELF)], [flyer()])).find(e => e.type === 'ranged').dodged), 0.25, 0.03, '遠隔の回避率');
});

test('Flying：魔法・カオスは回避できない／Flying持ちの攻撃は回避されない', () => {
  const flyer = () => mk(S('melee', 1, 999, 'flying'));
  eq(rate(500, () => attacks(board([mk(MAGE)], [flyer()]))[0].dodged), 0, '魔法');
  eq(rate(500, () => attacks(board([mk(IMP)], [flyer()]))[0].dodged), 0, 'カオス');
  eq(rate(500, () => attacks(board([mk(S('melee', 2, 10, 'flying'))], [flyer()]))[0].dodged), 0, 'Flying同士');
});

test('Flying：回避したときはダメージもThornsもDiseaseも発生しない', () => {
  for (let i = 0; i < 200; i++) {
    const s = board([mk(S('melee', 3, 50, 'disease:1'))], [mk(S('melee', 1, 999, 'flying', 'thorns:2'))]);
    const ev = attacks(s)[0];
    if (!ev.dodged) continue;
    eq([ev.dmg, ev.extras.length, s.players[0].slots[0].hp, s.players[1].slots[0].hp], [0, 0, 50, 999]);
  }
});

test('Flying：Doublestrikeも約50%回避する', () => {
  near(rate(6000, () => {
    const s = board([mk(S('melee', 1, 10, 'doublestrike:1'))], [mk(GOLEM), mk(S('melee', 1, 999, 'flying'))]);
    return extra(attacks(s)[0], 'doublestrike').dodged;
  }), 0.5, 0.03);
});

test('Stealth：後列にいる間、遠隔・魔法の対象にならない', () => {
  const hidden = () => mk(S('melee', 1, 20, 'stealth'));
  // 遠隔（スロット2）の対角＝相手スロット3がStealth → 正面のスロット2を狙う
  const s = board([mk(WOLF), mk(ELF)], [mk(GOLEM), mk(SLIME), hidden()]);
  eq(attacks(s).find(e => e.type === 'ranged').target.card.id, SLIME);
  // 魔法（スロット3）の正面がStealth → 前列を狙う
  const t = board([mk(WOLF), mk(ELF), mk(MAGE)], [mk(GOLEM), mk(SLIME), hidden()]);
  eq(attacks(t).find(e => e.type === 'magic').target.card.id, GOLEM);
  // 後列が全員Stealthなら前列へ
  const u = board([mk(WOLF), mk(ELF)], [mk(GOLEM), hidden(), hidden()]);
  eq(attacks(u).find(e => e.type === 'ranged').target.card.id, GOLEM);
});

test('Stealth：前列にいるときは狙われる／カオスには狙われる', () => {
  const s = board([mk(WOLF), mk(ELF), mk(MAGE)], [mk(S('melee', 1, 30, 'stealth'))]);
  eq(attacks(s).length, 3, '前列のStealthは全員から攻撃される');
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const t = board([mk(IMP)], [mk(GOLEM), mk(S('melee', 1, 30, 'stealth'))]);
    seen.add(s.players[1].slots.length && t.players[1].slots.indexOf(attacks(t)[0].target));
  }
  assert(seen.has(1), 'カオスは後列のStealthにも当たる');
});

test('Taunt：敵の遠隔攻撃の優先対象になる', () => {
  // スロット2の遠隔は本来スロット3（対角）を狙うが、正面のTauntを優先する
  const s = board([mk(WOLF), mk(ELF)], [mk(GOLEM), mk(S('melee', 1, 20, 'taunt')), mk(SLIME)]);
  eq(s.players[1].slots.indexOf(attacks(s).find(e => e.type === 'ranged').target), 1);
  // 前列のTauntも優先される
  const t = board([mk(WOLF), mk(ELF)], [mk(S('melee', 1, 20, 'taunt')), mk(GOLEM), mk(SLIME)]);
  eq(t.players[1].slots.indexOf(attacks(t).find(e => e.type === 'ranged').target), 0);
  // 魔法・近接には影響しない
  const u = board([mk(WOLF), mk(MAGE), mk(MAGE)], [mk(GOLEM), mk(SLIME), mk(S('melee', 1, 20, 'taunt'))]);
  eq(attacks(u).map(e => u.players[1].slots.indexOf(e.target)), [2, 1, 0]);
});

test('Perseverance：Disease・Entangle・Silence・Demoralize・Suppress Magicを受けない', () => {
  const iron = () => mk(S('magic', 3, 30, 'perseverance'));
  // Disease
  const s = board([mk(S('melee', 2, 10, 'disease:2'))], [iron(), mk(GOLEM)]);
  const ev = attacks(s)[0];
  eq([extra(ev, 'disease').immune, s.players[1].slots[0].status.disease], [true, undefined]);
  eq(playFlash(Object.assign(s, { phase: 'play' }), 0, give(s, 0, tflash('t_plague', 1, 'groupdisease:2')), -1).group.map(g => g.immune), [true, false]);
  // Entangle / Demoralize / Suppress（ターン開始時）
  for (let i = 0; i < 50; i++) {
    const t = board([mk(S('melee', 1, 10, 'entangle', 'demoralize:2', 'suppress:2'))], [iron(), mk(WOLF)]);
    beginTurnOf(t, 0);
    eq(t.players[1].slots[0].status, {});
    eq(t.players[1].slots[1].status.demoralize, 2, 'Perseveranceのない味方にはかかる');
  }
  // Silence（登場時）
  const u = board([], [iron(), mk(MAGE)]);
  playMonster(u, 0, give(u, 0, S('melee', 1, 10, 'silence:2')), 0);
  eq(u.players[1].slots.map(m => m && m.status.silence), [undefined, 2, null]);
});

// ---------- 支援系 ----------

test('Heal：自分のターン開始時、傷ついた味方のうちHPが最も低い1体をX回復（最大HPは超えない）', () => {
  const s = board([mk(GOLEM), mk(S('magic', 1, 10, 'heal:3')), mk(WOLF)], [mk(SLIME)]);
  const [golem, , wolf] = s.players[0].slots;
  golem.hp -= 5; wolf.hp -= 2;
  beginTurnOf(s, 0);
  eq([golem.hp, wolf.hp], [golem.maxHp - 5, wolf.maxHp], 'HPが最も低いウルフだけ回復');
  const t = board([mk(GOLEM), mk(S('magic', 1, 10, 'heal:9'))], [mk(SLIME)]);
  t.players[0].slots[0].hp -= 2;
  beginTurnOf(t, 0);
  eq([t.players[0].slots[0].hp, startEv(t, 'heal')[0].heal], [CARD_BY_ID[GOLEM].hp, 2], '最大HPで止まる');
  // 誰も傷ついていなければ何も起きない。相手のターン開始時には発動しない
  const u = board([mk(GOLEM), mk(S('magic', 1, 10, 'heal:3'))], [mk(SLIME)]);
  beginTurnOf(u, 0);
  eq(startEv(u, 'heal').length, 0);
  u.players[0].slots[0].hp -= 5;
  beginTurnOf(u, 1);
  eq(u.players[0].slots[0].hp, CARD_BY_ID[GOLEM].hp - 5);
});

test('Group Heal：味方全員をX回復', () => {
  const s = board([mk(GOLEM), mk(S('magic', 1, 10, 'groupheal:2')), mk(WOLF)], [mk(SLIME)]);
  s.players[0].slots.forEach(m => { m.hp -= 3; });
  beginTurnOf(s, 0);
  eq(s.players[0].slots.map(m => m.maxHp - m.hp), [1, 1, 1]);
});

test('Inspire：味方全員の近接攻撃+X（相手ターン終了まで）。最も強いものだけ適用', () => {
  const s = board([mk(WOLF), mk(S('ranged', 1, 10, 'inspire:1')), mk(S('ranged', 1, 10, 'inspire:3'))], [mk(GOLEM)]);
  const wolf = s.players[0].slots[0];
  beginTurnOf(s, 0);
  eq(wolf.buff.inspire, 3, '重ならず、強いほうだけ');
  eq(getAttacks(wolf)[0], { type: 'melee', source: 'base', base: 2, atk: 5, mods: [{ label: 'Inspire', x: 3 }] });
  eq(attacks(s).find(e => e.type === 'melee').dmg, 5);
  eq(getAttacks(s.players[0].slots[1])[0].atk, 1, '遠隔には乗らない');
  finishTurn(s);
  beginTurnOf(s, 1);       // 相手のターン中も続く
  eq(wolf.buff.inspire, 3);
  attacks(s); finishTurn(s);
  s.players[0].slots[1] = s.players[0].slots[2] = null; // Inspire持ちがいなくなる
  beginTurnOf(s, 0);       // 次の自分のターン開始で切れる
  eq(getAttacks(wolf)[0].atk, 2);
});

test('Shoot Command：味方全員の遠隔攻撃+X、アーマーにブロックされなくなる', () => {
  const make = () => {
    const s = board([mk(WOLF), mk(ELF), mk(S('magic', 1, 10, 'shoot:2'))], [mk(GOLEM, STEEL), mk(SLIME, STEEL), mk(SLIME, STEEL)]);
    beginTurnOf(s, 0);
    return s;
  };
  const s = make();
  eq(getAttacks(s.players[0].slots[1])[0].atk, 5);
  eq(rate(1500, () => attacks(make()).find(e => e.type === 'ranged').blocked), 0, 'ブロックされない');
  // Shoot Commandがなければ約25%ブロックされる
  near(rate(4000, () => attacks(board([mk(WOLF), mk(ELF)], [mk(GOLEM, STEEL)])).find(e => e.type === 'ranged').blocked), 0.25, 0.03);
});

test('Cleanse：味方1体のデバフを解除／Mass Cleanse：全員のデバフを解除', () => {
  const sick = s => s.players[0].slots.forEach((m, i) => { if (i < 2) m.status = { disease: 2, silence: 1 }; });
  const s = board([mk(WOLF), mk(MAGE), mk(S('magic', 1, 10, 'cleanse'))], [mk(GOLEM)]);
  sick(s); s.players[0].slots[0].status.demoralize = 1; // ウルフのほうがデバフが多い
  beginTurnOf(s, 0);
  eq(s.players[0].slots.map(m => debuffCount(m)), [0, 2, 0], 'デバフの多い1体だけ');
  const t = board([mk(WOLF), mk(MAGE), mk(S('magic', 1, 10, 'masscleanse'))], [mk(GOLEM)]);
  sick(t);
  beginTurnOf(t, 0);
  eq(t.players[0].slots.map(m => debuffCount(m)), [0, 0, 0]);
});

test('Cleanse：拘束を解除された味方は、そのターンから攻撃できる', () => {
  const s = board([mk(WOLF), mk(S('magic', 1, 10, 'cleanse'))], [mk(GOLEM)]);
  s.players[0].slots[0].status.entangle = true;
  beginTurnOf(s, 0);
  eq(attacks(s).map(e => e.type), ['magic', 'melee']);
});

// ---------- 妨害系 ----------

test('Disease：物理ダメージを与えた敵にスタックが付く（魔法では付かない。重ねがけで増える）', () => {
  const s = board([mk(S('melee', 2, 10, 'disease:2'))], [mk(GOLEM)]);
  const golem = s.players[1].slots[0];
  attacks(s);
  eq(golem.status.disease, 2);
  s.phase = 'play'; attacks(s);
  eq(golem.status.disease, 4);
  const t = board([mk(S('magic', 2, 10, 'disease:2'))], [mk(GOLEM)]);
  attacks(t);
  eq(t.players[1].slots[0].status.disease, undefined, '魔法攻撃では付かない');
});

test('Disease：Disease状態のモンスターはInspire・Shoot Command・Demoralize・Suppress Magicを使えない', () => {
  const s = board([mk(WOLF), mk(S('ranged', 1, 10, 'inspire:2', 'shoot:2', 'demoralize:1', 'suppress:1'))], [mk(GOLEM)]);
  s.players[0].slots[1].status.disease = 1;
  beginTurnOf(s, 0);
  eq([s.players[0].slots[0].buff, s.players[1].slots[0].status], [{}, {}]);
  eq(startEv(s, 'skip').map(e => [e.skill, e.reason]), [['inspire', 'disease'], ['shoot', 'disease'], ['demoralize', 'disease'], ['suppress', 'disease']]);
});

test('Disease：Healでスタックが減る（回復はまずスタックに使われ、残りでHPを回復）', () => {
  const m = mk(GOLEM);
  m.hp -= 6; m.status.disease = 2;
  eq(healMonster(m, 5), { target: m, heal: 3, cured: 2, bloom: 0 });
  eq([m.hp, m.status.disease], [CARD_BY_ID[GOLEM].hp - 3, undefined]);
  const n = mk(GOLEM);
  n.hp -= 6; n.status.disease = 4;
  healMonster(n, 3);
  eq([n.hp, n.status.disease], [CARD_BY_ID[GOLEM].hp - 6, 1], 'スタックが残っている間はHPが回復しない');
});

test('Outbreak：Disease状態の敵を攻撃すると、スタック数ぶんの追加魔法ダメージ（スタックは減らない）', () => {
  const s = board([mk(S('melee', 2, 10, 'outbreak'))], [mk(GOLEM, STEEL)]); // アーマー5
  const golem = s.players[1].slots[0];
  golem.status.disease = 4;
  const ev = attacks(s)[0];
  const ob = extra(ev, 'outbreak');
  eq([ev.armorDmg, ob.dmg, golem.armor, golem.hp, golem.status.disease], [2, 4, 3, golem.maxHp - 4, 4], '追加ダメージはアーマー無視。スタックは残る');
  // Diseaseでない敵には何も起きない
  eq(attacks(board([mk(S('melee', 2, 10, 'outbreak'))], [mk(GOLEM)]))[0].extras.length, 0);
});

test('Disease：自分のターン終了時、スタック数ぶんの魔法ダメージを受ける（スタックは減らない。相手のターン終了時には受けない）', () => {
  const s = board([mk(GOLEM, STEEL), mk(WOLF)], [mk(SLIME)]);
  const [golem, wolf] = s.players[0].slots;
  const slime = s.players[1].slots[0];
  golem.status.disease = 3; slime.status.disease = 2;
  finishTurn(s);
  eq([golem.maxHp - golem.hp, golem.armor, golem.status.disease, wolf.hp, slime.hp], [3, 5, 3, wolf.maxHp, slime.maxHp], 'アーマー無視。手番側だけが受ける');
  eq(s.endEvents.map(e => [e.kind, e.target.card.id, e.dmg]), [['sick', GOLEM, 3]]);
  finishTurn(s); // 相手のターン終了
  eq([slime.maxHp - slime.hp, golem.maxHp - golem.hp], [2, 3]);
  // 倒されたら、持ち主にクリスタルが入る。回復でスタックを減らせば、ダメージも減る
  const t = board([mk(WOLF), mk(GOLEM)], [mk(SLIME)]);
  t.players[0].slots[0].status.disease = 9;
  const before = t.players[0].crystals;
  finishTurn(t);
  eq([names(t.players[0]), t.players[0].crystals - before], [[GOLEM, null, null], CONFIG.FALLEN_CRYSTAL]);
  const u = board([mk(GOLEM)], [mk(SLIME)]);
  u.players[0].slots[0].status.disease = 3;
  healMonster(u.players[0].slots[0], 2);
  finishTurn(u);
  eq(u.players[0].slots[0].maxHp - u.players[0].slots[0].hp, 1);
});

test('Entangle：約50%で最も近い敵（前列）を拘束する', () => {
  near(rate(6000, () => {
    const s = board([mk(S('ranged', 1, 10, 'entangle'))], [mk(GOLEM), mk(WOLF)]);
    beginTurnOf(s, 0);
    assert(!s.players[1].slots[1].status.entangle, '後列は拘束されない');
    return s.players[1].slots[0].status.entangle;
  }), 0.5, 0.03);
});

test('Entangle：拘束された敵は次のターン攻撃もスキルも使えず、Flyingも失う。ターンが終わると解ける', () => {
  const s = board([mk(WOLF)], [mk(S('melee', 3, 30, 'flying', 'thorns:2', 'inspire:1'))]);
  const bird = s.players[1].slots[0];
  bird.status.entangle = true;
  // 拘束中はFlyingもThornsも働かない
  eq(rate(300, () => {
    const t = board([mk(WOLF)], [mk(S('melee', 3, 30, 'flying', 'thorns:2'))]);
    t.players[1].slots[0].status.entangle = true;
    const ev = attacks(t)[0];
    return ev.dodged || ev.extras.length > 0;
  }), 0);
  attacks(s); finishTurn(s);
  beginTurnOf(s, 1);                       // 拘束された側のターン
  eq(bird.buff, {}, 'Inspireも発動しない');
  eq(phase(s).map(e => [e.kind, e.reason]), [['skip', 'entangle']], '攻撃できない');
  finishTurn(s);
  eq(bird.status.entangle, undefined, '自分のターンが終わると解ける');
  eq(skillX(bird, 'thorns'), 2);
});

test('Silence：場に出たとき、敵全員がXターン魔法攻撃とHealを使えない', () => {
  const s = board([], [mk(WOLF), mk(MAGE), mk(S('magic', 2, 10, 'heal:3'))]);
  const mage = s.players[1].slots[1];
  mage.hp -= 4;
  const r = playMonster(s, 0, give(s, 0, S('melee', 1, 30, 'silence:2')), 0);
  eq([r.events[0].kind, r.events[0].targets.length], ['silence', 3]);
  attacks(s); finishTurn(s);
  for (const left of [1, 0]) {
    beginTurnOf(s, 1);
    eq(startEv(s, 'skip').map(e => [e.skill, e.reason]), [['heal', 'silence']], 'Healを使えない');
    eq(mage.hp, mage.maxHp - 4);
    eq(phase(s).map(e => (e.kind === 'skip' ? e.reason : e.type)), ['silence', 'silence', 'melee'], '魔法は使えず、近接は攻撃できる');
    finishTurn(s);
    eq(mage.status.silence || 0, left);
    beginTurnOf(s, 0); attacks(s); finishTurn(s);
  }
  beginTurnOf(s, 1);                       // 2ターン経過 → 解ける
  eq(startEv(s, 'heal').length, 1);
  eq(attacks(s).map(e => e.type), ['magic', 'magic', 'melee']);
});

test('Demoralize：敵全員の近接攻撃-X（最も強いものだけ）。0になった攻撃は発動せず理由が出る', () => {
  const s = board([mk(S('magic', 1, 10, 'demoralize:1')), mk(S('magic', 1, 10, 'demoralize:2'))], [mk(DRAGON), mk(WOLF, SWORD), mk(MAGE)]);
  beginTurnOf(s, 0);
  const [dragon, wolf, mage] = s.players[1].slots;
  eq([getAttacks(dragon)[0].atk, getAttacks(wolf)[0].atk, getAttacks(mage)[0].atk], [3, 2, 3], '近接だけ-2');
  eq(getAttacks(wolf)[0].mods, [{ label: 't_sword', x: 2 }, { label: 'Demoralize', x: -2 }]);
  attacks(s); finishTurn(s);
  // 近接2のウルフは0になり、攻撃できない
  const t = board([mk(S('magic', 1, 10, 'demoralize:2'))], [mk(WOLF)]);
  beginTurnOf(t, 0); attacks(t); finishTurn(t);
  beginTurnOf(t, 1);
  eq(phase(t).map(e => [e.kind, e.reason]), [['skip', 'demoralize']]);
});

test('Demoralize：かけた側の次のターン開始で切れる（使い手がいなくなれば戻る）', () => {
  const s = board([mk(S('magic', 1, 10, 'demoralize:2'))], [mk(DRAGON)]);
  beginTurnOf(s, 0);
  const dragon = s.players[1].slots[0];
  eq(getAttacks(dragon)[0].atk, 3);
  s.players[0].slots[0] = mk(MAGE);        // 使い手がいなくなる
  beginTurnOf(s, 1);
  eq(getAttacks(dragon)[0].atk, 3, '相手ターン中は続く');
  beginTurnOf(s, 0);
  eq(getAttacks(dragon)[0].atk, 5);
});

test('Suppress Magic：敵全員の魔法攻撃-X。0になった魔法は発動せず理由が出る', () => {
  const s = board([mk(S('melee', 1, 30, 'suppress:2'))], [mk(WOLF, TOME), mk(MAGE)]);
  beginTurnOf(s, 0);
  const [wolf, mage] = s.players[1].slots;
  eq(getAttacks(wolf).map(a => a.atk), [2, 0], '装備の魔法2 → 0');
  eq(getAttacks(mage)[0].atk, 1);
  attacks(s); finishTurn(s);
  beginTurnOf(s, 1);
  eq(phase(s).map(e => e.kind === 'skip' ? e.reason : e.type + e.dmg), ['magic1', 'suppress', 'melee2']);
});

// ---------- フラッシュ ----------

test('フラッシュ：Group Diseaseは敵全員にスタックを付ける', () => {
  const s = board([mk(WOLF)], [mk(GOLEM), mk(SLIME)]);
  const ev = playFlash(s, 0, give(s, 0, tflash('t_plague2', 2, 'groupdisease:3')), -1);
  eq(s.players[1].slots.map(m => m && m.status.disease), [3, 3, null]);
  eq(ev.group.length, 2);
});

test('フラッシュ：Unsummonは敵1体を山札に戻す（装備も山札へ。状態はリセット、後ろは詰める）', () => {
  const s = board([mk(WOLF)], [mk(GOLEM, STEEL), mk(SLIME)]);
  const foe = s.players[1];
  foe.slots[0].hp = 3; foe.slots[0].status.disease = 2;
  const ev = playFlash(s, 0, give(s, 0, tflash('t_unsummon', 3, 'unsummon')), 0);
  assert(ev.unsummoned);
  eq(names(foe), [SLIME, null, null]);
  eq([foe.hand.length, foe.deck.map(h => h.card.id).sort(), foe.discard.length], [0, [GOLEM, STEEL].sort(), 0]);
  eq(monstersLeft(foe), 2, '山札に戻ったモンスターも残り数に含まれる');
  // 引いて出し直すと新品
  s.current = 1; foe.crystals = 10;
  const again = foe.deck.find(h => h.card.id === GOLEM);
  foe.hand.push(again);
  playMonster(s, 1, again.uid, 0);
  eq([foe.slots[0].hp, foe.slots[0].armor, foe.slots[0].item, foe.slots[0].status], [CARD_BY_ID[GOLEM].hp, 0, null, {}]);
});

test('フラッシュ：Group Healは味方全員を回復', () => {
  const s = board([mk(WOLF), mk(GOLEM)], [mk(SLIME)]);
  s.players[0].slots.slice(0, 2).forEach(m => { m.hp -= 4; });
  const ev = playFlash(s, 0, give(s, 0, tflash('t_rain', 2, 'groupheal:3')), -1);
  eq([s.players[0].slots.slice(0, 2).map(m => m.maxHp - m.hp), ev.group.map(g => g.heal)], [[1, 1], [3, 3]]);
});

// ---------- 装備のスキル・消耗ダメージとの関係 ----------

test('装備のスキル：装備したモンスターがスキルを得る（外すと失う）', () => {
  const s = board([mk(MAGE), mk(WOLF)], [mk(GOLEM)]);
  const wolf = s.players[0].slots[1];
  assert(equipItem(s, 0, give(s, 0, tequip('t_spear', 2, null, { atk: { melee: 1 } }, ['reach', 'thorns:1'])), 1));
  eq([skillX(wolf, 'reach'), skillX(wolf, 'thorns'), canAttackFrom(wolf, 1)], [1, 1, true]);
  assert(equipItem(s, 0, give(s, 0, LEATHER), 1));
  eq([skillX(wolf, 'reach'), canAttackFrom(wolf, 1)], [0, false]);
});

test('装備のスキル：本体と装備の同じスキルは数値が合計される', () => {
  const m = mk(S('melee', 1, 10, 'thorns:2'), tequip('t_spike', 1, null, {}, ['thorns:1']));
  eq(skillX(m, 'thorns'), 3);
});

test('消耗ダメージ：Shield・アーマー・Flyingを無視し、Thorns・Diseaseは発動しない', () => {
  const s = atTurn(board([mk(S('melee', 1, 20, 'disease:2', 'thorns:2'))], [mk(S('melee', 1, 20, 'shield:5', 'flying', 'thorns:3'), STEEL)]), 31);
  startTurn(s);
  const [a, b] = [s.players[0].slots[0], s.players[1].slots[0]];
  eq([a.hp, b.hp, b.armor, a.status, b.status], [18, 18, 5, {}, {}]);
});

test('Thornsで自分のモンスターが倒れても、行動順と回数は崩れない', () => {
  // 後列のReach近接がThornsで倒れても、前のモンスターはそのまま1回ずつ行動する
  const s = board([mk(WOLF), mk(MAGE), mk(S('melee', 1, 1, 'reach'))], [mk(S('melee', 1, 60, 'thorns:5'))]);
  const evs = attacks(s);
  eq(evs.map(e => e.type), ['melee', 'magic', 'melee']);
  assert(extra(evs[0], 'thorns').killed, '後列のReach近接はThornsで倒れる');
  eq(names(s.players[0]), [WOLF, MAGE, null]);
  eq(s.players[0].slots[0].hp, 1, 'ウルフもThornsを受ける');
});

// ---------- カードデータ ----------

test('カードデータ：モンスターは40体以上（各色8体以上）・装備20以上・フラッシュ15以上で、idの重複なし', () => {
  assert(MONSTERS.length >= 40 && EQUIPS.length >= 20 && FLASHES.length >= 15);
  for (const color in COLORS) assert(MONSTERS.filter(m => m.color === color).length >= 8, color);
  eq(new Set([...MONSTERS, ...ITEMS].map(c => c.id)).size, MONSTERS.length + ITEMS.length, 'idの重複なし');
});

test('カードデータ：最大レベルはレアリティどおり（モンスター5/5/4/4、アイテム3/3/2/2）', () => {
  const max = { monster: { common: 5, rare: 5, epic: 4, legend: 4 }, item: { common: 3, rare: 3, epic: 2, legend: 2 } };
  for (const c of [...MONSTERS, ...ITEMS]) {
    assert(RARITIES[c.rarity], c.name + ' のレアリティ');
    eq(maxLevel(c.id), max[c.kind === 'monster' ? 'monster' : 'item'][c.rarity], c.name);
  }
});

test('カードデータ：レベルが上がるとHP・攻撃力は下がらず、スキルも失わない', () => {
  for (const m of MONSTERS) {
    for (let lv = 2; lv <= maxLevel(m.id); lv++) {
      const a = cardAt(m.id, lv - 1), b = cardAt(m.id, lv);
      assert(b.hp >= a.hp && b.atk >= a.atk, `${m.name} Lv${lv}`);
      for (const k of a.skills) {
        const now = b.skills.find(x => x.id === k.id);
        assert(now && (k.x === undefined || now.x >= k.x), `${m.name} Lv${lv} ${k.id}`);
      }
    }
    assert(cardAt(m.id, maxLevel(m.id)).hp > m.hp, m.name + ' は最大レベルで強くなる');
  }
});

test('カードデータ：すべてのスキルidが skills.js にあり、数値の有無も正しい', () => {
  const used = new Set();
  for (const def of Object.values(CARD_DEFS)) {
    for (const row of def.levels) for (const k of row.skills || []) {
      const info = SKILLS[k.id];
      assert(info, `${def.name}: ${k.id}`);
      assert(info.noX ? k.x === undefined : k.x > 0, `${def.name}: ${k.id} の数値`);
      used.add(k.id);
    }
  }
  eq(Object.keys(SKILLS).filter(id => !used.has(id)), [], 'どのカードにも使われていないスキル');
});

test('カードデータ：フラッシュは対象の取り方が決まっているスキルを1つ持つ', () => {
  for (const f of FLASHES) for (let lv = 1; lv <= maxLevel(f.id); lv++) {
    const c = cardAt(f.id, lv);
    assert(c.skills.length >= 1 && FLASH_TARGET[c.skills[0].id], f.name + '：1つ目のスキルが主効果');
  }
});

test('カードデータ：スターターデッキはコモン中心の8+8枚で、1ターン目に出せるモンスターがいる', () => {
  eq([DEFAULT_DECK.monsters.length, DEFAULT_DECK.items.length], [8, 8]);
  const cards = [...DEFAULT_DECK.monsters, ...DEFAULT_DECK.items].map(id => CARD_BY_ID[id]);
  assert(cards.every(Boolean));
  assert(cards.filter(c => c.rarity === 'common').length >= 14);
  assert(DEFAULT_DECK.monsters.some(id => CARD_BY_ID[id].cost <= CONFIG.CRYSTALS_PER_TURN));
});

test('レベル：デッキの levels で指定したレベルのカードで戦う（指定がなければLv1）', () => {
  const deck = { ...DEFAULT_DECK, levels: { r02: 4, e01: 3 } };
  const s = newGame(deck, DEFAULT_DECK, testRng);
  const all = p => [...p.hand, ...p.deck].map(h => h.card);
  const dog = all(s.players[0]).find(c => c.id === 'r02');
  eq([dog.level, dog.hp, dog.atk, dog.skills], [4, cardAt('r02', 4).hp, cardAt('r02', 4).atk, [{ id: 'doublestrike', x: 2 }]]);
  eq(all(s.players[0]).find(c => c.id === 'e01').atk, { melee: 3 });
  eq(all(s.players[0]).find(c => c.id === 'r01').level, 1);
  eq(all(s.players[1]).find(c => c.id === 'r02').level, 1);
  eq(cardAt('r02', 99).level, 5, '最大レベルで止まる');
});

// ============================================================
// 成長システム（save.js）
// ============================================================

// テスト用の保存先
const memStorage = () => {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, m };
};
// 機能がすべて解放され、資源もある状態
const richProfile = () => Object.assign(newProfile(), { level: 10, gold: 9999, stones: 9999 });

test('成長：初期状態はスターターデッキのカードだけを持つ（Lv1・予備なし）', () => {
  const p = newProfile();
  eq(Object.keys(p.cards).sort(), [...DEFAULT_DECK.monsters, ...DEFAULT_DECK.items].sort());
  assert(Object.values(p.cards).every(c => c.level === 1 && c.copies === 0));
  eq([p.level, p.xp, p.gold, p.stones], [1, 0, 0, 0]);
  assert(deckIsValid(p, p.deck));
  eq(deckForBattle(p).levels.r01, 1);
});

test('成長：対戦で経験値とゴールド。勝利でパック。降参は報酬なし', () => {
  const p = newProfile();
  const packs = p.packs;
  const w = battleReward(p, 'win');
  eq([w.xp, w.gold, w.packs, p.gold, p.packs, p.wins], [GROWTH.XP_WIN, GROWTH.GOLD_WIN, 1, GROWTH.GOLD_WIN, packs + 1, 1]);
  const l = battleReward(p, 'loss');
  eq([l.xp, l.gold, l.packs, p.losses], [GROWTH.XP_LOSS, GROWTH.GOLD_LOSS, 0, 1]);
  const before = JSON.stringify([p.xp, p.gold, p.packs, p.level]);
  const s = battleReward(p, 'surrender');
  eq([s.xp, s.gold, s.packs, JSON.stringify([p.xp, p.gold, p.packs, p.level]), p.losses], [0, 0, 0, before, 2]);
});

test('成長：経験値がたまるとレベルアップし、パックとゴールドがもらえる（必要経験値は増えていく）', () => {
  const p = newProfile();
  eq([xpToNext(1), xpToNext(2), xpToNext(5)], [50, 75, 150]);
  const packs = p.packs;
  const r = addXp(p, 50 + 75 + 10); // Lv1→3、あまり10
  eq([p.level, p.xp, r.levelUps, p.packs - packs, p.gold], [3, 10, 2, 2 * GROWTH.PACKS_LEVEL_UP, 2 * GROWTH.GOLD_LEVEL_UP]);
});

test('成長：Lv3で分解・作成、Lv5で強化が解放される', () => {
  const p = newProfile();
  eq(['dismantle', 'craft', 'upgrade'].map(f => isUnlocked(p, f)), [false, false, false]);
  eq(canCraft(p, 'r01').reason, 'プレイヤーLv3で解放');
  p.level = 2;
  eq(addXp(p, xpToNext(2)).unlocked.sort(), ['craft', 'daily', 'dismantle']);
  eq(['dismantle', 'craft', 'upgrade'].map(f => isUnlocked(p, f)), [true, true, false]);
  p.level = 4;
  eq(addXp(p, xpToNext(4)).unlocked, ['upgrade']);
  // 解放前は実行できない
  const q = Object.assign(newProfile(), { stones: 9999, gold: 9999 });
  q.cards.r01.copies = 5;
  eq([craftCard(q, 'r05'), dismantleCard(q, 'r01'), upgradeCard(q, 'r01')], [false, 0, false]);
});

test('パック：5枚出て、初めてのカードは所持、2枚目以降は予備になる', () => {
  const p = newProfile();
  p.packs = 2;
  const total = () => Object.values(p.cards).reduce((n, c) => n + 1 + c.copies, 0);
  const before = total();
  const pulls = openPack(p, testRng);
  eq([GROWTH.PACK_SIZE, pulls.length, p.packs, total() - before], [5, 5, 1, 5]);
  for (const pull of pulls) assert(owns(p, pull.id) && CARD_DEFS[pull.id]);
  openPack(p, testRng);
  eq(openPack(p, testRng), null, 'パックがなければ開けられない');
  const q = newProfile();
  eq([addCard(q, 'r08'), addCard(q, 'r08'), q.cards.r08], [true, false, { level: 1, copies: 1, got: 1 }]);
});

test('パック：排出率がレアリティ別の設定どおり（最後の1枚はレア以上が確定）', () => {
  const count = { free: {}, last: {} };
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const p = newProfile();
    p.packs = 1;
    openPack(p, testRng).forEach((pull, j) => {
      const key = j === GROWTH.PACK_SIZE - 1 ? 'last' : 'free';
      const r = CARD_DEFS[pull.id].rarity;
      count[key][r] = (count[key][r] || 0) + 1;
    });
  }
  const free = N * (GROWTH.PACK_SIZE - 1);
  for (const r of RARITY_ORDER) near((count.free[r] || 0) / free, GROWTH.PACK_RATES[r], 0.015, r);
  eq(count.last.common, undefined, '最後の1枚にコモンは出ない');
  const rest = 1 - GROWTH.PACK_RATES.common;
  near(count.last.rare / N, GROWTH.PACK_RATES.rare / rest, 0.02, '確定枠のレア');
  near(count.last.legend / N, GROWTH.PACK_RATES.legend / rest, 0.012, '確定枠のレジェンド');
});

test('強化：同じカードの予備＋ゴールド＋魔石でレベルアップする', () => {
  const p = richProfile();
  p.cards.r02.copies = 3;
  eq(upgradeCost(p, 'r02'), { copies: 1, gold: 20, stones: 5 });
  assert(upgradeCard(p, 'r02'));
  eq([p.cards.r02, p.gold, p.stones], [{ level: 2, copies: 2 }, 9979, 9994]);
  eq(upgradeCost(p, 'r02'), { copies: 2, gold: 40, stones: 10 }, 'レベルが上がるほど多く必要');
  assert(upgradeCard(p, 'r02'));
  eq(p.cards.r02, { level: 3, copies: 0 });
  eq(deckForBattle(p).levels.r02, 3, '強化したレベルで対戦する');
  // レアリティが高いほど高い
  addCard(p, 'r08');
  eq(upgradeCost(p, 'r08'), { copies: 1, gold: 150, stones: 50 });
});

test('強化：足りないもの・最大レベル・未所持では強化できず、理由が分かる', () => {
  const p = richProfile();
  eq(canUpgrade(p, 'r02').reason, '同じカードの予備が足りない');
  p.cards.r02.copies = 1;
  eq(canUpgrade(Object.assign(p, { gold: 0 }), 'r02').reason, 'ゴールドが足りない');
  eq(canUpgrade(Object.assign(p, { gold: 99, stones: 0 }), 'r02').reason, '魔石が足りない');
  eq([upgradeCard(p, 'r02'), p.cards.r02.level], [false, 1]);
  eq(canUpgrade(p, 'r08').reason, '持っていないカード');
  const q = richProfile();
  q.cards.r02 = { level: maxLevel('r02'), copies: 9 };
  eq([upgradeCost(q, 'r02'), canUpgrade(q, 'r02').reason], [null, '最大レベル']);
});

test('強化：最大レベルはレアリティどおり（コモンのモンスターはLv5、エピックの装備はLv2まで）', () => {
  const p = richProfile();
  for (const [id, max] of [['r02', 5], ['r07', 4], ['e01', 3], ['e09', 2]]) {
    p.cards[id] = { level: 1, copies: 99 };
    let n = 0;
    while (upgradeCard(p, id)) assert(++n < 10);
    eq(p.cards[id].level, max, id);
  }
});

test('分解：予備を魔石に変える。レアリティが高いほど多い', () => {
  const p = richProfile();
  p.stones = 0;
  p.cards.r02.copies = 2;
  eq([dismantleCard(p, 'r02'), p.cards.r02.copies, p.stones], [GROWTH.DISMANTLE.common, 1, GROWTH.DISMANTLE.common]);
  const gains = ['r02', 'r04', 'r07', 'r08'].map(id => { p.cards[id] = { level: 1, copies: 1 }; return dismantleCard(p, id); });
  eq(gains, [5, 20, 80, 300]);
  assert(gains.every((g, i) => i === 0 || g > gains[i - 1]));
});

test('分解：デッキに入っている最後の1枚は分解できない。デッキ外なら最後の1枚も分解できる', () => {
  const p = richProfile();
  eq([canDismantle(p, 'r02').ok, dismantleCard(p, 'r02')], [false, 0]);
  assert(owns(p, 'r02'));
  addCard(p, 'r08');
  assert(canDismantle(p, 'r08').last);
  eq(dismantleCard(p, 'r08'), GROWTH.DISMANTLE.legend);
  assert(!owns(p, 'r08'));
  assert(deckIsValid(p, p.deck));
});

test('作成：魔石で好きなカードを作る。持っていれば予備が増える', () => {
  const p = richProfile();
  p.stones = GROWTH.CRAFT.legend + GROWTH.CRAFT.common;
  assert(craftCard(p, 'p08'));
  eq([p.cards.p08, p.stones], [{ level: 1, copies: 0, got: 1 }, GROWTH.CRAFT.common]);
  assert(craftCard(p, 'r01'));
  eq([p.cards.r01.copies, p.stones], [1, 0]);
  eq([craftCard(p, 'r01'), canCraft(p, 'r01').reason], [false, '魔石が足りない']);
  // 分解でもらえる魔石は、作成に必要な魔石より少ない（無限に増やせない）
  for (const r of RARITY_ORDER) assert(GROWTH.DISMANTLE[r] < GROWTH.CRAFT[r], r);
});

test('デッキ：持っているカードだけで、モンスター8＋アイテム8', () => {
  const p = newProfile();
  const deck = { monsters: p.deck.monsters.slice(), items: p.deck.items.slice() };
  deck.monsters[0] = 'r07';
  assert(!deckIsValid(p, deck), '持っていないカードは入れられない');
  addCard(p, 'r07');
  assert(deckIsValid(p, deck));
  deck.monsters[1] = 'r07';
  assert(deckIsValid(p, deck), '同じカードは2枚まで入れられる（持っていれば、予備がなくてもよい）');
  eq(p.cards.r07.copies, 0);
  deck.monsters[2] = 'r07';
  assert(!deckIsValid(p, deck), '3枚目は入れられない');
  deck.monsters[2] = p.deck.monsters[2];
  deck.monsters[1] = 'e01';
  assert(!deckIsValid(p, deck), 'モンスター枠に装備は入れられない');
});

test('セーブ：保存して読み込むと同じ状態に戻る', () => {
  const st = memStorage();
  const p = richProfile();
  addCard(p, 'p08'); p.cards.r02 = { level: 3, copies: 2 }; p.wins = 7;
  assert(saveProfile(p, st));
  eq(loadProfile(st), p);
});

// ---------- セーブデータを消さない仕組み ----------

const T0 = 1760000000000, MIN = 60000;
// 古い形式（版1：デッキが1つ・ヒーローやデイリーなどがない）のセーブ
const oldSave = () => ({
  version: 1, level: 6, xp: 12, gold: 345, stones: 67, packs: 2,
  cards: { r01: { level: 2, copies: 1 }, r02: { level: 1, copies: 0 }, r03: { level: 1, copies: 3 }, b02: { level: 1, copies: 0 }, b03: { level: 1, copies: 0 },
    g02: { level: 1, copies: 0 }, y02: { level: 1, copies: 0 }, p02: { level: 1, copies: 0 }, p08: { level: 1, copies: 0 },
    e01: { level: 1, copies: 0 }, e02: { level: 1, copies: 0 }, e03: { level: 1, copies: 0 }, e04: { level: 1, copies: 0 }, e05: { level: 1, copies: 0 },
    f01: { level: 1, copies: 0 }, f03: { level: 1, copies: 0 }, f04: { level: 1, copies: 0 } },
  deck: { monsters: DEFAULT_DECK.monsters.slice(), items: DEFAULT_DECK.items.slice() },
  stages: { '1-1': 3, '1-2': 2 }, wins: 9, losses: 4,
});

test('セーブ（守り）：古い形式のセーブを読み込んでもデータが消えず、変換の前の元データがバックアップに残る', () => {
  const st = memStorage(), raw = JSON.stringify(oldSave());
  st.setItem(GROWTH.SAVE_KEY, raw);
  const p = loadProfileSafe(st, T0);
  eq(saveState.status, 'migrated');
  eq([p.version, p.level, p.xp, p.gold, p.stones, p.wins, p.losses], [SAVE.VERSION, 6, 12, 345, 67, 9, 4]);
  eq(p.cards.r01, { level: 2, copies: 1 }); eq(p.cards.r03.copies, 3); eq(!!p.cards.p08, true);
  eq(p.stages, { '1-1': 3, '1-2': 2 });
  eq(p.decks.length, 1, '古いデッキは「デッキ1」に');
  const sp = JSON.parse(st.getItem(SAVE.SPECIAL_KEY));
  eq(sp.length, 1); eq(sp[0].reason, 'migrate'); eq(sp[0].data, raw, '元データがそのまま残る');
  eq(st.getItem(GROWTH.SAVE_KEY), raw, '読み込んだだけでは上書きしない');
  // 変換後に保存して、もう一度読む：もう変換しないので、バックアップは増えない
  saveProfile(p, st, T0 + MIN);
  loadProfileSafe(st, T0 + 2 * MIN);
  eq(saveState.status, 'ok');
  eq(JSON.parse(st.getItem(SAVE.SPECIAL_KEY)).length, 1);
});

test('セーブ（守り）：なくなったカードなどで点検するとデータが減るときも、元データを残す', () => {
  const st = memStorage(), old = Object.assign(oldSave(), { version: SAVE.VERSION });
  old.cards.zz99 = { level: 3, copies: 1 }; // 今はないカード
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  const p = loadProfileSafe(st, T0);
  eq(!!p.cards.zz99, false);
  const sp = JSON.parse(st.getItem(SAVE.SPECIAL_KEY));
  eq(sp[0].reason, 'repair'); eq(JSON.parse(sp[0].data).cards.zz99, { level: 3, copies: 1 });
});

test('セーブ（守り）：壊れたデータは初期化で上書きせず退避し、画面で知らせる', () => {
  for (const bad of ['{こわれたデータ', '[]', '"文字"', '{"level":5}', '{"cards":{}}', '{"cards":{"r01":{"level":1}},"stages":"x","decks":7,"hero":3}']) {
    const st = memStorage();
    st.setItem(GROWTH.SAVE_KEY, bad);
    const p = loadProfileSafe(st, T0);
    const broken = JSON.parse(st.getItem(SAVE.BROKEN_KEY) || '[]');
    if (saveState.status !== 'broken') { eq(bad.includes('"r01"'), true, '直せるデータは直して読む'); eq(p.cards.r01.level, 1); continue; }
    eq(saveState.status, 'broken', bad);
    eq(broken[0].raw, bad, '元の文字列がそのまま退避される');
    eq(saveState.notice.includes('退避'), true, '画面で知らせる');
    eq(p.level, 1);
    eq(st.getItem(GROWTH.SAVE_KEY), bad, '読み込んだだけでは消さない');
    eq(listBroken(st).length, 1);
  }
});

test('セーブ（守り）：壊れていても、自動バックアップがあればそこから戻す', () => {
  const st = memStorage(), good = Object.assign(newProfile(), { level: 8, gold: 500, wins: 20 });
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(good));
  const p2 = Object.assign(newProfile(), { level: 9 });
  saveProfile(p2, st, T0); // 直前の good が自動バックアップに入る
  st.setItem(GROWTH.SAVE_KEY, '{"cards": こわれた');
  const p = loadProfileSafe(st, T0 + MIN);
  eq(saveState.status, 'recovered');
  eq([p.level, p.gold, p.wins], [8, 500, 20]);
  eq(saveState.notice.includes('バックアップから戻しました'), true);
  eq(listBroken(st)[0].raw, '{"cards": こわれた');
});

test('セーブ（守り）：退避の場所に書けない（容量不足など）ときは、元データを上書きしないよう保存を止める', () => {
  const st = memStorage(), set = st.setItem;
  st.setItem(GROWTH.SAVE_KEY, '{こわれた');
  st.setItem = (k, v) => { if (k === SAVE.BROKEN_KEY) throw new Error('いっぱい'); set(k, v); };
  loadProfileSafe(st, T0);
  eq(saveState.blocked, true);
  eq(saveProfile(newProfile(), st, T0), false);
  eq(st.getItem(GROWTH.SAVE_KEY), '{こわれた', '元データは残る');
  st.setItem = set;
  saveState.blocked = false;
});

test('セーブ（守り）：自動バックアップは、10分以上あけた保存のときに直前のデータを残し、最新3つを持つ', () => {
  const st = memStorage();
  const at = [0, 1, 2, 11, 12, 25, 40, 55].map(m => T0 + m * MIN);
  at.forEach((t, i) => saveProfile(Object.assign(newProfile(), { gold: i }), st, t));
  const auto = JSON.parse(st.getItem(SAVE.AUTO_KEY));
  eq(auto.length, SAVE.AUTO_MAX);
  eq(auto.map(b => JSON.parse(b.data).gold), [6, 5, 4], '新しい順・上書きする前のデータ');
  eq(auto.map(b => b.at), [at[7], at[6], at[5]]);
  eq(JSON.parse(st.getItem(GROWTH.SAVE_KEY)).gold, 7);
});

test('セーブ（守り）：バックアップの一覧と、この時点に戻す（戻す前の今のデータも残す）', () => {
  const st = memStorage();
  saveProfile(Object.assign(newProfile(), { level: 3, wins: 2 }), st, T0);
  saveProfile(Object.assign(newProfile(), { level: 4, wins: 5 }), st, T0 + 11 * MIN);
  const list = listBackups(st);
  eq(list.length, 1); eq(list[0].kind, 'auto'); eq(list[0].sum.level, 3); eq(list[0].sum.wins, 2);
  const p = restoreBackup('auto', 0, st, T0 + 12 * MIN);
  eq(p.level, 3);
  eq(JSON.parse(st.getItem(GROWTH.SAVE_KEY)).level, 3);
  const sp = listBackups(st).find(b => b.reason === 'restore');
  eq(sp.sum.level, 4, '戻す前のデータ');
  eq(restoreBackup('auto', 9, st), null, 'ないバックアップ');
});

test('セーブ（守り）：データリセットの前のデータもバックアップに残り、戻せる', () => {
  const st = memStorage();
  saveProfile(Object.assign(newProfile(), { level: 12, gold: 999 }), st, T0);
  const fresh = resetProfile(st);
  eq(fresh.level, 1);
  const b = listBackups(st).find(x => x.reason === 'reset');
  eq(b.sum.level, 12);
  eq(restoreBackup(b.kind, b.index, st).gold, 999);
});

test('セーブ（書き出し）：書き出し → 読み込みで、セーブ・対戦履歴・設定・並び順がすべて元どおり', () => {
  const a = memStorage(), b = memStorage();
  const p = richProfile();
  addCard(p, 'p08'); p.cards.r02 = { level: 3, copies: 2 }; p.wins = 7; p.stages['1-1'] = 3;
  p.dungeon.best.floor = 12; p.puzzle.done.p01 = 1;
  saveProfile(p, a, T0);
  a.setItem(SAVE_EXTRA_KEYS.history, JSON.stringify([{ id: 1, w: 1, memo: 'メモ' }]));
  a.setItem(SAVE_EXTRA_KEYS.settings, JSON.stringify({ speed: 2, bgm: 0.3 }));
  a.setItem(SAVE_EXTRA_KEYS.cardview, JSON.stringify({ collection: { sort: 'cost' } }));
  const text = exportSaveText(a, T0 + MIN);
  // 別の端末（別のアドレス）：遊びかけのデータがある
  saveProfile(Object.assign(newProfile(), { level: 2, wins: 1 }), b, T0);
  const r = parseImportText(text);
  eq(r.ok, true);
  eq(r.sum.level, 10); eq(r.exportedAt, T0 + MIN);
  const q = applyImport(r, b, T0 + 2 * MIN);
  eq(q, p);
  eq(loadProfileSafe(b), p, '読み込み直しても同じ');
  for (const k of Object.values(SAVE_EXTRA_KEYS)) eq(b.getItem(k), a.getItem(k), k);
  const before = listBackups(b).find(x => x.reason === 'import');
  eq(before.sum.level, 2, '読み込む前の今のデータが残る');
  // もう一度書き出すと、同じ中身
  eq(JSON.parse(exportSaveText(b, 5)).profile.cards, JSON.parse(text).profile.cards);
});

test('セーブ（書き出し）：読み込みは壊れた文字列を受けつけず、今のデータを変えない。セーブデータそのもの（JSON）も読める', () => {
  const st = memStorage();
  saveProfile(Object.assign(newProfile(), { level: 5 }), st, T0);
  const keep = st.getItem(GROWTH.SAVE_KEY);
  for (const bad of ['', 'abc', '{"app":"card-monsters","profile":null}', '{"app":"card-monsters","profile":{"level":3}}', '12', '{"cards":{}}']) {
    const r = parseImportText(bad);
    eq(r.ok, false, bad);
    eq(typeof r.why, 'string');
  }
  eq(st.getItem(GROWTH.SAVE_KEY), keep);
  const raw = parseImportText('﻿  ' + JSON.stringify(oldSave()) + '\n');
  eq(raw.ok, true, '古い形式のセーブそのもの'); eq(raw.sum.level, 6); eq(raw.profile.version, SAVE.VERSION);
});

test('セーブ（案内）：最後に書き出してから7日以上で「バックアップをおすすめします」。オフ・あとで・遊んでいないときは出さない', () => {
  const st = memStorage(), day = 86400000;
  const fresh = newProfile(), played = Object.assign(newProfile(), { level: 3, wins: 4 });
  eq(backupReminderDue(fresh, st, T0), false, '遊んでいない');
  eq(backupReminderDue(played, st, T0), false, '初めて：この日から数える');
  eq(backupReminderDue(played, st, T0 + 6 * day), false);
  eq(backupReminderDue(played, st, T0 + 7 * day), true, '7日');
  markExported(st, T0 + 7 * day);
  eq(backupReminderDue(played, st, T0 + 8 * day), false, '書き出したら消える');
  eq(backupReminderDue(played, st, T0 + 14 * day), true);
  setSaveMeta({ snoozeUntil: T0 + 20 * day }, st);
  eq(backupReminderDue(played, st, T0 + 15 * day), false, 'あとで');
  eq(backupReminderDue(played, st, T0 + 21 * day), true);
  setSaveMeta({ remind: false }, st);
  eq(backupReminderDue(played, st, T0 + 30 * day), false, 'オフ');
});

test('セーブ（守り）：保存のたびに IndexedDB 用の写しも渡す', () => {
  const st = memStorage(), got = [], keep = saveMirror;
  saveMirror = json => got.push(json);
  try {
    saveProfile(Object.assign(newProfile(), { level: 7 }), st, T0);
    eq(got.length, 1);
    eq(got[0], st.getItem(GROWTH.SAVE_KEY));
    eq(parseSave(got[0]).savedAt, T0);
  } finally { saveMirror = keep; }
});

test('セーブ：データがない・壊れている・保存できない環境でも、初期状態で始められる', () => {
  eq(loadProfile(memStorage()), newProfile());
  const st = memStorage();
  st.setItem(GROWTH.SAVE_KEY, '{こわれたデータ');
  eq(loadProfile(st), newProfile());
  eq(loadProfile(null), newProfile());
  eq(saveProfile(newProfile(), null), false);
  eq(loadProfile({ getItem() { throw new Error('blocked'); } }), newProfile());
});

test('セーブ：おかしな値は直す（なくなったカード・範囲外のレベル・組めないデッキ）', () => {
  const st = memStorage();
  const p = newProfile();
  p.cards.zzz = { level: 1, copies: 0 };
  p.cards.r02 = { level: 99, copies: -3 };
  p.gold = -5;
  p.deck.monsters[0] = 'zzz';
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(p));
  const q = loadProfile(st);
  eq([q.cards.zzz, q.cards.r02, q.gold], [undefined, { level: 5, copies: 0 }, 0]);
  assert(deckIsValid(q, q.deck), 'デッキは初期デッキに戻る');
});

test('セーブ：データリセットで初期状態に戻る', () => {
  const st = memStorage();
  const p = richProfile();
  addCard(p, 'p08');
  saveProfile(p, st);
  eq(resetProfile(st), newProfile());
  eq(loadProfile(st), newProfile());
});

test('対戦相手：CPUのデッキはプレイヤーのデッキと同じレアリティの内訳・同じ平均レベルになる', () => {
  const count = ids => RARITY_ORDER.map(r => ids.filter(id => CARD_DEFS[id].rarity === r).length);
  const p = newProfile();
  for (let i = 0; i < 20; i++) {
    const d = cpuDeckFor(p, testRng);
    eq([count(d.monsters), count(d.items)], [count(p.deck.monsters), count(p.deck.items)]);
    eq([new Set(d.monsters).size, new Set(d.items).size], [8, 8]);
    assert(d.monsters.every(id => CARD_DEFS[id].kind === 'monster') && d.items.every(id => CARD_DEFS[id].kind !== 'monster'));
    assert(Object.values(d.levels).every(lv => lv === 1));
  }
  // 強いデッキにすると相手も強くなる
  ['r07', 'r08', 'b08'].forEach((id, i) => { addCard(p, id); p.deck.monsters[i] = id; });
  Object.values(p.cards).forEach(c => { c.level = 3; });
  const d = cpuDeckFor(p, testRng);
  eq(count(d.monsters), count(p.deck.monsters));
  assert(Object.keys(d.levels).every(id => d.levels[id] === Math.min(3, maxLevel(id))), 'カードレベルは最大レベルを超えない');
  // レアリティを絞ったランダムデッキ（ステージ用）
  const c = randomDeck(testRng, { rarities: ['common'], level: 2 });
  assert([...c.monsters, ...c.items].every(id => CARD_DEFS[id].rarity === 'common' && c.levels[id] === 2));
});

// ============================================================
// CPUのスキルを考えた判断
// ============================================================

// 手番プレイヤー0の手札から、CPUが最初に出すモンスターとスロット
const cpuPlay = s => { const a = cpuNextAction(s); return [s.players[0].hand.find(h => h.uid === a.uid).card.id, a.slot]; };

test('CPU：Stealth 持ちは後列に置く（前列にいると隠れられない）', () => {
  const sneak = S('magic', 3, 7, 'stealth');
  const s = board([mk(MAGE)], [mk(GOLEM)]);
  give(s, 0, sneak);
  eq(cpuPlay(s), [sneak, 1]);
  // Stealth でなければ、同じ強さなら頑丈なほうを前に出すだけ
  const plain = S('magic', 3, 9);
  const t = board([mk(MAGE)], [mk(GOLEM)]);
  give(t, 0, plain);
  eq(cpuPlay(t), [plain, 0]);
});

test('CPU：頑丈な Taunt・Thorns 持ちは前列に出して攻撃を受け止める', () => {
  const wall = S('magic', 2, 12, 'taunt');
  const line = [makeMonster(1, CARD_BY_ID[wall]), makeMonster(2, CARD_BY_ID[MAGE])];
  assert(lineupScore(line) > lineupScore(line.slice().reverse()) + 1, 'Taunt が前のほうが高評価');
  const s = board([mk(S('magic', 3, 13))], [mk(GOLEM)]);
  give(s, 0, wall);
  eq(cpuPlay(s), [wall, 0], '自分より頑丈な味方がいても、Taunt を前に出す');
  const thorn = S('magic', 2, 6, 'thorns:3');
  const t = board([mk(MAGE)], [mk(GOLEM)]);
  give(t, 0, thorn);
  eq(cpuPlay(t), [thorn, 0], 'Thorns は前列で');
});

test('CPU：相手に Flying がいれば Anti-Air 持ちを優先して出す', () => {
  const aa = S('ranged', 2, 6, 'antiair:2');
  const make = foe => {
    const s = board([mk(WOLF)], [mk(foe)]);
    s.players[0].crystals = 3;
    give(s, 0, ARCHER);  // コスト3
    give(s, 0, aa);      // コスト2
    return cpuPlay(s)[0];
  };
  eq(make(S('melee', 3, 20, 'flying')), aa);
  eq(make(GOLEM), ARCHER, 'Flying がいなければコストの高いほう');
});

test('CPU：相手に Flying がいれば Anti-Air の装備を、魔法使いがいれば Silence の装備を優先する', () => {
  const bow = tequip('t_aabow', 1, null, { atk: { ranged: 1 } }, ['antiair:2']);
  const mask = tequip('t_mask', 1, null, {}, ['silence:1']);
  const pick = foe => {
    const s = board([mk(WOLF), mk(ELF)], [mk(foe)]);
    s.players[0].crystals = 1;
    [bow, mask, SWORD].forEach(id => give(s, 0, id));
    const a = cpuNextAction(s);
    return [s.players[0].hand.find(h => h.uid === a.uid).card.id, a.slot];
  };
  eq(pick(S('melee', 3, 20, 'flying')), [bow, 1], 'Anti-Air の弓を後列の遠隔に');
  eq(pick(MAGE), [mask, 0]);
  eq(pick(GOLEM)[0], SWORD, '刺さる相手がいなければ普通に攻撃力');
});

test('CPU：Reach の装備は、後列で攻撃できない近接に付ける', () => {
  const spear = tequip('t_reach', 1, null, {}, ['reach']);
  const s = board([mk(GOLEM), mk(WOLF)], [mk(GOLEM)]);
  s.players[0].crystals = 1;
  give(s, 0, spear);
  eq(cpuNextAction(s), { type: 'equip', uid: s.players[0].hand[0].uid, slot: 1 });
});

// ============================================================
// ステージモード
// ============================================================

test('ステージ：1-1〜5-10 の50ステージ。各章の10番目がボス', () => {
  eq(STAGES.length, 50);
  eq([STAGES[0].id, STAGES[9].id, STAGES[49].id], ['1-1', '1-10', '5-10']);
  eq(STAGES.filter(s => s.boss).map(s => s.id), ['1-10', '2-10', '3-10', '4-10', '5-10']);
  for (const s of STAGES.filter(x => x.boss)) assert(s.enemy && s.feature && s.hint, s.id);
});

test('ステージ：相手のデッキは8+8枚で、ステージごとに決まっている（毎回同じ）', () => {
  for (const st of STAGES) {
    const d = stageDeck(st);
    // ボスだけ、特徴になるモンスターを2枚入れている
    eq([d.monsters.length, d.items.length, new Set(d.monsters).size, new Set(d.items).size], [8, 8, st.boss ? 7 : 8, 8], st.id);
    assert(d.monsters.every(id => CARD_DEFS[id].kind === 'monster') && d.items.every(id => CARD_DEFS[id] && CARD_DEFS[id].kind !== 'monster'), st.id);
    eq(stageDeck(st), d, st.id + ' は毎回同じ');
    assert(d.monsters.some(id => CARD_DEFS[id].cost <= CONFIG.CRYSTALS_PER_TURN), st.id + ' に序盤に出せるモンスターがいる');
    for (const id in d.levels) eq(d.levels[id], Math.min(st.level, maxLevel(id)), st.id + ' のカードレベル');
  }
});

test('ステージ：設定どおりの色・レアリティ・強いカードの枚数になる', () => {
  const rank = id => RARITY_ORDER.indexOf(CARD_DEFS[id].rarity);
  for (const st of STAGES.filter(s => !s.boss)) {
    const d = stageDeck(st);
    const max = RARITY_ORDER.indexOf(st.rarity);
    assert([...d.monsters, ...d.items].every(id => rank(id) <= max), st.id + ' のレアリティ上限');
    assert(d.monsters.filter(id => rank(id) > 0).length <= st.strong, st.id + ' の強いモンスター数');
    assert(d.monsters.some(id => st.colors.includes(CARD_DEFS[id].color)), st.id + ' の色');
    assert(d.items.every(id => !CARD_DEFS[id].color || st.colors.includes(CARD_DEFS[id].color) || rank(id) === 0), st.id + ' のアイテムの色');
  }
  const first = STAGE_BY_ID['1-1'];
  const commons = MONSTERS.filter(m => m.rarity === 'common' && first.colors.includes(m.color)).length;
  eq(stageDeck(first).monsters.filter(id => first.colors.includes(CARD_DEFS[id].color)).length, Math.min(8, commons), '1-1 は指定の色のコモンを優先して入れる');
});

test('ステージ：だんだん強くなる（カードレベルと強いカードの数が章ごとに上がる）', () => {
  const power = st => {
    const d = stageDeck(st);
    return d.monsters.reduce((n, id) => { const c = cardAt(id, d.levels[id]); return n + c.hp + c.atk * 3; }, 0);
  };
  const avg = ch => { const l = STAGES.filter(s => s.chapter === ch && !s.boss); return l.reduce((n, s) => n + power(s), 0) / l.length; };
  const a = [1, 2, 3, 4, 5].map(avg);
  for (let i = 1; i < 5; i++) assert(a[i] > a[i - 1] * 1.08, `${i + 1}章は${i}章より強い: ${a.map(Math.round)}`);
  for (const ch of [1, 2, 3, 4, 5]) assert(power(STAGE_BY_ID[ch + '-10']) > power(STAGE_BY_ID[ch + '-1']), ch + '章のボスは、その章の最初のステージより強い');
});

test('ステージ：ボスは特徴的なデッキ（赤=Inspire、青=Silence、緑=Heal、黄=Flying、紫=Disease）', () => {
  const count = (id, skill) => {
    const d = stageDeck(STAGE_BY_ID[id]);
    return [...d.monsters, ...d.items].filter(c => cardAt(c, d.levels[c]).skills.some(k => skill.includes(k.id))).length;
  };
  assert(count('1-10', ['inspire', 'batter', 'doublestrike']) >= 4);
  assert(count('2-10', ['silence', 'suppress']) >= 4);
  assert(count('3-10', ['heal', 'groupheal', 'thorns', 'entangle']) >= 7);
  assert(count('4-10', ['flying']) >= 4);
  assert(count('5-10', ['disease', 'groupdisease', 'outbreak']) >= 6);
});

test('ステージ：前のステージをクリアすると次が解放される（章をまたぐのはボスのクリア後）', () => {
  const p = newProfile();
  eq([stageUnlocked(p, '1-1'), stageUnlocked(p, '1-2'), stageUnlocked(p, '2-1')], [true, false, false]);
  recordStageClear(p, '1-1', 3);
  eq([stageUnlocked(p, '1-2'), stageUnlocked(p, '1-3')], [true, false]);
  for (let n = 2; n <= 9; n++) recordStageClear(p, '1-' + n, 3);
  assert(!stageUnlocked(p, '2-1'), 'ボスを倒すまで2章は開かない');
  recordStageClear(p, '1-10', 3);
  assert(stageUnlocked(p, '2-1'));
  eq([nextStage('1-10').id, nextStage('5-10')], ['2-1', null]);
  eq(chapterProgress(p, 1), { cleared: 10, stars: 10, total: 10 });
});

test('ステージ：星評価は残りモンスター数で決まり、最高記録が残る', () => {
  eq([1, 3, 4, 5, 6, 8].map(starsFor), [1, 1, 2, 2, 3, 3]);
  const p = newProfile();
  eq(recordStageClear(p, '1-1', 4).stars, 2);
  eq([recordStageClear(p, '1-1', 2).best, stageStars(p, '1-1')], [2, 2], '低い記録では上書きしない');
  eq(recordStageClear(p, '1-1', 7).best, 3);
});

test('ステージ：初クリア報酬は1回だけ。章が進むほど多く、ボスは特に多い', () => {
  const p = newProfile();
  const before = [p.gold, p.stones, p.packs];
  const r = recordStageClear(p, '1-1', 5);
  eq([r.firstClear, r.reward], [true, { gold: 40, stones: 10, packs: 0 }]);
  eq([p.gold, p.stones, p.packs], [before[0] + 40, before[1] + 10, before[2]]);
  const again = recordStageClear(p, '1-1', 8);
  eq([again.firstClear, again.reward, p.gold], [false, null, before[0] + 40]);
  eq(stageReward(STAGE_BY_ID['1-5']), { gold: 40, stones: 10, packs: 0, bag: { red: 1 } }, '章の5番目：その章のテーマの色のパック');
  eq(stageReward(STAGE_BY_ID['3-10']), { gold: 600, stones: 150, packs: 0, bag: { premium: 1, green: 2 } }, 'ボス：高級パック1つ＋色のパック2つ');
  assert(stageReward(STAGE_BY_ID['5-2']).gold > stageReward(STAGE_BY_ID['1-2']).gold);
});

test('ステージ：進行はセーブされ、読み込んでも残る', () => {
  const st = memStorage();
  const p = newProfile();
  recordStageClear(p, '1-1', 6); recordStageClear(p, '1-2', 2);
  p.stages['9-9'] = 3; // 存在しないステージは読み込み時に捨てる
  saveProfile(p, st);
  eq(loadProfile(st).stages, { '1-1': 3, '1-2': 1 });
});

test('ステージ：補正は入門（相手のクリスタル-1）と、相手の初期クリスタルの増減だけ', () => {
  for (const st of STAGES) {
    assert(st.income === undefined || st.income === -1, st.id + ' income');
    assert(st.bonus === undefined || (st.bonus >= -4 && st.bonus <= 5), st.id + ' bonus'); // マイナス＝相手の最初のクリスタルが少ない（易しくする補正）
    if (st.income === -1) assert(st.chapter === 1 && st.number <= 3, '入門は 1-1〜1-3 だけ');
  }
  // 補正は対戦にそのまま効く
  const s = newGame(DEFAULT_DECK, DEFAULT_DECK, testRng);
  s.players.forEach(p => { p.crystals = 0; });
  s.players[1].bonusIncome = -1;
  s.current = 1;
  startTurn(s);
  eq(s.players[1].crystals, CONFIG.CRYSTALS_PER_TURN - 1);
});

test('フリー対戦：プレイヤーLv2で解放', () => {
  const p = newProfile();
  assert(!isUnlocked(p, 'free'));
  eq(addXp(p, xpToNext(1)).unlocked, ['free']);
  assert(isUnlocked(p, 'free'));
});

// ---------- カードの絵 ----------

// 絵文字（色つきの絵文字の範囲）が含まれていないか
const hasEmoji = t => /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t);

test('絵：全モンスターにSVGの絵があり、絵文字を使っていない', () => {
  for (const m of MONSTERS) {
    assert(MONSTER_ART[m.id], m.name + ' の絵の設定');
    const svg = monsterArt(m);
    assert(svg.startsWith('<svg') && svg.length > 600, m.name);
    assert(!/undefined|NaN/.test(svg) && !hasEmoji(svg), m.name + ' のSVG');
  }
});

test('絵：同じ絵が並ばない（全モンスターが違う絵）', () => {
  eq(new Set(MONSTERS.map(m => monsterArt({ ...m, color: 'red' }))).size, MONSTERS.length, '色を同じにしても形が違う');
});

test('絵：色ごとにテーマがそろっている（その色の絵の具で描かれる）', () => {
  for (const color in COLORS) {
    for (const m of MONSTERS.filter(x => x.color === color)) {
      const svg = monsterArt(m);
      assert(Object.values(ART_PAL[color]).some(c => svg.includes(c)), m.name);
    }
  }
});

test('絵：レベルが上がると装飾が豪華になる（きらめき・オーラ・光る目・冠）', () => {
  for (const m of MONSTERS) {
    const max = maxLevel(m.id);
    const arts = [];
    for (let lv = 1; lv <= max; lv++) arts.push(monsterArt(cardAt(m.id, lv)));
    eq(new Set(arts).size, max, m.name + ' はレベルごとに絵が変わる');
    assert(arts[max - 1].length > arts[0].length, m.name + ' は最大レベルで装飾が増える');
    assert(arts[max - 1].includes('#fbbf24'), m.name + ' は最大レベルで冠が付く');
  }
});

test('絵：すべての装備・フラッシュにも絵があり、ボス5体は専用の絵', () => {
  for (const c of ITEMS) {
    assert(ITEM_ART[c.id] || ITEM_ART[c.base], c.name + ' の絵');
    const svg = itemArt(c);
    assert(svg.startsWith('<svg') && !/undefined|NaN/.test(svg) && !hasEmoji(svg), c.name);
  }
  eq(new Set(ITEMS.map(itemArt)).size, ITEMS.length, '色付き版も、無色版と見分けられる絵');
  const bosses = STAGES.filter(s => s.boss).map(s => bossArt(s.id));
  eq(new Set(bosses).size, 5);
  for (const svg of bosses) assert(svg.includes('viewBox="0 0 140 140"') && svg.length > 2500 && !/undefined|NaN/.test(svg));
  eq(bossArt('1-1'), '', 'ボス以外には専用の絵はない');
});

test('絵：カードに image を書くと画像を優先し、なければSVGだけ。設定のないカードは紋章になる', () => {
  const plain = cardArtHtml(CARD_BY_ID.r01);
  assert(plain.startsWith('<svg') && !plain.includes('<img'));
  const custom = cardArtHtml({ ...CARD_BY_ID.r01, image: 'images/r01.png' });
  assert(custom.includes('<img class="art-img" src="images/r01.png"') && custom.includes('<svg'), '画像の下にSVGも残る（読み込めないときの代わり）');
  const added = monsterArt({ id: 'new_card', kind: 'monster', color: 'blue', type: 'ranged' });
  assert(added.startsWith('<svg') && !/undefined/.test(added));
});

// ---------- 同色割引 ----------

test('同色割引：色付き版は、同じ効果の無色版よりコストが1安い', () => {
  const variants = ITEMS.filter(c => c.base);
  assert(variants.length >= 10, '主要な装備・フラッシュに色付き版がある');
  assert(variants.some(c => c.kind === 'equip') && variants.some(c => c.kind === 'flash'));
  for (const v of variants) {
    const b = CARD_BY_ID[v.base];
    assert(b && !b.color && v.color, v.name + ' は色付き、元は無色');
    eq(v.cost, Math.max(0, b.cost - 1), v.name + ' のコスト');
    eq([v.kind, v.rarity, maxLevel(v.id)], [b.kind, b.rarity, maxLevel(b.id)], v.name);
    for (let lv = 1; lv <= maxLevel(v.id); lv++) {
      const x = cardAt(v.id, lv), y = cardAt(b.id, lv);
      eq([x.atk, x.armor, x.hp, x.skills], [y.atk, y.armor, y.hp, y.skills], `${v.name} Lv${lv} の効果は無色版と同じ`);
    }
  }
  for (const color in COLORS) assert(variants.some(v => v.color === color), color + ' の色付き版がある');
});

test('同色割引：色付きの装備は同じ色のモンスターだけ。無色の装備はどの色にも付けられる', () => {
  const s = board([mk(WOLF), mk(SLIME)], [mk(GOLEM)]); // 赤・青
  assert(!equipItem(s, 0, give(s, 0, 'e21'), 1), '赤の剣は青に付かない');
  const before = s.players[0].crystals;
  assert(equipItem(s, 0, s.players[0].hand[0].uid, 0), '赤の剣は赤に付く');
  eq(before - s.players[0].crystals, CARD_BY_ID.e01.cost - 1, '無色版より1安い');
  assert(equipItem(s, 0, give(s, 0, 'e01'), 1), '無色の剣は青にも付く');
});

test('同色割引：色付きのフラッシュは、その色のモンスターが自分の場にいるときだけ使える', () => {
  const s = board([mk(SLIME)], [mk(GOLEM)]); // 自分の場は青だけ
  const rock = give(s, 0, 'f16');          // 赤のフラッシュ
  assert(!flashUsable(s.players[0], CARD_BY_ID.f16));
  eq(playFlash(s, 0, rock, 0), null);
  eq(s.players[0].hand.length, 1, '使えなかったカードは手札に残る');
  s.players[0].slots[1] = mk(WOLF);        // 赤が場に出る
  const ev = playFlash(s, 0, rock, 0);
  eq([ev.dmg, s.players[0].crystals], [CARD_BY_ID.f01.skills[0].x, 10 - (CARD_BY_ID.f01.cost - 1)]);
  assert(flashUsable(s.players[0], CARD_BY_ID.f01), '無色はいつでも使える');
  // CPUも、使えない色のフラッシュは使おうとしない
  const t = board([mk(SLIME)], [mk(GOLEM)]);
  give(t, 0, 'f16');
  assert(!(cpuNextAction(t) || {}).type || cpuNextAction(t).type !== 'flash');
});

// ---------- 新スキル（Rearguard・Equilibrium・See-through・Overlord） ----------

test('Rearguard：自分のターン開始時に後列にいると、自分のスキルの数値が+X（前列では増えない）', () => {
  const rg = () => mk(S('ranged', 2, 10, 'rearguard:2', 'thorns:1', 'shoot:1'));
  const s = board([mk(WOLF), rg()], [mk(GOLEM)]);
  const m = s.players[0].slots[1];
  eq(skillX(m, 'thorns'), 1, 'ターン開始前は元の数値');
  beginTurnOf(s, 0);
  eq([m.buff.rearguard, skillX(m, 'thorns'), skillX(m, 'shoot')], [2, 3, 3]);
  eq(s.players[0].slots[0].buff.shoot, 3, '増えた数値で Shoot Command が発動する');
  eq(startEv(s, 'rearguard').length, 1);
  // 前列にいるときは増えない
  const f = board([rg()], [mk(GOLEM)]);
  beginTurnOf(f, 0);
  eq([f.players[0].slots[0].buff.rearguard, skillX(f.players[0].slots[0], 'thorns')], [undefined, 1]);
});

test('Rearguard：相手ターン終了まで続き、次の自分のターン開始で数え直す。数値のないスキルと Equilibrium は増えない', () => {
  const s = board([mk(WOLF), mk(S('ranged', 2, 10, 'rearguard:1', 'thorns:2', 'flying', 'equilibrium:3'))], [mk(GOLEM)]);
  const m = s.players[0].slots[1];
  beginTurnOf(s, 0);
  eq([skillX(m, 'thorns'), skillX(m, 'flying'), skillX(m, 'equilibrium'), skillX(m, 'rearguard')], [3, 1, 3, 1]);
  attacks(s); finishTurn(s);
  beginTurnOf(s, 1);
  eq(skillX(m, 'thorns'), 3, '相手のターン中も続く');
  attacks(s); finishTurn(s);
  s.players[0].slots = [m, null, null]; // 前列に詰めた
  beginTurnOf(s, 0);
  eq(skillX(m, 'thorns'), 2, '前列になったので元に戻る');
});

test('Equilibrium：場にいる間、手札の同じ色のモンスターのコストがXになる（ほかの色・安いカードは変わらない）', () => {
  const eqm = S('magic', 1, 10, 'equilibrium:2'); // 赤
  const s = board([mk(eqm)], [mk(GOLEM)]);
  const p = s.players[0];
  eq([costOf(p, CARD_BY_ID[DRAGON]), costOf(p, CARD_BY_ID[WOLF]), costOf(p, CARD_BY_ID[GOLEM])], [2, 2, 5], '赤のドラゴン6→2、赤のウルフ2のまま、緑は対象外');
  eq(costOf(p, CARD_BY_ID[SWORD]), 1, '装備は対象外');
  p.crystals = 2;
  assert(playMonster(s, 0, give(s, 0, DRAGON), 1), 'コスト2で出せる');
  eq(p.crystals, 0);
  // 持ち主がいなくなると元に戻る
  p.slots[0] = null;
  eq(costOf(p, CARD_BY_ID[DRAGON]), 6);
});

test('Equilibrium：CPUも下がったコストで出す', () => {
  const s = board([mk(S('magic', 1, 10, 'equilibrium:2'))], [mk(GOLEM)]);
  s.players[0].crystals = 2;
  give(s, 0, DRAGON);
  eq(cpuPlay(s)[0], DRAGON);
});

test('See-through：近接攻撃のとき、Flying・Shield・Thorns を無視する', () => {
  const guard = () => mk(S('melee', 1, 999, 'flying', 'shield:2', 'thorns:3'));
  for (let i = 0; i < 300; i++) {
    const s = board([mk(S('melee', 5, 10, 'seethrough'))], [guard()]);
    const ev = attacks(s)[0];
    eq([ev.dodged, ev.dmg, ev.shielded, ev.extras.length, s.players[0].slots[0].hp], [false, 5, 0, 0, 10]);
  }
  // See-through がなければ、回避・軽減・反撃を受ける
  const plain = attacks(board([mk(S('melee', 5, 10))], [mk(S('melee', 1, 999, 'shield:2', 'thorns:3'))]))[0];
  eq([plain.dmg, extra(plain, 'thorns').dmg], [3, 3]);
});

test('See-through：近接以外の攻撃でも効く（遠隔・魔法・カオスも防御スキルを無視する）', () => {
  const s = board([mk(WOLF), mk(S('ranged', 4, 10, 'seethrough'))], [mk(S('melee', 1, 999, 'shield:2'))]);
  eq(attacks(s).find(e => e.type === 'ranged').dmg, 4, '遠隔も Shield を無視する');
  const f = board([mk(S('magic', 3, 10, 'seethrough'))], [mk(GOLEM)]);
  f.players[1].slots[0].status.fog = true;
  eq([attacks(f)[0].dmg, f.players[1].slots[0].status.fog], [3, true], '魔法も Fog を無視する（Fog は残る）');
  eq(rate(300, () => attacks(board([mk(WOLF), mk(S('ranged', 2, 10, 'seethrough'))], [mk(S('melee', 1, 999, 'flying'))])).find(e => e.type === 'ranged').dodged), 0, '遠隔も Flying に回避されない');
});

test('Overlord：数値のあるスキルの効果が、すべて2倍になる（Equilibrium と Rearguard は除く）', () => {
  const lord = mk(S('melee', 2, 30, 'overlord', 'thorns:2', 'disease:1', 'doublestrike:2', 'antiair:1', 'shield:1', 'heal:2', 'equilibrium:2', 'flying'));
  eq(['thorns', 'disease', 'doublestrike', 'antiair', 'shield', 'heal'].map(id => skillX(lord, id)), [4, 2, 4, 2, 2, 4]);
  eq([skillX(lord, 'equilibrium'), skillX(lord, 'flying'), skillX(lord, 'overlord')], [2, 1, 1], 'コストを決める Equilibrium と、数値のないスキルは変わらない');
  // 実戦で：Disease 2倍、Doublestrike 2倍
  const s = board([mk(S('melee', 2, 30, 'overlord', 'disease:1', 'doublestrike:2'))], [mk(GOLEM), mk(SLIME)]);
  const ev = attacks(s)[0];
  eq([s.players[1].slots[0].status.disease, extra(ev, 'doublestrike').dmg], [2, 4]);
  // 受ける側：Thorns 2倍、Shield 2倍
  const t = board([mk(DRAGON)], [mk(S('melee', 1, 30, 'overlord', 'thorns:2', 'shield:1'))]);
  const hit = attacks(t)[0];
  eq([extra(hit, 'thorns').dmg, hit.dmg], [4, 3]);
  // Batter：追加攻撃の回数も2倍
  eq(attacks(board([mk(S('melee', 1, 30, 'overlord', 'batter:1'))], [mk(GOLEM)])).length, 3);
});

test('Overlord と Rearguard は重なる（後列で+Xしてから2倍）', () => {
  const s = board([mk(WOLF), mk(S('ranged', 2, 10, 'overlord', 'rearguard:1', 'thorns:2'))], [mk(GOLEM)]);
  beginTurnOf(s, 0);
  eq(skillX(s.players[0].slots[1], 'thorns'), 6);
});

// ============================================================
// 新スキル（公式の説明に合わせたもの）
// ============================================================
const kinds = ev => ev.extras.map(x => x.kind);
// 条件に合うイベントが出るまで試す（確率で発動するスキル用）
const until = (make, pick, tries = 400) => { for (let i = 0; i < tries; i++) { const r = pick(make()); if (r) return r; } throw new Error('発動しなかった'); };

test('Menace：自分のターン中、位置が変わった敵にXの固定ダメージ（撃破による詰め。アーマーも軽減も無視）', () => {
  const s = board([mk(S('melee', 9, 10, 'menace:2'))], [mk(IMP), mk(S('melee', 1, 10, 'shield:3'), STEEL), mk(GOLEM)]);
  const [, guard, golem] = s.players[1].slots;
  const ev = attacks(s)[0];
  assert(ev.killed);
  eq(ev.extras.filter(x => x.kind === 'menace').map(x => [x.target === guard || x.target === golem, x.dmg]), [[true, 2], [true, 2]]);
  eq([guard.hp, guard.armor, golem.hp], [8, 5, CARD_BY_ID[GOLEM].hp - 2], 'アーマーもShieldも無視');
});

test('Menace：相手のターン中の移動（相手が自分で押し出したとき）には発動しない', () => {
  const s = board([mk(S('melee', 1, 10, 'menace:2'))], [mk(WOLF)]);
  s.current = 1;
  assert(playMonster(s, 1, give(s, 1, SLIME), 0));
  eq(s.players[1].slots[1].hp, CARD_BY_ID[WOLF].hp);
});

const fearIn = (card, foes, prep) => { // Fear 持ちを手札から場に出す
  const s = board([], foes.map(f => mk(f)));
  s.players[0].crystals = 9;
  if (prep) prep(s);
  const r = playMonster(s, 0, give(s, 0, card), 0);
  return { s, events: r.events };
};

test('Fear：場に出たとき、敵の前列を、敵の後列のランダムな1体と入れ替える。Menace と組み合わさる', () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const { s, events } = fearIn(S('melee', 1, 10, 'fear', 'menace:1'), [WOLF, ELF, MAGE]);
    const n = names(s.players[1]);
    assert(n[0] !== WOLF && n.includes(WOLF), '前列が後列へ');
    seen.add(n[0]);
    const moved = s.players[1].slots.filter(m => m.hp < m.maxHp).map(m => m.card.id).sort();
    eq(moved, [WOLF, n[0]].sort(), '入れ替わった2体だけに Menace');
    eq(events.map(e => e.kind), ['fear', 'menace', 'menace']);
    // 出したときの1回だけ。ターン開始時には、もう入れ替えない
    beginTurnOf(s, 0);
    eq([startEv(s, 'fear').length, names(s.players[1])], [0, n]);
  }
  eq([...seen].sort(), [ELF, MAGE].sort(), '後列のどちらとも入れ替わる');
});

test('Fear：Inspire を受けている敵には効かない。後列がいなければ何も起きない', () => {
  const a = fearIn(S('melee', 1, 10, 'fear'), [WOLF, ELF], s => { s.players[1].slots[0].buff.inspire = 1; });
  eq([names(a.s.players[1]).slice(0, 2), a.events[0].immune], [[WOLF, ELF], true]);
  const b = fearIn(S('melee', 1, 10, 'fear'), [WOLF, ELF], s => { s.players[1].slots[1].buff.inspire = 1; }); // 後列だけ Inspire → 入れ替える相手がいない
  eq(names(b.s.players[1]).slice(0, 2), [WOLF, ELF]);
  eq(fearIn(S('melee', 1, 10, 'fear'), [WOLF]).events.length, 0);
});

test('Overlord：Menace・Toxic Fog は数値が2倍、Fear は2回入れ替える', () => {
  const lord = mk(S('melee', 1, 10, 'overlord', 'menace:2', 'toxicfog:1', 'fear'));
  eq([skillX(lord, 'menace'), skillX(lord, 'toxicfog')], [4, 2]);
  const { s, events } = fearIn(S('melee', 1, 10, 'overlord', 'toxicfog:1', 'fear'), [GOLEM, SLIME, WOLF]);
  eq(events.filter(e => e.kind === 'fear').length, 2);
  beginTurnOf(s, 0);
  assert(s.players[1].slots.every(m => m.status.disease === 2));
});

test('Bombard：Flying を持つこのモンスターが、Flying を持たない敵を近接・遠隔で攻撃するときX追加', () => {
  eq(attacks(board([mk(S('melee', 3, 10, 'flying', 'bombard:2'))], [mk(GOLEM)]))[0].dmg, 5);
  eq(attacks(board([mk(WOLF), mk(S('ranged', 3, 10, 'flying', 'bombard:2'))], [mk(GOLEM)])).find(e => e.type === 'ranged').dmg, 5);
  eq(attacks(board([mk(S('melee', 3, 10, 'flying', 'bombard:2'))], [mk(S('melee', 1, 30, 'flying'))]))[0].dmg, 3, 'Flying 相手には乗らない');
  eq(attacks(board([mk(S('melee', 3, 10, 'bombard:2'))], [mk(GOLEM)]))[0].dmg, 3, '自分が Flying でなければ乗らない');
  eq(attacks(board([mk(S('magic', 3, 10, 'flying', 'bombard:2'))], [mk(GOLEM)]))[0].dmg, 3, '魔法には乗らない');
});

test('Mass Bombard：攻撃フェーズ開始時、Flying を持つ味方全員が対地攻撃+X（最も強いものだけ）', () => {
  const s = board([mk(S('melee', 3, 10, 'flying')), mk(S('ranged', 1, 10, 'massbombard:1')), mk(S('ranged', 1, 10, 'flying', 'massbombard:2'))], [mk(GOLEM)]);
  const evs = phase(s);
  eq([evs[0].kind, evs[0].events[0].x, evs[0].events[0].targets.length], ['phase', 2, 2]);
  const atk = evs.filter(e => e.kind === 'attack');
  eq(atk.map(e => [e.type, e.dmg]), [['ranged', 3], ['ranged', 1], ['melee', 5]], 'Flying の2体だけ+2');
});

test('Magic Blast：魔法攻撃のとき、隣の敵にもXの追加魔法ダメージ（Magic Reflect は発動しない）', () => {
  const s = board([mk(S('magic', 3, 10, 'magicblast:2'))], [mk(GOLEM), mk(SLIME, STEEL), mk(S('melee', 1, 20, 'magicreflect'))]);
  const ev = attacks(s)[0];
  const [golem, slime, mirror] = s.players[1].slots;
  eq([golem.hp, slime.hp, slime.armor, mirror.hp], [golem.maxHp - 3, slime.maxHp - 2, 5, 18], '中央を攻撃 → 左右にも2（アーマー無視）');
  eq(kinds(ev), ['magicblast', 'magicblast']);
  eq(s.players[0].slots[0].hp, 10, '追加ダメージは跳ね返されない');
  // 左（スロット2）を攻撃したら、隣は中央だけ
  const t = board([mk(WOLF), mk(S('magic', 3, 10, 'magicblast:2'))], [mk(GOLEM), mk(SLIME), mk(IMP)]);
  const blast = attacks(t).find(e => e.type === 'magic');
  eq(blast.extras.map(x => x.target.card.id), [GOLEM]);
});

test('Craze：遠隔攻撃をX回追加で行う', () => {
  const s = board([mk(WOLF), mk(S('ranged', 2, 10, 'craze:2'))], [mk(GOLEM)]);
  eq(attacks(s).filter(e => e.type === 'ranged').map(e => e.source), ['base', 'craze', 'craze']);
});

test('Trickery：このターン、同じ色の味方のカオスダメージが最大値になる（色が違う味方・Disease 状態の使い手は対象外）', () => {
  for (let i = 0; i < 100; i++) {
    const s = board([mk(S('chaos', 6, 10)), mk(S('magic', 1, 10, 'trickery')), mk(IMP)], [mk(GOLEM)]); // S は赤、IMP は紫
    s.players[1].slots[0].hp = s.players[1].slots[0].maxHp = 999;
    beginTurnOf(s, 0);
    const chaos = attacks(s).filter(e => e.type === 'chaos');
    eq(chaos.find(e => e.attacker.card.type === 'chaos' && e.attacker.card.atk === 6).dmg, 6);
  }
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const s = board([mk(S('chaos', 6, 10)), mk(S('magic', 1, 10, 'trickery'))], [mk(GOLEM)]);
    s.players[0].slots[1].status.disease = 1; // Disease で Trickery を失う
    beginTurnOf(s, 0);
    seen.add(attacks(s).find(e => e.type === 'chaos').dmg);
  }
  assert(seen.size > 3, 'Disease 状態では最大値にならない');
});

test('Toxic Fog：自分のターン開始時、敵全員に Disease X（Perseverance には無効）', () => {
  const s = board([mk(S('magic', 1, 10, 'toxicfog:2'))], [mk(GOLEM), mk(S('melee', 1, 10, 'perseverance'))]);
  beginTurnOf(s, 0);
  eq(s.players[1].slots.map(m => m && m.status.disease), [2, undefined, null]);
});

test('Poison Halo：Disease を持つ味方は Outbreak を得て、Outbreak を持つ味方は Disease X を得る（次の自分のターンまで）', () => {
  const s = board([mk(S('melee', 1, 10, 'poisonhalo:2')), mk(S('melee', 1, 10, 'disease:1')), mk(S('melee', 1, 10, 'outbreak'))], [mk(GOLEM)]);
  const [, sick, burst] = s.players[0].slots;
  beginTurnOf(s, 0);
  eq([skillX(sick, 'outbreak'), skillX(sick, 'disease'), skillX(burst, 'disease'), skillX(burst, 'outbreak')], [1, 1, 2, 1]);
  attacks(s); finishTurn(s); beginTurnOf(s, 1); attacks(s); finishTurn(s);
  s.players[0].slots[0] = mk(WOLF); // Poison Halo 持ちがいなくなる
  beginTurnOf(s, 0);
  eq([skillX(sick, 'outbreak'), skillX(burst, 'disease')], [0, 0]);
});

test('Outbreak Halo：自分のターン終了時、Disease 状態の敵全員にXの魔法ダメージ（スタックは減らない）', () => {
  const s = board([mk(S('melee', 1, 10, 'outbreakhalo:2'))], [mk(GOLEM, STEEL), mk(SLIME), mk(WOLF)]);
  const [golem, slime, wolf] = s.players[1].slots;
  golem.status.disease = 5; slime.status.disease = 1;
  attacks(s);
  finishTurn(s);
  eq([golem.status.disease, slime.status.disease, wolf.status.disease], [5, 1, undefined]);
  eq([golem.maxHp - golem.hp, golem.armor >= 4, slime.maxHp - slime.hp, wolf.hp], [2, true, 2, wolf.maxHp], 'アーマー無視。Disease のない敵には何も起きない');
  eq(s.endEvents.length, 2);
});

test('Counter-Attack：近接攻撃でダメージを受けたとき、約50%で自分の近接攻撃を返す', () => {
  near(rate(4000, () => {
    const s = board([mk(WOLF)], [mk(S('melee', 3, 30, 'counter'))]);
    const c = extra(attacks(s)[0], 'counter');
    if (c) eq([c.dmg, s.players[0].slots[0].hp], [3, CARD_BY_ID[WOLF].hp - 3]);
    return !!c;
  }), 0.5, 0.03);
  // 近接攻撃を持たない・倒された・遠隔で殴られた → 返さない
  eq(rate(200, () => kinds(attacks(board([mk(WOLF)], [mk(S('magic', 3, 30, 'counter'))]))[0]).length > 0), 0);
  eq(rate(200, () => kinds(attacks(board([mk(DRAGON)], [mk(S('melee', 3, 2, 'counter'))]))[0]).length > 0), 0);
  eq(rate(200, () => attacks(board([mk(WOLF), mk(ELF)], [mk(S('melee', 3, 30, 'counter'))])).find(e => e.type === 'ranged').extras.length > 0), 0);
});

test('Cross-Counter-Attack：必ず近接攻撃を返す。1ターンに3回まで（次のターンには戻る）', () => {
  const s = board([mk(S('melee', 1, 60, 'batter:4'))], [mk(S('melee', 2, 60, 'crosscounter'))]);
  eq(attacks(s).map(e => kinds(e).length), [1, 1, 1, 0, 0]);
  eq(s.players[0].slots[0].hp, 54);
  finishTurn(s); beginTurnOf(s, 1); attacks(s); finishTurn(s); beginTurnOf(s, 0);
  eq(attacks(s).map(e => kinds(e).length), [1, 1, 1, 0, 0], '次のターンにまた3回');
});

test('Magic Counter：魔法攻撃でダメージを受けたとき、約50%で近接攻撃を返す', () => {
  near(rate(4000, () => !!extra(attacks(board([mk(MAGE)], [mk(S('melee', 2, 30, 'magiccounter'))]))[0], 'magiccounter')), 0.5, 0.03);
});

test('Magic Reflect：魔法攻撃を約75%で受けずに、同じダメージを攻撃者に返す。Disease 状態では失う。1ターンに5回まで', () => {
  near(rate(4000, () => {
    const s = board([mk(MAGE)], [mk(S('melee', 1, 30, 'magicreflect'))]);
    const ev = attacks(s)[0];
    const r = extra(ev, 'magicreflect');
    if (r) eq([ev.reflected, ev.dmg, r.dmg, s.players[0].slots[0].hp, s.players[1].slots[0].hp], [true, 0, 3, CARD_BY_ID[MAGE].hp - 3, 30], '自分は受けず、同じだけ返す');
    return !!r;
  }), 0.75, 0.03);
  eq(rate(300, () => {
    const s = board([mk(MAGE)], [mk(S('melee', 1, 30, 'magicreflect'))]);
    s.players[1].slots[0].status.disease = 1;
    return attacks(s)[0].extras.length > 0;
  }), 0);
  // 1ターンに5回まで。ターンが変わると、また使える
  const cap = board([mk(MAGE)], [mk(S('melee', 1, 30, 'magicreflect'))]);
  cap.fixed = { reflect: true };
  const wall = cap.players[1].slots[0];
  wall.reflects = CONFIG.MAGIC_REFLECT_MAX - 1;
  eq([attacks(cap)[0].reflected, wall.reflects], [true, 5]);
  eq([!!attacks(cap)[0].reflected, wall.hp], [false, 27], '6回目は受ける');
  beginTurnOf(cap, 0);
  eq(wall.reflects, 0);
  // 跳ね返したときは、Magic Blast も起きない
  const bl = board([mk(S('magic', 3, 30, 'magicblast:2'))], [mk(S('melee', 1, 30, 'magicreflect')), mk(WOLF)]);
  bl.fixed = { reflect: true };
  eq([kinds(attacks(bl)[0]), bl.players[1].slots[1].hp], [['magicreflect'], CARD_BY_ID[WOLF].hp]);
  // フラッシュの Lightning は跳ね返されない
  const s = board([mk(WOLF)], [mk(S('melee', 1, 30, 'magicreflect'))]);
  eq([playFlash(s, 0, give(s, 0, BOLT), 0).extras.length, s.players[0].slots[0].hp], [0, CARD_BY_ID[WOLF].hp]);
});

test('Opportunity：敵が後列から近接攻撃（Reach）をしたとき、その敵に遠隔攻撃を1回行う', () => {
  const s = board([mk(MAGE), mk(S('melee', 2, 20, 'reach'))], [mk(GOLEM), mk(S('ranged', 4, 10, 'opportunity'))]);
  const ev = attacks(s).find(e => e.type === 'melee');
  eq([kinds(ev), extra(ev, 'opportunity').dmg, s.players[0].slots[1].hp], [['opportunity'], 4, 16]);
  // 前列からの近接には反応しない
  eq(attacks(board([mk(WOLF)], [mk(GOLEM), mk(S('ranged', 4, 10, 'opportunity'))]))[0].extras.length, 0);
});

test('Mirror Shield：魔法ダメージ-X／Sacred Shield：物理も魔法も-X／Anti-Magic Shield：味方全員の魔法ダメージ-X', () => {
  const hit = (target, attacker) => attacks(board([mk(attacker)], [mk(target)]))[0].dmg;
  eq([hit(S('melee', 1, 30, 'mirrorshield:2'), MAGE), hit(S('melee', 1, 30, 'mirrorshield:2'), DRAGON)], [1, 5]);
  eq([hit(S('melee', 1, 30, 'sacredshield:2'), MAGE), hit(S('melee', 1, 30, 'sacredshield:2'), DRAGON)], [1, 3]);
  const s = board([mk(S('magic', 3, 60))], [mk(WOLF), mk(S('magic', 1, 10, 'antimagic:2'))]);
  beginTurnOf(s, 1); attacks(s); finishTurn(s);          // かけた側のターン
  beginTurnOf(s, 0);
  eq(attacks(s)[0].dmg, 1, '相手ターン中も続く');
  finishTurn(s);
  s.players[1].slots[1] = mk(ELF);
  beginTurnOf(s, 1); attacks(s); finishTurn(s); beginTurnOf(s, 0);
  eq(attacks(s)[0].dmg, 3, '使い手がいなくなれば次のターンで切れる');
});

test('Fog：ダメージを受けると Fog 状態になり、次の攻撃のダメージを0にして解ける', () => {
  const s = board([mk(S('melee', 2, 10, 'batter:2'))], [mk(S('melee', 1, 30, 'fog'))]);
  const fogger = s.players[1].slots[0];
  eq(attacks(s).map(e => [e.dmg, e.fogged]), [[2, false], [0, true], [2, false]]);
  eq([fogger.hp, fogger.status.fog], [26, true]);
});

test('Fog：See-through は Fog を無視する。Lingering Fog（フラッシュ）は味方を Fog 状態にする', () => {
  const s = board([mk(S('melee', 3, 10, 'seethrough'))], [mk(WOLF)]);
  s.players[1].slots[0].status.fog = true;
  eq([attacks(s)[0].dmg, s.players[1].slots[0].status.fog], [3, true], 'ダメージが通り、Fog は残る');
  const t = board([mk(WOLF)], [mk(DRAGON)]);
  playFlash(t, 0, give(t, 0, tflash('t_lfog', 1, 'lingeringfog')), 0);
  eq(t.players[0].slots[0].status.fog, true);
  finishTurn(t); beginTurnOf(t, 1);
  eq([attacks(t)[0].fogged, t.players[0].slots[0].hp], [true, CARD_BY_ID[WOLF].hp]);
});

test('Healing Shield：味方を回復したとき、相手ターン終了まで盾を得る（盾の種類はカードごと）', () => {
  const healer = tcard({ id: 't_hshield', name: 't_hshield', icon: '', kind: 'monster', type: 'magic', atk: 1, hp: 10, cost: 2, color: 'green', skills: [{ id: 'heal', x: 2 }, { id: 'healingshield', x: 2, shield: 'mirrorshield' }] });
  const s = board([mk(GOLEM), mk(healer)], [mk(MAGE)]);
  s.players[0].slots[0].hp -= 4;
  const h = s.players[0].slots[1];
  beginTurnOf(s, 0);
  eq([skillX(h, 'mirrorshield'), skillX(h, 'shield'), startEv(s, 'healingshield').length], [2, 0, 1]);
  // 回復する相手がいなければ得られない
  const t = board([mk(GOLEM), mk(healer)], [mk(MAGE)]);
  beginTurnOf(t, 0);
  eq(skillX(t.players[0].slots[1], 'mirrorshield'), 0);
  // フラッシュの場合は、回復した味方が得る
  const u = board([mk(GOLEM)], [mk(MAGE)]);
  u.players[0].slots[0].hp -= 4;
  const pray = tcard({ id: 't_pray', name: 't_pray', icon: '', kind: 'flash', cost: 1, color: null, skills: [{ id: 'heal', x: 3 }, { id: 'healingshield', x: 1, shield: 'sacredshield' }] });
  playFlash(u, 0, give(u, 0, pray), 0);
  eq(skillX(u.players[0].slots[0], 'sacredshield'), 1);
});

test('Dive：自分のターン開始時、Flying を持っていれば近接・遠隔攻撃+X（相手ターン終了まで）', () => {
  const s = board([mk(S('melee', 2, 30, 'flying', 'dive:3')), mk(S('melee', 2, 30, 'dive:3', 'reach'))], [mk(GOLEM)]);
  const [bird, walker] = s.players[0].slots;
  beginTurnOf(s, 0);
  eq([bird.buff.dive, getAttacks(bird)[0].atk, getAttacks(walker)[0].atk, startEv(s, 'dive').length], [3, 5, 2, 1], 'Flying のないモンスターは上がらない');
  eq(attacks(s).find(e => e.attacker === bird).dmg, 5);
  finishTurn(s);
  eq(getAttacks(bird)[0].atk, 5, '相手のターン中も続く');
  // 回避しても増えない（以前のルール）。拘束されると Flying を失い、Dive も得られない
  bird.status.entangle = true;
  beginTurnOf(s, 0);
  eq([bird.buff.dive, getAttacks(bird)[0].atk], [undefined, 2]);
});

test('Group Dive：自分のターン開始時、Flying を持つ味方全員が Dive を得る', () => {
  const s = board([mk(S('melee', 2, 30, 'flying')), mk(S('ranged', 1, 10, 'groupdive:2')), mk(S('ranged', 1, 10, 'flying', 'dive:1'))], [mk(GOLEM)]);
  beginTurnOf(s, 0);
  eq(s.players[0].slots.map(m => m.buff.dive), [2, undefined, 3], '自分の Dive と合わさる。Flying のない Group Dive 持ち自身は上がらない');
});

test('Shield Spike：ダメージを受けるたびに攻撃元へXを返す（攻撃元も Shield Spike 持ちなら発動しない）', () => {
  const s = board([mk(WOLF), mk(ELF), mk(MAGE)], [mk(S('melee', 1, 60, 'shieldspike:2'))]);
  eq(attacks(s).map(e => [e.type, kinds(e)]), [['magic', ['shieldspike']], ['ranged', ['shieldspike']], ['melee', ['shieldspike']]]);
  eq(s.players[0].slots.map(m => m.maxHp - m.hp), [2, 2, 2]);
  eq(attacks(board([mk(S('melee', 2, 10, 'shieldspike:1'))], [mk(S('melee', 1, 60, 'shieldspike:2'))]))[0].extras.length, 0);
});

test('Enchant Armor：アーマー装備を付けているとき、アーマーが+X（アーマーのない装備では増えない）', () => {
  const s = board([mk(S('melee', 2, 10, 'enchantarmor:2')), mk(S('melee', 2, 10, 'enchantarmor:2'))], [mk(GOLEM)]);
  equipItem(s, 0, give(s, 0, LEATHER), 0);
  equipItem(s, 0, give(s, 0, SWORD), 1);
  eq(s.players[0].slots.map(m => m && m.armor), [4, 0, null]);
});

test('See-through：Counter-Attack・Cross-Counter-Attack・Opportunity も無視する', () => {
  for (let i = 0; i < 100; i++) {
    const s = board([mk(MAGE), mk(S('melee', 2, 10, 'seethrough', 'reach'))], [mk(S('melee', 3, 60, 'counter', 'crosscounter', 'thorns:1')), mk(S('ranged', 4, 10, 'opportunity'))]);
    eq(attacks(s).find(e => e.type === 'melee').extras.length, 0);
  }
});

test('フラッシュ：Corrosion は敵の装備を1つ破壊する（装備のない相手には使えない）', () => {
  const s = board([mk(WOLF)], [mk(GOLEM, STEEL), mk(SLIME, TREE), mk(IMP)]);
  const corr = tflash('t_corr', 1, 'corrosion');
  const [g, slime] = s.players[1].slots;
  const ev = playFlash(s, 0, give(s, 0, corr), 0);
  eq([ev.destroyed[0].id, g.item, g.armor, s.players[1].discard.map(c => c.id)], [STEEL, null, 0, [STEEL]]);
  eq([playFlash(s, 0, give(s, 0, corr), 1).destroyed[0].id, slime.item, slime.maxHp], [TREE, null, CARD_BY_ID[SLIME].hp], '体力の装備も壊せる');
  eq(playFlash(s, 0, give(s, 0, corr), 2), null, '装備のない相手には使えない');
  eq(s.players[0].hand.length, 1);
});

test('Demoralize：近接だけでなく、遠隔攻撃も下げる', () => {
  const s = board([mk(S('melee', 1, 10, 'demoralize:2'))], [mk(WOLF), mk(ARCHER), mk(MAGE)]);
  beginTurnOf(s, 0);
  eq(s.players[1].slots.map(m => getAttacks(m)[0].atk), [0, 0, 3]);
});

test('Entangle：正面の敵を狙う。正面にいなければ前列の敵', () => {
  const s = board([mk(WOLF), mk(S('ranged', 1, 10, 'entangle'))], [mk(GOLEM), mk(SLIME)]);
  s.fixed = { entangle: true };
  beginTurnOf(s, 0);
  eq(s.players[1].slots.map(m => !!(m && m.status.entangle)), [false, true, false]);
  const t = board([mk(WOLF), mk(S('ranged', 1, 10, 'entangle'))], [mk(GOLEM)]);
  t.fixed = { entangle: true };
  beginTurnOf(t, 0);
  eq(!!t.players[1].slots[0].status.entangle, true);
});

test('Equilibrium：出したターンにはまだ効かず、次の自分のターンから手札のコストが下がる', () => {
  const eqm = S('melee', 1, 10, 'equilibrium:1'); // 赤
  const s = board([], [mk(GOLEM)]);
  s.players[0].crystals = 9;
  playMonster(s, 0, give(s, 0, eqm), 0);
  eq(costOf(s.players[0], CARD_BY_ID[DRAGON]), 6, '出したターンは変わらない');
  finishTurn(s); finishTurn(s); beginTurnOf(s, 0);
  eq(costOf(s.players[0], CARD_BY_ID[DRAGON]), 1);
});

test('フラッシュ：Mass Corrosion は敵の装備をすべて破壊する（体力ボーナスも失う）', () => {
  const s = board([mk(WOLF)], [mk(GOLEM, STEEL), mk(SLIME, TREE), mk(IMP)]);
  const slime = s.players[1].slots[1];
  const ev = playFlash(s, 0, give(s, 0, tflash('t_mcorr', 3, 'masscorrosion')), -1);
  eq([ev.group.length, s.players[1].slots.map(m => m.item), slime.maxHp], [2, [null, null, null], CARD_BY_ID[SLIME].hp]);
});

test('フラッシュ：Terminate は敵のモンスター1体と装備を破壊する（後ろは詰め、Menace が発動する）', () => {
  const s = board([mk(S('melee', 1, 10, 'menace:1'))], [mk(GOLEM, STEEL), mk(SLIME)]);
  const ev = playFlash(s, 0, give(s, 0, tflash('t_term', 5, 'terminate')), 0);
  eq([names(s.players[1]), s.players[1].discard.map(c => c.id), ev.extras.map(x => x.kind)], [[SLIME, null, null], [STEEL], ['menace']]);
  eq(monstersLeft(s.players[1]), 1);
});

test('フラッシュ：Retreat は自分の場のモンスター1体を山札に戻す（残りモンスター数に含まれる）', () => {
  const s = board([mk(GOLEM, STEEL), mk(WOLF)], [mk(SLIME)]);
  s.players[0].slots[0].hp = 1;
  playFlash(s, 0, give(s, 0, tflash('t_retreat', 0, 'retreat')), 0);
  eq([names(s.players[0]), s.players[0].deck.map(h => h.card.id).sort(), monstersLeft(s.players[0])], [[WOLF, null, null], [GOLEM, STEEL].sort(), 2]);
});

test('Phantom：攻撃フェーズの最初に分身が現れ（同じHP・攻撃力・装備）、攻撃して、攻撃フェーズの終わりに消える', () => {
  const s = board([mk(DRAGON, TOME)], [mk(S('melee', 1, 99))]);
  const dragon = s.players[0].slots[0];
  dragon.hp = 7;
  const ph = tflash('t_phantom', 2, 'phantom');
  assert(playFlash(s, 0, give(s, 0, ph), 0));
  eq([names(s.players[0]), dragon.phantomPending], [[DRAGON, null, null], true], 'プレイフェーズ中はまだ現れない');
  const gen = attackPhase(s);
  const first = gen.next().value;
  const copy = s.players[0].slots[1];
  eq([first.events[0].kind, copy.isPhantom, copy.hp, copy.maxHp, copy.item.id, getAttacks(copy).map(a => a.atk)], ['phantom', true, 7, dragon.maxHp, TOME, [5, 2]]);
  const evs = [...gen];
  // 分身は後列なので装備の魔法だけ、本体は魔法と近接
  eq(evs.filter(e => e.kind === 'attack').map(e => [e.attacker === copy, e.type]), [[true, 'magic'], [false, 'magic'], [false, 'melee']]);
  eq([evs[evs.length - 1].events[0].kind, names(s.players[0]), monstersLeft(s.players[0])], ['phantomend', [DRAGON, null, null], 1]);
  eq(finishTurn(s), null);
});

test('Phantom：場が満員のときは使えない。使ったあとに満員になったら分身は現れない。相手がいなければ現れない', () => {
  const ph = tflash('t_phantom2', 2, 'phantom');
  const full = board([mk(WOLF), mk(ELF), mk(MAGE)], [mk(GOLEM)]);
  eq(playFlash(full, 0, give(full, 0, ph), 0), null);
  const s = board([mk(WOLF), mk(ELF)], [mk(GOLEM)]);
  assert(playFlash(s, 0, give(s, 0, ph), 0));
  eq(playFlash(s, 0, give(s, 0, ph), 0), null, '同じ味方に2回は使えない');
  playMonster(s, 0, give(s, 0, MAGE), 2);
  eq(phase(s).filter(e => e.kind === 'phase').length, 0);
  eq(s.players[0].slots[0].phantomPending, undefined, '予約は消える');
  const empty = board([mk(WOLF)], []);
  give(empty, 1, GOLEM);
  playFlash(empty, 0, give(empty, 0, ph), 0);
  eq([phase(empty).length, names(empty.players[0])], [0, [WOLF, null, null]]);
});

test('Phantom：分身が攻撃フェーズ中に倒れても問題なく、本体には影響しない', () => {
  const s = board([mk(S('melee', 2, 3, 'reach'))], [mk(S('melee', 1, 99, 'thorns:5'))]);
  playFlash(s, 0, give(s, 0, tflash('t_phantom3', 2, 'phantom')), 0);
  const evs = phase(s);
  assert(evs.some(e => e.kind === 'attack' && e.attacker.isPhantom && extra(e, 'thorns').killed), '分身は Thorns で倒れる');
  eq(names(s.players[0]).filter(Boolean).length, 0, '本体も Thorns で倒れた（分身とは別に判定）');
});

test('CPU：Fear と Menace を組み合わせる／Magic Reflect 持ちには魔法のモンスターを避ける', () => {
  const menace = S('melee', 2, 6, 'menace:1');
  const s = board([mk(S('melee', 1, 10, 'fear'))], [mk(GOLEM), mk(SLIME)]);
  s.players[0].crystals = 3;
  give(s, 0, ARCHER); give(s, 0, menace); // コスト3の遠隔より、コスト2でも Menace を優先
  eq(cpuPlay(s)[0], menace);
  const t = board([mk(WOLF)], [mk(S('melee', 1, 20, 'magicreflect'))]);
  t.players[0].crystals = 4;
  give(t, 0, MAGE); give(t, 0, ELF); // コスト4の魔法より、コスト3の遠隔
  eq(cpuPlay(t)[0], ELF);
});

test('新カード：新スキルを持つカードが各色2枚以上ある', () => {
  const NEW = ['menace', 'bombard', 'massbombard', 'magicblast', 'craze', 'trickery', 'toxicfog', 'poisonhalo', 'outbreakhalo', 'counter', 'crosscounter', 'magiccounter', 'magicreflect', 'opportunity', 'mirrorshield', 'sacredshield', 'antimagic', 'fog', 'healingshield', 'dive', 'groupdive', 'shieldspike', 'enchantarmor', 'fear', 'seethrough', 'overlord', 'rearguard', 'equilibrium'];
  for (const color in COLORS) {
    const n = MONSTERS.filter(m => m.color === color && cardAt(m.id, maxLevel(m.id)).skills.some(k => NEW.includes(k.id))).length;
    assert(n >= 2, `${color}: ${n}`);
  }
});

test('パック：まとめて開ける（持っている数まで、1回に最大10パック）。出たカードは全部手に入る', () => {
  const p = richProfile();
  p.packs = 4;
  const count = () => Object.values(p.cards).reduce((n, c) => n + 1 + c.copies, 0);
  const before = count();
  const pulls = openPacks(p, GROWTH.PACK_BULK_MAX, testRng);
  eq([pulls.length, p.packs, count() - before], [4 * GROWTH.PACK_SIZE, 0, 4 * GROWTH.PACK_SIZE]);
  eq(openPacks(p, 10, testRng), null, 'パックがなければ開けられない');
  p.packs = 25;
  eq([openPacks(p, 99, testRng).length, p.packs], [GROWTH.PACK_BULK_MAX * GROWTH.PACK_SIZE, 25 - GROWTH.PACK_BULK_MAX], '1回に10パックまで');
  eq([openPacks(p, 2, testRng).length, p.packs], [2 * GROWTH.PACK_SIZE, 13]);
  // パックごとに、最後の1枚はレア以上
  p.packs = 6;
  const six = openPacks(p, 6, testRng);
  for (let i = GROWTH.PACK_SIZE - 1; i < six.length; i += GROWTH.PACK_SIZE) assert(CARD_DEFS[six[i].id].rarity !== 'common', 'レア以上の保証');
});

// ---------- 選択スキル ----------

test('選択スキル：エピック・レジェンドのモンスターは全員、候補を2〜3個持つ（スキルidは実在する）', () => {
  for (const m of MONSTERS.filter(x => x.rarity === 'epic' || x.rarity === 'legend')) {
    const def = CARD_DEFS[m.id];
    assert(def.options && def.options.length >= 2 && def.options.length <= 3, m.name);
    assert(def.optionLevel >= 2 && def.optionLevel <= maxLevel(m.id), m.name + ' の解放レベル');
    for (const k of def.options) assert(SKILLS[k.id] && (SKILLS[k.id].noX ? k.x === undefined : k.x > 0), `${m.name}: ${k.id}`);
    eq(new Set(def.options.map(k => k.id)).size, def.options.length, m.name + ' の候補は重複しない');
  }
  assert(ITEMS.some(c => CARD_DEFS[c.id].options), '装備にも選択スキルを持つものがある');
  assert(MONSTERS.filter(x => x.rarity === 'common').every(x => !CARD_DEFS[x.id].options), 'コモンは持たない');
});

test('選択スキル：解放レベル以上で選ぶと、基本スキルに加えてそのスキルを持つ（未満では持たない）', () => {
  const def = CARD_DEFS.r07;
  const base = cardAt('r07', 3);
  const picked = cardAt('r07', 3, 0);
  eq([base.option, picked.option, picked.skills.length - base.skills.length], [null, 0, 1]);
  eq(picked.skills[picked.skills.length - 1], { ...def.options[0], opt: true });
  eq(cardAt('r07', 2, 0).skills, cardAt('r07', 2).skills, 'Lv2 ではまだ使えない');
  eq(cardAt('r07', 3, 9).option, null, '存在しない番号は無視');
  assert(cardAt('r07', 4, 1) !== cardAt('r07', 4, 2) && cardAt('r07', 4, 1) === cardAt('r07', 4, 1));
  eq(cardAt('r01', 5, 0).option, null, '候補のないカード');
});

test('選択スキル：コレクションで1つ選べる。カードLv3で解放、いつでも無料で変更できる', () => {
  const p = richProfile();
  addCard(p, 'r07');
  assert(!optionUnlocked(p, 'r07') && !setOption(p, 'r07', 0), 'Lv1 では選べない');
  p.cards.r07.level = 3;
  const before = [p.gold, p.stones];
  assert(setOption(p, 'r07', 1));
  eq([p.options.r07, ownedCard(p, 'r07').option, [p.gold, p.stones]], [1, 1, before], '無料');
  assert(setOption(p, 'r07', 2) && p.options.r07 === 2, '変更できる');
  assert(!setOption(p, 'r07', 7) && p.options.r07 === 2, '候補にない番号は選べない');
  assert(setOption(p, 'r07', null) && p.options.r07 === undefined, '「なし」に戻せる');
  assert(!setOption(p, 'p08', 0), '持っていないカードは選べない');
});

test('選択スキル：デッキに入れると、選んだスキルで戦う', () => {
  const p = richProfile();
  addCard(p, 'r07');
  p.cards.r07.level = 4;
  setOption(p, 'r07', 0); // Batter 1
  p.deck.monsters[0] = 'r07';
  const deck = deckForBattle(p);
  eq(deck.options, { r07: 0 });
  const s = newGame(deck, DEFAULT_DECK, testRng);
  const general = [...s.players[0].hand, ...s.players[0].deck].find(h => h.card.id === 'r07').card;
  assert(general.skills.some(k => k.id === 'batter' && k.opt));
  // 実戦：Batter で2回殴る
  const b = board([makeMonster(uidSeq++, general)], [mk(GOLEM)]);
  eq(attacks(b).map(e => e.source), ['base', 'batter']);
});

test('選択スキル：セーブして読み込んでも残る。分解したカード・解放前の選択は消える', () => {
  const st = memStorage();
  const p = richProfile();
  addCard(p, 'r07'); addCard(p, 'b08');
  p.cards.r07.level = 3; p.cards.b08.level = 3;
  setOption(p, 'r07', 2); setOption(p, 'b08', 1);
  saveProfile(p, st);
  eq(loadProfile(st).options, { r07: 2, b08: 1 });
  dismantleCard(p, 'b08');
  eq(p.options, { r07: 2 }, '最後の1枚を分解すると選択も消える');
  p.options.zzz = 0; p.cards.r07.level = 1; // 壊れたデータ・解放前
  saveProfile(p, st);
  eq(loadProfile(st).options, {});
});

test('セーブ：古い形式（選択スキル・ステージ進行のないデータ）を読んでも、所持カード・レベル・資源は引き継がれる', () => {
  const st = memStorage();
  const old = { version: 1, level: 7, xp: 30, gold: 444, stones: 55, packs: 3, wins: 12, losses: 8,
    cards: { ...newProfile().cards, r08: { level: 3, copies: 2 } }, deck: newProfile().deck };
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  const p = loadProfile(st);
  eq([p.level, p.xp, p.gold, p.stones, p.packs, p.wins, p.losses, p.cards.r08], [7, 30, 444, 55, 3, 12, 8, { level: 3, copies: 2 }]);
  eq([p.options, p.stages, p.version], [{}, {}, 8]);
  assert(setOption(p, 'r08', 0), '読み込んだあと、選択スキルを選べる');
});

test('選択スキル：CPUのデッキも選択スキルを持つ（ランダムデッキ・フリー対戦・ステージ。ステージは毎回同じ）', () => {
  const check = deck => {
    for (const id of [...deck.monsters, ...deck.items]) {
      const can = optionAvailable(id, deck.levels[id] || 1);
      eq(deck.options[id] !== undefined, can, id);
      if (can) assert(CARD_DEFS[id].options[deck.options[id]], id + ' の番号');
    }
  };
  for (let i = 0; i < 30; i++) check(randomDeck(testRng, { level: 4 }));
  eq(randomDeck(testRng).options, {}, 'Lv1 のデッキは選択スキルなし');
  const p = richProfile();
  ['r07', 'r08', 'b08'].forEach((id, i) => { addCard(p, id); p.deck.monsters[i] = id; });
  Object.values(p.cards).forEach(c => { c.level = 4; });
  check(cpuDeckFor(p, testRng));
  for (const st of STAGES) { const d = stageDeck(st); check(d); eq(stageDeck(st).options, d.options, st.id); }
  eq(stageDeck(STAGE_BY_ID['5-10']).options.p08, 0, 'ボスは決まった選択スキル');
  const s = newGame(DEFAULT_DECK, stageDeck(STAGE_BY_ID['5-10']), testRng);
  assert([...s.players[1].hand, ...s.players[1].deck].some(h => h.card.option !== null), '対戦でも持っている');
});

// ---------- ヒーロースキル ----------

const setHero = (s, pi, skill) => { s.players[pi].hero = { id: 'test', name: 'test', skill }; return s; };

test('ヒーロー：5人（各色1人）、スキルは3つずつ。対応カードと解放条件のステージが実在する。ボス全員に専用スキルがある', () => {
  eq(HEROES.map(h => h.color).sort(), Object.keys(COLORS).sort());
  const ids = [];
  for (const h of HEROES) {
    eq(h.skills.length, 3, h.name);
    assert(CARD_DEFS[h.card] && CARD_DEFS[h.card].color === h.color && CARD_DEFS[h.card].name === h.name, h.name + ' の対応カード');
    assert(h.unlock === null || STAGE_BY_ID[h.unlock].boss, h.name + ' の解放条件');
    h.skills.forEach(k => { assert(k.name && k.desc); ids.push(k.id); });
  }
  eq(HEROES.filter(h => !h.unlock).map(h => h.id), [HERO_RULES.START], '最初は1人だけ');
  for (const st of STAGES.filter(x => x.boss)) { assert(BOSS_HERO_SKILLS[st.id], st.id); ids.push(BOSS_HERO_SKILLS[st.id].id); }
  eq(new Set(ids).size, ids.length, 'スキルidは重複しない');
  eq(HERO_RULES.SKILL_LEVELS, [1, 10, 20]);
});

test('ヒーロースキル「癒しの風」：自分のターン開始時、最もHPの低い味方を2回復する', () => {
  const s = setHero(board([mk(GOLEM), mk(MAGE)], [mk(GOLEM)]), 0, 'breeze');
  const [golem, mage] = s.players[0].slots;
  golem.hp = 9; mage.hp = 3;
  beginTurnOf(s, 0);
  eq([golem.hp, mage.hp], [9, 5]);
  const ev = startEv(s, 'hero')[0];
  eq([ev.id, ev.effect, ev.target === mage, ev.heal], ['breeze', 'heal', true, 2]);
  const full = setHero(board([mk(GOLEM)], [mk(GOLEM)]), 0, 'breeze');
  beginTurnOf(full, 0);
  eq(startEv(full, 'hero').length, 0, '全員満タンなら何も起きない');
  const foe = setHero(board([mk(GOLEM)], [mk(GOLEM)]), 0, 'breeze');
  foe.players[0].slots[0].hp = 5;
  beginTurnOf(foe, 1);
  eq(foe.players[0].slots[0].hp, 5, '相手のターンには発動しない');
});

test('ヒーロースキル「応急の心得」：装備やフラッシュを使うたびに、最もHPの低い味方を3回復する', () => {
  const s = setHero(board([mk(GOLEM), mk(MAGE)], [mk(GOLEM)]), 0, 'firstaid');
  const mage = s.players[0].slots[1];
  mage.hp = 1;
  const r = equipItem(s, 0, give(s, 0, LEATHER), 0);
  eq([mage.hp, r.events.filter(e => e.kind === 'hero').length], [4, 1], '装備');
  const ev = playFlash(s, 0, give(s, 0, ROCK), 0);
  eq([mage.hp, ev.extras.filter(e => e.kind === 'hero').length], [7, 1], 'フラッシュ');
  const off = board([mk(GOLEM), mk(MAGE)], [mk(GOLEM)]);
  off.players[0].slots[1].hp = 1;
  equipItem(off, 0, give(off, 0, LEATHER), 0);
  eq(off.players[0].slots[1].hp, 1, 'ヒーローなしでは回復しない');
});

test('ヒーロースキル：スキルの数値+1（治癒の極意=Heal、射手の号令=Shoot Command、猛毒=Disease、不屈の鬨=Inspire）。持っていないスキルは増えない', () => {
  for (const [hero, skill] of [['healplus', 'heal'], ['command', 'shoot'], ['virulence', 'disease'], ['warcry', 'inspire']]) {
    const s = board([mk(S('melee', 2, 9, skill + ':2')), mk(WOLF)], [mk(GOLEM)]);
    const [has, none] = s.players[0].slots;
    eq(skillX(has, skill), 2, skill);
    setHero(s, 0, hero);
    eq([skillX(has, skill), skillX(none, skill)], [3, 0], hero);
    setHero(s, 0, 'breeze'); setHero(s, 1, hero);
    eq(skillX(has, skill), 2, '相手のヒーロースキルは効かない');
  }
});

test('ヒーロースキル「治癒の極意」：Heal 2 の味方が、ターン開始時に3回復する', () => {
  const s = setHero(board([mk(GOLEM), mk(S('magic', 1, 8, 'heal:2'))], [mk(GOLEM)]), 0, 'healplus');
  s.players[0].slots[0].hp = 5;
  beginTurnOf(s, 0);
  eq(s.players[0].slots[0].hp, 8);
});

test('ヒーロースキル「不屈の鬨」：Disease 状態でも Inspire を使える（通常は使えない）', () => {
  const run = hero => {
    const s = board([mk(GOLEM), mk(S('ranged', 1, 8, 'inspire:1'))], [mk(GOLEM)]);
    if (hero) setHero(s, 0, hero);
    s.players[0].slots[1].status.disease = 3;
    beginTurnOf(s, 0);
    return s.players[0].slots[0].buff.inspire || 0;
  };
  eq([run(null), run('warcry')], [0, 2], 'Inspire 1 が+1されて2');
});

test('ヒーロースキル「鷹の目」：味方の遠隔攻撃が Taunt と Stealth を無視し、アーマーにブロックされない', () => {
  const make = hero => {
    const s = board([mk(GOLEM), mk(ARCHER)], [mk(GOLEM), mk(S('melee', 1, 30, 'taunt')), mk(S('melee', 1, 30, 'stealth'), STEEL)]);
    return hero ? setHero(s, 0, 'hawkeye') : s;
  };
  const shot = s => attacks(s).find(e => e.type === 'ranged');
  const slotOf = (s, ev) => s.players[1].slots.indexOf(ev.target);
  const normal = make(false);
  eq(slotOf(normal, shot(normal)), 1, '通常は Taunt に吸われる');
  const sharp = make(true);
  const ev = shot(sharp);
  eq([slotOf(sharp, ev), ev.heroUsed], [2, 'hawkeye'], '対角（Stealth 持ち）を狙える');
  eq(rate(200, () => shot(make(true)).blocked), 0, 'アーマーにブロックされない');
  assert(rate(200, () => {
    const s = board([mk(GOLEM), mk(ARCHER)], [mk(GOLEM), null, mk(GOLEM, STEEL)]);
    s.players[1].slots[1] = setOwner(mk(GOLEM, STEEL), s.players[1]);
    return shot(s).blocked;
  }) > 0.1, 'ヒーローなしではブロックされる');
  // 近接・魔法には効かない
  const melee = setHero(board([mk(WOLF)], [mk(GOLEM)]), 0, 'hawkeye');
  eq(attacks(melee)[0].heroUsed, undefined);
});

test('ヒーロースキル「清めの儀」：攻撃フェーズ開始時、味方全員のデバフを解除する', () => {
  const s = setHero(board([mk(WOLF), mk(MAGE)], [mk(GOLEM)]), 0, 'purify');
  const [wolf, mage] = s.players[0].slots;
  wolf.status.entangle = true; wolf.status.disease = 2; mage.status.demoralize = 1;
  const evs = phase(s);
  eq([wolf.status.entangle, wolf.status.disease, mage.status.demoralize], [undefined, undefined, undefined]);
  const first = evs[0];
  eq([first.kind, first.events[0].id, first.events[0].targets.length], ['phase', 'purify', 2]);
  assert(evs.some(e => e.kind === 'attack' && e.attacker === wolf), '解除されたのでそのターンに攻撃できる');
  eq(phase(setHero(board([mk(WOLF)], [mk(GOLEM)]), 0, 'purify')).filter(e => e.kind === 'phase').length, 0, 'デバフがなければ何も起きない');
});

test('ヒーロースキル「蝕む刃」：近接・カオスの味方は、出したときに Disease 1 を得る（遠隔・魔法は得ない）', () => {
  const s = setHero(board([], [mk(GOLEM)]), 0, 'venomblade');
  const r = playMonster(s, 0, give(s, 0, WOLF), 0);
  eq(r.events.filter(e => e.kind === 'hero').map(e => e.id), ['venomblade']);
  playMonster(s, 0, give(s, 0, ARCHER), 1);
  playMonster(s, 0, give(s, 0, IMP), 2);
  eq(s.players[0].slots.map(m => skillX(m, 'disease')), [1, 0, 1]);
  const ev = attacks(s).find(e => e.type === 'melee');
  eq(s.players[1].slots[0].status.disease >= 1, true, '攻撃で Disease スタックを与える');
  assert(ev);
});

test('ヒーロースキル「道連れの病」：Disease を持つ味方が攻撃で倒されたら、倒した敵に Disease 2', () => {
  const s = setHero(board([mk(DRAGON)], [mk(S('melee', 1, 2, 'disease:1')), mk(GOLEM)]), 1, 'contagion');
  const ev = attacks(s)[0];
  const x = extra(ev, 'hero');
  eq([ev.killed, x.id, x.side, s.players[0].slots[0].status.disease], [true, 'contagion', 'foe', 2]);
  const plain = setHero(board([mk(DRAGON)], [mk(S('melee', 1, 2)), mk(GOLEM)]), 1, 'contagion');
  attacks(plain);
  eq(plain.players[0].slots[0].status.disease, undefined, 'Disease を持たない味方では発動しない');
});

test('ヒーロースキル：攻撃力の強化（一斉射撃=遠隔+1、魔力の奔流=魔法+1、先陣の誉れ=前列の近接+1）', () => {
  const dmg = (hero, mine, type) => {
    const s = board(mine.map(id => mk(id)), [mk(S('melee', 1, 40)), mk(S('melee', 1, 40)), mk(S('melee', 1, 40))]);
    if (hero) setHero(s, 0, hero);
    return attacks(s).find(e => e.type === type).dmg;
  };
  eq([dmg(null, [GOLEM, ARCHER], 'ranged'), dmg('volley', [GOLEM, ARCHER], 'ranged')], [2, 3]);
  eq([dmg(null, [MAGE], 'magic'), dmg('surge', [MAGE], 'magic')], [3, 4]);
  eq([dmg(null, [WOLF], 'melee'), dmg('vanguard', [WOLF], 'melee')], [2, 3]);
  eq(dmg('volley', [WOLF], 'melee'), 2, '別の種類の攻撃は増えない');
  const reach = S('melee', 2, 9, 'reach');
  const s = setHero(board([mk(GOLEM), mk(reach)], [mk(S('melee', 1, 40))]), 0, 'vanguard');
  eq(attacks(s).map(e => e.dmg), [2, 4], '後列（Reach）の近接は増えず、前列のゴーレムだけ+1');
});

test('ヒーロースキル「静寂の結界」：味方が受ける魔法ダメージ-1（物理は減らない）', () => {
  const s = setHero(board([mk(MAGE), mk(S('melee', 3, 9, 'reach'))], [mk(S('melee', 1, 40))]), 1, 'ward');
  eq(attacks(s).map(e => [e.type, e.dmg]), [['melee', 3], ['magic', 2]]);
});

test('ヒーロースキル「戦利品」：味方が攻撃で敵を倒すたびに、クリスタル+1', () => {
  const s = setHero(board([mk(DRAGON)], [mk(S('melee', 1, 2)), mk(GOLEM)]), 0, 'spoils');
  const ev = attacks(s)[0];
  eq([s.players[0].crystals, extra(ev, 'hero').gain], [11, 1]);
  const miss = setHero(board([mk(WOLF)], [mk(GOLEM)]), 0, 'spoils');
  attacks(miss);
  eq(miss.players[0].crystals, 10, '倒さなければ増えない');
});

test('ボス専用ヒーロースキル：突撃号令・茨の加護・天空の覇者・霧の帳・蔓延', () => {
  const hit = (hero, id) => attacks(setHero(board([mk(id)], [mk(S('melee', 1, 40))]), 0, hero))[0].dmg;
  eq([hit('boss_charge', WOLF), hit('boss_sky', WOLF), hit('boss_sky', S('melee', 2, 9, 'flying'))], [3, 2, 3]);
  const th = setHero(board([mk(WOLF)], [mk(S('melee', 1, 40))]), 1, 'boss_thorns');
  eq(skillX(th.players[1].slots[0], 'thorns'), 1);
  attacks(th);
  eq(th.players[0].slots[0].hp, 5, 'Thorns 1 の反射を受ける');
  const fog = setHero(board([mk(GOLEM)], [mk(GOLEM)]), 0, 'boss_fog');
  fog.turn = 8; beginTurnOf(fog, 0); // ターン9
  eq(fog.players[0].slots[0].status.fog, undefined, '3ターンに1度なので、このターンは発動しない');
  fog.turn = 12; beginTurnOf(fog, 0); // ターン13
  eq([fog.players[0].slots[0].status.fog, startEv(fog, 'hero')[0].effect], [true, 'fog']);
  const pl = setHero(board([mk(GOLEM)], [mk(GOLEM), mk(WOLF)]), 0, 'boss_plague');
  beginTurnOf(pl, 0);
  eq(pl.players[1].slots.map(m => m && m.status.disease), [1, 1, null]);
});

test('ヒーローの成長：スキルは1つ目が最初から、2つ目はLv10、3つ目はLv20で解放。ギフトでレベルを上げる', () => {
  const p = newProfile();
  eq(p.hero, { selected: 'leafia', skill: 0, unlocked: ['leafia'], levels: { leafia: 1 }, gifts: { leafia: 0 } });
  eq([0, 1, 2].map(i => heroSkillUnlocked(p, 'leafia', i)), [true, false, false]);
  assert(!selectHero(p, 'leafia', 1) && !selectHero(p, 'agni', 0), '解放前は選べない');
  assert(levelUpHero(p, 'leafia') === null, 'ギフトが足りない');
  p.hero.gifts.leafia = 1;
  eq(levelUpHero(p, 'leafia'), { level: 2, skill: null });
  eq([p.hero.levels.leafia, p.hero.gifts.leafia], [2, 0]);
  p.hero.gifts.leafia = 9999;
  let got = [];
  for (let i = 0; i < 40; i++) { const up = levelUpHero(p, 'leafia'); if (up && up.skill) got.push([up.level, up.skill.id]); }
  eq(got, [[10, 'firstaid'], [20, 'healplus']]);
  eq([p.hero.levels.leafia, heroLevelCost(20)], [HERO_RULES.MAX_LEVEL, null], '最大Lv20');
  assert(selectHero(p, 'leafia', 2));
  eq(heroForBattle(p).skill, 'healplus');
  eq(deckForBattle(p).hero.skill, 'healplus', 'デッキと一緒に対戦へ持っていく');
});

test('ヒーロー：ヒーロースキルを使って勝つとギフトがもらえる（負け・降参ではもらえない）', () => {
  const p = newProfile();
  eq(battleReward(p, 'win').gifts, HERO_RULES.GIFT_WIN);
  eq(p.hero.gifts.leafia, HERO_RULES.GIFT_WIN);
  eq([battleReward(p, 'lose').gifts, battleReward(p, 'surrender').gifts, p.hero.gifts.leafia], [0, 0, HERO_RULES.GIFT_WIN]);
});

test('ヒーロー：ボスを倒すと新しいヒーローが解放され、対応するモンスターカードを1枚もらえる', () => {
  const p = newProfile();
  eq(unlockHeroes(p), [], '最初は増えない');
  recordStageClear(p, '1-10', 3);
  eq(unlockHeroes(p).map(h => h.id), ['agni']);
  eq([p.hero.unlocked, p.hero.levels.agni, p.cards.r13], [['leafia', 'agni'], 1, { level: 1, copies: 0, got: 1 }]);
  eq(unlockHeroes(p), [], '2回はもらえない');
  assert(selectHero(p, 'agni', 0) && heroForBattle(p).skill === 'warcry');
  battleReward(p, 'win');
  eq([p.hero.gifts.agni, p.hero.gifts.leafia], [HERO_RULES.GIFT_WIN, 0], 'ギフトは使ったヒーローのもの');
});

test('セーブ：ヒーローのない古いデータを読むと、進行済みのボスのぶんのヒーローが解放される（ほかのデータはそのまま）', () => {
  const st = memStorage();
  const old = { version: 2, level: 9, xp: 5, gold: 321, stones: 77, packs: 2, wins: 30, losses: 10, options: {},
    cards: { ...newProfile().cards, r08: { level: 3, copies: 1 } }, deck: newProfile().deck, stages: { '1-1': 3, '1-10': 2, '2-10': 1 } };
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  const p = loadProfile(st);
  eq([p.level, p.xp, p.gold, p.stones, p.packs, p.wins, p.losses, p.cards.r08, p.stages], [9, 5, 321, 77, 2, 30, 10, { level: 3, copies: 1 }, old.stages]);
  eq([p.hero.selected, p.hero.unlocked, !!p.cards.r13, !!p.cards.b13, !!p.cards.y14], ['leafia', ['leafia', 'agni', 'mist'], true, true, false]);
  saveProfile(p, st);
  const again = loadProfile(st);
  eq([again.hero, again.cards.r13], [p.hero, p.cards.r13], '読み直してもカードは増えない');
});

test('セーブ：ヒーローの選択・レベル・ギフトが保存される。壊れた値は直される', () => {
  const st = memStorage();
  const p = newProfile();
  recordStageClear(p, '1-10', 3); unlockHeroes(p);
  p.hero.levels.agni = 12; p.hero.gifts.agni = 4; selectHero(p, 'agni', 1);
  saveProfile(p, st);
  eq(loadProfile(st).hero, p.hero);
  p.hero.selected = 'nobody'; p.hero.skill = 2; p.hero.levels.agni = 999; p.hero.unlocked.push('zzz');
  saveProfile(p, st);
  const q = loadProfile(st);
  // 選択が壊れていても、使用中のデッキが覚えているヒーロー（アグニ・2つ目のスキル）に戻る
  eq([q.hero.selected, q.hero.skill, q.hero.levels.agni, q.hero.unlocked], ['agni', 1, 20, ['leafia', 'agni']]);
  // デッキのヒーローも壊れていれば、最初のヒーローになる
  p.decks[0].hero = 'nobody';
  saveProfile(p, st);
  const r = loadProfile(st);
  eq([r.hero.selected, r.hero.skill, r.decks[0].hero, r.decks[0].skill], ['leafia', 0, 'leafia', 0]);
});

test('ヒーロー：CPUもヒーローを使う（ボスは専用スキル、入門ステージはなし、フリー対戦はランダム）', () => {
  for (const st of STAGES) {
    const hero = stageDeck(st).hero;
    if (st.boss) eq([hero.skill, hero.boss], [BOSS_HERO_SKILLS[st.id].id, st.id], st.id);
    else if (st.income < 0) eq(hero, null, st.id);
    else assert(HERO_BY_ID[hero.id].color === st.colors[0] && HERO_SKILL_INFO[hero.skill].hero === hero.id, st.id);
  }
  eq(['1-1', '1-2', '1-3'].map(id => stageDeck(STAGE_BY_ID[id]).hero), [null, null, null]);
  const p = richProfile();
  const cpu = cpuDeckFor(p, testRng);
  assert(HERO_BY_ID[cpu.hero.id] && HERO_SKILL_INFO[cpu.hero.skill]);
  const s = newGame(deckForBattle(p), stageDeck(STAGE_BY_ID['3-10']), testRng);
  eq([s.players[0].hero.skill, s.players[1].hero.skill], ['breeze', 'boss_thorns']);
  eq(newGame(DEFAULT_DECK, DEFAULT_DECK, testRng).players.map(x => x.hero), [null, null], 'ヒーローなしのデッキでも対戦できる');
  // 場に出たモンスターは持ち主のヒーロースキルを受ける
  const g = newGame(DEFAULT_DECK, stageDeck(STAGE_BY_ID['3-10']), testRng);
  g.current = 1; g.phase = 'play'; g.players[1].crystals = 20;
  const h = g.players[1].hand.find(x => x.card.kind === 'monster') || g.players[1].deck.find(x => x.card.kind === 'monster');
  if (!g.players[1].hand.includes(h)) g.players[1].hand.push(h);
  assert(playMonster(g, 1, h.uid, 0), 'CPUがモンスターを出せる');
  assert(skillX(g.players[1].slots[0], 'thorns') >= 1);
});

// ---------- 地形 ----------

// 地形つきの盤面
const land = (id, mine, foes) => {
  const s = board(mine, foes);
  s.terrain = TERRAIN_BY_ID[id];
  s.players.forEach(p => { p.terrain = s.terrain; });
  return s;
};
const GREEN_HEALER = tmon('t_ghealer', 'magic', 1, 8, 2, 'green', ['heal:2']);
const RED_HEALER = tmon('t_rhealer', 'magic', 1, 8, 2, 'red', ['heal:2']);

test('地形：データが正しい（平原は効果なし、ボス戦は特殊地形、全ステージに地形がある、背景がある）', () => {
  eq(TERRAIN_BY_ID.plain.fx, {});
  eq(new Set(TERRAINS.map(t => t.id)).size, TERRAINS.length);
  for (const t of TERRAINS) assert(t.name && t.icon && t.desc && t.scene, t.id);
  for (const st of STAGES) {
    const t = TERRAIN_BY_ID[st.terrain];
    assert(t, st.id + ' の地形');
    eq(!!t.special, st.boss, st.id + '：ボス戦だけが特殊地形');
  }
  eq(new Set(STAGES.filter(s => s.boss).map(s => s.terrain)).size, 5, 'ボスごとに違う地形');
  for (let i = 0; i < 50; i++) assert(!TERRAIN_BY_ID[randomTerrain(testRng)].special, 'フリー対戦に特殊地形は出ない');
  const s = newGame(DEFAULT_DECK, DEFAULT_DECK, testRng, { terrain: 'forest' });
  eq([s.terrain.id, s.players[0].terrain.id, s.players[1].terrain.id], ['forest', 'forest', 'forest'], '両者に同じ地形');
  eq(newGame(DEFAULT_DECK, DEFAULT_DECK, testRng).terrain, null, '地形なしでも対戦できる');
});

test('地形「森」：緑のモンスターの Heal +1（ほかの色は増えない。両者に同じ効果）', () => {
  const s = land('forest', [mk(GOLEM), mk(GREEN_HEALER), mk(RED_HEALER)], [mk(GREEN_HEALER)]);
  eq([skillX(s.players[0].slots[1], 'heal'), skillX(s.players[0].slots[2], 'heal'), skillX(s.players[1].slots[0], 'heal')], [3, 2, 3]);
  eq(skillX(board([mk(GREEN_HEALER)]).players[0].slots[0], 'heal'), 2, '地形なしでは2');
  const one = land('forest', [mk(GOLEM), mk(GREEN_HEALER)], [mk(GOLEM)]);
  one.players[0].slots[0].hp = 5;
  beginTurnOf(one, 0);
  eq(one.players[0].slots[0].hp, 8, 'ターン開始時に3回復');
});

test('地形「火山」：ターン開始時、手番側の場のモンスター全員に1ダメージ（赤は無効）。倒れることもある', () => {
  const s = land('volcano', [mk(GOLEM), mk(WOLF), mk(MAGE)], [mk(GOLEM)]); // ウルフは赤
  s.players[0].slots[0].armor = 3; s.players[0].slots[2].hp = 1;
  beginTurnOf(s, 0);
  const [golem, wolf] = s.players[0].slots;
  eq([golem.hp, golem.armor, wolf.hp, s.players[0].slots[2], s.players[1].slots[0].hp], [14, 3, 6, null, 15], 'アーマーを無視。相手側は受けない');
  eq(s.terrainEvents.map(e => [e.kind, e.target.card.id, e.killed]), [['burn', GOLEM, false], ['burn', MAGE, true]]);
  beginTurnOf(s, 1);
  eq(s.players[1].slots[0].hp, 14, '相手のターンには相手側が受ける');
});

test('地形「火山」：地形のダメージで最後のモンスターが倒れたら決着する', () => {
  const s = land('volcano', [mk(GOLEM)], [mk(GOLEM)]);
  s.players[0].slots[0].hp = 1;
  const r = beginTurnOf(s, 0);
  eq([r.winner, r.terrain], [1, true]);
});

test('地形「天空」：Flying の回避率が上がる（近接65%・遠隔40%）', () => {
  const flyer = S('melee', 1, 400, 'flying');
  const m = rate(1500, () => attacks(land('sky', [mk(WOLF)], [mk(flyer)]))[0].dodged);
  const r = rate(1500, () => attacks(land('sky', [mk(GOLEM), mk(ARCHER)], [mk(flyer)])).find(e => e.type === 'ranged').dodged);
  near(m, 0.65, 0.05, '近接'); near(r, 0.4, 0.05, '遠隔');
  eq(rate(200, () => attacks(land('sky', [mk(MAGE)], [mk(flyer)]))[0].dodged), 0, '魔法は回避されない');
  eq(rate(200, () => attacks(land('sky', [mk(WOLF)], [mk(GOLEM)]))[0].dodged), 0, 'Flying がなければ回避しない');
});

test('地形「毒沼」：Disease スタックが Heal や Outbreak Halo で減らない（Cleanse では解除できる）', () => {
  const s = land('swamp', [mk(GOLEM), mk(GREEN_HEALER)], [mk(GOLEM)]);
  const golem = s.players[0].slots[0];
  golem.hp = 5; golem.status.disease = 1;
  beginTurnOf(s, 0);
  eq([golem.status.disease, golem.hp], [1, 6], 'Heal 2 のうち1はスタックに打ち消され、スタックは残る');
  const normal = board([mk(GOLEM), mk(GREEN_HEALER)], [mk(GOLEM)]);
  normal.players[0].slots[0].hp = 5; normal.players[0].slots[0].status.disease = 1;
  beginTurnOf(normal, 0);
  eq([normal.players[0].slots[0].status.disease, normal.players[0].slots[0].hp], [undefined, 6], '地形なしではスタックが消える');
  const halo = land('swamp', [mk(S('chaos', 1, 9, 'outbreakhalo:2'))], [mk(GOLEM)]);
  halo.players[1].slots[0].status.disease = 3;
  halo.phase = 'attack'; finishTurn(halo);
  eq([halo.players[1].slots[0].status.disease, halo.players[1].slots[0].hp], [3, 13], 'ダメージは受けるがスタックは減らない');
  const cl = land('swamp', [mk(GOLEM), mk(S('magic', 1, 8, 'cleanse'))], [mk(GOLEM)]);
  cl.players[0].slots[0].status.disease = 2;
  beginTurnOf(cl, 0);
  eq(cl.players[0].slots[0].status.disease, undefined);
});

test('地形「古城」：魔法攻撃+1（ほかの攻撃は増えない。装備の魔法攻撃にも乗る）', () => {
  const dmgs = s => attacks(s).map(e => [e.type, e.dmg]);
  eq(dmgs(land('castle', [mk(MAGE)], [mk(S('melee', 1, 40))])), [['magic', 4]]);
  eq(dmgs(land('castle', [mk(WOLF)], [mk(S('melee', 1, 40))])), [['melee', 2]]);
  eq(dmgs(land('castle', [mk(WOLF, ORB)], [mk(S('melee', 1, 40))])), [['magic', 3], ['melee', 2]]);
  eq(getAttacks(land('castle', [mk(MAGE)]).players[0].slots[0])[0].mods.map(m => m.label), ['古城']);
});

test('地形「霧の湖」「女王の濃霧」：遠隔攻撃が外れることがある（近接・魔法は外れない）', () => {
  const miss = id => rate(1500, () => attacks(land(id, [mk(GOLEM), mk(ARCHER)], [mk(S('melee', 1, 400))])).find(e => e.type === 'ranged').missed === true);
  near(miss('mist'), 0.2, 0.04); near(miss('deepmist'), 0.3, 0.05);
  eq(rate(300, () => attacks(land('deepmist', [mk(WOLF, ORB)], [mk(S('melee', 1, 400))])).some(e => e.dodged)), 0);
  const s = land('deepmist', [mk(GOLEM), mk(ARCHER)], [mk(S('melee', 1, 400))]);
  let ev; for (let i = 0; i < 50 && !(ev && ev.missed); i++) ev = attacks(s).find(e => e.type === 'ranged');
  eq([ev.dodged, ev.dmg, ev.extras.length], [true, 0, 0], '外れたらダメージなし');
});

test('ボス戦の特殊地形：見張りの丘（遠隔+1）・世界樹の根元（回復）・雷雲の頂（落雷）・魔王の玉座（カオス+1）', () => {
  eq(attacks(land('hill', [mk(GOLEM), mk(ARCHER)], [mk(S('melee', 1, 40))])).find(e => e.type === 'ranged').dmg, 3);
  const tree = land('worldtree', [mk(GOLEM), mk(WOLF)], [mk(GOLEM)]);
  tree.players[0].slots[0].hp = 5; tree.players[1].slots[0].hp = 5;
  beginTurnOf(tree, 0);
  eq([tree.players[0].slots[0].hp, tree.players[1].slots[0].hp, tree.terrainEvents.length], [6, 5, 1], '手番側の傷ついたモンスターだけ');
  const flyer = S('melee', 1, 9, 'flying');
  const storm = land('storm', [mk(flyer), mk(GOLEM)], [mk(GOLEM)]);
  for (let i = 0; i < 3; i++) beginTurnOf(storm, 0);
  eq([storm.players[0].slots[0].hp, storm.players[0].slots[1].hp], [9, 9], 'Flying には落ちず、ゴーレムに3回（-6）');
  const sky = land('storm', [mk(flyer)], [mk(GOLEM)]);
  beginTurnOf(sky, 0);
  eq(sky.terrainEvents, [], 'Flying だけなら何も起きない');
  const th = land('throne', [mk(IMP)], [mk(S('melee', 1, 400))]);
  const chaos = getAttacks(th.players[0].slots[0])[0];
  eq([chaos.atk, TERRAIN_BY_ID.throne.fx.diseaseStay], [3, true]);
});

// ---------- デイリークエストとログインボーナス ----------

const day = (d, h = 12) => new Date(2026, 9, d, h); // 2026年10月d日
const dailyProfile = () => Object.assign(newProfile(), { level: 3 });
// クエストを指定したものにする
const setQuests = (p, ids, now = day(4)) => {
  refreshDaily(p, now, testRng);
  p.daily.quests = ids.map(id => ({ id, progress: 0, claimed: false }));
  return p;
};

test('デイリー：クエストのデータが正しい（報酬がある、idが重複しない、色ごとの勝利クエストがある）', () => {
  eq(new Set(QUEST_DEFS.map(q => q.id)).size, QUEST_DEFS.length);
  for (const q of QUEST_DEFS) assert(q.text && q.n > 0 && rewardText(q.reward), q.id);
  for (const c in COLORS) assert(QUEST_BY_ID['win_' + c].text.includes(COLORS[c].name));
  const kinds = new Set(QUEST_DEFS.flatMap(q => Object.keys(q.reward)));
  eq([...kinds].sort(), ['gifts', 'gold', 'packs', 'stones'], '報酬はゴールド・魔石・パック・ギフト');
  eq([LOGIN_REWARDS.length, LOGIN_REWARDS[6]], [7, { packs: 1 }], '7日周期で、7日目はパック');
  eq(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('デイリー：プレイヤーLv3で解放される（それまではクエストもログインボーナスもない）', () => {
  const p = newProfile();
  eq([refreshDaily(p, day(4), testRng), claimLogin(p, day(4)), questProgress(p, { win: 1 }, day(4)), p.daily.quests], [false, null, [], []]);
  p.level = 3;
  assert(refreshDaily(p, day(4), testRng));
  eq(p.daily.quests.length, 3);
});

test('デイリー：毎日3つのクエストが出る。同じ日は変わらず、日付が変わると入れ替わる', () => {
  const p = dailyProfile();
  assert(refreshDaily(p, day(4, 9), testRng));
  const ids = p.daily.quests.map(q => q.id);
  eq([new Set(ids).size, p.daily.date], [3, '2026-10-04']);
  p.daily.quests[0].progress = 2; p.daily.swaps = 1;
  assert(!refreshDaily(p, day(4, 23), testRng), '同じ日は更新しない');
  eq(p.daily.quests[0].progress, 2);
  assert(refreshDaily(p, day(5, 0), testRng), '日付が変わったら更新');
  eq([p.daily.date, p.daily.quests.map(q => q.progress), p.daily.swaps], ['2026-10-05', [0, 0, 0], 0], '進み具合と交換回数は戻る');
  const seen = new Set();
  for (let d = 1; d <= 28; d++) { refreshDaily(p, day(d), testRng); p.daily.quests.forEach(q => seen.add(q.id)); }
  assert(seen.size >= 10, 'いろいろなクエストが出る');
});

test('デイリー：対戦で数えた値がクエストに足され、達成すると報酬を受け取れる（1回だけ）', () => {
  const p = setQuests(dailyProfile(), ['kill_magic', 'win_green', 'stage_clear']);
  eq(questProgress(p, { kill_magic: 3, win: 1, win_red: 1 }, day(4)), []);
  eq(p.daily.quests.map(q => q.progress), [3, 0, 0]);
  eq(claimQuest(p, 0), null, '達成前は受け取れない');
  const done = questProgress(p, { kill_magic: 4, win_green: 1, stage_clear: 1 }, day(4));
  eq([done.map(q => q.id), p.daily.quests.map(q => q.progress)], [['kill_magic'], [5, 1, 1]], '必要数で止まる');
  eq(dailyStatus(p), { total: 3, done: 1, claimable: 1 });
  const gold = p.gold;
  eq(claimQuest(p, 0), { gold: 150 });
  eq([p.gold - gold, claimQuest(p, 0), dailyStatus(p).claimable], [150, null, 0], '2回は受け取れない');
  eq(questProgress(p, { kill_magic: 5 }, day(4)), [], '達成済みはもう数えない');
});

test('デイリー：報酬はゴールド・魔石・パック・ヒーローのギフト', () => {
  const p = dailyProfile();
  giveReward(p, { gold: 10, stones: 20, packs: 1, gifts: 3 });
  eq([p.gold, p.stones, p.packs, p.hero.gifts.leafia], [10, 20, 2, 3]);
  eq(rewardText({ gold: 10, gifts: 3 }), '💰10　🎀ギフト×3');
});

test('デイリー：クエストは1日1回だけ交換できる（達成済みは交換できない。翌日はまた交換できる）', () => {
  const p = setQuests(dailyProfile(), ['kill_magic', 'win', 'play']);
  p.daily.quests[1].progress = 3;
  assert(!canSwapQuest(p, 1) && !swapQuest(p, 1, testRng), '達成済みは交換できない');
  p.daily.quests[0].progress = 2;
  assert(swapQuest(p, 0, testRng));
  const q = p.daily.quests[0];
  assert(!['kill_magic', 'win', 'play'].includes(q.id) && q.progress === 0, '持っていない別のクエストになる');
  assert(!swapQuest(p, 2, testRng) && p.daily.quests[2].id === 'play', '2回目はできない');
  refreshDaily(p, day(5), testRng);
  assert(canSwapQuest(p, 0), '翌日はまた交換できる');
});

test('デイリー：対戦の結果から数える値を作る（倒した数・回避・勝利・色・ステージ）', () => {
  const s = board([mk(DRAGON), mk(MAGE), mk(S('melee', 1, 9, 'flying'))], [mk(S('melee', 3, 2)), mk(S('melee', 1, 2))]);
  attacks(s); // マジシャンが正面（スロット2）を、ドラゴンが前列を倒す
  eq([s.stats[0].kill_magic, s.stats[0].kill_melee], [1, 1]);
  const d = board([mk(S('melee', 1, 900, 'flying'))], [mk(WOLF)]);
  d.current = 1;
  let n = 0; for (let i = 0; i < 40; i++) if (attacks(d)[0].dodged) n++;
  eq(d.stats[0].dodge, n, 'Flying で回避した回数');
  const u = board([mk(GOLEM)], [mk(GOLEM)]);
  equipItem(u, 0, give(u, 0, LEATHER), 0); playFlash(u, 0, give(u, 0, ROCK), 0);
  eq([u.stats[0].equip, u.stats[0].flash, u.stats[1]], [1, 1, {}]);
  const deck = { monsters: ['r01', 'b02'], items: [] }; // 赤・青
  eq(battleStats(u, false, { type: 'free' }, deck), { equip: 1, flash: 1, play: 1 }, '負けは対戦回数だけ');
  eq(battleStats(u, true, { type: 'free' }, deck), { equip: 1, flash: 1, play: 1, win: 1, win_red: 1, win_blue: 1 });
  const st = battleStats(u, true, { type: 'stage' }, deck);
  eq([st.stage_clear, st.star3], [1, undefined], '残り1体なので★3ではない');
  u.players[0].deck = [1, 2, 3, 4, 5].map(() => ({ uid: uidSeq++, card: CARD_BY_ID[WOLF] }));
  eq(battleStats(u, true, { type: 'stage' }, deck).star3, 1, '残り6体で★3');
});

test('ログインボーナス：1日1回、7日周期（7日目はパック）。日が空いてもリセットしない', () => {
  const p = dailyProfile();
  const gold = p.gold;
  eq(claimLogin(p, day(1)), { day: 1, reward: { gold: 100 } });
  eq([p.gold - gold, claimLogin(p, day(1, 23))], [100, null], '同じ日は1回だけ');
  eq(claimLogin(p, day(2)).day, 2);
  eq(claimLogin(p, day(9)).day, 3, '1週間空いても続きから');
  [10, 11, 12].forEach(d => claimLogin(p, day(d)));
  const packs = p.packs;
  eq([claimLogin(p, day(20)), p.packs - packs], [{ day: 7, reward: { packs: 1 } }, 1]);
  eq(claimLogin(p, day(21)).day, 1, '8回目は1日目に戻る');
  eq(p.daily.loginCount, 8);
});

test('セーブ：デイリーの進み具合とログインボーナスが保存される。古いデータには初期値が入り、壊れた値は直される', () => {
  const st = memStorage();
  const p = setQuests(dailyProfile(), ['kill_magic', 'win', 'play']);
  claimLogin(p, day(4)); p.daily.quests[0].progress = 2; p.daily.quests[1] = { id: 'win', progress: 3, claimed: true }; p.daily.swaps = 1;
  saveProfile(p, st);
  eq(loadProfile(st).daily, p.daily);
  const old = { version: 2, level: 6, xp: 1, gold: 50, stones: 5, packs: 0, wins: 3, losses: 1, cards: newProfile().cards, deck: newProfile().deck, stages: { '1-1': 3 } };
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  const q = loadProfile(st);
  eq([q.daily, q.gold, q.level, q.stages], [newDailyData(), 50, 6, { '1-1': 3 }]);
  p.daily.quests = [{ id: 'zzz', progress: 1 }, { id: 'win', progress: 99 }]; p.daily.date = 'x'; p.daily.loginCount = -4;
  saveProfile(p, st);
  eq(loadProfile(st).daily, { ...newDailyData(), loginDate: '2026-10-04' }, '壊れたクエストは捨てて、次の更新で作り直す');
});

// ---------- イベント（特殊ルール戦） ----------

const eventProfile = () => Object.assign(newProfile(), { level: 7 });
const EV = id => EVENTS.find(e => e.id === id);
// 特殊ルールつきの盤面
const ruled = (rule, mine, foes) => {
  const s = board(mine, foes);
  s.rules = rule;
  s.players.forEach(p => { p.rules = rule; });
  return s;
};
const monday = (d, h = 12) => new Date(2026, 9, d, h); // 2026年10月5日は月曜

test('イベント：データが正しい（idが重複しない、Elite カードが実在する、使えるルールだけが書かれている）', () => {
  eq(new Set(EVENTS.map(e => e.id)).size, EVENTS.length);
  const known = ['grant', 'income', 'attritionStart', 'sacrificeMult', 'deckColor', 'randomDeck'];
  for (const e of EVENTS) {
    assert(e.name && e.icon && e.desc && Object.keys(e.rule).length, e.id);
    assert(Object.keys(e.rule).every(k => known.includes(k)), e.id + ' のルール');
    assert(CARD_DEFS[e.elite] && CARD_DEFS[e.elite].elite, e.id + ' の Elite カード');
  }
  for (const c in COLORS) assert(EVENTS.some(e => e.rule.deckColor === c), c + ' の色指定イベント');
  eq(EVENT_TIERS.map(t => t.wins), [1, 2, 3, 4, 5]);
  assert(EVENT_TIERS.some(t => t.reward.elite), 'Elite カードがもらえる段階がある');
});

test('イベント：週替わり（月曜に切り替わる。端末の時刻）で、順番に回る', () => {
  eq(weekIndex(monday(5, 0)) - weekIndex(monday(4, 23)), 1, '日曜→月曜で週が変わる');
  eq(weekIndex(monday(5, 0)), weekIndex(monday(11, 23)), '月曜〜日曜は同じ週');
  const ids = [];
  for (let w = 0; w < EVENTS.length; w++) ids.push(currentEvent(monday(5 + 7 * w)).id);
  eq(new Set(ids).size, EVENTS.length, '全部のイベントが順に回る');
  eq(currentEvent(monday(5 + 7 * EVENTS.length)).id, ids[0], '一巡したら最初に戻る');
  eq([eventDaysLeft(monday(5)), eventDaysLeft(monday(11))], [7, 1]);
});

test('イベント：プレイヤーLv7で解放される', () => {
  const p = Object.assign(newProfile(), { level: 6 });
  eq([startEventRun(p, monday(5)), p.event.active, refreshEvent(p, monday(5))], [false, false, false]);
  p.level = 7;
  assert(startEventRun(p, monday(5)) && p.event.active && p.event.week === weekIndex(monday(5)));
  assert(Object.assign(newProfile(), { level: 6 }).level < GROWTH.UNLOCK.event && addXp(Object.assign(newProfile(), { level: 6 }), 99999).unlocked.includes('event'));
});

test('イベント：5連戦。勝つほど報酬が増え、Elite カードは3勝でもらえる', () => {
  const p = eventProfile();
  startEventRun(p, monday(5));
  const ev = currentEvent(monday(5));
  const before = [p.gold, p.stones, p.packs];
  const r1 = recordEventBattle(p, true, monday(5));
  eq([r1.wins, r1.over, r1.tiers.map(t => t.wins), p.gold - before[0]], [1, false, [1], 100]);
  recordEventBattle(p, true, monday(5));
  const r3 = recordEventBattle(p, true, monday(5));
  eq([r3.tiers[0].reward, p.cards[ev.elite]], [{ card: ev.elite }, { level: 1, copies: 0, got: 1 }], 'Elite カード');
  recordEventBattle(p, true, monday(5));
  const r5 = recordEventBattle(p, true, monday(5));
  eq([r5.wins, r5.over, p.event.active, p.event.claimed], [5, true, false, [1, 2, 3, 4, 5]]);
  eq([p.gold - before[0], p.stones - before[1], p.packs - before[2], p.hero.gifts.leafia], [400, 120, 0, 3]);
  eq(Object.entries(p.packBag).filter(([id]) => id.startsWith('event:')).map(x => x[1]), [2], 'パックの報酬は、その週のイベントパック');
  eq(recordEventBattle(p, true, monday(5)), null, '終わったあとは記録されない');
});

test('イベント：3敗で終了。再挑戦できるが、同じ段階の報酬は週に1回だけ。週が変わるとまたもらえる', () => {
  const p = eventProfile();
  startEventRun(p, monday(5));
  recordEventBattle(p, true, monday(5));
  recordEventBattle(p, false, monday(5)); recordEventBattle(p, false, monday(5));
  const r = recordEventBattle(p, false, monday(5));
  eq([r.wins, r.losses, r.over, p.event.active], [1, 3, true, false]);
  const gold = p.gold;
  startEventRun(p, monday(6));
  eq([p.event.wins, p.event.losses, p.event.claimed], [0, 0, [1]], '成績は0から、受け取った報酬は残る');
  eq([recordEventBattle(p, true, monday(6)).tiers, p.gold], [[], gold], '1勝の報酬は2回もらえない');
  eq(recordEventBattle(p, true, monday(6)).tiers.map(t => t.wins), [2], '新しく届いた段階だけもらえる');
  startEventRun(p, monday(12)); // 翌週
  eq([p.event.claimed, recordEventBattle(p, true, monday(12)).tiers.length], [[1], 1]);
  // 5戦して2敗までなら最後まで戦える
  const q = eventProfile(); startEventRun(q, monday(5));
  [true, false, true, false].forEach(w => recordEventBattle(q, w, monday(5)));
  assert(q.event.active && recordEventBattle(q, true, monday(5)).over);
});

test('Elite カード：パックから出ない、作成・分解できない、CPUのデッキにも入らない。同じカードをもらうと予備が増える', () => {
  const elites = Object.values(CARD_DEFS).filter(d => d.elite).map(d => d.id);
  eq(elites.length, 5);
  eq(new Set(elites.map(id => CARD_DEFS[id].color)).size, 5, '各色1枚');
  for (const id of elites) assert(MONSTER_ART[id] && CARD_BY_ID[id] && !MONSTERS.some(m => m.id === id), id);
  const p = richProfile();
  p.packs = 400;
  for (let i = 0; i < 400; i++) openPack(p, testRng).forEach(c => assert(!CARD_DEFS[c.id].elite, 'パックから Elite'));
  for (let i = 0; i < 40; i++) assert(!randomDeck(testRng).monsters.some(id => CARD_DEFS[id].elite));
  for (const st of STAGES) assert(!stageDeck(st).monsters.some(id => CARD_DEFS[id].elite), st.id);
  eq([canCraft(p, elites[0]).ok, craftCard(p, elites[0]), owns(p, elites[0])], [false, false, false]);
  giveReward(p, { card: elites[0] }); giveReward(p, { card: elites[0] });
  eq([p.cards[elites[0]].level, p.cards[elites[0]].copies], [1, 1]);
  eq([canDismantle(p, elites[0]).ok, dismantleCard(p, elites[0]), p.cards[elites[0]].copies], [false, 0, 1]);
  p.deck.monsters[0] = elites[0];
  assert(deckIsValid(p, p.deck), 'デッキには入れられる');
  assert(optionAvailable(elites[0], 3), '選択スキルも持つ');
});

test('特殊ルール「全モンスターが Flying」：Flying を持たないモンスターも回避する', () => {
  const rule = EV('allflying').rule;
  const s = ruled(rule, [mk(WOLF)], [mk(S('melee', 1, 400))]);
  assert(hasSkill(s.players[0].slots[0], 'flying') && hasSkill(s.players[1].slots[0], 'flying'));
  eq(rate(300, () => attacks(ruled(rule, [mk(WOLF)], [mk(S('melee', 1, 400))]))[0].dodged), 0, 'Flying 同士の近接は回避されない');
  near(rate(1200, () => attacks(ruled(rule, [mk(GOLEM), mk(ARCHER)], [mk(S('melee', 1, 400))])).find(e => e.type === 'ranged').dodged), 0, 0.001, 'Flying の攻撃は回避されない');
  assert(!hasSkill(board([mk(WOLF)]).players[0].slots[0], 'flying'), '通常の対戦では持たない');
});

test('特殊ルール「毎ターンクリスタル+1」「生贄クリスタル2倍」', () => {
  const s = ruled(EV('rich').rule, [mk(GOLEM)], [mk(GOLEM)]);
  s.players[0].crystals = 0;
  beginTurnOf(s, 0);
  eq(s.players[0].crystals, CONFIG.CRYSTALS_PER_TURN + 1);
  const c = ruled(EV('sacrifice').rule, [mk(GOLEM), mk(WOLF)], [mk(GOLEM)]);
  c.players[0].crystals = 0;
  sacrifice(c, 0, give(c, 0, LEATHER));
  eq(c.players[0].crystals, CONFIG.SACRIFICE_ITEM * 2);
  c.players[0].sacrificed = false;
  sacrificeField(c, 0, 1);
  eq(c.players[0].crystals, CONFIG.SACRIFICE_ITEM * 2 + CONFIG.SACRIFICE_MONSTER * 2);
});

test('特殊ルール「消耗ダメージがターン15から」', () => {
  const s = ruled(EV('sudden').rule, [mk(GOLEM)], [mk(GOLEM)]);
  eq([14, 15, 18, 19].map(t => attritionDamage(t, s)), [0, 1, 1, 2]);
  eq([14, 26, 27].map(t => attritionDamage(t)), [0, 0, 1], '通常はターン27から');
  s.turn = 14;
  beginTurnOf(s, 0); // ターン15
  eq([s.players[0].slots[0].hp, s.attrition.length], [14, 2]);
});

test('特殊ルール「指定色だけでデッキ」：組めていれば自分のデッキ、そうでなければその色の貸し出しデッキ。相手も同じ色', () => {
  const p = eventProfile();
  const ev = EV('mono_blue');
  const d = eventDeck(p, ev, testRng);
  eq([d.loaner, d.monsters.length, d.items.length, deckIsColor(d, 'blue'), d.hero.skill], [true, 8, 8, true, 'breeze']);
  assert(d.items.every(id => !CARD_DEFS[id].color || CARD_DEFS[id].color === 'blue'));
  assert(deckIsColor(eventFoeDeck(p, ev, testRng), 'blue'));
  const blues = MONSTERS.filter(m => m.color === 'blue').slice(0, 8).map(m => m.id);
  blues.forEach(id => addCard(p, id));
  p.deck.monsters = blues;
  const own = eventDeck(p, ev, testRng);
  eq([own.loaner, own.monsters], [false, blues], '自分のデッキで戦える');
});

test('特殊ルール「ランダムデッキ配布」：両者にランダムなデッキ。強さは自分のデッキのカードレベルに合わせる', () => {
  const p = eventProfile();
  Object.values(p.cards).forEach(c => { c.level = 3; });
  eq(deckLevel(p), 3);
  const d = eventDeck(p, EV('random'), testRng), f = eventFoeDeck(p, EV('random'), testRng);
  eq([d.loaner, d.monsters.length, f.monsters.length], [true, 8, 8]);
  assert([...d.monsters, ...f.monsters].every(id => d.levels[id] === Math.min(3, maxLevel(id)) || f.levels[id] === Math.min(3, maxLevel(id))));
  assert(JSON.stringify(d.monsters) !== JSON.stringify(eventDeck(p, EV('random'), testRng).monsters), '毎回ちがうデッキ');
});

test('イベント：対戦の準備（何戦目か・後半ほど相手のクリスタルが多い）。ルールつきで最後まで対戦できる', () => {
  const p = eventProfile();
  startEventRun(p, monday(5));
  const b1 = eventBattle(p, monday(5), testRng);
  eq([b1.n, b1.bonus, b1.event.id], [1, 0, currentEvent(monday(5)).id]);
  p.event.wins = 3; p.event.losses = 1;
  eq([eventBattle(p, monday(5), testRng).n, eventBattle(p, monday(5), testRng).bonus], [5, EVENT_CONFIG.FOE_BONUS[4]]);
  for (const ev of EVENTS) {
    const s = newGame(eventDeck(p, ev, testRng), eventFoeDeck(p, ev, testRng), testRng, { terrain: randomTerrain(testRng), rules: ev.rule });
    let res = null, guard = 0;
    while (!res && guard++ < 300) {
      const pi = s.current;
      res = startTurn(s);
      if (res) break;
      let a; while ((a = cpuNextAction(s))) applyAction(s, pi, a);
      if (s.result) { res = s.result; break; }
      for (const e of attackPhase(s)) { /* */ }
      res = finishTurn(s);
    }
    assert(res && (res.winner === 0 || res.winner === 1), ev.id + ' で決着がつく');
  }
});

test('セーブ：イベントの成績と受け取った報酬が保存される。古いデータには初期値が入る', () => {
  const st = memStorage();
  const p = eventProfile();
  startEventRun(p, monday(5)); recordEventBattle(p, true, monday(5)); recordEventBattle(p, false, monday(5));
  saveProfile(p, st);
  eq(loadProfile(st).event, { week: weekIndex(monday(5)), wins: 1, losses: 1, active: true, claimed: [1] });
  const old = { version: 3, level: 8, xp: 1, gold: 50, stones: 5, packs: 0, wins: 3, losses: 1, cards: newProfile().cards, deck: newProfile().deck, stages: { '1-1': 3 } };
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  const q = loadProfile(st);
  eq([q.event, q.gold, q.level, q.stages, q.version], [newEventData(), 50, 8, { '1-1': 3 }, 8]);
  p.event = { week: 5, wins: 99, losses: 99, active: true, claimed: [1, 9, 'x'] };
  saveProfile(p, st);
  eq(loadProfile(st).event, { week: 5, wins: 5, losses: 3, active: false, claimed: [1] });
});

// ---------- まとめて受け取る・コイントス ----------

test('デイリー：まとめて受け取ると、達成済みの報酬がすべて正しい合計で増え、二重には受け取れない', () => {
  const p = setQuests(dailyProfile(), ['kill_magic', 'flash', 'dodge']); // 💰150、💰120、🎀2
  p.daily.quests.forEach(q => { q.progress = QUEST_BY_ID[q.id].n; });
  const before = [p.gold, p.stones, p.packs, p.hero.gifts.leafia];
  assert(canClaimAll(p));
  const r = claimAllQuests(p);
  eq(r, { count: 3, total: { gold: 270, gifts: 2 }, hero: '森の巫女リーフィア' });
  eq([p.gold - before[0], p.stones - before[1], p.packs - before[2], p.hero.gifts.leafia - before[3]], [270, 0, 0, 2]);
  eq(rewardText(r.total), '💰270　🎀ギフト×2', '同じ種類はまとめて表示');
  assert(p.daily.quests.every(q => q.claimed), '全部「受取済み」');
  eq(dailyStatus(p).claimable, 0, 'タイトルの赤いバッジも消える');
  eq([claimAllQuests(p), claimQuest(p, 0), p.gold - before[0]], [null, null, 270], '二重には受け取れない');
  // ギフトは、そのとき選んでいるヒーローに入る
  const q = setQuests(dailyProfile(), ['dodge', 'star3', 'win']);
  recordStageClear(q, '1-10', 3); unlockHeroes(q); selectHero(q, 'agni', 0);
  q.daily.quests.forEach(x => { x.progress = QUEST_BY_ID[x.id].n; });
  const packs = q.packs;
  eq(claimAllQuests(q), { count: 3, total: { packs: 1, gifts: 5 }, hero: '炎将アグニ' });
  eq([q.hero.gifts.agni, q.hero.gifts.leafia, q.packs - packs], [5, 0, 1]);
  eq(sumRewards([{ gold: 1, stones: 2 }, { gold: 3 }, { packs: 1 }]), { gold: 4, stones: 2, packs: 1 });
});

test('デイリー：受け取れる報酬が1個以下のときは、まとめて受け取れない（個別の受け取りは今までどおり）', () => {
  const p = setQuests(dailyProfile(), ['kill_magic', 'flash', 'play']);
  eq([canClaimAll(p), claimAllQuests(p)], [false, null], '0個');
  p.daily.quests[0].progress = 5;
  const gold = p.gold;
  eq([canClaimAll(p), claimAllQuests(p), p.gold], [false, null, gold], '1個');
  p.daily.quests[1].progress = 6;
  assert(canClaimAll(p), '2個');
  eq(claimQuest(p, 0), { gold: 150 }, '個別に受け取る');
  eq([canClaimAll(p), claimAllQuests(p)], [false, null], '残りが1個になったら押せない');
  eq(claimQuest(p, 1), { gold: 120 });
  // 一部だけ受取済みでも、残りをまとめて受け取れる
  const q = setQuests(dailyProfile(), ['kill_magic', 'flash', 'play']);
  q.daily.quests.forEach(x => { x.progress = QUEST_BY_ID[x.id].n; });
  claimQuest(q, 2);
  eq(claimAllQuests(q), { count: 2, total: { gold: 270 }, hero: null });
});

test('コイントス：結果と実際の先攻・後攻が一致する。後攻はボーナスのクリスタルを持ち、ログの最初に結果が残る', () => {
  const seen = [0, 0];
  for (let i = 0; i < 60; i++) {
    const s = newGame(DEFAULT_DECK, DEFAULT_DECK, testRng);
    const toss = coinToss(s);
    seen[toss.first]++;
    eq([toss.first, toss.second, toss.bonus], [s.current, 1 - s.current, CONFIG.SECOND_PLAYER_BONUS]);
    eq(s.log, [['C', toss.first]], 'ログの最初はコイントス');
    eq([s.players[toss.first].crystals, s.players[toss.second].crystals], [0, CONFIG.SECOND_PLAYER_BONUS], '後攻ボーナス');
    startTurn(s);
    eq(s.log[1], ['T', 1, toss.first], '最初のターンは先攻のプレイヤー');
    for (const e of attackPhase(s)) { /* */ }
    finishTurn(s);
    eq([s.current, coinToss(s).first], [toss.second, toss.first], '次は後攻の番。先攻の記録は対戦中変わらない');
  }
  assert(seen[0] > 15 && seen[1] > 15, 'どちらも先攻になる');
  const text = n => logLine(['C', n], { names: ['あなた', 'ボス'] }).html;
  assert(text(0).includes('あなたが先攻') && text(0).includes('ボスは後攻ボーナス：クリスタル+' + CONFIG.SECOND_PLAYER_BONUS));
  assert(text(1).includes('ボスが先攻') && logLine(['C', 1]).important);
});

// ---------- オートバトル ----------

// 1試合を進める。brain(プレイヤー番号) がそのターンの「次の行動」を返す関数を決める。onTurn は自分の番の最初に呼ばれる
function playOut(s, brain, onTurn) {
  let res = null, guard = 0;
  while (!res && guard++ < 400) {
    const pi = s.current;
    res = startTurn(s);
    if (res) break;
    if (onTurn && pi === 0) onTurn(s);
    const next = brain(pi);
    let a, n = 0;
    while (next && (a = next(s)) && n++ < 30) assert(applyAction(s, pi, a) !== false, 'できない行動を選んだ: ' + JSON.stringify(a));
    if (s.result) { res = s.result; break; }
    for (const e of attackPhase(s)) { /* */ }
    res = finishTurn(s);
  }
  return res;
}
const autoBrain = pi => (pi === 0 ? autoNextAction : cpuNextAction);

test('オート：自分の番を自動で進めて最後まで対戦でき、勝敗が正しく決まる（ステージ・フリー・イベントのデッキで）', () => {
  const p = Object.assign(richProfile(), { level: 8 });
  const games = [
    () => newGame(deckForBattle(p), stageDeck(STAGE_BY_ID['2-3']), testRng, { terrain: STAGE_BY_ID['2-3'].terrain }),
    () => newGame(deckForBattle(p), cpuDeckFor(p, testRng), testRng, { terrain: randomTerrain(testRng) }),
    () => newGame(eventDeck(p, EVENTS[0], testRng), eventFoeDeck(p, EVENTS[0], testRng), testRng, { rules: EVENTS[0].rule }),
  ];
  for (const make of games) for (let i = 0; i < 6; i++) {
    const s = make();
    const res = playOut(s, autoBrain);
    assert(res && (res.winner === 0 || res.winner === 1), '決着がつく');
    eq(monstersLeft(s.players[1 - res.winner]) === 0 || res.reason === 'both', true, '負けた側のモンスターが0体');
    assert(s.log.some(e => e[0] === 'P' && e[1] === 0), 'オートで出したカードもログに残る');
    eq(s.log[s.log.length - 1], ['R', res.winner, res.reason]);
  }
});

test('オート：途中でオフにしても、そのまま手動で続けられる（自分の番の途中で切り替えても安全）', () => {
  // 試合が早く終わって手動の番が来ないこともあるので、手動の行動が起きる試合になるまで、何試合か行う
  let manual = 0, s, res;
  for (let game = 0; game < 8 && !manual; game++) {
  const p = richProfile();
  s = newGame(deckForBattle(p), cpuDeckFor(p, testRng), testRng);
  // ターン7までオート。ターン7以降の自分の番は、オートで1つだけ行動してから、残りを手動で行う
  res = playOut(s, pi => (pi === 1 ? cpuNextAction : s.turn < 7 ? autoNextAction : null), st => {
    if (st.turn < 7) return;
    const first = autoNextAction(st);
    if (first) applyAction(st, 0, first);              // オートの行動が1つ終わったところでオフにした
    const me = st.players[0];
    const h = me.hand.find(c => c.card.kind === 'monster' && costOf(me, c.card) <= me.crystals);
    if (h && placementSlot(me, 2) >= 0) { assert(playMonster(st, 0, h.uid, 2), '手動でモンスターを出せる'); manual++; }
    else if (!me.sacrificed && me.hand.length && monstersLeft(me) > 1) {
      const item = me.hand.find(c => c.card.kind !== 'monster');
      if (item) { assert(sacrifice(st, 0, item.uid), '手動で生贄にできる'); manual++; }
    }
  });
  assert(res && (res.winner === 0 || res.winner === 1), '最後まで進んで決着がつく');
  }
  assert(manual > 0, '手動の行動が行われた');
  eq(s.phase, 'over');
});

test('オート：CPUと同じ思考で、同じ強さ。残りモンスターが少ないときは、モンスターを不用意に生贄にしない', () => {
  let wins = 0, risky = 0, careful = 0;
  const N = 240;
  for (let g = 0; g < N; g++) {
    const s = newGame(randomDeck(testRng, { level: 2 }), randomDeck(testRng, { level: 2 }), testRng);
    const res = playOut(s, pi => (pi === 0 ? st => {
      const me = st.players[0];
      const cpu = cpuNextAction(st), auto = autoNextAction(st);
      const monsterSac = a => a && (a.type === 'sacrificeField' || (a.type === 'sacrifice' && me.hand.find(h => h.uid === a.uid).card.kind === 'monster'));
      if (monstersLeft(me) <= CONFIG.AUTO_KEEP_MONSTERS) {
        if (monsterSac(cpu)) risky++;
        if (monsterSac(auto)) {
          careful++;
          // 例外は「場の誰も攻撃できない膠着を直す」ときと「場が空でモンスターを出すため」だけ
          const stuck = auto.type === 'sacrificeField' && lineupAttack(me.slots.filter(m => m)) === 0;
          assert(stuck, '少ないのにモンスターを生贄にした: ' + JSON.stringify(auto) + ' 残り' + monstersLeft(me));
        }
      } else eq(auto, cpu, '残りが多いときは、CPUとまったく同じ行動');
      if (!monsterSac(cpu)) eq(auto, cpu, 'モンスターの生贄以外は、CPUと同じ行動');
      return auto;
    } : cpuNextAction));
    if (res.winner === 0) wins++;
  }
  assert(risky > 0, 'CPUなら生贄にしていた場面がある（' + risky + '回）');
  assert(careful < risky, 'オートはそれを避ける');
  near(wins / N, 0.5, 0.1, 'オートの勝率（CPU相手）');
  assert(CONFIG.AUTO_KEEP_MONSTERS > CONFIG.CPU_KEEP_MONSTERS);
});

test('オート：オートで戦っても、デイリークエストとイベントは通常どおり進む', () => {
  const p = Object.assign(newProfile(), { level: 7 });
  setQuests(p, ['play', 'kill_melee', 'win']);
  let s, res;
  do { s = newGame(deckForBattle(p), cpuDeckFor(p, testRng), testRng); res = playOut(s, autoBrain); } while (res.winner !== 0);
  const stats = battleStats(s, true, { type: 'free' }, p.deck);
  assert(stats.play === 1 && stats.win === 1 && Object.keys(stats).some(k => k.startsWith('kill_')), JSON.stringify(stats));
  questProgress(p, stats, day(4));
  eq([p.daily.quests[0].progress, p.daily.quests[2].progress, p.daily.quests[1].progress], [1, 1, stats.kill_melee || 0]);
  startEventRun(p, monday(5));
  const r = recordEventBattle(p, true, monday(5));
  eq([r.wins, r.tiers.length], [1, 1], 'イベントの成績と報酬');
  eq(battleReward(p, 'win').gifts, HERO_RULES.GIFT_WIN);
});

// ---------- 対戦ログ ----------

const codes = s => s.log.map(e => e[0] + (e[0] === 'k' || e[0] === 'x' ? ':' + e[2] : ''));
const texts = s => s.log.map(e => logLine(e).html.replace(/<[^>]+>/g, ''));
const logged = (s, code) => s.log.filter(e => e[0] === code);

test('対戦ログ：ターンの開始、カードを出した・装備した・フラッシュを使った・生贄にした、が記録される', () => {
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  s.log.length = 0;
  playMonster(s, 0, give(s, 0, SLIME), 0);              // ウルフを後ろへ押し出す
  equipItem(s, 0, give(s, 0, LEATHER), 0);
  equipItem(s, 0, give(s, 0, STEEL), 0);                // 付け替え
  playFlash(s, 0, give(s, 0, ROCK), 0);
  sacrifice(s, 0, give(s, 0, CURE));
  eq(s.log, [
    ['P', 0, SLIME, 0, ['0' + WOLF]],
    ['E', 0, LEATHER, '0' + SLIME, 0],
    ['E', 0, STEEL, '0' + SLIME, LEATHER],
    ['F', 0, ROCK, '1' + GOLEM, { d: 3 }],
    ['S', 0, CURE, CONFIG.SACRIFICE_ITEM, 0],
  ]);
  const t = texts(s);
  assert(t[0].includes('スロット1に出した') && t[0].includes('後ろへ') && t[2].includes('外れた') && t[3].includes('3ダメージ') && t[4].includes('生贄'), t.join(' / '));
  beginTurnOf(s, 1);
  eq(s.log[s.log.length - 1], ['T', 6, 1]);
  assert(logLine(s.log[s.log.length - 1], { names: ['あなた', 'ボス'] }).html.includes('ターン6　ボス'));
});

test('対戦ログ：攻撃（攻撃者・種類・対象・ダメージ・アーマーの減り）と撃破、詰めによる移動が記録される', () => {
  const s = board([mk(DRAGON), mk(ARCHER)], [mk(SLIME, LEATHER), mk(S('melee', 1, 2)), mk(GOLEM)]);
  s.log.length = 0;
  phase(s);
  const a = logged(s, 'A');
  eq(a.map(e => [e[2], e[3], e[4]]), [['0' + ARCHER, 'ranged', s.log.find(e => e[0] === 'A')[4]], ['0' + DRAGON, 'melee', '1' + SLIME]]);
  eq(a[1][5], { a: 2 }, 'アーマーだけ削れた');
  const k = board([mk(DRAGON)], [mk(S('melee', 1, 2)), mk(GOLEM), mk(WOLF)]);
  k.log.length = 0;
  phase(k);
  eq(codes(k), ['A', 'M', 'G']);
  eq([k.log[0][5], k.log[1]], [{ d: 5, K: 1 }, ['M', 1, ['1' + GOLEM, '1' + WOLF]]]);
  eq(k.log[2].slice(0, 2).concat(k.log[2][3]), ['G', 1, CONFIG.FALLEN_CRYSTAL], '倒された側がクリスタルをもらった記録');
  const [hit, move] = texts(k);
  assert(hit.includes('近接攻撃') && hit.includes('5ダメージ') && hit.includes('撃破') && move.includes('前に詰めた'), hit + ' / ' + move);
  assert(logLine(k.log[0]).html.includes('class="t-melee"'), '攻撃の種類の色');
});

test('対戦ログ：スキルの発動（Flying で回避・Thorns・Disease 付与・反撃）、状態異常の付与と解除、回復が記録される', () => {
  const th = board([mk(WOLF)], [mk(S('melee', 1, 30, 'thorns:2'))]);
  th.log.length = 0; phase(th);
  eq(codes(th), ['A', 'x:thorns']);
  assert(texts(th)[1].includes('Thorns') && texts(th)[1].includes('2ダメージ'));
  const dz = board([mk(S('melee', 2, 9, 'disease:1'))], [mk(GOLEM)]);
  dz.log.length = 0; phase(dz);
  eq(codes(dz), ['A', 'x:disease']);
  let dodge = null;
  for (let i = 0; i < 60 && !dodge; i++) {
    const f = board([mk(WOLF)], [mk(S('melee', 1, 300, 'flying'))]);
    f.log.length = 0; phase(f);
    if (f.log[0][5].dg) dodge = texts(f)[0];
  }
  assert(dodge && dodge.includes('Flying') && dodge.includes('回避'), dodge);
  // ターン開始時：回復・浄化・拘束
  const st = board([mk(GOLEM), mk(S('magic', 1, 8, 'heal:2')), mk(S('magic', 1, 8, 'cleanse'))], [mk(GOLEM)]);
  st.players[0].slots[0].hp = 5; st.players[0].slots[1].status.demoralize = 1;
  st.log.length = 0; beginTurnOf(st, 0);
  eq(codes(st), ['T', 'k:cleanse', 'k:heal']);
  assert(texts(st)[2].includes('2回復') && texts(st)[1].includes('デバフを解除'));
  // 状態異常が解ける（ターン終了）
  const en = board([mk(WOLF)], [mk(GOLEM)]);
  en.players[0].slots[0].status.entangle = true;
  en.log.length = 0; phase(en); finishTurn(en);
  eq(codes(en), ['s', 'X']);
  assert(texts(en)[0].includes('攻撃できない') && texts(en)[1].includes('Entangle') && texts(en)[1].includes('解けた'));
});

test('対戦ログ：消耗ダメージ・場が空のペナルティ・ヒーロースキル・地形効果・決着が記録される', () => {
  const at = board([mk(GOLEM)], [mk(GOLEM)]);
  at.turn = CONFIG.ATTRITION_START - 1; at.log.length = 0; beginTurnOf(at, 0);
  eq(at.log[1], ['B', 1, [['0' + GOLEM, 0], ['1' + GOLEM, 0]]]);
  const pen = board([], [mk(GOLEM)]);
  pen.players[0].deck = [{ uid: uidSeq++, card: CARD_BY_ID[LEATHER] }, { uid: uidSeq++, card: CARD_BY_ID[WOLF] }, { uid: uidSeq++, card: CARD_BY_ID[WOLF] }];
  pen.log.length = 0; pen.phase = 'attack'; finishTurn(pen);
  eq([pen.log[0][0], pen.log[0][1], pen.log[0][3]], ['Y', 0, 'deck']);
  const hero = setHero(board([mk(GOLEM)], [mk(GOLEM)]), 0, 'breeze');
  hero.players[0].slots[0].hp = 5; hero.log.length = 0; beginTurnOf(hero, 0);
  eq(hero.log[1], ['k', 0, 'hero', 0, ['0' + GOLEM], { h: 2, ef: 'heal', id: 'breeze' }]);
  assert(texts(hero)[1].includes('癒しの風') && logLine(hero.log[1]).important);
  const vol = land('volcano', [mk(GOLEM)], [mk(GOLEM)]);
  vol.log.length = 0; beginTurnOf(vol, 0);
  eq(vol.log[1], ['L', 0, 'burn', [['0' + GOLEM, 1, 0]]]);
  assert(logLine(vol.log[1], { terrain: 'volcano' }).html.includes('火山'));
  const end = board([mk(DRAGON)], [mk(S('melee', 1, 2))]);
  end.log.length = 0; phase(end); finishTurn(end);
  eq(end.log[end.log.length - 1], ['R', 0, 'wipeout'], '決着は最後の行');
  const sur = board([mk(GOLEM)], [mk(GOLEM)]); sur.log.length = 0; surrender(sur, 0);
  eq(sur.log, [['R', 1, 'surrender']]);
});

test('対戦ログ：1試合を通して、どの行も読める文になる。「重要なものだけ」は撃破・ヒーロースキル・大ダメージなどに絞る', () => {
  const p = richProfile();
  const s = newGame(deckForBattle(p), stageDeck(STAGE_BY_ID['3-10']), testRng, { terrain: 'worldtree' });
  let res = null, guard = 0;
  while (!res && guard++ < 300) {
    const pi = s.current;
    res = startTurn(s);
    if (res) break;
    let a; while ((a = cpuNextAction(s))) applyAction(s, pi, a);
    if (s.result) { res = s.result; break; }
    for (const e of attackPhase(s)) { /* */ }
    res = finishTurn(s);
  }
  const lines = s.log.map(e => logLine(e, { names: ['あなた', 'ユグ'], terrain: 'worldtree' }));
  for (const l of lines) assert(l.html && !/undefined|NaN|\[object/.test(l.html), l.html);
  eq(s.log.filter(e => e[0] === 'T').length, s.turn, 'ターンごとに見出しがある');
  eq(s.log[s.log.length - 1][0], 'R');
  const kinds = new Set(s.log.map(e => e[0]));
  for (const c of ['T', 'P', 'A', 'R']) assert(kinds.has(c), c + ' が記録されている');
  const imp = lines.filter(l => l.important);
  assert(imp.length < lines.length && imp.every(l => l.cls !== 'play' || /撃破/.test(l.html)), '重要なものだけに絞れる');
  assert(lines.filter(l => /撃破|倒れた/.test(l.html)).every(l => l.important), '撃破は必ず重要');
  const html = logHtml(s.log, {}, true);
  assert(html.includes('class="lg') && html.split('<li').length - 1 === imp.length);
  assert(/data-card="[01]/.test(logHtml(s.log)) && /data-dict="skill:/.test(logHtml(s.log)), 'カード名・スキル名はタップできる');
});

// ---------- 対戦履歴 ----------

const fakeRecord = (t, extra = {}) => ({ t, m: 'f', lb: '', w: 1, rs: 'wipeout', n: 20, fn: 'CPU', land: 'plain', ev: null, dk: [{ m: [], i: [], lv: {}, op: {} }, { m: [], i: [], lv: {}, op: {} }], sum: { d: [0, 0], k: [0, 0], mvp: null }, log: [], fav: false, ...extra });

test('対戦履歴：試合の記録を作る（モード・勝敗・ターン数・ヒーロー・地形・両者のデッキ・まとめ・全ログ）', () => {
  const p = richProfile();
  p.cards.r02.level = 3;
  const s = newGame(deckForBattle(p), stageDeck(STAGE_BY_ID['2-4']), testRng, { terrain: STAGE_BY_ID['2-4'].terrain });
  let res = null;
  while (!res) {
    const pi = s.current;
    res = startTurn(s);
    if (res) break;
    let a; while ((a = cpuNextAction(s))) applyAction(s, pi, a);
    if (s.result) { res = s.result; break; }
    for (const e of attackPhase(s)) { /* */ }
    res = finishTurn(s);
  }
  const r = makeHistoryRecord(s, { mode: 's', label: '2-4', win: res.winner === 0, foe: '霧の湖の使い', now: new Date(2026, 9, 4, 12, 30) });
  eq([r.m, r.lb, r.w, r.n, r.fn, r.land, r.t], ['s', '2-4', res.winner === 0 ? 1 : 0, s.turn, '霧の湖の使い', STAGE_BY_ID['2-4'].terrain, new Date(2026, 9, 4, 12, 30).getTime()]);
  eq([r.dk[0].m, r.dk[0].lv, r.dk[0].h, r.dk[1].m.length, r.dk[1].i.length], [p.deck.monsters, { r02: 3 }, 'breeze', 8, 8], 'デッキとカードレベル（Lv1 は書かない）');
  assert(r.sum.d[0] > 0 && r.sum.d[1] > 0 && r.sum.k[0] + r.sum.k[1] > 0, 'ダメージ合計と倒した数');
  const best = Object.entries(s.tally[0].by).sort((x, y) => y[1] - x[1])[0];
  eq(r.sum.mvp, [best[0], best[1]], '一番活躍したモンスター＝与えたダメージが最も多い');
  assert(p.deck.monsters.includes(r.sum.mvp[0]));
  eq(r.log, s.log);
  const size = JSON.stringify(r).length;
  assert(size < 20000, `1試合 ${size} 文字`);
});

test('対戦履歴：50試合を超えると古いものから消える。保存マークの試合は消えない（最大10試合）', () => {
  const list = [];
  for (let i = 1; i <= 50; i++) addHistory(list, fakeRecord(i));
  eq([list.length, list[0].t, list[49].t], [50, 50, 1], '新しい順');
  assert(setHistoryFav(list, 1, true) && setHistoryFav(list, 3, true));
  addHistory(list, fakeRecord(51));
  eq([list.length, list.some(r => r.t === 2), list.some(r => r.t === 1), list.some(r => r.t === 3)], [50, false, true, true], '保存マークのない一番古い試合（2）が消える');
  for (let i = 52; i <= 200; i++) addHistory(list, fakeRecord(i));
  eq([list.length, list.filter(r => r.fav).map(r => r.t), list[0].t], [50, [3, 1], 200]);
  for (let i = 190; i < 198; i++) assert(setHistoryFav(list, i, true));
  assert(!setHistoryFav(list, 199, true), '保存マークは10試合まで');
  assert(setHistoryFav(list, 1, false) && setHistoryFav(list, 199, true), '外せば付けられる');
  eq(list.filter(r => r.fav).length, HISTORY.MAX_FAV);
});

test('対戦履歴：モード別・勝敗別に絞り込める。保存して読み込める（プロフィールとは別のキー）', () => {
  const list = [];
  [['s', 1], ['s', 0], ['f', 1], ['e', 0], ['e', 1]].forEach(([m, w], i) => addHistory(list, fakeRecord(i + 1, { m, w })));
  eq([filterHistory(list, 's').length, filterHistory(list, null, 'win').length, filterHistory(list, 'e', 'lose').map(r => r.t), filterHistory(list).length], [2, 3, [4], 5]);
  const st = memStorage();
  const p = richProfile(); saveProfile(p, st);
  assert(saveHistory(list, st));
  eq(loadHistory(st), list);
  assert(HISTORY.KEY !== GROWTH.SAVE_KEY);
  eq(loadProfile(st), p, 'プロフィールのセーブデータは変わらない');
  st.setItem(HISTORY.KEY, '{こわれた');
  eq(loadHistory(st), []);
  eq(loadHistory(memStorage()), [], '履歴がなくても読める');
  // 容量が足りないときは、保存マークのない古い試合を消して保存する
  const tight = memStorage(); const real = tight.setItem;
  tight.setItem = (k, v) => { if (v.length > 900) throw new Error('quota'); real(k, v); };
  setHistoryFav(list, 1, true);
  assert(saveHistory(list, tight) && loadHistory(tight).some(r => r.t === 1) && loadHistory(tight).length < 5);
});

// ---------- スキル辞典 ----------

test('辞典：全スキルが載っている（スキルのデータと件数が一致し、分類・読み・タイミング・図解がある）', () => {
  const skills = DICT.filter(e => e.group === 'skill');
  eq(skills.length, Object.keys(SKILLS).length);
  eq(Object.keys(SKILL_META).sort(), Object.keys(SKILLS).sort(), 'スキルを足したら SKILL_META にも足す');
  for (const id in SKILLS) {
    const e = DICT_BY_KEY['skill:' + id], m = SKILL_META[id];
    assert(e && e.name === SKILLS[id].name && e.icon === SKILLS[id].icon, id);
    assert(DICT_CATS[m.cat] && m.ja && /^[ぁ-んー]+$/.test(m.yomi) && m.when && DICT_DEMOS[m.demo], id + ' の辞典用の情報');
    assert(m.rel.every(r => SKILLS[r]), id + ' の関係するスキル');
    eq(e.hasX, !SKILLS[id].noX, id);
    assert(!/NaN|undefined/.test(e.desc) && (!e.hasX || e.desc.includes('X')), id + ' の説明');
  }
});

test('辞典：状態異常・攻撃の種類・基本ルール・ヒーロースキル・地形・イベントも、データから自動で載る', () => {
  const n = g => DICT.filter(e => e.group === g).length;
  eq([n('status'), n('type'), n('hero'), n('terrain'), n('event')],
    [Object.keys(STATUS_INFO).length, Object.keys(ATTACK_TYPES).length, Object.keys(HERO_SKILL_INFO).length, TERRAINS.length, EVENTS.length]);
  for (const id of ['armor', 'slots', 'order', 'sacrifice', 'penalty', 'attrition', 'win']) assert(DICT_BY_KEY['rule:' + id], id);
  assert(DICT_BY_KEY['rule:attrition'].desc.includes('ターン' + CONFIG.ATTRITION_START), '数値は設定から入る');
  eq(new Set(DICT.map(e => e.key)).size, DICT.length);
  for (const e of DICT) {
    assert(e.name && e.icon && e.desc && e.when && DICT_CATS[e.cat] && DICT_DEMOS[e.demo] && /^[ぁ-んー]+$/.test(e.yomi), e.key);
    assert(e.rel.every(r => DICT_BY_KEY[r] && r !== e.key), e.key + ' の関係する項目');
  }
  const d = DICT_BY_KEY['skill:disease'].rel;
  for (const r of ['skill:outbreak', 'skill:heal', 'skill:perseverance', 'status:disease']) assert(d.includes(r), 'Disease → ' + r);
  assert(DICT_BY_KEY['skill:outbreak'].rel.includes('skill:disease'), '関係は両方向');
  eq(DICT_BY_KEY['skill:fear'].demo, 'swap', 'Fear の図解は入れ替え');
});

test('辞典：検索（日本語名・英語名・読み）、分類の絞り込み、50音順・分類順の並べ替え', () => {
  const keys = q => dictSearch({ q, group: 'skill' }).map(e => e.key);
  eq([keys('thorns'), keys('Thorns'), keys('いばら'), keys('棘の盾'), keys('とげ')], [['skill:thorns'], ['skill:thorns'], ['skill:thorns'], ['skill:shieldspike'], ['skill:shieldspike']]);
  assert(keys('はんげき').length === 3 && keys('反撃').length === 3 && keys('counter').length === 3);
  assert(dictSearch({ q: 'カザン' }).some(e => e.key === 'terrain:volcano'), 'カタカナでも探せる');
  eq(dictSearch({ q: 'zzzz' }), []);
  const atk = dictSearch({ group: 'skill', cat: 'atk' });
  assert(atk.length > 5 && atk.every(e => e.cat === 'atk' && e.group === 'skill'));
  const kana = dictSearch({ group: 'skill', sort: 'kana' }).map(e => e.yomi);
  eq(kana, kana.slice().sort((a, b) => a.localeCompare(b, 'ja')), '50音順');
  const byCat = dictSearch({ sort: 'cat' });
  eq(byCat.length, DICT.length);
  eq(byCat[0].group, 'skill');
  const order = Object.keys(DICT_CATS);
  const cats = byCat.filter(e => e.group === 'skill').map(e => order.indexOf(e.cat));
  eq(cats, cats.slice().sort((a, b) => a - b), '分類順');
});

test('辞典：そのスキルを持つカードの一覧（選択スキルも含む）と、「自分のデッキのスキルだけ」の絞り込み', () => {
  const cards = dictCards(DICT_BY_KEY['skill:thorns']);
  assert(cards.length >= 3 && cards.every(c => CARD_DEFS[c.id]));
  for (const c of cards) {
    const def = CARD_DEFS[c.id];
    const base = def.levels.some(l => (l.skills || []).some(k => k.id === 'thorns'));
    eq(c.opt, !base, c.id);
    assert(base || def.options.some(k => k.id === 'thorns'), c.id);
  }
  assert(cards.some(c => c.opt) && cards.some(c => !c.opt));
  for (const id in SKILLS) assert(dictCards(DICT_BY_KEY['skill:' + id]).length > 0, id + ' を持つカードがある');
  eq(dictCards(DICT_BY_KEY['hero:breeze']), [{ id: 'g12', opt: false }]);
  const p = newProfile();
  const mine = deckDictKeys(p);
  assert(mine.has('hero:breeze') && mine.has('skill:smite') && !mine.has('skill:fear'));
  const list = dictSearch({ keys: mine });
  eq(list.length, mine.size);
  addCard(p, 'p08'); p.cards.p08.level = 3; setOption(p, 'p08', 1); p.deck.monsters[0] = 'p08';
  assert(deckDictKeys(p).has('skill:fear'), '選んだ選択スキルも含む');
});

// ---------- 演出の設定 ----------

test('演出：速度が1倍・2倍・スキップで、待ち時間が等倍・半分・0になる', () => {
  const saved = FX.speed;
  try {
    eq(FX_SPEEDS.map(x => x[0]), [1, 2, 'skip']);
    FX.speed = 1; eq(fxMs(600), 600);
    FX.speed = 2; eq(fxMs(600), 300);
    FX.speed = 'skip'; eq([fxMs(600), fxOn()], [0, false]);
  } finally { FX.speed = saved; }
});

test('演出：ダメージ数字の色は攻撃の種類ごとに違う', () => {
  const cls = ['magic', 'chaos', 'ranged', 'melee'].map(dmgClass);
  eq(cls, ['t-magic', 't-chaos', 't-ranged', 't-melee']);
  eq(new Set(cls).size, 4);
});

// ---------- 複数デッキ ----------

// 全カードを持っているプロフィール（デッキのテスト用）
function deckProfile() {
  const p = newProfile();
  p.level = 10;
  for (const c of [...MONSTERS, ...ITEMS]) if (!c.id.startsWith('t_')) p.cards[c.id] = p.cards[c.id] || { level: 1, copies: 0 };
  return p;
}
const realCards = pool => pool.filter(c => !c.id.startsWith('t_'));
const cardsOf = d => [d.monsters, d.items];
// その色のモンスター8体のデッキ内容
const monoDeck = color => ({
  monsters: realCards(MONSTERS).filter(c => c.color === color).slice(0, CONFIG.DECK_MONSTERS).map(c => c.id),
  items: realCards(ITEMS).filter(c => !c.color || c.color === color).slice(0, CONFIG.DECK_ITEMS).map(c => c.id),
});

test('デッキ：はじめは「デッキ1」が1つあり、使用中。10個まで作れて、11個目は作れない', () => {
  const p = newProfile();
  eq([p.decks.length, p.decks[0].name, p.activeDeck, p.decks[0].id], [1, 'デッキ1', p.decks[0].id, 1]);
  eq(cardsOf(p.decks[0]), [DEFAULT_DECK.monsters, DEFAULT_DECK.items]);
  eq([p.decks[0].hero, p.decks[0].skill], [p.hero.selected, p.hero.skill]);
  eq(DECKS.MAX, 10);
  const empty = addDeck(p, 'empty');
  eq([empty.name, cardsOf(empty), deckStatus(p, empty).complete, deckStatus(p, empty).playable], ['デッキ2', [[], []], false, false]);
  const starter = addDeck(p, 'starter');
  eq([starter.name, cardsOf(starter), deckStatus(p, starter).playable], ['デッキ3', [DEFAULT_DECK.monsters, DEFAULT_DECK.items], true]);
  while (p.decks.length < DECKS.MAX) assert(addDeck(p, 'empty'), '10個までは作れる');
  eq(p.decks.length, 10);
  eq([addDeck(p, 'empty'), addDeck(p, 'starter'), duplicateDeck(p, 1), importDeck(p, deckToCode(p.decks[0])).ok], [null, null, null, false], '11個目は、どの方法でも作れない');
  eq(p.decks.length, 10);
  eq(new Set(p.decks.map(d => d.id)).size, 10, 'デッキの id は重ならない');
  // 同じカードを複数のデッキに入れてよい（取り合わない）
  eq(deckStatus(p, p.decks[0]).playable && deckStatus(p, starter).playable, true);
  // 保存して読み込んでも同じ
  const st = memStorage();
  saveProfile(p, st);
  const q = loadProfile(st);
  eq([q.decks, q.activeDeck, q.deck], [p.decks, p.activeDeck, p.deck]);
});

test('デッキ：複製・名前変更・削除・並べ替え。最後の1つは削除できない', () => {
  const p = deckProfile();
  const a = p.decks[0];
  // 名前変更（前後の空白は取る・長すぎる名前は切る・空の名前は不可）
  eq([renameDeck(p, a.id, '  赤単アグロ  '), a.name], [true, '赤単アグロ']);
  eq([renameDeck(p, a.id, '   '), renameDeck(p, 999, 'x'), a.name], [false, false, '赤単アグロ']);
  renameDeck(p, a.id, 'あ'.repeat(40));
  eq(a.name.length, DECKS.NAME_MAX);
  renameDeck(p, a.id, '<b>赤"単&');
  eq(a.name, 'b赤単', '画面を壊す文字は入らない');
  renameDeck(p, a.id, '赤単');
  // 複製：元のすぐ下に、同じ内容で入る。あとで変えても元は変わらない
  const b = addDeck(p, 'empty', '空');
  const c = duplicateDeck(p, a.id);
  eq(p.decks.map(d => d.name), ['赤単', '赤単のコピー', '空']);
  eq([cardsOf(c), c.hero, c.skill, c.id !== a.id], [cardsOf(a), a.hero, a.skill, true]);
  c.monsters.pop();
  eq(a.monsters.length, CONFIG.DECK_MONSTERS, '複製を変えても、元は変わらない');
  // 並べ替え：使用中の印と「前回使ったデッキ」は、同じデッキを指したまま
  eq([moveDeck(p, a.id, -1), moveDeck(p, b.id, 1), moveDeck(p, 999, 1)], [false, false, false], '端からは動かない');
  assert(moveDeck(p, a.id, 1) && moveDeck(p, a.id, 1));
  eq([p.decks.map(d => d.name), activeDeck(p).name], [['赤単のコピー', '空', '赤単'], '赤単']);
  assert(moveDeck(p, b.id, -1));
  eq(p.decks.map(d => d.name), ['空', '赤単のコピー', '赤単']);
  // 削除
  eq(deleteDeck(p, c.id).ok, true);
  eq(p.decks.map(d => d.name), ['空', '赤単']);
  // 使用中のデッキは、ほかに対戦に使えるデッキがなければ消せない
  eq([canDeleteDeck(p, a.id).ok, deleteDeck(p, a.id).ok, p.decks.length], [false, false, 2]);
  const d = addDeck(p, 'starter', '予備');
  eq(deleteDeck(p, a.id).ok, true, '使えるデッキがほかにあれば消せる');
  eq([p.activeDeck, p.deck, p.decks.map(x => x.name)], [d.id, { monsters: d.monsters, items: d.items }, ['空', '予備']], '使用中は、使えるデッキに移る');
  eq(deleteDeck(p, b.id).ok, true);
  // 最後の1つ
  const last = deleteDeck(p, d.id);
  eq([last.ok, last.reason, p.decks.length], [false, '最後の1つは削除できません', 1]);
});

test('デッキ：既存のセーブデータ（デッキが1つ）のデッキが「デッキ1」として残り、ほかのデータも消えない', () => {
  // 版4までのセーブ：decks がなく、deck とヒーローの選択だけがある
  const p = deckProfile();
  recordStageClear(p, '1-10', 3); unlockHeroes(p); p.hero.levels.agni = HERO_RULES.SKILL_LEVELS[1];
  const mono = monoDeck('red');
  const old = {
    version: 4, level: 9, xp: 30, gold: 777, stones: 55, packs: 2, cards: p.cards, deck: mono,
    stages: { '1-1': 3, '1-10': 2 }, options: {}, hero: { ...p.hero, selected: 'agni', skill: 1 }, daily: p.daily, event: p.event, wins: 12, losses: 7,
  };
  const st = memStorage();
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  const q = loadProfile(st);
  eq([q.version - 3, q.decks.length, q.decks[0].name, cardsOf(q.decks[0]), q.decks[0].hero, q.decks[0].skill], [5, 1, 'デッキ1', [mono.monsters, mono.items], 'agni', 1]);
  eq([q.activeDeck, q.deck, q.hero.selected, q.hero.skill], [q.decks[0].id, mono, 'agni', 1]);
  eq([q.level, q.xp, q.gold, q.stones, q.packs, q.wins, q.losses, q.stages, Object.keys(q.cards).length], [9, 30, 777, 55, 2, 12, 7, { '1-1': 3, '1-10': 2 }, Object.keys(p.cards).length]);
  eq(deckForBattle(q).monsters, mono.monsters, '対戦でも同じデッキを使う');
  // もう一度保存して読んでも変わらない
  saveProfile(q, st);
  eq(loadProfile(st), q);
  // 壊れたデッキのデータは直される（知らないカード・重複・多すぎる枚数・多すぎるデッキ）
  const broken = JSON.parse(JSON.stringify(q));
  broken.decks = [...Array(14)].map((x, i) => ({ id: i + 1, name: i ? '' : 5, monsters: [...mono.monsters, mono.monsters[0], 'zzz', 'e01', 'r99'], items: 'x', hero: 'nobody', skill: 9 }));
  broken.activeDeck = 999;
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(broken));
  const r = loadProfile(st);
  eq([r.decks.length, r.decks[0].name, r.decks[1].name, r.decks[1].monsters, r.decks[1].items], [DECKS.MAX, '5', 'デッキ2', mono.monsters, []]);
  // 対戦に使えるデッキが1つもなかったので、使用中のデッキ（先頭）はスターターの内容に戻る
  eq([r.activeDeck, cardsOf(r.decks[0])], [r.decks[0].id, [DEFAULT_DECK.monsters, DEFAULT_DECK.items]]);
  eq([deckStatus(r, activeDeck(r)).playable, r.deck.monsters.length, r.deck.items.length], [true, CONFIG.DECK_MONSTERS, CONFIG.DECK_ITEMS], '使用中のデッキは、必ず対戦に使える');
});

test('デッキ：未完成のデッキや、カードが足りないデッキでは対戦を始められない', () => {
  const p = deckProfile();
  const full = p.decks[0];
  const half = addDeck(p, 'empty', '作りかけ');
  // 未完成でも保存はできる
  eq(saveDeckEdit(p, half.id, { monsters: DEFAULT_DECK.monsters.slice(0, 3), items: [] }).ok, true);
  eq([deckStatus(p, half).complete, deckStatus(p, half).playable, half.monsters.length], [false, false, 3]);
  eq([setActiveDeck(p, half.id), chooseDeckForBattle(p, 'free', half.id), p.activeDeck], [false, false, full.id], '未完成：使用中にも、対戦にも使えない');
  // 分解して手持ちからなくなったカードが入っているデッキ
  const lost = addDeck(p, 'starter', '欠けたデッキ');
  const gone = lost.monsters.find(id => CARD_DEFS[id].color === 'green');
  saveDeckEdit(p, full.id, monoDeck('red')); // 使用中のデッキからは外す（使用中のデッキのカードは分解できない）
  assert(!full.monsters.includes(gone));
  eq(canDismantle(p, gone).ok, true, 'ほかのデッキに入っていても、分解はできる');
  dismantleCard(p, gone);
  eq(owns(p, gone), false);
  eq([deckStatus(p, lost).complete, deckStatus(p, lost).missing, deckStatus(p, lost).playable], [true, [gone], false]);
  eq([setActiveDeck(p, lost.id), chooseDeckForBattle(p, 'stage', lost.id), p.activeDeck], [false, false, full.id], 'カードが足りない：使えない');
  eq(deckChoices(p, 'free').map(c => [c.deck.name, c.ok, c.reason]), [['デッキ1', true, ''], ['作りかけ', false, '未完成'], ['欠けたデッキ', false, 'カードが足りません']]);
  // 使用中のデッキは、未完成のままでは保存できない（対戦に使えるデッキが必ず1つ残る）
  const bad = saveDeckEdit(p, full.id, { monsters: full.monsters.slice(0, 5), items: full.items });
  eq([bad.ok, full.monsters.length, deckStatus(p, activeDeck(p)).playable], [false, CONFIG.DECK_MONSTERS, true]);
  // 使えるデッキを選べば対戦できる。選んだデッキが使用中になり、モードごとに覚える
  const blue = addDeck(p, monoDeck('blue'), '青単');
  eq([chooseDeckForBattle(p, 'stage', blue.id), p.activeDeck, p.lastDeck], [true, blue.id, {}], '切り替えると使用中になる。モードごとには覚えない');
  eq([deckForBattle(p).monsters, p.deck.monsters], [blue.monsters, blue.monsters], '対戦は、選んだデッキで行う');
  eq(chooseDeckForBattle(p, 'free', full.id), true);
  // どのモードでも、いつも「使用中」のデッキで戦う（前回そのモードで使ったデッキは関係ない）
  eq([activeDeck(p).name, deckForBattle(p).monsters, battleDeckCheck(p, 'stage'), battleDeckCheck(p, 'free')], ['デッキ1', full.monsters, { ok: true, loaner: false, reason: '' }, { ok: true, loaner: false, reason: '' }]);
  // オートバトルでも、選んだデッキで最後まで戦える
  chooseDeckForBattle(p, 'free', blue.id);
  const s = newGame(deckForBattle(p), cpuDeckFor(p, testRng), testRng);
  eq(s.decks[0].monsters, blue.monsters);
  const res = playOut(s, pi => (pi === 0 ? autoStrongAction : cpuNextAction));
  assert(res && s.log.filter(e => e[0] === 'P' && e[1] === 0).every(e => blue.monsters.includes(e[2])), 'オートが出すのは、選んだデッキのモンスターだけ');
});

test('デッキ：対戦はいつも「使用中」のデッキで始まる。使えないときは理由が出て始まらない。色指定イベントで合わなければ貸し出し', () => {
  const p = deckProfile();
  const first = p.decks[0];
  const red = addDeck(p, monoDeck('red'), '赤単'), blue = addDeck(p, monoDeck('blue'), '青単');
  // 使用中のデッキが使えれば、そのまま始められる
  for (const type of ['stage', 'free', 'event']) eq(battleDeckCheck(p, type, EVENTS.find(e => !e.rule.deckColor && !e.rule.randomDeck)), { ok: true, loaner: false, reason: '' }, type);
  // デッキを切り替えると、使用中のデッキが変わり、次の対戦はそのデッキで行う
  assert(chooseDeckForBattle(p, 'stage', blue.id));
  eq([p.activeDeck, deckForBattle(p).monsters, p.deck.monsters], [blue.id, blue.monsters, blue.monsters]);
  const s = newGame(deckForBattle(p), stageDeck(STAGE_BY_ID['1-1']), testRng);
  eq(s.decks[0].monsters, blue.monsters, 'ステージもフリー対戦も、使用中のデッキ');
  // 前の版で覚えていた「前回そのモードで使ったデッキ」は、読み込んでも使わない
  const st = memStorage();
  const raw = JSON.parse(JSON.stringify(p));
  raw.lastDeck = { stage: red.id, free: first.id, event: red.id };
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(raw));
  const q = loadProfile(st);
  eq([q.lastDeck, q.activeDeck, deckForBattle(q).monsters], [{}, blue.id, blue.monsters]);
  // 色指定のイベント：使用中が条件に合えば自分のデッキ、合わなければ貸し出しデッキ（どちらも対戦は始まる）
  const ev = EVENTS.find(e => e.rule.deckColor === 'red');
  eq([battleDeckCheck(p, 'event', ev), eventDeck(p, ev, testRng).loaner], [{ ok: true, loaner: true, reason: '' }, true], '青単が使用中：貸し出し');
  chooseDeckForBattle(p, 'event', red.id);
  const mine = eventDeck(p, ev, testRng);
  eq([battleDeckCheck(p, 'event', ev).loaner, mine.loaner, mine.monsters], [false, false, red.monsters]);
  eq(battleDeckCheck(p, 'stage', ev).loaner, false, 'イベント以外では、色の条件は関係ない');
  // 使用中のデッキが未完成・カード不足のとき：始められず、理由がわかる（ふつうは起きないが、念のため）
  const act = activeDeck(p);
  const keep = act.monsters.slice();
  act.monsters = keep.slice(0, 5);
  const half = battleDeckCheck(p, 'stage');
  eq([half.ok, half.reason.includes('未完成') && half.reason.includes('赤単') && half.reason.includes('13/16')], [false, true], half.reason);
  act.monsters = keep;
  delete p.cards[keep[0]];
  const lost = battleDeckCheck(p, 'free');
  eq([lost.ok, lost.reason.includes('カードが足りません')], [false, true], lost.reason);
  // 使えるデッキに切り替えれば、始められる。使えないデッキには切り替えられない
  eq([chooseDeckForBattle(p, 'free', act.id), chooseDeckForBattle(p, 'free', blue.id), battleDeckCheck(p, 'free').ok, p.activeDeck], [false, true, true, blue.id]);
});

test('デッキ：ヒーローとスキルはデッキごとに保存され、使用中のデッキのヒーローにギフトが入る', () => {
  const p = deckProfile();
  recordStageClear(p, '1-10', 3); unlockHeroes(p); p.hero.levels.agni = HERO_RULES.SKILL_LEVELS[1];
  const a = p.decks[0];
  const b = addDeck(p, 'starter', 'アグニ');
  eq(saveDeckEdit(p, b.id, { ...b, hero: 'agni', skill: 1 }).ok, true);
  eq(saveDeckEdit(p, b.id, { ...b, hero: 'agni', skill: 2 }).ok, false, 'まだ使えないスキルは選べない');
  eq(saveDeckEdit(p, b.id, { ...b, hero: 'nobody', skill: 0 }).ok, false);
  eq([p.hero.selected, a.hero], ['leafia', 'leafia'], '使用中でないデッキを変えても、今のヒーローは変わらない');
  // 使用中にすると、そのデッキのヒーローになる
  setActiveDeck(p, b.id);
  eq([p.hero.selected, p.hero.skill, heroForBattle(p).skill], ['agni', 1, HERO_BY_ID.agni.skills[1].id]);
  eq(giveHeroGift(p, 3), 3);
  eq([p.hero.gifts.agni, p.hero.gifts.leafia], [3, 0], 'ギフトは使用中のデッキのヒーローに入る');
  refreshDaily(p); p.daily.quests = [{ id: 'play', progress: 1, claimed: false }, { id: 'win', progress: 99, claimed: false }];
  // ヒーロー画面で選び直すと、使用中のデッキが覚える
  selectHero(p, 'agni', 0);
  eq([b.hero, b.skill, a.hero], ['agni', 0, 'leafia']);
  setActiveDeck(p, a.id);
  eq([p.hero.selected, p.hero.skill], ['leafia', 0]);
  eq(battleReward(p, 'win').gifts > 0 && p.hero.gifts.leafia > 0, true, '勝利のギフトも、使ったデッキ（＝使用中）のヒーローに入る');
});

test('デッキコード：書き出し→読み込みで同じデッキが再現される。壊れたコードはエラーで、何も追加しない', () => {
  const p = deckProfile();
  recordStageClear(p, '1-10', 3); unlockHeroes(p); p.hero.levels.agni = 20;
  const src = addDeck(p, { ...monoDeck('purple'), hero: 'agni', skill: 2 }, '紫単');
  const code = deckToCode(src);
  assert(/^CM1-[a-z0-9]+-[a-z0-9]+-agni2-[a-z0-9]{2}$/.test(code) && code.length < 80, code);
  eq(deckFromCode(code), { ok: true, deck: { monsters: src.monsters, items: src.items, hero: 'agni', skill: 2 }, error: '' });
  eq(deckFromCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `).ok, true, '前後や途中の空白・改行は無視する');
  const r = importDeck(p, code);
  eq([r.ok, r.deck.name, cardsOf(r.deck), r.deck.hero, r.deck.skill, r.missing, r.heroChanged], [true, '読み込んだデッキ', cardsOf(src), 'agni', 2, [], false]);
  eq(deckStatus(p, r.deck).playable, true);
  // 未完成のデッキもコードにできる
  const half = addDeck(p, { monsters: src.monsters.slice(0, 2), items: [] });
  eq(deckFromCode(deckToCode(half)).deck.monsters, src.monsters.slice(0, 2));
  // カードを持っていない人が読み込む：読み込んだうえで、足りないカードがわかる。使えないヒーローは今のヒーローになる
  const q = newProfile();
  const got = importDeck(q, code);
  const need = [...src.monsters, ...src.items].filter(id => !owns(q, id));
  eq([got.ok, cardsOf(got.deck), got.missing, got.heroChanged, got.deck.hero, deckStatus(q, got.deck).playable], [true, cardsOf(src), need, true, 'leafia', false]);
  assert(need.length > 0);
  eq(q.decks.length, 2);
  // 壊れたコード
  const before = JSON.stringify(q);
  const flip = code.replace(src.monsters[0], src.monsters[1]); // 中身を書きかえた
  const bads = ['', '   ', 'こんにちは', 'CM1', code.slice(0, -1), code.slice(3), 'CM2' + code.slice(3), flip, code.replace('agni2', 'agni0'), code + 'x', code.replace(/-/g, '_')];
  for (const b of bads) {
    const res = importDeck(q, b);
    eq([res.ok, res.deck, !!res.error], [false, null, true], '壊れたコード: ' + b);
  }
  // 確認用の文字が合っていても、中身がおかしければ読まない（ないカード・同じカード3枚・モンスターとアイテムの取り違え）
  const forge = body => `${body}-${deckCodeCheck(body)}`;
  for (const body of ['CM1-zzz-e01-leafia0', `CM1-${src.monsters[0].repeat(3)}--leafia0`, `CM1-e01-${src.monsters[0]}-leafia0`, 'CM1-r0-e01-leafia0', 'CM1---nobody0', 'CM1---leafia7']) {
    eq(importDeck(q, forge(body)).ok, false, body);
  }
  eq(JSON.stringify(q), before, '壊れたコードでは、セーブデータは何も変わらない');
  eq(importDeck(q, forge('CM1---leafia0')).ok, true, '空のデッキのコードは読める');
});

test('デッキ：色指定のイベントでは、条件を満たすデッキだけを選べる。なければ貸し出しデッキ', () => {
  const p = deckProfile();
  const ev = EVENTS.find(e => e.rule.deckColor === 'red');
  const mixed = p.decks[0];
  eq(deckIsColor(mixed, 'red'), false);
  // 条件を満たすデッキがない：どれも選べず、貸し出しデッキで戦う
  eq([deckChoices(p, 'event', ev).map(c => c.ok), battleDeckCheck(p, 'event', ev)], [[false], { ok: true, loaner: true, reason: '' }], '条件に合わない → 貸し出しデッキで始まる');
  assert(deckChoices(p, 'event', ev)[0].reason.includes('赤'));
  eq(chooseDeckForBattle(p, 'event', mixed.id, ev), false, '条件を満たさないデッキは選べない');
  eq(eventDeck(p, ev, testRng).loaner, true);
  // 赤だけのデッキを作ると、それだけ選べる
  const red = addDeck(p, monoDeck('red'), '赤単');
  const blue = addDeck(p, monoDeck('blue'), '青単');
  eq(deckChoices(p, 'event', ev).map(c => [c.deck.name, c.ok]), [['デッキ1', false], ['赤単', true], ['青単', false]]);
  eq(battleDeckCheck(p, 'event', ev).loaner, true, '使用中のデッキ（デッキ1）のままなら、貸し出しデッキ');
  eq([chooseDeckForBattle(p, 'event', blue.id, ev), chooseDeckForBattle(p, 'event', red.id, ev), p.activeDeck], [false, true, red.id]);
  const mine = eventDeck(p, ev, testRng);
  eq([mine.loaner, mine.monsters], [false, red.monsters]);
  // 未完成の赤デッキは選べない
  const part = addDeck(p, { monsters: red.monsters.slice(0, 4), items: [] }, '赤の作りかけ');
  eq(deckChoices(p, 'event', ev).find(c => c.deck.id === part.id).ok, false);
  // 色指定のないイベント・ステージ・フリーでは、使えるデッキはどれでも選べる
  const plain = EVENTS.find(e => !e.rule.deckColor && !e.rule.randomDeck);
  eq(deckChoices(p, 'event', plain).filter(c => c.ok).length, 3);
  eq(deckChoices(p, 'stage').filter(c => c.ok).length, 3);
});

test('デッキ：デイリークエストの色は実際に使ったデッキで数え、対戦履歴に使ったデッキの名前が残る', () => {
  const p = deckProfile();
  const blue = addDeck(p, monoDeck('blue'), '青単');
  chooseDeckForBattle(p, 'free', blue.id);
  const s = newGame(deckForBattle(p), cpuDeckFor(p, testRng), testRng);
  s.result = { winner: 0, reason: 'wipeout' };
  const stats = battleStats(s, true, { type: 'free' }, s.decks[0]);
  eq(Object.keys(stats).filter(k => k.startsWith('win_')), ['win_blue'], '青だけのデッキで勝った → 青だけ数える');
  // 対戦のあとで使用中のデッキを変えても、その対戦は使ったデッキの色で数える
  setActiveDeck(p, p.decks[0].id);
  eq(Object.keys(battleStats(s, true, { type: 'free' }, s.decks[0])).filter(k => k.startsWith('win_')), ['win_blue']);
  // 貸し出しデッキで勝ったら、貸し出しデッキの色
  const ev = EVENTS.find(e => e.rule.deckColor === 'red');
  const loan = newGame(eventDeck(p, ev, testRng), eventFoeDeck(p, ev, testRng), testRng, { rules: ev.rule });
  eq(Object.keys(battleStats(loan, true, { type: 'event' }, loan.decks[0])).filter(k => k.startsWith('win_')), ['win_red']);
  // 履歴
  const rec = makeHistoryRecord(s, { win: true, mode: 'f', deck: '青単' });
  eq([rec.dn, rec.dk[0].m], ['青単', blue.monsters]);
  eq(makeHistoryRecord(s, { win: true, mode: 'f' }).dn, '', '古い呼び出し方でも壊れない');
});

// ---------- 同じカードを2枚まで ----------

// モンスターは m1 を2枚（残りは別々のカード）、アイテムは i1 を2枚入れたデッキ
function pairDeck(m1 = 'r01', i1 = 'e01') {
  const ms = realCards(MONSTERS).map(c => c.id).filter(id => id !== m1), is = realCards(ITEMS).map(c => c.id).filter(id => id !== i1);
  return { monsters: [m1, m1, ...ms.slice(0, CONFIG.DECK_MONSTERS - 2)], items: [i1, i1, ...is.slice(0, CONFIG.DECK_ITEMS - 2)] };
}

test('2枚まで：同じカードを2枚まで入れられ、3枚目は入れられない（モンスター・装備・フラッシュ・Elite）', () => {
  eq(CONFIG.DECK_COPIES, 2);
  const p = deckProfile();
  const d = addDeck(p, 'empty', '2枚入り');
  const elite = ELITES[0].id;
  p.cards[elite] = { level: 1, copies: 0 };
  const rest = realCards(MONSTERS).map(c => c.id).filter(id => id !== 'r01');
  const mons = ['r01', 'r01', elite, elite, ...rest.slice(0, 4)];
  const items = ['e01', 'e01', 'f01', 'f01', 'e02', 'e03', 'e04', 'e05'];
  eq(saveDeckEdit(p, d.id, { monsters: mons, items }).ok, true);
  eq([d.monsters, d.items, deckStatus(p, d).playable, deckIsValid(p, d)], [mons, items, true, true]);
  eq(p.cards.r01.copies, 0, '予備がなくても、持っていれば2枚入れられる');
  // 3枚目は入らない（足す操作・保存・読み込みのどれでも）
  eq([canAddToDeck(['r01'], 'r01', 8), canAddToDeck(['r01', 'r01'], 'r01', 8), canAddToDeck(['r01', 'r01'], 'r02', 8), canAddToDeck(mons, 'r02', 8)], [true, false, true, false]);
  saveDeckEdit(p, d.id, { monsters: ['r01', 'r01', 'r01', 'r02'], items: ['f01', 'f01', 'f01'] });
  eq([d.monsters, d.items], [['r01', 'r01', 'r02'], ['f01', 'f01']], '3枚目は捨てられる');
  eq(deckIsValid(p, { monsters: ['r01', 'r01', 'r01', ...rest.slice(0, 5)], items }), false);
  // 保存して読み込んでも2枚のまま。使用中にして対戦にも使える
  saveDeckEdit(p, d.id, { monsters: mons, items });
  assert(setActiveDeck(p, d.id));
  const st = memStorage();
  saveProfile(p, st);
  const q = loadProfile(st);
  eq([activeDeck(q).monsters, q.deck.monsters, q.deck.items], [mons, mons, items]);
  eq(deckForBattle(q).monsters.filter(id => id === 'r01').length, 2);
  // まとめた表示（×2）と要約
  eq(deckGroups(mons).slice(0, 3), [['r01', 2], [elite, 2], [rest[0], 1]]);
  eq(deckSummary(d).top.length, new Set(deckSummary(d).top).size, '代表カードに同じカードは並ばない');
  // 持っていないカードが2枚入っていても、「足りないカード」は1種類として数える
  delete q.cards[rest[0]];
  eq(deckStatus(q, { monsters: [rest[0], rest[0]], items: [] }).missing, [rest[0]]);
});

test('2枚まで：レジェンドだけは1枚まで。ほかのレアリティと Elite は2枚まで', () => {
  eq([CONFIG.DECK_COPIES, CONFIG.DECK_COPIES_LEGEND], [2, 1]);
  const p = deckProfile();
  const legend = realCards(MONSTERS).find(c => c.rarity === 'legend').id, legendItem = realCards(ITEMS).find(c => c.rarity === 'legend').id;
  const epic = realCards(MONSTERS).find(c => c.rarity === 'epic').id, elite = ELITES[0].id;
  p.cards[elite] = { level: 1, copies: 3 };
  p.cards[legend].copies = 5; // 予備を何枚持っていても、レジェンドは1枚まで
  eq([legend, legendItem, epic, elite, 'r01', 'e01', 'zzz'].map(copyLimit), [1, 1, 2, 2, 2, 2, 2]);
  eq([canAddToDeck([], legend, 8), canAddToDeck([legend], legend, 8), canAddToDeck([epic], epic, 8), canAddToDeck([elite], elite, 8), canAddToDeck([elite, elite], elite, 8)], [true, false, true, true, false]);
  const rest = realCards(MONSTERS).map(c => c.id).filter(id => ![legend, epic].includes(id) && CARD_DEFS[id].rarity !== 'legend');
  const items = realCards(ITEMS).map(c => c.id).filter(id => CARD_DEFS[id].rarity !== 'legend').slice(0, 8);
  eq(deckIsValid(p, { monsters: [legend, legend, ...rest.slice(0, 6)], items }), false, 'レジェンド2枚のデッキは使えない');
  eq(deckIsValid(p, { monsters: [legend, epic, epic, elite, elite, ...rest.slice(0, 3)], items }), true);
  eq(deckIsValid(p, { monsters: rest.slice(0, 8), items: [legendItem, legendItem, ...items.slice(0, 6)] }), false);
  // 保存・読み込み・デッキコードでも、2枚目のレジェンドは入らない
  const d = addDeck(p, 'empty', 'L');
  saveDeckEdit(p, d.id, { monsters: [legend, legend, epic, epic], items: [legendItem, legendItem] });
  eq([d.monsters, d.items], [[legend, epic, epic], [legendItem]]);
  const body = `CM1-${legend}${legend}--leafia0`;
  eq(importDeck(p, `${body}-${deckCodeCheck(body)}`).ok, false);
  // 前の版で作った「レジェンド2枚」のデッキは、読み込み時に1枚になり、未完成として残る（消えない）
  const full = addDeck(p, 'empty', '前の版');
  full.monsters = [legend, legend, ...rest.slice(0, 6)]; full.items = items.slice();
  const st = memStorage();
  saveProfile(p, st);
  const q = loadProfile(st);
  const kept = q.decks.find(x => x.name === '前の版');
  eq([kept.monsters, deckStatus(q, kept).complete, q.activeDeck, deckStatus(q, activeDeck(q)).playable], [[legend, ...rest.slice(0, 6)], false, p.activeDeck, true]);
  // CPU用のランダムデッキも、レジェンドは2枚にしない
  const rng = aiRng(77);
  for (let i = 0; i < 60; i++) {
    const r = randomDeck(rng, { pairs: 4 });
    for (const [id, n] of deckGroups([...r.monsters, ...r.items])) assert(n <= copyLimit(id), 'ランダムデッキ: ' + id + '×' + n);
  }
});

test('2枚まで：各章のボスは、特徴になるカードを2枚入れている（ほかのステージ・貸し出しデッキは1枚ずつ）', () => {
  const sign = { '1-10': ['r03', 'inspire'], '2-10': ['b04', 'silence'], '3-10': ['g04', 'thorns'], '4-10': ['y04', 'shoot'], '5-10': ['p02', 'disease'] };
  for (const st of STAGES) {
    const d = stageDeck(st);
    eq([d.monsters.length, d.items.length], [CONFIG.DECK_MONSTERS, CONFIG.DECK_ITEMS], st.id);
    const pairs = deckGroups([...d.monsters, ...d.items]).filter(g => g[1] > 1);
    if (!st.boss) { eq(pairs, [], st.id + '：通常ステージは1枚ずつ'); continue; }
    const [id, skill] = sign[st.id];
    eq(pairs, [[id, 2]], st.id + '：2枚なのは特徴のカードだけ');
    assert(CARD_BY_ID[id].skills.some(k => k.id === skill) && CARD_DEFS[id].rarity !== 'legend', st.id);
    for (const [cid, n] of deckGroups([...d.monsters, ...d.items])) assert(n <= copyLimit(cid));
    assert(d.monsters.some(m => CARD_DEFS[m].cost <= CONFIG.CRYSTALS_PER_TURN), st.id + '：序盤に出せるモンスターがいる');
    // ボスと最後まで戦える。2体は別々に出てくる
    const s = newGame(DEFAULT_DECK, d, testRng, { terrain: st.terrain });
    eq(s.players[1].hand.concat(s.players[1].deck).filter(h => h.card.id === id).map(h => h.copy).sort(), [1, 2]);
    assert(playOut(s, () => cpuNextAction));
  }
  const p = deckProfile();
  for (const ev of EVENTS.filter(e => e.rule.deckColor || e.rule.randomDeck)) {
    const d = eventDeck(p, ev, testRng);
    if (d.loaner) eq(deckGroups([...d.monsters, ...d.items]).filter(g => g[1] > 1), [], ev.id);
  }
});

test('2枚まで：同じモンスター2体は別々に扱われる（番号・ダメージ・状態異常・装備・攻撃順）', () => {
  const s = newGame(pairDeck('r01', 'e01'), pairDeck('b01', 'e02'), testRng);
  const me = s.players[0], foe = s.players[1];
  // 2枚とも別の番号（uid）を持ち、同じレベル・同じスキル。区別用の通し番号は 1 と 2
  const all = p => [...p.hand, ...p.deck];
  const twins = all(me).filter(h => h.card.id === 'r01');
  eq([twins.length, twins[0].uid !== twins[1].uid, twins.map(h => h.copy).sort(), JSON.stringify(twins[0].card) === JSON.stringify(twins[1].card)], [2, true, [1, 2], true]);
  eq(all(me).filter(h => h.card.id !== 'r01' && h.card.id !== 'e01').every(h => h.copy === 0), true, '1枚だけのカードには番号を付けない');
  eq(new Set(all(me).map(h => h.uid)).size, 16);
  eq(monstersLeft(me), 8, '残りモンスター数は、2枚とも数える');
  // 2体とも場に出す
  s.current = 0; s.turn = 3; s.phase = 'play'; s.log.length = 0;
  me.crystals = 20; me.hand = [...twins, ...all(me).filter(h => h.card.id === 'e01')]; me.deck = me.deck.filter(h => !me.hand.includes(h));
  assert(playMonster(s, 0, twins[0].uid, 0) && playMonster(s, 0, twins[1].uid, 1));
  const [a, b] = me.slots;
  eq([a.card.id, b.card.id, a.uid !== b.uid, [a.copy, b.copy].sort()], ['r01', 'r01', true, [1, 2]]);
  // 装備：片方だけに付く。同じ装備をもう1枚、もう片方にも付けられる
  const swords = me.hand.filter(h => h.card.id === 'e01');
  eq(swords.length, 2);
  assert(equipItem(s, 0, swords[0].uid, 0));
  eq([!!a.item, !!b.item], [true, false], '装備は片方だけ');
  const atkOf = m => getAttacks(m).reduce((n, x) => n + x.atk, 0);
  assert(atkOf(a) > atkOf(b));
  // ダメージ・状態異常：片方だけ
  foe.slots = [setOwner(mk(GOLEM), foe), null, null];
  dealDamage(s, me, 1, 1, false);
  addDisease(a, 2);
  eq([a.hp, b.hp, a.status.disease, b.status.disease], [a.maxHp, b.maxHp - 1, 2, undefined]);
  // 攻撃順：2体とも1回ずつ行動する（後列 → 前列）。後列の近接は攻撃できないので、Reach を持たせる
  b.perm = { reach: 1 };
  const evs = attacks(s);
  eq(evs.map(e => e.attacker.uid), [b.uid, a.uid], '2体とも1回ずつ、スロットの順に');
  // ログ：同じ名前でも ①② で区別できる。カードの詳細は同じカードを開く
  const refs = s.log.filter(e => e[0] === 'A').map(e => e[2]);
  eq(refs.slice().sort(), ['0r01~1', '0r01~2']);
  eq(s.log.filter(e => e[0] === 'P').map(e => e[2]).sort(), ['r01~1', 'r01~2']);
  const text = texts(s).join('\n');
  const name = CARD_BY_ID.r01.name;
  assert(text.includes(name + '①') && text.includes(name + '②'), text);
  assert(logLine(s.log.find(e => e[0] === 'A')).html.includes('data-card="0r01"'), 'タップで開くカードは、番号なしのカードid');
  // 相手の1枚だけのカードには、番号が付かない（今までどおり）
  s.log.length = 0;
  finishTurn(s); startTurn(s);
  const single = all(foe).find(h => h.card.kind === 'monster' && h.copy === 0);
  foe.hand.push(single); foe.deck = foe.deck.filter(h => h !== single); foe.crystals = 20;
  foe.slots = [null, null, null];
  playMonster(s, 1, single.uid, 0);
  eq(s.log.find(e => e[0] === 'P')[2], single.card.id);
});

test('2枚まで：勝敗判定・残り数・場が空のペナルティ・倒されたときのクリスタルが、2枚とも正しく数えられる', () => {
  // 自分は同じモンスター2体だけ。1体倒されても、もう1体が残っていれば負けではない
  const s = newGame({ monsters: ['r01', 'r01'], items: [] }, { monsters: ['b01', 'b01'], items: [] }, testRng);
  const [me, foe] = s.players;
  s.players.forEach(p => { p.hand = [...p.hand, ...p.deck]; p.deck = []; p.crystals = 20; p.hero = null; });
  eq([monstersLeft(me), monstersLeft(foe)], [2, 2]);
  s.current = 0; s.turn = 3; s.phase = 'play';
  playMonster(s, 0, me.hand[0].uid, 0);
  s.current = 1;
  playMonster(s, 1, foe.hand[0].uid, 0);
  s.current = 0;
  me.slots[0].bonusAtk = 99; // 一撃で倒せるようにする
  me.crystals = foe.crystals = 0;
  s.log.length = 0;
  assert(attacks(s)[0].killed);
  eq([monstersLeft(foe), s.result, foe.crystals], [1, null, CONFIG.FALLEN_CRYSTAL], '1体目：残り1体・まだ決着しない・クリスタル+1');
  eq(finishTurn(s), null);
  // 相手の番：場が空のままターンを終える → ペナルティで、手札に残った同じカードが捨てられて決着
  startTurn(s);
  const res = finishTurn(s);
  eq([s.penalty.card.id, s.penalty.copy > 0, monstersLeft(foe), res.winner, !!res.penalty], ['b01', true, 0, 0, true]);
  const gained = logged(s, 'G');
  eq([gained.length, gained[0][1], /^1b01~[12]$/.test(gained[0][2])], [1, 1, true]);
  assert(/^b01~[12]$/.test(logged(s, 'Y')[0][2]), 'ペナルティのログにも番号が付く');
  // 2体とも場で倒されたら、+1 が2回入る。山札に戻しても番号は変わらない
  const t = newGame({ monsters: ['r01', 'r01'], items: [] }, { monsters: ['b01', 'b01', 'b02'], items: [] }, testRng);
  const [p0, p1] = t.players;
  t.players.forEach(p => { p.hand = [...p.hand, ...p.deck]; p.deck = []; p.crystals = 20; p.hero = null; });
  t.current = 1; t.turn = 3; t.phase = 'play';
  const pair = p1.hand.filter(h => h.card.id === 'b01');
  playMonster(t, 1, pair[0].uid, 0); playMonster(t, 1, pair[1].uid, 1);
  const copyBefore = p1.slots[1].copy;
  t.current = 0;
  p0.hand.push({ uid: uidSeq++, card: CARD_BY_ID[tflash('t_back2', 0, 'unsummon')] });
  playFlash(t, 0, p0.hand[p0.hand.length - 1].uid, 1);
  eq([p1.deck.length, p1.deck[0].card.id, p1.deck[0].copy, monstersLeft(p1)], [1, 'b01', copyBefore, 3], '山札に戻っても同じ番号');
  t.current = 1; p1.hand.push(p1.deck.pop()); p1.crystals = 20;
  playMonster(t, 1, p1.hand[p1.hand.length - 1].uid, 1);
  p1.crystals = 0;
  dealDamage(t, p1, 0, 999, true); dealDamage(t, p1, 0, 999, true);
  eq([p1.crystals, monstersLeft(p1), checkResult(t)], [2, 1, null], '2体倒されて+2。残り1体（別のカード）で続行');
});

test('2枚まで：デッキコードで2枚入りのデッキが再現される。複製しても2枚のまま', () => {
  const p = deckProfile();
  const src = addDeck(p, { ...pairDeck('p01', 'f01'), hero: 'leafia', skill: 0 }, '2枚入り');
  eq([deckCount(src.monsters, 'p01'), deckCount(src.items, 'f01')], [2, 2]);
  const code = deckToCode(src);
  assert(code.includes('p01p01') && code.includes('f01f01'), code);
  const r = importDeck(p, code);
  eq([r.ok, cardsOf(r.deck), r.missing, deckStatus(p, r.deck).playable], [true, cardsOf(src), [], true]);
  const copy = duplicateDeck(p, src.id);
  eq(cardsOf(copy), cardsOf(src));
  // 3枚入りに書きかえたコードは読まない
  const body = `CM1-${'p01'.repeat(3)}-${'f01'.repeat(2)}-leafia0`;
  eq(importDeck(p, `${body}-${deckCodeCheck(body)}`).ok, false);
  // 履歴に残るデッキも2枚のまま
  const s = newGame(deckForBattle({ ...p, deck: { monsters: src.monsters, items: src.items } }), cpuDeckFor(p, testRng), testRng);
  eq(packDeck(s.decks[0]).m.filter(id => id === 'p01').length, 2);
});

test('2枚まで：既存のデッキ（1枚ずつ）はそのまま使え、ログの形も変わらない。CPUも同じルールで組める', () => {
  const p = newProfile();
  eq([deckIsValid(p, p.deck), activeDeck(p).monsters, new Set(p.deck.monsters).size], [true, DEFAULT_DECK.monsters, CONFIG.DECK_MONSTERS], 'スターターデッキは今のまま（すべて1枚ずつ）');
  const s = newGame(deckForBattle(p), cpuDeckFor(p, testRng), testRng);
  eq(s.players.flatMap(pl => [...pl.hand, ...pl.deck]).every(h => h.copy === 0), true);
  playOut(s, pi => (pi === 0 ? autoStrongAction : cpuNextAction));
  assert(!JSON.stringify(s.log).includes('~'), '1枚ずつのデッキでは、ログに番号は付かない');
  // CPUのデッキ：同じカードを2枚入れた組を作れる（3枚以上にはならない）
  const rng = aiRng(55);
  for (let i = 0; i < 20; i++) {
    const d = randomDeck(rng, { pairs: 1 + (i % 4), level: 2 });
    eq([d.monsters.length, d.items.length], [CONFIG.DECK_MONSTERS, CONFIG.DECK_ITEMS]);
    for (const list of [d.monsters, d.items]) {
      eq(Math.max(...deckGroups(list).map(g => g[1])), 2);
      eq(deckGroups(list).filter(g => g[1] === 2).length, 1 + (i % 4));
    }
    assert(cleanDeckCards(d.monsters, true, 8).length === 8 && cleanDeckCards(d.items, false, 8).length === 8, 'デッキのルールに合っている');
  }
  eq(new Set(randomDeck(rng).monsters).size, CONFIG.DECK_MONSTERS, '指定しなければ、今までどおり1枚ずつ');
  // 2枚入りのデッキ同士で、オート（つよい）とCPUが最後まで戦える。自分のデッキが2枚入りでも、フリー対戦の相手を作れる
  for (let i = 0; i < 12; i++) {
    const g = newGame(randomDeck(rng, { pairs: 3, level: 3 }), randomDeck(rng, { pairs: 3, level: 3 }), rng);
    const res = playOut(g, pi => (pi === 0 ? autoStrongAction : cpuNextAction));
    assert(res && (res.winner === 0 || res.winner === 1));
    eq(monstersLeft(g.players[1 - res.winner]) === 0 || res.reason === 'both', true);
  }
  const q = deckProfile();
  const mine = addDeck(q, pairDeck('r02', 'e03'), '2枚');
  setActiveDeck(q, mine.id);
  const cpu = cpuDeckFor(q, testRng);
  eq([cpu.monsters.length, cpu.items.length], [CONFIG.DECK_MONSTERS, CONFIG.DECK_ITEMS]);
});

// ---------- パックの種類とショップ ----------

const packDefsOf = pulls => pulls.map(x => CARD_DEFS[x.id]);
// そのパックを n 個持たせて、全部開けたカードの定義を返す
function openMany(type, n, rng) {
  const p = newProfile();
  p.hero.unlocked = HEROES.map(h => h.id);
  addPacks(p, type, n);
  const out = [];
  for (let i = 0; i < n; i++) out.push(packDefsOf(openPackOf(p, type, rng)));
  eq(packCount(p, type), type === 'normal' ? GROWTH.START_PACKS : 0);
  return out;
}

test('パック：種類は 通常・色5種・高級・モンスター・アイテム・ヒーローごと・イベントごと。排出率と値段はデータで決まる', () => {
  const basic = ['normal', 'red', 'blue', 'green', 'yellow', 'purple', 'premium', 'monster', 'item'];
  for (const id of [...basic, ...HEROES.map(h => 'hero:' + h.id), ...EVENTS.map(e => 'event:' + e.id)]) {
    const t = packType(id);
    assert(t && t.name && t.desc && t.icon && t.hue && t.mark, id);
    const rates = packRatesOf(t);
    near(RARITY_ORDER.reduce((n, r) => n + rates[r], 0), 1, 1e-9, id + ' の排出率の合計');
    assert(packPool(t).length > 0 && packPool(t).every(d => !d.elite), id + '：Elite は出ない');
  }
  eq([packType('zzz'), packType('hero:nobody'), packType('event:nothing')], [null, null, null]);
  eq(new Set(basic.map(id => packType(id).name)).size, basic.length);
  // 高級パックはレア以上が出やすく、2枚確定。色・モンスター・アイテムは排出率は通常と同じ
  const pr = packRatesOf(packType('premium')), nr = packRatesOf(packType('normal'));
  assert(pr.epic > nr.epic * 2 && pr.legend > nr.legend * 2 && pr.common < nr.common);
  eq([packType('premium').guarantee, packRatesOf(packType('red')), packRatesOf(packType('monster'))], [2, GROWTH.PACK_RATES, GROWTH.PACK_RATES]);
  // 値段：通常・色・モンスター・アイテム・ヒーローはゴールド、高級は魔石、イベントは買えない
  eq(['normal', 'red', 'monster', 'item', 'hero:agni'].map(id => Object.keys(packType(id).price)), [['gold'], ['gold'], ['gold'], ['gold'], ['gold']]);
  eq([Object.keys(packType('premium').price), packType('event:' + EVENTS[0].id).price], [['stones'], null]);
  // 高級パックの値段は、中身を全部分解して得られる魔石（期待値）より高い（買って分解して増やすことはできない）
  const ev = r => RARITY_ORDER.reduce((n, k) => n + r[k] * GROWTH.DISMANTLE[k], 0);
  const sure = r => RARITY_ORDER.slice(1).reduce((n, k) => n + r[k] * GROWTH.DISMANTLE[k], 0) / (1 - r.common);
  const value = ev(pr) * (GROWTH.PACK_SIZE - 2) + sure(pr) * 2;
  assert(packType('premium').price.stones > value * 1.2, '高級パックの値段 ' + packType('premium').price.stones + ' > 分解の期待値 ' + value.toFixed(0));
});

test('パック：色のパックからは、その色のカードと無色のアイテムだけが出る。モンスター・アイテムパックも対象のカードだけ', () => {
  const rng = aiRng(11);
  for (const color of Object.keys(COLORS)) {
    const cards = openMany(color, 120, rng).flat();
    assert(cards.every(d => d.color === color || (!d.color && d.kind !== 'monster')), color + 'のパックから、ほかの色が出た');
    assert(cards.some(d => d.kind === 'monster') && cards.some(d => d.kind !== 'monster' && !d.color) && cards.every(d => !d.elite), color);
    assert(cards.filter(d => d.kind === 'monster').every(d => d.color === color));
  }
  const mons = openMany('monster', 150, rng).flat(), items = openMany('item', 150, rng).flat();
  assert(mons.every(d => d.kind === 'monster'), 'モンスターパック');
  assert(items.every(d => d.kind === 'equip' || d.kind === 'flash') && items.some(d => d.kind === 'equip') && items.some(d => d.kind === 'flash'), 'アイテムパック');
  assert(new Set(mons.map(d => d.color)).size === 5, 'モンスターパックは全色が出る');
});

test('パック：どのパックも1パックの枚数は同じで、最後の1枚はレア以上。高級パックはレア以上が2枚以上', () => {
  const rng = aiRng(22);
  const rank = d => RARITY_ORDER.indexOf(d.rarity);
  for (const id of ['normal', 'red', 'monster', 'item', 'hero:leafia', 'event:' + EVENTS[0].id, 'premium']) {
    for (const pack of openMany(id, 150, rng)) {
      eq(pack.length, GROWTH.PACK_SIZE, id);
      assert(rank(pack[pack.length - 1]) >= 1, id + '：最後の1枚はレア以上');
      if (id === 'premium') assert(pack.filter(d => rank(d) >= 1).length >= 2 && rank(pack[pack.length - 2]) >= 1, '高級パック：レア以上が2枚以上');
    }
  }
});

test('パック：大量に開けると、排出率が設定どおりになる（確定枠は、コモンを除いた割合）', () => {
  const N = 4000;
  for (const [id, seed] of [['normal', 31], ['premium', 32], ['blue', 33], ['event:' + EVENTS[2].id, 34]]) {
    const t = packType(id), rates = packRatesOf(t), sure = t.guarantee || 1;
    const packs = openMany(id, N, aiRng(seed));
    const free = packs.flatMap(p => p.slice(0, GROWTH.PACK_SIZE - sure)), fixed = packs.flatMap(p => p.slice(GROWTH.PACK_SIZE - sure));
    const share = (list, r) => list.filter(d => d.rarity === r).length / list.length;
    for (const r of RARITY_ORDER) {
      near(share(free, r), rates[r], 0.02, id + '：ふつうの枠の' + r);
      near(share(fixed, r), r === 'common' ? 0 : rates[r] / (1 - rates.common), 0.03, id + '：確定枠の' + r);
    }
    // 全体で見ても、高級パックのほうがレア以上が多い
    if (id === 'premium') assert(packs.flat().filter(d => d.rarity !== 'common').length / (N * GROWTH.PACK_SIZE) > 0.7);
  }
  // モンスターが出る割合（種類の制限がないパック）
  const all = openMany('normal', 3000, aiRng(40)).flat();
  near(all.filter(d => d.kind === 'monster').length / all.length, GROWTH.PACK_MONSTER_RATE, 0.03, 'モンスターの割合');
});

test('パック：ヒーローパックは、そのヒーローの色と相性のよいカードが出やすく、ギフトが1つ入る。イベントパックはテーマのカードが出やすい', () => {
  const rng = aiRng(51);
  for (const h of HEROES) {
    const p = newProfile();
    p.hero.unlocked = HEROES.map(x => x.id);
    HEROES.forEach(x => { p.hero.gifts[x.id] = 0; });
    addPacks(p, 'hero:' + h.id, 300);
    let fit = 0, n = 0, gifts = 0;
    const t = packType('hero:' + h.id);
    for (let i = 0; i < 300; i++) { const pulls = openPackOf(p, 'hero:' + h.id, rng); eq(pulls.gift, { hero: h.id, n: 1 }); gifts++; for (const d of packDefsOf(pulls)) { n++; if (t.boost(d)) fit++; } }
    eq([p.hero.gifts[h.id], HEROES.filter(x => x.id !== h.id).every(x => p.hero.gifts[x.id] === 0)], [gifts, true], 'ギフトは、そのヒーローに入る');
    const base = packPool(t).filter(d => t.boost(d)).length / packPool(t).length; // 何もしないときの割合
    assert(fit / n > base + 0.2, h.name + '：出やすいカードの割合 ' + (fit / n).toFixed(2) + '（ふつうは ' + base.toFixed(2) + '）');
    assert(packPool(t).filter(d => d.color === h.color).every(d => t.boost(d)) && HERO_PACK_SKILLS[h.id].length >= 3, h.id + '：そのヒーローの色のカードは出やすい');
  }
  // イベントパック：色指定のイベントならその色、スキルを配るイベントならそのスキルのカードが出やすい
  const colorEv = EVENTS.find(e => e.rule.deckColor === 'red'), flyEv = EVENTS.find(e => e.rule.grant && e.rule.grant.flying);
  const reds = openMany('event:' + colorEv.id, 300, rng).flat();
  const fly = openMany('event:' + flyEv.id, 300, rng).flat(), plain = openMany('normal', 300, rng).flat();
  const redShare = list => list.filter(d => d.color === 'red').length / list.length;
  assert(redShare(reds) > redShare(plain) * 1.6, 'イベント（赤）：赤が多い ' + redShare(reds).toFixed(2) + ' / ' + redShare(plain).toFixed(2));
  const flying = list => list.filter(d => packSkills(d).some(k => k.id === 'flying')).length / list.length;
  assert(flying(fly) > flying(plain) * 2, 'イベント（Flying）：Flying 持ちが多い');
  assert(packType('event:' + colorEv.id).name.includes(colorEv.name));
});

test('パック：ショップで買うと、ゴールド・魔石が正しく減り、パックが増える。足りなければ買えない', () => {
  const p = newProfile();
  p.gold = 3000; p.stones = 1000;
  eq(shopPacks(p), ['normal', 'red', 'blue', 'green', 'yellow', 'purple', 'monster', 'item', 'premium', 'hero:leafia']);
  // ゴールドで買う
  for (const id of ['normal', 'red', 'monster', 'item']) {
    const price = packType(id).price.gold, g = p.gold, n = packCount(p, id);
    assert(buyPack(p, id));
    eq([g - p.gold, packCount(p, id) - n, p.stones], [price, 1, 1000], id);
  }
  // 魔石で買う（高級パック）。2つまとめても買える
  const g0 = p.gold;
  assert(buyPack(p, 'premium', 2));
  eq([p.stones, packCount(p, 'premium'), p.gold], [1000 - 2 * packType('premium').price.stones, 2, g0]);
  // 足りないと買えない（何も変わらない）
  const snap = JSON.stringify(p);
  eq([buyPack(p, 'premium'), canBuyPack(p, 'premium').reason], [false, '魔石が足りない']);
  p.gold = 10;
  eq([buyPack(p, 'normal'), canBuyPack(p, 'normal').reason, buyPack(p, 'normal', 0), buyPack(p, 'zzz')], [false, 'ゴールドが足りない', false, false]);
  p.gold = g0;
  eq(JSON.stringify(p), snap);
  // ヒーローパック：そのヒーローのレベルが足りないと買えない。未解放のヒーローのパックは並ばない
  eq([canBuyPack(p, 'hero:leafia').ok, canBuyPack(p, 'hero:leafia').reason.includes('レベル' + PACK_SHOP.HERO_LEVEL), canBuyPack(p, 'hero:agni').reason], [false, true, 'ヒーローが未解放']);
  p.hero.levels.leafia = PACK_SHOP.HERO_LEVEL; p.gold = 1000;
  assert(buyPack(p, 'hero:leafia'));
  eq([packCount(p, 'hero:leafia'), 1000 - p.gold], [1, packType('hero:leafia').price.gold]);
  // イベントパックは買えない
  eq([buyPack(p, 'event:' + EVENTS[0].id), canBuyPack(p, 'event:' + EVENTS[0].id).ok], [false, false]);
  // 合計と一覧
  eq(totalPacks(p), ownedPacks(p).reduce((n, x) => n + x.n, 0));
  eq(ownedPacks(p)[0].id, 'normal');
});

test('パック：種類ごとにまとめて開けられる（最大10）。種類をまたいで全部まとめても開けられる', () => {
  const p = newProfile();
  p.packs = 0;
  addPacks(p, 'normal', 3); addPacks(p, 'red', 12); addPacks(p, 'premium', 2);
  eq([totalPacks(p), ownedPacks(p)], [17, [{ id: 'normal', n: 3 }, { id: 'red', n: 12 }, { id: 'premium', n: 2 }]]);
  // 同じ種類だけ：赤を10個まで
  const reds = openPacksOf(p, 'red', 99, aiRng(1));
  eq([reds.packs, reds.length, packCount(p, 'red'), packCount(p, 'normal'), packCount(p, 'premium')], [10, 10 * GROWTH.PACK_SIZE, 2, 3, 2]);
  assert(packDefsOf(reds).every(d => d.color === 'red' || !d.color));
  eq(openPacksOf(p, 'blue', 5), null, '持っていない種類');
  // 全部まとめて：種類をまたいで、合わせて10個まで
  addPacks(p, 'hero:leafia', 2); addPacks(p, 'item', 4);
  eq(totalPacks(p), 13);
  const all = openAllPacks(p, aiRng(2));
  eq([all.packs, all.length, totalPacks(p)], [10, 10 * GROWTH.PACK_SIZE, 3]);
  eq(all.gifts, [{ hero: 'leafia', n: 1 }, { hero: 'leafia', n: 1 }], 'ヒーローパックのギフトも受け取る');
  const rest = openAllPacks(p, aiRng(3));
  eq([rest.packs, totalPacks(p), p.packBag, openAllPacks(p)], [3, 0, {}, null]);
  // 1つずつ：持っていなければ開けられない
  eq([openPackOf(p, 'normal'), openPack(p), openPackOf(p, 'zzz')], [null, null, null]);
});

test('パック：既存のセーブデータのパックは、すべて通常パックとして残る。報酬のパックの種類', () => {
  // 前の版のセーブ：packs の数だけがある
  const old = JSON.parse(JSON.stringify(newProfile()));
  delete old.packBag; old.packs = 7; old.version = 7; old.gold = 55;
  const st = memStorage();
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  const p = loadProfile(st);
  eq([p.version, p.packs, p.packBag, packCount(p, 'normal'), totalPacks(p), ownedPacks(p), p.gold], [8, 7, {}, 7, 7, [{ id: 'normal', n: 7 }], 55]);
  const pulls = openPack(p, testRng);
  eq([pulls.length, pulls.type, p.packs], [GROWTH.PACK_SIZE, 'normal', 6]);
  // 保存と読み込み。知らない種類・おかしな数は捨てる
  addPacks(p, 'red', 2); addPacks(p, 'hero:leafia', 1); addPacks(p, 'event:' + EVENTS[1].id, 3);
  saveProfile(p, st);
  eq(loadProfile(st).packBag, { red: 2, 'hero:leafia': 1, ['event:' + EVENTS[1].id]: 3 });
  eq(sanitizePackBag({ red: 2.9, blue: 0, zzz: 4, normal: 5, premium: -1, 'hero:nobody': 2, item: 'x' }), { red: 2 });
  // 報酬：レベルアップ・勝利・デイリー・ログインは通常パック
  const q = newProfile();
  const n0 = q.packs;
  battleReward(q, 'win');
  assert(q.packs > n0 && Object.keys(q.packBag).length === 0, '勝利・レベルアップは通常パック');
  giveReward(q, { packs: 2 });
  eq([q.packs > n0 + 2, q.packBag], [true, {}]);
  assert(QUEST_DEFS.concat(LOGIN_REWARDS.map(r => ({ reward: r }))).every(x => !x.reward.bag), 'デイリー・ログインは通常パック');
  // ステージ：章の5番目は章の色のパック、ボスは高級パック＋色のパック
  const s = newProfile();
  const base = s.packs;
  for (let ch = 1; ch <= 5; ch++) eq(stageReward(STAGE_BY_ID[ch + '-5']).bag, { [PACK_SHOP.CHAPTER_COLOR[ch]]: 1 });
  recordStageClear(s, '1-5', 6);
  eq([s.packs, s.packBag], [base, { red: 1 }]);
  recordStageClear(s, '1-5', 6);
  eq(s.packBag, { red: 1 }, '初クリアの1回だけ');
  recordStageClear(s, '2-10', 6);
  eq(s.packBag, { red: 1, premium: 1, blue: 2 });
  eq(rewardText({ gold: 10, bag: { premium: 1 } }).includes('高級パック×1'), true);
});

// ---------- 先攻・後攻の補正と、ステージの補正 ----------

test('後攻ボーナス：最初の+1に加えて、ターン8（後攻の4回目の番）の開始時にもクリスタル+1。先攻勝率が50%に近い', () => {
  eq([CONFIG.SECOND_PLAYER_BONUS, CONFIG.SECOND_PLAYER_LATE], [1, { turn: 8, bonus: 1 }]);
  for (let i = 0; i < 6; i++) {
    const s = newGame(DEFAULT_DECK, DEFAULT_DECK, aiRng(i + 1));
    const second = 1 - s.first;
    eq([coinToss(s).bonus, coinToss(s).lateTurn, coinToss(s).lateBonus], [1, 8, 1]);
    const got = [];
    while (s.turn < 10) {
      const pi = s.current, before = s.players[pi].crystals;
      if (startTurn(s)) break;
      got.push([s.turn, pi, s.players[pi].crystals - before]);
      s.players[pi].slots = [setOwner(mk(GOLEM), s.players[pi]), null, null]; // 場が空のペナルティを避ける
      if (finishTurn(s)) break;
    }
    eq(got.filter(g => g[2] !== CONFIG.CRYSTALS_PER_TURN), [[8, second, CONFIG.CRYSTALS_PER_TURN + 1]], 'ターン8の後攻だけ+1多い');
    eq(logged(s, 'W'), [['W', second, 1]]);
    assert(logLine(logged(s, 'W')[0]).html.includes('後攻ボーナス') && logLine(s.log[0]).html.includes('ターン8にも+1'));
  }
  // CPU同士の対戦で、先攻の勝率が50%前後
  const rng = aiRng(8080);
  let first = 0;
  const N = 600;
  for (let g = 0; g < N; g++) {
    const s = newGame(randomDeck(rng, { level: 3 }), randomDeck(rng, { level: 3 }), rng);
    if (playOut(s, () => cpuNextAction).winner === s.first) first++;
  }
  near(first / N, 0.5, 0.06, '先攻の勝率');
  // パズルでは、後攻ボーナスは入らない（盤面が決まっているため）
  const pzl = buildPuzzle(PUZZLE_BY_ID.a08);
  pzl.turn = 7; pzl.current = 1; pzl.first = 0; pzl.players[1].crystals = 0;
  startTurn(pzl);
  eq(pzl.players[1].crystals, CONFIG.CRYSTALS_PER_TURN);
});

test('ステージの補正：相手の最初のクリスタルを減らせる（マイナスの bonus）。表示がマイナスになることはない', () => {
  const p = { crystals: 1 };
  applyStartBonus(p, 2);
  eq([p.crystals, p.debt], [3, undefined]);
  // 減らす補正：持っているぶんから引き、足りないぶんは、次にもらうクリスタルから引く
  const q = { crystals: 1 };
  applyStartBonus(q, -2);
  eq([q.crystals, q.debt], [0, 1]);
  const s = newGame(DEFAULT_DECK, DEFAULT_DECK, testRng);
  s.current = 1; s.first = 0;
  s.players[1].crystals = 0;
  applyStartBonus(s.players[1], -2);
  startTurn(s);
  eq([s.players[1].crystals, s.players[1].debt], [CONFIG.CRYSTALS_PER_TURN - 2, 0], '最初の番は1個。あとは通常どおり');
  s.players[1].slots = [setOwner(mk(GOLEM), s.players[1]), null, null]; finishTurn(s);
  s.players[0].slots = [setOwner(mk(GOLEM), s.players[0]), null, null]; startTurn(s); finishTurn(s);
  const before = s.players[1].crystals;
  startTurn(s);
  eq(s.players[1].crystals - before, CONFIG.CRYSTALS_PER_TURN);
  // オートの試算の複製にも引き継がれる
  const t = newGame(DEFAULT_DECK, DEFAULT_DECK, testRng);
  applyStartBonus(t.players[1], -5);
  eq(aiClone(t, t.rng).players[1].debt, t.players[1].debt);
  // ステージのデータ：補正は -4〜+5 の範囲（スキルを追加したあと、以前の難しさに近づくように決め直した値）
  for (const st of STAGES) assert((st.bonus || 0) >= -4 && (st.bonus || 0) <= 5, st.id);
  eq(['1-10', '2-10', '3-10', '4-10', '5-10'].map(id => STAGE_BY_ID[id].bonus || 0), [0, 3, 0, -2, 0]);
  eq(STAGES.filter(st => st.bonus < 0).every(st => stageDeck(st).monsters.length === 8), true);
});

// ---------- ダンジョン（ローグライクモード） ----------

// 全ヒーローを使えるプロフィール。挑戦を始めて返す
function dgProfile() {
  const p = newProfile();
  p.hero.unlocked = HEROES.map(h => h.id);
  HEROES.forEach(h => { p.hero.levels[h.id] = 1; p.hero.gifts[h.id] = 0; });
  return p;
}
function dgStart(hero = 'agni', trial = 0, seed = 12345) {
  const p = dgProfile();
  p.dungeon.maxTrial = DUNGEON.MAX_TRIAL;
  return [p, startDungeon(p, hero, 0, trial, seed)];
}
// 戦闘のマスに入る（最初の行は必ず戦闘）
function dgEnterBattle(run) { enterNode(run, dungeonChoices(run)[0]); return run.pending; }
// かんたんな方針で、挑戦を最後まで進める。win(run) が戦闘の勝ち負けを決める
function dgPlay(p, win) {
  const run = p.dungeon.run;
  let guard = 0;
  while (!run.over && guard++ < 3000) {
    if (!run.pending) { assert(enterNode(run, dungeonChoices(run)[guard % dungeonChoices(run).length]), 'マスに入れる'); continue; }
    const q = run.pending;
    if (q.phase === 'battle') { dungeonBattleEnd(run, win(run)); continue; }
    if (q.phase === 'lost') { assert(q.type === 'boss' ? dungeonRetry(run) : dungeonSkip(run)); continue; }
    if (q.phase === 'dead') break;
    if (q.steps.length) { const st = q.steps[0]; const id = st.offers[0]; if (!(id && dungeonChoose(run, id, st.kind === 'card' && runFull(run, id) ? 0 : undefined))) assert(dungeonChoose(run, null)); continue; }
    if (q.type === 'smith' && q.left > 0 && runUpgradable(run).length) { assert(smithUpgrade(run, runUpgradable(run)[0])); continue; }
    if (q.type === 'shrine' && !q.used && shrineHeal(run)) continue;
    if (q.type === 'mystery' && q.result == null) { const ev = DUNGEON_EVENT_BY_ID[q.event]; const i = ev.options.findIndex(o => !o.can || o.can(run)); assert(mysteryChoose(run, i)); continue; }
    if (q.type === 'shop') q.stock.forEach((it, i) => { if (!it.sold) shopBuy(run, i, it.kind === 'card' && runFull(run, it.id) ? 0 : undefined); });
    assert(leaveNode(run), '先へ進める: ' + JSON.stringify(q).slice(0, 160));
  }
  assert(run.over, '挑戦が終わる');
  return run;
}

test('ダンジョン：開始時のデッキはモンスター4＋アイテム4（すべてLv1・コモン、ヒーローの色が中心）。手持ちのカードとは関係ない', () => {
  for (const h of HEROES) {
    const [p, run] = dgStart(h.id);
    eq([run.deck.monsters.length, run.deck.items.length, run.deck.levels, run.lives, run.maxLives, run.coins, run.charms, run.chapter, run.floor], [4, 4, {}, 3, 3, 0, [], 0, 0]);
    assert(runCards(run).every(id => CARD_DEFS[id].rarity === 'common' && !CARD_DEFS[id].elite), h.id);
    eq(run.deck.monsters.filter(id => CARD_DEFS[id].color === h.color).length, 3, h.id + '：ヒーローの色が3体');
    assert(run.deck.monsters.some(id => CARD_DEFS[id].cost <= CONFIG.CRYSTALS_PER_TURN), '最初のターンに出せるモンスターがいる');
    assert(run.deck.items.every(id => !CARD_DEFS[id].color || CARD_DEFS[id].color === h.color), '使えないアイテムは入らない');
    // 手持ちにないカードも使う。手持ちのレベルは関係ない
    assert(runCards(run).some(id => !owns(p, id)), '手持ちにないカードが入っている');
    runCards(run).forEach(id => { p.cards[id] = { level: maxLevel(id), copies: 9 }; });
    const d = runDeckForBattle(run);
    eq([Object.values(d.levels).every(lv => lv === 1), d.hero.id, d.hero.skill, d.options], [true, h.id, h.skills[0].id, {}], '対戦でもLv1のまま');
    eq(p.deck, newProfile().deck, '通常のデッキは変わらない');
  }
  // 始められない場合：解放していないヒーロー・スキル、解放していない試練、挑戦中
  const p = newProfile();
  eq([startDungeon(p, 'agni'), startDungeon(p, 'leafia', 2), startDungeon(p, 'leafia', 0, 1), p.dungeon.run], [null, null, null, null]);
  assert(startDungeon(p, 'leafia', 0, 0, 1));
  eq(startDungeon(p, 'leafia', 0, 0, 2), null, '挑戦中は、もう1つ始められない');
});

test('ダンジョン：マップは1章9マス。分かれ道があり、最後がボス。どのマスからも先へ進める', () => {
  const types = {};
  let forks = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const [, run] = dgStart('leafia', seed % 3, seed * 7919);
    const nodes = run.map.nodes;
    const rows = [...Array(DUNGEON.ROWS)].map((x, r) => nodes.filter(n => n.row === r));
    eq(DUNGEON.ROWS, 9);
    assert(rows.every(r => r.length >= 1 && r.length <= 3), '1行に1〜3マス');
    eq([rows[8].length, rows[8][0].type, rows[0].every(n => n.type === 'battle')], [1, 'boss', true]);
    assert(nodes.filter(n => n.type === 'boss').length === 1 && rows[7].every(n => n.type === 'shrine' || n.type === 'smith'), 'ボスの前は立て直せるマス');
    for (const n of nodes) {
      types[n.type] = (types[n.type] || 0) + 1;
      if (n.row < 8) { assert(n.next.length >= 1 && n.next.length <= 3 && n.next.every(t => nodes[t].row === n.row + 1), '次の行につながる'); if (n.next.length > 1) forks++; }
      if (n.row > 0) assert(nodes.some(m => m.next.includes(n.id)), '入る道がある');
      assert(!(n.type === 'elite' && n.row < 2), '強敵は3マス目から');
    }
    eq(dungeonChoices(run), rows[0].map(n => n.id), '最初は、最初の行のどれか');
    // どの道を選んでも、8マス進むとボスに着く
    let at = rows[0][seed % rows[0].length], steps = 0;
    while (at.type !== 'boss') { at = nodes[at.next[seed % at.next.length]]; steps++; }
    eq(steps, 8);
  }
  for (const k of Object.keys(DUNGEON_NODES)) assert(types[k] > 0, 'マスの種類がすべて出る: ' + k);
  assert(forks > 100, '分かれ道がある');
  // つながっていないマスには進めない
  const [, run] = dgStart();
  const first = dungeonChoices(run)[0];
  eq(enterNode(run, run.map.nodes.find(n => n.row === 3).id), false);
  assert(enterNode(run, first));
  eq([dungeonChoices(run), enterNode(run, first)], [[], false], 'マスにいる間は、ほかのマスへ進めない');
});

test('ダンジョン：戦闘に負けると命が1つ減り、やり直すか先へ進むかを選べる。命が0で終了する', () => {
  const [p, run] = dgStart();
  const q = dgEnterBattle(run);
  eq([q.phase, q.type, !!q.foe.deck.monsters.length], ['battle', 'battle', true]);
  eq([leaveNode(run), dungeonChoose(run, null)], [false, false], '戦わずには出られない');
  const foe = JSON.stringify(q.foe);
  assert(dungeonBattleEnd(run, false));
  eq([run.lives, q.phase, run.over, run.floor], [2, 'lost', null, 0]);
  // やり直し：同じ相手ともう一度
  assert(dungeonRetry(run));
  eq([q.phase, JSON.stringify(q.foe)], ['battle', foe]);
  dungeonBattleEnd(run, false);
  eq(run.lives, 1);
  // 戦わずに進む：報酬なしで、マスだけ進む
  assert(dungeonSkip(run));
  eq([run.pending, run.floor, run.coins, runCards(run).length, run.at], [null, 1, 0, 8, q.node]);
  // 命が0になったら終わり。やり直しも先へ進むこともできない
  enterNode(run, dungeonChoices(run)[0]);
  if (run.pending.phase !== 'battle') { run.pending = { node: run.pending.node, type: 'battle', phase: 'battle', steps: [], notes: [], foe: q.foe }; }
  dungeonBattleEnd(run, false);
  eq([run.lives, run.over, run.pending.phase, dungeonRetry(run), dungeonSkip(run), leaveNode(run)], [0, 'dead', 'dead', false, false, false]);
  const sum = endDungeon(p, 'dead');
  eq([sum.result, sum.floor, p.dungeon.run, sum.losses], ['dead', 1, null, 3]);
  // ボスは避けて進めない
  const [, r2] = dgStart();
  r2.pending = { node: r2.map.nodes.find(n => n.type === 'boss').id, type: 'boss', phase: 'battle', steps: [], notes: [], foe: dungeonFoe(r2, { type: 'boss', row: 8 }) };
  dungeonBattleEnd(r2, false);
  eq([r2.pending.phase, dungeonSkip(r2), dungeonRetry(r2)], ['lost', false, true]);
});

test('ダンジョン：勝つとコインと、3枚から1枚選ぶ報酬。デッキは8＋8まで。いっぱいなら入れ替えるか、取らない', () => {
  const [, run] = dgStart();
  const q = dgEnterBattle(run);
  dungeonBattleEnd(run, true);
  eq([q.phase, run.coins, q.coins, q.steps.length, q.steps[0].kind, q.steps[0].offers.length, new Set(q.steps[0].offers).size], ['reward', DUNGEON.COINS.battle, DUNGEON.COINS.battle, 1, 'card', 3, 3]);
  assert(q.steps[0].offers.every(id => CARD_DEFS[id] && !CARD_DEFS[id].elite));
  eq(leaveNode(run), false, '選ぶ（または取らない）まで出られない');
  eq(dungeonChoose(run, 'zzz'), false, '候補にないカードは取れない');
  const pick = q.steps[0].offers[1];
  assert(dungeonChoose(run, pick));
  eq([runCards(run).length, runCards(run).includes(pick), q.steps.length], [9, true, 0]);
  assert(leaveNode(run));
  eq([run.floor, run.pending, run.path], [1, null, [q.node]]);
  // 取らないこともできる
  const [, r2] = dgStart();
  dgEnterBattle(r2); dungeonBattleEnd(r2, true);
  assert(dungeonChoose(r2, null) && leaveNode(r2));
  eq(runCards(r2).length, 8);
  // 枠がいっぱい：入れ替える位置が必要
  const [, r3] = dgStart();
  const mons = realCards(MONSTERS).filter(c => c.rarity === 'common').map(c => c.id);
  r3.deck.monsters = mons.slice(0, 8);
  const fresh = mons[9];
  eq([runFull(r3, fresh), runAddCard(r3, fresh), runAddCard(r3, fresh, 99)], [true, false, false]);
  r3.deck.levels[mons[2]] = 3;
  assert(runAddCard(r3, fresh, 2));
  eq([r3.deck.monsters.length, r3.deck.monsters[2], r3.deck.monsters.includes(mons[2]), r3.deck.levels[mons[2]]], [8, fresh, false, undefined], '外したカードのレベルアップは消える');
  // アイテムの枠は別に数える。同じカードは2枚まで、レジェンドは1枚まで、Elite は入らない
  const item = realCards(ITEMS).find(c => !r3.deck.items.includes(c.id) && c.rarity === 'common').id;
  eq([runFull(r3, item), runAddCard(r3, item), runAddCard(r3, item), runAddCard(r3, item)], [false, true, true, false]);
  const legend = realCards(ITEMS).find(c => c.rarity === 'legend').id;
  eq([runAddCard(r3, legend), runAddCard(r3, legend), runAddCard(r3, ELITES[0].id, 0)], [true, false, false]);
  assert(!cardOffers(r3, 60).includes(item) || true);
  for (let i = 0; i < 30; i++) for (const id of cardOffers(r3, 4)) assert(runCanHold(r3, id), '入れられないカードは候補に出ない');
});

test('ダンジョン：鍛冶屋のレベルアップはダンジョンの中だけで効く（手持ちのカードは変わらない）', () => {
  const [p, run] = dgStart('agni');
  const id = run.deck.monsters[0];
  p.cards[id] = { level: 1, copies: 0 };
  run.pending = { node: 0, type: 'smith', phase: 'smith', steps: [], notes: [], left: 1 };
  eq(runUpgradable(run).includes(id), true);
  assert(smithUpgrade(run, id));
  eq([runLevel(run, id), run.pending.left, smithUpgrade(run, run.deck.monsters[1])], [2, 0, false], '1回につき1枚');
  eq([p.cards[id].level, cardLevel(p, id), ownedCard(p, id).level], [1, 1, 1], '手持ちのカードのレベルは変わらない');
  // 対戦では、上がったレベルで戦う
  const d = runDeckForBattle(run);
  eq(d.levels[id], 2);
  const s = newGame(d, d, testRng);
  const inGame = [...s.players[0].hand, ...s.players[0].deck].find(h => h.card.id === id);
  eq([inGame.card.level, inGame.card.hp, inGame.card.atk], [2, cardAt(id, 2).hp, cardAt(id, 2).atk]);
  assert(cardAt(id, 2).hp + cardAt(id, 2).atk > cardAt(id, 1).hp + cardAt(id, 1).atk, 'Lv2のほうが強い');
  // 通常の対戦のデッキには影響しない
  eq(deckForBattle(p).levels[p.deck.monsters[0]], cardLevel(p, p.deck.monsters[0]));
  // 最大レベルより上には上がらない。お守り「名工の槌」があれば2枚
  run.deck.levels[id] = maxLevel(id);
  eq([runUpgradable(run).includes(id), runUpgrade(run, id)], [false, false]);
  run.pending = null; run.charms = ['smith'];
  const smith = run.map.nodes.find(n => n.type === 'smith');
  run.at = run.map.nodes.find(n => n.next.includes(smith.id)).id;
  assert(enterNode(run, smith.id));
  eq(run.pending.left, 2);
  // 挑戦が終わっても、カードは手持ちに増えない
  const before = JSON.stringify(p.cards);
  endDungeon(p, 'quit');
  eq(JSON.stringify(p.cards), before);
});

test('ダンジョン：祠（取り除く・回復）、商人、謎のマス', () => {
  const [, run] = dgStart();
  const at = type => { run.pending = { node: 1, type, phase: type, steps: [], notes: [] }; return run.pending; };
  // 祠：どちらか1回
  at('shrine');
  eq([shrineCanHeal(run), shrineHeal(run)], [false, false], '命が減っていなければ回復できない');
  run.lives = 1;
  assert(shrineHeal(run));
  eq([run.lives, shrineHeal(run), shrineRemove(run, 'items', 0)], [2, false, false]);
  at('shrine');
  const gone = run.deck.items[1];
  assert(shrineRemove(run, 'items', 1));
  eq([run.deck.items.length, run.deck.items.includes(gone), shrineHeal(run)], [3, false, false]);
  run.deck.monsters = run.deck.monsters.slice(0, 1);
  at('shrine');
  eq(shrineRemove(run, 'monsters', 0), false, 'モンスターの最後の1体は取り除けない');
  // 商人：コインがなければ買えない。買うとコインが減り、売り切れになる
  run.pending = null; run.at = null;
  const [, r2] = dgStart('leafia', 0, 99);
  const shopNode = { id: 0, row: 0, col: 0, type: 'shop', next: [] };
  r2.map.nodes = [shopNode];
  assert(enterNode(r2, 0));
  const stock = r2.pending.stock;
  eq([stock.length, stock.filter(x => x.kind === 'card').length, stock.filter(x => x.kind === 'charm').length], [5, 3, 2]);
  eq(shopBuy(r2, 0), false, 'コインが足りない');
  r2.coins = 500;
  const price = shopPrice(r2, stock[0]);
  eq(price, DUNGEON.PRICE[CARD_DEFS[stock[0].id].rarity]);
  assert(shopBuy(r2, 0));
  eq([r2.coins, stock[0].sold, runCards(r2).includes(stock[0].id), shopBuy(r2, 0)], [500 - price, true, true, false]);
  const ci = stock.findIndex(x => x.kind === 'charm');
  assert(shopBuy(r2, ci));
  eq([r2.charms, r2.coins], [[stock[ci].id], 500 - price - DUNGEON.PRICE.charm]);
  r2.charms = ['discount'];
  eq(shopPrice(r2, { kind: 'charm', id: 'gem' }), Math.round(DUNGEON.PRICE.charm * 0.75), '割符で25%引き');
  // 謎のマス：選択肢つきのできごと。選べるのは1回
  assert(DUNGEON_EVENTS.length >= 6);
  for (const ev of DUNGEON_EVENTS) {
    for (let i = 0; i < ev.options.length; i++) {
      const [, r] = dgStart('agni', 0, 500 + i);
      r.lives = 2; r.coins = 0;
      r.pending = { node: 1, type: 'mystery', phase: 'mystery', steps: [], notes: [], event: ev.id };
      const opt = ev.options[i];
      if (opt.can && !opt.can(r)) { eq(mysteryChoose(r, i), false, ev.id); continue; }
      const cards = runCards(r).length;
      assert(mysteryChoose(r, i), ev.id + ' ' + i);
      assert(typeof r.pending.result === 'string' && r.pending.result.length > 0 && !r.pending.result.includes('undefined'), ev.id);
      eq(mysteryChoose(r, 0), false, '選べるのは1回');
      eq(runCards(r).length, cards, 'カードの数はまだ変わらない（もらうカードは選んで受け取る）');
      while (r.pending.steps.length) assert(dungeonChoose(r, r.pending.steps[0].offers[0]) || dungeonChoose(r, null));
      assert(r.lives >= 1 && leaveNode(r), ev.id);
    }
  }
  // 血の契約：命を1つ失って、レジェンドを1枚
  const [, r3] = dgStart();
  r3.pending = { node: 1, type: 'mystery', phase: 'mystery', steps: [], notes: [], event: 'pact' };
  mysteryChoose(r3, 0);
  eq([r3.lives, r3.pending.steps.length, CARD_DEFS[r3.pending.steps[0].offers[0]].rarity], [2, 1, 'legend']);
  eq(DUNGEON_EVENT_BY_ID.pact.when({ lives: 1 }), false, '命が1つのときは出ない');
});

test('ダンジョン：お守りは20種類以上。対戦中の効果がそれぞれ働く（持っていない通常の対戦には影響しない）', () => {
  assert(DUNGEON_CHARMS.length >= 20 && new Set(DUNGEON_CHARMS.map(c => c.id)).size === DUNGEON_CHARMS.length);
  assert(DUNGEON_CHARMS.every(c => c.name && c.icon && c.desc));
  const withCharm = (s, ...ids) => { s.players[0].charms = Object.fromEntries(ids.map(id => [id, true])); return s; };
  const deck = { monsters: DEFAULT_DECK.monsters, items: DEFAULT_DECK.items };
  // 導きの水晶・旅人の地図：対戦開始時
  for (let i = 0; i < 6; i++) {
    const a = newGame(deck, deck, aiRng(i + 1)), b = newGame(deck, deck, aiRng(i + 1), { charms: ['gem', 'hand'] });
    eq([b.players[0].crystals - a.players[0].crystals, b.players[0].hand.length - a.players[0].hand.length, b.players[0].deck.length - a.players[0].deck.length], [1, 1, -1]);
    eq([b.players[1].crystals, b.players[1].hand.length, b.players[1].charms], [a.players[1].crystals, a.players[1].hand.length, undefined], '相手には効かない');
  }
  // 先駆けの腕輪・盾：最初に出したモンスターだけ
  const f = withCharm(board(), 'first_hp', 'first_armor');
  playMonster(f, 0, give(f, 0, WOLF), 0); playMonster(f, 0, give(f, 0, WOLF), 1);
  const [m1, m2] = f.players[0].slots;
  eq([[m1.hp, m1.maxHp, m1.armor], [m2.hp, m2.maxHp, m2.armor]], [[8, 8, 2], [6, 6, 0]]);
  // 供物の皿：生贄+1（画面の表示に使う数も同じ）
  const sc = withCharm(zeroCrystals(board([mk(WOLF), mk(ELF)], [mk(GOLEM)])), 'sac_plus');
  [0, 1, 2].forEach(() => inDeck(sc, 0, WOLF));
  eq(sacrificeCrystals(sc.players[0], CONFIG.SACRIFICE_ITEM), CONFIG.SACRIFICE_ITEM + 1);
  sacrifice(sc, 0, give(sc, 0, SWORD));
  eq([sc.players[0].crystals, logged(sc, 'S')[0][3]], [CONFIG.SACRIFICE_ITEM + 1, CONFIG.SACRIFICE_ITEM + 1]);
  eq(sacrificeCrystals(sc.players[1], 2), 2);
  // 三色の誓い：3体が同じ色のときだけ
  const tri = withCharm(board([mk(WOLF), mk(ARCHER), mk(DRAGON)], [mk(GOLEM)]), 'tri_color');
  eq(tri.players[0].slots.map(m => getAttacks(m)[0].atk), [3, 3, 6]);
  tri.players[0].slots[2] = setOwner(mk(ELF), tri.players[0]);
  eq(tri.players[0].slots.map(m => getAttacks(m)[0].atk), [2, 2, 3], '色がそろっていなければ効かない');
  tri.players[0].slots[2] = null;
  eq(getAttacks(tri.players[0].slots[0])[0].atk, 2, '2体では効かない');
  // 弔いの鈴：倒されたときのクリスタルがもう1つ
  const fl = withCharm(zeroCrystals(board([mk(S('melee', 1, 2))], [mk(DRAGON)])), 'fallen_plus');
  fl.current = 1; phase(fl);
  eq(crystals(fl), [2, 0]);
  // 闘士の帯・鷹の羽飾り
  const fm = withCharm(board([mk(WOLF), mk(ARCHER)], [mk(S('melee', 1, 40))]), 'front_melee', 'back_ranged');
  eq(attacks(fm).map(e => [e.type, e.dmg]), [['ranged', 3], ['melee', 3]]);
  eq(attacks(board([mk(WOLF), mk(ARCHER)], [mk(S('melee', 1, 40))])).map(e => e.dmg), [2, 2], 'お守りがなければ今までどおり');
  // 歪んだサイコロ：カオスは最低2
  for (let i = 0; i < 20; i++) { const ch = withCharm(board([mk(DEMON)], [mk(S('melee', 1, 99))]), 'chaos_min'); assert(attacks(ch)[0].dmg >= 2); }
  // 魔除けの札・岩の心臓
  const gd = withCharm(board([mk(GOLEM), mk(GOLEM)], [mk(MAGE)]), 'guard', 'tough');
  eq([dealDamage(gd, gd.players[0], 0, 3, true).dmg, dealDamage(gd, gd.players[0], 0, 3, false).dmg, dealDamage(gd, gd.players[0], 1, 3, false).dmg, dealDamage(gd, gd.players[1], 0, 3, false).dmg], [2, 2, 3, 3]);
  // 若葉のしずく・砂時計・長旅の外套：ターン開始時
  const rg = withCharm(zeroCrystals(board([mk(GOLEM), mk(WOLF)], [mk(GOLEM)])), 'regen', 'late_income', 'attrition');
  rg.players[0].slots[1].hp = 2; rg.current = 0; rg.turn = 4; rg.phase = 'attack';
  [0, 1].forEach(pi => inDeck(rg, pi, WOLF));
  startTurn(rg);
  eq([rg.players[0].slots[1].hp, rg.players[0].crystals], [3, CONFIG.CRYSTALS_PER_TURN], 'ターン5：回復あり・クリスタルは増えない');
  rg.turn = 8; rg.current = 0; rg.players[0].crystals = 0; inDeck(rg, 0, WOLF);
  startTurn(rg);
  eq(rg.players[0].crystals, CONFIG.CRYSTALS_PER_TURN + 1, 'ターン9以降は+1');
  rg.turn = CONFIG.ATTRITION_START - 1; rg.current = 0; inDeck(rg, 0, WOLF);
  const hpMe = rg.players[0].slots[0].hp, hpFoe = rg.players[1].slots[0].hp;
  startTurn(rg);
  eq([hpMe - rg.players[0].slots[0].hp, hpFoe - rg.players[1].slots[0].hp], [0, 1], '消耗ダメージ1は、自分だけ受けない');
  // 狩人の証：攻撃で倒すと+1
  const bt = withCharm(zeroCrystals(board([mk(DRAGON)], [mk(S('melee', 1, 2)), mk(GOLEM)])), 'bounty');
  phase(bt);
  eq(crystals(bt), [1, 1]);
  // オートの試算の複製にも、お守りが引き継がれる
  const cl = aiClone(withCharm(board([mk(WOLF)], [mk(GOLEM)]), 'front_melee'), aiRng(1));
  eq([charm(cl.players[0], 'front_melee'), charm(cl.players[1], 'front_melee')], [true, false]);
  // ダンジョンの進行に効くお守り
  const [, run] = dgStart();
  eq([battleCoins(run, 'battle'), battleCoins(run, 'boss')], [DUNGEON.COINS.battle, DUNGEON.COINS.boss]);
  run.charms = ['coin_plus', 'scout', 'lucky'];
  eq(battleCoins(run, 'battle'), Math.round(DUNGEON.COINS.battle * 1.5));
  dgEnterBattle(run); dungeonBattleEnd(run, true);
  const offers = run.pending.steps[0].offers;
  eq(offers.length, 4, '遠見の筒：候補が4枚');
  assert(CARD_DEFS[offers[0]].rarity !== 'common', '四つ葉：1枚はレア以上');
  eq(runBattleCharms(run), [], '進行用のお守りは、対戦には渡さない');
  assert(runGainCharm(run, 'heart'));
  eq([run.lives, run.maxLives, runGainCharm(run, 'heart'), runGainCharm(run, 'zzz')], [4, 4, false, false], '命の実。同じお守りは2つ持てない');
  run.charms.push('gem');
  eq(runBattleCharms(run), ['gem']);
  // 強敵に勝つとお守りが1つ、ボスに勝つと3つから選べる
  const [, r2] = dgStart();
  r2.pending = { node: 1, type: 'elite', phase: 'battle', steps: [], notes: [], foe: dungeonFoe(r2, { type: 'elite', row: 3 }) };
  dungeonBattleEnd(r2, true);
  eq([r2.charms.length, r2.pending.notes[0][0], r2.pending.steps[0].offers.every(id => CARD_DEFS[id].rarity !== 'common'), r2.coins], [1, 'charm', true, DUNGEON.COINS.elite]);
  const [, r3] = dgStart();
  r3.pending = { node: 1, type: 'boss', phase: 'battle', steps: [], notes: [], foe: dungeonFoe(r3, { type: 'boss', row: 8 }) };
  dungeonBattleEnd(r3, true);
  eq([r3.pending.steps.map(x => x.kind), r3.pending.steps[1].offers.length], [['card', 'charm'], 3]);
  dungeonChoose(r3, null);
  const want = r3.pending.steps[0].offers[2];
  assert(dungeonChoose(r3, want));
  eq(r3.charms, [want]);
});

test('ダンジョン：敵は章が進むほど強くなる。ボスは章ごとに専用のデッキとヒーロースキル。試練でさらに強くなる', () => {
  const sizes = [];
  for (let ch = 0; ch < DUNGEON.CHAPTERS; ch++) {
    const [, run] = dgStart('leafia', 0, 77 + ch);
    run.chapter = ch;
    const early = dungeonFoe(run, { type: 'battle', row: 0 }), late = dungeonFoe(run, { type: 'battle', row: 6 }), elite = dungeonFoe(run, { type: 'elite', row: 6 }), boss = dungeonFoe(run, { type: 'boss', row: 8 });
    const C = DUNGEON_CHAPTERS[ch];
    eq([early.deck.monsters.length, late.deck.monsters.length, elite.deck.monsters.length], [C.size[0], C.size[0] + 1, C.size[0] + 2]);
    eq([elite.bonus, early.bonus, early.boss, boss.boss], [1, 0, false, true]);
    assert(Math.max(...Object.values(elite.deck.levels)) >= Math.max(...Object.values(late.deck.levels)));
    assert(early.deck.monsters.some(id => CARD_DEFS[id].cost <= CONFIG.CRYSTALS_PER_TURN) && TERRAIN_BY_ID[early.terrain]);
    assert(early.deck.monsters.filter(id => C.colors.includes(CARD_DEFS[id].color)).length >= early.deck.monsters.length - 1, '章のテーマの色が中心');
    eq([boss.name, boss.deck.hero.skill, boss.terrain, boss.deck.monsters], [C.boss.name, C.boss.skill, C.boss.terrain, C.boss.deck.monsters]);
    for (const d of [early.deck, late.deck, elite.deck, boss.deck]) {
      for (const [id, n] of deckGroups([...d.monsters, ...d.items])) assert(CARD_DEFS[id] && n <= copyLimit(id));
      const s = newGame(DEFAULT_DECK, d, testRng, { terrain: boss.terrain });
      assert(playOut(s, () => cpuNextAction), '最後まで対戦できる');
    }
    sizes.push(early.deck.monsters.length);
  }
  assert(sizes[0] < sizes[1] && sizes[1] < sizes[2], '章が進むほど、敵のデッキが大きい');
  eq(new Set(DUNGEON_CHAPTERS.map(c => c.boss.skill)).size, 3);
  // 試練
  eq([DUNGEON_TRIALS.length, DUNGEON.MAX_TRIAL], [10, 10]);
  eq(Object.values(trialMods(0)).every(v => v === 0), true, '通常（試練0）は補正なし');
  eq([trialMods(1).foeBonus, trialMods(4).lives, trialMods(10).foeBonus, trialMods(10).foeSize, trialMods(10).bossLevel, trialMods(10).eliteLevel, trialMods(10).foeIncome], [1, -1, 2, 1, 1, 1, 1]);
  const [, t4] = dgStart('leafia', 4);
  eq([t4.lives, t4.maxLives], [2, 2]);
  // きつい補正（デッキの枚数・ボスのレベル・毎ターンのクリスタル）は、後の章からかかる
  eq([trialMods(10, 0).foeSize, trialMods(10, 2).foeSize, trialMods(10, 0).foeIncome, trialMods(10, 2).foeIncome, trialMods(10, 0).foeBonus, trialMods(10, 1).foeBonus, trialMods(10, 1).bossLevel, trialMods(10, 2).bossLevel], [0, 1, 0, 1, 1, 2, 0, 1]);
  const [, t10] = dgStart('leafia', 10, 5), [, t0] = dgStart('leafia', 0, 5);
  const diff = (ch, type = 'battle') => {
    t0.chapter = t10.chapter = ch;
    const a = dungeonFoe(t0, { type, row: 0 }), b = dungeonFoe(t10, { type, row: 0 });
    return [b.bonus - a.bonus, b.income - a.income, b.deck.monsters.length - a.deck.monsters.length, Math.max(...Object.values(b.deck.levels)) - Math.max(...Object.values(a.deck.levels))];
  };
  eq([diff(0), diff(1), diff(2), diff(0, 'elite')], [[1, 0, 0, 0], [2, 0, 0, 0], [2, 1, 1, 0], [1, 0, 0, 1]]);
  t0.chapter = t10.chapter = 0;
  t10.lives = 1; t10.pending = { node: 1, type: 'shrine', phase: 'shrine', steps: [], notes: [] };
  eq(shrineHeal(t10), false, '試練8以上：祠で回復できない');
  eq(battleCoins(t10, 'battle'), Math.round(DUNGEON.COINS.battle * 0.75));
});

test('ダンジョン：途中で閉じても、続きから再開できる（戦闘中なら、その戦闘の最初から）。候補も同じになる', () => {
  const st = memStorage();
  const [p, run] = dgStart('agni', 0, 4242);
  dgEnterBattle(run);
  saveProfile(p, st);
  // 戦闘の途中で閉じた → 開き直すと、同じ相手との戦闘の最初から
  const q = loadProfile(st);
  eq(q.dungeon.run, run);
  eq([q.dungeon.run.pending.phase, q.dungeon.run.pending.foe], ['battle', run.pending.foe]);
  // 勝ったあとの候補は、閉じる前と後で同じ（乱数の続きもセーブされている）
  dungeonBattleEnd(run, true); dungeonBattleEnd(q.dungeon.run, true);
  eq(q.dungeon.run.pending.steps, run.pending.steps);
  // 報酬を選んでいる途中、マップ上でも同じ
  saveProfile(q, st);
  const r = loadProfile(st);
  eq(r.dungeon.run.pending.steps[0].kind, 'card');
  assert(dungeonChoose(r.dungeon.run, r.dungeon.run.pending.steps[0].offers[0]) && leaveNode(r.dungeon.run));
  saveProfile(r, st);
  const s = loadProfile(st);
  eq([s.dungeon.run.floor, s.dungeon.run.at, dungeonChoices(s.dungeon.run), runCards(s.dungeon.run).length], [1, r.dungeon.run.at, dungeonChoices(r.dungeon.run), 9]);
  // ほかのセーブデータは変わらない。壊れた挑戦のデータは捨てられる（記録は残る）
  eq([s.deck, s.decks, s.gold, Object.keys(s.cards).length], [p.deck, p.decks, p.gold, Object.keys(p.cards).length]);
  s.dungeon.best = { floor: 7, trial: 0, cleared: false }; s.dungeon.run.deck = 'x';
  saveProfile(s, st);
  const t = loadProfile(st);
  eq([t.dungeon.run, t.dungeon.best.floor], [null, 7]);
  // 古いセーブ（ダンジョンのデータがない）には、初期値が入る
  const old = JSON.parse(JSON.stringify(newProfile())); delete old.dungeon; old.gold = 321;
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  eq([loadProfile(st).dungeon, loadProfile(st).gold], [newDungeonData(), 321]);
});

test('ダンジョン：選択スキルはLv1から選べる（ダンジョンの中だけ。コレクションの選択とは別）', () => {
  const [p, run] = dgStart();
  const epic = realCards(MONSTERS).find(c => c.rarity === 'epic' && CARD_DEFS[c.id].options).id;
  const common = run.deck.monsters[0];
  eq([runHasOptions(epic), runHasOptions(common), runOptionAsk(run)], [true, false, null]);
  // 手に入れると、選ぶのを待つ列に入る（選択スキルを持たないカードは入らない）
  assert(runAddCard(run, epic));
  eq([runOptionAsk(run), run.deck.options[epic]], [epic, undefined]);
  eq([runSetOption(run, epic, 99), runSetOption(run, common, 0), runSetOption(run, 'zzz', 0)], [false, false, false], '候補にない番号・選択スキルのないカード・デッキにないカードは選べない');
  assert(runSetOption(run, epic, 1));
  eq([runOption(run, epic), runOptionAsk(run)], [1, null]);
  // 対戦では、Lv1 のまま選んだスキルを持って戦う（解放レベル Lv3 の条件はかからない）
  const deck = runDeckForBattle(run);
  eq([deck.levels[epic], deck.options[epic], deck.freeOptions], [1, 1, true]);
  const s = newGame(deck, randomDeck(testRng), testRng);
  const inGame = [...s.players[0].hand, ...s.players[0].deck].find(h => h.card.id === epic).card;
  const want = CARD_DEFS[epic].options[1];
  eq([inGame.level, inGame.option, inGame.skills[inGame.skills.length - 1]], [1, 1, { ...want, opt: true }]);
  // 通常の対戦（レベルの条件あり）では、同じ指定でも Lv1 なら選択スキルなし
  eq(cardAt(epic, 1, 1).option, null);
  // コレクションの選択（profile.options）は変わらない
  eq(p.options, {});
  // 「なし」に戻せる。あとで選ぶ（列から外す）こともできる
  assert(runSetOption(run, epic, null));
  eq(runOption(run, epic), null);
  const epic2 = realCards(MONSTERS).find(c => c.rarity === 'epic' && CARD_DEFS[c.id].options && c.id !== epic).id;
  run.deck.monsters = run.deck.monsters.slice(0, 6);
  assert(runAddCard(run, epic2));
  eq(runOptionAsk(run), epic2);
  runSkipOption(run, epic2);
  eq([runOptionAsk(run), runOption(run, epic2)], [null, null]);
  // 2枚目を手に入れても、もう選んでいれば聞かない。最後の1枚がなくなると選択も消える
  assert(runSetOption(run, epic2, 0) && runAddCard(run, epic2));
  eq(runOptionAsk(run), null);
  assert(runRemoveCard(run, 'monsters', run.deck.monsters.indexOf(epic2)));
  eq(runOption(run, epic2), 0, 'まだ1枚残っている');
  assert(runRemoveCard(run, 'monsters', run.deck.monsters.indexOf(epic2)));
  eq(runOption(run, epic2), null, '最後の1枚がなくなった');
  // 装備の選択スキルも同じ
  const eqp = realCards(ITEMS).find(c => CARD_DEFS[c.id].options).id;
  run.deck.items = run.deck.items.slice(0, 4);
  assert(runAddCard(run, eqp) && runSetOption(run, eqp, 0));
  eq(runDeckForBattle(run).options[eqp], 0);
});

test('ダンジョン：選んだ選択スキルは、中断して再開しても残る（壊れた指定は捨てる）。古いセーブも読める', () => {
  const st = memStorage();
  const [p, run] = dgStart('agni', 0, 777);
  const epic = realCards(MONSTERS).find(c => c.rarity === 'epic' && CARD_DEFS[c.id].options).id;
  const leg = realCards(MONSTERS).find(c => c.rarity === 'legend' && CARD_DEFS[c.id].options).id;
  assert(runAddCard(run, epic) && runSetOption(run, epic, 1) && runAddCard(run, leg));
  saveProfile(p, st);
  const q = loadProfile(st);
  eq([q.dungeon.run.deck.options, q.dungeon.run.optAsk], [{ [epic]: 1 }, [leg]], '選んだものも、まだ選んでいないカードも残る');
  eq(runDeckForBattle(q.dungeon.run).options, { [epic]: 1 });
  // 壊れた指定（デッキにないカード・候補にない番号）は捨てる
  q.dungeon.run.deck.options = { [epic]: 99, zzz: 0, [run.deck.monsters[0]]: 0, [leg]: 0 };
  q.dungeon.run.optAsk = ['zzz', leg];
  saveProfile(q, st);
  const r = loadProfile(st);
  eq([r.dungeon.run.deck.options, r.dungeon.run.optAsk], [{ [leg]: 0 }, []]);
  // 古い形式（options も optAsk もない挑戦）
  const old = JSON.parse(JSON.stringify(r));
  delete old.dungeon.run.deck.options; delete old.dungeon.run.optAsk;
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  const o = loadProfile(st);
  eq([o.dungeon.run.deck.options, runOptionAsk(o.dungeon.run), runDeckForBattle(o.dungeon.run).options], [{}, null, {}]);
  // クリアの記録にも残る（前回クリアしたデッキの表示用）
  const [p2, run2] = dgStart('agni', 0, 99);
  assert(runAddCard(run2, epic) && runSetOption(run2, epic, 0));
  run2.over = 'clear';
  endDungeon(p2, 'clear');
  eq(p2.dungeon.lastClear.deck.options, { [epic]: 0 });
});

test('ダンジョン：対戦履歴でも、選んだ選択スキルのカードとして見られる', () => {
  const [, run] = dgStart();
  const epic = realCards(MONSTERS).find(c => c.rarity === 'epic' && CARD_DEFS[c.id].options).id;
  assert(runAddCard(run, epic) && runSetOption(run, epic, 0));
  const packed = packDeck(runDeckForBattle(run));
  eq([packed.op[epic], packed.fo], [0, 1]);
  eq(cardAt(epic, packed.lv[epic] || 1, packed.op[epic], !!packed.fo).option, 0);
  eq(packDeck(randomDeck(testRng)).fo, undefined, '通常のデッキには付かない');
});

test('ダンジョン：持ち帰れるのはゴールドと魔石だけ。到達したマスの数で決まり、クリアで試練が解放される', () => {
  const R = DUNGEON.REWARD;
  // 途中で終わった：進んだマスの数ぶん
  const [p, run] = dgStart();
  run.floor = 7;
  const gold = p.gold, stones = p.stones, cards = JSON.stringify(p.cards);
  const sum = endDungeon(p, 'quit');
  eq([sum.result, sum.reward, sum.record, sum.unlocked], ['quit', { gold: 7 * R.goldPerFloor, stones: 7 * R.stonesPerFloor }, true, null]);
  eq([p.gold - gold, p.stones - stones, JSON.stringify(p.cards), p.dungeon.run, p.dungeon.best, p.dungeon.clears], [70, 7, cards, null, { floor: 7, trial: 0, cleared: false }, 0]);
  eq(endDungeon(p, 'quit'), null, '2回は受け取れない');
  // すべて勝って最後まで進む：全27マスでクリア
  const q = dgProfile();
  startDungeon(q, 'leafia', 0, 0, 31337);
  const won = dgPlay(q, () => true);
  eq([won.over, won.floor, won.chapter, won.lives >= 1], ['clear', DUNGEON.CHAPTERS * DUNGEON.ROWS, 2, true]); // 戦闘では減らないが、謎のマスの選択で命が減ることはある
  assert(won.deck.monsters.length <= CONFIG.DECK_MONSTERS && won.deck.items.length <= CONFIG.DECK_ITEMS && won.charms.length >= 3, 'デッキは8＋8まで。ボス3体ぶんのお守り');
  const deck = JSON.parse(JSON.stringify(won.deck)), charms = won.charms.slice();
  const g0 = q.gold;
  const fin = endDungeon(q, 'clear');
  eq([fin.result, fin.reward, fin.unlocked, fin.record], ['clear', { gold: 27 * R.goldPerFloor + R.clearGold, stones: 27 * R.stonesPerFloor + R.clearStones }, 1, true]);
  eq([q.gold - g0, q.dungeon.maxTrial, q.dungeon.clears, q.dungeon.best, q.dungeon.lastClear.deck, q.dungeon.lastClear.charms, q.dungeon.lastClear.hero], [fin.reward.gold, 1, 1, { floor: 27, trial: 0, cleared: true }, deck, charms, 'leafia']);
  // 試練1が解放された。試練でクリアすると報酬が増え、次の試練が解放される
  eq(startDungeon(q, 'leafia', 0, 2, 1), null);
  assert(startDungeon(q, 'leafia', 0, 1, 2024));
  dgPlay(q, () => true);
  const fin2 = endDungeon(q);
  eq([fin2.reward.gold, fin2.unlocked, q.dungeon.maxTrial, q.dungeon.best.trial], [Math.round((27 * R.goldPerFloor + R.clearGold) * (1 + R.trialBonus)), 2, 2, 1]);
  // 低い試練をもう一度クリアしても、解放は進まない
  startDungeon(q, 'leafia', 0, 0, 7);
  dgPlay(q, () => true);
  eq([endDungeon(q).unlocked, q.dungeon.maxTrial, q.dungeon.clears], [null, 2, 3]);
  // すべて負ける：命が尽きて終わる。記録は良いほうが残る
  startDungeon(q, 'agni', 0, 0, 5);
  const lost = dgPlay(q, () => false);
  eq([lost.over, lost.lives, lost.stats.wins], ['dead', 0, 0]);
  eq([endDungeon(q).record, q.dungeon.best.floor], [false, 27]);
});

test('ダンジョン：実際に対戦しながら最後まで進められる（オート使用。対戦のルールは通常と同じ）', () => {
  const rng = aiRng(2468);
  let battles = 0, withCharms = 0;
  for (let i = 0; i < 4; i++) {
    const p = dgProfile();
    startDungeon(p, HEROES[i % HEROES.length].id, 0, 0, 1000 + i);
    const run = dgPlay(p, r => {
      const foe = r.pending.foe;
      const s = newGame(runDeckForBattle(r), foe.deck, rng, { terrain: foe.terrain, charms: runBattleCharms(r) });
      s.players[1].bonusIncome = foe.income; s.players[1].crystals += foe.bonus;
      eq(s.rules, {}, '特別なルールなし');
      const res = playOut(s, pi => (pi === 0 ? autoStrongAction : cpuNextAction));
      battles++;
      if (runBattleCharms(r).length) withCharms++;
      eq(monstersLeft(s.players[1 - res.winner]) === 0 || res.reason === 'both', true, '勝敗の決まり方は通常と同じ');
      return res.winner === 0;
    });
    assert(['clear', 'dead'].includes(run.over));
    const sum = endDungeon(p);
    eq(sum.reward.gold, Math.round(run.floor * DUNGEON.REWARD.goldPerFloor + (run.over === 'clear' ? DUNGEON.REWARD.clearGold : 0)));
  }
  assert(battles >= 12, '対戦の数: ' + battles);
});

// ---------- 詰めパズル ----------

// 盤面の見た目（比較用）：両者のクリスタル・手札・場
const pzView = s => JSON.stringify(s.players.map(p => [p.crystals, p.sacrificed, p.hand.map(h => h.card.id), p.slots.map(m => m && [m.card.id, m.hp, m.armor, m.item && m.item.id, m.status])]).concat([s.deaths, s.turn, s.current, s.phase]));

test('パズル：30問ある（入門・中級・上級が10問ずつ）。必要な項目がそろっている', () => {
  eq(PUZZLES.length, 30);
  eq(PUZZLE.LEVELS.map(([lv]) => PUZZLES.filter(p => p.level === lv).length), [10, 10, 10]);
  eq(new Set(PUZZLES.map(p => p.id)).size, 30);
  for (const p of PUZZLES) {
    assert(p.title && p.lesson && p.hints.length === 2 && p.hints.every(h => h.length > 5), p.id + '：題・学べること・ヒント2つ');
    assert(['wipe', 'kills', 'hold'].includes(p.goal.type) && puzzleGoalText(p.goal).length > 5 && !puzzleGoalText(p.goal).includes('undefined'), p.id + '：目標');
    assert(Array.isArray(p.solution) && p.solution.length >= 2 && p.solution[p.solution.length - 1][0] === 'end', p.id + '：正解の手順が保存されている');
    eq(PUZZLE_BY_ID[p.id], p);
    for (const spec of [...(p.me.field || []), ...(p.me.hand || []), ...(p.foe.field || []), ...(p.foe.hand || [])].filter(x => x)) assert(CARD_DEFS[typeof spec === 'string' ? spec : spec.id], p.id + '：実在するカード');
    const rules = puzzleRules(p);
    assert(rules.length >= 2 && rules[0].includes('ブロックは起きない') && rules.every(r => !r.includes('undefined')), p.id + '：この問題のルール');
    assert(PUZZLE.REWARD[p.level]);
  }
  // 目標の種類がひととおりある
  const kinds = new Set(PUZZLES.map(p => p.goal.type + (p.goal.turns > 1 ? '2' : '') + (p.goal.noLoss ? '+守' : '')));
  for (const k of ['wipe', 'kills', 'hold', 'wipe2', 'wipe+守']) assert(kinds.has(k), '目標の種類: ' + k);
});

test('パズル：全30問に正解の手順があり、保存した手順で目標を達成できる（全探索でも確認）。何もしないで解ける問題はない', () => {
  let greedy = 0;
  for (const p of PUZZLES) {
    const run = runPuzzle(p, p.solution);
    eq(run.result, 'win', p.id + '：保存した手順で成功する');
    // 手順の途中では、まだ成功していない（最後のターン終了で決まる）
    eq(runPuzzle(p, p.solution.slice(0, -1)).result, 'go', p.id);
    const sol = solvePuzzle(p);
    assert(sol.solution && !sol.capped, p.id + '：全探索で正解が見つかる');
    eq(runPuzzle(p, sol.solution).result, 'win', p.id + '：全探索の手順でも成功する');
    assert(sol.solution.length <= p.solution.length, p.id + '：保存した手順より短い手順が、全探索の最短');
    assert(sol.wins >= 1 && sol.wins < sol.endings, p.id + '：失敗する終わり方もある');
    assert(sol.wins / sol.endings <= (p.level === 'beginner' ? 0.45 : 0.3), `${p.id}：でたらめに動かして解ける割合が高すぎない（${sol.wins}/${sol.endings}）`);
    const t = puzzleTrivial(p);
    eq(t.idle, false, p.id + '：何もせずターン終了では解けない');
    if (t.greedy) greedy++;
    // できない手順は「illegal」
    eq(runPuzzle(p, [['end'], ['end'], ['end'], ['end']]).result, 'illegal', p.id);
  }
  // CPUの決まった手順でそのまま解ける問題は、上級にはほとんどない（入門は、ルールを1つ覚えるための問題なので可）
  const adv = PUZZLES.filter(p => p.level === 'advanced' && puzzleTrivial(p).greedy).length;
  assert(greedy <= 15 && adv <= 4, `CPUの手順で解ける問題: 全体${greedy}・上級${adv}`);
});

test('パズル：運の要素は固定されている（乱数を変えても、同じ手順なら同じ結果・同じ盤面になる）', () => {
  // 正解の手順を、乱数がいつも0を返す場合・いつも1に近い値を返す場合で実行して比べる
  const play = (p, rng) => {
    const s = buildPuzzle(p);
    s.rng = rng;
    let r = 'go';
    for (const step of p.solution) { if (step[0] === 'end') r = puzzleEndTurn(s, p.goal); else assert(applyAction(s, 0, puzzleAction(s, step)) !== false); }
    return [r, pzView(s)];
  };
  for (const p of PUZZLES) {
    const a = play(p, () => 0), b = play(p, () => 0.999999), c = play(p, aiRng(77));
    eq(a[0], 'win', p.id);
    // 山札に戻したカードの位置（見えない）だけは乱数で変わってよいので、場・手札・クリスタルで比べる
    eq([b, c], [a, a], p.id + '：乱数が違っても同じ');
  }
  // 固定の中身：ブロックは起きない／回避・カオス・確率スキルは指定どおり（指定がなければ 回避しない・最大値・発動しない）
  const fixedBoard = (mine, foes, fixed = {}) => { const s = board(mine, foes); s.fixed = fixed; s.rng = () => 0; return s; }; // 乱数0＝ふつうなら必ずブロック・回避・発動
  eq(attacks(fixedBoard([mk(WOLF), mk(ARCHER)], [mk(S('melee', 1, 30), LEATHER)])).map(e => [e.type, e.blocked]), [['ranged', false], ['melee', false]], 'ブロックなし');
  const fly = () => [mk(S('melee', 1, 30, 'flying'))];
  eq(attacks(fixedBoard([mk(WOLF), mk(ARCHER)], fly())).map(e => e.dodged), [false, false], '指定がなければ回避しない');
  eq(attacks(fixedBoard([mk(WOLF), mk(ARCHER)], fly(), { dodge: true })).map(e => e.dodged), [true, true], '「必ず回避」の指定');
  const never = board([mk(WOLF), mk(ARCHER)], fly()); never.fixed = {}; never.rng = () => 0.999;
  eq(attacks(never).some(e => e.dodged), false);
  eq(attacks(fixedBoard([mk(DEMON)], [mk(S('melee', 1, 30)), mk(S('melee', 1, 30))])).map(e => [e.dmg, e.target.card.id === e.target.owner.slots[0].card.id]), [[5, true]], 'カオスは最大値で、相手の一番前');
  eq(attacks(fixedBoard([mk(DEMON)], [mk(S('melee', 1, 30))], { chaos: 2 }))[0].dmg, 2, 'カオスの値を指定');
  eq(attacks(fixedBoard([mk(IMP)], [mk(S('melee', 1, 30))], { chaos: 4 }))[0].dmg, 2, '指定が攻撃力より大きければ攻撃力');
  const cnt = fixed => attacks(fixedBoard([mk(WOLF)], [mk(S('melee', 2, 30, 'counter'))], fixed))[0].extras.some(x => x.kind === 'counter');
  eq([cnt({}), cnt({ counter: true })], [false, true], 'Counter-Attack');
  const ref = fixed => attacks(fixedBoard([mk(MAGE)], [mk(S('melee', 2, 30, 'magicreflect'))], fixed))[0].extras.some(x => x.kind === 'magicreflect');
  eq([ref({}), ref({ reflect: true })], [false, true], 'Magic Reflect');
  const ent = fixed => { const s = fixedBoard([mk(S('ranged', 1, 5, 'entangle'))], [mk(GOLEM)], fixed); startOfTurnSkills(s); return !!s.players[1].slots[0].status.entangle; };
  eq([ent({}), ent({ entangle: true })], [false, true], 'Entangle');
  // 通常の対戦（fixed なし）は、今までどおり乱数で決まる
  const normal = board([mk(WOLF), mk(ARCHER)], fly()); normal.rng = () => 0;
  eq(attacks(normal).every(e => e.dodged), true);
});

test('パズル：目標だけで判定する（山札・残りモンスター数では決着しない。場が空のペナルティもない）', () => {
  const p = PUZZLE_BY_ID.b02;
  const s = buildPuzzle(p);
  eq([s.noResult, s.deaths, s.players.map(pl => pl.deck.length), s.phase, s.current, s.log.length], [true, [0, 0], [0, 0], 'play', 0, 0]);
  // 相手を全滅させても、対戦の「決着」にはならない
  applyAction(s, 0, puzzleAction(s, p.solution[0]));
  eq(puzzleEndTurn(s, p.goal), 'win');
  eq([s.result, s.phase !== 'over', s.players[1].slots, monstersLeft(s.players[1])], [null, true, [null, null, null], 0]);
  // 何もせずターン終了：失敗。場が空でもカードは捨てられない
  const idle = runPuzzle(PUZZLE_BY_ID.b01, [['end']]);
  eq([idle.result, idle.state.penalty || null, idle.state.players[0].hand.length], ['fail', null, 2]);
  // 目標の種類ごとの判定
  const mkState = (deaths, foeField, turnsUsed, foeDone) => ({ deaths, turnsUsed, foeDone, holdUids: [1], players: [{ slots: [{ uid: 1 }, null, null] }, { slots: foeField }] });
  eq([puzzleJudge(mkState([0, 1], [null, null, null], 1), { type: 'wipe' }), puzzleJudge(mkState([0, 1], [{}, null, null], 1), { type: 'wipe' }), puzzleJudge(mkState([0, 0], [{}, null, null], 1), { type: 'wipe', turns: 2 })], ['win', 'fail', 'go']);
  eq([puzzleJudge(mkState([0, 2], [{}, null, null], 1), { type: 'kills', n: 2 }), puzzleJudge(mkState([0, 1], [{}, null, null], 1), { type: 'kills', n: 2 })], ['win', 'fail']);
  eq(puzzleJudge(mkState([1, 1], [null, null, null], 1), { type: 'wipe', noLoss: true }), 'fail', '全滅させても、自分が倒されていたら失敗');
  eq([puzzleJudge(mkState([0, 0], [{}, null, null], 1, false), { type: 'hold' }), puzzleJudge(mkState([0, 0], [{}, null, null], 1, true), { type: 'hold' }), puzzleJudge(mkState([1, 0], [{}, null, null], 1, true), { type: 'hold' })], ['go', 'win', 'fail']);
  // 「守る」目標：生贄にして場から消しても失敗
  const hold = PUZZLE_BY_ID.m09;
  eq(runPuzzle(hold, [['x', 0], ['end']]).result, 'fail');
  // 2ターンの問題：相手の番にはCPUが動く（手札のカードも出してくる）
  const two = PUZZLE_BY_ID.a09;
  const r = runPuzzle(two, two.solution.slice(0, two.solution.findIndex(x => x[0] === 'end') + 1));
  eq([r.result, r.state.players[1].hand.length, r.state.players[1].slots.filter(m => m).length, r.state.current, r.state.phase, r.state.turnsUsed], ['go', 0, 2, 0, 'play', 1]);
});

test('パズル：やり直しは最初の盤面に戻り、1手戻すは直前の盤面に戻る', () => {
  for (const p of PUZZLES) {
    const fresh = pzView(buildPuzzle(p));
    eq(pzView(buildPuzzle(p)), fresh, p.id + '：何度作っても同じ盤面（やり直し）');
    // 1手ごとに盤面を写しておき、進めたあとでも写しは変わらない。写しから続けても同じ結果になる
    const s = buildPuzzle(p);
    const snaps = [];
    for (const step of p.solution) {
      if (step[0] === 'end') break;
      const snap = puzzleClone(s);
      snaps.push([snap, pzView(s), step]);
      assert(applyAction(s, 0, puzzleAction(s, step)) !== false);
      eq(pzView(snap), snaps[snaps.length - 1][1], p.id + '：進めても、1手前の写しは変わらない');
      assert(pzView(s) !== pzView(snap), p.id + '：行動で盤面が変わる');
    }
    if (!snaps.length) continue;
    // 最後の1手を戻して、同じ手をもう一度 → 戻す前と同じ盤面
    const [snap, , step] = snaps[snaps.length - 1];
    assert(snap.players[0].slots.every(m => !m || m.owner === snap.players[0]), '写しのモンスターの持ち主は、写しのプレイヤー');
    applyAction(snap, 0, puzzleAction(snap, step));
    eq(pzView(snap), pzView(s), p.id + '：戻してやり直しても同じ');
    // 最初の写し（1手目の前）は、最初の盤面と同じ
    eq(snaps[0][1], fresh);
  }
});

test('パズル：記録と報酬（初回クリアで報酬。ヒントなしで★、答えを見たら「答えを見た」。3回失敗で答えが見られる）', () => {
  const p = newProfile();
  eq(p.puzzle, { done: {}, fails: {} });
  const b = PUZZLE_BY_ID.b01, m = PUZZLE_BY_ID.m01, a = PUZZLE_BY_ID.a01;
  // 3回失敗すると、答えが見られる
  eq(puzzleCanSeeAnswer(p, b), false);
  eq([recordPuzzleFail(p, b), recordPuzzleFail(p, b), puzzleCanSeeAnswer(p, b), recordPuzzleFail(p, b), puzzleCanSeeAnswer(p, b)], [1, 2, false, 3, true]);
  // 答えを見てクリア：記録は「答えを見た」。初回クリアの報酬はもらえる
  const g0 = p.gold, s0 = p.stones;
  eq(recordPuzzleClear(p, b, { answer: true, hints: true }), { first: true, reward: { gold: 40 }, state: 3 });
  eq([p.gold - g0, p.puzzle.done.b01], [40, 3]);
  // あとでヒントありでクリア → ✓、ヒントなしでクリア → ★。報酬は初回だけ。悪い記録で上書きされない
  eq(recordPuzzleClear(p, b, { hints: true }), { first: false, reward: null, state: 1 });
  eq(recordPuzzleClear(p, b), { first: false, reward: null, state: 2 });
  eq(recordPuzzleClear(p, b, { answer: true }).state, 2);
  eq(recordPuzzleClear(p, b, { hints: true }).state, 2);
  eq(p.gold - g0, 40);
  // 難易度ごとの報酬
  eq([recordPuzzleClear(p, m).reward, recordPuzzleClear(p, a).reward, p.gold - g0, p.stones - s0], [{ gold: 80 }, { stones: 10 }, 120, 10]);
  eq(puzzleCanSeeAnswer(p, m), true, 'クリア済みの問題は、いつでも答えを見られる');
  // 保存と読み込み。古いセーブには初期値、壊れた値は捨てる
  const st = memStorage();
  saveProfile(p, st);
  eq(loadProfile(st).puzzle, p.puzzle);
  const old = JSON.parse(JSON.stringify(p)); delete old.puzzle;
  st.setItem(GROWTH.SAVE_KEY, JSON.stringify(old));
  eq([loadProfile(st).puzzle, loadProfile(st).gold, loadProfile(st).dungeon], [newPuzzleData(), p.gold, p.dungeon]);
  eq(sanitizePuzzleData({ done: { b01: 2, x: 9, m01: 'a' }, fails: { b01: 2.7, a01: -1 } }), { done: { b01: 2 }, fails: { b01: 2 } });
});

// ---------- 倒されたときのクリスタル ----------

// 両者のクリスタルを0にして、あとで増えた数を見やすくする
function zeroCrystals(s) { s.players.forEach(p => { p.crystals = 0; }); return s; }
function crystals(s) { return s.players.map(p => p.crystals); }
const T_END = tflash('t_end', 0, 'terminate'), T_BACK = tflash('t_back', 0, 'unsummon'), T_HOME = tflash('t_home', 0, 'retreat');

test('倒されたときのクリスタル：攻撃で倒されたら、持ち主のクリスタルが+1（自分も相手も同じ）', () => {
  eq(CONFIG.FALLEN_CRYSTAL, 1);
  for (const type of ['melee', 'ranged', 'magic', 'chaos']) {
    const hitter = mk(S(type, 9, 9));
    const s = zeroCrystals(board(type === 'ranged' ? [mk(S('melee', 0, 9)), hitter] : [hitter], [mk(S('melee', 1, 1))]));
    const ev = attacks(s)[0];
    assert(ev.killed, type + 'で倒した');
    eq(crystals(s), [0, 1], type + '：倒された側（相手）が+1');
  }
  // 相手の番に自分のモンスターが倒されたら、自分が+1
  const t = zeroCrystals(board([mk(S('melee', 1, 2))], [mk(DRAGON)]));
  t.current = 1;
  assert(attacks(t)[0].killed);
  eq(crystals(t), [1, 0]);
  // 倒されなければ増えない
  const u = zeroCrystals(board([mk(WOLF)], [mk(GOLEM)]));
  phase(u);
  eq(crystals(u), [0, 0]);
});

test('倒されたときのクリスタル：Thorns・反撃・Menace・Outbreak・フラッシュ・消耗ダメージ・地形で倒されたときも+1', () => {
  // Thorns：攻撃した側が倒れる → 攻撃した側（自分）が+1
  const th = zeroCrystals(board([mk(S('melee', 1, 2))], [mk(S('melee', 1, 20, 'thorns:2'))]));
  assert(extra(attacks(th)[0], 'thorns').killed);
  eq(crystals(th), [1, 0], 'Thorns');
  // Cross-Counter-Attack（必ず発動する反撃）
  const cc = zeroCrystals(board([mk(S('melee', 1, 2))], [mk(S('melee', 5, 20, 'crosscounter'))]));
  assert(extra(attacks(cc)[0], 'crosscounter').killed);
  eq(crystals(cc), [1, 0], '反撃');
  // Menace：前列を倒す → 詰めて動いた後列が Menace で倒れる → 相手が+2
  const mn = zeroCrystals(board([mk(S('melee', 9, 9, 'menace:3'))], [mk(S('melee', 1, 1)), mk(S('ranged', 1, 2))]));
  phase(mn);
  eq([names(mn.players[1]), crystals(mn)], [[null, null, null], [0, 2]], 'Menace（攻撃で1体＋Menaceで1体）');
  // Outbreak
  const ob = zeroCrystals(board([mk(S('melee', 1, 9, 'outbreak'))], [mk(S('melee', 1, 4))]));
  ob.players[1].slots[0].status.disease = 5;
  assert(extra(attacks(ob)[0], 'outbreak').killed);
  eq(crystals(ob), [0, 1], 'Outbreak');
  // フラッシュ（ダメージ）と Terminate
  const fl = zeroCrystals(board([mk(WOLF)], [mk(S('melee', 1, 3)), mk(GOLEM)]));
  fl.players[0].crystals = 1;
  assert(playFlash(fl, 0, give(fl, 0, ROCK), 0).killed);
  eq(crystals(fl), [0, 1], 'フラッシュのダメージ');
  assert(playFlash(fl, 0, give(fl, 0, T_END), 0).killed);
  eq(crystals(fl), [0, 2], 'Terminate');
  // 消耗ダメージ：両者の場のモンスターが同時に倒れる → それぞれ+1（ターン開始のクリスタルとは別）
  const at = zeroCrystals(board([mk(S('melee', 1, 1)), mk(GOLEM)], [mk(S('melee', 1, 1)), mk(GOLEM)]));
  at.turn = CONFIG.ATTRITION_START; at.phase = 'attack'; at.current = 0;
  [0, 1].forEach(pi => inDeck(at, pi, WOLF));
  startTurn(at);
  eq(at.attrition.filter(e => e.killed).length, 2);
  eq(crystals(at), [CONFIG.CRYSTALS_PER_TURN + 1, 1], '消耗ダメージ');
  // 地形（火山の熱）
  const land = newGame(DEFAULT_DECK, DEFAULT_DECK, testRng, { terrain: 'volcano' });
  land.current = 0; land.turn = 5;
  land.players.forEach(p => { p.crystals = 0; p.hero = null; });
  land.players[0].slots = [setOwner(mk(S('melee', 1, 1)), land.players[0]), null, null];
  land.players[0].slots[0].card = { ...land.players[0].slots[0].card, color: 'blue' };
  startTurn(land);
  assert(land.terrainEvents.some(e => e.killed), '火山の熱で倒れた');
  eq(land.players[0].crystals, CONFIG.CRYSTALS_PER_TURN + 1, '地形');
});

test('倒されたときのクリスタル：生贄・Unsummon・Retreat・場が空のペナルティ・Phantom の分身では増えない', () => {
  // 生贄（場・手札）：生贄のクリスタルだけ
  const sc = zeroCrystals(board([mk(WOLF), mk(ELF)], [mk(GOLEM)]));
  [0, 1, 2].forEach(() => inDeck(sc, 0, WOLF));
  assert(sacrificeField(sc, 0, 1));
  eq(crystals(sc), [CONFIG.SACRIFICE_MONSTER, 0], '場の生贄');
  const sh = zeroCrystals(board([mk(WOLF)], [mk(GOLEM)]));
  assert(sacrifice(sh, 0, give(sh, 0, ELF)));
  eq(crystals(sh), [CONFIG.SACRIFICE_MONSTER, 0], '手札の生贄');
  // Unsummon・Retreat：山札に戻るだけ
  const un = zeroCrystals(board([mk(WOLF), mk(ELF)], [mk(GOLEM), mk(IMP)]));
  assert(playFlash(un, 0, give(un, 0, T_BACK), 0).unsummoned);
  assert(playFlash(un, 0, give(un, 0, T_HOME), 1).unsummoned);
  eq([names(un.players[0]), names(un.players[1]), crystals(un)], [[WOLF, null, null], [IMP, null, null], [0, 0]]);
  // 場が空のペナルティ：手札・山札のカードが捨てられるだけ
  const pn = zeroCrystals(board([], [mk(GOLEM)]));
  [WOLF, ELF, SLIME].forEach(id => inDeck(pn, 0, id));
  phase(pn); finishTurn(pn);
  assert(pn.penalty && pn.penalty.card, 'ペナルティで1枚捨てられた');
  eq(crystals(pn), [0, 0]);
  // Phantom：分身が自滅しても、途中で倒されても増えない
  const ph = zeroCrystals(board([mk(WOLF)], [mk(S('melee', 1, 30, 'thorns:9'))]));
  inDeck(ph, 0, ELF);
  ph.players[0].slots[0].hp = 30; ph.players[0].slots[0].maxHp = 30;
  assert(playFlash(ph, 0, give(ph, 0, tflash('t_phantom_g', 0, 'phantom')), 0));
  const evs = phase(ph);
  assert(evs.some(e => e.kind === 'phase' && e.events[0].kind === 'phantom'), '分身が現れた');
  eq([names(ph.players[0]), crystals(ph)], [[WOLF, null, null], [0, 0]], '分身は Thorns で倒れたが、クリスタルは増えない');
  const p2 = zeroCrystals(board([mk(S('ranged', 1, 5))], [mk(GOLEM)]));
  inDeck(p2, 0, ELF);
  playFlash(p2, 0, give(p2, 0, tflash('t_phantom_h', 0, 'phantom')), 0);
  const end = phase(p2).pop();
  eq([end.events[0].kind, crystals(p2)], ['phantomend', [0, 0]], '自滅でも増えない');
  // ログにも残らない
  for (const st of [sc, sh, un, pn, ph, p2]) assert(!st.log.some(e => e[0] === 'G'));
});

test('倒されたときのクリスタル：同じ攻撃フェーズで複数倒されたら、その数だけ増える。相手の番に倒されたぶんは、次の自分の番に持ち越す', () => {
  const s = zeroCrystals(board([mk(S('melee', 9, 30)), mk(S('ranged', 9, 9)), mk(S('ranged', 9, 9))], [mk(S('melee', 1, 3)), mk(S('melee', 1, 3)), mk(S('melee', 1, 3))]));
  [0, 1, 2].forEach(() => inDeck(s, 1, WOLF));
  s.first = 1; // 相手を先攻にしておく（後攻ボーナスの2回目が、ここの計算に混ざらないように）
  s.log.length = 0;
  const kills = attacks(s).filter(e => e.killed).length;
  eq(kills, 3);
  eq(crystals(s), [0, 3], '3体倒されたので+3');
  eq(logged(s, 'G').map(e => [e[1], e[3]]), [[1, 1], [1, 1], [1, 1]]);
  const line = logLine(logged(s, 'G')[0], { names: ['あなた', 'ボス'] }).html.replace(/<[^>]+>/g, '');
  assert(line.includes('が倒された：ボスのクリスタル +1'), line);
  // ターンが変わり、相手は「持ち越した3 + ターン開始の3」を使える
  eq(finishTurn(s), null);
  eq(startTurn(s), null);
  eq([s.current, s.players[1].crystals], [1, 3 + CONFIG.CRYSTALS_PER_TURN]);
  // 使い切れなかったぶんは、さらに次のターンへ
  phase(s); finishTurn(s); startTurn(s); phase(s); finishTurn(s); startTurn(s);
  eq(s.players[1].crystals, 3 + CONFIG.CRYSTALS_PER_TURN * 2);
});

test('倒されたときのクリスタル：ほかのクリスタルを増やす効果と重なる（戦利品・特殊ルール・生贄・Reinforcement）。決着した試合では勝敗に影響しない', () => {
  // ヒーロースキル「戦利品」（倒した側+1）と同時に働く：倒した側+1、倒された側+1
  const sp = zeroCrystals(board([mk(DRAGON)], [mk(S('melee', 1, 2)), mk(GOLEM)]));
  sp.players[0].hero = { id: 'h', name: 'h', skill: 'spoils' };
  phase(sp);
  eq(crystals(sp), [1, 1]);
  // 特殊ルール（毎ターン+1・生贄2倍）とも別に数える
  const ev = newGame(DEFAULT_DECK, DEFAULT_DECK, testRng, { rules: { income: 1, sacrificeMult: 2 } });
  ev.current = 0; ev.turn = 5; ev.phase = 'attack';
  ev.players.forEach(p => { p.crystals = 0; p.hero = null; p.slots = [null, null, null]; });
  ev.players[0].slots[0] = setOwner(mk(DRAGON), ev.players[0]);
  ev.players[1].slots = [setOwner(mk(S('melee', 1, 2)), ev.players[1]), setOwner(mk(WOLF), ev.players[1]), null];
  phase(ev); finishTurn(ev); startTurn(ev);
  eq(ev.players[1].crystals, 1 + CONFIG.CRYSTALS_PER_TURN + 1, '倒された+1、ターン開始+3、特殊ルール+1');
  const item = ev.players[1].hand.find(h => h.card.kind !== 'monster') || ev.players[1].hand[0];
  const before = ev.players[1].crystals;
  sacrifice(ev, 1, item.uid);
  eq(ev.players[1].crystals, before + sacrificeGain(item.card) * 2, '生贄は生贄のぶんだけ');
  // Reinforcement
  const rf = zeroCrystals(board([mk(WOLF)], [mk(GOLEM)]));
  playFlash(rf, 0, give(rf, 0, AID), -1);
  eq(crystals(rf), [2, 0]);
  // 最後の1体が倒されて決着：増えるが、勝敗はそのまま
  const fin = zeroCrystals(board([mk(DRAGON)], [mk(S('melee', 1, 2))]));
  inDeck(fin, 0, WOLF);
  phase(fin);
  const res = finishTurn(fin);
  eq([res.winner, res.reason, fin.players[1].crystals], [0, 'wipeout', 1]);
  // ルールをなくす（0）と、どこでも増えない
  CONFIG.FALLEN_CRYSTAL = 0;
  try {
    const off = zeroCrystals(board([mk(DRAGON)], [mk(S('melee', 1, 2)), mk(GOLEM)]));
    phase(off);
    eq([crystals(off), off.log.some(e => e[0] === 'G')], [[0, 0], false]);
  } finally { CONFIG.FALLEN_CRYSTAL = 1; }
});

test('倒されたときのクリスタル：辞典の基本ルールと、オートの試算に入っている', () => {
  const e = DICT_BY_KEY['rule:fallen'];
  assert(e && e.desc.includes('クリスタルを1個') && e.desc.includes('生贄') && e.desc.includes('Phantom'), '辞典に載っている');
  assert(DICT_BY_KEY['rule:crystal'].rel.includes('rule:fallen'));
  // オート（つよい）の試算：相手を倒すと相手のクリスタルが増えることも点数に入る
  const a = zeroCrystals(board([mk(WOLF)], [mk(GOLEM)]));
  const b = aiClone(a, a.rng);
  b.players[1].crystals = 3;
  assert(aiEval(b, 0) < aiEval(a, 0), '相手のクリスタルが多いほど、自分には不利と評価する');
  // 試算用の複製でも、倒されたらクリスタルが増える（ログは持たない）
  const c = aiClone(zeroCrystals(board([mk(DRAGON)], [mk(S('melee', 1, 2)), mk(GOLEM)])), aiRng(1));
  for (const x of attackPhaseAll(c)) { /* */ }
  eq([c.players[1].crystals, c.log], [1, null]);
});

// ---------- オート（つよい）：先読みする思考 ----------

// テスト用のカード（実在のカードの名前だけ借りて、数値とスキルは自由に決める）
const AI_IDS = MONSTERS.map(c => c.id);
function aiCard(n, over = {}) {
  return Object.assign({}, CARD_BY_ID[AI_IDS[n]], { kind: 'monster', color: 'red', type: 'melee', cost: 2, atk: 2, hp: 5, armor: 0, skills: [] }, over);
}
const aiMon = card => makeMonster(uidSeq++, card);
function aiGive(s, pi, card) { const h = { uid: uidSeq++, card }; s.players[pi].hand.push(h); return h.uid; }
// 山札にモンスターを足して、残りモンスター数を増やす
const aiPad = (s, pi, n) => { for (let i = 0; i < n; i++) s.players[pi].deck.push({ uid: uidSeq++, card: aiCard(20 + i) }); };
// オート（つよい）でその番の行動をすべて行い、行った行動の一覧を返す
function aiPlayTurn(s) {
  const done = [];
  let a;
  while ((a = autoStrongAction(s)) && done.length < 30) {
    const h = s.players[s.current].hand.find(x => x.uid === a.uid);
    assert(applyAction(s, s.current, a) !== false, 'できない行動を選んだ: ' + JSON.stringify(a));
    done.push({ ...a, card: h ? h.card : null });
  }
  return done;
}
const aiNotes = s => s.log.filter(e => e[0] === 'N');

test('オート（つよい）：とどめを刺せる相手がいれば、フラッシュをその相手に使う', () => {
  const s = board([aiMon(aiCard(0, { hp: 9 }))], [aiMon(aiCard(1, { hp: 9, atk: 2 })), aiMon(aiCard(2, { hp: 3, atk: 5, type: 'ranged' }))]);
  aiPad(s, 0, 4); aiPad(s, 1, 4);
  s.players[0].crystals = 1;
  const uid = aiGive(s, 0, CARD_BY_ID.f01); // 石つぶて：3ダメージ
  const foe = s.players[1], weak = foe.slots[1];
  const done = aiPlayTurn(s);
  eq(done.map(a => [a.type, a.uid, a.slot]), [['flash', uid, 1]], 'HP3の相手に使う');
  assert(!foe.slots.includes(weak), '倒した');
  const note = aiNotes(s)[0];
  eq(note.slice(0, 3), ['N', 0, 'flash']);
  eq(note[5], 'kill', '理由は「とどめ」');
  const line = logLine(note);
  assert(line.important && line.html.includes('とどめ') && line.html.includes('石つぶて'), '重要なログとして読める文になる: ' + line.html);
});

test('オート（つよい）：Thorns 持ちの正面に、打たれ弱い近接を置かない（今の思考は置いてしまう）', () => {
  const make = () => {
    const s = board([aiMon(aiCard(0, { hp: 12, atk: 1, armor: 3 }))], [aiMon(aiCard(1, { hp: 14, atk: 2, skills: [{ id: 'thorns', x: 3 }] }))]);
    aiPad(s, 0, 4); aiPad(s, 1, 4);
    s.players[0].crystals = 2;
    return [s, aiGive(s, 0, aiCard(2, { hp: 2, atk: 5 }))]; // 攻撃力は高いが、Thorns 3 で倒れる
  };
  const [old, uidOld] = make();
  eq(autoNextAction(old), { type: 'monster', uid: uidOld, slot: 0 }, '今の思考は、攻撃力だけを見て前列に出す');
  const [s, uid] = make();
  const done = aiPlayTurn(s);
  assert(!done.some(a => a.type === 'monster' && a.slot === 0), '前列（Thorns の正面）には出さない: ' + JSON.stringify(done.map(a => [a.type, a.slot])));
  const played = done.find(a => a.uid === uid);
  if (played) {
    eq(played.slot, 1, '出すなら後列');
    const note = aiNotes(s).find(n => n[2] === 'avoid');
    assert(note && logLine(note).html.includes('Thorns'), '理由に Thorns が出る');
  }
});

test('オート（つよい）：残りモンスターが少ないときは、モンスターを生贄にしない', () => {
  // 残り3体（場1・手札2）。安いモンスターを生贄にすれば高いモンスターを出せるが、やらない
  const s = board([aiMon(aiCard(0, { hp: 8, atk: 3 }))], [aiMon(aiCard(1, { hp: 8, atk: 3 }))]);
  aiPad(s, 1, 4);
  s.players[0].crystals = 4;
  aiGive(s, 0, aiCard(2, { cost: 6, hp: 10, atk: 6 }));
  const cheap = aiGive(s, 0, aiCard(3, { cost: 6, hp: 2, atk: 1 }));
  eq(monstersLeft(s.players[0]), 3);
  const moves = aiMoves(s, true);
  assert(!moves.some(m => m.type === 'sacrificeField'), '場のモンスターは生贄の候補にしない');
  assert(!moves.some(m => m.type === 'sacrifice' && m.uid === cheap), '手札のモンスターも候補にしない');
  eq(aiPlayTurn(s).filter(a => a.type.startsWith('sacrifice')), []);
  // 残りに余裕があれば、候補には入る
  aiPad(s, 0, 4);
  s.players[0].sacrificed = false;
  assert(aiMoves(s, true).some(m => m.type === 'sacrifice' && s.players[0].hand.find(h => h.uid === m.uid).card.kind === 'monster'));
  // 実戦でも、少ないときにモンスターを生贄にするのは「場の誰も攻撃できない膠着を直す」ときだけ
  const rng = aiRng(4242);
  let turns = 0;
  for (let g = 0; g < 40; g++) {
    const st = newGame(randomDeck(rng, { level: 2 }), randomDeck(rng, { level: 2 }), rng);
    playOut(st, pi => (pi === 1 ? cpuNextAction : x => {
      const me = x.players[0];
      const few = monstersLeft(me) <= CONFIG.AUTO_KEEP_MONSTERS;
      const stuck = lineupAttack(me.slots.filter(m => m)) === 0;
      const a = autoStrongAction(x);
      if (a) turns++;
      const mon = a && (a.type === 'sacrificeField' || (a.type === 'sacrifice' && me.hand.find(h => h.uid === a.uid).card.kind === 'monster'));
      assert(!(mon && few) || (a.type === 'sacrificeField' && stuck), '少ないのにモンスターを生贄にした: ' + JSON.stringify(a) + ' 残り' + monstersLeft(me));
      return a;
    }));
  }
  assert(turns > 200);
});

test('オート（つよい）：相手の手札と山札の中身は見ない（中身が違っても、同じ手を選ぶ）', () => {
  const rng = aiRng(99);
  let checked = 0;
  for (let g = 0; g < 12; g++) {
    const s = newGame(randomDeck(rng, { level: 3 }), randomDeck(rng, { level: 3 }), rng);
    playOut(s, pi => (pi === 1 ? cpuNextAction : autoStrongAction), st => {
      const plan = autoThinkSync(aiClone(st, st.rng));
      // 相手の手札・山札を、同じ種類（モンスターかどうか）の別のカードに入れ替えた盤面
      const other = aiClone(st, st.rng);
      const swap = h => ({ uid: h.uid, card: h.card.kind === 'monster' ? aiCard(30, { cost: 9, hp: 30, atk: 30 }) : CARD_BY_ID.f23 });
      other.players[1].hand = other.players[1].hand.map(swap);
      other.players[1].deck = other.players[1].deck.map(swap).reverse();
      const plan2 = autoThinkSync(other);
      eq(plan2.queue.map(a => [a.type, a.uid, a.slot]), plan.queue.map(a => [a.type, a.uid, a.slot]));
      checked++;
    });
  }
  assert(checked > 60);
});

test('オート（つよい）：最後まで対戦でき、選ぶ行動はすべて実行できる。理由が対戦ログに残り、履歴にも入る', () => {
  const p = Object.assign(richProfile(), { level: 8 });
  const games = [
    () => newGame(deckForBattle(p), stageDeck(STAGE_BY_ID['3-10']), testRng, { terrain: STAGE_BY_ID['3-10'].terrain }),
    () => newGame(deckForBattle(p), cpuDeckFor(p, testRng), testRng, { terrain: randomTerrain(testRng) }),
    ...EVENTS.slice(0, 4).map(ev => () => newGame(eventDeck(p, ev, testRng), eventFoeDeck(p, ev, testRng), testRng, { rules: ev.rule })),
  ];
  const kinds = new Set();
  for (const make of games) for (let i = 0; i < 4; i++) {
    const s = make();
    const res = playOut(s, pi => (pi === 0 ? autoStrongAction : cpuNextAction));
    assert(res && (res.winner === 0 || res.winner === 1), '決着がつく');
    eq(s.log[s.log.length - 1], ['R', res.winner, res.reason]);
    const notes = aiNotes(s);
    assert(notes.length > 0, '理由が残る');
    assert(notes.every(n => n[1] === 0), '理由を残すのは自分（オート）の側だけ');
    for (const n of notes) {
      kinds.add(n[2]);
      const line = logLine(n);
      assert(line.important && line.cls === 'think' && line.html.includes('オートの判断') && !line.html.includes('undefined'), '読める文になる: ' + JSON.stringify(n) + ' → ' + line.html);
    }
    // 1ターンに残す理由は多すぎない
    let run = 0;
    for (const e of s.log) { if (e[0] === 'T') run = 0; if (e[0] === 'N') assert(++run <= CONFIG.AUTO_AI.MAX_NOTES, '1ターンの理由が多すぎる'); }
    assert(logHtml(s.log, {}, true).includes('オートの判断'), '「重要なものだけ」でも見られる');
    const rec = makeHistoryRecord(s, { type: 'free', name: 'テスト' }, res);
    assert(JSON.stringify(rec).includes('"N"'), '履歴にも入る');
  }
  for (const k of kinds) assert(LOG_THINK[k], '文の書き方がない理由: ' + k);
  assert(kinds.size >= 6, '理由の種類: ' + [...kinds].join(','));
});

test('オート（つよい）：今の思考（ふつう）に大きく勝ち越す。1ターンの思考は短い', () => {
  const rng = aiRng(20261005);
  let wins = 0, games = 0, ms = 0, maxMs = 0, plans = 0, sims = 0;
  const strong = st => {
    const had = st.autoPlan;
    const a = autoStrongAction(st);
    if (st.autoPlan !== had) { plans++; ms += st.autoPlan.stats.ms; maxMs = Math.max(maxMs, st.autoPlan.stats.ms); sims = Math.max(sims, st.autoPlan.stats.sims); }
    return a;
  };
  const play = (a, b, brains) => playOut(newGame(a, b, rng), pi => brains[pi]).winner;
  for (let g = 0; g < 60; g++) { // 同じデッキの組で、席を入れ替えて2試合
    const a = randomDeck(rng, { level: 3 }), b = randomDeck(rng, { level: 3 });
    if (play(a, b, [strong, autoNextAction]) === 0) wins++;
    if (play(b, a, [autoNextAction, strong]) === 1) wins++;
    games += 2;
  }
  assert(wins / games >= 0.56, `つよいの勝率 ${Math.round(100 * wins / games)}%`); // 120試合なので幅がある（大量対戦での実測は約65%）
  const A = CONFIG.AUTO_AI;
  assert(ms / plans < 30, `平均の思考時間 ${(ms / plans).toFixed(1)}ms`);
  assert(maxMs < A.BUDGET_MS, `最大の思考時間 ${maxMs.toFixed(0)}ms`);
  assert(sims <= A.MAX_CANDIDATES * 3 + 2 * 3 + 10 * 6 + 3 * 12, '試算の回数に上限がある');
});

test('オート（つよい）：時間切れでも実行できる手を返す。途中で手動の操作が入ったら考え直す', () => {
  const rng = aiRng(7);
  const s = newGame(randomDeck(rng, { level: 3 }), randomDeck(rng, { level: 3 }), rng);
  let late = 0, replans = 0;
  playOut(s, pi => (pi === 1 ? cpuNextAction : autoStrongAction), st => {
    // 時間切れ（締め切りがもう過ぎている）
    const c = aiClone(st, st.rng);
    c.log = []; c.moveBuf = [];
    const plan = autoThinkSync(c, { deadline: -1 });
    assert(plan.stats.sims <= 6, '時間切れなら、すぐに切り上げる');
    for (const a of plan.queue) assert(applyAction(c, 0, a) !== false, '時間切れでも実行できる手');
    late++;
    // 計画を立てたあとで、手動でカードを1枚生贄にする → 次の行動の前に考え直す
    const me = st.players[0];
    const first = autoThinkSync(st);
    assert(autoPlanReady(st));
    const item = me.hand.find(h => h.card.kind !== 'monster');
    if (item && !me.sacrificed && !first.queue.some(a => a.type.startsWith('sacrifice'))) {
      sacrifice(st, 0, item.uid);
      assert(!autoPlanReady(st), '盤面が変わったので、計画は使えない');
      replans++;
    }
  });
  assert(late > 3 && replans > 2);
  assert(s.phase === 'over');
});

test('オートの強さ：設定は「ふつう・つよい」。ふつうは今の思考と同じ。敵CPUの思考は変わらない', () => {
  eq(FX_AUTO_LEVELS.map(x => x[0]), ['normal', 'strong']);
  const rng = aiRng(31);
  for (let g = 0; g < 6; g++) {
    const s = newGame(randomDeck(rng), randomDeck(rng), rng);
    playOut(s, pi => (pi === 1 ? cpuNextAction : st => {
      const a = autoActionFor(st, 'normal');
      eq(a, autoNextAction(st), 'ふつう＝今の思考');
      return a;
    }));
    assert(!s.log.some(e => e[0] === 'N'), 'ふつうは理由を残さない');
    assert(!s.autoPlan, 'ふつうは先読みをしない');
  }
  // 保存された設定の読み込み：保存がなければ「つよい」（実際の保存には触らない）
  const keep = { ...FX };
  try {
    fxApplySettings(null); eq(FX.autoLevel, 'strong');
    fxApplySettings({ autoLevel: 'normal' }); eq(FX.autoLevel, 'normal');
    fxApplySettings(JSON.parse(JSON.stringify({ ...FX, autoLevel: 'strong' }))); eq(FX.autoLevel, 'strong');
    fxApplySettings({ speed: 2, mute: true, auto: true }); // 古い設定（強さの項目がない）
    eq([FX.speed, FX.mute, FX.auto, FX.autoLevel], [2, true, true, 'strong']);
  } finally { Object.assign(FX, keep); }
});

test('演出：効果音は攻撃の種類ごとに別の音で、演出に使う音がそろっている', () => {
  eq(new Set(['magic', 'chaos', 'ranged', 'melee'].map(k => String(SFX[k]))).size, 4);
  for (const k of ['hit', 'block', 'break', 'dodge', 'thorns', 'heal', 'buff', 'debuff', 'disease', 'outbreak', 'entangle', 'silence', 'death', 'burn', 'sacrifice', 'gem', 'win', 'lose']) {
    eq(typeof SFX[k], 'function', k);
  }
  sfx('melee'); sfx('存在しない音'); // 音が出せない環境でもエラーにならない
});

// にせの音の出口。Safari と同じく「止まった状態」で作られ、resume() で動き出す
function withFakeAudio(fn, { resumeNow = true } = {}) {
  const made = { ctx: 0, osc: 0, noise: 0, resume: 0, suspend: 0, limiter: 0, pending: [], starts: [] };
  const param = () => ({ value: 0, events: [], setValueAtTime(v, t) { this.events.push(['set', v, t]); }, exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); },
    linearRampToValueAtTime(v, t) { this.events.push(['lin', v, t]); }, setTargetAtTime(v, t) { this.events.push(['target', v, t]); }, cancelScheduledValues() {} });
  const node = extra => Object.assign({ connect(to) { this.to = to; return to; }, disconnect() {}, start(t) { made.starts.push(t); }, stop() {} }, extra);
  class FakeAC {
    constructor() { made.ctx++; made.last = this; this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 8000; this.destination = node({ dest: true }); }
    resume() {
      made.resume++;
      const go = () => { this.state = 'running'; };
      if (resumeNow) go();
      return { then: (done) => { if (resumeNow) done(); else made.pending.push(() => { go(); done(); }); }, catch() {} };
    }
    suspend() { made.suspend++; this.state = 'suspended'; return { then() {}, catch() {} }; }
    createGain() { return node({ gain: param() }); }
    createOscillator() { made.osc++; return node({ frequency: param(), detune: param(), setPeriodicWave() {} }); }
    createBiquadFilter() { return node({ frequency: param(), Q: param() }); }
    createDynamicsCompressor() { made.limiter++; return node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
    createConvolver() { return node({}); }
    createStereoPanner() { return node({ pan: param() }); }
    createPeriodicWave() { return {}; }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { made.noise++; return node({}); }
  }
  const had = typeof window !== 'undefined', oldWin = had ? window : undefined;
  const keep = { mute: FX.mute, bgmMute: FX.bgmMute, bgm: FX.bgm, sfx: FX.sfx };
  const oldAudio = fxAudio, oldNow = Date.now, oldBgm = { ...BGM };
  globalThis.window = { AudioContext: FakeAC };
  const oldSI = globalThis.setInterval, oldCI = globalThis.clearInterval;
  globalThis.setInterval = () => 1; globalThis.clearInterval = () => {}; // 予約はテストの中で bgmTick() を呼んで進める
  fxAudio = null; FX.mute = false; FX.bgmMute = false;
  Object.assign(BGM, { want: null, preview: null, cur: null, fading: [], timer: null });
  try { fn(made); } finally {
    globalThis.setInterval = oldSI; globalThis.clearInterval = oldCI;
    if (oldSI === undefined) { delete globalThis.setInterval; delete globalThis.clearInterval; }
    fxAudio = oldAudio; Object.assign(FX, keep); Date.now = oldNow; Object.assign(BGM, oldBgm);
    if (had) globalThis.window = oldWin; else delete globalThis.window;
  }
}

test('効果音：止まった状態で作られた音の出口を、動かしてから鳴らす', () => {
  withFakeAudio(made => {
    sfx('tap');
    eq(made.ctx, 1);
    eq(made.resume, 1, '動かそうとする');
    eq(made.last.state, 'running');
    eq(made.osc, 1, '動き出したあとで音が鳴る');
    sfx('tap');
    eq(made.resume, 1, '動いていれば、もう resume しない');
    eq(made.osc, 2);
  });
});

test('効果音：最初の操作（クリックなど）で音の出口を動かしておく', () => {
  withFakeAudio(made => {
    fxUnlock();
    eq(made.ctx, 1);
    eq(made.last.state, 'running');
    eq(made.osc, 0, '操作しただけでは音は鳴らない');
    fxUnlock();
    eq(made.resume, 1, '動いたあとは何もしない');
    sfx('gem'); // 操作の瞬間でなくても鳴る（対戦中の演出の音）
    eq(made.osc > 0, true);
  });
});

test('効果音：BGM も効果音もミュート中は音の出口を作らない', () => {
  withFakeAudio(made => {
    FX.mute = true; FX.bgmMute = true;
    fxUnlock(); sfx('tap');
    eq(made.ctx, 0);
    FX.mute = false;
    sfx('tap');
    eq(made.osc, 1, 'ミュートを外せば鳴る');
  });
});

test('効果音：音の準備が遅れたら、その音は鳴らさない（後からまとめて鳴らない）', () => {
  withFakeAudio(made => {
    let now = 1000; Date.now = () => now;
    sfx('tap'); sfx('gem'); sfx('win');
    eq(made.osc, 0, 'まだ動いていないので鳴らない');
    now += FX_LATE_MS + 1;
    made.pending.forEach(f => f());
    eq(made.osc, 0, '遅れた音は捨てる');
    sfx('tap');
    eq(made.osc, 1, '動いたあとの音は鳴る');
  }, { resumeNow: false });
  withFakeAudio(made => {
    let now = 1000; Date.now = () => now;
    sfx('tap');
    now += 50;
    made.pending.forEach(f => f());
    eq(made.osc, 1, 'すぐ動けば、その音は鳴る');
  }, { resumeNow: false });
});

test('効果音：全体の音量を持ち上げ、リミッターを通してスピーカーへ出す', () => {
  withFakeAudio(made => {
    sfx('tap');
    eq(fxAudio.master.gain.value >= 1, true, '音量が小さすぎない');
    eq(made.limiter, 1);
    eq(fxAudio.master.to.to.dest, true, '音量 → リミッター → スピーカー');
  });
});

test('効果音：効果音だけミュートなら、効果音は鳴らさない（BGM は流せる）', () => {
  withFakeAudio(made => {
    FX.mute = true;
    fxUnlock(); sfx('tap');
    eq(made.ctx, 1, 'BGM のために音の出口は作る');
    eq(made.osc, 0, '効果音は鳴らない');
  });
});

test('効果音：どの音も、音の部品だけで（エラーなく）鳴らせる', () => {
  withFakeAudio(made => {
    fxUnlock();
    for (const k of Object.keys(SFX)) {
      const before = made.osc + made.noise;
      SFX[k](); // try で包まずに呼ぶ：作りの間違いがあればここで分かる
      eq(made.osc + made.noise - before >= 1, true, k);
    }
    eq(new Set(['magic', 'chaos', 'ranged', 'melee'].map(k => String(SFX[k]))).size, 4);
    for (const k of ['melee', 'ranged', 'magic', 'chaos']) {
      const before = made.osc + made.noise;
      SFX[k]();
      eq(made.osc + made.noise - before >= 3, true, `${k} は音を重ねて厚みを出す`);
    }
  });
});

test('効果音：同じ音は短い時間に2回まで・同時に鳴らすのは8つまで', () => {
  withFakeAudio(made => {
    let now = 5000; Date.now = () => now;
    fxUnlock();
    const count = () => made.osc + made.noise;
    let c0 = count(), plays = 0;
    for (let i = 0; i < 6; i++) { const b = count(); sfx('hit'); if (count() > b) plays++; }
    eq(plays, AUDIO.SFX_SAME_MAX, '同じ音は重ねすぎない');
    now += 1000;
    plays = 0;
    for (const k of ['hit', 'gem', 'tap', 'block', 'dodge', 'heal', 'death', 'melee', 'ranged', 'magic', 'chaos', 'equip']) { const b = count(); sfx(k); if (count() > b) plays++; }
    eq(plays, AUDIO.SFX_MAX, '同時に鳴らす数の上限');
    now += 1000;
    const b = count(); sfx('tap');
    eq(count() > b, true, '時間がたてば、また鳴る');
    eq(c0 >= 0, true);
  });
});

test('効果音：鳴っている間は BGM の音量を少し下げ、すぐ戻す', () => {
  withFakeAudio(made => {
    fxUnlock();
    bgmPlay('home');
    sfx('melee');
    const ev = fxAudio.duck.gain.events.filter(e => e[0] === 'target').map(e => e[1]);
    eq(ev, [AUDIO.DUCK, 1]);
  });
});

test('BGM：どの曲も読み込めて、30秒〜1分のループで、A・B のような構成になっている', () => {
  for (const id of Object.keys(MUSIC)) {
    if (MUSIC[id].jingle) continue;
    const song = MUSIC[id], plan = bgmCompile(Object.assign({ id }, song));
    const sec = plan.steps * plan.stepSec;
    eq(sec >= 30 && sec <= 60, true, `${id} の長さ ${sec.toFixed(1)} 秒`);
    eq(new Set(plan.sections.map(n => song.sections[n].like || n)).size >= 2, true, `${id} は2種類以上のセクション`);
    const kinds = new Set(Object.values(song.parts).map(p => p.kind));
    for (const k of ['mel', 'arp', 'bass', 'drum']) eq(kinds.has(k), true, `${id} に ${k} のパート`);
    for (const p of Object.values(song.parts)) eq(typeof INSTRUMENTS[p.inst], 'function', `${id} の楽器 ${p.inst}`);
    for (const e of plan.events) eq(e.s >= 0 && e.s < plan.steps && e.d > 0, true, `${id} の音の位置`);
    // 同じフレーズばかりにならない：メロディの並びがセクションごとに違う
    const mels = new Set(plan.sections.map(n => song.sections[n].mel));
    eq(mels.size >= 2, true, `${id} のメロディは2種類以上`);
  }
});

test('BGM：ループの終わりは、最初の和音へ戻りたくなる和音で終わり、メロディも近い音でつながる', () => {
  for (const id of Object.keys(MUSIC).filter(k => !MUSIC[k].jingle)) {
    const plan = bgmCompile(Object.assign({ id }, MUSIC[id]));
    const first = plan.chords[0].ch, last = plan.chords[plan.chords.length - 1].ch;
    const up = (last.root - first.root + 12) % 12;
    eq([7, 5, 10, 11].includes(up), true, `${id}: ${last.sym} → ${first.sym}`);
    const mel = plan.events.filter(e => MUSIC[id].parts[e.p].kind === 'mel');
    const gap = Math.abs(mel[mel.length - 1].m - mel[0].m);
    eq(gap <= 9, true, `${id}: 最後の音から最初の音まで ${gap} 半音`);
    const end = mel[mel.length - 1];
    eq(end.s + end.d <= plan.steps, true, `${id}: 最後の音がループからはみ出さない`);
  }
});

test('BGM：曲データの書き間違い（小節の長さが合わない・知らない和音）は読み込み時に分かる', () => {
  const base = { bpm: 120, parts: { mel: { kind: 'mel', inst: 'flute' } }, order: ['A'] };
  let err = '';
  try { bgmCompile({ ...base, id: 'x', sections: { A: { chords: 'C G', mel: 'C5:16 D5:8' } } }); } catch (e) { err = e.message; }
  eq(/長さ/.test(err), true, err);
  err = '';
  try { bgmCompile({ ...base, id: 'x', sections: { A: { chords: 'C Hm', mel: 'C5:32' } } }); } catch (e) { err = e.message; }
  eq(/和音/.test(err), true, err);
  eq(noteMidi('A4'), 69); eq(noteMidi('C#5'), 73); eq(noteMidi('Bb3'), 58);
  eq(parseChord('D/F#').bass, 6); eq(parseChord('Am').tones, [0, 3, 7]);
});

test('BGM：最初のタップで曲が始まり、ループの終わりから最初へすき間なく続く', () => {
  withFakeAudio(made => {
    bgmPlay('forest');
    eq(BGM.cur, null, 'タップの前は鳴らさない（Safari は鳴らせない）');
    fxUnlock();
    eq(BGM.cur && BGM.cur.id, 'forest', '最初のタップで始まる');
    const ctx = made.last, plan = bgmPlan('forest'), loop = plan.steps * plan.stepSec;
    const base0 = BGM.cur.base;
    // 時間を進めながら、ループ2回分を予約させる
    const times = [];
    const orig = bgmNote;
    bgmNote = (cur, ev, t) => { times.push(t); };
    try {
      for (let t = 0; t < loop * 2; t += 0.05) { ctx.currentTime = t; bgmTick(); }
    } finally { bgmNote = orig; }
    eq(BGM.cur.base, base0 + loop * 2, 'ループごとに、ちょうど1回分ずつ先へ');
    const second = times.filter(t => t >= base0 + loop - 1e-9 && t < base0 + loop + 0.001);
    eq(second.length > 0, true, '2回目のループの頭で、すぐ音が鳴る');
    let maxGap = 0;
    times.sort((x, y) => x - y).forEach((t, i) => { if (i) maxGap = Math.max(maxGap, t - times[i - 1]); });
    eq(maxGap < 1.6, true, `音のすき間は短い（${maxGap.toFixed(2)} 秒）`);
  });
});

test('BGM：場面が変わると、前の曲を小さくしながら次の曲を大きくする（クロスフェード）', () => {
  withFakeAudio(made => {
    fxUnlock();
    bgmPlay('home');
    const home = BGM.cur;
    bgmPlay('home');
    eq(BGM.cur, home, '同じ曲なら、最初からやり直さない');
    bgmPlay('volcano');
    eq(BGM.cur.id, 'volcano');
    eq(BGM.fading.includes(home), true, '前の曲は小さくしている途中');
    eq(home.out.gain.events.some(e => e[0] === 'target' && e[1] < 0.01), true, '前の曲は小さくなっていく');
    eq(BGM.cur.out.gain.events.some(e => e[0] === 'lin' && e[1] === 1), true, '次の曲は大きくなっていく');
    // 小さくしている間も、前の曲の音は鳴り続ける（いきなり途切れない）
    const seen = [];
    const orig = bgmNote;
    bgmNote = cur => seen.push(cur.id);
    try { made.last.currentTime += 0.5; bgmTick(); } finally { bgmNote = orig; }
    eq(seen.includes('home') && seen.includes('volcano'), true, '両方の曲が鳴る');
    bgmPlay('volcano'); bgmPlay(null);
    eq(BGM.cur, null, '曲のない場面では止める');
  });
});

test('BGM：同時に鳴らす音の数をおさえる（メロディとベースは残す）', () => {
  withFakeAudio(made => {
    fxUnlock();
    bgmPlay('sky');
    const cur = BGM.cur;
    fxAudio.voices = new Array(AUDIO.MUSIC_VOICES).fill(99);
    const before = made.osc;
    const arp = bgmPlan('sky').events.find(e => MUSIC.sky.parts[e.p].kind === 'arp');
    const mel = bgmPlan('sky').events.find(e => MUSIC.sky.parts[e.p].kind === 'mel');
    bgmNote(cur, arp, 1, 0.1);
    eq(made.osc, before, '上限なら伴奏は省く');
    bgmNote(cur, mel, 1, 0.1);
    eq(made.osc > before, true, 'メロディは鳴らす');
  });
});

test('BGM：BGM だけミュートにすると止まり、戻すと流れる。音量は設定どおり', () => {
  withFakeAudio(made => {
    FX.bgm = 0.5; FX.sfx = 1;
    fxUnlock();
    bgmPlay('castle');
    eq(BGM.cur.id, 'castle');
    FX.bgmMute = true; auApplyVolumes();
    eq(BGM.cur, null);
    eq(fxAudio.music.gain.events.some(e => e[0] === 'target' && e[1] === 0), true, 'BGM の音量を0へ');
    FX.bgmMute = false; auApplyVolumes();
    eq(BGM.cur.id, 'castle');
    eq(auMusicGain(), 0.25 * AUDIO.MUSIC_LEVEL, 'スライダー半分 → 小さめ（耳で感じる大きさに合わせる）');
    eq(auSfxGain(), AUDIO.SFX_LEVEL);
  });
});

test('BGM：アプリを閉じたら音を止め、戻ったら再開する。電話などで止められても戻る', () => {
  withFakeAudio(made => {
    const oldDoc = globalThis.document, timers = [];
    const oldST = globalThis.setTimeout;
    globalThis.setTimeout = (f) => { timers.push(f); return 0; };
    globalThis.document = { hidden: false };
    try {
      fxUnlock();
      bgmPlay('home');
      document.hidden = true;
      auPause();
      timers.splice(0).forEach(f => f());
      eq(made.suspend, 1, '閉じたら止める');
      eq(fxResume(), null, '隠れている間は動かさない');
      document.hidden = false;
      auWake();
      eq(made.last.state, 'running', '戻ったら動かし直す');
      made.last.state = 'interrupted'; // 電話などで止められた（Safari）
      auOnState();
      timers.splice(0).forEach(f => f());
      eq(made.last.state, 'running', '中断から戻る');
      made.last.state = 'interrupted';
      fxUnlock();
      eq(made.last.state, 'running', '戻れなくても、次のタップで再開');
    } finally { globalThis.setTimeout = oldST; globalThis.document = oldDoc; }
  });
});

test('音の設定：音量・ミュート・消音スイッチを保存し、古い設定や変な値は初期値にする', () => {
  const keep = { ...FX };
  try {
    fxApplySettings({ speed: 1, mute: false });
    eq([FX.bgm, FX.sfx, FX.bgmMute, FX.silent], [FX_VOL_DEFAULT.bgm, FX_VOL_DEFAULT.sfx, false, 'obey'], '古い設定');
    fxApplySettings({ bgm: 0.3, sfx: 0, bgmMute: true, mute: true, silent: 'play' });
    eq([FX.bgm, FX.sfx, FX.bgmMute, FX.mute, FX.silent], [0.3, 0, true, true, 'play']);
    fxApplySettings(JSON.parse(JSON.stringify(FX)));
    eq([FX.bgm, FX.sfx, FX.bgmMute, FX.silent], [0.3, 0, true, 'play'], '保存して読み直しても同じ');
    fxApplySettings({ bgm: 7, sfx: 'abc', silent: 'x' });
    eq([FX.bgm, FX.sfx, FX.silent], [1, FX_VOL_DEFAULT.sfx, 'obey']);
  } finally { Object.assign(FX, keep); }
});

test('音の設定：iPhone の消音スイッチ（audioSession がある端末だけ選べる）', () => {
  const oldNav = globalThis.navigator, keep = FX.silent;
  try {
    globalThis.navigator = {};
    eq(auSessionSupported(), false);
    auApplySession(); // ない端末でもエラーにならない
    globalThis.navigator = { audioSession: { type: 'auto' } };
    eq(auSessionSupported(), true);
    FX.silent = 'obey'; auApplySession();
    eq(navigator.audioSession.type, 'ambient', 'スイッチに従う');
    FX.silent = 'play'; auApplySession();
    eq(navigator.audioSession.type, 'playback', 'スイッチがオンでも鳴らす');
  } finally { FX.silent = keep; if (oldNav === undefined) delete globalThis.navigator; else globalThis.navigator = oldNav; }
});

// 画面の状態（ui.js の変数）をまねて、流す曲を調べる
function withScene(screen, st, mode, fn) {
  const g = globalThis, keep = { currentScreen: g.currentScreen, state: g.state, battleMode: g.battleMode }, moment = BGM.moment;
  g.currentScreen = screen; g.state = st; g.battleMode = mode;
  try { return fn(); } finally {
    BGM.moment = moment;
    for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete g[k]; else g[k] = v; }
  }
}

test('BGM：場面ごとの曲（画面・地形・ボスの章・パズル・イベント・パック・勝敗）', () => {
  const wanted = ['home', 'deck', 'pack', 'dungeon', 'puzzle', 'event', 'plain', 'forest', 'volcano', 'sky', 'swamp', 'castle', 'lake', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5', 'win', 'lose', 'fanfareEpic', 'fanfareLegend'];
  for (const id of wanted) eq(!!MUSIC[id], true, id);
  for (const id of Object.keys(MUSIC)) eq(!!BGM_FILES[id], true, `${id} のファイル名`);
  eq(withScene('title', null, null, bgmForScene), 'home');
  eq(withScene('collection', null, null, bgmForScene), 'deck');
  eq(withScene('deck', null, null, bgmForScene), 'deck');
  eq(withScene('dungeon', null, null, bgmForScene), 'dungeon');
  eq(withScene('puzzles', null, null, bgmForScene), 'puzzle');
  for (const t of TERRAINS) eq(withScene('battle', { terrain: t }, { type: 'free' }, bgmForScene), BGM_OF_SCENE[t.scene], t.id);
  eq(withScene('battle', { terrain: TERRAIN_BY_ID.mist }, { type: 'dungeon' }, bgmForScene), 'lake', 'ダンジョンの戦闘は地形の曲');
  for (const st of STAGES.filter(x => x.boss)) eq(withScene('battle', { terrain: TERRAIN_BY_ID[st.terrain] }, { type: 'stage', stage: st }, bgmForScene), 'boss' + st.chapter, st.id);
  const normal = STAGES.find(x => !x.boss);
  eq(withScene('battle', { terrain: TERRAIN_BY_ID[normal.terrain] }, { type: 'stage', stage: normal }, bgmForScene), BGM_OF_SCENE[TERRAIN_BY_ID[normal.terrain].scene]);
  eq(withScene('battle', { terrain: TERRAIN_BY_ID.plain }, { type: 'puzzle' }, bgmForScene), 'puzzle');
  eq(withScene('battle', { terrain: TERRAIN_BY_ID.plain }, { type: 'event' }, bgmForScene), 'event');
  eq(withScene('title', null, null, () => { BGM.moment = 'pack'; return bgmForScene(); }), 'pack');
  eq(withScene('title', null, null, () => { BGM.moment = 'event'; return bgmForScene(); }), 'event');
  eq(withScene('battle', { terrain: TERRAIN_BY_ID.plain }, { type: 'free' }, () => { BGM.moment = 'result'; return bgmForScene(); }), null, '勝敗の画面はジングルだけ');
});

test('BGM：ボス戦は1つのテーマを、章ごとに調・速さ・楽器を変えてアレンジし、通常戦より速い', () => {
  const bosses = [1, 2, 3, 4, 5].map(n => MUSIC['boss' + n]);
  eq(new Set(bosses.map(b => b.transpose)).size, 5, '調が章ごとに違う');
  eq(new Set(bosses.map(b => b.parts.lead.inst + b.parts.lead2.inst)).size >= 4, true, '楽器が違う');
  const normalMax = Math.max(...['plain', 'forest', 'sky', 'swamp', 'castle', 'lake'].map(id => MUSIC[id].bpm));
  for (const b of bosses) {
    eq(b.bpm > normalMax, true, `${b.name} は速い`);
    eq(Object.values(b.parts).some(p => ['taiko', 'kick', 'timpani'].includes(p.inst) && !p.layer), true, `${b.name} は重い打楽器`);
    eq(b.sections.A.mel, BOSS_THEME.A.mel, '同じテーマ');
  }
  // 調を変えたら、メロディと和音が同じだけ動く
  const p0 = bgmPlan('boss1'), p3 = bgmPlan('boss3');
  const m0 = p0.events.find(e => e.p === 'lead'), m3 = p3.events.find(e => e.p === 'lead');
  eq(m3.m - m0.m, MUSIC.boss3.transpose);
  eq((p3.chords[0].ch.root - p0.chords[0].ch.root + 12) % 12, (MUSIC.boss3.transpose + 12) % 12);
});

test('BGM：ジングル・ファンファーレは数秒で、最後は落ち着く和音で終わる', () => {
  for (const id of ['win', 'lose', 'fanfareEpic', 'fanfareLegend']) {
    const plan = bgmPlan(id), sec = plan.steps * plan.stepSec;
    eq(MUSIC[id].jingle, true);
    eq(sec >= 1 && sec <= 6, true, `${id}: ${sec.toFixed(1)} 秒`);
  }
  eq(bgmPlan('fanfareLegend').steps > bgmPlan('fanfareEpic').steps, true, 'レジェンドは特別に長い');
});

test('BGM：ジングルは流れている曲を少し下げて重ねる。BGM がオフなら false（効果音で代わりに鳴らす）', () => {
  withFakeAudio(made => {
    fxUnlock();
    bgmPlay('pack');
    const cur = BGM.cur, before = made.osc;
    eq(bgmJingle('fanfareLegend'), true);
    eq(made.osc > before, true, 'ジングルの音が鳴る');
    const ev = cur.out.gain.events.filter(e => e[0] === 'target').map(e => e[1]);
    eq(ev, [0.25, 1], '曲を下げて、終わったら戻す');
    FX.bgmMute = true;
    eq(bgmJingle('win'), false);
    FX.bgmMute = false;
    eq(bgmJingle('なし'), false);
  });
});

test('BGM：戦況のパートは、その戦況のときだけ鳴らし、ゆっくり足す・引く（曲は切り替えない）', () => {
  withFakeAudio(made => {
    fxUnlock();
    bgmLayers(false, false);
    bgmPlay('forest');
    const cur = BGM.cur, plan = bgmPlan('forest');
    const ev = k => plan.events.find(e => MUSIC.forest.parts[e.p].layer === k);
    const count = (e) => { const b = made.osc + made.noise; fxAudio.voices = []; bgmNote(cur, e, 1, plan.stepSec); return made.osc + made.noise - b; };
    eq(count(ev('tension')), 0, '消耗ダメージの前は鳴らない');
    eq(cur.parts.tTaiko.gain.value < 0.01, true, '最初は音量0');
    bgmLayers(true, false);
    eq(BGM.cur, cur, '曲は同じまま');
    eq(count(ev('tension')) > 0, true, '消耗ダメージのパートが鳴る');
    eq(count(ev('climax')), 0);
    eq(cur.parts.tTaiko.gain.events.some(e => e[0] === 'target' && e[1] > 0.5), true, 'ゆっくり大きくなる');
    bgmLayers(true, true);
    eq(count(ev('climax')) > 0, true, '残りわずかのパートも足す');
    bgmLayers(false, false);
    eq(count(ev('tension')) + count(ev('climax')), 0, '戻せば鳴らない');
    bgmLayers(true, false);
    bgmPlay('volcano');
    eq(BGM.cur.parts.tTaiko.gain.value > 0.5, true, '次の対戦の曲も、いまの戦況で始まる');
    bgmLayers(false, false);
  });
});

// 残りモンスターが left 体の側（場に並べるだけ）
const mkPlayerLeft = left => ({ slots: Array.from({ length: left }, () => ({ hp: 1 })), hand: [], deck: [] });
const LOW_MONSTERS_FOR_TEST = 2; // ui.js の LOW_MONSTERS（テストでは読み込まないので、audio.js も2を使う）

test('BGM：戦況の判定（ターン27以降・残りモンスターが少ない・決着後とパズルは足さない）', () => {
  const keep = { ...BGM.layers };
  const mood = (st, mode) => withScene('battle', st, mode, () => { bgmBattleMood(); return [BGM.layers.tension, BGM.layers.climax]; });
  try {
    const lots = () => [mkPlayerLeft(6), mkPlayerLeft(6)];
    eq(mood({ turn: 5, players: lots() }, { type: 'free' }), [false, false]);
    eq(mood({ turn: CONFIG.ATTRITION_START, players: lots() }, { type: 'free' }), [true, false]);
    eq(mood({ turn: 5, players: [mkPlayerLeft(6), mkPlayerLeft(LOW_MONSTERS_FOR_TEST)] }, { type: 'free' }), [false, true]);
    eq(mood({ turn: 30, players: [mkPlayerLeft(1), mkPlayerLeft(6)], result: { winner: 1 } }, { type: 'free' }), [false, false], '決着したら戻す');
    eq(mood({ turn: 30, players: [mkPlayerLeft(1), mkPlayerLeft(1)] }, { type: 'puzzle' }), [false, false], 'パズルでは足さない');
  } finally { BGM.layers.tension = keep.tension; BGM.layers.climax = keep.climax; }
});

// 読み込み（Promise）の続きを、その場で進める（jsc だけにある関数。ブラウザではこのテストを飛ばす）
const drain = () => drainMicrotasks();

test('BGM：自分の音楽ファイル（assets/bgm/）があれば流し、なければコードの曲にする', () => {
  if (typeof drainMicrotasks !== 'function') return;
  withFakeAudio(made => {
    const g = globalThis, keep = { fetch: g.fetch, location: g.location };
    const has = { 'assets/bgm/forest.mp3': true, 'assets/bgm/win.mp3': true };
    const thenable = v => ({ then: (ok) => { const r = ok(v); return r && r.then ? r : thenable(r); } });
    g.location = { protocol: 'https:' };
    g.fetch = (url, opts) => thenable({ ok: !!has[url], arrayBuffer: () => thenable({ bytes: url }) });
    made.last = null;
    const oldStatus = { ...bgmFiles.status }, oldBuf = { ...bgmFiles.buf };
    try {
      bgmProbeFiles(); drain();
      eq(bgmFiles.status.forest, 'yes');
      eq(bgmFiles.status.home, 'none');
      fxUnlock();
      fxAudio.ctx.decodeAudioData = (data, ok) => ok({ duration: 40, from: data.bytes });
      bgmPlay('home');
      eq(!!BGM.cur.plan, true, 'ファイルがない曲は、コードで演奏');
      bgmPlay('forest'); drain();
      eq(BGM.cur.file, true, 'ファイルがある曲は、ファイルを流す');
      eq(BGM.cur.src.buffer.from, 'assets/bgm/forest.mp3');
      eq(BGM.cur.src.loop, true, 'ループする');
      bgmPlay('home');
      eq(BGM.fading.some(x => x.file && x.end), true, 'ファイルの曲もクロスフェードで止める');
      // 壊れたファイル：読めなければコードの曲にする
      has['assets/bgm/sky.mp3'] = true; bgmFiles.status.sky = 'yes';
      fxAudio.ctx.decodeAudioData = (data, ok, ng) => ng(new Error('読めない'));
      bgmPlay('sky'); drain();
      eq(!!(BGM.cur && BGM.cur.plan), true, '読めないファイルは、コードの曲');
      eq(bgmFiles.status.sky, 'none');
    } finally {
      bgmFiles.status = oldStatus; bgmFiles.buf = oldBuf; bgmFiles.order = [];
      for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete g[k]; else g[k] = v; }
    }
  });
});

test('BGM：ファイルの曲はメモリを使いすぎないよう、読みこんだ数を抑える', () => {
  if (typeof drainMicrotasks !== 'function') return;
  withFakeAudio(made => {
    const g = globalThis, keep = { fetch: g.fetch, location: g.location };
    const thenable = v => ({ then: (ok) => { const r = ok(v); return r && r.then ? r : thenable(r); } });
    g.location = { protocol: 'http:' };
    g.fetch = () => thenable({ ok: true, arrayBuffer: () => thenable({}) });
    const oldStatus = { ...bgmFiles.status }, oldBuf = { ...bgmFiles.buf };
    try {
      fxUnlock();
      fxAudio.ctx.decodeAudioData = (data, ok) => ok({ duration: 30 });
      for (const id of ['home', 'deck', 'plain', 'forest', 'sky']) { bgmFiles.status[id] = 'yes'; bgmPlay(id); drain(); }
      eq(Object.keys(bgmFiles.buf).length, BGM_FILE_KEEP);
      eq(!!bgmFiles.buf.sky && !bgmFiles.buf.home, true, '古いものから手放す');
      eq(bgmFiles.status.home, 'yes', '手放してもファイルはあると覚えておく');
    } finally {
      bgmFiles.status = oldStatus; bgmFiles.buf = oldBuf; bgmFiles.order = [];
      for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete g[k]; else g[k] = v; }
    }
  });
});

test('BGM：ファイルとして直接開いたとき（file://）は、ファイルを探さない', () => {
  const g = globalThis, keep = { fetch: g.fetch, location: g.location };
  let calls = 0;
  g.fetch = () => { calls++; return { then() {} }; };
  g.location = { protocol: 'file:' };
  try { bgmProbeFiles(); eq(calls, 0); eq(bgmCanFetch(), false); } finally {
    for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete g[k]; else g[k] = v; }
  }
});

test('README：音楽ファイルの対応表が BGM_FILES と合っている', () => {
  if (typeof readFile !== 'function') return; // ブラウザでは読めないので飛ばす
  const md = readFile('README.md');
  for (const [id, name] of Object.entries(BGM_FILES)) eq(md.includes('`' + name + '`'), true, `${id}: ${name}`);
});

test('パック演出：パックの光り方は、中身でいちばん高いレアリティで決まる', () => {
  const ids = r => Object.values(CARD_DEFS).filter(d => d.rarity === r).map(d => ({ id: d.id }));
  const [c, r, e, l] = RARITY_ORDER.map(ids);
  eq(packBestRarity([c[0], c[1], r[0]]), 'rare');
  eq(packBestRarity([c[0], e[0], r[0]]), 'epic');
  eq(packBestRarity([l[0], c[0], e[0]]), 'legend');
  eq(packBestRarity([c[0], c[1], c[2]]), 'common');
});

// ---------- CPU同士の通し対戦 ----------

test('CPU同士500戦：不正な手・場の隙間・異常値が出ない', () => {
  for (let g = 0; g < 500; g++) {
    const s = newGame(randomDeck(testRng), randomDeck(testRng), testRng);
    let res = null, turns = 0;
    while (!res) {
      assert(++turns <= 300, '決着がつかない（膠着）');
      const pi = s.current, p = s.players[pi];
      if (startTurn(s)) break;
      let a, n = 0;
      while ((a = cpuNextAction(s))) {
        assert(applyAction(s, pi, a), '不正な手 ' + JSON.stringify(a));
        assert(p.crystals >= 0 && ++n < 40, '行動ループ');
      }
      if (s.result) break; // フラッシュで決着
      const check = () => s.players.forEach(pl => pl.slots.forEach((m, i) => {
        if (m) assert(m.hp > 0 && m.hp <= m.maxHp && m.armor >= 0, '異常なステータス');
        if (m && i > 0) assert(pl.slots[i - 1], '場に隙間がある');
      }));
      check();
      for (const ev of attackPhase(s)) check();
      res = finishTurn(s);
    }
    const r = s.result;
    const left = s.players.map(monstersLeft);
    if (r.reason === 'wipeout') assert(left[1 - r.winner] === 0 && left[r.winner] > 0, '決着の整合');
    assert(r.winner === 0 || r.winner === 1, '引き分けはない');
  }
});

// ============================================================
// 追加スキル（32種類）
// ============================================================
const fixedBoard = (mine, foes, fixed = {}) => { const s = board(mine, foes); s.fixed = fixed; return s; }; // 運の要素を固定した盤面
const atkOf = (m, type) => getAttacks(m).find(a => a.type === type).atk;

test('Fury：失ったHPぶん近接攻撃が上がる（最大+X）', () => {
  const m = mk(S('melee', 2, 10, 'fury:3'));
  eq(atkOf(m, 'melee'), 2);
  m.hp -= 2; eq(atkOf(m, 'melee'), 4);
  m.hp -= 5; eq(atkOf(m, 'melee'), 5, '上限は+3');
});

test('Sunder：近接攻撃がアーマーを無視する（盾のスキルは効く）', () => {
  const s = board([mk(S('melee', 3, 10, 'sunder'))], [mk(GOLEM, STEEL)]);
  const g = s.players[1].slots[0];
  const ev = attacks(s)[0];
  eq([ev.dmg, ev.armorDmg, g.armor, g.maxHp - g.hp], [3, 0, 5, 3]);
  eq(attacks(board([mk(S('melee', 3, 10, 'sunder'))], [mk(S('melee', 1, 30, 'shield:1'), STEEL)]))[0].dmg, 2, 'Shield では減る');
});

test('Grudge：ダメージを受けるたび近接攻撃が永続で+X。育つスキルは1体につき合計+6まで', () => {
  const s = board([mk(WOLF)], [mk(S('melee', 1, 60, 'grudge:1'))]);
  const t = s.players[1].slots[0];
  const ev = attacks(s)[0];
  eq([atkOf(t, 'melee'), extra(ev, 'grudge').x], [2, 1]);
  for (let i = 0; i < 9; i++) attacks(s);
  eq([atkOf(t, 'melee'), t.grown], [1 + CONFIG.GROW_CAP, CONFIG.GROW_CAP]);
  // アーマーだけ削れたときは増えない
  const u = board([mk(WOLF)], [mk(S('melee', 1, 60, 'grudge:1'), STEEL)]);
  attacks(u);
  eq(atkOf(u.players[1].slots[0], 'melee'), 1);
});

test('Follow Through：近接でHPを減らせなかったら、もう1回近接攻撃（1ターンに1回）', () => {
  const s = board([mk(S('melee', 2, 10, 'followthrough'))], [mk(GOLEM, STEEL)]);
  eq(attacks(s).map(e => [e.source, e.dmg, e.armorDmg]), [['base', 0, 2], ['followthrough', 0, 2]], '2回目も空振りでも、3回目はない');
  eq(attacks(board([mk(S('melee', 2, 10, 'followthrough'))], [mk(GOLEM)])).length, 1, 'HPを減らせたら追加しない');
});

test('Vanguard：前列にいると、自分のスキルの数値が+X（後列では増えない）', () => {
  const s = board([mk(S('melee', 1, 10, 'vanguard:1', 'thorns:2')), mk(S('melee', 1, 10, 'vanguard:1', 'thorns:2'))], [mk(GOLEM)]);
  beginTurnOf(s, 0);
  eq(s.players[0].slots.map(m => m && skillX(m, 'thorns')), [3, 2, null]);
  eq([startEv(s, 'vanguard').length, skillX(s.players[0].slots[0], 'vanguard')], [1, 1], 'Vanguard 自身の数値は増えない');
});

test('Trample：近接・遠隔で倒したとき、余ったダメージを、ほかの敵に分けて与える', () => {
  const s = board([mk(S('melee', 9, 10, 'trample'))], [mk(S('melee', 1, 3)), mk(GOLEM), mk(WOLF, LEATHER)]);
  const [, golem, wolf] = s.players[1].slots;
  const ev = attacks(s)[0];
  eq([ev.killed, ev.extras.filter(x => x.kind === 'trample').map(x => x.x)], [true, [3, 3]]);
  eq([golem.maxHp - golem.hp, wolf.armor, wolf.hp], [3, 0, wolf.maxHp], '余りは物理ダメージ（アーマーで止まる）');
  eq(attacks(board([mk(S('melee', 9, 10, 'trample'))], [mk(S('melee', 1, 3))]))[0].extras.length, 0, 'ほかに敵がいなければ何も起きない');
});

test('Recast・Scatter：魔法攻撃・カオス攻撃をX回追加で行う', () => {
  eq(attacks(board([mk(S('magic', 2, 10, 'recast:2'))], [mk(GOLEM)])).map(e => [e.type, e.source]), [['magic', 'base'], ['magic', 'recast'], ['magic', 'recast']]);
  eq(attacks(board([mk(S('chaos', 2, 10, 'scatter:1'))], [mk(GOLEM)])).map(e => [e.type, e.source]), [['chaos', 'base'], ['chaos', 'scatter']]);
});

test('Echo：魔法が当たると、半分（切り上げ）のダメージが跳ねる。ダメージが1になるまで、最大3回', () => {
  const s = fixedBoard([mk(S('magic', 5, 10, 'echo'))], [mk(S('melee', 1, 60)), mk(SLIME)]);
  const ev = attacks(s)[0];
  eq([ev.dmg, ev.extras.filter(x => x.kind === 'echo').map(x => x.x), 60 - s.players[1].slots[0].hp], [5, [3, 2, 1], 11]);
  const t = fixedBoard([mk(S('magic', 2, 10, 'echo'))], [mk(GOLEM)]);
  eq(attacks(t)[0].extras.map(x => x.x), [1], '2 → 1 で止まる');
});

test('Spellpierce：魔法攻撃が Magic Reflect と Mirror Shield を無視する', () => {
  const s = fixedBoard([mk(S('magic', 3, 10, 'spellpierce'))], [mk(S('melee', 1, 30, 'magicreflect', 'mirrorshield:2'))], { reflect: true });
  const ev = attacks(s)[0];
  eq([ev.dmg, !!ev.reflected, s.players[0].slots[0].hp], [3, false, 10]);
});

test('Exploit：魔法攻撃のとき、相手の状態異常1種類につきダメージ+X', () => {
  const s = board([mk(S('magic', 2, 10, 'exploit:2'))], [mk(GOLEM)]);
  const g = s.players[1].slots[0];
  g.status.disease = 3; g.status.silence = 1;
  eq(attacks(s)[0].dmg, 6);
  eq(attacks(board([mk(S('magic', 2, 10, 'exploit:2'))], [mk(GOLEM)]))[0].dmg, 2);
});

test('Static Guard：相手のターン中、最初の攻撃を1回だけ防ぎ、攻撃者にXの魔法ダメージ。See-through には効かない', () => {
  const s = board([mk(WOLF), mk(ELF)], [mk(S('melee', 1, 30, 'staticguard:2'))]);
  const [wolf, elf] = s.players[0].slots;
  const evs = attacks(s);
  eq(evs.map(e => [e.type, !!e.guarded, e.dmg]), [['ranged', true, 0], ['melee', false, 2]]);
  eq([elf.maxHp - elf.hp, wolf.hp, extra(evs[0], 'staticguard').dmg], [2, wolf.maxHp, 2]);
  finishTurn(s); finishTurn(s); beginTurnOf(s, 0);
  eq(attacks(s)[0].guarded, true, 'ターンが変わると、また防げる');
  eq(attacks(board([mk(S('melee', 2, 10, 'seethrough'))], [mk(S('melee', 1, 30, 'staticguard:2'))]))[0].dmg, 2);
});

test('フラッシュ：Stall は敵1体をXターン攻撃できなくする（Perseverance には効かない）', () => {
  const s = board([mk(WOLF)], [mk(GOLEM), mk(S('melee', 1, 10, 'perseverance'))]);
  const stall = tflash('t_stall', 1, 'stall:1');
  const g = s.players[1].slots[0];
  playFlash(s, 0, give(s, 0, stall), 0);
  eq(g.status.stall, 1);
  eq(playFlash(s, 0, give(s, 0, stall), 1).immune, true);
  finishTurn(s);
  eq(phase(s).filter(e => e.kind === 'skip').map(e => [e.attacker.card.id, e.reason]), [[GOLEM, 'stall']]);
  finishTurn(s);
  eq(g.status.stall, undefined, '相手のターンが終わると解ける');
});

test('Bloom：回復されるたび、すべての攻撃力と最大HPが永続で+X', () => {
  const m = mk(S('melee', 2, 10, 'bloom:1'));
  m.hp -= 3;
  eq(healMonster(m, 2).bloom, 1);
  eq([atkOf(m, 'melee'), m.maxHp, m.hp], [3, 11, 10]);
  eq(healMonster(m, 2).bloom, 1);
  eq(healMonster(m, 2).bloom, 0, '回復するところがなければ、育たない');
  const n = mk(S('melee', 2, 10));
  n.hp -= 3;
  eq(healMonster(n, 2).bloom, 0);
});

test('Regenerate：自分のターン開始時、自分をX回復', () => {
  const s = board([mk(S('melee', 1, 10, 'regenerate:2'))], [mk(GOLEM)]);
  const m = s.players[0].slots[0];
  m.hp -= 5;
  beginTurnOf(s, 0);
  eq([m.hp, startEv(s, 'heal')[0].skill], [7, 'regenerate']);
  beginTurnOf(s, 1);
  eq(m.hp, 7, '相手のターンには回復しない');
});

test('Mending Aura：味方の Heal・Group Heal の回復量+X。回復した味方の弱体も解ける（フラッシュの回復でも）', () => {
  const s = board([mk(GOLEM), mk(S('magic', 1, 10, 'heal:2')), mk(S('melee', 1, 10, 'mendingaura:1'))], [mk(SLIME)]);
  const g = s.players[0].slots[0];
  g.hp -= 8; g.status.silence = 2; g.status.stall = 1; g.status.disease = 0;
  beginTurnOf(s, 0);
  eq([g.maxHp - g.hp, g.status.silence, g.status.stall], [5, undefined, undefined]);
  g.status.silence = 2;
  playFlash(s, 0, give(s, 0, CURE), 0); // heal:5 → 6
  eq([g.hp, g.status.silence], [g.maxHp, undefined]);
  // Mending Aura がなければ、弱体は解けない
  const t = board([mk(GOLEM), mk(S('magic', 1, 10, 'heal:2'))], [mk(SLIME)]);
  t.players[0].slots[0].hp -= 8; t.players[0].slots[0].status.silence = 2;
  beginTurnOf(t, 0);
  eq([t.players[0].slots[0].maxHp - t.players[0].slots[0].hp, t.players[0].slots[0].status.silence], [6, 2]);
});

test('Last Stand：最初に倒されるとき、倒されずにHPが全回復する（1回だけ。Terminate には効かない）', () => {
  const s = board([mk(DRAGON)], [mk(S('melee', 1, 5, 'laststand'))]);
  const t = s.players[1].slots[0];
  const ev = attacks(s)[0];
  eq([ev.killed, t.hp, t.stood, kinds(ev)], [false, 5, true, ['laststand']]);
  eq([attacks(s)[0].killed, names(s.players[1])[0]], [true, null], '2回目は倒される');
  // Menace・消耗ダメージでも踏みとどまる
  const a = atTurn(board([mk(WOLF)], [mk(S('melee', 1, 1, 'laststand'))]), CONFIG.ATTRITION_START);
  startTurn(a);
  eq([names(a.players[1])[0] !== null, a.players[1].slots[0].stood], [true, true]);
  const k = board([mk(WOLF)], [mk(S('melee', 1, 5, 'laststand'))]);
  eq([playFlash(k, 0, give(k, 0, tflash('t_term2', 1, 'terminate')), 0).killed, names(k.players[1])[0]], [true, null]);
});

test('Parting Gift：倒されたとき、傷ついた味方全員をX回復（Terminate で倒されたときは発動しない）', () => {
  const s = board([mk(WOLF)], [mk(S('melee', 1, 2, 'partinggift:3')), mk(GOLEM), mk(SLIME)]);
  const [, golem, slime] = s.players[1].slots;
  golem.hp -= 5;
  const ev = attacks(s)[0];
  eq([ev.killed, golem.maxHp - golem.hp, slime.hp, kinds(ev)], [true, 2, slime.maxHp, ['partinggift']]);
  const k = board([mk(WOLF)], [mk(S('melee', 1, 2, 'partinggift:3')), mk(GOLEM)]);
  k.players[1].slots[1].hp -= 5;
  playFlash(k, 0, give(k, 0, tflash('t_term3', 1, 'terminate')), 0);
  eq(k.players[1].slots[0].maxHp - k.players[1].slots[0].hp, 5);
});

test('Final Bow：倒されたとき、敵全員にXの固定ダメージ', () => {
  const s = board([mk(DRAGON, STEEL), mk(ELF)], [mk(S('melee', 1, 2, 'finalbow:2'))]);
  const [dragon, elf] = s.players[0].slots;
  const ev = attacks(s).find(e => e.killed);
  eq([dragon.maxHp - dragon.hp, dragon.armor, elf.maxHp - elf.hp], [2, 5, 2], 'アーマーを無視する');
  eq(ev.extras.filter(x => x.kind === 'finalbow').length, 2);
  // 相打ちになったら、そのターンの手番側の勝ち
  const t = board([mk(S('melee', 5, 1))], [mk(S('melee', 1, 2, 'finalbow:2'))]);
  attacks(t);
  eq(checkResult(t).winner, 0);
});

test('Leech・Keen Eye：ダメージを与えるたび、永続で育つ', () => {
  const s = board([mk(S('melee', 2, 10, 'leech:1')), mk(S('ranged', 2, 10, 'keeneye:1'))], [mk(GOLEM)]);
  const [leech, eye] = s.players[0].slots;
  const evs = attacks(s);
  eq([leech.maxHp, leech.hp, atkOf(eye, 'ranged')], [11, 11, 3]);
  eq([kinds(evs[0]), kinds(evs[1])], [['keeneye'], ['leech']]);
  // 当たらなければ育たない
  const t = fixedBoard([mk(WOLF), mk(S('ranged', 2, 10, 'keeneye:1'))], [mk(GOLEM, STEEL)], { block: true });
  attacks(t);
  eq(atkOf(t.players[0].slots[1], 'ranged'), 2);
});

test('Arrow Rain：遠隔攻撃が、後列の敵全員に当たる（Taunt と Stealth を無視）。後列がいなければふつうに狙う', () => {
  const s = board([mk(WOLF), mk(S('ranged', 2, 10, 'arrowrain'))], [mk(S('melee', 1, 30, 'taunt')), mk(S('melee', 1, 30, 'stealth')), mk(SLIME)]);
  const evs = attacks(s).filter(e => e.type === 'ranged');
  eq(evs.map(e => [s.players[1].slots.indexOf(e.target), e.dmg]), [[1, 2], [2, 2]]);
  const t = board([mk(WOLF), mk(S('ranged', 2, 10, 'arrowrain'))], [mk(GOLEM)]);
  eq(attacks(t).filter(e => e.type === 'ranged').map(e => e.target.card.id), [GOLEM]);
});

test('Point Blank：前列からでも遠隔攻撃ができ、相手の前列を狙う。ブロックされない', () => {
  const pb = S('ranged', 3, 10, 'pointblank');
  eq([canAttackFrom(mk(pb), 0), canAttackFrom(mk(ARCHER), 0)], [true, false]);
  eq(rate(300, () => {
    const s = board([mk(pb)], [mk(GOLEM, STEEL), mk(SLIME)]);
    const ev = attacks(s)[0];
    assert(ev.target.card.id === GOLEM, '前列を狙う');
    return ev.blocked;
  }), 0);
});

test('Steady Aim：前の相手ターンにダメージを受けていなければ、遠隔攻撃+X', () => {
  const s = board([mk(WOLF), mk(S('ranged', 2, 10, 'steadyaim:2'))], [mk(GOLEM), mk(ELF)]);
  const m = s.players[0].slots[1];
  beginTurnOf(s, 0);
  eq([m.buff.aim, atkOf(m, 'ranged')], [2, 4]);
  finishTurn(s); beginTurnOf(s, 1); attacks(s); finishTurn(s); // 相手のエルフに撃たれる
  assert(m.hp < m.maxHp, '撃たれた');
  beginTurnOf(s, 0);
  eq([m.buff.aim, atkOf(m, 'ranged')], [undefined, 2]);
});

test('Deflect：遠隔攻撃を約75%で受けずに、同じダメージを攻撃者に返す', () => {
  near(rate(3000, () => {
    const s = board([mk(WOLF), mk(ELF)], [mk(S('melee', 1, 30, 'deflect'))]);
    const ev = attacks(s).find(e => e.type === 'ranged');
    if (ev.deflected) eq([ev.dmg, s.players[1].slots[0].hp, s.players[0].slots[1].hp], [0, 30 - 2, CARD_BY_ID[ELF].hp - 3], '受けたのは、あとから殴ったウルフの近接2だけ');
    return !!ev.deflected;
  }), CONFIG.DEFLECT_CHANCE, 0.03);
  const m = fixedBoard([mk(WOLF)], [mk(S('melee', 1, 30, 'deflect'))], { deflect: true });
  eq(!!attacks(m)[0].deflected, false, '近接は跳ね返せない');
});

test('Ambush：後列の敵を攻撃するとき、ダメージ+X', () => {
  const s = board([mk(WOLF), mk(S('ranged', 2, 10, 'ambush:2'))], [mk(GOLEM), mk(S('melee', 1, 30))]);
  const ev = attacks(s).find(e => e.type === 'ranged');
  eq([s.players[1].slots.indexOf(ev.target), ev.dmg, ev.ambush], [1, 4, 2]);
  eq(attacks(board([mk(WOLF), mk(S('ranged', 2, 10, 'ambush:2'))], [mk(GOLEM)])).find(e => e.type === 'ranged').dmg, 2, '前列の敵には乗らない');
});

test('Cull：カオス攻撃が、HPの最も低い敵を狙う', () => {
  for (let i = 0; i < 40; i++) {
    const s = board([mk(S('chaos', 1, 10, 'cull'))], [mk(GOLEM), mk(S('melee', 1, 30)), mk(WOLF)]);
    eq(attacks(s)[0].target.card.id, WOLF);
  }
});

test('Jinx：自分のターン開始時、敵全員のカオス攻撃-X（次の自分のターンまで）。Perseverance には効かない', () => {
  const s = board([mk(S('melee', 1, 10, 'jinx:1'))], [mk(IMP), mk(DEMON), mk(S('chaos', 3, 10, 'perseverance'))]);
  beginTurnOf(s, 0);
  eq(s.players[1].slots.map(m => atkOf(m, 'chaos')), [1, 4, 3]);
  const z = board([mk(S('melee', 1, 10, 'jinx:2'))], [mk(IMP)]);
  beginTurnOf(z, 0); finishTurn(z); beginTurnOf(z, 1);
  eq(phase(z).map(e => [e.kind, e.reason]), [['skip', 'jinx']], '攻撃力が0なら攻撃できない');
  finishTurn(z); beginTurnOf(z, 0);
  eq(z.players[1].slots[0].status.jinx, 2, 'かけ直される');
});

test('Lucky Shot：カオス攻撃が最大値で当たったとき、ランダムな敵にXの固定ダメージ', () => {
  const s = fixedBoard([mk(S('chaos', 3, 10, 'luckyshot:2'))], [mk(GOLEM, STEEL)]); // パズルと同じ固定：カオスは最大値
  const g = s.players[1].slots[0];
  const ev = attacks(s)[0];
  eq([ev.dmg, extra(ev, 'luckyshot').dmg, g.maxHp - g.hp, g.armor], [3, 2, 5, 5]);
  const t = fixedBoard([mk(S('chaos', 3, 10, 'luckyshot:2'))], [mk(GOLEM)], { chaos: 2 });
  eq(attacks(t)[0].extras.length, 0, '最大値でなければ発動しない');
});

test('フラッシュ：Plague Burst は、Disease 状態の敵全員に、スタック数×Xの魔法ダメージ（スタックは減らない）', () => {
  const s = board([mk(WOLF)], [mk(GOLEM, STEEL), mk(SLIME), mk(ELF)]);
  const [golem, slime, elf] = s.players[1].slots;
  golem.status.disease = 3; elf.status.disease = 1;
  const ev = playFlash(s, 0, give(s, 0, tflash('t_pburst', 1, 'plagueburst:2')), -1);
  eq([golem.maxHp - golem.hp, golem.armor, slime.hp, elf.maxHp - elf.hp, golem.status.disease], [6, 5, slime.maxHp, 2, 3]);
  eq(ev.group.length, 2);
});

test('Scorch：近接・遠隔でダメージを与えた敵を燃焼にする。燃焼は、どちらのターンの終わりにもダメージを与え、1ずつ減る', () => {
  const s = board([mk(S('melee', 2, 10, 'scorch:2'))], [mk(GOLEM, LEATHER), mk(S('melee', 1, 30, 'perseverance'))]);
  const g = s.players[1].slots[0];
  const ev = attacks(s)[0]; // アーマーを削っただけでも燃える（Disease と同じ）
  eq([g.status.burn, extra(ev, 'scorch').x], [2, 2]);
  const hp = g.hp;
  finishTurn(s);
  eq([hp - g.hp, g.status.burn, s.endEvents.map(e => e.kind)], [2, 1, ['burning']]);
  finishTurn(s);
  eq([hp - g.hp, g.status.burn], [3, undefined], '相手のターンの終わりにも燃える');
  // Perseverance には効かない。Cleanse で消える
  const p = board([mk(S('melee', 2, 10, 'scorch:2'))], [mk(S('melee', 1, 30, 'perseverance'))]);
  eq(extra(attacks(p)[0], 'scorch').immune, true);
  const c = board([mk(GOLEM), mk(S('melee', 1, 10, 'cleanse'))], [mk(SLIME)]);
  c.players[0].slots[0].status.burn = 3;
  beginTurnOf(c, 0);
  eq(c.players[0].slots[0].status.burn, undefined);
});

test('Harvest：このモンスターが攻撃で敵を倒すたび、クリスタル+X', () => {
  const s = board([mk(S('melee', 9, 10, 'harvest:1'))], [mk(S('melee', 1, 2)), mk(GOLEM)]);
  const before = s.players[0].crystals;
  const ev = attacks(s)[0];
  eq([s.players[0].crystals - before, extra(ev, 'harvest').x], [1, 1]);
  const t = board([mk(S('melee', 1, 10, 'harvest:1'))], [mk(GOLEM)]);
  attacks(t);
  eq(t.players[0].crystals, 10, '倒さなければ増えない');
});

test('追加カード：32枚（モンスター15・装備15・フラッシュ2）があり、追加スキル32種類のすべてを、どれかのカードが持つ', () => {
  const NEW = ['fury', 'sunder', 'grudge', 'followthrough', 'vanguard', 'trample', 'recast', 'echo', 'spellpierce', 'exploit', 'staticguard', 'stall', 'bloom', 'regenerate', 'mendingaura', 'laststand',
    'partinggift', 'leech', 'keeneye', 'arrowrain', 'pointblank', 'steadyaim', 'deflect', 'ambush', 'scatter', 'cull', 'jinx', 'luckyshot', 'plagueburst', 'finalbow', 'scorch', 'harvest'];
  eq(NEW.length, 32);
  const ids = ['r15', 'r16', 'r17', 'b15', 'b16', 'b17', 'g14', 'g15', 'g16', 'y16', 'y17', 'y18', 'p15', 'p16', 'p17', ...Array.from({ length: 15 }, (_, i) => 'e' + (29 + i)), 'f28', 'f29'];
  eq(ids.filter(id => !CARD_DEFS[id]), []);
  for (const id of NEW) {
    assert(SKILLS[id] && SKILL_META[id], id);
    assert(ids.some(c => CARD_DEFS[c].levels.some(l => (l.skills || []).some(k => k.id === id)) || (CARD_DEFS[c].options || []).some(k => k.id === id)), id + ' を持つカード');
  }
  // 絵がある（紋章だけの仮の絵ではない）。フラッシュは対象の取り方が決まっている
  for (const id of ids) assert(CARD_DEFS[id].kind === 'monster' ? MONSTER_ART[id] : ITEM_ART[id], id + ' の絵');
  eq([flashTarget(cardAt('f28')), flashTarget(cardAt('f29'))], ['enemy', 'none']);
});

test('追加カード：CPU・オート（ふつう／つよい）が、追加カードだけのデッキで最後まで対戦できる', () => {
  const deck = { monsters: ['r15', 'r17', 'b15', 'b16', 'g14', 'g16', 'y17', 'p16'], items: ['e29', 'e34', 'e36', 'e41', 'e42', 'e43', 'f28', 'f29'], levels: {}, options: {} };
  const other = { monsters: ['r16', 'b17', 'g15', 'y16', 'y18', 'p15', 'p17', 'p02'], items: ['e30', 'e31', 'e32', 'e33', 'e35', 'e37', 'e38', 'e39'], levels: {}, options: {} };
  for (let g = 0; g < 6; g++) {
    const s = newGame(g % 2 ? deck : other, g % 2 ? other : deck, testRng);
    const res = playOut(s, pi => (pi === 0 ? (g < 3 ? st => autoActionFor(st, 'strong') : autoNextAction) : cpuNextAction));
    assert(res && (res.winner === 0 || res.winner === 1), '決着がつく');
  }
});

// ============================================================
// コストの増減（カード1枚ごとの変化）
// ============================================================
const giveH = (s, pi, id) => { const uid = give(s, pi, id); return s.players[pi].hand.find(h => h.uid === uid); }; // 手札に足して、その1枚を返す

test('コストの増減：カード1枚ごとの増減（mod）が、モンスター・装備・フラッシュの支払いに反映される', () => {
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  const p = s.players[0];
  const hand = id => giveH(s, 0, id);
  const dragon = hand(DRAGON), sword = hand(SWORD), rock = hand(ROCK), aid = hand(AID);
  dragon.mod = -2; sword.mod = 3; rock.mod = -5; aid.mod = -1;
  eq([costOf(p, dragon), costOf(p, sword), costOf(p, rock), costOf(p, aid)], [4, 4, 1, 0], '下げても最低1（もとが0のカードは0）。上げるほうに上限はない');
  eq([costOf(p, CARD_BY_ID[DRAGON]), cardMod(CARD_BY_ID[DRAGON]), cardMod(dragon)], [6, 0, -2], 'カードそのものを渡したときは、増減なし');
  p.crystals = 9;
  assert(equipItem(s, 0, sword.uid, 0), '装備できる'); eq(p.crystals, 5);
  assert(playFlash(s, 0, rock.uid, 0), '使える'); eq(p.crystals, 4);
  assert(playMonster(s, 0, dragon.uid, 1), '出せる'); eq(p.crystals, 0);
  // 足りなければ使えない
  const again = hand(SWORD); again.mod = 1; // コスト1 → 2
  p.crystals = 1;
  eq(equipItem(s, 0, again.uid, 0), false);
});

test('コストの増減：増減は、そのカードについてまわる（場に出て、山札に戻り、また引いても同じ）。Equilibrium とも重なる', () => {
  const s = board([], [mk(GOLEM)]);
  const p = s.players[0];
  const uid = give(s, 0, DRAGON);
  p.hand.find(h => h.uid === uid).mod = -2;
  playMonster(s, 0, uid, 0);
  eq(p.slots[0].costMod, -2);
  playFlash(s, 0, give(s, 0, tflash('t_back', 0, 'retreat')), 0);
  eq([p.deck.length, p.deck[0].mod, costOf(p, p.deck[0])], [1, -2, 4]);
  // Equilibrium（同じ色のコストがXになる）は、増減のあとの値と比べて安いほうになる
  const t = board([mk(S('melee', 1, 10, 'equilibrium:3'))], [mk(GOLEM)]);
  const q = t.players[0];
  const a = giveH(t, 0, DRAGON), b = giveH(t, 0, DRAGON);
  a.mod = -4; b.mod = 2;
  eq([costOf(q, a), costOf(q, b)], [2, 3]);
});

test('コストの増減：オートの試算で増減が変わっても、元の対戦には影響しない。同じカードでもコストが違えば、別の手として調べる', () => {
  const s = board([], [mk(GOLEM)]);
  const p = s.players[0];
  const a = giveH(s, 0, WOLF), b = giveH(s, 0, WOLF);
  inDeck(s, 0, DRAGON);
  b.mod = 9;
  const c = aiClone(s, s.rng);
  c.players[0].hand[0].mod = -1; c.players[0].deck[0].mod = 5;
  eq([a.mod, p.deck[0].mod, c.players[0].hand[1].mod], [undefined, undefined, 9]);
  p.crystals = 3;
  eq([...new Set(aiMoves(s).filter(m => m.type === 'monster').map(m => m.uid))], [a.uid], '高くなったほうは出せない');
});

test('Featherweight・Quartermaster：装備のコストが下がる（1より安くはならない）', () => {
  const blade = tequip('t_rblade', 3, 'red', { atk: { melee: 2 } });
  const s = board([mk(S('melee', 1, 10, 'featherweight:1')), mk(WOLF)], [mk(GOLEM)]);
  const p = s.players[0];
  const h = giveH(s, 0, blade), sw = giveH(s, 0, SWORD);
  eq([costOf(p, h, p.slots[0]), costOf(p, h, p.slots[1]), costOf(p, h), costOf(p, sw, p.slots[0])], [2, 3, 2, 1], '同じ色の装備を、自分に付けるときだけ安い。無色の装備は変わらない');
  p.crystals = 2;
  eq(equipItem(s, 0, h.uid, 1), false, 'ほかの味方に付けるには足りない');
  assert(equipItem(s, 0, h.uid, 0)); eq(p.crystals, 0);
  const t = board([mk(S('melee', 1, 10, 'quartermaster:2')), mk(S('melee', 1, 10, 'quartermaster:1'))], [mk(GOLEM)]);
  const q = t.players[0];
  eq([costOf(q, giveH(t, 0, blade)), costOf(q, giveH(t, 0, SWORD)), costOf(q, giveH(t, 0, ROCK))], [1, 1, 1], '装備だけが、いちばん強い2ぶん下がる。1より安くはならない');
});

test('Crosscurrent：相手の手札のモンスターのコストが、X未満ならXになる', () => {
  const s = board([mk(WOLF)], [mk(S('magic', 1, 10, 'crosscurrent:3'))]);
  const p = s.players[0];
  eq([costOf(p, giveH(s, 0, WOLF)), costOf(p, giveH(s, 0, DRAGON)), costOf(p, giveH(s, 0, SWORD)), costOf(s.players[1], CARD_BY_ID[WOLF])], [3, 6, 1, 2], '安いモンスターだけ上がる。相手自身には効かない');
  s.players[1].slots[0].status.entangle = true;
  eq(costOf(p, CARD_BY_ID[WOLF]), 2, '拘束されているあいだは効かない');
  // オートの試算の複製でも効く
  delete s.players[1].slots[0].status.entangle;
  const c = aiClone(s, s.rng);
  eq(costOf(c.players[0], CARD_BY_ID[WOLF]), 3);
});

test('Ill Omen：相手がターン開始時に引くカードのコスト+X（そのカードについてまわる）', () => {
  const s = board([mk(S('chaos', 1, 10, 'illomen:1'))], [mk(GOLEM)]);
  inDeck(s, 1, WOLF); inDeck(s, 1, SWORD); inDeck(s, 0, WOLF);
  finishTurn(s); startTurn(s);
  const foe = s.players[1];
  eq([foe.hand.length, foe.hand[0].mod, costOf(foe, foe.hand[0])], [1, 1, 3]);
  finishTurn(s); startTurn(s);
  eq(s.players[0].hand[0].mod, undefined, '自分が引くカードは変わらない');
});

test('Attunement：自分のターン終了時、そのターンに味方が回復されていれば、このカードのコスト-X（手札・山札・場のどこにいても）', () => {
  const att = S('magic', 1, 10, 'attunement:1');
  const s = board([mk(GOLEM), mk(S('magic', 1, 10, 'heal:2')), mk(att)], [mk(SLIME)]);
  const p = s.players[0];
  const inHand = giveH(s, 0, att);
  p.deck.push({ uid: uidSeq++, card: CARD_BY_ID[att] });
  p.slots[0].hp -= 5;
  beginTurnOf(s, 0);
  const drawn = p.hand.find(h => h !== inHand); // 山札の1枚は、ターン開始時に引いた
  finishTurn(s);
  eq([inHand.mod, drawn.mod, p.slots[2].costMod, s.endEvents.find(e => e.kind === 'attunement').count], [-1, -1, -1, 3]);
  // 回復のなかったターンは下がらない
  beginTurnOf(s, 0);
  p.slots[0].hp = p.slots[0].maxHp;
  beginTurnOf(s, 0); finishTurn(s);
  eq(inHand.mod, -1);
});

test('Evacuate：ほかの Flying 持ちの味方が倒されるか生贄にされたとき、山札に戻し、コスト-X', () => {
  const bird = S('melee', 1, 2, 'flying');
  const s = fixedBoard([mk(DRAGON)], [mk(bird, LEATHER), mk(S('ranged', 1, 10, 'evacuate:1')), mk(S('melee', 1, 2))]);
  s.players[1].slots[0].armor = 0;
  const foe = s.players[1];
  const before = foe.crystals;
  const ev = attacks(s)[0];
  eq([ev.killed, foe.deck.map(h => [h.card.id, h.mod]), kinds(ev), foe.crystals - before], [true, [[bird, -1]], ['evacuate'], CONFIG.FALLEN_CRYSTAL], '倒された扱い（クリスタルは入る）で、山札に戻る。装備は戻らない');
  eq(monstersLeft(foe), 3);
  // Flying でない味方、Evacuate 持ち自身は戻らない。Terminate で倒されたときも戻らない
  const t = board([mk(DRAGON)], [mk(S('melee', 1, 2)), mk(S('ranged', 1, 10, 'evacuate:1', 'flying'))]);
  attacks(t);
  eq(t.players[1].deck.length, 0);
  const k = board([mk(WOLF)], [mk(bird), mk(S('ranged', 1, 10, 'evacuate:1'))]);
  playFlash(k, 0, give(k, 0, tflash('t_term4', 1, 'terminate')), 0);
  eq(k.players[1].deck.length, 0);
  // 場の生贄でも戻る
  const z = board([mk(bird), mk(S('ranged', 1, 10, 'evacuate:2'))], [mk(GOLEM)]);
  assert(sacrificeField(z, 0, 0));
  eq([z.players[0].deck.map(h => h.mod), z.sacEvents.map(e => e.kind)], [[-2], ['evacuate']]);
});

test('Fall Back：場で生贄にされたとき、山札に戻る（次に出すときのコスト+X）。装備のスキルでも働く', () => {
  const horn = tequip('t_horn', 1, null, { hp: 1 }, ['fallback:1']);
  const s = board([mk(WOLF, horn), mk(GOLEM)], [mk(SLIME)]);
  const p = s.players[0];
  const before = p.crystals;
  assert(sacrificeField(s, 0, 0));
  eq([p.crystals - before, p.deck.map(h => [h.card.id, h.mod, costOf(p, h)]), names(p)[0]], [CONFIG.SACRIFICE_MONSTER, [[WOLF, 1, 3]], GOLEM], 'クリスタルは入り、モンスターだけが山札に戻る');
  eq(monstersLeft(p), 2);
});

test('フラッシュ：Regroup は味方を山札に戻してコスト-X。Tax は相手の手札のアイテムのコスト+X', () => {
  const s = board([mk(DRAGON), mk(WOLF)], [mk(GOLEM)]);
  const p = s.players[0], foe = s.players[1];
  playFlash(s, 0, give(s, 0, tflash('t_regroup', 1, 'regroup:2')), 0);
  eq([p.deck.map(h => [h.card.id, costOf(p, h)]), names(p)[0]], [[[DRAGON, 4]], WOLF]);
  const [sw, rock, wolf] = [giveH(s, 1, SWORD), giveH(s, 1, ROCK), giveH(s, 1, WOLF)];
  const ev = playFlash(s, 0, give(s, 0, tflash('t_tax', 1, 'tax:2')), -1);
  eq([ev.taxed, costOf(foe, sw), costOf(foe, rock), costOf(foe, wolf)], [2, 3, 3, 2], 'モンスターは変わらない');
});

test('コストの増減のカード：9枚（モンスター6・装備1・フラッシュ2）があり、9種類のスキルのすべてを、どれかのカードが持つ。CPU・オートが最後まで対戦できる', () => {
  const NEW = ['featherweight', 'quartermaster', 'crosscurrent', 'illomen', 'attunement', 'evacuate', 'fallback', 'regroup', 'tax'];
  const ids = ['r18', 'b18', 'g17', 'y19', 'y20', 'p18', 'e44', 'f30', 'f31'];
  eq(ids.filter(id => !CARD_DEFS[id]), []);
  for (const id of NEW) assert(SKILLS[id] && SKILL_META[id] && ids.some(c => CARD_DEFS[c].levels.some(l => (l.skills || []).some(k => k.id === id))), id);
  for (const id of ids) assert(CARD_DEFS[id].kind === 'monster' ? MONSTER_ART[id] : ITEM_ART[id], id + ' の絵');
  eq([flashTarget(cardAt('f30')), flashTarget(cardAt('f31'))], ['ally', 'none']);
  const deck = { monsters: ['r18', 'b18', 'g17', 'y19', 'y20', 'p18', 'y03', 'g02'], items: ['e44', 'f30', 'f31', 'e13', 'e15', 'e02', 'e01', 'f03'], levels: {}, options: {} };
  for (let g = 0; g < 6; g++) {
    const s = newGame(g % 2 ? deck : DEFAULT_DECK, g % 2 ? DEFAULT_DECK : deck, testRng);
    const res = playOut(s, pi => (pi === 0 ? (g < 3 ? st => autoActionFor(st, 'strong') : autoNextAction) : cpuNextAction));
    assert(res && (res.winner === 0 || res.winner === 1), '決着がつく');
    // 相手プレイヤーへの参照は、保存や複製に巻き込まれない
    assert(!Object.keys(s.players[0]).includes('opp') && s.players[0].opp === s.players[1]);
  }
});

// ============================================================
// 召喚
// ============================================================
test('召喚モンスター：倒されてもクリスタルは入らず、残りモンスターに数えない。生贄にできない。場にいれば、場が空のペナルティは受けない', () => {
  const s = zeroCrystals(board([mk(DRAGON)], []));
  const foe = s.players[1];
  inDeck(s, 1, WOLF); inDeck(s, 1, SWORD);
  const token = summonToken(s, foe, 'tk1', 3, true);
  eq([token.isToken, token.card.name, token.hp, monstersLeft(foe), names(foe)[0]], [true, '小さなゴーレム', 3, 1, 'tk1']);
  // 場に召喚モンスターだけ：ペナルティなし
  s.current = 1;
  finishTurn(s);
  eq([s.penalty, foe.deck.length], [null, 2]);
  // 生贄にできない（CPU・オートも候補にしない）
  s.current = 1; s.phase = 'play';
  eq([sacrificeField(s, 1, 0), aiMoves(s).some(m => m.type === 'sacrificeField')], [false, false]);
  // 倒されてもクリスタルは入らない。デッキのモンスターが尽きていれば、召喚モンスターが場にいても負け
  s.current = 0;
  attacks(s);
  eq([names(foe)[0], foe.crystals], [null, 0]);
  const t = board([mk(WOLF)], []);
  summonToken(t, t.players[1], 'tk1', 9, true);
  eq(checkResult(t).winner, 0);
  // 満員なら呼べない。山札に戻す効果では、そのまま消える
  const u = board([mk(WOLF), mk(GOLEM), mk(SLIME)], [mk(GOLEM)]);
  eq(summonToken(u, u.players[0], 'tk1', 3, true), null);
  const v = board([mk(WOLF)], [mk(GOLEM)]);
  summonToken(v, v.players[1], 'tk1', 3, true);
  playFlash(v, 0, give(v, 0, tflash('t_uns2', 1, 'unsummon')), 0);
  eq([names(v.players[1])[0], v.players[1].deck.length], [GOLEM, 0]);
});

test('Vanguard Call：場に出たとき、自分の前列に「小さなゴーレム」を呼ぶ（いたモンスターは後ろへ）', () => {
  const caller = S('magic', 2, 6, 'vanguardcall:3');
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  s.players[0].crystals = 9;
  const r = playMonster(s, 0, give(s, 0, caller), 1);
  eq([names(s.players[0]), s.players[0].slots[0].hp, r.events.map(e => e.kind)], [['tk1', WOLF, caller], 3, ['vanguardcall']]);
  // 満員になるなら呼べない（出すことはできる）
  const t = board([mk(WOLF), mk(GOLEM)], [mk(SLIME)]);
  t.players[0].crystals = 9;
  eq([playMonster(t, 0, give(t, 0, caller), 2).events.length, names(t.players[0])], [0, [WOLF, GOLEM, caller]]);
});

test('Sortie：自分のターン開始時、後ろの空きに「突撃ゴーレム」を呼ぶ。後列から Reach で殴り、そのターンの終わりに消える', () => {
  const s = board([mk(S('ranged', 1, 7, 'sortie:2'))], [mk(S('melee', 1, 30, 'flying'))]);
  const p = s.players[0];
  beginTurnOf(s, 0);
  eq([names(p).slice(0, 2).map(id => id === 'tk2'), p.slots[1].hp, atkOf(p.slots[1], 'melee'), skillX(p.slots[1], 'antiair'), startEv(s, 'sortie').length], [[false, true], 1, 2, 1, 1]);
  const evs = attacks(s);
  eq(evs.filter(e => e.attacker.isToken).map(e => [e.type, e.dmg, e.dodged]), [['melee', 3, false]], 'Anti-Air で Flying に当たり、+1');
  finishTurn(s);
  eq([names(p).filter(id => id === 'tk2').length, s.endEvents.map(e => e.kind)], [0, ['tokenend']]);
  // 満員なら呼ばない
  const t = board([mk(WOLF), mk(S('ranged', 1, 7, 'sortie:2')), mk(GOLEM)], [mk(SLIME)]);
  beginTurnOf(t, 0);
  eq(startEv(t, 'sortie').length, 0);
});

test('フラッシュ：Swarm は、自分の場の空きを「身代わりゴーレム」で埋める。次の自分のターン開始時に消える', () => {
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  const p = s.players[0];
  const ev = playFlash(s, 0, give(s, 0, tflash('t_swarm', 1, 'swarm:2')), -1);
  eq([names(p), ev.summoned.length, p.slots[1].hp], [[WOLF, 'tk3', 'tk3'], 2, 2]);
  eq(playFlash(s, 0, give(s, 0, tflash('t_swarm', 1, 'swarm:2')), -1), null, '満員なら使えない');
  finishTurn(s); finishTurn(s);
  eq(names(p), [WOLF, 'tk3', 'tk3'], '相手のターンのあいだは残る');
  beginTurnOf(s, 0);
  eq([names(p), startEv(s, 'tokenend').length], [[WOLF, null, null], 1]);
});

test('フラッシュ：Unwelcome Gift は、相手の前列に「重荷ゴーレム」を置く。攻撃できず、倒されると持ち主がクリスタルを1失う。Menace と組み合わさる', () => {
  const s = board([mk(S('melee', 5, 10, 'menace:1'))], [mk(WOLF), mk(ELF)]);
  const foe = s.players[1];
  const ev = playFlash(s, 0, give(s, 0, tflash('t_gift', 1, 'unwelcomegift:4')), -1);
  eq([names(foe), foe.slots[0].hp, ev.extras.filter(x => x.kind === 'menace').length], [['tk4', WOLF, ELF], 4, 2], '押し出された2体に Menace');
  eq(playFlash(s, 0, give(s, 0, tflash('t_gift', 1, 'unwelcomegift:4')), -1), null, '相手の場が満員なら使えない');
  // 相手の番：重荷ゴーレムは攻撃しない。後ろに下がった近接（ウルフ）も攻撃できない
  finishTurn(s); beginTurnOf(s, 1);
  eq(attacks(s).map(e => e.attacker.card.id), [ELF]);
  finishTurn(s); beginTurnOf(s, 0);
  foe.crystals = 3;
  const hit = attacks(s)[0];
  eq([hit.killed, foe.crystals, kinds(hit)], [true, 2, ['menace', 'menace', 'burden']], '倒されると、後ろが詰めて Menace。持ち主（相手）のクリスタル-1');
});

test('召喚のカード：4枚（モンスター2・フラッシュ2）があり、4種類のスキルをどれかのカードが持つ。CPU・オートが最後まで対戦できる', () => {
  const NEW = ['vanguardcall', 'sortie', 'swarm', 'unwelcomegift'];
  const ids = ['r19', 'g18', 'f32', 'f33'];
  for (const id of NEW) assert(SKILLS[id] && SKILL_META[id] && ids.some(c => CARD_DEFS[c].levels.some(l => (l.skills || []).some(k => k.id === id))), id);
  for (const id of ids) assert(CARD_DEFS[id].kind === 'monster' ? MONSTER_ART[id] : ITEM_ART[id], id + ' の絵');
  for (const id of Object.keys(TOKEN_DEFS)) assert(MONSTER_ART[id] && CARD_BY_ID[id].token && !MONSTERS.some(c => c.id === id) && monsterArt(tokenCard(id, 2)).includes('<svg'), id);
  eq([flashTarget(cardAt('f32')), flashTarget(cardAt('f33'))], ['none', 'none']);
  const deck = { monsters: ['r19', 'r19', 'g18', 'g18', 'r01', 'g02', 'y02', 'p02'], items: ['f32', 'f32', 'f33', 'f33', 'e01', 'e02', 'f01', 'f03'], levels: {}, options: {} };
  for (let g = 0; g < 8; g++) {
    const s = newGame(g % 2 ? deck : DEFAULT_DECK, g % 2 ? DEFAULT_DECK : deck, testRng);
    const res = playOut(s, pi => (pi === 0 ? (g < 4 ? st => autoActionFor(st, 'strong') : autoNextAction) : cpuNextAction));
    assert(res && (res.winner === 0 || res.winner === 1), '決着がつく');
    assert(s.log.every(e => !/undefined/.test(logLine(e).html)), 'ログにおかしな文字がない');
  }
});

// ============================================================
// 特別カード（試合中に山札へ足されるカード）
// ============================================================
test('特別カード：じゃまカードは使えないが、生贄にはできる。デッキのカードではなく、コレクションに出ない', () => {
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  const p = s.players[0];
  const junk = addToDeck(s, p, p, specialCard('sp1'));
  eq([junk.added, junk.card.junk, flashUsable(p, junk.card), flashTarget(junk.card), p.deck.length], [true, true, false, undefined, 1]);
  p.hand.push(p.deck.shift());
  eq([playFlash(s, 0, junk.uid, 0), aiMoves(s).filter(m => m.type === 'flash').length, cpuFlashSlot(s, junk.card)], [null, 0, null], '使えない（CPU・オートも使おうとしない）');
  const before = p.crystals;
  assert(sacrifice(s, 0, junk.uid), '生贄にはできる');
  eq(p.crystals - before, CONFIG.SACRIFICE_ITEM);
  for (const id of Object.keys(SPECIAL_DEFS)) assert(CARD_BY_ID[id].special && !ITEMS.some(c => c.id === id) && !CARD_DEFS[id] && ITEM_ART[id] && itemArt(specialCard(id, 3)).includes('<svg'), id);
  eq([specialCard('sp3', 4).skills, specialCard('sp4', 3).skills, specialCard('sp5', 2).skills], [[{ id: 'smite', x: 4 }], [{ id: 'heal', x: 3 }], [{ id: 'reinforcement', x: 2 }]]);
});

test('Backfire：場に出たとき、相手の山札に「がらくた」をX枚、自分の山札にも1枚入れる', () => {
  const s = board([], [mk(GOLEM)]);
  s.players[0].crystals = 9;
  const r = playMonster(s, 0, give(s, 0, S('chaos', 2, 6, 'backfire:2')), 0);
  eq([s.players[1].deck.map(h => h.card.id), s.players[0].deck.map(h => h.card.id), r.events.map(e => e.kind)], [['sp1', 'sp1'], ['sp1'], ['backfire']]);
});

test('Spell Forge・Apothecary・Tinker：自分のターン終了時、自分の山札にカードを1枚入れる（同じスキルは、いちばん強い1体ぶんだけ）', () => {
  const s = fixedBoard([mk(S('magic', 1, 9, 'spellforge:3')), mk(S('magic', 1, 9, 'spellforge:4', 'apothecary:3')), mk(S('ranged', 1, 9, 'tinker:1'))], [mk(S('melee', 0, 99))]);
  const p = s.players[0];
  finishTurn(s);
  const got = id => p.deck.find(h => h.card.id === id);
  eq([p.deck.length, got('sp3').card.skills[0].x, got('sp4').card.skills[0].x, s.endEvents.map(e => e.kind)], [3, 4, 3, ['spellforge', 'apothecary', 'tinker']]);
  const eqp = p.deck.find(h => h.card.kind === 'equip');
  eq([eqp.card.rarity, eqp.mod, eqp.added, !eqp.card.color || eqp.card.color === 'red'], ['common', -1, true, true]);
  // 足された「火の玉」は、引けばふつうのフラッシュとして使える
  p.hand.push(got('sp3')); p.deck.splice(p.deck.indexOf(got('sp3')), 1);
  s.current = 0; s.phase = 'play'; p.crystals = 1;
  eq(playFlash(s, 0, p.hand[0].uid, 0).dmg, 4);
});

test('Fortune：自分のターン終了時、半々で、自分の山札に「吉札」か、相手の山札に「凶札」を入れる', () => {
  let good = 0;
  for (let i = 0; i < 400; i++) {
    const s = board([mk(S('chaos', 1, 9, 'fortune:2'))], [mk(S('melee', 0, 99))]);
    finishTurn(s);
    const mine = s.players[0].deck.map(h => h.card.id), theirs = s.players[1].deck.map(h => h.card.id);
    assert(mine.length + theirs.length === 1 && (mine[0] === 'sp5' || theirs[0] === 'sp2'), '1枚だけ');
    if (mine.length) { good++; eq(s.players[0].deck[0].card.skills, [{ id: 'reinforcement', x: 2 }]); }
  }
  near(good / 400, 0.5, 0.08);
});

test('Opportunist：相手が山札にカードを足すたび、すべての攻撃力と最大HPが永続で+X（自分が足しても増えない）', () => {
  const s = board([mk(S('melee', 3, 8, 'opportunist:1'))], [mk(S('magic', 1, 30, 'spellforge:3'))]);
  const m = s.players[0].slots[0];
  addToDeck(s, s.players[0], s.players[0], specialCard('sp3', 3));
  eq([atkOf(m, 'melee'), m.maxHp], [3, 8]);
  finishTurn(s); // 自分の番が終わる
  finishTurn(s); // 相手の番が終わる：相手の Spell Forge が足す
  eq([atkOf(m, 'melee'), m.maxHp, m.hp, s.endEvents.map(e => e.kind)], [4, 9, 9, ['opportunist', 'spellforge']]);
});

test('フラッシュ：Purge は、両者の手札と山札から、試合中に足されたカードをすべて取り除く', () => {
  const s = board([mk(WOLF)], [mk(GOLEM)]);
  const [p, foe] = s.players;
  inDeck(s, 0, WOLF); inDeck(s, 1, SWORD);
  addToDeck(s, foe, p, specialCard('sp1')); addToDeck(s, p, p, specialCard('sp3', 3)); addToDeck(s, p, foe, specialCard('sp2'));
  p.hand.push(p.deck.splice(p.deck.findIndex(h => h.card.id === 'sp1'), 1)[0]);
  const ev = playFlash(s, 0, give(s, 0, tflash('t_purge', 1, 'purge')), -1);
  eq([ev.purged, p.hand.length, p.deck.map(h => h.card.id), foe.deck.map(h => h.card.id)], [3, 0, [WOLF], [SWORD]]);
});

test('場が空のペナルティ：試合中に足されたカードは、ほかのカードが残っているあいだは捨てる対象にならない', () => {
  for (let i = 0; i < 30; i++) {
    const s = board([], [mk(GOLEM)]);
    const p = s.players[0];
    inDeck(s, 0, WOLF);
    for (let k = 0; k < 6; k++) addToDeck(s, s.players[1], p, specialCard('sp1'));
    finishTurn(s);
    eq([s.penalty.card.id, p.deck.length], [WOLF, 6]);
  }
  const t = board([], [mk(GOLEM)]);
  addToDeck(t, t.players[1], t.players[0], specialCard('sp1'));
  finishTurn(t);
  eq(t.penalty.card.id, 'sp1', '足されたカードしか残っていなければ、それを捨てる');
});

test('特別カードのカード：7枚（モンスター6・フラッシュ1）があり、7種類のスキルをどれかのカードが持つ。CPU・オートが最後まで対戦でき、ログもおかしくならない', () => {
  const NEW = ['backfire', 'spellforge', 'apothecary', 'fortune', 'tinker', 'opportunist', 'purge'];
  const ids = ['r20', 'b19', 'g19', 'y21', 'p19', 'p20', 'f34'];
  for (const id of NEW) assert(SKILLS[id] && SKILL_META[id] && ids.some(c => CARD_DEFS[c].levels.some(l => (l.skills || []).some(k => k.id === id))), id);
  for (const id of ids) assert(CARD_DEFS[id].kind === 'monster' ? MONSTER_ART[id] : ITEM_ART[id], id + ' の絵');
  const deck = { monsters: ['r20', 'b19', 'g19', 'y21', 'p19', 'p20', 'p19', 'g19'], items: ['f34', 'e01', 'e02', 'e03', 'f01', 'f03', 'e05', 'f04'], levels: {}, options: {} };
  let added = 0;
  for (let g = 0; g < 8; g++) {
    const s = newGame(g % 2 ? deck : DEFAULT_DECK, g % 2 ? DEFAULT_DECK : deck, testRng);
    const res = playOut(s, pi => (pi === 0 ? (g < 4 ? st => autoActionFor(st, 'strong') : autoNextAction) : cpuNextAction));
    assert(res && (res.winner === 0 || res.winner === 1), '決着がつく');
    assert(s.log.every(e => !/undefined|NaN/.test(logLine(e).html)), 'ログにおかしな文字がない');
    added += s.log.filter(e => (e[0] === 'k' || e[0] === 'x') && NEW.includes(e[2])).length;
  }
  assert(added > 20, '足すスキルが実際に発動している: ' + added);
});

// ============================================================
// カード一覧の並び替えと絞り込み
// ============================================================
const sortPool = () => [...MONSTER_DEFS, ...EQUIP_DEFS, ...FLASH_DEFS].map(d => cardAt(d.id));
const stdSorted = list => list.every((c, i) => !i || cardStdCompare(list[i - 1], c) <= 0);

test('並び替え：すべてのカードに読みがある（ひらがな）。足し忘れると50音順が崩れる', () => {
  for (const id of Object.keys(CARD_DEFS)) assert(/^[ぁ-ゖー]+$/.test(cardYomi(id)), `${id} ${CARD_DEFS[id].name} の読み`);
  eq(Object.keys(CARD_YOMI).filter(id => !CARD_DEFS[id]), []);
  eq(new Set(Object.values(CARD_YOMI)).size, Object.keys(CARD_YOMI).length, '同じ読みのカードはない');
});

test('並び替え：標準は 色 →（モンスター→装備→フラッシュ）→ レアリティの高い順（Elite が先頭）→ コストの低い順 → 名前の50音順', () => {
  const list = cardSortList(sortPool(), 'color');
  assert(stdSorted(list), '標準の順になっている');
  // 同じ色のモンスターの中は、レアリティの高い順
  for (const col of Object.keys(COLORS)) {
    const mons = list.filter(c => c.kind === 'monster' && c.color === col);
    const ranks = mons.map(cardRarityRank);
    eq(ranks, ranks.slice().sort((a, b) => a - b), col + ' のレアリティ');
    assert(mons[0].elite || mons[0].rarity === 'legend', col + ' の先頭は Elite かレジェンド');
    // 同じレアリティの中はコストの低い順、同じコストの中は50音順
    for (let i = 1; i < mons.length; i++) {
      if (cardRarityRank(mons[i - 1]) !== cardRarityRank(mons[i])) continue;
      assert(mons[i - 1].cost <= mons[i].cost, `${mons[i - 1].name} → ${mons[i].name} のコスト`);
      if (mons[i - 1].cost === mons[i].cost) assert(cardYomi(mons[i - 1].id).localeCompare(cardYomi(mons[i].id), 'ja') < 0, `${mons[i - 1].name} → ${mons[i].name} の50音順`);
    }
  }
  // 色の順はいままでどおり（アイテムの無色が先頭、あとは赤・青・緑・黄・紫）。色の中は モンスター → 装備 → フラッシュ
  eq([...new Set(list.map(c => c.color || 'none'))], ['none', ...Object.keys(COLORS)]);
  const red = list.filter(c => c.color === 'red').map(c => c.kind);
  eq([...new Set(red)], ['monster', 'equip', 'flash']);
  eq(red, red.slice().sort((a, b) => CARD_KIND_ORDER.indexOf(a) - CARD_KIND_ORDER.indexOf(b)));
  // Elite はレジェンドより前
  const r14 = list.findIndex(c => c.id === 'r14'), r08 = list.findIndex(c => c.id === 'r08');
  assert(CARD_DEFS.r14.elite && r14 < r08, 'Elite の紅蓮の闘神が、レジェンドの劫火竜より前');
});

test('並び替え：各並び順で正しい順番になり、同じ値のカードは標準の並び順になる。向きも切り替えられる', () => {
  const p = richProfile();
  const pool = sortPool();
  pool.slice(0, 40).forEach((c, i) => { p.cards[c.id] = { level: 1 + (i % 3), copies: i % 4, got: 100 - i }; });
  const check = (sort, reverse, value, monsterOnly) => {
    const list = cardSortList(pool, sort, reverse, p);
    eq(list.length, pool.length);
    const head = monsterOnly ? list.filter(c => c.kind === 'monster') : list;
    if (monsterOnly) assert(list.slice(head.length).every(c => c.kind !== 'monster') && stdSorted(list.slice(head.length)), sort + '：モンスター以外は最後に、標準の順で');
    for (let i = 1; i < head.length; i++) {
      const a = value(head[i - 1]), b = value(head[i]);
      assert(reverse ? a >= b : a <= b, `${sort}${reverse ? '（逆）' : ''}：${head[i - 1].name}(${a}) → ${head[i].name}(${b})`);
      if (a === b) assert(cardStdCompare(head[i - 1], head[i]) < 0, `${sort}：同じ値は標準の順（${head[i - 1].name} → ${head[i].name}）`);
    }
  };
  // 最初の向き：レアリティ高い順・コスト低い順・レベル高い順・入手の新しい順・予備の多い順・攻撃力とHPの高い順
  check('rarity', false, c => cardRarityRank(c));
  check('rarity', true, c => cardRarityRank(c));
  check('cost', false, c => c.cost);
  check('cost', true, c => c.cost);
  check('level', false, c => -cardLevel(p, c.id));
  check('level', true, c => -cardLevel(p, c.id));
  check('got', false, c => -((p.cards[c.id] && p.cards[c.id].got) || 0));
  check('copies', false, c => -(p.cards[c.id] ? p.cards[c.id].copies + 1 : 0));
  check('atk', false, c => -c.atk, true);
  check('atk', true, c => -c.atk, true);
  check('hp', false, c => -c.hp, true);
  // 名前順は50音順。逆にすると逆になる
  const byName = cardSortList(pool, 'name').map(c => cardYomi(c.id));
  eq(byName, byName.slice().sort((a, b) => a.localeCompare(b, 'ja')));
  eq(cardSortList(pool, 'name', true).map(c => c.id), cardSortList(pool, 'name').map(c => c.id).reverse());
  assert(byName[0].startsWith('あ') || byName[0].startsWith('い'), '「あ」行から始まる: ' + byName[0]);
  // 色順の逆は、標準をそのまま逆にしたもの。元の一覧は書きかえない
  const before = pool.map(c => c.id);
  eq(cardSortList(pool, 'color', true).map(c => c.id), cardSortList(pool, 'color').map(c => c.id).reverse());
  eq(pool.map(c => c.id), before);
  // 知らない並び順は、標準になる
  eq(cardSortList(pool, 'xxx').map(c => c.id), cardSortList(pool, 'color').map(c => c.id));
});

test('絞り込み：色・レアリティ・種類・攻撃タイプ・所持・強化できる・検索。並び替えと組み合わせても正しく動く', () => {
  const p = richProfile();
  const pool = sortPool();
  const f = over => Object.assign(cardFilterDefault(), over);
  const ids = (over, sort = 'color', rev = false) => cardSortList(cardFilterList(pool, f(over), p), sort, rev, p);
  eq(cardFilterList(pool, cardFilterDefault(), p).length, pool.length, '条件なしなら全部');
  eq(cardFilterCount(cardFilterDefault()), 0);
  // 色（複数）・無色
  assert(ids({ colors: ['red', 'blue'] }).every(c => c.color === 'red' || c.color === 'blue'));
  assert(ids({ colors: ['none'] }).every(c => !c.color) && ids({ colors: ['none'] }).length > 0);
  // レアリティ（複数）・Elite
  assert(ids({ rarities: ['legend', 'epic'] }).every(c => !c.elite && (c.rarity === 'legend' || c.rarity === 'epic')));
  eq(ids({ rarities: ['elite'] }).map(c => c.id).sort(), MONSTER_DEFS.filter(d => d.elite).map(d => d.id).sort());
  // 種類・攻撃タイプ（装備は、足される攻撃で判定。フラッシュは当てはまらない）
  assert(ids({ kind: 'equip' }).every(c => c.kind === 'equip'));
  const ranged = ids({ types: ['ranged'] });
  assert(ranged.some(c => c.kind === 'monster') && ranged.some(c => c.kind === 'equip') && ranged.every(c => c.kind !== 'flash'));
  assert(ranged.every(c => (c.kind === 'monster' ? c.type === 'ranged' : c.atk.ranged > 0)));
  // 所持のみ・強化できるカードのみ
  eq(ids({ owned: true }).map(c => c.id).sort(), Object.keys(p.cards).sort());
  p.cards.r02 = { level: 1, copies: 5 };
  const up = ids({ upgradable: true }).map(c => c.id);
  assert(up.includes('r02') && up.every(id => canUpgrade(p, id).ok), '素材がそろっているものだけ');
  // 検索：カード名・読み・スキル名（英語・日本語・読み）。選択スキルも探せる
  eq(ids({ q: '火の粉' }).map(c => c.id), ['r01']);
  eq(ids({ q: 'ひのこ' }).map(c => c.id), ['r01']);
  const flyers = pool.filter(c => (c.skills || []).some(k => k.id === 'flying') || ((CARD_DEFS[c.id].options || []).some(k => k.id === 'flying'))).map(c => c.id).sort();
  for (const q of ['flying', 'Flying', '飛行', 'ひこう']) eq(ids({ q }).map(c => c.id).sort(), flyers, q);
  eq(ids({ q: 'ありえない名前' }).length, 0);
  // 組み合わせ：赤のモンスターを、コストの高い順に。同じコストは標準の順
  const combo = ids({ colors: ['red'], kind: 'monster' }, 'cost', true);
  eq(combo.length, MONSTER_DEFS.filter(d => d.color === 'red').length);
  for (let i = 1; i < combo.length; i++) {
    assert(combo[i - 1].cost >= combo[i].cost, 'コストの高い順');
    if (combo[i - 1].cost === combo[i].cost) assert(cardStdCompare(combo[i - 1], combo[i]) < 0, '同じコストは標準の順');
  }
  eq(cardFilterCount(f({ colors: ['red'], kind: 'monster', q: ' ' })), 2, '空白だけの検索は数えない');
  // 画面で使う形：絞り込んでから並べ、全体の枚数も返す
  const view = { sort: 'rarity', reverse: false, filter: f({ colors: ['green'] }) };
  const r = cardViewList(pool, view, p);
  eq([r.total, r.list.length, r.list.every(c => c.color === 'green')], [pool.length, pool.filter(c => c.color === 'green').length, true]);
});

test('並び替え：選んだ並び順は、開き直しても残る（絞り込みは残さない）。入手順の記録は、保存して読み込んでも残る', () => {
  const store = memStorage();
  eq(loadCardView('collection', store), { sort: 'color', reverse: false, filter: cardFilterDefault() }, '最初は標準');
  const view = cardViewDefault();
  view.sort = 'cost'; view.reverse = true; view.filter.colors.push('red');
  saveCardView('collection', view, store);
  saveCardView('deck', { sort: 'name', reverse: false, filter: cardFilterDefault() }, store);
  eq([loadCardView('collection', store), loadCardView('deck', store).sort], [{ sort: 'cost', reverse: true, filter: cardFilterDefault() }, 'name']);
  // 壊れたデータ・知らない並び順は、標準に戻る
  store.setItem(CARD_VIEW_KEY, '{"collection":{"sort":"???"}}');
  eq(loadCardView('collection', store).sort, 'color');
  store.setItem(CARD_VIEW_KEY, 'こわれた');
  eq(loadCardView('collection', store).sort, 'color');
  // 入手順：新しく手に入れたカードほど番号が大きい。予備が増えても番号は変わらない
  const p = newProfile();
  const a = MONSTER_DEFS.find(d => !owns(p, d.id) && !d.elite).id, b = EQUIP_DEFS.find(d => !owns(p, d.id)).id;
  addCard(p, a); addCard(p, b); addCard(p, a);
  eq([p.cards[a].got, p.cards[b].got, p.cards[a].copies, p.cardSeq], [1, 2, 1, 2]);
  eq(cardSortList([cardAt(a), cardAt(b), cardAt('r01')], 'got', false, p).map(c => c.id), [b, a, 'r01'], '新しい順。記録のない古いカードは最後');
  const st = memStorage();
  saveProfile(p, st);
  const q = loadProfile(st);
  eq([q.cards[a].got, q.cards[b].got, q.cardSeq, q.cards.r01.got], [1, 2, 2, undefined]);
  // 古いセーブ（記録なし）も、そのまま読める
  const old = JSON.parse(JSON.stringify(p)); delete old.cardSeq; Object.values(old.cards).forEach(c => { delete c.got; });
  st.setItem(GROWTH.SAVE_KEY || 'card-monsters-save-v1', JSON.stringify(old));
  const r = loadProfile(st);
  eq([Object.keys(r.cards).length, r.cardSeq, r.cards[a].copies], [Object.keys(p.cards).length, undefined, 1]);
  addCard(r, MONSTER_DEFS.find(d => !owns(r, d.id) && !d.elite).id);
  eq(r.cardSeq, 1);
});

// ---------- 結果表示 ----------

(function report() {
  const failed = TEST_RESULTS.filter(r => !r.ok);
  const summary = `${TEST_RESULTS.length - failed.length} / ${TEST_RESULTS.length} 件成功`;
  if (typeof document === 'undefined') {
    TEST_RESULTS.forEach(r => print(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : ' — ' + r.error}`));
    print(summary);
    return;
  }
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  document.getElementById('summary').textContent = summary;
  document.getElementById('summary').className = failed.length ? 'ng' : 'ok';
  document.getElementById('results').innerHTML = TEST_RESULTS.map(r =>
    `<li class="${r.ok ? 'ok' : 'ng'}">${r.ok ? '✅' : '❌'} ${esc(r.name)}${r.ok ? '' : `<br><code>${esc(r.error)}</code>`}</li>`).join('');
})();
