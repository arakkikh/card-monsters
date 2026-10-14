// ============================================================
// パックの種類（画面には触らない）
//   profile.packs   … 通常パックの数（今までのパックは、すべて通常パック）
//   profile.packBag … そのほかのパックの数 { 種類: 数 }
//   種類の id： normal / red・blue・green・yellow・purple / premium / monster / item / hero:ヒーローid / event:イベントid
//   どのパックも GROWTH.PACK_SIZE 枚入りで、最後の1枚はレア以上（guarantee で変えられる）。Elite カードは出ない。
// ============================================================

const PACK_SHOP = {
  HERO_LEVEL: 3,     // ヒーローパックを買えるヒーローレベル
  BOOST: 4,          // 「出やすい」カードの出やすさ（ほかのカードの何倍か）
  // 章のテーマの色（その章のステージの初クリアでもらえる色のパック）
  CHAPTER_COLOR: { 1: 'red', 2: 'blue', 3: 'green', 4: 'yellow', 5: 'purple' },
};

// 高級パック・イベントパックの排出率（1枚ごと）
const PACK_RATES_PREMIUM = { common: 0.40, rare: 0.38, epic: 0.17, legend: 0.05 };
const PACK_RATES_EVENT = { common: 0.55, rare: 0.30, epic: 0.12, legend: 0.03 };

const PACK_COLOR_HEX = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7' };

// ヒーローと相性のよいスキル（ヒーローパックで出やすい）
const HERO_PACK_SKILLS = {
  leafia: ['heal', 'groupheal', 'cleanse', 'masscleanse', 'healingshield', 'thorns'],
  agni: ['inspire', 'batter', 'doublestrike', 'crosscounter', 'reach'],
  mist: ['silence', 'suppress', 'magicblast', 'magicreflect', 'shield'],
  soleil: ['shoot', 'craze', 'flying', 'antiair', 'piercing'],
  venoa: ['disease', 'outbreak', 'toxicfog', 'poisonhalo', 'demoralize'],
};

// 基本の種類。
//   rates: 排出率　guarantee: レア以上が確定の枚数（最後のn枚）
//   allow(def): 出るカードの条件　boost(def): 出やすいカードの条件　price: ショップの値段
const PACK_TYPES = {
  normal: { name: '通常パック', icon: '🎁', hue: '#38bdf8', hue2: '#1e3a8a', mark: '◆', desc: 'すべてのカードが出る', price: { gold: 250 } },
  premium: { name: '高級パック', icon: '💎', hue: '#fbbf24', hue2: '#7c2d12', mark: '♛', desc: 'レア以上が2枚確定。エピック・レジェンドが出やすい', rates: PACK_RATES_PREMIUM, guarantee: 2, price: { stones: 380 } },
  monster: { name: 'モンスターパック', icon: '🐲', hue: '#fb7185', hue2: '#4c0519', mark: '🐾', desc: 'モンスターカードだけが出る', allow: d => d.kind === 'monster', price: { gold: 300 } },
  item: { name: 'アイテムパック', icon: '🗡️', hue: '#94a3b8', hue2: '#1e293b', mark: '⚒', desc: '装備とフラッシュだけが出る', allow: d => d.kind !== 'monster', price: { gold: 300 } },
};
for (const color of Object.keys(COLORS)) {
  PACK_TYPES[color] = {
    name: `${COLORS[color].name}のパック`, icon: '🎴', hue: PACK_COLOR_HEX[color], hue2: '#0f172a', mark: COLORS[color].name, color,
    desc: `${COLORS[color].name}のカードと、無色のアイテムだけが出る`, allow: d => d.color === color || (!d.color && d.kind !== 'monster'), price: { gold: 320 },
  };
}

// カードの定義から、Lv1のスキルの一覧を返す
function packSkills(d) { return cardAt(d.id).skills || []; }

// 種類の id から、パックの情報を返す（ヒーローパック・イベントパックは、その場で作る。知らない id は null）
function packType(id) {
  if (PACK_TYPES[id]) return { id, ...PACK_TYPES[id] };
  const [kind, key] = String(id).split(':');
  if (kind === 'hero' && HERO_BY_ID[key]) {
    const h = HERO_BY_ID[key];
    const skills = HERO_PACK_SKILLS[key] || [];
    return {
      id, name: `${h.name}のパック`, icon: '👑', hue: PACK_COLOR_HEX[h.color], hue2: '#3b0764', mark: '👑', hero: key, gift: 1,
      desc: `${COLORS[h.color].name}のカードと、${h.name}と相性のよいスキルのカードが出やすい。${h.name}のギフトが1つ入っている`,
      boost: d => d.color === h.color || packSkills(d).some(k => skills.includes(k.id)),
      price: { gold: 400 }, needHeroLevel: PACK_SHOP.HERO_LEVEL,
    };
  }
  if (kind === 'event') {
    const ev = EVENTS.find(e => e.id === key);
    if (!ev) return null;
    const color = ev.rule.deckColor;
    const granted = ev.rule.grant ? Object.keys(ev.rule.grant) : [];
    const themed = color || granted.length;
    return {
      id, name: `${ev.name}のパック`, icon: ev.icon, hue: color ? PACK_COLOR_HEX[color] : '#f472b6', hue2: '#1e1b4b', mark: ev.icon, event: key, rates: PACK_RATES_EVENT,
      desc: `イベント「${ev.name}」の報酬。${color ? `${COLORS[color].name}のカードが出やすい。` : granted.length ? `${granted.map(s => SKILLS[s].name).join('・')} を持つカードが出やすい。` : ''}レア以上が出やすい`,
      boost: themed ? d => (color ? d.color === color : packSkills(d).some(k => granted.includes(k.id))) : null,
      price: null,
    };
  }
  return null;
}

const packRatesOf = t => t.rates || GROWTH.PACK_RATES;

// ---------- 持っているパック ----------

function packCount(profile, id) { return id === 'normal' ? profile.packs : (profile.packBag[id] || 0); }
function totalPacks(profile) { return profile.packs + Object.values(profile.packBag).reduce((n, x) => n + x, 0); }
// 持っているパックの種類（数が1以上のもの）。通常パックが先頭
function ownedPacks(profile) {
  const ids = ['normal', ...Object.keys(profile.packBag)].filter(id => packCount(profile, id) > 0 && packType(id));
  return ids.map(id => ({ id, n: packCount(profile, id) }));
}
function addPacks(profile, id, n = 1) {
  if (!packType(id) || !(n > 0)) return false;
  if (id === 'normal') profile.packs += n;
  else profile.packBag[id] = (profile.packBag[id] || 0) + n;
  return true;
}
// 報酬の { bag: { 種類: 数 } } をまとめて渡す
function addPackBag(profile, bag) { for (const id in bag || {}) addPacks(profile, id, bag[id]); }
function takePack(profile, id) {
  if (packCount(profile, id) <= 0) return false;
  if (id === 'normal') profile.packs--;
  else if (--profile.packBag[id] <= 0) delete profile.packBag[id];
  return true;
}
const packBagText = bag => Object.keys(bag || {}).map(id => `${packType(id).icon}${packType(id).name}×${bag[id]}`).join('　');

function sanitizePackBag(bag) {
  const out = {};
  for (const id in bag || {}) {
    const n = bag[id];
    if (id !== 'normal' && packType(id) && Number.isFinite(n) && n >= 1) out[id] = Math.floor(n);
  }
  return out;
}

// ---------- 開ける ----------

// そのパックの i 枚目のレアリティを決める（最後の guarantee 枚はレア以上）
function packRollRarity(t, i, rng) {
  const rates = packRatesOf(t);
  const sure = i >= GROWTH.PACK_SIZE - (t.guarantee || 1);
  const pool = RARITY_ORDER.slice(sure ? RARITY_ORDER.indexOf(GROWTH.PACK_GUARANTEE) : 0);
  let roll = rng() * pool.reduce((n, r) => n + rates[r], 0);
  for (const r of pool) { roll -= rates[r]; if (roll < 0) return r; }
  return pool[pool.length - 1];
}

// そのパックから出るカードの候補（Elite は出ない）
function packPool(t) { return Object.values(CARD_DEFS).filter(d => !d.elite && (!t.allow || t.allow(d))); }

// パックを1つ開ける。出たカードの一覧 [{ id, isNew }] を返す（持っていなければ null）。
// ヒーローパックなら、ギフトも入る（返り値の gift に { hero, n }）
function openPackOf(profile, id, rng = Math.random) {
  const t = packType(id);
  if (!t || !takePack(profile, id)) return null;
  const all = packPool(t);
  const pulls = [];
  for (let i = 0; i < GROWTH.PACK_SIZE; i++) {
    const rarity = packRollRarity(t, i, rng);
    const wantMonster = rng() < GROWTH.PACK_MONSTER_RATE;
    // そのレアリティ・種類のカードから選ぶ。なければ種類を問わず、それでもなければ近いレアリティから
    let pool = all.filter(d => d.rarity === rarity && (d.kind === 'monster') === wantMonster);
    if (!pool.length) pool = all.filter(d => d.rarity === rarity);
    for (let k = RARITY_ORDER.indexOf(rarity) - 1; !pool.length && k >= 0; k--) pool = all.filter(d => d.rarity === RARITY_ORDER[k]);
    if (!pool.length) pool = all;
    // 出やすいカード（boost）は、ほかの BOOST 倍の重みで選ぶ
    const weight = d => (t.boost && t.boost(d) ? PACK_SHOP.BOOST : 1);
    let roll = rng() * pool.reduce((n, d) => n + weight(d), 0);
    let def = pool[pool.length - 1];
    for (const d of pool) { roll -= weight(d); if (roll < 0) { def = d; break; } }
    pulls.push({ id: def.id, isNew: addCard(profile, def.id) });
  }
  if (t.gift && t.hero) {
    profile.hero.gifts[t.hero] = (profile.hero.gifts[t.hero] || 0) + t.gift;
    pulls.gift = { hero: t.hero, n: t.gift };
  }
  pulls.type = id;
  return pulls;
}

// 同じ種類をまとめて開ける（1回に PACK_BULK_MAX まで）。開けた数は返り値の packs
function openPacksOf(profile, id, n, rng = Math.random) {
  const count = Math.min(n, packCount(profile, id), GROWTH.PACK_BULK_MAX);
  if (count <= 0) return null;
  const pulls = [];
  pulls.gifts = [];
  for (let i = 0; i < count; i++) { const one = openPackOf(profile, id, rng); pulls.push(...one); if (one.gift) pulls.gifts.push(one.gift); }
  pulls.packs = count;
  pulls.type = id;
  return pulls;
}

// 種類をまたいで、全部まとめて開ける（合わせて PACK_BULK_MAX まで。持っている順）
function openAllPacks(profile, rng = Math.random) {
  const pulls = [];
  pulls.gifts = [];
  let count = 0;
  for (const { id } of ownedPacks(profile)) {
    while (count < GROWTH.PACK_BULK_MAX && packCount(profile, id) > 0) {
      const one = openPackOf(profile, id, rng);
      pulls.push(...one);
      if (one.gift) pulls.gifts.push(one.gift);
      count++;
    }
  }
  pulls.packs = count;
  return count ? pulls : null;
}

// ---------- ショップ ----------

// ショップに並ぶパックの種類（ヒーローパックは、解放済みのヒーローのぶん）
function shopPacks(profile) {
  return ['normal', ...Object.keys(COLORS), 'monster', 'item', 'premium', ...profile.hero.unlocked.map(h => 'hero:' + h)];
}

// 買えるか。{ ok, reason }
function canBuyPack(profile, id, n = 1) {
  const t = packType(id);
  if (!t || !t.price) return { ok: false, reason: 'ショップでは買えないパック' };
  if (t.hero && !profile.hero.unlocked.includes(t.hero)) return { ok: false, reason: 'ヒーローが未解放' };
  if (t.needHeroLevel && heroLevel(profile, t.hero) < t.needHeroLevel) return { ok: false, reason: `${HERO_BY_ID[t.hero].name}のレベル${t.needHeroLevel}で買える` };
  if ((t.price.gold || 0) * n > profile.gold) return { ok: false, reason: 'ゴールドが足りない' };
  if ((t.price.stones || 0) * n > profile.stones) return { ok: false, reason: '魔石が足りない' };
  return { ok: true, reason: '' };
}

function buyPack(profile, id, n = 1) {
  if (!(n >= 1) || !canBuyPack(profile, id, n).ok) return false;
  const t = packType(id);
  profile.gold -= (t.price.gold || 0) * n;
  profile.stones -= (t.price.stones || 0) * n;
  return addPacks(profile, id, n);
}
