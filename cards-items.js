// ============================================================
// アイテムデッキに入るカード（装備20・フラッシュ15）
//   color:  装備できるモンスターの色。null なら無色（どの色にも装備できる）
//           色付きのフラッシュは、その色のモンスターが自分の場にいるときだけ使える
//   base:   （色付き版だけ）同じ効果の無色版のid。色付き版は無色版よりコストが1安い
//   rarity: common / rare / epic / legend（最大レベルはコモン・レアがLv3、エピック・レジェンドがLv2）
//   image:  （省略可）絵の画像のパス。書くとSVGの絵のかわりにその画像を表示する（例： image: 'images/e01.png'）
//   levels: レベル別の効果。上から Lv1, Lv2, …
// ============================================================

// 装備カード
//   atk:    { 攻撃タイプ: 値 }  そのタイプの攻撃力に加算。本体が持たないタイプなら、その攻撃を追加する
//   armor:  アーマー（盾ゲージ。物理ダメージを肩代わりし、0になるまでHPを守る）
//   hp:     体力アップ
//   skills: 装備したモンスターが得るスキル
const EQUIP_DEFS = [
  // ---- 無色（どの色のモンスターにも装備できる） ----
  { id: 'e01', name: '鉄の剣', icon: '🗡️', color: null, rarity: 'common', cost: 1,
    levels: [
      { atk: { melee: 2 } },
      { atk: { melee: 2 }, hp: 1 },
      { atk: { melee: 3 }, hp: 1 },
    ] },
  { id: 'e02', name: '狩人の弓', icon: '🏹', color: null, rarity: 'common', cost: 1,
    levels: [
      { atk: { ranged: 1 } },
      { atk: { ranged: 2 } },
      { atk: { ranged: 2 }, hp: 1 },
    ] },
  { id: 'e03', name: '魔力の宝珠', icon: '🔮', color: null, rarity: 'common', cost: 2,
    levels: [
      { atk: { magic: 2 } },
      { atk: { magic: 2 }, hp: 1 },
      { atk: { magic: 3 }, hp: 1 },
    ] },
  { id: 'e04', name: '革の鎧', icon: '🦺', color: null, rarity: 'common', cost: 1,
    levels: [
      { armor: 2 },
      { armor: 3 },
      { armor: 4 },
    ] },
  { id: 'e05', name: '命の護符', icon: '📿', color: null, rarity: 'common', cost: 1,
    levels: [
      { hp: 3 },
      { hp: 4 },
      { hp: 5 },
    ] },
  { id: 'e06', name: '鋼の大盾', icon: '🛡️', color: null, rarity: 'rare', cost: 2,
    levels: [
      { armor: 5 },
      { armor: 6 },
      { armor: 7 },
    ] },
  { id: 'e07', name: '長槍', icon: '🔱', color: null, rarity: 'rare', cost: 2,
    levels: [
      { atk: { melee: 1 }, skills: [{ id: 'reach' }] },
      { atk: { melee: 1 }, hp: 1, skills: [{ id: 'reach' }] },
      { atk: { melee: 2 }, hp: 1, skills: [{ id: 'reach' }] },
    ] },
  { id: 'e08', name: '挑発の旗', icon: '🏴', color: null, rarity: 'rare', cost: 2,
    levels: [
      { armor: 3, skills: [{ id: 'taunt' }] },
      { armor: 4, skills: [{ id: 'taunt' }] },
      { armor: 5, skills: [{ id: 'taunt' }] },
    ] },
  { id: 'e09', name: '連撃の籠手', icon: '🥊', color: null, rarity: 'epic', cost: 2,
    levels: [
      { skills: [{ id: 'batter', x: 1 }] },
      { atk: { melee: 1 }, skills: [{ id: 'batter', x: 1 }] },
    ] },
  { id: 'e10', name: '混沌の欠片', icon: '💠', color: null, rarity: 'common', cost: 2,
    levels: [
      { atk: { chaos: 2 } },
      { atk: { chaos: 2 }, hp: 1 },
      { atk: { chaos: 3 }, hp: 1 },
    ] },

  // ---- 赤 ----
  { id: 'e11', name: '炎の剣', icon: '🔥', color: 'red', rarity: 'rare', cost: 2,
    levels: [
      { atk: { melee: 3 } },
      { atk: { melee: 3 }, hp: 2 },
      { atk: { melee: 4 }, hp: 2, skills: [{ id: 'piercing' }] },
    ] },
  { id: 'e12', name: '闘志の鉢巻', icon: '🎗️', color: 'red', rarity: 'epic', cost: 3,
    levels: [
      { hp: 2, skills: [{ id: 'inspire', x: 1 }] },
      { hp: 3, skills: [{ id: 'inspire', x: 2 }] },
    ] },

  // ---- 青 ----
  { id: 'e13', name: '氷の杖', icon: '❄️', color: 'blue', rarity: 'rare', cost: 3,
    levels: [
      { atk: { magic: 3 } },
      { atk: { magic: 3 }, hp: 2 },
      { atk: { magic: 4 }, hp: 2 },
    ] },
  { id: 'e14', name: '静寂の仮面', icon: '🎭', color: 'blue', rarity: 'epic', cost: 3,
    levels: [
      { armor: 2, skills: [{ id: 'silence', x: 1 }] },
      { armor: 3, skills: [{ id: 'silence', x: 2 }] },
    ] },

  // ---- 緑 ----
  { id: 'e15', name: '茨の外套', icon: '🧥', color: 'green', rarity: 'rare', cost: 2,
    levels: [
      { hp: 2, skills: [{ id: 'thorns', x: 1 }] },
      { hp: 2, skills: [{ id: 'thorns', x: 2 }] },
      { hp: 4, skills: [{ id: 'thorns', x: 2 }] },
    ] },
  { id: 'e16', name: '世界樹の葉', icon: '🍃', color: 'green', rarity: 'legend', cost: 3, optionLevel: 2,
    options: [{ id: 'healingshield', x: 2 }, { id: 'thorns', x: 1 }],
    levels: [
      { hp: 4, skills: [{ id: 'heal', x: 2 }] },
      { hp: 5, skills: [{ id: 'heal', x: 3 }] },
    ] },

  // ---- 黄 ----
  { id: 'e17', name: '対空の矢筒', icon: '🎯', color: 'yellow', rarity: 'common', cost: 1,
    levels: [
      { atk: { ranged: 1 }, skills: [{ id: 'antiair', x: 2 }] },
      { atk: { ranged: 1 }, skills: [{ id: 'antiair', x: 3 }] },
      { atk: { ranged: 2 }, skills: [{ id: 'antiair', x: 3 }] },
    ] },
  { id: 'e18', name: '天翼の靴', icon: '🪽', color: 'yellow', rarity: 'legend', cost: 4, optionLevel: 2,
    options: [{ id: 'dive', x: 2 }, { id: 'bombard', x: 1 }],
    levels: [
      { skills: [{ id: 'flying' }] },
      { hp: 3, skills: [{ id: 'flying' }] },
    ] },

  // ---- 紫 ----
  { id: 'e19', name: '病魔の牙', icon: '🦷', color: 'purple', rarity: 'rare', cost: 2,
    levels: [
      { atk: { chaos: 1 }, skills: [{ id: 'disease', x: 1 }] },
      { atk: { chaos: 2 }, skills: [{ id: 'disease', x: 1 }] },
      { atk: { chaos: 2 }, skills: [{ id: 'disease', x: 2 }] },
    ] },
  { id: 'e20', name: '魔眼の珠', icon: '👁️', color: 'purple', rarity: 'epic', cost: 3,
    levels: [
      { atk: { chaos: 3 }, skills: [{ id: 'stealth' }] },
      { atk: { chaos: 4 }, skills: [{ id: 'stealth' }] },
    ] },
  { id: 'e27', name: '鏡の盾', icon: '🪞', color: null, rarity: 'rare', cost: 2,
    levels: [
      { armor: 2, skills: [{ id: 'mirrorshield', x: 1 }] },
      { armor: 3, skills: [{ id: 'mirrorshield', x: 1 }] },
      { armor: 3, skills: [{ id: 'mirrorshield', x: 2 }] },
    ] },
  { id: 'e28', name: '棘の盾', icon: '📍', color: null, rarity: 'rare', cost: 2,
    levels: [
      { armor: 3, skills: [{ id: 'shieldspike', x: 1 }] },
      { armor: 4, skills: [{ id: 'shieldspike', x: 1 }] },
      { armor: 4, skills: [{ id: 'shieldspike', x: 2 }] },
    ] },

  // ---- 同色割引：無色版と同じ効果で、コストが1安い（base が無色版のid） ----
  { id: 'e21', name: '紅蓮の小剣', icon: '🗡️', color: 'red', rarity: 'common', cost: 0, base: 'e01',
    levels: [
      { atk: { melee: 2 } },
      { atk: { melee: 2 }, hp: 1 },
      { atk: { melee: 3 }, hp: 1 },
    ] },
  { id: 'e22', name: '陽光の弓', icon: '🏹', color: 'yellow', rarity: 'common', cost: 0, base: 'e02',
    levels: [
      { atk: { ranged: 1 } },
      { atk: { ranged: 2 } },
      { atk: { ranged: 2 }, hp: 1 },
    ] },
  { id: 'e23', name: '蒼海の宝珠', icon: '🔮', color: 'blue', rarity: 'common', cost: 1, base: 'e03',
    levels: [
      { atk: { magic: 2 } },
      { atk: { magic: 2 }, hp: 1 },
      { atk: { magic: 3 }, hp: 1 },
    ] },
  { id: 'e24', name: '樹皮の鎧', icon: '🦺', color: 'green', rarity: 'common', cost: 0, base: 'e04',
    levels: [
      { armor: 2 },
      { armor: 3 },
      { armor: 4 },
    ] },
  { id: 'e25', name: '深淵の欠片', icon: '💠', color: 'purple', rarity: 'common', cost: 1, base: 'e10',
    levels: [
      { atk: { chaos: 2 } },
      { atk: { chaos: 2 }, hp: 1 },
      { atk: { chaos: 3 }, hp: 1 },
    ] },
  { id: 'e26', name: '聖騎士の盾', icon: '🛡️', color: 'yellow', rarity: 'rare', cost: 1, base: 'e06',
    levels: [
      { armor: 5 },
      { armor: 6 },
      { armor: 7 },
    ] },
  // ---- 追加の装備（新しいスキルを持つ15枚） ----
  { id: 'e29', name: '兜割りの斧', icon: '🪓', color: 'red', rarity: 'rare', cost: 2,
    levels: [
      { atk: { melee: 1 }, skills: [{ id: 'sunder' }] },
      { atk: { melee: 2 }, skills: [{ id: 'sunder' }] },
      { atk: { melee: 2 }, hp: 2, skills: [{ id: 'sunder' }] },
    ] },
  { id: 'e30', name: '遺恨の鎖', icon: '⛓️', color: null, rarity: 'common', cost: 1,
    levels: [
      { hp: 2, skills: [{ id: 'grudge', x: 1 }] },
      { hp: 3, skills: [{ id: 'grudge', x: 1 }] },
      { hp: 4, armor: 1, skills: [{ id: 'grudge', x: 1 }] },
    ] },
  { id: 'e31', name: '追い打ちの篭手', icon: '🔂', color: 'red', rarity: 'common', cost: 1,
    levels: [
      { atk: { melee: 1 }, skills: [{ id: 'followthrough' }] },
      { atk: { melee: 1 }, hp: 1, skills: [{ id: 'followthrough' }] },
      { atk: { melee: 2 }, hp: 1, skills: [{ id: 'followthrough' }] },
    ] },
  { id: 'e32', name: '貫きの水晶', icon: '🔱', color: 'blue', rarity: 'rare', cost: 2,
    levels: [
      { atk: { magic: 1 }, skills: [{ id: 'spellpierce' }] },
      { atk: { magic: 2 }, skills: [{ id: 'spellpierce' }] },
      { atk: { magic: 2 }, hp: 2, skills: [{ id: 'spellpierce' }] },
    ] },
  { id: 'e33', name: '弱み見の眼鏡', icon: '🧿', color: 'blue', rarity: 'common', cost: 1,
    levels: [
      { atk: { magic: 1 }, skills: [{ id: 'exploit', x: 1 }] },
      { atk: { magic: 1 }, hp: 1, skills: [{ id: 'exploit', x: 1 }] },
      { atk: { magic: 1 }, hp: 1, skills: [{ id: 'exploit', x: 2 }] },
    ] },
  { id: 'e34', name: '癒しの香炉', icon: '🌼', color: 'green', rarity: 'rare', cost: 2,
    levels: [
      { hp: 2, skills: [{ id: 'mendingaura', x: 1 }] },
      { hp: 3, skills: [{ id: 'mendingaura', x: 1 }] },
      { hp: 3, skills: [{ id: 'mendingaura', x: 2 }] },
    ] },
  { id: 'e35', name: '形見の花束', icon: '💐', color: 'green', rarity: 'common', cost: 1,
    levels: [
      { hp: 1, skills: [{ id: 'partinggift', x: 2 }] },
      { hp: 2, skills: [{ id: 'partinggift', x: 3 }] },
      { hp: 2, skills: [{ id: 'partinggift', x: 4 }] },
    ] },
  { id: 'e36', name: '吸命の牙', icon: '🩸', color: null, rarity: 'rare', cost: 2,
    levels: [
      { atk: { melee: 1 }, skills: [{ id: 'leech', x: 1 }] },
      { atk: { melee: 1 }, hp: 1, skills: [{ id: 'leech', x: 1 }] },
      { atk: { melee: 2 }, hp: 1, skills: [{ id: 'leech', x: 1 }] },
    ] },
  { id: 'e37', name: '零距離の短弓', icon: '🔫', color: 'yellow', rarity: 'common', cost: 1,
    levels: [
      { atk: { ranged: 1 }, skills: [{ id: 'pointblank' }] },
      { atk: { ranged: 2 }, skills: [{ id: 'pointblank' }] },
      { atk: { ranged: 2 }, hp: 1, skills: [{ id: 'pointblank' }] },
    ] },
  { id: 'e38', name: '伏兵の外套', icon: '🥷', color: 'yellow', rarity: 'rare', cost: 2,
    levels: [
      { hp: 1, skills: [{ id: 'ambush', x: 1 }] },
      { hp: 2, skills: [{ id: 'ambush', x: 2 }] },
      { hp: 2, armor: 1, skills: [{ id: 'ambush', x: 2 }] },
    ] },
  { id: 'e39', name: '静かな照準器', icon: '🧘', color: 'yellow', rarity: 'common', cost: 1,
    levels: [
      { atk: { ranged: 1 }, skills: [{ id: 'steadyaim', x: 1 }] },
      { atk: { ranged: 1 }, skills: [{ id: 'steadyaim', x: 2 }] },
      { atk: { ranged: 1 }, hp: 1, skills: [{ id: 'steadyaim', x: 2 }] },
    ] },
  { id: 'e40', name: '不吉な鈴', icon: '🐈‍⬛', color: 'purple', rarity: 'common', cost: 1,
    levels: [
      { hp: 2, skills: [{ id: 'jinx', x: 1 }] },
      { hp: 3, skills: [{ id: 'jinx', x: 1 }] },
      { hp: 3, skills: [{ id: 'jinx', x: 2 }] },
    ] },
  { id: 'e41', name: '幸運の金貨', icon: '🍀', color: 'purple', rarity: 'rare', cost: 2,
    levels: [
      { atk: { chaos: 2 }, skills: [{ id: 'luckyshot', x: 2 }] },
      { atk: { chaos: 2 }, skills: [{ id: 'luckyshot', x: 3 }] },
      { atk: { chaos: 3 }, skills: [{ id: 'luckyshot', x: 3 }] },
    ] },
  { id: 'e42', name: '燃えさかる刃', icon: '🔥', color: null, rarity: 'rare', cost: 2,
    levels: [
      { atk: { melee: 1 }, skills: [{ id: 'scorch', x: 1 }] },
      { atk: { melee: 2 }, skills: [{ id: 'scorch', x: 1 }] },
      { atk: { melee: 2 }, skills: [{ id: 'scorch', x: 2 }] },
    ] },
  { id: 'e43', name: '刈り入れの鎌', icon: '🌾', color: null, rarity: 'common', cost: 1,
    levels: [
      { atk: { melee: 1 }, skills: [{ id: 'harvest', x: 1 }] },
      { atk: { melee: 2 }, skills: [{ id: 'harvest', x: 1 }] },
      { atk: { melee: 2 }, hp: 1, skills: [{ id: 'harvest', x: 1 }] },
    ] },
  // ---- 追加の装備（コストを増減するスキル） ----
  { id: 'e44', name: '退き口の角笛', icon: '🏳️', color: null, rarity: 'common', cost: 1,
    levels: [
      { hp: 2, skills: [{ id: 'fallback', x: 1 }] },
      { hp: 3, skills: [{ id: 'fallback', x: 1 }] },
      { hp: 3, armor: 1, skills: [{ id: 'fallback', x: 1 }] },
    ] },
  // ---- 2種類の攻撃を足す装備（7個） ----
  //   同じ種類の攻撃を持つモンスターには加算、持たない種類は攻撃が増える（攻撃の種類は本体と合わせて3つまで）
  { id: 'e45', name: 'ルーンの魔剣', icon: '⚔️', color: null, rarity: 'rare', cost: 2,
    levels: [
      { atk: { melee: 1, magic: 1 } },
      { atk: { melee: 1, magic: 1 }, hp: 1 },
      { atk: { melee: 2, magic: 1 }, hp: 1 },
    ] },
  { id: 'e46', name: '双筒の弩', icon: '🎯', color: null, rarity: 'rare', cost: 2,
    levels: [
      { atk: { ranged: 1, chaos: 1 } },
      { atk: { ranged: 2, chaos: 1 } },
      { atk: { ranged: 2, chaos: 1 }, hp: 1 },
    ] },
  { id: 'e47', name: '炎の投げ槍', icon: '🔥', color: 'red', rarity: 'rare', cost: 2,
    levels: [
      { atk: { melee: 1, ranged: 1 } },
      { atk: { melee: 2, ranged: 1 } },
      { atk: { melee: 2, ranged: 1 }, hp: 1 },
    ] },
  { id: 'e48', name: '氷晶の杖剣', icon: '❄️', color: 'blue', rarity: 'rare', cost: 3,
    levels: [
      { atk: { magic: 2, melee: 1 } },
      { atk: { magic: 2, melee: 1 }, armor: 1 },
      { atk: { magic: 3, melee: 1 }, armor: 1 },
    ] },
  { id: 'e49', name: '天穹の長弓', icon: '🌈', color: 'yellow', rarity: 'epic', cost: 3,
    levels: [
      { atk: { ranged: 2, magic: 1 } },
      { atk: { ranged: 3, magic: 1 } },
    ] },
  { id: 'e50', name: '混沌の短剣', icon: '🗡️', color: 'purple', rarity: 'epic', cost: 3,
    levels: [
      { atk: { melee: 1, chaos: 2 } },
      { atk: { melee: 2, chaos: 2 } },
    ] },
  { id: 'e51', name: '森番の杖弓', icon: '🎋', color: 'green', rarity: 'common', cost: 2,
    levels: [
      { atk: { ranged: 1, magic: 1 } },
      { atk: { ranged: 1, magic: 1 }, hp: 1 },
      { atk: { ranged: 1, magic: 1 }, hp: 2 },
    ] },
];

// フラッシュカード（使い切り）
//   skills: 効果。[{ id, x }]（レベルごとに cost を書けば、コストも変えられる）
const FLASH_DEFS = [
  { id: 'f01', name: '石つぶて', icon: '🪨', color: null, rarity: 'common', cost: 1,
    levels: [
      { skills: [{ id: 'smite', x: 3 }] },
      { skills: [{ id: 'smite', x: 4 }] },
      { skills: [{ id: 'smite', x: 5 }] },
    ] },
  { id: 'f02', name: '稲妻', icon: '🌩️', color: null, rarity: 'common', cost: 2,
    levels: [
      { skills: [{ id: 'lightning', x: 3 }] },
      { skills: [{ id: 'lightning', x: 4 }] },
      { skills: [{ id: 'lightning', x: 5 }] },
    ] },
  { id: 'f03', name: '癒しの光', icon: '💖', color: null, rarity: 'common', cost: 1,
    levels: [
      { skills: [{ id: 'heal', x: 5 }] },
      { skills: [{ id: 'heal', x: 6 }] },
      { skills: [{ id: 'heal', x: 8 }] },
    ] },
  { id: 'f04', name: '援軍の角笛', icon: '📯', color: null, rarity: 'common', cost: 0,
    levels: [
      { skills: [{ id: 'reinforcement', x: 1 }] },
      { skills: [{ id: 'reinforcement', x: 1 }] },
      { skills: [{ id: 'reinforcement', x: 2 }] },
    ] },
  { id: 'f05', name: '疫病の霧', icon: '🦠', color: null, rarity: 'rare', cost: 1,
    levels: [
      { skills: [{ id: 'groupdisease', x: 2 }] },
      { skills: [{ id: 'groupdisease', x: 3 }] },
      { skills: [{ id: 'groupdisease', x: 3 }] },
    ] },
  { id: 'f06', name: '押し戻し', icon: '↩️', color: null, rarity: 'rare', cost: 3,
    levels: [
      { skills: [{ id: 'unsummon' }] },
      { skills: [{ id: 'unsummon' }] },
      { cost: 2, skills: [{ id: 'unsummon' }] },
    ] },
  { id: 'f07', name: '癒しの雨', icon: '🌧️', color: null, rarity: 'rare', cost: 2,
    levels: [
      { skills: [{ id: 'groupheal', x: 3 }] },
      { skills: [{ id: 'groupheal', x: 3 }] },
      { skills: [{ id: 'groupheal', x: 4 }] },
    ] },
  { id: 'f08', name: '火球', icon: '☄️', color: null, rarity: 'common', cost: 3,
    levels: [
      { skills: [{ id: 'smite', x: 6 }] },
      { skills: [{ id: 'smite', x: 7 }] },
      { skills: [{ id: 'smite', x: 8 }] },
    ] },
  { id: 'f09', name: '裁きの雷', icon: '⚡', color: null, rarity: 'epic', cost: 4,
    levels: [
      { skills: [{ id: 'lightning', x: 7 }] },
      { skills: [{ id: 'lightning', x: 9 }] },
    ] },
  { id: 'f10', name: '魔石の閃き', icon: '💎', color: null, rarity: 'rare', cost: 1,
    levels: [
      { skills: [{ id: 'reinforcement', x: 2 }] },
      { skills: [{ id: 'reinforcement', x: 2 }] },
      { skills: [{ id: 'reinforcement', x: 3 }] },
    ] },
  { id: 'f11', name: '聖なる泉', icon: '⛲', color: null, rarity: 'epic', cost: 3,
    levels: [
      { skills: [{ id: 'groupheal', x: 5 }] },
      { skills: [{ id: 'groupheal', x: 7 }] },
    ] },
  { id: 'f12', name: '黒死の呪い', icon: '☠️', color: null, rarity: 'epic', cost: 1,
    levels: [
      { skills: [{ id: 'groupdisease', x: 4 }] },
      { skills: [{ id: 'groupdisease', x: 6 }] },
    ] },
  { id: 'f13', name: '時戻しの砂', icon: '⏳', color: null, rarity: 'legend', cost: 2,
    levels: [
      { skills: [{ id: 'unsummon' }] },
      { cost: 1, skills: [{ id: 'unsummon' }] },
    ] },
  { id: 'f14', name: '氷の矢', icon: '🧊', color: null, rarity: 'common', cost: 1,
    levels: [
      { skills: [{ id: 'lightning', x: 2 }] },
      { skills: [{ id: 'lightning', x: 2 }] },
      { skills: [{ id: 'lightning', x: 3 }] },
    ] },
  { id: 'f15', name: '応急手当', icon: '🩹', color: null, rarity: 'rare', cost: 0,
    levels: [
      { skills: [{ id: 'heal', x: 3 }] },
      { skills: [{ id: 'heal', x: 4 }] },
      { skills: [{ id: 'heal', x: 5 }] },
    ] },
  { id: 'f21', name: '腐食の雫', icon: '🧪', color: null, rarity: 'common', cost: 1,
    levels: [
      { skills: [{ id: 'corrosion' }] },
      { skills: [{ id: 'corrosion' }] },
      { cost: 0, skills: [{ id: 'corrosion' }] },
    ] },
  { id: 'f22', name: '大腐食', icon: '⚗️', color: null, rarity: 'rare', cost: 3,
    levels: [
      { skills: [{ id: 'masscorrosion' }] },
      { skills: [{ id: 'masscorrosion' }] },
      { cost: 2, skills: [{ id: 'masscorrosion' }] },
    ] },
  { id: 'f23', name: '終止符', icon: '✂️', color: null, rarity: 'epic', cost: 5,
    levels: [
      { skills: [{ id: 'terminate' }] },
      { cost: 4, skills: [{ id: 'terminate' }] },
    ] },
  { id: 'f24', name: '撤退の合図', icon: '⤵️', color: null, rarity: 'common', cost: 0,
    levels: [
      { skills: [{ id: 'retreat' }] },
      { skills: [{ id: 'retreat' }] },
      { skills: [{ id: 'retreat' }] },
    ] },
  { id: 'f25', name: '霧の帳', icon: '💨', color: null, rarity: 'common', cost: 1,
    levels: [
      { skills: [{ id: 'lingeringfog' }] },
      { skills: [{ id: 'lingeringfog' }] },
      { cost: 0, skills: [{ id: 'lingeringfog' }] },
    ] },
  { id: 'f27', name: '幻影の術', icon: '👥', color: null, rarity: 'epic', cost: 2,
    levels: [
      { skills: [{ id: 'phantom' }] },
      { cost: 1, skills: [{ id: 'phantom' }] },
    ] },
  { id: 'f26', name: '守りの祈り', icon: '🙏', color: null, rarity: 'rare', cost: 2,
    levels: [
      { skills: [{ id: 'heal', x: 3 }, { id: 'healingshield', x: 1, shield: 'sacredshield' }] },
      { skills: [{ id: 'heal', x: 4 }, { id: 'healingshield', x: 1, shield: 'sacredshield' }] },
      { skills: [{ id: 'heal', x: 5 }, { id: 'healingshield', x: 2, shield: 'sacredshield' }] },
    ] },

  // ---- 同色割引：その色のモンスターが自分の場にいるときだけ使える。無色版よりコストが1安い ----
  { id: 'f16', name: '火山弾', icon: '🪨', color: 'red', rarity: 'common', cost: 0, base: 'f01',
    levels: [
      { skills: [{ id: 'smite', x: 3 }] },
      { skills: [{ id: 'smite', x: 4 }] },
      { skills: [{ id: 'smite', x: 5 }] },
    ] },
  { id: 'f17', name: '氷雷', icon: '🌩️', color: 'blue', rarity: 'common', cost: 1, base: 'f02',
    levels: [
      { skills: [{ id: 'lightning', x: 3 }] },
      { skills: [{ id: 'lightning', x: 4 }] },
      { skills: [{ id: 'lightning', x: 5 }] },
    ] },
  { id: 'f18', name: '森の息吹', icon: '💖', color: 'green', rarity: 'common', cost: 0, base: 'f03',
    levels: [
      { skills: [{ id: 'heal', x: 5 }] },
      { skills: [{ id: 'heal', x: 6 }] },
      { skills: [{ id: 'heal', x: 8 }] },
    ] },
  { id: 'f19', name: '瘴気', icon: '🦠', color: 'purple', rarity: 'rare', cost: 0, base: 'f05',
    levels: [
      { skills: [{ id: 'groupdisease', x: 2 }] },
      { skills: [{ id: 'groupdisease', x: 3 }] },
      { skills: [{ id: 'groupdisease', x: 3 }] },
    ] },
  { id: 'f20', name: '陽だまりの雨', icon: '🌧️', color: 'yellow', rarity: 'rare', cost: 1, base: 'f07',
    levels: [
      { skills: [{ id: 'groupheal', x: 3 }] },
      { skills: [{ id: 'groupheal', x: 3 }] },
      { skills: [{ id: 'groupheal', x: 4 }] },
    ] },
  // ---- 追加のフラッシュ（新しいスキル） ----
  { id: 'f28', name: '足止めの氷', icon: '⏳', color: null, rarity: 'common', cost: 2,
    levels: [
      { skills: [{ id: 'stall', x: 1 }] },
      { skills: [{ id: 'stall', x: 2 }] },
      { cost: 1, skills: [{ id: 'stall', x: 2 }] },
    ] },
  { id: 'f29', name: '病の炸裂', icon: '💥', color: 'purple', rarity: 'rare', cost: 2,
    levels: [
      { skills: [{ id: 'plagueburst', x: 1 }] },
      { skills: [{ id: 'plagueburst', x: 2 }] },
      { cost: 1, skills: [{ id: 'plagueburst', x: 2 }] },
    ] },
  // ---- 追加のフラッシュ（コストを増減するスキル） ----
  { id: 'f30', name: '立て直しの号令', icon: '🔙', color: null, rarity: 'common', cost: 1,
    levels: [
      { skills: [{ id: 'regroup', x: 1 }] },
      { skills: [{ id: 'regroup', x: 2 }] },
      { cost: 0, skills: [{ id: 'regroup', x: 2 }] },
    ] },
  { id: 'f31', name: '重い関税', icon: '🧾', color: null, rarity: 'rare', cost: 2,
    levels: [
      { skills: [{ id: 'tax', x: 1 }] },
      { skills: [{ id: 'tax', x: 2 }] },
      { cost: 1, skills: [{ id: 'tax', x: 2 }] },
    ] },
  // ---- 追加のフラッシュ（召喚のスキル） ----
  { id: 'f32', name: '身代わりの群れ', icon: '🧱', color: null, rarity: 'common', cost: 1,
    levels: [
      { skills: [{ id: 'swarm', x: 1 }] },
      { skills: [{ id: 'swarm', x: 2 }] },
      { cost: 0, skills: [{ id: 'swarm', x: 2 }] },
    ] },
  { id: 'f33', name: '迷惑な贈り物', icon: '⚓', color: null, rarity: 'rare', cost: 2,
    levels: [
      { skills: [{ id: 'unwelcomegift', x: 4 }] },
      { skills: [{ id: 'unwelcomegift', x: 5 }] },
      { cost: 1, skills: [{ id: 'unwelcomegift', x: 5 }] },
    ] },
  // ---- 追加のフラッシュ（足されたカードを取り除く） ----
  { id: 'f34', name: '大掃除', icon: '🧹', color: null, rarity: 'common', cost: 1,
    levels: [
      { skills: [{ id: 'purge' }] },
      { skills: [{ id: 'purge' }] },
      { cost: 0, skills: [{ id: 'purge' }] },
    ] },
];
