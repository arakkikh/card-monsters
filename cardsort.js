// ============================================================
// カード一覧の並び替えと絞り込み（コレクション画面・デッキ編集画面で使う）
//   画面の部品は meta.js / deckui.js。ここは、並べ方と選び方の決まりだけ。
// ============================================================

// カード名の読み（50音順と検索に使う）。カードを足したら、ここにも1行足す（足し忘れるとテストが失敗する）
const CARD_YOMI = {
  r01: 'ひのこねずみ', r02: 'ほむらのばんけん', r03: 'ときのたいこうち', r04: 'しゃくどうのそうへい', r05: 'れんげきのけんとうし', r06: 'ようがんとかげ', r07: 'ぐれんのしょうぐん',
  r08: 'ごうかりゅうゔぉるが', r09: 'しんがんのけんし', r10: 'ぎゃくしゅうのとうし', r11: 'ばくえんのひりゅう', r12: 'きめんのいあつしゃ', r13: 'えんしょうあぐに', r14: 'ぐれんのとうしん',
  r15: 'きずだらけのきょうせんし', r16: 'さきがけのきしゅ', r17: 'とっしんするもうぎゅう', r18: 'ぶぐはこびのじゅうしゃ', r19: 'とつげきたいのごうれいしゅ', r20: 'かじばのようへい',
  b01: 'しずくのせい', b02: 'つららのみならい', b03: 'しおだまりのたてがい', b04: 'きりのかたりべ', b05: 'しんかいのまじょ', b06: 'ひょうがのきょじん', b07: 'ほしよみのけんじゃ',
  b08: 'かいおうりゔぁいあ', b09: 'きんこうのてんびんつかい', b10: 'かがみのまどうし', b11: 'ばくれつのじゅつし', b12: 'きりがくれのせい', b13: 'ひょうけんじゃみすと', b14: 'ひょうしょうのじょてい',
  b15: 'こだまのじゅつし', b16: 'れんしょうのまじょ', b17: 'らいうんのばんぺい', b18: 'さかしおのばんにん', b19: 'かきゅうのしゃほんし',
  g01: 'こけむすこじか', g02: 'やくそうつみ', g03: 'つたのしゃしゅ', g04: 'いばらのばんにん', g05: 'もりのいのりて', g06: 'たいじゅのころう', g07: 'からみつくだいじゃ',
  g08: 'せかいじゅのけしん', g09: 'せいじゅんのそう', g10: 'はんげきのじゅじん', g11: 'よろいずきのこびと', g12: 'もりのみこりーふぃあ', g13: 'こもりのぬし',
  g14: 'めぶきのわかぎ', g15: 'こけむすおおがめ', g16: 'とりでをまもるろうきし', g17: 'きょうめいするもりのせい', g18: 'つちにんぎょうづかい', g19: 'くすりびんのちょうごうし',
  y01: 'ひよこみならいへい', y02: 'さばくのたてへい', y03: 'みはりのたか', y04: 'ごうれいのきしゅ', y05: 'たいくうのどへい', y06: 'おうごんのせいきし', y07: 'らいめいのしゃしゅ',
  y08: 'てんくうのおおわしおう', y09: 'こうえいのぐんし', y10: 'れんしゃのきゅうへい', y11: 'きゅうこうかのはやぶさ', y12: 'へんたいちょうのおおわし', y13: 'せいいきのしゅごしゃ', y14: 'てんきゅうのそれいゆ', y15: 'おうごんのわしおう',
  y16: 'せんりがんのそげきしゅ', y17: 'やさめのしゃしゅ', y18: 'やばらいのたてへい', y19: 'みがるなけいきへい', y20: 'きゅうなんのはやぶさ', y21: 'たびのしゅうりや',
  p01: 'くされこうもり', p02: 'えきびょうねずみ', p03: 'かげひそむとうぞく', p04: 'のろいのにんぎょう', p05: 'しかばねぐらい', p06: 'しょうきのまじゅつし', p07: 'こんとんのどうけ',
  p08: 'しゅうえんのまおう', p09: 'はおうのむくろ', p10: 'どくぎりのじゅつしゃ', p11: 'えきびょうのしさい', p12: 'いかさまし', p13: 'どくひめゔぇのあ', p14: 'めいふのどうけ',
  p15: 'みだれうちのこおに', p16: 'まびきのかげ', p17: 'まくひきのにんぎょう', p18: 'きょうほうのからす', p19: 'やっかいもののつかいま', p20: 'つじうらないのろうば',
  e01: 'てつのけん', e02: 'かりゅうどのゆみ', e03: 'まりょくのほうじゅ', e04: 'かわのよろい', e05: 'いのちのごふ', e06: 'はがねのおおたて', e07: 'ながやり', e08: 'ちょうはつのはた',
  e09: 'れんげきのこて', e10: 'こんとんのかけら', e11: 'ほのおのけん', e12: 'とうしのはちまき', e13: 'こおりのつえ', e14: 'せいじゃくのかめん', e15: 'いばらのがいとう', e16: 'せかいじゅのは',
  e17: 'たいくうのやづつ', e18: 'てんよくのくつ', e19: 'びょうまのきば', e20: 'まがんのたま', e21: 'ぐれんのしょうけん', e22: 'ようこうのゆみ', e23: 'そうかいのほうじゅ', e24: 'じゅひのよろい',
  e25: 'しんえんのかけら', e26: 'せいきしのたて', e27: 'かがみのたて', e28: 'とげのたて', e29: 'かぶとわりのおの', e30: 'いこんのくさり', e31: 'おいうちのこて', e32: 'つらぬきのすいしょう',
  e33: 'よわみみのめがね', e34: 'いやしのこうろ', e35: 'かたみのはなたば', e36: 'きゅうめいのきば', e37: 'ぜろきょりのたんきゅう', e38: 'ふくへいのがいとう', e39: 'しずかなしょうじゅんき', e40: 'ふきつなすず',
  e41: 'こううんのきんか', e42: 'もえさかるやいば', e43: 'かりいれのかま', e44: 'のきぐちのつのぶえ',
  // 2種類の攻撃を持つカード
  r21: 'えんじんのまけんし', r22: 'しゃくそうのいくさおとめ', b20: 'ひょうそうのしゅえい', b21: 'しおさいのみこ', g21: 'つるゆみのもりばん',
  g22: 'こけむすそうとうじゅう', y22: 'そうきゅうのようへい', y23: 'らいこうのせいきゅうしゅ', p21: 'かげぬいのじゅじゅつし', p22: 'こんとんのそうじん',
  e45: 'るーんのまけん', e46: 'そうとうのいしゆみ', e47: 'ほのおのなげやり', e48: 'ひょうしょうのじょうけん', e49: 'てんきゅうのちょうきゅう', e50: 'こんとんのたんけん', e51: 'もりばんのじょうきゅう',
  f01: 'いしつぶて', f02: 'いなずま', f03: 'いやしのひかり', f04: 'えんぐんのつのぶえ', f05: 'えきびょうのきり', f06: 'おしもどし', f07: 'いやしのあめ', f08: 'かきゅう', f09: 'さばきのいかずち',
  f10: 'ませきのひらめき', f11: 'せいなるいずみ', f12: 'こくしののろい', f13: 'ときもどしのすな', f14: 'こおりのや', f15: 'おうきゅうてあて', f16: 'かざんだん', f17: 'ひょうらい', f18: 'もりのいぶき',
  f19: 'しょうき', f20: 'ひだまりのあめ', f21: 'ふしょくのしずく', f22: 'だいふしょく', f23: 'しゅうしふ', f24: 'てったいのあいず', f25: 'きりのとばり', f26: 'まもりのいのり', f27: 'げんえいのじゅつ',
  f28: 'あしどめのこおり', f29: 'やまいのさくれつ', f30: 'たてなおしのごうれい', f31: 'おもいかんぜい', f32: 'みがわりのむれ', f33: 'めいわくなおくりもの', f34: 'おおそうじ',
};
const cardYomi = id => CARD_YOMI[id] || '';

// ---------- 標準の並び順 ----------

const CARD_KIND_ORDER = ['monster', 'equip', 'flash'];
// レアリティの高い順（Elite はレジェンドより前）
const cardRarityRank = c => (c.elite ? 0 : 1 + ['legend', 'epic', 'rare', 'common'].indexOf(c.rarity));
// 色の順（アイテムの無色は、いままでどおり先頭）
const cardColorRank = c => (c.color ? 1 + Object.keys(COLORS).indexOf(c.color) : 0);
// 50音順（濁点・半濁点・小さい文字は、清音・大きい文字と同じ場所に並ぶ）
const cardNameCompare = (a, b) => cardYomi(a.id).localeCompare(cardYomi(b.id), 'ja') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// 標準：色 →（モンスター → 装備 → フラッシュ）→ レアリティの高い順 → コストの低い順 → 名前の50音順
function cardStdCompare(a, b) {
  return cardColorRank(a) - cardColorRank(b)
    || CARD_KIND_ORDER.indexOf(a.kind) - CARD_KIND_ORDER.indexOf(b.kind)
    || cardRarityRank(a) - cardRarityRank(b)
    || a.cost - b.cost
    || cardNameCompare(a, b);
}

// ---------- 並び替え ----------

// 並び順の種類。get: 比べる値（小さいほど先）。down: 最初の向きが「大きい順」か。monsterOnly: モンスター以外は最後にまとめる
//   labels: [最初の向き, 逆の向き] の呼び名
const CARD_SORTS = {
  color: { name: '色順', labels: ['標準', '逆順'], get: null },
  rarity: { name: 'レアリティ順', labels: ['高い順', '低い順'], get: c => -cardRarityRank(c), down: true },
  cost: { name: 'コスト順', labels: ['低い順', '高い順'], get: c => c.cost },
  level: { name: 'レベル順', labels: ['高い順', '低い順'], get: (c, p) => cardLevel(p, c.id), down: true },
  name: { name: '名前順', labels: ['50音順', '逆順'], get: null, byName: true },
  got: { name: '入手順', labels: ['新しい順', '古い順'], get: (c, p) => (p.cards[c.id] && p.cards[c.id].got) || 0, down: true },
  copies: { name: '所持枚数順', labels: ['予備の多い順', '予備の少ない順'], get: (c, p) => (p.cards[c.id] ? p.cards[c.id].copies + 1 : 0), down: true },
  atk: { name: '攻撃力順', labels: ['高い順', '低い順'], get: c => baseAttacksOf(c).reduce((n, a) => n + a.atk, 0), down: true, monsterOnly: true }, // 2種類持つなら合計
  hp: { name: 'HP順', labels: ['高い順', '低い順'], get: c => c.hp, down: true, monsterOnly: true },
};

// 並び替えた新しい一覧を返す。
//   sort: CARD_SORTS のキー　reverse: 向きを逆にする
//   同じ値のカードは、標準の並び順になる（向きを逆にしても、同じ値どうしは標準の順のまま）
function cardSortList(cards, sort = 'color', reverse = false, profile = null) {
  const def = CARD_SORTS[sort] || CARD_SORTS.color;
  const flip = reverse ? -1 : 1;
  const list = cards.slice();
  if (!def.get) {
    const base = def.byName ? (a, b) => cardNameCompare(a, b) : cardStdCompare;
    return list.sort((a, b) => flip * base(a, b) || cardStdCompare(a, b));
  }
  const dir = flip * (def.down ? -1 : 1);
  const rest = c => (def.monsterOnly && c.kind !== 'monster' ? 1 : 0); // モンスター以外は、向きに関係なく最後
  return list.sort((a, b) => rest(a) - rest(b)
    || (rest(a) ? 0 : dir * (def.get(a, profile) - def.get(b, profile)))
    || cardStdCompare(a, b));
}

// ---------- 絞り込み ----------

// 絞り込みの条件（何も選んでいない状態）
//   colors / rarities / types: 選んだものの一覧（空なら絞らない）。colors の 'none' は無色、rarities の 'elite' は Elite
//   kind: 'monster' | 'equip' | 'flash' | null　owned: true なら所持しているカードだけ　upgradable: 強化できるカードだけ
//   q: カード名・スキル名の検索
function cardFilterDefault() { return { colors: [], rarities: [], types: [], kind: null, owned: false, upgradable: false, q: '' }; }

// 条件をいくつ使っているか（0 なら絞り込みなし）
function cardFilterCount(f) {
  return f.colors.length + f.rarities.length + f.types.length + (f.kind ? 1 : 0) + (f.owned ? 1 : 0) + (f.upgradable ? 1 : 0) + (f.q.trim() ? 1 : 0);
}

// 検索用に文字をそろえる（カタカナ→ひらがな、大文字→小文字、空白や記号を除く）
const cardNorm = t => String(t).toLowerCase().replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)).replace(/[\s　・\-‐]/g, '');

// そのカードの検索用の文字（名前・読み・スキル名の英語と日本語と読み。選択スキルも含む）
function cardSearchText(c) {
  const def = CARD_DEFS[c.id];
  const skills = [...(c.skills || []), ...((def && def.options) || [])];
  const words = [c.name, cardYomi(c.id)];
  for (const k of skills) {
    const m = (typeof SKILL_META !== 'undefined' && SKILL_META[k.id]) || {};
    words.push(SKILLS[k.id].name, m.ja || '', m.yomi || '');
  }
  return cardNorm(words.join(' '));
}

// そのカードの攻撃タイプ（モンスターは本体の攻撃、装備は足される攻撃。フラッシュはなし）
// 複数の攻撃を持つカードは、そのどれかに当てはまれば絞り込みに残る
const cardAttackTypes = c => attackTypesOf(c);

function cardMatches(c, f, profile) {
  if (f.kind && c.kind !== f.kind) return false;
  if (f.colors.length && !f.colors.includes(c.color || 'none')) return false;
  if (f.rarities.length && !f.rarities.includes(c.elite ? 'elite' : c.rarity)) return false;
  if (f.types.length && !cardAttackTypes(c).some(t => f.types.includes(t))) return false;
  if (f.owned && !(profile && owns(profile, c.id))) return false;
  if (f.upgradable && !(profile && canUpgrade(profile, c.id).ok)) return false;
  const q = cardNorm(f.q);
  if (q && !cardSearchText(c).includes(q)) return false;
  return true;
}

function cardFilterList(cards, f, profile = null) { return cards.filter(c => cardMatches(c, f, profile)); }

// ---------- 選んだ並び順の記憶（セーブデータとは別に、この端末に残す） ----------

const CARD_VIEW_KEY = 'card-monsters-cardview';
// 画面ごとの表示の状態：{ sort, reverse, filter }
function cardViewDefault() { return { sort: 'color', reverse: false, filter: cardFilterDefault() }; }

// 並び順だけを残す（絞り込みは、開き直すたびに解除する）。scope: 'collection' | 'deck'
function saveCardView(scope, view, storage = defaultStorage()) {
  if (!storage) return;
  try {
    const all = JSON.parse(storage.getItem(CARD_VIEW_KEY) || '{}');
    all[scope] = { sort: view.sort, reverse: !!view.reverse };
    storage.setItem(CARD_VIEW_KEY, JSON.stringify(all));
  } catch (e) { /* 保存できなくても動く */ }
}

function loadCardView(scope, storage = defaultStorage()) {
  const view = cardViewDefault();
  try {
    const saved = (JSON.parse((storage && storage.getItem(CARD_VIEW_KEY)) || '{}') || {})[scope];
    if (saved && CARD_SORTS[saved.sort]) { view.sort = saved.sort; view.reverse = !!saved.reverse; }
  } catch (e) { /* 壊れていたら、標準の並び順 */ }
  return view;
}

// 一覧に出すカードを決める：絞り込んでから並べる。{ list, total }
function cardViewList(cards, view, profile) {
  return { list: cardSortList(cardFilterList(cards, view.filter, profile), view.sort, view.reverse, profile), total: cards.length };
}
