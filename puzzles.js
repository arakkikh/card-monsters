// ============================================================
// 詰めパズルの問題データ（しくみは puzzle.js）
//   1つ足せば問題が増える。書き方：
//     id / level（beginner・middle・advanced）/ title / lesson（学べること）
//     goal: { type: 'wipe' | 'kills' | 'hold', n, turns, noLoss }
//     me・foe: { crystals, hero, field: [スロット1, スロット2, スロット3], hand: [...] }
//       カードは 'r01' か { id, lv, hp, armor, item, status }（hp などは「今の値」を上書き）
//     fixed: 運の固定 { dodge, chaos, counter, reflect, entangle }（省略＝回避しない・最大値・発動しない）
//     start: false にすると、ターン開始時のスキル（Fear など）を発動させずに始める
//     hints: [使うべきカードのヒント, 順番のヒント]（3段目の「最初の一手」は solution から自動で出す）
//     solution: 正解の手順（tools の全探索で確かめたもの。puzzle.js の手順の書き方）
// ============================================================

const PUZZLES = [
  // ---------- 入門：基本のルールを1つずつ ----------
  {
    id: 'b01', level: 'beginner', title: '近接は前列から', lesson: '近接攻撃はスロット1（前列）からだけ。魔法はどのスロットからでも攻撃できる。',
    goal: { type: 'wipe' },
    me: { crystals: 4, field: [], hand: ['r02', 'b02'] },
    foe: { field: [{ id: 'y02', hp: 4 }] },
    hints: ['2枚とも出す必要がある。', '焔の番犬（近接）が前列に残るように出す。あとから前に出したカードは、先にいたモンスターを後ろへ押し出す。'],
    solution: [['m', 0, 0], ['m', 1, 1], ['end']],
  },
  {
    id: 'b02', level: 'beginner', title: '遠隔は後列から', lesson: '遠隔攻撃はスロット2・3（後列）からだけ。前列にいる遠隔モンスターは攻撃できない。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: ['y02'], hand: ['y03'] },
    foe: { field: [{ id: 'g01', hp: 4 }] },
    hints: ['見張りの鷹（遠隔）を出す。', '前列に出すと、砂漠の盾兵が後ろへ押し出されて、どちらも攻撃できなくなる。'],
    solution: [['m', 0, 1], ['end']],
  },
  {
    id: 'b03', level: 'beginner', title: '押し出して並べ直す', lesson: 'モンスターがいるスロットに出すと、そこから後ろが1つずつ後ろへずれる。攻撃できない並びを直せる。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: ['y03'], hand: ['y02'] },
    foe: { field: [{ id: 'g01', hp: 4 }] },
    hints: ['砂漠の盾兵（近接）を出す。', '前列にいる見張りの鷹は、遠隔なので攻撃できない。後ろへ下げたい。'],
    solution: [['m', 0, 0], ['end']],
  },
  {
    id: 'b04', level: 'beginner', title: '魔法は正面を狙う', lesson: '魔法攻撃は、同じ番号のスロット（正面）の相手を狙う。正面にいなければ前列を狙う。',
    goal: { type: 'wipe' },
    me: { crystals: 3, field: ['y02'], hand: ['b02', 'b01'] },
    foe: { field: [{ id: 'g06', hp: 4 }, { id: 'p01', hp: 1 }] },
    hints: ['魔法のモンスターを2体とも後列に出す。', '相手のスロット2はHP1。攻撃力1のしずくの精を、その正面（自分のスロット2）に置く。'],
    solution: [['m', 1, 1], ['m', 0, 2], ['end']],
  },
  {
    id: 'b05', level: 'beginner', title: '遠隔は対角を狙う', lesson: '遠隔攻撃は、対角（スロット2からは相手のスロット3、スロット3からは相手のスロット2）を先に狙う。',
    goal: { type: 'wipe' },
    me: { crystals: 6, field: ['y02'], hand: ['y03', 'y05'] },
    foe: { field: [{ id: 'g01', hp: 2 }, { id: 'p01', hp: 2 }, { id: 'r06', hp: 4 }] },
    hints: ['遠隔のモンスターを2体とも後列に出す。', '攻撃は自分のスロット3 → 2 → 1 の順。相手のスロット3（HP4）を、攻撃力4の対空の弩兵で狙える置き方を考える。'],
    solution: [['m', 1, 1], ['m', 0, 2], ['end']],
  },
  {
    id: 'b06', level: 'beginner', title: '詰めてきた相手を続けて殴る', lesson: '前列が倒れると、後ろのモンスターが前に詰める。追加攻撃（Batter）は、詰めてきた相手に当たる。',
    goal: { type: 'wipe' },
    me: { crystals: 1, field: ['r05'], hand: ['e01', 'f01'] },
    foe: { field: [{ id: 'g01', hp: 4 }, { id: 'p01', hp: 4 }] },
    hints: ['装備とフラッシュ、使えるのはどちらか1枚。', '連撃の拳闘士は近接攻撃を2回行う。1回で1体ずつ倒せる攻撃力にする。'],
    solution: [['e', 0, 0], ['end']],
  },
  {
    id: 'b07', level: 'beginner', title: 'アーマーと魔法', lesson: '物理ダメージはまずアーマーを削り、壊したときの余りは消える。魔法ダメージはアーマーを無視する。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: ['y02', 'b02'], hand: ['e01', 'e03'] },
    foe: { field: [{ id: 'y02', item: 'e06', hp: 4 }] },
    hints: ['装備できるのは1枚だけ。', '相手はアーマー5。近接を強くしても、アーマーで止まる。'],
    solution: [['e', 1, 1], ['end']],
  },
  {
    id: 'b08', level: 'beginner', title: '生贄でクリスタルを作る', lesson: '1ターンに1回、カードを生贄にしてクリスタルに換えられる（アイテム+1、モンスター+2）。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: [], hand: ['r04', 'e04', 'r01'] },
    foe: { field: [{ id: 'b01', hp: 3 }] },
    hints: ['赤銅の槍兵（コスト3）を出したい。', 'クリスタルが1つ足りない。いらないカードを生贄にする。'],
    solution: [['s', 1], ['m', 0, 0], ['end']],
  },
  {
    id: 'b09', level: 'beginner', title: 'Thorns に気をつける', lesson: 'Thorns 持ちを近接で殴ると、倒しても攻撃した側がダメージを受ける。フラッシュなら受けない。',
    goal: { type: 'wipe', noLoss: true },
    me: { crystals: 1, field: [{ id: 'r01', hp: 2 }, 'b01'], hand: ['f01', 'e01'] },
    foe: { field: [{ id: 'g04', hp: 3 }] },
    hints: ['使えるのは1枚だけ。', '近接で殴ると、Thorns 2 で火の粉ネズミ（HP2）が倒れてしまう。攻撃フェーズの前に倒しきる。'],
    solution: [['f', 0, 0], ['end']],
  },
  {
    id: 'b10', level: 'beginner', title: 'Flying と Anti-Air', lesson: 'Flying は近接・遠隔を回避する（この問題では必ず回避）。Anti-Air があれば回避されず、追加ダメージも入る。',
    goal: { type: 'wipe' }, fixed: { dodge: true },
    me: { crystals: 1, field: ['y02', 'y04'], hand: ['e17', 'e01'] },
    foe: { field: [{ id: 'y11', hp: 6 }] },
    hints: ['使えるのは1枚だけ。', '鉄の剣で近接を強くしても、回避される。回避されない攻撃を作る。'],
    solution: [['e', 0, 1], ['end']],
  },

  // ---------- 中級：装備・フラッシュ・生贄・スキルの組み合わせ ----------
  {
    id: 'm01', level: 'middle', title: '後ろから届く槍', lesson: 'Reach を持つと、後列からでも近接攻撃ができる。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: ['y02', 'r02'], hand: ['e07', 'e01'] },
    foe: { field: [{ id: 'g06', hp: 5 }] },
    hints: ['装備できるのは1枚だけ。', '後列の焔の番犬は、このままでは攻撃できない。前列だけを強くしても、5ダメージには届かない。'],
    solution: [['e', 0, 1], ['end']],
  },
  {
    id: 'm02', level: 'middle', title: 'アーマーを溶かす', lesson: 'Corrosion は、相手の装備を壊す。削るより、壊したほうが早いことがある。',
    goal: { type: 'wipe' },
    me: { crystals: 1, field: ['r04', 'y03'], hand: ['f21', 'f01'] },
    foe: { field: [{ id: 'y02', item: 'e06', hp: 5 }] },
    hints: ['使えるフラッシュは1枚だけ。', '石つぶての3ダメージは、アーマーに吸われる。'],
    solution: [['f', 0, 0], ['end']],
  },
  {
    id: 'm03', level: 'middle', title: '場の生贄で並べ直す', lesson: '場のモンスターも生贄にできる（+2）。いなくなると、後ろが前に詰める。',
    goal: { type: 'wipe' },
    me: { crystals: 0, field: ['b03', 'r10', 'y03'], hand: ['e01'] },
    foe: { field: [{ id: 'g06', hp: 7 }] },
    hints: ['鉄の剣を使いたいが、クリスタルがない。', '前列の盾貝は攻撃力1。後ろの逆襲の闘士（攻撃力3）は、前列に来れば攻撃できる。'],
    solution: [['x', 0], ['e', 0, 0], ['end']],
  },
  {
    id: 'm04', level: 'middle', title: 'Taunt をどかす', lesson: 'Taunt 持ちがいると、遠隔攻撃はそこに集まる。山札に戻せば、詰めて並びが変わる。',
    goal: { type: 'kills', n: 2 },
    me: { crystals: 3, field: ['r04', 'y03', 'y04'], hand: ['f06', 'f08'] },
    foe: { field: ['g06', { id: 'b01', hp: 3 }, { id: 'p01', hp: 3 }] },
    hints: ['使えるフラッシュは1枚だけ。', '大樹の古老（Taunt・HP13）は倒せない。いなくなれば、後ろの2体が前に詰めてくる。'],
    solution: [['f', 0, 0], ['end']],
  },
  {
    id: 'm05', level: 'middle', title: 'Disease を起爆する', lesson: 'Outbreak は、相手の Disease のスタック数ぶんの追加魔法ダメージを与える。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: ['p06', 'p02'], hand: ['f12', 'f02'] },
    foe: { field: [{ id: 'g06', hp: 11 }] },
    hints: ['使えるフラッシュは1枚だけ。', '疫病ネズミ（スロット2）が先に攻撃して Disease を1つ足し、そのあと瘴気の魔術師が起爆する。'],
    solution: [['f', 0, -1], ['end']],
  },
  {
    id: 'm06', level: 'middle', title: '跳ね返しを封じる', lesson: 'Magic Reflect は、Disease 状態のあいだ使えない。',
    goal: { type: 'wipe', noLoss: true }, fixed: { reflect: true },
    me: { crystals: 1, field: [{ id: 'b02', hp: 2 }, 'y03'], hand: ['f05', 'e04'] },
    foe: { field: [{ id: 'b10', hp: 4 }] },
    hints: ['使えるのは1枚だけ。', '魔法で倒すと、与えたダメージがそのまま返ってくる。アーマーは魔法ダメージを防げない。'],
    solution: [['f', 0, -1], ['end']],
  },
  {
    id: 'm07', level: 'middle', title: '分身で手数を増やす', lesson: 'Phantom の分身は、攻撃フェーズの最初に一番後ろの空きスロットに現れ、本体と同じ攻撃をする。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: ['y02', 'y07'], hand: ['f27', 'e02', 'e01'] },
    foe: { field: [{ id: 'g06', hp: 12 }] },
    hints: ['幻影の術（コスト2）か、装備2枚（コスト1ずつ）か。', '雷鳴の射手は Piercing 持ちの遠隔5。同じ攻撃がもう1回あれば届く。'],
    solution: [['f', 0, 1], ['end']],
  },
  {
    id: 'm08', level: 'middle', title: '二段の追い打ち', lesson: 'Doublestrike は、近接攻撃が当たるたびに、後列へ追加ダメージ。攻撃回数が増えれば、追い打ちも増える。',
    goal: { type: 'kills', n: 1 },
    me: { crystals: 2, field: ['r02'], hand: ['e09', 'e01', 'e04'] },
    foe: { field: ['g06', { id: 'p01', hp: 2 }] },
    hints: ['連撃の籠手（コスト2）か、鉄の剣（コスト1）か。', '前列の大樹の古老（HP13）は倒せない。後列のHP2を倒すには、Doublestrike 1 が2回必要。'],
    solution: [['e', 0, 0], ['end']],
  },
  {
    id: 'm09', level: 'middle', title: '次の攻撃を耐える', lesson: '相手の攻撃順と狙いを読んで、倒されない形を作る。',
    goal: { type: 'hold' },
    me: { crystals: 2, field: [{ id: 'b02', hp: 3 }], hand: ['b03', 'e06', 'e05'] },
    foe: { field: ['r07', 'y05'] },
    hints: ['使えるクリスタルは2。盾貝（コスト2）か、鋼の大盾（コスト2）か、命の護符（コスト1）。', '相手は、後列の弩兵（遠隔4）→ 前列の将軍（近接4＋Inspire 2）の順に攻撃してくる。遠隔は後列を先に狙う。'],
    solution: [['e', 1, 0], ['end']],
  },
  {
    id: 'm10', level: 'middle', title: '均衡でコストを下げる', lesson: 'Equilibrium 持ちが場にいると、同じ色の手札のモンスターのコストが下がる。',
    goal: { type: 'wipe' },
    me: { crystals: 4, field: ['b09'], hand: ['b08', 'b06', 'b02'] },
    foe: { field: [{ id: 'r06', hp: 7 }, { id: 'p03', hp: 3 }] },
    hints: ['均衡の天秤使いがいるあいだ、青のモンスターはコスト2で出せる。', '相手の後列は Stealth 持ちで、後列にいるあいだは魔法で狙えない。前列を先に倒して、前に詰めさせる。'],
    solution: [['m', 0, 1], ['m', 1, 0], ['end']],
  },

  // ---------- 上級：複数のルールを組み合わせる ----------
  {
    id: 'a01', level: 'advanced', title: '動かして削る', lesson: 'Menace は、自分のターン中に位置が変わった相手にダメージを与える。倒す・山札に戻すなどで詰めさせても発動する。',
    goal: { type: 'wipe' }, start: false,
    me: { crystals: 2, field: ['r12'], hand: ['f13', 'e01', 'f01'] },
    foe: { field: [{ id: 'g06', hp: 6 }, { id: 'p01', hp: 2 }, { id: 'b01', hp: 1 }] },
    hints: ['時戻しの砂（コスト2）か、鉄の剣と石つぶて（コスト1ずつ）か。', '前列がいなくなると、後ろの2体が前に詰めて、Menace 1 を受ける。プレイフェーズのうちに詰めさせれば、そのあと近接で残りを殴れる。'],
    solution: [['f', 0, 0], ['end']],
  },
  {
    id: 'a02', level: 'advanced', title: '恐怖で前に引きずり出す', lesson: 'Fear は場に出たときに、相手の前列と後列を入れ替える。Menace があれば、入れ替わった2体にダメージも入る。後列に隠れた相手を、近接で殴れるようになる。',
    goal: { type: 'kills', n: 1, turns: 1 },
    me: { crystals: 6, field: ['y02'], hand: ['r12', 'e01', 'e07'] },
    foe: { field: ['g06', 'p03'] },
    hints: ['後列の盗賊（HP7）は Stealth 持ち。遠隔でも魔法でも狙えない。鬼面の威圧者を出すと、その場で盗賊が前列に出てくる。', '入れ替えの Menace で1ダメージ。残りは6。威圧者の近接3だけでは足りないので、もう1体も近接で殴る必要がある。後列から近接攻撃をするには Reach がいる。'],
    solution: [['m', 0, 0], ['e', 2, 1], ['end']],
  },
  {
    id: 'a03', level: 'advanced', title: '倒されて届くクリスタル', lesson: '自分のモンスターが場で倒されると、クリスタルが1つ増える。相手の番に倒されたぶんは、次の自分の番に使える。',
    goal: { type: 'wipe', turns: 2 },
    me: { crystals: 2, field: ['y02'], hand: ['r01', 'f23', 'f01'] },
    foe: { field: ['r07', { id: 'p01', hp: 2 }] },
    hints: ['2ターン目に、終止符（コスト5）を使いたい。', '次の番のクリスタルは「残した数＋3＋倒された数」。相手は、カオス2 → 近接6 の順に、こちらの前列を攻撃してくる。'],
    solution: [['m', 0, 0], ['end'], ['f', 1, 0], ['end']],
  },
  {
    id: 'a04', level: 'advanced', title: '隠れた相手を引きずり出す', lesson: 'Stealth 持ちは、後列にいるあいだ遠隔・魔法で狙えない。前列を先に倒して、前に詰めさせる。攻撃は自分のスロット3から。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: ['y02', 'y07'], hand: ['b02', 'e01', 'e02'] },
    foe: { field: [{ id: 'g01', hp: 2 }, { id: 'p03', hp: 7 }] },
    hints: ['氷柱の見習い（コスト2）か、装備2枚（コスト1ずつ）か。', '雷鳴の射手の5ダメージを、盗賊に当てたい。その前に、だれかが前列の子鹿を倒しておく必要がある。'],
    solution: [['m', 0, 2], ['end']],
  },
  {
    id: 'a05', level: 'advanced', title: '撃つ順番を入れ替える', lesson: '押し出しで、だれがスロット3（最初に攻撃する場所）に行くかを変えられる。倒すと詰めて、次の攻撃の狙いも変わる。',
    goal: { type: 'wipe' },
    me: { crystals: 2, field: ['y02', 'y05'], hand: ['y03'] },
    foe: { field: [{ id: 'g01', hp: 2 }, { id: 'r06', hp: 4 }, { id: 'p01', hp: 2 }] },
    hints: ['見張りの鷹を、スロット2とスロット3のどちらに入れるか。', '対空の弩兵（遠隔4）で、相手のスロット2（HP4）を先に倒したい。スロット3からの遠隔は、相手のスロット2を狙う。'],
    solution: [['m', 0, 1], ['end']],
  },
  {
    id: 'a06', level: 'advanced', title: '分身にも槍を持たせる', lesson: 'Phantom の分身は、本体の装備とスキルもそのまま写す。後列に現れるので、Reach がなければ近接攻撃はできない。',
    goal: { type: 'wipe' },
    me: { crystals: 4, field: ['r05'], hand: ['f27', 'e07', 'e01', 'e11'] },
    foe: { field: [{ id: 'g06', hp: 12 }] },
    hints: ['幻影の術（コスト2）と、あと1枚。', '連撃の拳闘士の分身は後列に現れる。後列から近接攻撃をするには、何が必要か。装備は、分身が現れる前（プレイフェーズ）に付ける。'],
    solution: [['e', 1, 0], ['f', 0, 0], ['end']],
  },
  {
    id: 'a07', level: 'advanced', title: '見切りの一太刀', lesson: 'See-through は、攻撃のとき相手の Thorns・Counter-Attack・Shield などを無視する。場の生贄で、後ろのモンスターを前列に出せる。',
    goal: { type: 'wipe', noLoss: true },
    me: { crystals: 1, field: [{ id: 'r10', hp: 2 }, 'r09'], hand: ['e04', 'e01'] },
    foe: { field: [{ id: 'g04', hp: 4 }] },
    hints: ['装備では解決しない。', '前列の逆襲の闘士が殴ると、Thorns 2 で倒れる。後ろの心眼の剣士なら、Thorns を無視できる。'],
    solution: [['x', 0], ['end']],
  },
  {
    id: 'a08', level: 'advanced', title: '回復を止めてから削る', lesson: 'Silence 状態のモンスターは、Heal を使えない。出す順番で、2ターンの合計ダメージが変わる。場は3スロットしかない。',
    goal: { type: 'wipe', turns: 2 },
    me: { crystals: 3, field: ['y02'], hand: ['b04', 'b02', 'b01'] },
    foe: { field: [{ id: 'g09', hp: 10 }] },
    hints: ['1ターン目に、霧の語り部（コスト3）を出すか、氷柱の見習いとしずくの精を出すか。', '聖盾の僧は、自分のターン開始時に2回復し、回復すると Shield 2 を得る。Silence なら、どちらも起きない。'],
    solution: [['m', 0, 1], ['end'], ['m', 1, 2], ['end']],
  },
  {
    id: 'a09', level: 'advanced', title: '援軍が来る前提で組む', lesson: '相手の番には、相手もカードを出してくる。2ターン目の並びを読んで、1ターン目の使い方を決める。',
    goal: { type: 'wipe', turns: 2 },
    me: { crystals: 2, field: ['r04', 'y05'], hand: ['e01', 'e02', 'f01'] },
    foe: { crystals: 0, field: ['g06'], hand: ['y02'] },
    hints: ['相手は次の番に、砂漠の盾兵（HP8）を出してくる。2ターンで合計21ダメージが必要。', '1ターン目に付けた装備は、2回ぶん効く。2ターン目は、石つぶてで後列を削ってから攻撃する。'],
    solution: [['e', 0, 0], ['end'], ['f', 2, 1], ['end']],
  },
  {
    id: 'a10', level: 'advanced', title: '爆風の中心に立つ', lesson: 'Magic Blast は、魔法攻撃の対象のとなりにも追加ダメージ。前列（中央）を狙えば、左右の両方に届く。',
    goal: { type: 'wipe' },
    me: { crystals: 2, sacrificed: true, field: ['y02', 'b11'], hand: ['f24', 'e03', 'b01'] },
    foe: { field: [{ id: 'g01', hp: 3 }, { id: 'p01', hp: 2 }, { id: 'b01', hp: 2 }] },
    hints: ['このターンの生贄は、もう使ってある。', '爆裂の術師が前列にいれば、正面（相手の前列）を狙い、Magic Blast 2 が左右の2体に入る。前にいる盾兵をどかす方法は？'],
    solution: [['f', 0, 0], ['end']],
  },
];

const PUZZLE_BY_ID = {};
PUZZLES.forEach(p => { PUZZLE_BY_ID[p.id] = p; });
