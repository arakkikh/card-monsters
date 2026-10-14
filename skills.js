// ============================================================
// スキルの一覧（名前・アイコン・説明）
// カードには skills: [{ id, x }] の形で持たせる。モンスター・装備・フラッシュのどれにも付けられる。
// 数値を持たないスキル（noX）は { id } だけでよい。
//   short: カード上に出す短い説明 / desc: 長押し・ホバーで出す詳しい説明
// 実際の処理は engine.js にある。
// ============================================================

const SKILLS = {
  // ---- 攻撃系 ----
  piercing: {
    name: 'Piercing', icon: '📌', noX: true, short: () => 'アーマー貫通',
    desc: () => '近接・遠隔攻撃でアーマーを破壊したとき、超過したダメージがHPに届く',
  },
  doublestrike: {
    name: 'Doublestrike', icon: '⚡', short: x => `後列に${x}`,
    desc: x => `近接攻撃が当たったとき、ランダムな後列の敵1体に${x}の追加ダメージ`,
  },
  batter: {
    name: 'Batter', icon: '👊', short: x => `近接+${x}回`,
    desc: x => `近接攻撃を${x}回追加で行う`,
  },
  reach: {
    name: 'Reach', icon: '📏', noX: true, short: () => '後列から近接',
    desc: () => '後列（スロット2・3）からでも近接攻撃ができる',
  },
  antiair: {
    name: 'Anti-Air', icon: '🎯', short: x => `対Flying+${x}`,
    desc: x => `Flying持ちに回避されず、Flying持ちに${x}の追加ダメージ`,
  },
  swallow: {
    name: 'Swallow', icon: '🍖', short: x => `撃破で+${x}`,
    desc: x => `敵を倒すたび、すべての攻撃力と最大HPが永続的に+${x}`,
  },

  seethrough: {
    name: 'See-through', icon: '👁️', noX: true, short: () => '防御スキル無視',
    desc: () => '攻撃のとき、相手の Counter-Attack・Cross-Counter-Attack・Flying・Fog・Opportunity・Shield・Thorns を無視する',
  },
  overlord: {
    name: 'Overlord', icon: '👑', noX: true, short: () => 'スキル2倍',
    desc: () => '攻撃そのもの以外の、自分のスキルが2回ぶん発動する（数値のあるスキルは数値が2倍、Fear は2回入れ替える。Equilibrium と Rearguard は変わらない）',
  },
  menace: {
    name: 'Menace', icon: '😡', short: x => `移動した敵に${x}`,
    desc: x => `自分のターン中、位置が変わった敵モンスターに${x}の固定ダメージ（Fear での入れ替えや、撃破による詰めで発動）`,
  },
  bombard: {
    name: 'Bombard', icon: '💣', short: x => `対地+${x}`,
    desc: x => `Flying を持つこのモンスターが、Flying を持たない敵を近接・遠隔で攻撃するとき、${x}の追加ダメージ`,
  },
  massbombard: {
    name: 'Mass Bombard', icon: '🛩️', short: x => `Flying全員 対地+${x}`,
    desc: x => `攻撃フェーズ開始時、Flying を持つ味方全員が、Flying を持たない敵への近接・遠隔攻撃で${x}の追加ダメージ。最も強いものだけ適用`,
  },
  magicblast: {
    name: 'Magic Blast', icon: '🎆', short: x => `隣にも魔法${x}`,
    desc: x => `魔法攻撃で敵を攻撃するとき、隣の敵に${x}の追加魔法ダメージ（Magic Reflect は発動しない）`,
  },
  craze: {
    name: 'Craze', icon: '🎯', short: x => `遠隔+${x}回`,
    desc: x => `遠隔攻撃を${x}回追加で行う`,
  },
  trickery: {
    name: 'Trickery', icon: '🎲', noX: true, short: () => 'カオス最大',
    desc: () => '自分のターン開始時に発動。このターン、同じ色の味方のカオス（ランダム）ダメージが最大値になる',
  },

  // ---- 防御系 ----
  shield: {
    name: 'Shield', icon: '🔰', short: x => `物理-${x}`,
    desc: x => `受ける物理ダメージ（近接・遠隔）を${x}減らす`,
  },
  thorns: {
    name: 'Thorns', icon: '🌵', short: x => `反撃${x}`,
    desc: x => `近接攻撃を受けたとき、攻撃者に${x}ダメージ（アーマーがあればアーマーから削る）`,
  },
  flying: {
    name: 'Flying', icon: '🪽', noX: true, short: () => '回避',
    desc: () => 'Flyingを持たない相手から、近接攻撃とDoublestrikeを50%、遠隔攻撃を25%の確率で回避する',
  },
  stealth: {
    name: 'Stealth', icon: '👤', noX: true, short: () => '後列で隠れる',
    desc: () => '後列（スロット2・3）にいる間、遠隔攻撃・魔法攻撃の対象にならない',
  },
  taunt: {
    name: 'Taunt', icon: '📣', noX: true, short: () => '遠隔を引き受け',
    desc: () => '敵の遠隔攻撃の優先対象になる',
  },
  perseverance: {
    name: 'Perseverance', icon: '💪', noX: true, short: () => '妨害無効',
    desc: () => 'Disease・Entangle・Silence・Demoralize・Suppress Magic・Jinx・Stall・燃焼を受けない',
  },

  counter: {
    name: 'Counter-Attack', icon: '↪️', noX: true, short: () => '50%で反撃',
    desc: () => '近接攻撃でダメージを受けたとき、50%の確率で攻撃者に自分の近接攻撃を返す',
  },
  crosscounter: {
    name: 'Cross-Counter-Attack', icon: '🔁', noX: true, short: () => '必ず反撃',
    desc: () => '近接攻撃でダメージを受けたとき、攻撃者に自分の近接攻撃を返す。1ターンに3回まで',
  },
  magiccounter: {
    name: 'Magic Counter', icon: '🪄', noX: true, short: () => '魔法に反撃',
    desc: () => '魔法攻撃でダメージを受けたとき、50%の確率で攻撃者に自分の近接攻撃を返す',
  },
  magicreflect: {
    name: 'Magic Reflect', icon: '🪞', noX: true, short: () => '魔法を反射',
    desc: () => '魔法攻撃を受けたとき、75%の確率でダメージを受けずに、同じダメージを攻撃者に跳ね返す（1ターンに5回まで）',
  },
  opportunity: {
    name: 'Opportunity', icon: '🏹', noX: true, short: () => 'Reachに射撃',
    desc: () => '敵が後列から近接攻撃（Reach）をしたとき、その敵に自分の遠隔攻撃を1回行う',
  },
  mirrorshield: {
    name: 'Mirror Shield', icon: '💠', short: x => `魔法-${x}`,
    desc: x => `受ける魔法ダメージを${x}減らす`,
  },
  sacredshield: {
    name: 'Sacred Shield', icon: '✝️', short: x => `全ダメージ-${x}`,
    desc: x => `受ける物理ダメージと魔法ダメージを${x}減らす`,
  },
  antimagic: {
    name: 'Anti-Magic Shield', icon: '🔮', short: x => `味方 魔法-${x}`,
    desc: x => `自分のターン開始時、相手ターン終了まで、味方全員が受ける魔法ダメージを${x}減らす。最も強いものだけ適用`,
  },
  fog: {
    name: 'Fog', icon: '💨', noX: true, short: () => '次の攻撃を無効',
    desc: () => 'ダメージを受けると Fog 状態になる。Fog 状態のときは次の攻撃のダメージを0にして、Fog 状態が解ける',
  },
  healingshield: {
    name: 'Healing Shield', icon: '🩹', short: x => `回復で盾${x}`,
    desc: x => `味方を回復したとき、相手ターン終了まで盾（Shield・Mirror Shield・Sacred Shield のどれか。カードごとに決まる）${x}を得る。フラッシュの場合は、回復した味方が得る`,
  },
  dive: {
    name: 'Dive', icon: '🦅', short: x => `Flyingで攻撃+${x}`,
    desc: x => `自分のターン開始時、Flying を持っていれば、近接攻撃と遠隔攻撃が+${x}（相手ターン終了まで）`,
  },
  groupdive: {
    name: 'Group Dive', icon: '🕊️', short: x => `Flying全員 Dive${x}`,
    desc: x => `自分のターン開始時、Flying を持つ味方全員が Dive ${x} を得る`,
  },
  shieldspike: {
    name: 'Shield Spike', icon: '📍', short: x => `被弾で${x}返す`,
    desc: x => `ダメージを受けるたびに、攻撃元に${x}のダメージを返す（攻撃元も Shield Spike を持つ場合は発動しない）`,
  },
  enchantarmor: {
    name: 'Enchant Armor', icon: '⚒️', short: x => `アーマー+${x}`,
    desc: x => `アーマー装備を付けているとき、アーマーが+${x}`,
  },

  // ---- 支援系（自分のターン開始時に発動） ----
  heal: {
    name: 'Heal', icon: '💚', short: x => `回復${x}`,
    desc: x => `自分のターン開始時、傷ついた味方のうちHPが最も低い1体を${x}回復（最大HPは超えない）。フラッシュの場合は選んだ味方1体を${x}回復`,
  },
  groupheal: {
    name: 'Group Heal', icon: '💞', short: x => `全員回復${x}`,
    desc: x => `自分のターン開始時（フラッシュは使ったとき）、味方全員を${x}回復`,
  },
  inspire: {
    name: 'Inspire', icon: '🎺', short: x => `味方⚔️+${x}`,
    desc: x => `自分のターン開始時、味方全員の近接攻撃+${x}（相手ターン終了まで）。最も強いものだけ適用`,
  },
  shoot: {
    name: 'Shoot Command', icon: '🚩', short: x => `味方🏹+${x}`,
    desc: x => `自分のターン開始時、味方全員の遠隔攻撃+${x}、さらにアーマーにブロックされなくなる（相手ターン終了まで）。最も強いものだけ適用`,
  },
  cleanse: {
    name: 'Cleanse', icon: '🧼', noX: true, short: () => '1体解除',
    desc: () => '自分のターン開始時、味方1体のデバフ（状態異常）をすべて解除',
  },
  masscleanse: {
    name: 'Mass Cleanse', icon: '🫧', noX: true, short: () => '全員解除',
    desc: () => '自分のターン開始時、味方全員のデバフ（状態異常）をすべて解除',
  },

  rearguard: {
    name: 'Rearguard', icon: '🎖️', short: x => `後列でスキル+${x}`,
    desc: x => `自分のターン開始時に後列（スロット2・3）にいると、自分のスキルの数値が+${x}（相手ターン終了まで）`,
  },
  equilibrium: {
    name: 'Equilibrium', icon: '⚖️', short: x => `同色コスト${x}`,
    desc: x => `このモンスターが場にいる間、手札にある同じ色のモンスターのコストが${x}になる（もともと${x}以下のカードは変わらない）`,
  },

  // ---- 妨害系 ----
  disease: {
    name: 'Disease', icon: '☣️', short: x => `病${x}`,
    desc: x => `近接・遠隔・カオスのダメージを与えた敵をDisease状態にする（スタック+${x}）。Disease状態のモンスターは、自分のターン終了時にスタック数ぶんの魔法ダメージを受ける。Inspire・Shoot Command・Demoralize・Suppress Magicを使えず、回復はまずスタックを減らすのに使われる`,
  },
  outbreak: {
    name: 'Outbreak', icon: '🧫', noX: true, short: () => '病で追加ダメージ',
    desc: () => 'Disease状態の敵を攻撃すると、スタック数ぶんの追加魔法ダメージ（スタックは減らない）',
  },
  entangle: {
    name: 'Entangle', icon: '🕸️', noX: true, short: () => '50%で拘束',
    desc: () => '自分のターン開始時、50%の確率で正面の敵（いなければ前列の敵）を拘束する。拘束された敵は次の自分のターンが終わるまで攻撃もスキルも使えず、Flyingも失う',
  },
  silence: {
    name: 'Silence', icon: '🔇', short: x => `沈黙${x}T`,
    desc: x => `場に出たとき、敵全員を${x}ターンのあいだSilence状態にする。Silence状態のモンスターは魔法攻撃とHealを使えない`,
  },
  demoralize: {
    name: 'Demoralize', icon: '😨', short: x => `敵⚔️-${x}`,
    desc: x => `自分のターン開始時、敵全員の近接攻撃と遠隔攻撃-${x}（次の自分のターンまで）。最も強いものだけ適用`,
  },
  suppress: {
    name: 'Suppress Magic', icon: '🚫', short: x => `敵🔮-${x}`,
    desc: x => `自分のターン開始時、敵全員の魔法攻撃-${x}（次の自分のターンまで）。最も強いものだけ適用`,
  },

  toxicfog: {
    name: 'Toxic Fog', icon: '☁️', short: x => `敵全員 病${x}`,
    desc: x => `自分のターン開始時、敵全員に Disease ${x} を与える`,
  },
  poisonhalo: {
    name: 'Poison Halo', icon: '⭕', short: x => `病⇄起爆 ${x}`,
    desc: x => `自分のターン開始時、Disease を持つ味方は Outbreak を得て、Outbreak を持つ味方は Disease ${x} を得る（次の自分のターンまで）`,
  },
  outbreakhalo: {
    name: 'Outbreak Halo', icon: '🎇', short: x => `終了時 病を${x}起爆`,
    desc: x => `自分のターン終了時、Disease 状態の敵全員に${x}の魔法ダメージ（スタックは減らない）`,
  },
  fear: {
    name: 'Fear', icon: '😱', noX: true, short: () => '前後を入れ替え',
    desc: () => '場に出たとき、敵の前列（スロット1）のモンスターを、敵の後列のランダムな1体と入れ替える。Inspire を受けている敵には効かない',
  },

  // ---- フラッシュカード用 ----
  smite: {
    name: 'Smite', icon: '🔨', short: x => `${x}ダメージ`,
    desc: x => `敵1体に${x}ダメージ（物理。アーマーがあればアーマーを削る）`,
  },
  lightning: {
    name: 'Lightning', icon: '🌩️', short: x => `魔法${x}`,
    desc: x => `敵1体に${x}の魔法ダメージ（アーマー無視。Magic Reflect は発動しない）`,
  },
  groupdisease: {
    name: 'Group Disease', icon: '🦠', short: x => `敵全員 病${x}`,
    desc: x => `敵全員をDisease状態にする（スタック+${x}）`,
  },
  reinforcement: {
    name: 'Reinforcement', icon: '💎', short: x => `💎+${x}`,
    desc: x => `クリスタル+${x}`,
  },
  unsummon: {
    name: 'Unsummon', icon: '↩️', noX: true, short: () => '手札に戻す',
    desc: () => '敵のモンスター1体を持ち主の山札に戻す。装備も持ち主の山札に戻る（ダメージや状態はリセットされる）',
  },
  corrosion: {
    name: 'Corrosion', icon: '🧪', noX: true, short: () => '装備破壊',
    desc: () => '敵の装備を1つ破壊する',
  },
  masscorrosion: {
    name: 'Mass Corrosion', icon: '⚗️', noX: true, short: () => '装備すべて破壊',
    desc: () => '敵の装備をすべて破壊する',
  },
  terminate: {
    name: 'Terminate', icon: '✂️', noX: true, short: () => '1体を破壊',
    desc: () => '敵のモンスター1体と、その装備を破壊する',
  },
  retreat: {
    name: 'Retreat', icon: '⤵️', noX: true, short: () => '山札に戻す',
    desc: () => '自分の場のモンスター1体を山札に戻す（装備も山札に戻る。ダメージや状態はリセットされる）',
  },
  phantom: {
    name: 'Phantom', icon: '👥', noX: true, short: () => '分身で攻撃',
    desc: () => '味方1体を選ぶ。攻撃フェーズの最初に、その味方の分身が一番後ろの空きスロットに現れる（同じHP・攻撃力・装備・スキル）。分身は攻撃フェーズの終わりに消える。自分の場が満員のときは使えない',
  },
  lingeringfog: {
    name: 'Lingering Fog', icon: '💨', noX: true, short: () => '味方をFogに',
    desc: () => '味方1体を Fog 状態にする（次に受ける攻撃のダメージが0になる）',
  },
  // ---- 追加スキル（赤：近接） ----
  fury: {
    name: 'Fury', icon: '💢', short: x => `傷で近接+${x}まで`,
    desc: x => `失ったHPぶん、近接攻撃が上がる（最大+${x}）`,
  },
  sunder: {
    name: 'Sunder', icon: '🪓', noX: true, short: () => 'アーマー無視',
    desc: () => '近接攻撃がアーマーを無視して、HPに届く',
  },
  grudge: {
    name: 'Grudge', icon: '😤', short: x => `被弾で近接+${x}`,
    desc: x => `ダメージを受けるたび、近接攻撃が永続で+${x}（Keen Eye・Bloom・Leech と合わせて、1体につき合計+${CONFIG.GROW_CAP}まで）`,
  },
  followthrough: {
    name: 'Follow Through', icon: '🔂', noX: true, short: () => '空振りで再攻撃',
    desc: () => '近接攻撃で相手のHPを減らせなかったとき（回避・アーマー・盾など）、もう1回近接攻撃を行う。1ターンに1回',
  },
  vanguard: {
    name: 'Vanguard', icon: '🚩', short: x => `前列でスキル+${x}`,
    desc: x => `自分のターン開始時に前列（スロット1）にいると、自分のスキルの数値が+${x}（相手ターン終了まで）`,
  },
  trample: {
    name: 'Trample', icon: '🐾', noX: true, short: () => '余りを周りへ',
    desc: () => '近接・遠隔攻撃で敵を倒したとき、余ったダメージを、ほかの敵に分けて与える',
  },
  // ---- 追加スキル（青：魔法） ----
  recast: {
    name: 'Recast', icon: '🔁', short: x => `魔法+${x}回`,
    desc: x => `魔法攻撃を${x}回追加で行う`,
  },
  echo: {
    name: 'Echo', icon: '🔊', noX: true, short: () => '魔法が跳ねる',
    desc: () => `魔法攻撃でダメージを与えたとき、半分（切り上げ）のダメージがランダムな敵1体に跳ねる。ダメージが1になるまで、最大${CONFIG.ECHO_MAX}回くり返す`,
  },
  spellpierce: {
    name: 'Spellpierce', icon: '🔱', noX: true, short: () => '反射・鏡盾を無視',
    desc: () => '魔法攻撃が、相手の Magic Reflect と Mirror Shield を無視する',
  },
  exploit: {
    name: 'Exploit', icon: '🧿', short: x => `状態ごとに魔法+${x}`,
    desc: x => `魔法攻撃のとき、相手の状態異常1種類につき、ダメージ+${x}`,
  },
  staticguard: {
    name: 'Static Guard', icon: '🌩️', short: x => `1回防いで${x}返す`,
    desc: x => `相手のターン中、最初に受ける攻撃を1回だけ防ぎ、攻撃者に${x}の魔法ダメージを与える（See-through には効かない）`,
  },
  stall: {
    name: 'Stall', icon: '⏳', short: x => `${x}ターン攻撃不可`,
    desc: x => `敵1体が、${x}ターンのあいだ攻撃できない`,
  },
  // ---- 追加スキル（緑：回復） ----
  bloom: {
    name: 'Bloom', icon: '🌱', short: x => `回復で成長+${x}`,
    desc: x => `回復されるたび、すべての攻撃力と最大HPが永続で+${x}（Grudge・Keen Eye・Leech と合わせて、1体につき合計+${CONFIG.GROW_CAP}まで）`,
  },
  regenerate: {
    name: 'Regenerate', icon: '♻️', short: x => `毎ターン自分を${x}回復`,
    desc: x => `自分のターン開始時、自分を${x}回復`,
  },
  mendingaura: {
    name: 'Mending Aura', icon: '🌼', short: x => `味方の回復+${x}`,
    desc: x => `味方の Heal・Group Heal の回復量が+${x}（いちばん強いものだけ）。回復した味方の Entangle・Silence・Demoralize・Suppress Magic・Jinx・Stall も解ける`,
  },
  laststand: {
    name: 'Last Stand', icon: '🕯️', noX: true, short: () => '1回だけ耐える',
    desc: () => '最初に倒されるとき、倒されずにHPが全回復する。1試合に1回だけ（Terminate には効かない）',
  },
  partinggift: {
    name: 'Parting Gift', icon: '💐', short: x => `倒されると味方を${x}回復`,
    desc: x => `倒されたとき、傷ついた味方全員を${x}回復`,
  },
  leech: {
    name: 'Leech', icon: '🩸', short: x => `命中でHP+${x}`,
    desc: x => `攻撃でダメージを与えるたび、HPと最大HPが永続で+${x}（Grudge・Keen Eye・Bloom と合わせて、1体につき合計+${CONFIG.GROW_CAP}まで）`,
  },
  // ---- 追加スキル（黄：遠隔） ----
  keeneye: {
    name: 'Keen Eye', icon: '🦉', short: x => `命中で遠隔+${x}`,
    desc: x => `遠隔攻撃でダメージを与えるたび、遠隔攻撃が永続で+${x}（Grudge・Bloom・Leech と合わせて、1体につき合計+${CONFIG.GROW_CAP}まで）`,
  },
  arrowrain: {
    name: 'Arrow Rain', icon: '🌧️', noX: true, short: () => '後列全員に遠隔',
    desc: () => '遠隔攻撃が、後列の敵全員に当たる（Taunt と Stealth を無視）。後列に敵がいなければ、ふつうに狙う',
  },
  pointblank: {
    name: 'Point Blank', icon: '🔫', noX: true, short: () => '前列から遠隔',
    desc: () => '前列（スロット1）からでも遠隔攻撃ができる。そのときは相手の前列を狙い、アーマーにブロックされない',
  },
  steadyaim: {
    name: 'Steady Aim', icon: '🧘', short: x => `無傷なら遠隔+${x}`,
    desc: x => `自分のターン開始時、前の相手ターンにダメージを受けていなければ、遠隔攻撃+${x}（相手ターン終了まで）`,
  },
  deflect: {
    name: 'Deflect', icon: '🏓', noX: true, short: () => '遠隔を跳ね返す',
    desc: () => `遠隔攻撃を受けたとき、${Math.round(CONFIG.DEFLECT_CHANCE * 100)}%の確率でダメージを受けずに、同じダメージを攻撃者に跳ね返す`,
  },
  ambush: {
    name: 'Ambush', icon: '🥷', short: x => `後列の敵に+${x}`,
    desc: x => `後列（スロット2・3）の敵を攻撃するとき、ダメージ+${x}`,
  },
  // ---- 追加スキル（紫：カオス） ----
  scatter: {
    name: 'Scatter', icon: '🎰', short: x => `カオス+${x}回`,
    desc: x => `カオス攻撃を${x}回追加で行う`,
  },
  cull: {
    name: 'Cull', icon: '🎯', noX: true, short: () => '弱った敵を狙う',
    desc: () => 'カオス攻撃が、ランダムではなく、HPの最も低い敵を狙う',
  },
  jinx: {
    name: 'Jinx', icon: '🐈‍⬛', short: x => `敵のカオス-${x}`,
    desc: x => `自分のターン開始時、敵全員のカオス攻撃-${x}（次の自分のターンまで）。最も強いものだけ適用`,
  },
  luckyshot: {
    name: 'Lucky Shot', icon: '🍀', short: x => `最大値で追加${x}`,
    desc: x => `カオス攻撃が最大値で当たったとき、ランダムな敵1体に${x}の固定ダメージ`,
  },
  plagueburst: {
    name: 'Plague Burst', icon: '💥', short: x => `病×${x}のダメージ`,
    desc: x => `Disease 状態の敵全員に、スタック数×${x}の魔法ダメージ（スタックは減らない）`,
  },
  finalbow: {
    name: 'Final Bow', icon: '🎭', short: x => `倒されると全体に${x}`,
    desc: x => `倒されたとき、敵全員に${x}の固定ダメージ`,
  },
  // ---- 追加スキル（色を問わない） ----
  scorch: {
    name: 'Scorch', icon: '🔥', short: x => `燃焼+${x}`,
    desc: x => `近接・遠隔攻撃でダメージを与えた敵を燃焼にする（スタック+${x}）。燃焼のモンスターは、どちらのターンの終わりにもスタック数ぶんの魔法ダメージを受け、スタックが1減る`,
  },
  harvest: {
    name: 'Harvest', icon: '🌾', short: x => `撃破でクリスタル+${x}`,
    desc: x => `このモンスターが攻撃で敵を倒すたび、クリスタル+${x}`,
  },
  // ---- 追加スキル（コストの増減） ----
  featherweight: {
    name: 'Featherweight', icon: '🪶', short: x => `同色の装備-${x}`,
    desc: x => `このモンスターに同じ色の装備を付けるとき、その装備のコスト-${x}（1より安くはならない）`,
  },
  quartermaster: {
    name: 'Quartermaster', icon: '📦', short: x => `手札の装備-${x}`,
    desc: x => `このモンスターが場にいる間、手札の装備カードのコスト-${x}（1より安くはならない。いちばん強いものだけ適用）`,
  },
  crosscurrent: {
    name: 'Crosscurrent', icon: '🌊', short: x => `敵のモンスター最低${x}`,
    desc: x => `このモンスターが場にいる間、相手の手札のモンスターのコストが、${x}未満なら${x}になる（いちばん強いものだけ適用）`,
  },
  illomen: {
    name: 'Ill Omen', icon: '🐦‍⬛', short: x => `敵のドロー+${x}`,
    desc: x => `このモンスターが場にいる間、相手がターン開始時に引くカードのコスト+${x}（そのカードについてまわる。いちばん強いものだけ適用）`,
  },
  attunement: {
    name: 'Attunement', icon: '🎶', short: x => `回復でコスト-${x}`,
    desc: x => `自分のターン終了時、そのターンに味方が回復されていれば、このカードのコスト-${x}（手札・山札・場のどこにいても下がり、1より安くはならない）`,
  },
  evacuate: {
    name: 'Evacuate', icon: '🪂', short: x => `Flyingを山札へ-${x}`,
    desc: x => `ほかの Flying 持ちの味方が倒されるか、場で生贄にされたとき、そのモンスターを山札に戻し、コスト-${x}（装備は失う。1より安くはならない）`,
  },
  fallback: {
    name: 'Fall Back', icon: '🏳️', short: x => `生贄で山札へ+${x}`,
    desc: x => `場で生贄にされたとき、山札に戻る。次に出すときのコスト+${x}（装備は失う）`,
  },
  regroup: {
    name: 'Regroup', icon: '🔙', short: x => `山札に戻し-${x}`,
    desc: x => `自分の場のモンスター1体を山札に戻し、そのコスト-${x}（装備も山札に戻る。ダメージや状態はリセット。1より安くはならない）`,
  },
  tax: {
    name: 'Tax', icon: '🧾', short: x => `敵のアイテム+${x}`,
    desc: x => `相手の手札にある装備・フラッシュのコスト+${x}（そのカードについてまわる）`,
  },
  // ---- 追加スキル（召喚） ----
  vanguardcall: {
    name: 'Vanguard Call', icon: '🗿', short: x => `前列にゴーレム(HP${x})`,
    desc: x => `場に出たとき、自分の前列に「小さなゴーレム」（近接1・HP${x}）を呼ぶ。前列にいたモンスターは後ろへ下がる。場が満員なら呼べない`,
  },
  sortie: {
    name: 'Sortie', icon: '🪨', short: x => `毎ターン突撃ゴーレム(${x})`,
    desc: x => `自分のターン開始時、場に空きがあれば、いちばん後ろの空きに「突撃ゴーレム」（近接${x}・HP1・Reach・Anti-Air 1）を呼ぶ。後列から近接攻撃をして、そのターンの終わりに消える`,
  },
  swarm: {
    name: 'Swarm', icon: '🧱', short: x => `空きを壁(HP${x})で埋める`,
    desc: x => `自分の場の空きを、すべて「身代わりゴーレム」（近接1・HP${x}）で埋める。次の自分のターン開始時に消える`,
  },
  unwelcomegift: {
    name: 'Unwelcome Gift', icon: '⚓', short: x => `敵の前列に重荷(HP${x})`,
    desc: x => `相手の前列に「重荷ゴーレム」（HP${x}）を置く。重荷ゴーレムは攻撃できず、倒されると持ち主がクリスタルを1失う。相手の場が満員なら使えない`,
  },
  // ---- 追加スキル（山札に特別カードを足す） ----
  backfire: {
    name: 'Backfire', icon: '🗑️', short: x => `敵の山札にがらくた${x}`,
    desc: x => `場に出たとき、相手の山札に「がらくた」を${x}枚、自分の山札にも1枚入れる。がらくたは使えないカードで、生贄にはできる`,
  },
  spellforge: {
    name: 'Spell Forge', icon: '☄️', short: x => `毎ターン火の玉(${x})`,
    desc: x => `自分のターン終了時、自分の山札に「火の玉」（コスト1のフラッシュ：敵1体に${x}ダメージ）を1枚入れる。いちばん強いものだけ適用`,
  },
  apothecary: {
    name: 'Apothecary', icon: '🧴', short: x => `毎ターン薬びん(${x})`,
    desc: x => `自分のターン終了時、自分の山札に「薬びん」（コスト0のフラッシュ：味方1体を${x}回復）を1枚入れる。いちばん強いものだけ適用`,
  },
  fortune: {
    name: 'Fortune', icon: '🎴', short: x => `毎ターン吉か凶`,
    desc: x => `自分のターン終了時、半々の確率で、自分の山札に「吉札」（コスト0のフラッシュ：クリスタル+${x}）か、相手の山札に「凶札」（使えないカード）を1枚入れる。いちばん強いものだけ適用`,
  },
  tinker: {
    name: 'Tinker', icon: '🧰', short: x => `毎ターン装備(-${x})`,
    desc: x => `自分のターン終了時、自分の山札に、ランダムなコモンの装備（無色か、このモンスターと同じ色）を1枚入れる。その装備はコスト-${x}（1より安くはならない）。いちばん強いものだけ適用`,
  },
  opportunist: {
    name: 'Opportunist', icon: '🦊', short: x => `敵が足すたび+${x}`,
    desc: x => `相手が山札にカードを足すたび（どちらの山札でも）、すべての攻撃力と最大HPが永続で+${x}（Grudge・Keen Eye・Bloom・Leech と合わせて、1体につき合計+${CONFIG.GROW_CAP}まで）`,
  },
  purge: {
    name: 'Purge', icon: '🧹', noX: true, short: () => '足されたカードを一掃',
    desc: () => '両者の手札と山札から、試合中に足されたカードをすべて取り除く',
  },
};

// 状態異常・強化の表示名（ツールチップやログで使う）
const STATUS_INFO = {
  disease:    { name: 'Disease',        icon: '☣️', text: n => `スタック${n}。自分のターン終了時に${n}の魔法ダメージ。一部の支援スキルを使えず、回復はまずスタックを減らす` },
  entangle:   { name: 'Entangle',       icon: '🕸️', text: () => '次の自分のターンが終わるまで、攻撃もスキルも使えない' },
  silence:    { name: 'Silence',        icon: '🔇', text: n => `残り${n}ターン。魔法攻撃とHealを使えない` },
  demoralize: { name: 'Demoralize',     icon: '😨', text: n => `近接攻撃・遠隔攻撃-${n}（相手の次のターン開始まで）` },
  suppress:   { name: 'Suppress Magic', icon: '🚫', text: n => `魔法攻撃-${n}（相手の次のターン開始まで）` },
  jinx:       { name: 'Jinx',           icon: '🐈‍⬛', text: n => `カオス攻撃-${n}（相手の次のターン開始まで）` },
  stall:      { name: 'Stall',          icon: '⏳', text: n => `残り${n}ターン。攻撃できない` },
  burn:       { name: '燃焼',           icon: '🔥', text: n => `スタック${n}。どちらのターンの終わりにも${n}の魔法ダメージを受け、スタックが1減る` },
  inspire:    { name: 'Inspire',        icon: '🎺', text: n => `近接攻撃+${n}（次の自分のターン開始まで）` },
  antimagic:  { name: 'Anti-Magic Shield', icon: '🔮', text: n => `受ける魔法ダメージ-${n}（次の自分のターン開始まで）` },
  massbombard: { name: 'Mass Bombard',  icon: '🛩️', text: n => `Flying を持たない敵への近接・遠隔攻撃+${n}（このターン）` },
  trickery:   { name: 'Trickery',       icon: '🎲', text: () => 'カオス（ランダム）ダメージが最大値になる（このターン）' },
  phantom:    { name: 'Phantom',        icon: '👥', text: () => '攻撃フェーズの最初に、この味方の分身が現れる' },
  fog:        { name: 'Fog',            icon: '💨', text: () => '次に受ける攻撃のダメージが0になる' },
  dive:       { name: 'Dive',           icon: '🦅', text: n => `近接攻撃・遠隔攻撃+${n}（相手ターン終了まで）` },
  rearguard:  { name: 'Rearguard',      icon: '🎖️', text: n => `自分のスキルの数値+${n}（次の自分のターン開始まで）` },
  aim:        { name: 'Steady Aim',     icon: '🧘', text: n => `遠隔攻撃+${n}（次の自分のターン開始まで）` },
  shoot:      { name: 'Shoot Command',  icon: '🚩', text: n => `遠隔攻撃+${n}、アーマーにブロックされない（次の自分のターン開始まで）` },
};

// 「Thorns 2」「Flying」のような表示名
function skillLabel(k) {
  const s = SKILLS[k.id];
  return s.noX ? s.name : `${s.name} ${k.x}`;
}

// ============================================================
// 辞典用の情報（スキル辞典は、SKILLS とこの表から自動で作る）
// スキルを足したら、ここにも1行足す（足し忘れるとテストが失敗する）。
//   ja: 日本語名 / yomi: 読み（50音順と検索に使う） / cat: 分類（atk 攻撃・def 防御・sup 支援・deb 妨害・etc その他）
//   when: 発動タイミング / rel: 関係するスキルのid / demo: 図解の種類（dict.js の DICT_DEMOS）
// ============================================================
const SKILL_META = {
  piercing: { ja: '貫通', yomi: 'かんつう', cat: 'atk', when: '攻撃時（アーマーを壊したとき）', rel: ['enchantarmor', 'shield'], demo: 'hit_front' },
  doublestrike: { ja: '二段撃ち', yomi: 'にだんうち', cat: 'atk', when: '攻撃時（近接攻撃が当たったとき）', rel: ['flying', 'overlord', 'seethrough'], demo: 'double' },
  batter: { ja: '連打', yomi: 'れんだ', cat: 'atk', when: '攻撃フェーズ（自分の近接攻撃のあと）', rel: ['craze', 'thorns', 'counter'], demo: 'many' },
  reach: { ja: '長柄', yomi: 'ながえ', cat: 'atk', when: '常時', rel: ['opportunity'], demo: 'hit_back' },
  antiair: { ja: '対空', yomi: 'たいくう', cat: 'atk', when: '攻撃時', rel: ['flying', 'bombard', 'overlord'], demo: 'hit_front' },
  swallow: { ja: '捕食', yomi: 'ほしょく', cat: 'atk', when: '敵を倒したとき', rel: [], demo: 'buff1' },
  seethrough: { ja: '看破', yomi: 'かんぱ', cat: 'atk', when: '攻撃時', rel: ['counter', 'crosscounter', 'flying', 'fog', 'opportunity', 'shield', 'thorns'], demo: 'hit_front' },
  overlord: { ja: '覇王', yomi: 'はおう', cat: 'atk', when: '常時', rel: ['antiair', 'disease', 'doublestrike', 'fear', 'menace', 'thorns', 'toxicfog'], demo: 'buff1' },
  menace: { ja: '威圧', yomi: 'いあつ', cat: 'atk', when: '自分のターン中、敵の位置が変わったとき', rel: ['fear', 'overlord'], demo: 'swap' },
  bombard: { ja: '爆撃', yomi: 'ばくげき', cat: 'atk', when: '攻撃時', rel: ['flying', 'massbombard', 'antiair'], demo: 'hit_front' },
  massbombard: { ja: '一斉爆撃', yomi: 'いっせいばくげき', cat: 'sup', when: '攻撃フェーズ開始時', rel: ['bombard', 'flying'], demo: 'buffall' },
  magicblast: { ja: '魔力爆発', yomi: 'まりょくばくはつ', cat: 'atk', when: '攻撃時（魔法攻撃）', rel: ['magicreflect', 'mirrorshield'], demo: 'splash' },
  craze: { ja: '連射', yomi: 'れんしゃ', cat: 'atk', when: '攻撃フェーズ（自分の遠隔攻撃のあと）', rel: ['batter', 'shoot'], demo: 'shots' },
  trickery: { ja: '奇術', yomi: 'きじゅつ', cat: 'sup', when: '自分のターン開始時', rel: ['disease'], demo: 'buffall' },
  shield: { ja: '盾', yomi: 'たて', cat: 'def', when: 'ダメージを受けたとき', rel: ['sacredshield', 'mirrorshield', 'healingshield', 'seethrough'], demo: 'shield' },
  thorns: { ja: 'いばら', yomi: 'いばら', cat: 'def', when: '近接攻撃を受けたとき', rel: ['shieldspike', 'counter', 'seethrough', 'overlord'], demo: 'reflect' },
  flying: { ja: '飛行', yomi: 'ひこう', cat: 'def', when: '近接・遠隔攻撃を受けるとき', rel: ['antiair', 'dive', 'groupdive', 'bombard', 'entangle', 'seethrough'], demo: 'dodge' },
  stealth: { ja: '潜伏', yomi: 'せんぷく', cat: 'def', when: '常時（後列にいる間）', rel: ['taunt'], demo: 'taunt' },
  taunt: { ja: '挑発', yomi: 'ちょうはつ', cat: 'def', when: '敵が遠隔攻撃の対象を選ぶとき', rel: ['stealth'], demo: 'taunt' },
  perseverance: { ja: '不屈', yomi: 'ふくつ', cat: 'def', when: '常時', rel: ['disease', 'entangle', 'silence', 'demoralize', 'suppress'], demo: 'shield' },
  counter: { ja: '反撃', yomi: 'はんげき', cat: 'def', when: '近接攻撃でダメージを受けたとき', rel: ['crosscounter', 'magiccounter', 'thorns', 'seethrough'], demo: 'reflect' },
  crosscounter: { ja: '交差反撃', yomi: 'こうさはんげき', cat: 'def', when: '近接攻撃でダメージを受けたとき', rel: ['counter', 'seethrough'], demo: 'reflect' },
  magiccounter: { ja: '魔法反撃', yomi: 'まほうはんげき', cat: 'def', when: '魔法攻撃を受けたとき', rel: ['counter', 'magicreflect'], demo: 'reflect' },
  magicreflect: { ja: '魔法反射', yomi: 'まほうはんしゃ', cat: 'def', when: '魔法攻撃でダメージを受けたとき', rel: ['magiccounter', 'magicblast', 'mirrorshield'], demo: 'reflect' },
  opportunity: { ja: '好機', yomi: 'こうき', cat: 'def', when: '敵が後列から近接攻撃をしたとき', rel: ['reach', 'seethrough'], demo: 'reflect' },
  mirrorshield: { ja: '鏡の盾', yomi: 'かがみのたて', cat: 'def', when: '魔法ダメージを受けたとき', rel: ['shield', 'sacredshield', 'healingshield', 'antimagic'], demo: 'shield' },
  sacredshield: { ja: '聖なる盾', yomi: 'せいなるたて', cat: 'def', when: 'ダメージを受けたとき', rel: ['shield', 'mirrorshield', 'healingshield'], demo: 'shield' },
  antimagic: { ja: '対魔法障壁', yomi: 'たいまほうしょうへき', cat: 'sup', when: '自分のターン開始時', rel: ['mirrorshield', 'sacredshield'], demo: 'buffall' },
  fog: { ja: '霧', yomi: 'きり', cat: 'def', when: 'ダメージを受けたとき', rel: ['lingeringfog', 'seethrough'], demo: 'shield' },
  healingshield: { ja: '癒しの盾', yomi: 'いやしのたて', cat: 'sup', when: '味方を回復したとき', rel: ['heal', 'groupheal', 'shield', 'mirrorshield', 'sacredshield'], demo: 'heal1' },
  dive: { ja: '急降下', yomi: 'きゅうこうか', cat: 'atk', when: '自分のターン開始時', rel: ['flying', 'groupdive'], demo: 'buff1' },
  groupdive: { ja: '編隊急降下', yomi: 'へんたいきゅうこうか', cat: 'sup', when: '自分のターン開始時', rel: ['dive', 'flying'], demo: 'buffall' },
  shieldspike: { ja: '棘の盾', yomi: 'とげのたて', cat: 'def', when: 'ダメージを受けるたび', rel: ['thorns'], demo: 'reflect' },
  enchantarmor: { ja: '鎧強化', yomi: 'よろいきょうか', cat: 'def', when: 'アーマー装備を付けたとき', rel: ['piercing', 'corrosion'], demo: 'shield' },
  heal: { ja: '回復', yomi: 'かいふく', cat: 'sup', when: '自分のターン開始時（フラッシュは使ったとき）', rel: ['groupheal', 'healingshield', 'disease', 'silence'], demo: 'heal1' },
  groupheal: { ja: '全体回復', yomi: 'ぜんたいかいふく', cat: 'sup', when: '自分のターン開始時（フラッシュは使ったとき）', rel: ['heal', 'healingshield', 'disease', 'silence'], demo: 'healall' },
  inspire: { ja: '鼓舞', yomi: 'こぶ', cat: 'sup', when: '自分のターン開始時', rel: ['disease', 'fear', 'demoralize'], demo: 'buffall' },
  shoot: { ja: '射撃号令', yomi: 'しゃげきごうれい', cat: 'sup', when: '自分のターン開始時', rel: ['craze', 'disease'], demo: 'buffall' },
  cleanse: { ja: '浄化', yomi: 'じょうか', cat: 'sup', when: '自分のターン開始時', rel: ['masscleanse', 'disease', 'entangle', 'silence'], demo: 'heal1' },
  masscleanse: { ja: '全体浄化', yomi: 'ぜんたいじょうか', cat: 'sup', when: '自分のターン開始時', rel: ['cleanse', 'disease', 'entangle', 'silence'], demo: 'healall' },
  rearguard: { ja: '後衛', yomi: 'こうえい', cat: 'sup', when: '自分のターン開始時（後列にいるとき）', rel: [], demo: 'buff1' },
  equilibrium: { ja: '均衡', yomi: 'きんこう', cat: 'etc', when: '常時（場にいる間）', rel: [], demo: 'none' },
  disease: { ja: '病', yomi: 'やまい', cat: 'deb', when: '物理ダメージを与えたとき', rel: ['outbreak', 'heal', 'perseverance', 'toxicfog', 'groupdisease', 'poisonhalo', 'outbreakhalo', 'cleanse', 'overlord'], demo: 'debuff1' },
  outbreak: { ja: '発症', yomi: 'はっしょう', cat: 'atk', when: 'Disease 状態の敵を攻撃したとき', rel: ['disease', 'outbreakhalo', 'poisonhalo'], demo: 'hit_front' },
  entangle: { ja: '拘束', yomi: 'こうそく', cat: 'deb', when: '自分のターン開始時', rel: ['flying', 'perseverance', 'cleanse'], demo: 'debuff1' },
  silence: { ja: '沈黙', yomi: 'ちんもく', cat: 'deb', when: '場に出たとき', rel: ['heal', 'groupheal', 'perseverance', 'cleanse'], demo: 'debuffall' },
  demoralize: { ja: '士気低下', yomi: 'しきていか', cat: 'deb', when: '自分のターン開始時', rel: ['inspire', 'perseverance', 'disease'], demo: 'debuffall' },
  suppress: { ja: '魔法抑制', yomi: 'まほうよくせい', cat: 'deb', when: '自分のターン開始時', rel: ['perseverance', 'disease'], demo: 'debuffall' },
  toxicfog: { ja: '毒霧', yomi: 'どくぎり', cat: 'deb', when: '自分のターン開始時', rel: ['disease', 'overlord', 'groupdisease'], demo: 'debuffall' },
  poisonhalo: { ja: '毒の光輪', yomi: 'どくのこうりん', cat: 'sup', when: '自分のターン開始時', rel: ['disease', 'outbreak'], demo: 'buffall' },
  outbreakhalo: { ja: '発症の光輪', yomi: 'はっしょうのこうりん', cat: 'atk', when: '自分のターン終了時', rel: ['disease', 'outbreak'], demo: 'hitall' },
  fear: { ja: '恐怖', yomi: 'きょうふ', cat: 'deb', when: '場に出たとき', rel: ['menace', 'inspire', 'overlord'], demo: 'swap' },
  smite: { ja: '打撃', yomi: 'だげき', cat: 'atk', when: '使ったとき（フラッシュ）', rel: ['lightning', 'shield'], demo: 'hit_flash' },
  lightning: { ja: '稲妻', yomi: 'いなずま', cat: 'atk', when: '使ったとき（フラッシュ）', rel: ['smite', 'mirrorshield'], demo: 'hit_flash' },
  groupdisease: { ja: '疫病', yomi: 'えきびょう', cat: 'deb', when: '使ったとき（フラッシュ）', rel: ['disease', 'toxicfog'], demo: 'debuffall' },
  reinforcement: { ja: '援軍', yomi: 'えんぐん', cat: 'etc', when: '使ったとき（フラッシュ）', rel: [], demo: 'none' },
  unsummon: { ja: '送還', yomi: 'そうかん', cat: 'deb', when: '使ったとき（フラッシュ）', rel: ['retreat'], demo: 'debuff1' },
  corrosion: { ja: '腐食', yomi: 'ふしょく', cat: 'deb', when: '使ったとき（フラッシュ）', rel: ['masscorrosion', 'enchantarmor'], demo: 'debuff1' },
  masscorrosion: { ja: '全体腐食', yomi: 'ぜんたいふしょく', cat: 'deb', when: '使ったとき（フラッシュ）', rel: ['corrosion'], demo: 'debuffall' },
  terminate: { ja: '抹殺', yomi: 'まっさつ', cat: 'atk', when: '使ったとき（フラッシュ）', rel: [], demo: 'hit_flash' },
  retreat: { ja: '撤退', yomi: 'てったい', cat: 'etc', when: '使ったとき（フラッシュ）', rel: ['unsummon'], demo: 'buff1' },
  phantom: { ja: '分身', yomi: 'ぶんしん', cat: 'sup', when: '攻撃フェーズ開始時（フラッシュで予約）', rel: [], demo: 'buff1' },
  lingeringfog: { ja: '残霧', yomi: 'ざんむ', cat: 'def', when: '使ったとき（フラッシュ）', rel: ['fog'], demo: 'shield' },
  fury: { ja: '憤怒', yomi: 'ふんぬ', cat: 'atk', when: '常時（HPが減っているあいだ）', rel: ['grudge', 'leech'], demo: 'hit_front' },
  sunder: { ja: '鎧割り', yomi: 'よろいわり', cat: 'atk', when: '攻撃時（近接攻撃）', rel: ['piercing', 'enchantarmor'], demo: 'hit_front' },
  grudge: { ja: '遺恨', yomi: 'いこん', cat: 'atk', when: 'ダメージを受けたとき', rel: ['fury', 'keeneye', 'bloom', 'leech'], demo: 'buff1' },
  followthrough: { ja: '追い打ち', yomi: 'おいうち', cat: 'atk', when: '攻撃時（近接攻撃でHPを減らせなかったとき）', rel: ['batter', 'flying', 'shield'], demo: 'many' },
  vanguard: { ja: '先陣', yomi: 'せんじん', cat: 'sup', when: '自分のターン開始時（前列にいるとき）', rel: ['rearguard'], demo: 'buff1' },
  trample: { ja: '踏み荒らし', yomi: 'ふみあらし', cat: 'atk', when: '攻撃時（敵を倒したとき）', rel: ['piercing', 'doublestrike'], demo: 'splash' },
  recast: { ja: '連唱', yomi: 'れんしょう', cat: 'atk', when: '攻撃時（魔法攻撃のあと）', rel: ['batter', 'craze', 'scatter', 'silence'], demo: 'many' },
  echo: { ja: 'こだま', yomi: 'こだま', cat: 'atk', when: '攻撃時（魔法攻撃が当たったとき）', rel: ['magicblast', 'magicreflect'], demo: 'splash' },
  spellpierce: { ja: '魔貫', yomi: 'まかん', cat: 'atk', when: '攻撃時（魔法攻撃）', rel: ['magicreflect', 'mirrorshield'], demo: 'facing' },
  exploit: { ja: '弱み突き', yomi: 'よわみつき', cat: 'atk', when: '攻撃時（魔法攻撃）', rel: ['disease', 'silence', 'entangle', 'scorch'], demo: 'facing' },
  staticguard: { ja: '帯電の守り', yomi: 'たいでんのまもり', cat: 'def', when: '相手のターンに、最初に攻撃されたとき', rel: ['fog', 'seethrough', 'shieldspike'], demo: 'reflect' },
  stall: { ja: '足止め', yomi: 'あしどめ', cat: 'deb', when: '使ったとき（フラッシュ）', rel: ['entangle', 'perseverance', 'cleanse'], demo: 'hit_flash' },
  bloom: { ja: '芽吹き', yomi: 'めぶき', cat: 'sup', when: '回復されたとき', rel: ['heal', 'groupheal', 'regenerate', 'grudge', 'keeneye', 'leech'], demo: 'heal1' },
  regenerate: { ja: '再生', yomi: 'さいせい', cat: 'sup', when: '自分のターン開始時', rel: ['heal', 'bloom', 'disease'], demo: 'buff1' },
  mendingaura: { ja: '癒しの輪', yomi: 'いやしのわ', cat: 'sup', when: '味方が Heal・Group Heal を使ったとき', rel: ['heal', 'groupheal', 'cleanse'], demo: 'healall' },
  laststand: { ja: '踏みとどまり', yomi: 'ふみとどまり', cat: 'def', when: '倒されるとき（1試合に1回）', rel: ['terminate', 'fog'], demo: 'shield' },
  partinggift: { ja: '置きみやげ', yomi: 'おきみやげ', cat: 'sup', when: '倒されたとき', rel: ['groupheal', 'finalbow', 'terminate'], demo: 'healall' },
  leech: { ja: '吸命', yomi: 'きゅうめい', cat: 'atk', when: '攻撃時（ダメージを与えたとき）', rel: ['swallow', 'grudge', 'keeneye', 'bloom'], demo: 'hit_front' },
  keeneye: { ja: '慧眼', yomi: 'けいがん', cat: 'atk', when: '攻撃時（遠隔攻撃でダメージを与えたとき）', rel: ['craze', 'grudge', 'bloom', 'leech'], demo: 'diag' },
  arrowrain: { ja: '矢の雨', yomi: 'やのあめ', cat: 'atk', when: '攻撃時（遠隔攻撃）', rel: ['taunt', 'stealth', 'craze'], demo: 'hitall' },
  pointblank: { ja: '零距離射撃', yomi: 'ぜろきょりしゃげき', cat: 'atk', when: '常時（前列にいるとき）', rel: ['reach', 'shoot'], demo: 'hit_front' },
  steadyaim: { ja: '静かな狙い', yomi: 'しずかなねらい', cat: 'atk', when: '自分のターン開始時', rel: ['shoot', 'stealth'], demo: 'buff1' },
  deflect: { ja: '矢払い', yomi: 'やばらい', cat: 'def', when: '遠隔攻撃を受けたとき', rel: ['magicreflect', 'taunt'], demo: 'reflect' },
  ambush: { ja: '伏兵', yomi: 'ふくへい', cat: 'atk', when: '攻撃時（後列の敵を攻撃するとき）', rel: ['stealth', 'arrowrain', 'cull'], demo: 'diag' },
  scatter: { ja: '乱れ撃ち', yomi: 'みだれうち', cat: 'atk', when: '攻撃時（カオス攻撃のあと）', rel: ['batter', 'craze', 'recast', 'trickery'], demo: 'random' },
  cull: { ja: '間引き', yomi: 'まびき', cat: 'atk', when: '攻撃時（カオス攻撃）', rel: ['trickery', 'stealth'], demo: 'random' },
  jinx: { ja: '凶兆', yomi: 'きょうちょう', cat: 'deb', when: '自分のターン開始時', rel: ['demoralize', 'suppress', 'trickery', 'perseverance'], demo: 'debuffall' },
  luckyshot: { ja: '幸運の一発', yomi: 'こううんのいっぱつ', cat: 'atk', when: '攻撃時（カオス攻撃が最大値で当たったとき）', rel: ['trickery', 'scatter'], demo: 'random' },
  plagueburst: { ja: '病の炸裂', yomi: 'やまいのさくれつ', cat: 'atk', when: '使ったとき（フラッシュ）', rel: ['disease', 'groupdisease', 'toxicfog', 'outbreak'], demo: 'hitall' },
  finalbow: { ja: '幕引き', yomi: 'まくひき', cat: 'atk', when: '倒されたとき', rel: ['partinggift', 'terminate'], demo: 'hitall' },
  scorch: { ja: '焼き付け', yomi: 'やきつけ', cat: 'deb', when: '攻撃時（近接・遠隔攻撃でダメージを与えたとき）', rel: ['disease', 'exploit', 'cleanse', 'perseverance'], demo: 'hit_front' },
  harvest: { ja: '刈り入れ', yomi: 'かりいれ', cat: 'sup', when: '攻撃時（敵を倒したとき）', rel: ['swallow', 'reinforcement'], demo: 'hit_front' },
  featherweight: { ja: '軽装', yomi: 'けいそう', cat: 'sup', when: '装備を付けるとき', rel: ['quartermaster', 'enchantarmor'], demo: 'buff1' },
  quartermaster: { ja: '補給係', yomi: 'ほきゅうがかり', cat: 'sup', when: '常時（場にいるあいだ）', rel: ['featherweight', 'equilibrium', 'tax'], demo: 'buffall' },
  crosscurrent: { ja: '逆潮', yomi: 'さかしお', cat: 'deb', when: '常時（場にいるあいだ）', rel: ['equilibrium', 'illomen'], demo: 'debuffall' },
  illomen: { ja: '凶報', yomi: 'きょうほう', cat: 'deb', when: '相手のターン開始時（相手が引いたとき）', rel: ['crosscurrent', 'tax'], demo: 'debuffall' },
  attunement: { ja: '共鳴', yomi: 'きょうめい', cat: 'sup', when: '自分のターン終了時', rel: ['heal', 'groupheal', 'regenerate', 'equilibrium'], demo: 'heal1' },
  evacuate: { ja: '救難', yomi: 'きゅうなん', cat: 'sup', when: '味方が倒された・生贄にされたとき', rel: ['flying', 'fallback', 'regroup', 'terminate'], demo: 'buff1' },
  fallback: { ja: '退き口', yomi: 'のきぐち', cat: 'sup', when: '場で生贄にされたとき', rel: ['evacuate', 'regroup', 'retreat'], demo: 'buff1' },
  regroup: { ja: '立て直し', yomi: 'たてなおし', cat: 'sup', when: '使ったとき（フラッシュ）', rel: ['retreat', 'fallback', 'evacuate'], demo: 'buff1' },
  tax: { ja: '重税', yomi: 'じゅうぜい', cat: 'deb', when: '使ったとき（フラッシュ）', rel: ['illomen', 'quartermaster'], demo: 'debuffall' },
  vanguardcall: { ja: '先触れ', yomi: 'さきぶれ', cat: 'sup', when: '場に出たとき', rel: ['sortie', 'swarm', 'menace'], demo: 'buff1' },
  sortie: { ja: '出撃', yomi: 'しゅつげき', cat: 'atk', when: '自分のターン開始時', rel: ['vanguardcall', 'swarm', 'antiair', 'reach'], demo: 'hit_back' },
  swarm: { ja: '群れ', yomi: 'むれ', cat: 'def', when: '使ったとき（フラッシュ）', rel: ['vanguardcall', 'sortie', 'taunt'], demo: 'shield' },
  unwelcomegift: { ja: '迷惑な贈り物', yomi: 'めいわくなおくりもの', cat: 'deb', when: '使ったとき（フラッシュ）', rel: ['menace', 'fear', 'stall'], demo: 'debuff1' },
  backfire: { ja: '裏目', yomi: 'うらめ', cat: 'deb', when: '場に出たとき', rel: ['fortune', 'purge', 'opportunist'], demo: 'debuffall' },
  spellforge: { ja: '術の鍛冶', yomi: 'じゅつのかじ', cat: 'sup', when: '自分のターン終了時', rel: ['smite', 'apothecary', 'tinker', 'purge'], demo: 'buff1' },
  apothecary: { ja: '薬づくり', yomi: 'くすりづくり', cat: 'sup', when: '自分のターン終了時', rel: ['heal', 'spellforge', 'tinker', 'purge'], demo: 'buff1' },
  fortune: { ja: '占い', yomi: 'うらない', cat: 'etc', when: '自分のターン終了時', rel: ['reinforcement', 'backfire', 'purge'], demo: 'buff1' },
  tinker: { ja: '修理屋', yomi: 'しゅうりや', cat: 'sup', when: '自分のターン終了時', rel: ['quartermaster', 'featherweight', 'spellforge', 'purge'], demo: 'buff1' },
  opportunist: { ja: '便乗', yomi: 'びんじょう', cat: 'atk', when: '相手が山札にカードを足したとき', rel: ['backfire', 'spellforge', 'apothecary', 'fortune', 'tinker', 'grudge'], demo: 'buff1' },
  purge: { ja: '大掃除', yomi: 'おおそうじ', cat: 'etc', when: '使ったとき（フラッシュ）', rel: ['backfire', 'fortune', 'spellforge', 'apothecary', 'tinker'], demo: 'none' },
};
