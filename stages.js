// ============================================================
// ステージモード（1-1 〜 5-10）
// 各章の 1〜9 は「色・カードレベル・強いカードの枚数」で相手のデッキが決まる。
// 10 はボスで、デッキを1枚ずつ指定している。
// ============================================================

const STAGE_RULES = {
  STAR_2: 4,   // クリア時の残りモンスター数（場＋手札＋山札）がこの数以上で ★★
  STAR_3: 6,   // この数以上で ★★★
};

// 章の定義
//   stages: 1〜9 の設定を上から順に並べる
//     colors: 相手が使う色 / level: カードレベル / rarity: 使ってよい最高レアリティ
//     strong: コモン以外のカードの枚数（モンスターとアイテムそれぞれ、この数まで入る）
//     income: 相手が毎ターンもらうクリスタルの増減（-1 は入門用の手加減）
//     bonus:  相手が最初から持っているクリスタル（強敵・ボスの補正）
//   並びと数値は、balance.html の「基準デッキでの勝率」が章の中でなだらかに下がるように決めている
//   boss: 10番目のステージ。deck を1枚ずつ指定する
const CHAPTERS = [
  {
    id: 1, name: 'はじまりの草原', icon: '🌱',
    // 地形（1〜9。terrains.js の id）
    terrains: ['plain', 'plain', 'plain', 'plain', 'plain', 'volcano', 'plain', 'volcano', 'volcano'],
    stages: [
      { colors: ['green'], level: 1, rarity: 'common', strong: 0, income: -1, bonus: -4 },
      { colors: ['red'], level: 1, rarity: 'common', strong: 0, income: -1, bonus: 5 },
      { colors: ['yellow'], level: 1, rarity: 'common', strong: 0, income: -1, bonus: 1 },
      { colors: ['red', 'green'], level: 1, rarity: 'common', strong: 0, bonus: -2 },
      { colors: ['red', 'purple'], level: 1, rarity: 'common', strong: 0 },
      { colors: ['red', 'yellow'], level: 1, rarity: 'common', strong: 0, bonus: 1 },
      { colors: ['purple'], level: 1, rarity: 'rare', strong: 1, bonus: -3 },
      { colors: ['yellow', 'purple'], level: 1, rarity: 'rare', strong: 2, bonus: 4 },
      { colors: ['purple'], level: 1, rarity: 'rare', strong: 2, bonus: 1 },
    ],
    boss: {
      enemy: '突撃隊長ガルド', terrain: 'hill', icon: '🎖️', level: 1, bonus: 0,
      feature: '赤の近接特化。Inspire で味方の近接攻撃を強化し、Batter と Doublestrike で畳みかけてくる。',
      hint: 'Thorns やアーマーで近接を受け止めるか、Demoralize で近接攻撃を下げよう。',
      deck: {
        // ボスは、特徴になるカードを2枚入れている（ここでは Inspire の「鬨の太鼓打ち」）
        monsters: ['r01', 'r02', 'r03', 'r03', 'r04', 'r05', 'r06', 'y02'],
        // （2枚入りで強くなったぶん、火球を狩人の弓に替えている）
        items: ['e01', 'e11', 'e12', 'e05', 'e04', 'f01', 'e02', 'f04'],
      },
    },
  },
  {
    id: 2, name: '霧の湖', icon: '🌊',
    // 地形（1〜9。terrains.js の id）
    terrains: ['mist', 'plain', 'mist', 'castle', 'mist', 'castle', 'mist', 'castle', 'mist'],
    stages: [
      { colors: ['purple'], level: 1, rarity: 'rare', strong: 2, bonus: -4 },
      { colors: ['red', 'purple'], level: 1, rarity: 'rare', strong: 3, bonus: 1 },
      { colors: ['blue', 'purple'], level: 1, rarity: 'rare', strong: 4, bonus: 1 },
      { colors: ['yellow', 'purple'], level: 1, rarity: 'rare', strong: 4, bonus: 5 },
      { colors: ['blue', 'yellow'], level: 2, rarity: 'rare', strong: 2, bonus: 4 },
      { colors: ['red', 'blue'], level: 2, rarity: 'rare', strong: 2, bonus: -3 },
      { colors: ['blue'], level: 2, rarity: 'rare', strong: 4, bonus: -4 },
      { colors: ['red', 'purple'], level: 2, rarity: 'rare', strong: 5, bonus: 4 },
      { colors: ['blue'], level: 2, rarity: 'rare', strong: 3, bonus: -3 },
    ],
    boss: {
      enemy: '霧の女王セレーネ', terrain: 'deepmist', icon: '🧜', level: 2, bonus: 3,
      feature: '青の魔法封じ。Silence で魔法攻撃と Heal を止め、Suppress Magic で魔法攻撃力を下げてくる。',
      hint: '魔法に頼らず、近接・遠隔で攻めよう。Perseverance 持ちは封じられない。',
      deck: {
        // 2枚：Silence の「霧の語り部」
        monsters: ['b01', 'b02', 'b03', 'b04', 'b04', 'b05', 'b06', 'b07'],
        // （2枚入りで強くなったぶん、稲妻を狩人の弓に替えている）
        items: ['e13', 'e14', 'e03', 'e06', 'e05', 'e02', 'f14', 'f07'],
      },
    },
  },
  {
    id: 3, name: '茨の森', icon: '🌵',
    // 地形（1〜9。terrains.js の id）
    terrains: ['forest', 'forest', 'plain', 'forest', 'swamp', 'forest', 'forest', 'swamp', 'forest'],
    stages: [
      { colors: ['red'], level: 2, rarity: 'rare', strong: 4, bonus: 2 },
      { colors: ['yellow'], level: 2, rarity: 'rare', strong: 6, bonus: 1 },
      { colors: ['yellow', 'purple'], level: 2, rarity: 'epic', strong: 6, bonus: -3 },
      { colors: ['red', 'blue'], level: 2, rarity: 'epic', strong: 8, bonus: -3 },
      { colors: ['red', 'green'], level: 3, rarity: 'rare', strong: 4, bonus: 5 },
      { colors: ['red'], level: 3, rarity: 'epic', strong: 4, bonus: -4 },
      { colors: ['green', 'purple'], level: 3, rarity: 'epic', strong: 3, bonus: -4 },
      { colors: ['yellow', 'purple'], level: 3, rarity: 'epic', strong: 3, bonus: -4 },
      { colors: ['green'], level: 3, rarity: 'epic', strong: 4, bonus: -3 },
    ],
    boss: {
      enemy: '茨の守護者ユグ', terrain: 'worldtree', icon: '🌲', level: 3, bonus: 0, options: { g07: 0, g08: 0 },
      feature: '緑の耐久特化。Heal と Group Heal で回復し、Thorns で近接攻撃を跳ね返し、Entangle で拘束してくる。',
      hint: 'Silence で Heal を止めるか、Disease で回復を打ち消そう。遠隔・魔法なら Thorns を受けない。',
      deck: {
        // 2枚：Thorns の「いばらの番人」
        monsters: ['g02', 'g03', 'g04', 'g04', 'g05', 'g06', 'g07', 'g08'],
        // g07=Thorns、g08=Healing Shield（耐久の特徴に合わせた選択スキル）
        items: ['e15', 'e16', 'e08', 'e06', 'e05', 'f03', 'f07', 'f11'],
      },
    },
  },
  {
    id: 4, name: '天空の砦', icon: '🏰',
    // 地形（1〜9。terrains.js の id）
    terrains: ['sky', 'sky', 'plain', 'sky', 'volcano', 'sky', 'sky', 'castle', 'sky'],
    stages: [
      { colors: ['green'], level: 3, rarity: 'epic', strong: 4, bonus: -2 },
      { colors: ['blue', 'green'], level: 3, rarity: 'epic', strong: 6, bonus: -4 },
      { colors: ['yellow'], level: 3, rarity: 'epic', strong: 7 },
      { colors: ['red', 'yellow'], level: 3, rarity: 'epic', strong: 8, bonus: -1 },
      { colors: ['blue', 'purple'], level: 4, rarity: 'epic', strong: 4, bonus: -4 },
      { colors: ['green'], level: 4, rarity: 'epic', strong: 5, bonus: -4 },
      { colors: ['green', 'purple'], level: 4, rarity: 'epic', strong: 2, bonus: -1 },
      { colors: ['green', 'yellow'], level: 4, rarity: 'epic', strong: 4, bonus: -2 },
      { colors: ['blue', 'green'], level: 4, rarity: 'epic', strong: 4, bonus: -3 },
    ],
    boss: {
      enemy: '天空王アクィラ', terrain: 'storm', icon: '👑', level: 5, bonus: -2, options: { y08: 0, y12: 0, r08: 0, e18: 0 },
      feature: '黄の Flying 特化。Flying で近接を50%・遠隔を25%回避し、Shoot Command で強化した遠隔攻撃を後列から撃ってくる。',
      hint: 'Anti-Air 持ちなら回避されない。魔法とカオスも回避できない。Entangle で Flying を失わせるのも有効。',
      deck: {
        // 2枚：Shoot Command の「号令の旗手」
        monsters: ['y03', 'y08', 'r08', 'y04', 'y04', 'y05', 'y07', 'y06'],
        items: ['e18', 'e17', 'e02', 'e06', 'f02', 'f09', 'f06', 'f13'],
      },
    },
  },
  {
    id: 5, name: '混沌の城', icon: '🏯',
    // 地形（1〜9。terrains.js の id）
    terrains: ['castle', 'swamp', 'castle', 'swamp', 'volcano', 'castle', 'swamp', 'castle', 'swamp'],
    stages: [
      { colors: ['green'], level: 4, rarity: 'legend', strong: 6, bonus: -2 },
      { colors: ['purple'], level: 4, rarity: 'legend', strong: 7, bonus: -4 },
      { colors: ['green'], level: 4, rarity: 'legend', strong: 8, bonus: -4 },
      { colors: ['blue', 'yellow'], level: 4, rarity: 'legend', strong: 8, bonus: -1 },
      { colors: ['blue'], level: 5, rarity: 'legend', strong: 5, bonus: -2 },
      { colors: ['purple'], level: 5, rarity: 'legend', strong: 6, bonus: -4 },
      { colors: ['blue', 'purple'], level: 5, rarity: 'legend', strong: 6, bonus: -4 },
      { colors: ['blue', 'green'], level: 5, rarity: 'legend', strong: 8, bonus: -3 },
      { colors: ['red'], level: 5, rarity: 'legend', strong: 8 },
    ],
    boss: {
      enemy: '終焉の魔王ネザー', terrain: 'throne', icon: '😈', level: 5, bonus: 0, options: { p08: 0, p07: 1, p09: 1, p11: 0 },
      feature: '紫の Disease 特化。カオス攻撃で Disease を広げ、Outbreak で起爆し、Demoralize で近接攻撃を下げてくる。',
      hint: 'Cleanse・Mass Cleanse で Disease を解除しよう。Perseverance 持ちには Disease も Demoralize も効かない。',
      deck: {
        // 2枚：Disease の「疫病ネズミ」
        monsters: ['p02', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08'],
        items: ['e19', 'e20', 'e10', 'e06', 'f05', 'f12', 'f09', 'f13'],
      },
    },
  },
];

// 全ステージを順番に並べた一覧
const STAGES = [];
CHAPTERS.forEach(ch => {
  ch.stages.forEach((st, i) => {
    STAGES.push({
      id: `${ch.id}-${i + 1}`, chapter: ch.id, number: i + 1, boss: false,
      enemy: `${ch.name}の${st.colors.map(c => COLORS[c].name).join('・')}使い`, icon: ch.icon, ...st,
      terrain: ch.terrains[i],
    });
  });
  STAGES.push({ id: `${ch.id}-10`, chapter: ch.id, number: 10, boss: true, ...ch.boss });
});
const STAGE_BY_ID = {};
STAGES.forEach((s, i) => { s.index = i; STAGE_BY_ID[s.id] = s; });

// ステージの設定から決まる乱数（同じ設定のステージは、いつも同じデッキになる）
function stageRng(stage) {
  let seed = 0;
  // seed: デッキを決める乱数の種（省略時は strong）。strong だけを下げても、同じ並びから「強いカードを減らした」デッキになるようにする
  const key = `${stage.colors.join('+')}|${stage.level}|${stage.rarity}|${stage.seed === undefined ? stage.strong : stage.seed}`;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

// そのステージの相手のデッキ
function stageDeck(stage) {
  let monsters, items;
  if (stage.deck) {
    ({ monsters, items } = stage.deck);
  } else {
    const rng = stageRng(stage);
    const maxRarity = RARITY_ORDER.indexOf(stage.rarity);
    const rank = c => RARITY_ORDER.indexOf(c.rarity);
    // 強いカード（コモン以外）を strong 枚まで、残りはコモン。その色のカードを優先する
    const pick = (pool, fits, n) => {
      const ok = shuffle(pool.filter(c => rank(c) <= maxRarity), rng);
      const mine = ok.filter(fits), other = ok.filter(c => !fits(c));
      const strong = mine.filter(c => rank(c) > 0).sort((a, b) => rank(b) - rank(a)).slice(0, stage.strong);
      const rest = [...mine.filter(c => rank(c) === 0), ...other.filter(c => rank(c) === 0),
        ...mine.filter(c => rank(c) > 0 && !strong.includes(c)), ...other.filter(c => rank(c) > 0)];
      return [...strong, ...rest].slice(0, n).map(c => c.id);
    };
    monsters = pick(MONSTERS, c => stage.colors.includes(c.color), CONFIG.DECK_MONSTERS);
    // 序盤に出せるモンスターが1体もいないデッキにはしない（いちばん安いモンスターを1体入れる）
    const early = id => CARD_DEFS[id].cost <= CONFIG.CRYSTALS_PER_TURN;
    if (!monsters.some(early)) {
      const cheap = MONSTERS.filter(c => rank(c) <= maxRarity && c.cost <= CONFIG.CRYSTALS_PER_TURN && !monsters.includes(c.id))
        .sort((a, b) => stage.colors.includes(b.color) - stage.colors.includes(a.color) || rank(b) - rank(a))[0];
      monsters[monsters.length - 1] = cheap.id;
    }
    items = pick(ITEMS, c => !c.color || stage.colors.includes(c.color), CONFIG.DECK_ITEMS);
  }
  const levels = {};
  [...monsters, ...items].forEach(id => { levels[id] = Math.min(stage.level, maxLevel(id)); });
  const deck = { monsters: monsters.slice(), items: items.slice(), levels };
  // 選択スキルも、ステージごとに決まったものを持つ（ボスは options で指定できる）
  deck.options = { ...randomOptions(deck, stageRng({ colors: [stage.id], level: stage.level, rarity: 'opt', strong: 0 })), ...(stage.options || {}) };
  deck.hero = stageHero(stage); // 相手のヒーロー（ボスは専用のヒーロースキル）
  return deck;
}

// ---------- 進行（セーブデータの profile.stages = { ステージid: 星の数 }） ----------

function stageStars(profile, id) { return (profile.stages && profile.stages[id]) || 0; }

// 1つ前のステージをクリアしていれば挑戦できる（1-1 は最初から）
function stageUnlocked(profile, id) {
  const stage = STAGE_BY_ID[id];
  return stage.index === 0 || stageStars(profile, STAGES[stage.index - 1].id) > 0;
}

function nextStage(id) { return STAGES[STAGE_BY_ID[id].index + 1] || null; }

// 星評価：クリア時の残りモンスター数で決まる
function starsFor(left) {
  return left >= STAGE_RULES.STAR_3 ? 3 : left >= STAGE_RULES.STAR_2 ? 2 : 1;
}

// 初クリア報酬。章が進むほど多く、ボスは特に多い
function stageReward(stage) {
  const ch = stage.chapter;
  // パック：章の5番目は、その章のテーマの色のパック。ボスは高級パック1つ＋色のパック2つ
  const color = PACK_SHOP.CHAPTER_COLOR[ch];
  if (stage.boss) return { gold: 200 * ch, stones: 50 * ch, packs: 0, bag: { premium: 1, [color]: 2 } };
  const reward = { gold: 40 * ch, stones: 10 * ch, packs: 0 };
  if (stage.number === 5) reward.bag = { [color]: 1 };
  return reward;
}

// クリアを記録する。初クリアなら報酬を渡す。{ stars, best, firstClear, reward } を返す
function recordStageClear(profile, id, left) {
  profile.stages = profile.stages || {};
  const stars = starsFor(left);
  const before = stageStars(profile, id);
  const firstClear = before === 0;
  let reward = null;
  if (firstClear) {
    reward = stageReward(STAGE_BY_ID[id]);
    profile.gold += reward.gold;
    profile.stones += reward.stones;
    profile.packs += reward.packs;
    addPackBag(profile, reward.bag);
  }
  profile.stages[id] = Math.max(before, stars);
  return { stars, best: profile.stages[id], firstClear, reward };
}

function chapterProgress(profile, chapterId) {
  const list = STAGES.filter(s => s.chapter === chapterId);
  return {
    cleared: list.filter(s => stageStars(profile, s.id) > 0).length,
    stars: list.reduce((n, s) => n + stageStars(profile, s.id), 0),
    total: list.length,
  };
}
