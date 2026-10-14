// ============================================================
// スキル辞典のデータ
//   スキル（skills.js）・状態異常・攻撃の種類・基本ルール・ヒーロースキル（heroes.js）・
//   地形（terrains.js）・イベントの特殊ルール（events.js）から、自動で項目を作る。
//   データを足せば辞典にも載る（スキルは SKILL_META の1行も必要。足し忘れるとテストが失敗する）。
// ============================================================

const DICT_CATS = { atk: '攻撃', def: '防御', sup: '支援', deb: '妨害', etc: 'その他' };
const DICT_GROUPS = { skill: 'スキル', status: '状態異常', type: '攻撃の種類', rule: '基本ルール', hero: 'ヒーロースキル', terrain: '地形', event: 'イベント' };

// 図解：上段＝相手（f1〜f3）、下段＝自分（m1〜m3）。1=前列（中央）、2=左、3=右。
//   [マス, 動き, 何番目か]　動き：act 動く / hit ダメージ / heal 回復 / buff 強化 / debuff 弱体 / dodge 回避 / shield 防ぐ / swapL・swapR 入れ替わる
const DICT_DEMOS = {
  hit_front: { cap: '前列から、敵の前列を攻撃', steps: [['m1', 'act', 0], ['f1', 'hit', 1]] },
  hit_back: { cap: '後列からでも、敵の前列を攻撃', steps: [['m2', 'act', 0], ['f1', 'hit', 1]] },
  diag: { cap: '後列から、対角の敵を狙う（いなければ正面→前列）', steps: [['m2', 'act', 0], ['f3', 'hit', 1]] },
  facing: { cap: '正面（同じ番号のスロット）の敵を狙う', steps: [['m3', 'act', 0], ['f3', 'hit', 1]] },
  random: { cap: 'ランダムな敵1体を攻撃', steps: [['m1', 'act', 0], ['f2', 'hit', 1], ['m1', 'act', 2], ['f3', 'hit', 3]] },
  double: { cap: '前列に当てたあと、後列の1体にも追加ダメージ', steps: [['m1', 'act', 0], ['f1', 'hit', 1], ['f2', 'hit', 2]] },
  many: { cap: '続けて何度も攻撃', steps: [['m1', 'act', 0], ['f1', 'hit', 1], ['m1', 'act', 2], ['f1', 'hit', 3]] },
  shots: { cap: '後列から続けて撃つ', steps: [['m2', 'act', 0], ['f3', 'hit', 1], ['m2', 'act', 2], ['f3', 'hit', 3]] },
  splash: { cap: '狙った敵の隣にも追加ダメージ', steps: [['m1', 'act', 0], ['f1', 'hit', 1], ['f2', 'hit', 2], ['f3', 'hit', 2]] },
  hitall: { cap: '敵全員にダメージ', steps: [['m1', 'act', 0], ['f1', 'hit', 1], ['f2', 'hit', 1], ['f3', 'hit', 1]] },
  hit_flash: { cap: '選んだ敵1体に効果', steps: [['f2', 'hit', 0]] },
  reflect: { cap: '攻撃を受けたら、攻撃者にやり返す', steps: [['f1', 'act', 0], ['m1', 'hit', 1], ['m1', 'act', 2], ['f1', 'hit', 3]] },
  dodge: { cap: '攻撃をひらりとかわす', steps: [['f1', 'act', 0], ['m1', 'dodge', 1]] },
  shield: { cap: '受けるダメージを減らす・防ぐ', steps: [['f1', 'act', 0], ['m1', 'shield', 1]] },
  taunt: { cap: '遠隔攻撃の狙いが変わる', steps: [['f2', 'act', 0], ['m2', 'shield', 1], ['m3', 'buff', 0]] },
  heal1: { cap: '味方1体を助ける', steps: [['m2', 'act', 0], ['m1', 'heal', 1]] },
  healall: { cap: '味方全員を助ける', steps: [['m2', 'act', 0], ['m1', 'heal', 1], ['m2', 'heal', 1], ['m3', 'heal', 1]] },
  buff1: { cap: '自分が強くなる', steps: [['m1', 'buff', 0]] },
  buffall: { cap: '味方全員を強化', steps: [['m2', 'act', 0], ['m1', 'buff', 1], ['m2', 'buff', 1], ['m3', 'buff', 1]] },
  debuff1: { cap: '敵1体を弱らせる', steps: [['m1', 'act', 0], ['f1', 'debuff', 1]] },
  debuffall: { cap: '敵全員を弱らせる', steps: [['m1', 'act', 0], ['f1', 'debuff', 1], ['f2', 'debuff', 1], ['f3', 'debuff', 1]] },
  swap: { cap: '敵の前列と後列が入れ替わる', steps: [['m1', 'act', 0], ['f1', 'swapR', 1], ['f3', 'swapL', 1]] },
  compact: { cap: '前のモンスターが倒れると、後ろが前に詰める', steps: [['m1', 'hit', 0], ['m2', 'swapR', 1]] },
  burn: { cap: '場のモンスター全員にダメージ', steps: [['m1', 'hit', 0], ['m2', 'hit', 0], ['f1', 'hit', 0], ['f3', 'hit', 0]] },
  none: { cap: '', steps: [] },
};
const DICT_DEMO_OF_CAT = { atk: 'hit_front', def: 'shield', sup: 'buffall', deb: 'debuffall', etc: 'none' };

// 説明文から、発動タイミングを読み取る（ヒーロースキル・地形用）
function dictWhenOf(text) {
  const table = [['攻撃フェーズ開始時', '攻撃フェーズ開始時'], ['ターン開始時', 'ターン開始時'], ['ターン終了時', 'ターン終了時'], ['使うたび', '装備・フラッシュを使ったとき'],
    ['出したとき', 'モンスターを場に出したとき'], ['倒されたら', '味方が倒されたとき'], ['倒すたび', '敵を倒したとき']];
  const hit = table.find(t => text.includes(t[0]));
  return hit ? hit[1] : '常時（対戦中ずっと）';
}

// 基本ルール（数値は CONFIG から入れるので、設定を変えれば辞典も変わる）
function dictRules() {
  const C = CONFIG;
  return [
    { id: 'crystal', name: 'クリスタルとドロー', yomi: 'くりすたるとどろー', icon: '💎', when: '自分のターン開始時', demo: 'none', rel: ['rule:sacrifice', 'rule:fallen'],
      desc: `毎ターン、クリスタルを${C.CRYSTALS_PER_TURN}個もらい、山札から1枚引く。使わなかったクリスタルは次のターンに持ち越せる。後攻は最初に${C.SECOND_PLAYER_BONUS}個多く持ち、ターン${C.SECOND_PLAYER_LATE.turn}（自分の4回目の番）の開始時にも${C.SECOND_PLAYER_LATE.bonus}個もらう。最初の手札は${C.INITIAL_HAND}枚。` },
    { id: 'slots', name: 'スロットと詰め', yomi: 'すろっととつめ', icon: '🔢', when: 'モンスターを出したとき・倒れたとき', demo: 'compact', rel: ['skill:menace', 'skill:fear', 'type:melee', 'type:ranged'],
      desc: '場は3スロット。スロット1が前列（中央）、スロット2・3が後列（左・右）。モンスターは必ず前から詰めて並ぶ。モンスターがいるスロットに出すと、そこから後ろのモンスターを1つずつ後ろへ押し出す。前のモンスターがいなくなると、後ろのモンスターが前に詰める。' },
    { id: 'armor', name: 'アーマー', yomi: 'あーまー', icon: '🛡️', when: '物理ダメージを受けたとき', demo: 'shield', rel: ['skill:piercing', 'skill:enchantarmor', 'skill:corrosion', 'type:magic', 'type:ranged'],
      desc: `アーマーは盾のゲージ。物理ダメージ（近接・遠隔）は、まずアーマーを削る。カオス攻撃は固定ダメージで、アーマーを素通りする。アーマーが残っている間、HPは減らない。アーマーを壊したときの余りのダメージは消える（Piercing があればHPに届く）。魔法ダメージはアーマーを無視する。アーマーを持つモンスターは、遠隔攻撃を${Math.round(C.RANGED_BLOCK_CHANCE * 100)}%の確率でブロックする。` },
    { id: 'order', name: '攻撃順', yomi: 'こうげきじゅん', icon: '🔁', when: '攻撃フェーズ', demo: 'many', rel: ['type:melee', 'type:ranged', 'type:magic', 'type:chaos', 'skill:batter', 'skill:craze'],
      desc: 'ターン終了を押すと攻撃フェーズ。手番のプレイヤーのモンスターが、スロット3 → 2 → 1 の順に自動で攻撃する。1体が複数の攻撃を持つとき（装備で増えた攻撃など）は、魔法 → カオス → 遠隔 → 近接 の順。Batter・Craze の追加攻撃は、元の攻撃のすぐあとに行う。' },
    { id: 'sacrifice', name: '生贄', yomi: 'いけにえ', icon: '🔥', when: '自分のターン中（1ターンに1回）', demo: 'none', rel: ['rule:crystal', 'rule:fallen', 'rule:win'],
      desc: `1ターンに1回、カードを生贄にしてクリスタルに換えられる。手札のアイテムは+${C.SACRIFICE_ITEM}、手札のモンスターは+${C.SACRIFICE_MONSTER}、場のモンスターは+${C.SACRIFICE_MONSTER}（装備も失う）。生贄にしたカードは試合から取り除かれる。` },
    { id: 'fallen', name: '倒されたときのクリスタル', yomi: 'たおされたときのくりすたる', icon: '💠', when: '場のモンスターが倒されたとき', demo: 'none', rel: ['rule:crystal', 'rule:sacrifice', 'hero:spoils'],
      desc: `場にいるモンスターが倒されると、その持ち主がクリスタルを${C.FALLEN_CRYSTAL}個もらう（自分も相手も同じ）。原因は問わない（攻撃・反撃・Thorns・Menace・フラッシュ・消耗ダメージ・地形など）。相手のターンに倒されたときもすぐにもらえ、次の自分のターンに使える。生贄にしたモンスター、山札に戻ったモンスター（Unsummon・Retreat）、場が空のペナルティで捨てられたカード、Phantom の分身ではもらえない。` },
    { id: 'penalty', name: '場が空のペナルティ', yomi: 'ばがからのぺなるてぃ', icon: '⚠️', when: '自分のターン終了時', demo: 'none', rel: ['rule:win'],
      desc: '自分のターンが終わったとき、自分の場にモンスターが1体もいなければ、手札と山札の中からランダムに1枚が捨てられる。' },
    { id: 'attrition', name: '消耗ダメージ', yomi: 'しょうもうだめーじ', icon: '🔥', when: `ターン${C.ATTRITION_START}以降の、各ターン開始時`, demo: 'burn', rel: ['rule:win', 'event:sudden'],
      desc: `試合が長引くと、ターン${C.ATTRITION_START}から、各ターンの開始時に場のモンスター全員（両者）がダメージを受ける。最初は1で、${C.ATTRITION_STEP}ターンごとに+1。アーマーや盾を無視する固定ダメージ。` },
    { id: 'win', name: '勝敗', yomi: 'しょうはい', icon: '🏆', when: 'モンスターがいなくなったとき', demo: 'none', rel: ['rule:penalty', 'rule:attrition', 'rule:sacrifice'],
      desc: '相手のモンスターが、場・手札・山札のどこにもいなくなったら勝ち。引き分けはなく、両者が同時にいなくなったときは、そのターンの手番側の勝ち。自分の生贄で0体になった場合は、次のターン開始時に判定する。' },
  ];
}

const DICT_TYPE_TEXT = {
  melee: { yomi: 'きんせつ', demo: 'hit_front', rel: ['skill:reach', 'skill:thorns', 'skill:counter', 'skill:flying', 'rule:armor'],
    desc: '前列（スロット1）にいるときだけ攻撃できる（Reach があれば後列からも）。対象は敵の前列。物理ダメージで、アーマーに防がれる。' },
  ranged: { yomi: 'えんかく', demo: 'diag', rel: ['skill:taunt', 'skill:stealth', 'skill:shoot', 'skill:flying', 'rule:armor'],
    desc: '後列（スロット2・3）にいるときだけ攻撃できる。対象は 対角 → 正面 → 前列 の順で、最初にいる敵。Taunt を持つ敵がいれば最優先。後列の Stealth 持ちは狙えない。物理ダメージで、アーマーを持つ敵にはブロックされることがある。' },
  magic: { yomi: 'まほう', demo: 'facing', rel: ['skill:stealth', 'skill:mirrorshield', 'skill:magicreflect', 'skill:silence', 'rule:armor'],
    desc: 'どのスロットからでも攻撃できる。対象は正面（同じ番号のスロット）の敵で、いなければ前列。アーマーを無視してHPに届く。Silence 状態では使えない。' },
  chaos: { yomi: 'かおす', demo: 'random', rel: ['skill:trickery', 'skill:disease', 'rule:armor'],
    desc: 'どのスロットからでも攻撃できる。対象はランダムな敵1体。ダメージは1〜攻撃力のランダム。固定ダメージで、アーマーや盾（Shield など）を無視してHPに届く。' },
};

// スキルと名前が違う状態の、日本語名・読み・元になるスキル
const DICT_STATUS_META = { burn: { ja: '燃焼', yomi: 'ねんしょう', skill: 'scorch' }, aim: { ja: '静かな狙い', yomi: 'しずかなねらい', skill: 'steadyaim' } };

// 辞典の全項目を作る
//   { key, group, id, name, ja, yomi, icon, cat, desc, hasX, when, rel: [key], demo, note }
function buildDict() {
  const list = [];
  for (const id in SKILLS) {
    const k = SKILLS[id], m = SKILL_META[id] || {};
    list.push({ key: 'skill:' + id, group: 'skill', id, name: k.name, ja: m.ja || '', yomi: m.yomi || k.name, icon: k.icon, cat: m.cat || 'etc',
      desc: k.desc('X'), hasX: !k.noX, when: m.when || '説明を参照', rel: (m.rel || []).map(r => 'skill:' + r), demo: m.demo || DICT_DEMO_OF_CAT[m.cat] || 'none' });
  }
  const bad = ['disease', 'entangle', 'silence', 'demoralize', 'suppress', 'jinx', 'stall', 'burn'];
  for (const id in STATUS_INFO) {
    const st = STATUS_INFO[id], m = SKILL_META[id] || DICT_STATUS_META[id] || {};
    list.push({ key: 'status:' + id, group: 'status', id, name: st.name + ' 状態', ja: (m.ja || '') + '（状態）', yomi: (m.yomi || st.name) + 'じょうたい', icon: st.icon, cat: bad.includes(id) ? 'deb' : 'sup',
      desc: st.text('X'), hasX: st.text('X').includes('X'), when: 'この状態にするスキルの発動時', rel: SKILLS[id] ? ['skill:' + id] : m.skill ? ['skill:' + m.skill] : [], demo: bad.includes(id) ? 'debuff1' : 'buff1',
      note: bad.includes(id) ? 'デバフ。Cleanse・Mass Cleanse で解除できる。Perseverance を持つモンスターは受けない。' : '' });
  }
  for (const id in ATTACK_TYPES) {
    const t = ATTACK_TYPES[id], x = DICT_TYPE_TEXT[id];
    list.push({ key: 'type:' + id, group: 'type', id, name: t.name + '攻撃', ja: '', yomi: x.yomi, icon: t.icon, cat: 'atk', desc: x.desc, hasX: false, when: '攻撃フェーズ', rel: x.rel, demo: x.demo });
  }
  for (const r of dictRules()) list.push({ key: 'rule:' + r.id, group: 'rule', ja: '', cat: 'etc', hasX: false, ...r });
  for (const id in HERO_SKILL_INFO) {
    const k = HERO_SKILL_INFO[id];
    const hero = k.hero && HERO_BY_ID[k.hero];
    const boss = Object.keys(BOSS_HERO_SKILLS).find(s => BOSS_HERO_SKILLS[s].id === id);
    list.push({ key: 'hero:' + id, group: 'hero', id, name: k.name, ja: '', yomi: k.yomi || k.name, icon: hero ? '🦸' : '👑', cat: 'sup', desc: k.desc, hasX: false,
      when: dictWhenOf(k.desc), rel: [], demo: 'buffall', hero: k.hero || null,
      note: hero ? `${hero.name}のヒーロースキル（ヒーローLv${HERO_RULES.SKILL_LEVELS[hero.skills.findIndex(s => s.id === id)]}で使える）` : `ボス専用（${boss}）。プレイヤーは使えない` });
  }
  for (const t of TERRAINS) {
    list.push({ key: 'terrain:' + t.id, group: 'terrain', id: t.id, name: t.name, ja: '', yomi: t.yomi || t.name, icon: t.icon, cat: 'etc', desc: t.desc, hasX: false,
      when: t.fx.burn || t.fx.regen || t.fx.storm ? 'ターン開始時' : '常時（対戦中ずっと）', rel: [], demo: t.fx.burn || t.fx.storm ? 'burn' : t.fx.regen ? 'healall' : 'none',
      note: t.special ? 'ボス戦の特殊地形。両者に同じ効果。' : '両者に同じ効果。' });
  }
  for (const e of EVENTS) {
    list.push({ key: 'event:' + e.id, group: 'event', id: e.id, name: e.name, ja: '', yomi: e.yomi || e.name, icon: e.icon, cat: 'etc', desc: e.desc, hasX: false,
      when: 'イベントの対戦中ずっと', rel: e.rule.attritionStart ? ['rule:attrition'] : e.rule.sacrificeMult ? ['rule:sacrifice'] : e.rule.grant ? Object.keys(e.rule.grant).map(s => 'skill:' + s) : e.rule.income ? ['rule:crystal'] : [],
      demo: 'none', note: `週替わりイベントの特殊ルール。Elite カード：${CARD_DEFS[e.elite].name}` });
  }
  return list;
}

const DICT = buildDict();
const DICT_BY_KEY = {};
DICT.forEach((e, i) => { e.order = i; DICT_BY_KEY[e.key] = e; });
// 関係する項目は、お互いに行き来できるようにする（片方にだけ書いてあっても両方に出る）
DICT.forEach(e => e.rel.forEach(r => { const o = DICT_BY_KEY[r]; if (o && !o.rel.includes(e.key)) o.rel.push(e.key); }));
DICT.forEach(e => { e.rel = e.rel.filter(r => DICT_BY_KEY[r]); });

// そのスキル（状態）を持つカードの一覧 [{ id, opt: 選択スキルとしてだけ持つ }]。ヒーロースキルは対応カード
function dictCards(entry) {
  if (entry.group === 'hero') return entry.hero ? [{ id: HERO_BY_ID[entry.hero].card, opt: false }] : [];
  if (entry.group === 'event') return [{ id: EVENTS.find(e => e.id === entry.id).elite, opt: false }];
  if (entry.group !== 'skill' && entry.group !== 'status') return [];
  const out = [];
  for (const def of Object.values(CARD_DEFS)) {
    const base = def.levels.some(l => (l.skills || def.skills || []).some(k => k.id === entry.id)) || (def.skills || []).some(k => k.id === entry.id);
    const opt = (def.options || []).some(k => k.id === entry.id);
    if (base || opt) out.push({ id: def.id, opt: !base });
  }
  return out;
}

// 検索用に文字をそろえる（小文字・カタカナ→ひらがな・空白や記号を除く）
function dictNorm(text) {
  return String(text).toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s\-・ー]/g, '');
}

// 絞り込みと並べ替え
//   q: 検索語（日本語名・英語名・読み）　group: 'skill' など（null は全部）　cat: 'atk' など（null は全部）
//   sort: 'kana'（50音順）/ 'cat'（分類順）　keys: この集合にある項目だけ（「自分のデッキ」用）
function dictSearch({ q = '', group = null, cat = null, sort = 'cat', keys = null } = {}) {
  const n = dictNorm(q);
  const out = DICT.filter(e => (!group || e.group === group) && (!cat || e.cat === cat) && (!keys || keys.has(e.key))
    && (!n || [e.name, e.ja, e.yomi, e.id].some(t => dictNorm(t).includes(n))));
  const cats = Object.keys(DICT_CATS), groups = Object.keys(DICT_GROUPS);
  if (sort === 'kana') return out.sort((a, b) => dictNorm(a.yomi).localeCompare(dictNorm(b.yomi), 'ja') || a.order - b.order);
  return out.sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || cats.indexOf(a.cat) - cats.indexOf(b.cat) || a.order - b.order);
}

// 自分のデッキに入っているスキル（選んだ選択スキル・装備・フラッシュ・ヒーロースキルも含む）
function deckDictKeys(profile) {
  const keys = new Set();
  for (const id of [...profile.deck.monsters, ...profile.deck.items]) {
    for (const k of ownedCard(profile, id).skills || []) keys.add('skill:' + k.id);
  }
  keys.add('hero:' + heroForBattle(profile).skill);
  return keys;
}
