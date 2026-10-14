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

// 読み込んだデータを点検する。壊れていたら直せるところだけ直し、だめなら新規データにする
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

function loadProfile(storage = defaultStorage()) {
  try {
    return sanitizeProfile(JSON.parse(storage.getItem(GROWTH.SAVE_KEY)));
  } catch (e) {
    return newProfile(); // 保存データなし・読めない
  }
}

function saveProfile(profile, storage = defaultStorage()) {
  try { storage.setItem(GROWTH.SAVE_KEY, JSON.stringify(profile)); return true; } catch (e) { return false; }
}

function resetProfile(storage = defaultStorage()) {
  const fresh = newProfile();
  try { storage.removeItem(GROWTH.SAVE_KEY); } catch (e) { /* 保存できない環境でも続行 */ }
  saveProfile(fresh, storage);
  return fresh;
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
