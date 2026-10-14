// ============================================================
// イベント（特殊ルール戦）。プレイヤーLv7で解放。
//   週替わり（端末の時刻。月曜に切り替わる）で、EVENTS の上から順に回る。
//   5連戦で、勝つほど報酬が増える。3敗で終了。何度でも挑戦でき、各段階の報酬は週に1回もらえる。
//   ルールは EVENTS に1行足すだけで増やせる（rule に書いた効果を engine.js などが読む）。
//   rule に使えるもの：
//     grant: { スキルid: 数値 }   全モンスターがそのスキルを持つ
//     income: n                  毎ターンもらえるクリスタル+n
//     attritionStart: n          消耗ダメージがターンnから始まる
//     sacrificeMult: n           生贄でもらえるクリスタルがn倍
//     deckColor: '色'            その色のモンスターだけのデッキで戦う（組めていなければ貸し出しデッキ）
//     randomDeck: true           ランダムなデッキが配られる
//   elite: このイベントでもらえる Elite カード（作成・分解できない、イベント限定のカード）
// ============================================================

const EVENT_CONFIG = {
  BATTLES: 5,              // 連戦の数
  MAX_LOSSES: 3,           // この数だけ負けたら終了
  FOE_BONUS: [0, 0, 1, 1, 2], // 何戦目かごとの、相手が最初に多く持っているクリスタル
};

const EVENTS = [
  { id: 'allflying', name: '大空の祭典', yomi: 'おおぞらのさいてん', icon: '🪽', desc: '全モンスターが Flying を持つ', rule: { grant: { flying: 1 } }, elite: 'y15' },
  { id: 'mono_red', name: '紅蓮の宴', yomi: 'ぐれんのうたげ', icon: '🔥', desc: '赤のモンスターだけのデッキで戦う', rule: { deckColor: 'red' }, elite: 'r14' },
  { id: 'rich', name: '豊穣の週', yomi: 'ほうじょうのしゅう', icon: '💎', desc: '毎ターンもらえるクリスタル+1', rule: { income: 1 }, elite: 'g13' },
  { id: 'mono_blue', name: '蒼海の宴', yomi: 'そうかいのうたげ', icon: '🌊', desc: '青のモンスターだけのデッキで戦う', rule: { deckColor: 'blue' }, elite: 'b14' },
  { id: 'sudden', name: '短期決戦', yomi: 'たんきけっせん', icon: '⏳', desc: '消耗ダメージがターン15から始まる', rule: { attritionStart: 15 }, elite: 'r14' },
  { id: 'mono_green', name: '深緑の宴', yomi: 'しんりょくのうたげ', icon: '🌿', desc: '緑のモンスターだけのデッキで戦う', rule: { deckColor: 'green' }, elite: 'g13' },
  { id: 'sacrifice', name: '生贄の儀式', yomi: 'いけにえのぎしき', icon: '🩸', desc: '生贄でもらえるクリスタルが2倍', rule: { sacrificeMult: 2 }, elite: 'p14' },
  { id: 'mono_yellow', name: '黄金の宴', yomi: 'おうごんのうたげ', icon: '☀️', desc: '黄のモンスターだけのデッキで戦う', rule: { deckColor: 'yellow' }, elite: 'y15' },
  { id: 'random', name: '運命のデッキ', yomi: 'うんめいのでっき', icon: '🎲', desc: 'ランダムなデッキが配られる（両者）', rule: { randomDeck: true }, elite: 'b14' },
  { id: 'mono_purple', name: '混沌の宴', yomi: 'こんとんのうたげ', icon: '☠️', desc: '紫のモンスターだけのデッキで戦う', rule: { deckColor: 'purple' }, elite: 'p14' },
];

// 勝ち数ごとの報酬（その週に1回ずつ）。elite: true は、そのイベントの Elite カード1枚
const EVENT_TIERS = [
  { wins: 1, reward: { gold: 100 } },
  { wins: 2, reward: { stones: 40 } },
  { wins: 3, reward: { elite: true } },
  { wins: 4, reward: { packs: 1, gifts: 3 } },
  { wins: 5, reward: { gold: 300, stones: 80, packs: 1 } },
];

// 何週目か（月曜始まり。端末の時刻）
function weekIndex(now = new Date()) {
  const monday = now.getDate() - ((now.getDay() + 6) % 7);
  const days = Math.round(Date.UTC(now.getFullYear(), now.getMonth(), monday) / 86400000); // 1970-01-05 が月曜
  return Math.floor((days - 4) / 7);
}

// 今週のイベント
function currentEvent(now = new Date()) {
  const n = weekIndex(now);
  return EVENTS[((n % EVENTS.length) + EVENTS.length) % EVENTS.length];
}

// 次の月曜までの日数（今日を含む）
function eventDaysLeft(now = new Date()) { return 7 - ((now.getDay() + 6) % 7); }

// ---------- セーブデータ（profile.event） ----------
//   { week: 週の番号, wins, losses: いまの連戦の成績, active: 連戦の途中か, claimed: [今週もらった報酬の勝ち数] }

function newEventData() { return { week: null, wins: 0, losses: 0, active: false, claimed: [] }; }

function sanitizeEventData(e) {
  const out = newEventData();
  if (!e || typeof e !== 'object' || !Number.isInteger(e.week)) return out;
  const int = (v, max) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : 0);
  out.week = e.week;
  out.wins = int(e.wins, EVENT_CONFIG.BATTLES);
  out.losses = int(e.losses, EVENT_CONFIG.MAX_LOSSES);
  out.active = !!e.active && !eventOver(out);
  out.claimed = EVENT_TIERS.map(t => t.wins).filter(w => Array.isArray(e.claimed) && e.claimed.includes(w));
  return out;
}

// 連戦が終わったか（5戦したか、3敗した）
function eventOver(e) {
  return e.losses >= EVENT_CONFIG.MAX_LOSSES || e.wins + e.losses >= EVENT_CONFIG.BATTLES;
}

// 週が変わっていたら、成績と受け取った報酬を新しくする
function refreshEvent(profile, now = new Date()) {
  if (!isUnlocked(profile, 'event')) return false;
  const week = weekIndex(now);
  if (profile.event.week === week) return false;
  profile.event = { ...newEventData(), week };
  return true;
}

// 連戦を最初から始める
function startEventRun(profile, now = new Date()) {
  if (!isUnlocked(profile, 'event')) return false;
  refreshEvent(profile, now);
  Object.assign(profile.event, { wins: 0, losses: 0, active: true });
  return true;
}

// ---------- デッキ ----------

// いまのデッキのカードレベルの平均（貸し出しデッキと相手のデッキの強さに使う）
function deckLevel(profile) {
  const ids = [...profile.deck.monsters, ...profile.deck.items];
  return Math.max(1, Math.round(ids.reduce((n, id) => n + cardLevel(profile, id), 0) / ids.length));
}

// その色のモンスターだけのデッキか
function deckIsColor(deck, color) { return deck.monsters.every(id => CARD_DEFS[id].color === color); }

// その色のモンスターだけのランダムなデッキ（貸し出し・相手用）
function colorDeck(color, level, rng) {
  const deck = {
    monsters: shuffle(MONSTERS.filter(c => c.color === color), rng).slice(0, CONFIG.DECK_MONSTERS).map(c => c.id),
    items: shuffle(ITEMS.filter(c => !c.color || c.color === color), rng).slice(0, CONFIG.DECK_ITEMS).map(c => c.id),
    levels: {},
  };
  [...deck.monsters, ...deck.items].forEach(id => { deck.levels[id] = Math.min(level, maxLevel(id)); });
  deck.options = randomOptions(deck, rng);
  return deck;
}

// イベントで自分が使うデッキ。loaner: 貸し出しデッキか
function eventDeck(profile, ev, rng = Math.random) {
  const level = deckLevel(profile);
  const hero = heroForBattle(profile);
  if (ev.rule.randomDeck) return { ...randomDeck(rng, { level }), hero, loaner: true };
  if (ev.rule.deckColor && !deckIsColor(profile.deck, ev.rule.deckColor)) return { ...colorDeck(ev.rule.deckColor, level, rng), hero, loaner: true };
  return { ...deckForBattle(profile), loaner: false };
}

// イベントの相手のデッキ（自分と同じルールで組む）
function eventFoeDeck(profile, ev, rng = Math.random) {
  const level = deckLevel(profile);
  if (ev.rule.randomDeck) return { ...randomDeck(rng, { level }), hero: randomHero(profile, rng) };
  if (ev.rule.deckColor) return { ...colorDeck(ev.rule.deckColor, level, rng), hero: randomHero(profile, rng) };
  return cpuDeckFor(profile, rng);
}

// 次の対戦の準備：{ event, n: 何戦目か, deck, foeDeck, bonus: 相手の最初のクリスタルの上乗せ }
function eventBattle(profile, now = new Date(), rng = Math.random) {
  const ev = currentEvent(now);
  const n = profile.event.wins + profile.event.losses + 1;
  return { event: ev, n, deck: eventDeck(profile, ev, rng), foeDeck: eventFoeDeck(profile, ev, rng), bonus: EVENT_CONFIG.FOE_BONUS[n - 1] || 0 };
}

// ---------- 結果と報酬 ----------

// 対戦の結果を記録し、新しく届いた段階の報酬を渡す。
// { wins, losses, over, tiers: [{ wins, reward }] } を返す
function recordEventBattle(profile, win, now = new Date()) {
  const e = profile.event;
  if (!e.active) return null;
  const ev = currentEvent(now);
  if (win) e.wins++; else e.losses++;
  const tiers = [];
  for (const t of EVENT_TIERS) {
    if (t.wins > e.wins || e.claimed.includes(t.wins)) continue;
    e.claimed.push(t.wins);
    const reward = { ...t.reward };
    if (reward.elite) { delete reward.elite; reward.card = ev.elite; }
    if (reward.packs) { reward.bag = { ['event:' + ev.id]: reward.packs }; delete reward.packs; } // イベントの報酬のパックは、その週のイベントパック
    giveReward(profile, reward);
    tiers.push({ wins: t.wins, reward });
  }
  const over = eventOver(e);
  if (over) e.active = false;
  return { wins: e.wins, losses: e.losses, over, tiers };
}
