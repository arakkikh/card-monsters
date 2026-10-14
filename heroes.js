// ============================================================
// ヒーローとヒーロースキル
//   デッキを組むときにヒーローを1人選び、そのヒーロースキルを1つ選んで戦う。
//   スキルの処理は engine.js にある（heroIs(プレイヤー, スキルid) で判定している）。
// ============================================================

const HERO_RULES = {
  MAX_LEVEL: 20,
  SKILL_LEVELS: [1, 10, 20],   // 1つ目・2つ目・3つ目のスキルが解放されるヒーローレベル
  GIFT_WIN: 2,                 // ヒーロースキルを使って勝つともらえるギフト
  START: 'leafia',             // 最初から使えるヒーロー
};

// ヒーロー（各色1人）
//   card:   対応するモンスターカード（ヒーロー解放時に1枚もらえる）
//   unlock: 解放条件のステージid（null は最初から）
//   skills: ヒーロースキル3つ（上から、ヒーローLv1・Lv10・Lv20で解放）
const HEROES = [
  {
    id: 'leafia', name: '森の巫女リーフィア', color: 'green', card: 'g12', unlock: null,
    skills: [
      { id: 'breeze', name: '癒しの風', yomi: 'いやしのかぜ', desc: '自分のターン開始時、最もHPの低い味方を2回復する' },
      { id: 'firstaid', name: '応急の心得', yomi: 'おうきゅうのこころえ', desc: '装備やフラッシュを使うたびに、最もHPの低い味方を3回復する' },
      { id: 'healplus', name: '治癒の極意', yomi: 'ちゆのごくい', desc: '味方の Heal の数値が+1になる' },
    ],
  },
  {
    id: 'agni', name: '炎将アグニ', color: 'red', card: 'r13', unlock: '1-10',
    skills: [
      { id: 'warcry', name: '不屈の鬨', yomi: 'ふくつのとき', desc: '味方の Inspire の数値が+1になり、Disease 状態でも Inspire を使える' },
      { id: 'vanguard', name: '先陣の誉れ', yomi: 'せんじんのほまれ', desc: '前列（スロット1）にいる味方の近接攻撃+1' },
      { id: 'spoils', name: '戦利品', yomi: 'せんりひん', desc: '味方が攻撃で敵を倒すたびに、クリスタル+1' },
    ],
  },
  {
    id: 'mist', name: '氷賢者ミスト', color: 'blue', card: 'b13', unlock: '2-10',
    skills: [
      { id: 'purify', name: '清めの儀', yomi: 'きよめのぎ', desc: '攻撃フェーズ開始時、味方全員のデバフを解除する' },
      { id: 'surge', name: '魔力の奔流', yomi: 'まりょくのほんりゅう', desc: '味方の魔法攻撃+1' },
      { id: 'ward', name: '静寂の結界', yomi: 'せいじゃくのけっかい', desc: '味方が受ける魔法ダメージ-1' },
    ],
  },
  {
    id: 'soleil', name: '天弓のソレイユ', color: 'yellow', card: 'y14', unlock: '3-10',
    skills: [
      { id: 'hawkeye', name: '鷹の目', yomi: 'たかのめ', desc: '味方の遠隔攻撃が Taunt と Stealth を無視し、アーマーにブロックされない' },
      { id: 'volley', name: '一斉射撃', yomi: 'いっせいしゃげき', desc: '味方の遠隔攻撃+1' },
      { id: 'command', name: '射手の号令', yomi: 'いてのごうれい', desc: '味方の Shoot Command の数値が+1になる' },
    ],
  },
  {
    id: 'venoa', name: '毒姫ヴェノア', color: 'purple', card: 'p13', unlock: '4-10',
    skills: [
      { id: 'venomblade', name: '蝕む刃', yomi: 'むしばむやいば', desc: '近接・カオスの味方は、場に出したときに Disease 1（スキル）を得る' },
      { id: 'contagion', name: '道連れの病', yomi: 'みちづれのやまい', desc: 'Disease を持つ味方が攻撃で倒されたら、倒した敵に Disease 2 を与える' },
      { id: 'virulence', name: '猛毒', yomi: 'もうどく', desc: '味方の Disease の数値が+1になる' },
    ],
  },
];

// ボス専用のヒーロースキル（プレイヤーは使えない）
const BOSS_HERO_SKILLS = {
  '1-10': { id: 'boss_charge', name: '突撃号令', yomi: 'とつげきごうれい', desc: '前列（スロット1）にいる味方の近接攻撃+1' },
  '2-10': { id: 'boss_fog', name: '霧の帳', yomi: 'きりのとばり', desc: '自分のターン開始時、3ターンに1度、ランダムな味方1体が Fog 状態になる' },
  '3-10': { id: 'boss_thorns', name: '茨の加護', yomi: 'いばらのかご', desc: '味方全員が Thorns 1 を得る' },
  '4-10': { id: 'boss_sky', name: '天空の覇者', yomi: 'てんくうのはしゃ', desc: 'Flying を持つ味方の近接攻撃・遠隔攻撃+1' },
  '5-10': { id: 'boss_plague', name: '蔓延', yomi: 'まんえん', desc: '自分のターン開始時、敵全員に Disease 1 を与える' },
};

const HERO_BY_ID = {};
HEROES.forEach(h => { HERO_BY_ID[h.id] = h; });
// スキルid → 名前・説明（ボス専用も含む）
const HERO_SKILL_INFO = {};
HEROES.forEach(h => h.skills.forEach(k => { HERO_SKILL_INFO[k.id] = { ...k, hero: h.id }; }));
Object.values(BOSS_HERO_SKILLS).forEach(k => { HERO_SKILL_INFO[k.id] = k; });

// ---------- セーブデータ（profile.hero） ----------
//   { selected: ヒーローid, skill: 選んだスキルの番号, unlocked: [id], levels: { id: Lv }, gifts: { id: 数 } }

function newHeroData() {
  return { selected: HERO_RULES.START, skill: 0, unlocked: [HERO_RULES.START], levels: { [HERO_RULES.START]: 1 }, gifts: { [HERO_RULES.START]: 0 } };
}

// 読み込んだデータを点検する（古いセーブにはヒーローのデータがないので、初期値を補う）
function sanitizeHeroData(h) {
  const out = newHeroData();
  if (!h || typeof h !== 'object') return out;
  const int = (v, d) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  for (const id of Array.isArray(h.unlocked) ? h.unlocked : []) {
    if (HERO_BY_ID[id] && !out.unlocked.includes(id)) out.unlocked.push(id);
  }
  for (const id of out.unlocked) {
    out.levels[id] = Math.max(1, Math.min(int((h.levels || {})[id], 1), HERO_RULES.MAX_LEVEL));
    out.gifts[id] = int((h.gifts || {})[id], 0);
  }
  if (out.unlocked.includes(h.selected)) out.selected = h.selected;
  out.skill = heroSkillUnlocked({ hero: out }, out.selected, h.skill) ? h.skill : 0;
  return out;
}

function heroLevel(profile, id) { return profile.hero.levels[id] || 0; }

// そのスキル（番号）を使えるか（ヒーローを解放済みで、ヒーローレベルが足りている）
function heroSkillUnlocked(profile, id, index) {
  const need = HERO_RULES.SKILL_LEVELS[index];
  return profile.hero.unlocked.includes(id) && need !== undefined && (profile.hero.levels[id] || 1) >= need;
}

// ヒーローとスキルを選ぶ
function selectHero(profile, id, index = 0) {
  if (!heroSkillUnlocked(profile, id, index)) return false;
  profile.hero.selected = id;
  profile.hero.skill = index;
  // 使用中のデッキにも覚えさせる（ヒーローとスキルは、デッキごとに保存する）
  const deck = profile.decks && typeof activeDeck === 'function' ? activeDeck(profile) : null;
  if (deck) { deck.hero = id; deck.skill = index; }
  return true;
}

// 対戦に持っていくヒーロー { id, skill: スキルid }
function heroForBattle(profile) {
  const hero = HERO_BY_ID[profile.hero.selected];
  return { id: hero.id, name: hero.name, skill: hero.skills[profile.hero.skill].id };
}

// ステージの進行で解放されるヒーローを解放する。解放時に、対応するモンスターカードを1枚もらえる。
// 新しく解放されたヒーローの一覧を返す
function unlockHeroes(profile) {
  const fresh = [];
  for (const hero of HEROES) {
    if (profile.hero.unlocked.includes(hero.id)) continue;
    if (hero.unlock && stageStars(profile, hero.unlock) === 0) continue;
    profile.hero.unlocked.push(hero.id);
    profile.hero.levels[hero.id] = 1;
    profile.hero.gifts[hero.id] = 0;
    addCard(profile, hero.card);
    fresh.push(hero);
  }
  return fresh;
}

// 次のレベルに必要なギフトの数（最大レベルなら null）
function heroLevelCost(level) {
  return level >= HERO_RULES.MAX_LEVEL ? null : Math.ceil(level / 2);
}

// ギフトを使ってヒーローのレベルを1上げる。新しく解放されたスキルがあれば返す
function levelUpHero(profile, id) {
  const level = heroLevel(profile, id);
  const cost = level ? heroLevelCost(level) : null;
  if (cost === null || (profile.hero.gifts[id] || 0) < cost) return null;
  profile.hero.gifts[id] -= cost;
  profile.hero.levels[id] = level + 1;
  const i = HERO_RULES.SKILL_LEVELS.indexOf(level + 1);
  return { level: level + 1, skill: i > 0 ? HERO_BY_ID[id].skills[i] : null };
}

// ヒーロースキルを使って勝ったときのギフト。もらえた数を返す
function giveHeroGift(profile, n = HERO_RULES.GIFT_WIN) {
  const id = profile.hero.selected;
  profile.hero.gifts[id] = (profile.hero.gifts[id] || 0) + n;
  return n;
}

// ---------- CPUのヒーロー ----------

// ステージの相手のヒーロー。ボスは専用スキル。1-1〜1-3（入門）はヒーローなし。
// それ以外は、相手の色のヒーローで、章が進むほど後ろのスキルを使う
function stageHero(stage) {
  if (stage.boss) {
    const k = BOSS_HERO_SKILLS[stage.id];
    return { id: 'boss', name: stage.enemy, skill: k.id, boss: stage.id };
  }
  if (stage.income < 0) return null;
  const hero = HEROES.find(h => h.color === stage.colors[0]);
  const index = stage.chapter >= 5 ? 2 : stage.chapter >= 3 ? 1 : 0;
  return { id: hero.id, name: hero.name, skill: hero.skills[index].id };
}

// フリー対戦の相手のヒーロー：ランダムなヒーローで、プレイヤーが使っているのと同じ番号のスキル
function randomHero(profile, rng = Math.random) {
  const hero = HEROES[Math.floor(rng() * HEROES.length)];
  return { id: hero.id, name: hero.name, skill: hero.skills[profile ? profile.hero.skill : 0].id };
}
