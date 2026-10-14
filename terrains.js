// ============================================================
// 地形。対戦ごとに1つあり、両者に同じ効果がかかる。
// ここに1行足せば地形を増やせる（fx に書いた効果を engine.js が読む）。
//   scene: 背景の名前（scenery.js）
//   fx:    効果。使えるもの：
//     healColor: その色のモンスターの Heal・Group Heal の数値+1
//     burn / burnImmune: ターン開始時、手番のプレイヤーの場のモンスター全員に burn の固定ダメージ（burnImmune の色は無効）
//     flyingDodge: Flying の回避率に足す値
//     diseaseStay: Disease スタックが Heal や Outbreak Halo で減らない
//     atk: { 攻撃タイプ: 足す攻撃力 }
//     rangedMiss: 遠隔攻撃が外れる確率
//     regen: ターン開始時、手番のプレイヤーの場のモンスター全員を regen 回復
//     storm: ターン開始時、手番のプレイヤーの場の Flying を持たないランダムな1体に storm の固定ダメージ
//   special: true はボス戦専用（フリー対戦では選ばれない）
// ============================================================

const TERRAINS = [
  { id: 'plain', name: '平原', yomi: 'へいげん', icon: '🌾', scene: 'meadow', desc: '効果なし', fx: {} },
  { id: 'forest', name: '森', yomi: 'もり', icon: '🌳', scene: 'forest', desc: '緑のモンスターの Heal・Group Heal +1', fx: { healColor: 'green' } },
  { id: 'volcano', name: '火山', yomi: 'かざん', icon: '🌋', scene: 'volcano', desc: 'ターン開始時、手番側の場のモンスター全員に1ダメージ（赤は無効）', fx: { burn: 1, burnImmune: 'red' } },
  { id: 'sky', name: '天空', yomi: 'てんくう', icon: '☁️', scene: 'sky', desc: 'Flying の回避率+15%（近接65%・遠隔40%）', fx: { flyingDodge: 0.15 } },
  { id: 'swamp', name: '毒沼', yomi: 'どくぬま', icon: '🐸', scene: 'swamp', desc: 'Disease スタックが Heal や Outbreak Halo で減らない', fx: { diseaseStay: true } },
  { id: 'castle', name: '古城', yomi: 'こじょう', icon: '🏰', scene: 'castle', desc: '魔法攻撃+1', fx: { atk: { magic: 1 } } },
  { id: 'mist', name: '霧の湖', yomi: 'きりのみずうみ', icon: '🌫', scene: 'lake', desc: '遠隔攻撃が20%の確率で外れる', fx: { rangedMiss: 0.2 } },
  // ボス戦の特殊地形
  { id: 'hill', name: '見張りの丘', yomi: 'みはりのおか', icon: '⛰️', scene: 'meadow', special: true, desc: '遠隔攻撃+1', fx: { atk: { ranged: 1 } } },
  { id: 'deepmist', name: '女王の濃霧', yomi: 'じょおうののうむ', icon: '🌁', scene: 'lake', special: true, desc: '遠隔攻撃が30%の確率で外れる', fx: { rangedMiss: 0.3 } },
  { id: 'worldtree', name: '世界樹の根元', yomi: 'せかいじゅのねもと', icon: '🌲', scene: 'forest', special: true, desc: 'ターン開始時、手番側の場のモンスター全員を1回復', fx: { regen: 1 } },
  { id: 'storm', name: '雷雲の頂', yomi: 'らいうんのいただき', icon: '⛈️', scene: 'sky', special: true, desc: 'ターン開始時、手番側の場の Flying を持たないランダムな1体に落雷（2ダメージ）', fx: { storm: 2 } },
  { id: 'throne', name: '魔王の玉座', yomi: 'まおうのぎょくざ', icon: '👁️', scene: 'castle', special: true, desc: 'カオス攻撃+1。Disease スタックが Heal で減らない', fx: { atk: { chaos: 1 }, diseaseStay: true } },
];

const TERRAIN_BY_ID = {};
TERRAINS.forEach(t => { TERRAIN_BY_ID[t.id] = t; });

// フリー対戦の地形：特殊地形以外からランダム
function randomTerrain(rng = Math.random) {
  const pool = TERRAINS.filter(t => !t.special);
  return pool[Math.floor(rng() * pool.length)].id;
}
