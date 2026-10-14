// ============================================================
// デイリークエストとログインボーナス（プレイヤーLv3で解放）
//   クエストは QUEST_DEFS に1行足せば増やせる。
//   進み具合は、対戦で数えた値（state.stats と勝敗）を stat の名前で受け取る。
//   日付は端末の時刻で決まる（日付が変わるとクエストが入れ替わる）。
// ============================================================

const DAILY = {
  QUESTS: 3,   // 1日のクエストの数
  SWAPS: 1,    // 1日に交換できる回数
};

// 報酬：{ gold, stones, packs, gifts }（gifts は、いま選んでいるヒーローのギフト）
//   stat: 数える値の名前
//     kill_melee / kill_ranged / kill_magic / kill_chaos … その攻撃で敵を倒した数
//     dodge … Flying で回避した回数　　flash / equip … 使った回数
//     play … 対戦した回数　win … 勝った回数　win_色 … その色のモンスターを含むデッキで勝った回数
//     stage_clear … ステージをクリアした回数　star3 … ★3でクリアした回数
const QUEST_DEFS = [
  { id: 'kill_magic', stat: 'kill_magic', n: 5, text: '魔法攻撃で敵を5体倒す', reward: { gold: 150 } },
  { id: 'kill_melee', stat: 'kill_melee', n: 6, text: '近接攻撃で敵を6体倒す', reward: { gold: 150 } },
  { id: 'kill_ranged', stat: 'kill_ranged', n: 5, text: '遠隔攻撃で敵を5体倒す', reward: { gold: 150 } },
  { id: 'kill_chaos', stat: 'kill_chaos', n: 4, text: 'カオス攻撃で敵を4体倒す', reward: { gold: 150 } },
  { id: 'dodge', stat: 'dodge', n: 3, text: 'Flying で3回回避する', reward: { gifts: 2 } },
  { id: 'flash', stat: 'flash', n: 6, text: 'フラッシュを6回使う', reward: { gold: 120 } },
  { id: 'equip', stat: 'equip', n: 6, text: '装備を6回使う', reward: { gold: 120 } },
  { id: 'play', stat: 'play', n: 4, text: '対戦を4回する', reward: { stones: 20 } },
  { id: 'win', stat: 'win', n: 3, text: '対戦で3勝する', reward: { packs: 1 } },
  { id: 'stage_clear', stat: 'stage_clear', n: 2, text: 'ステージを2回クリア', reward: { stones: 30 } },
  { id: 'star3', stat: 'star3', n: 1, text: 'ステージを★3でクリア', reward: { gifts: 3 } },
  ...Object.keys(COLORS).map(c => (
    { id: 'win_' + c, stat: 'win_' + c, n: 3, text: `${COLORS[c].name}を含むデッキで3勝`, reward: { stones: 30 } })),
];
const QUEST_BY_ID = {};
QUEST_DEFS.forEach(q => { QUEST_BY_ID[q.id] = q; });

// ログインボーナス（7日周期。7日目はパック）。日が空いてもリセットしない
const LOGIN_REWARDS = [{ gold: 100 }, { stones: 20 }, { gold: 150 }, { gifts: 3 }, { stones: 40 }, { gold: 300 }, { packs: 1 }];

// 端末の時刻での「今日」（例：2026-10-04）
function dayKey(now = new Date()) {
  const two = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

// ---------- セーブデータ（profile.daily） ----------
//   { date: クエストの日付, quests: [{ id, progress, claimed }], swaps: 今日交換した回数,
//     loginDate: 最後にログインボーナスをもらった日, loginCount: もらった回数の合計 }

function newDailyData() {
  return { date: null, quests: [], swaps: 0, loginDate: null, loginCount: 0 };
}

function sanitizeDailyData(d) {
  const out = newDailyData();
  if (!d || typeof d !== 'object') return out;
  const int = (v, x) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : x);
  const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (isDay(d.date)) out.date = d.date;
  if (isDay(d.loginDate)) out.loginDate = d.loginDate;
  out.loginCount = int(d.loginCount, 0);
  out.swaps = int(d.swaps, 0);
  for (const q of Array.isArray(d.quests) ? d.quests : []) {
    if (q && QUEST_BY_ID[q.id] && out.quests.length < DAILY.QUESTS && !out.quests.some(x => x.id === q.id)) {
      out.quests.push({ id: q.id, progress: Math.min(int(q.progress, 0), QUEST_BY_ID[q.id].n), claimed: !!q.claimed });
    }
  }
  if (out.quests.length !== DAILY.QUESTS) { out.date = null; out.quests = []; out.swaps = 0; } // 壊れていたら、次の更新で作り直す
  return out;
}

// ---------- 報酬 ----------

function giveReward(profile, reward) {
  profile.gold += reward.gold || 0;
  profile.stones += reward.stones || 0;
  profile.packs += reward.packs || 0;   // 通常パック
  addPackBag(profile, reward.bag);       // そのほかのパック { 種類: 数 }
  if (reward.gifts) giveHeroGift(profile, reward.gifts);
  if (reward.card) addCard(profile, reward.card); // カード（イベントの Elite カードなど）
  return reward;
}

function rewardText(reward) {
  return [reward.gold && `💰${reward.gold}`, reward.stones && `🔷${reward.stones}`, reward.packs && `🎁パック×${reward.packs}`, reward.bag && packBagText(reward.bag),
    reward.gifts && `🎀ギフト×${reward.gifts}`, reward.card && `✨${CARD_DEFS[reward.card].name}（Elite）`, reward.elite && '✨Eliteカード'].filter(x => x).join('　');
}

// ---------- クエスト ----------

// 日付が変わっていたら、今日のクエスト3つを選び直す。更新したら true
function refreshDaily(profile, now = new Date(), rng = Math.random) {
  if (!isUnlocked(profile, 'daily')) return false;
  const today = dayKey(now);
  if (profile.daily.date === today) return false;
  const ids = shuffle(QUEST_DEFS.map(q => q.id), rng).slice(0, DAILY.QUESTS);
  profile.daily.date = today;
  profile.daily.quests = ids.map(id => ({ id, progress: 0, claimed: false }));
  profile.daily.swaps = 0;
  return true;
}

const questDone = q => q.progress >= QUEST_BY_ID[q.id].n;

// 対戦の結果から、クエストで数える値を作る
//   state: 終わった対戦　win: 勝ったか　mode: { type: 'stage' / 'free', … }
function battleStats(state, win, mode, deck) {
  const stats = { ...state.stats[0], play: 1 };
  if (!win) return stats;
  stats.win = 1;
  new Set(deck.monsters.map(id => CARD_DEFS[id].color)).forEach(c => { stats['win_' + c] = 1; });
  if (mode && mode.type === 'stage') {
    stats.stage_clear = 1;
    if (starsFor(monstersLeft(state.players[0])) === 3) stats.star3 = 1;
  }
  return stats;
}

// 対戦で数えた値をクエストに足す。この対戦で達成したクエストの一覧を返す
function questProgress(profile, stats, now = new Date(), rng = Math.random) {
  if (!isUnlocked(profile, 'daily')) return [];
  refreshDaily(profile, now, rng);
  const done = [];
  for (const q of profile.daily.quests) {
    const def = QUEST_BY_ID[q.id];
    if (questDone(q) || !stats[def.stat]) continue;
    q.progress = Math.min(def.n, q.progress + stats[def.stat]);
    if (questDone(q)) done.push(def);
  }
  return done;
}

// 達成したクエストの報酬を受け取る
function claimQuest(profile, index) {
  const q = profile.daily.quests[index];
  if (!q || q.claimed || !questDone(q)) return null;
  q.claimed = true;
  return giveReward(profile, QUEST_BY_ID[q.id].reward);
}

// 報酬をまとめる：同じ種類は合計する（カードは対象外）
function sumRewards(list) {
  const total = {};
  for (const k of ['gold', 'stones', 'packs', 'gifts']) {
    const n = list.reduce((sum, r) => sum + (r[k] || 0), 0);
    if (n) total[k] = n;
  }
  return total;
}

// まとめて受け取れるか（達成済みで未受け取りの報酬が2つ以上あるとき）
function canClaimAll(profile) { return dailyStatus(profile).claimable >= 2; }

// 達成済みで未受け取りのクエスト報酬を、まとめて受け取る。
// { count: 受け取った数, total: 種類ごとの合計, hero: ギフトが入ったヒーローの名前（ギフトがなければ null） } を返す
function claimAllQuests(profile) {
  if (!canClaimAll(profile)) return null;
  const rewards = [];
  profile.daily.quests.forEach((q, i) => { const r = claimQuest(profile, i); if (r) rewards.push(r); });
  const total = sumRewards(rewards);
  return { count: rewards.length, total, hero: total.gifts ? HERO_BY_ID[profile.hero.selected].name : null };
}

// クエストを別のものに交換する（1日1回。達成済みのものは交換できない）
function canSwapQuest(profile, index) {
  const q = profile.daily.quests[index];
  return !!q && !questDone(q) && profile.daily.swaps < DAILY.SWAPS;
}
function swapQuest(profile, index, rng = Math.random) {
  if (!canSwapQuest(profile, index)) return false;
  const have = profile.daily.quests.map(q => q.id);
  const pool = QUEST_DEFS.filter(q => !have.includes(q.id));
  profile.daily.quests[index] = { id: pool[Math.floor(rng() * pool.length)].id, progress: 0, claimed: false };
  profile.daily.swaps++;
  return true;
}

// タイトル画面のバッジ用：{ total, done: 達成した数, claimable: 受け取れる報酬の数 }
function dailyStatus(profile) {
  const qs = profile.daily.quests;
  return { total: qs.length, done: qs.filter(questDone).length, claimable: qs.filter(q => questDone(q) && !q.claimed).length };
}

// ---------- ログインボーナス ----------

// 今日まだもらっていなければ、ログインボーナスを渡す。{ day: 1〜7, reward } を返す（もらい済みなら null）
function claimLogin(profile, now = new Date()) {
  if (!isUnlocked(profile, 'daily')) return null;
  const today = dayKey(now);
  if (profile.daily.loginDate === today) return null;
  const day = profile.daily.loginCount % LOGIN_REWARDS.length; // 日が空いても、続きから
  profile.daily.loginDate = today;
  profile.daily.loginCount++;
  return { day: day + 1, reward: giveReward(profile, LOGIN_REWARDS[day]) };
}
