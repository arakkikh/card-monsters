// ============================================================
// BGM の曲データ（audio.js が演奏する）
//   1曲＝パート（楽器と役割）＋セクション（A・B…）＋構成（order の順にくり返す）。
//   セクション：chords＝1小節に1つの和音（'C,G' なら半分ずつ。'D/F#' は分数和音）
//              mel＝メロディ（'音:長さ'。長さは16分音符の数。r は休み）　pat＝パートの型をこのセクションだけ変える（null で休み）
//   パートの型（1文字＝16分音符1つ。1小節以上の長さでもよい。'.' は鳴らさない）
//     伴奏：'0'〜'9'＝和音の何番目の音（上の音域へ続く）　'c'＝和音全部　hold：次の音まで伸ばす
//     ベース：R＝根音　3・5・7＝和音の3度・5度・7度　O＝1オクターブ上　L＝1オクターブ下
//     打楽器：x＝ふつう　X＝強く　g＝弱く
//   ループの最後の小節は、最初の和音へ戻りたくなる和音（属和音など）で終え、つなぎ目が分からないようにしている。
// ============================================================

// 型を n 小節分くり返す／最初の1回だけ鳴らす（残りは休み）
const patRep = (p, n) => p.repeat(n);
const patOnce = (p, bars) => p + '.'.repeat(bars * 16 - p.length);

const MUSIC = {
  // ---------- ホーム：メインテーマ（ニ長調・明るく、覚えやすい） ----------
  home: {
    name: 'メインテーマ（ホーム）', bpm: 112,
    parts: {
      lead:  { kind: 'mel', inst: 'brass', vol: 0.95, rev: 0.25 },
      flute: { kind: 'mel', inst: 'flute', vol: 1, rev: 0.3, pan: 0.1 },
      keys:  { kind: 'arp', inst: 'keys', oct: 4, pat: '0.2.3.2.1.2.3.2.', len: 2, vol: 0.8, pan: -0.25, rev: 0.2 },
      pad:   { kind: 'arp', inst: 'pad', oct: 4, pat: 'c...............', hold: true, vol: 0.8, rev: 0.4 },
      bass:  { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.....R.5...R.O.', len: 3, vol: 1 },
      kick:  { kind: 'drum', inst: 'kick', pat: 'x.......x.x.....', vol: 0.9 },
      snare: { kind: 'drum', inst: 'snare', pat: '....x.......x...', vol: 0.8, rev: 0.15 },
      hat:   { kind: 'drum', inst: 'hat', pat: '..x...x...x...x.', vol: 1, pan: 0.3 },
      crash: { kind: 'drum', inst: 'crash', pat: patOnce('x', 8), vol: 0.8 },
    },
    sections: {
      A: {
        melPart: 'lead', chords: 'D A/C# Bm F#m G D/F# Em A7',
        mel: 'A4:4 D5:4 F#5:6 E5:2 | E5:4 C#5:4 A4:8 | B4:4 D5:4 F#5:4 B5:4 | A5:6 F#5:2 C#5:8 | B4:4 D5:4 G5:6 F#5:2 | F#5:4 E5:4 D5:4 A4:4 | G4:4 B4:4 E5:4 G5:4 | F#5:4 E5:4 C#5:4 A4:4',
        pat: { pad: null },
      },
      B: {
        melPart: 'flute', chords: 'G A F#m Bm Em A G A7',
        mel: 'D5:6 E5:2 D5:4 B4:4 | C#5:6 D5:2 E5:8 | F#5:6 E5:2 C#5:4 A4:4 | B4:8 D5:4 F#5:4 | G5:6 F#5:2 E5:4 D5:4 | C#5:4 D5:4 E5:8 | B5:6 A5:2 G5:4 F#5:4 | E5:8 G5:4 C#5:4',
        pat: { keys: '0...2...1...2...', snare: '....x.......x..g', kick: 'x.......x.......' },
      },
      A2: {
        like: 'A',
        mel: 'A4:4 D5:4 F#5:6 E5:2 | E5:4 C#5:4 A4:8 | B4:4 D5:4 F#5:4 B5:4 | A5:6 F#5:2 C#5:8 | B4:4 D5:4 G5:6 F#5:2 | A5:4 F#5:4 D5:4 F#5:4 | G5:4 E5:4 B4:4 E5:4 | E5:4 C#5:4 E5:4 A4:4',
        pat: { pad: 'c...............', hat: 'x.x.x.x.x.x.x.x.' },
      },
    },
    order: ['A', 'B', 'A2'],
  },

  // ---------- 森：ゆったり・木管・明るく穏やか（ト長調） ----------
  forest: {
    name: '森', bpm: 80,
    parts: {
      flute:  { kind: 'mel', inst: 'flute', vol: 1.1, rev: 0.35 },
      reed:   { kind: 'mel', inst: 'reed', vol: 0.9, rev: 0.35, pan: -0.15 },
      guitar: { kind: 'arp', inst: 'harp', oct: 3, pat: '0.1.2.3.4.3.2.1.', len: 3, vol: 0.7, pan: 0.25, rev: 0.3 },
      pad:    { kind: 'arp', inst: 'pad', oct: 4, pat: 'c...............', hold: true, vol: 0.55, rev: 0.4 },
      bass:   { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.......5.......', len: 7, vol: 0.85 },
      kick:   { kind: 'drum', inst: 'kick', pat: 'g...............', vol: 0.7 },
      shaker: { kind: 'drum', inst: 'shaker', pat: '..x...x...x...xg', vol: 0.9, pan: 0.35 },
    },
    sections: {
      A: {
        melPart: 'flute', chords: 'G D/F# Em C G Am D D',
        mel: 'D5:4 B4:2 G4:2 B4:4 D5:4 | A4:8 F#4:4 A4:4 | G4:4 B4:4 E5:6 D5:2 | C5:8 B4:4 A4:4 | B4:4 D5:4 G5:6 F#5:2 | E5:8 C5:4 A4:4 | D5:4 F#5:4 A5:4 F#5:4 | D5:12 r:4',
        pat: { pad: null },
      },
      B: {
        melPart: 'reed', chords: 'C D Bm Em Am D G D7',
        mel: 'E5:6 G5:2 E5:4 C5:4 | D5:6 F#5:2 A5:8 | B5:4 A5:4 F#5:4 D5:4 | E5:12 r:4 | C5:4 B4:4 A4:4 E4:4 | F#4:4 G4:4 A4:8 | B4:4 G4:4 D5:4 B4:4 | C5:4 A4:4 F#4:4 A4:4',
        pat: { guitar: '0...2...3...2...', shaker: '..x...x...x...x.' },
      },
    },
    order: ['A', 'B'],
  },

  // ---------- 火山：低い太鼓・うなるベース・短調で速め（ホ短調） ----------
  volcano: {
    name: '火山', bpm: 140,
    parts: {
      lead:  { kind: 'mel', inst: 'brass', vol: 0.9, rev: 0.2 },
      reed:  { kind: 'mel', inst: 'reed', vol: 1, rev: 0.25 },
      stab:  { kind: 'arp', inst: 'pad', oct: 4, pat: 'c..c..c...c..c..', len: 2, vol: 0.9, rev: 0.2 },
      bass:  { kind: 'bass', inst: 'growl', oct: 2, pat: 'R.R.R.R.R.R.O.R.', len: 2, vol: 1 },
      taiko: { kind: 'drum', inst: 'taiko', pat: 'X.....x.X...x.x.', vol: 1 },
      tom:   { kind: 'drum', inst: 'tom', f: 150, pat: patOnce('', 7) + '........x.x.xxxx', vol: 0.8, pan: -0.2 },
      hat:   { kind: 'drum', inst: 'hat', pat: 'x.xxx.xxx.xxx.xx', vol: 0.8, pan: 0.3 },
      snare: { kind: 'drum', inst: 'snare', pat: '....x.......x...', vol: 0.7 },
    },
    sections: {
      A: {
        melPart: 'lead', chords: 'Em Em C D Em Em C B7',
        mel: 'E5:3 E5:1 G5:2 E5:2 B5:4 A5:2 G5:2 | F#5:4 E5:4 D5:4 B4:4 | C5:3 C5:1 E5:2 G5:2 C6:4 B5:2 G5:2 | A5:8 F#5:4 D5:4 | E5:3 E5:1 G5:2 E5:2 B5:4 C6:2 B5:2 | A5:4 G5:4 F#5:4 E5:4 | G5:4 E5:4 C5:4 E5:4 | D#5:8 F#5:4 B4:4',
      },
      B: {
        melPart: 'reed', chords: 'Am Am Em Em C D B B7',
        mel: 'A4:8 C5:4 E5:4 | E5:8 C5:8 | B4:8 E5:4 G5:4 | B5:16 | C6:8 B5:4 G5:4 | A5:8 F#5:4 D5:4 | D#5:8 F#5:4 A5:4 | B5:8 A5:4 F#5:4',
        pat: { stab: 'c...............', bass: 'R...R...R...R.O.', hat: 'x...x...x...x...', snare: '........x.......' },
      },
    },
    order: ['A', 'B', 'A'],
  },

  // ---------- 天空：ハープのアルペジオ・高い音域・壮大で明るい（イ長調） ----------
  sky: {
    name: '天空', bpm: 92,
    parts: {
      bell:  { kind: 'mel', inst: 'flute', vol: 1, rev: 0.45 },
      brass: { kind: 'mel', inst: 'brass', vol: 0.8, rev: 0.4 },
      harp:  { kind: 'arp', inst: 'harp', oct: 4, pat: '0123456765432101', len: 3, vol: 0.75, pan: -0.2, rev: 0.45 },
      pad:   { kind: 'arp', inst: 'pad', oct: 4, pat: 'c...............', hold: true, vol: 0.8, rev: 0.5 },
      bass:  { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.......R...5...', len: 6, vol: 0.8 },
      timp:  { kind: 'drum', inst: 'timpani', f: 110, pat: 'x...............', vol: 0.8, rev: 0.3 },
      kick:  { kind: 'drum', inst: 'kick', pat: 'g.......g.......', vol: 0.6 },
      crash: { kind: 'drum', inst: 'crash', pat: patOnce('x', 8), vol: 0.7, rev: 0.4 },
    },
    sections: {
      A: {
        melPart: 'bell', chords: 'A E/G# F#m D A/C# D Bm E',
        mel: 'E5:8 A5:8 | G#5:8 B5:4 G#5:4 | A5:8 C#6:8 | B5:8 A5:4 F#5:4 | E5:8 A5:4 C#6:4 | D6:8 C#6:4 B5:4 | C#6:4 B5:4 A5:4 F#5:4 | G#5:8 E5:8',
        pat: { pad: null },
      },
      B: {
        melPart: 'brass', chords: 'D E C#m F#m Bm E D E7',
        mel: 'F#5:6 A5:2 D6:8 | E6:8 D6:4 B5:4 | C#6:6 B5:2 G#5:8 | A5:8 F#5:8 | D6:6 C#6:2 B5:4 A5:4 | G#5:6 A5:2 B5:8 | A5:4 F#5:4 D5:4 F#5:4 | E5:8 G#5:4 B5:4',
        pat: { kick: 'x.......x.......', timp: 'x.......x.......' },
      },
    },
    order: ['A', 'B'],
  },

  // ---------- 毒沼：不気味な音の重なり・うねるベース・怪しい（ハ短調） ----------
  swamp: {
    name: '毒沼', bpm: 88, swing: 0.25,
    parts: {
      reed:   { kind: 'mel', inst: 'reed', vol: 1, rev: 0.4, pan: -0.1 },
      choirm: { kind: 'mel', inst: 'choir', vol: 1.3, rev: 0.6 },
      choir:  { kind: 'arp', inst: 'choir', oct: 4, pat: 'c...............', hold: true, vol: 0.8, rev: 0.6 },
      bell:   { kind: 'arp', inst: 'bell', oct: 5, pat: '..2...1...3...0.', len: 2, vol: 0.45, pan: 0.4, rev: 0.6 },
      bass:   { kind: 'bass', inst: 'wobble', oct: 2, pat: 'R.....R...R.5...', len: 4, vol: 0.9 },
      kick:   { kind: 'drum', inst: 'kick', pat: 'x.......x..x....', vol: 0.75 },
      rim:    { kind: 'drum', inst: 'rim', pat: '....x.......x..g', vol: 1, pan: 0.2, rev: 0.3 },
      shaker: { kind: 'drum', inst: 'shaker', pat: '..x...x...x...x.', vol: 0.8, pan: -0.3 },
    },
    sections: {
      A: {
        melPart: 'reed', chords: 'Cm Cm Ab G Cm Fm Db G7',
        mel: 'C5:3 Eb5:1 G5:4 F#5:2 G5:2 r:4 | Eb5:3 D5:1 C5:4 B4:4 r:4 | C5:3 Eb5:1 Ab5:4 G5:2 F5:2 r:4 | D5:8 B4:4 r:4 | C5:3 Eb5:1 G5:4 Ab5:2 G5:2 r:4 | F5:3 Ab5:1 C6:4 B5:2 C6:2 r:4 | Db6:4 C6:2 Ab5:2 F5:4 Db5:4 | D5:6 F5:2 B4:8',
        pat: { choir: null },
      },
      B: {
        melPart: 'choirm', chords: 'Fm Cm Fm G Ab Fm Db G7',
        mel: 'Ab4:8 C5:8 | G4:8 Eb5:8 | F5:8 Ab5:4 G5:4 | G5:12 r:4 | Eb5:8 C5:4 Ab4:4 | F4:8 Ab4:4 C5:4 | Db5:8 F5:4 Ab5:4 | G5:4 F5:4 D5:4 B4:4',
        pat: { bell: '0.......2.......', shaker: '..x.......x.....' },
      },
    },
    order: ['A', 'B'],
  },

  // ---------- 古城：オルガン・短調・荘厳（ニ短調） ----------
  castle: {
    name: '古城', bpm: 76,
    parts: {
      organ:  { kind: 'mel', inst: 'organ', vol: 1.2, rev: 0.5 },
      choirm: { kind: 'mel', inst: 'brass', vol: 0.75, rev: 0.5 },
      chords: { kind: 'arp', inst: 'organ', oct: 3, pat: 'c.......c.......', hold: true, vol: 0.7, rev: 0.5, pan: -0.15 },
      arp:    { kind: 'arp', inst: 'organ', oct: 4, pat: '0.1.2.1.0.1.2.1.', len: 2, vol: 0.45, pan: 0.25, rev: 0.4 },
      bass:   { kind: 'bass', inst: 'organ', oct: 2, pat: 'R...............', hold: true, vol: 1.2 },
      timp:   { kind: 'drum', inst: 'timpani', f: 73, pat: 'x.......g.......', vol: 0.9, rev: 0.4 },
      bell:   { kind: 'drum', inst: 'tom', f: 98, pat: patOnce('x', 2), vol: 0.5, rev: 0.6 },
    },
    sections: {
      A: {
        melPart: 'organ', chords: 'Dm A7 Dm C Bb Gm A A7',
        mel: 'D5:4 F5:4 A5:6 G5:2 | E5:4 C#5:4 A4:8 | F5:4 A5:4 D6:6 C6:2 | C6:4 G5:4 E5:4 G5:4 | F5:4 Bb5:4 D6:6 C6:2 | Bb5:4 A5:4 G5:4 D5:4 | C#5:4 E5:4 A5:8 | G5:4 E5:4 C#5:4 A4:4',
        pat: { arp: null },
      },
      B: {
        melPart: 'choirm', chords: 'F C Dm Am Bb F Gm A7',
        mel: 'A5:8 C6:4 A5:4 | G5:8 E5:4 C5:4 | F5:6 E5:2 D5:4 A4:4 | C5:8 E5:8 | D5:6 F5:2 Bb5:8 | A5:6 G5:2 F5:4 C5:4 | D5:4 G5:4 Bb5:4 G5:4 | A5:8 C#5:4 E5:4',
        pat: { chords: 'c...............' },
      },
    },
    order: ['A', 'B'],
  },

  // ---------- 平原：明るい長調・軽快なリズム（ハ長調） ----------
  plain: {
    name: '平原', bpm: 124,
    parts: {
      lead:   { kind: 'mel', inst: 'flute', vol: 1.05, rev: 0.25 },
      keys:   { kind: 'mel', inst: 'keys', vol: 1.2, rev: 0.25, pan: 0.1 },
      guitar: { kind: 'arp', inst: 'pluck', oct: 4, pat: '..c...c...c...c.', len: 1, vol: 0.8, pan: 0.3, rev: 0.15 },
      harp:   { kind: 'arp', inst: 'harp', oct: 4, pat: '0.2.1.2.0.2.1.2.', len: 2, vol: 0.4, pan: -0.3, rev: 0.2 },
      bass:   { kind: 'bass', inst: 'bass', oct: 2, pat: 'R..5O.R.R..5O.R.', len: 2, vol: 0.9 },
      kick:   { kind: 'drum', inst: 'kick', pat: 'x...x...x...x...', vol: 0.8 },
      clap:   { kind: 'drum', inst: 'clap', pat: '....x.......x...', vol: 0.8, rev: 0.15 },
      hat:    { kind: 'drum', inst: 'hat', pat: '..x...x...x...xx', vol: 0.9, pan: 0.25 },
      shaker: { kind: 'drum', inst: 'shaker', pat: 'x.x.x.x.x.x.x.x.', vol: 0.6, pan: -0.25 },
    },
    sections: {
      A: {
        melPart: 'lead', chords: 'C G Am F C G F G',
        mel: 'E5:2 G5:2 C6:2 G5:2 E5:4 G5:4 | D5:2 G5:2 B5:2 G5:2 D5:8 | C5:2 E5:2 A5:2 E5:2 C5:4 E5:4 | F5:6 E5:2 D5:4 C5:4 | E5:2 G5:2 C6:2 G5:2 E5:4 C6:4 | B5:4 A5:2 G5:2 D5:8 | A5:4 G5:2 F5:2 C5:4 F5:4 | G5:8 D5:4 B4:4',
        pat: { harp: null },
      },
      B: {
        melPart: 'keys', chords: 'F G Em Am Dm G F G',
        mel: 'A5:6 G5:2 F5:4 A5:4 | G5:6 F5:2 D5:8 | E5:4 G5:4 B5:4 G5:4 | A5:12 r:4 | F5:4 A5:4 D6:4 C6:4 | B5:6 A5:2 G5:8 | A5:2 G5:2 F5:2 E5:2 F5:4 A5:4 | G5:8 B4:4 D5:4',
        pat: { shaker: null, kick: 'x.......x.x.....' },
      },
    },
    order: ['A', 'B', 'A'],
  },
};

// ---------- その他の場面 ----------

Object.assign(MUSIC, {
  // デッキ編集・コレクション：落ち着いた、長く聞いても疲れない（ヘ長調・ゆるく跳ねる）
  deck: {
    name: 'デッキ・コレクション', bpm: 78, swing: 0.2,
    parts: {
      keys:   { kind: 'mel', inst: 'keys', vol: 1.1, rev: 0.3 },
      flute:  { kind: 'mel', inst: 'flute', vol: 0.8, rev: 0.35, pan: 0.15 },
      comp:   { kind: 'arp', inst: 'keys', oct: 3, pat: '0..2..1.3..2..1.', len: 3, vol: 0.55, pan: -0.25, rev: 0.25 },
      pad:    { kind: 'arp', inst: 'pad', oct: 4, pat: 'c...............', hold: true, vol: 0.5, rev: 0.4 },
      bass:   { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.......5...R...', len: 4, vol: 0.8 },
      kick:   { kind: 'drum', inst: 'kick', pat: 'x.......x.x.....', vol: 0.6 },
      rim:    { kind: 'drum', inst: 'rim', pat: '....x.......x...', vol: 0.8, rev: 0.2 },
      shaker: { kind: 'drum', inst: 'shaker', pat: '..x...x...x...x.', vol: 0.6, pan: 0.3 },
    },
    sections: {
      A: {
        melPart: 'keys', chords: 'Fmaj7 Em7 Dm7 Cmaj7 Fmaj7 Em7 Dm7 G7',
        mel: 'A5:6 G5:2 E5:8 | G5:6 D5:2 B4:8 | F5:4 E5:4 D5:4 A4:4 | E5:12 r:4 | C6:6 A5:2 G5:4 E5:4 | B5:6 G5:2 E5:8 | A5:4 F5:4 E5:4 D5:4 | D5:8 B4:4 G4:4',
        pat: { pad: null },
      },
      B: {
        melPart: 'flute', chords: 'Bbmaj7 Am7 Dm7 Gm7 Bbmaj7 Am7 Gm7 C7',
        mel: 'D5:6 F5:2 A5:8 | G5:6 E5:2 C5:8 | F5:6 A5:2 C6:8 | Bb5:8 A5:4 G5:4 | F5:6 D5:2 Bb4:8 | C5:6 E5:2 G5:8 | Bb5:4 A5:4 G5:4 F5:4 | E5:8 G5:8',
      },
    },
    order: ['A', 'B'],
  },

  // パック開封：わくわくする短い曲（ニ長調・最後の小節でスネアが盛り上げる）
  pack: {
    name: 'パック開封', bpm: 128,
    parts: {
      bell:   { kind: 'mel', inst: 'bell', vol: 1.2, rev: 0.35 },
      brass:  { kind: 'mel', inst: 'brass', vol: 0.9, rev: 0.3 },
      harp:   { kind: 'arp', inst: 'harp', oct: 4, pat: '0123210101232101', len: 2, vol: 0.5, pan: -0.3, rev: 0.3 },
      guitar: { kind: 'arp', inst: 'pluck', oct: 4, pat: '..c...c...c...c.', len: 1, vol: 0.7, pan: 0.3 },
      bass:   { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.R.R.R.R.R.O.R.', len: 1, vol: 0.9 },
      kick:   { kind: 'drum', inst: 'kick', pat: 'x...x...x...x...', vol: 0.8 },
      clap:   { kind: 'drum', inst: 'clap', pat: '....x.......x...', vol: 0.7 },
      hat:    { kind: 'drum', inst: 'hat', pat: 'x.x.x.x.x.x.x.x.', vol: 0.8, pan: 0.2 },
      crash:  { kind: 'drum', inst: 'crash', pat: patOnce('x', 8), vol: 0.7 },
    },
    sections: {
      A: {
        melPart: 'bell', chords: 'D G A D D G A A',
        mel: 'F#5:2 A5:2 D6:2 A5:2 F#5:2 A5:2 D6:4 | B5:2 D6:2 G6:2 D6:2 B5:4 G5:4 | A5:2 C#6:2 E6:2 C#6:2 A5:4 E5:4 | F#5:4 A5:4 D6:8 | F#5:2 A5:2 D6:2 A5:2 F#5:2 A5:2 D6:4 | E6:2 D6:2 B5:2 G5:2 B5:4 D6:4 | C#6:4 B5:4 A5:4 E5:4 | A5:8 r:8',
      },
      B: {
        melPart: 'brass', chords: 'Bm G D A Bm G E A7',
        mel: 'D6:4 C#6:4 B5:8 | B5:4 A5:4 G5:8 | A5:4 F#5:4 D5:8 | E5:4 F#5:4 A5:8 | B5:4 C#6:4 D6:8 | D6:4 E6:4 G6:8 | E6:4 D6:4 B5:4 G#5:4 | A5:4 G5:4 E5:4 C#5:4',
        pat: { clap: patRep('....x.......x...', 7) + 'x.x.x.x.xxxxxxxx' },
      },
    },
    order: ['A', 'B'],
  },

  // ダンジョン：冒険感（ニ短調・行進するような太鼓）
  dungeon: {
    name: 'ダンジョン', bpm: 108,
    parts: {
      reed:   { kind: 'mel', inst: 'reed', vol: 1.05, rev: 0.3 },
      flute:  { kind: 'mel', inst: 'flute', vol: 1, rev: 0.35, pan: 0.1 },
      pluck:  { kind: 'arp', inst: 'pluck', oct: 4, pat: '0.1.2.1.0.1.2.1.', len: 2, vol: 0.7, pan: -0.3, rev: 0.2 },
      pad:    { kind: 'arp', inst: 'pad', oct: 4, pat: 'c...............', hold: true, vol: 0.6, rev: 0.4 },
      bass:   { kind: 'bass', inst: 'bass', oct: 2, pat: 'R..R..R.R..R..5.', len: 2, vol: 0.9 },
      taiko:  { kind: 'drum', inst: 'taiko', pat: 'x.....x.x.......', vol: 0.7 },
      snare:  { kind: 'drum', inst: 'snare', pat: '....x.......x.gg', vol: 0.6, rev: 0.15 },
      hat:    { kind: 'drum', inst: 'hat', pat: '..x...x...x...x.', vol: 0.8, pan: 0.25 },
      crash:  { kind: 'drum', inst: 'crash', pat: patOnce('x', 8), vol: 0.6 },
    },
    sections: {
      A: {
        melPart: 'reed', chords: 'Dm C Dm C Bb C Dm A',
        mel: 'D5:3 E5:1 F5:4 A5:4 G5:2 F5:2 | E5:4 C5:4 G4:8 | D5:3 E5:1 F5:4 A5:4 D6:4 | C6:4 G5:4 E5:8 | F5:3 G5:1 Bb5:4 A5:4 G5:4 | G5:3 A5:1 G5:4 E5:4 C5:4 | F5:4 E5:4 D5:4 F5:4 | E5:8 C#5:4 A4:4',
        pat: { pad: null },
      },
      B: {
        melPart: 'flute', chords: 'Bb F C Dm Bb F Gm A',
        mel: 'D5:8 F5:8 | C5:8 A5:8 | G5:6 F5:2 E5:4 C5:4 | D5:12 r:4 | Bb5:6 A5:2 F5:8 | A5:6 G5:2 C5:8 | D5:4 G5:4 Bb5:4 G5:4 | A5:4 E5:4 C#5:4 E5:4',
        pat: { pluck: '0...2...1...2...' },
      },
      A2: { like: 'A', pat: { pad: 'c...............', hat: 'x.x.x.x.x.x.x.x.' } },
    },
    order: ['A', 'B', 'A2'],
  },

  // パズル：考えるのを邪魔しない静かな曲（ハ長調・ゆっくり、音を少なく）
  puzzle: {
    name: 'パズル', bpm: 70,
    parts: {
      bell:   { kind: 'mel', inst: 'bell', vol: 1, rev: 0.5 },
      flute:  { kind: 'mel', inst: 'flute', vol: 0.9, rev: 0.5 },
      harp:   { kind: 'arp', inst: 'harp', oct: 4, pat: '0...1...2...3...', len: 4, vol: 0.55, pan: -0.2, rev: 0.45 },
      pad:    { kind: 'arp', inst: 'pad', oct: 4, pat: 'c...............', hold: true, vol: 0.6, rev: 0.5 },
      bass:   { kind: 'bass', inst: 'bass', oct: 2, pat: 'R...............', hold: true, vol: 0.7 },
      shaker: { kind: 'drum', inst: 'shaker', pat: 'g.......g.......', vol: 0.5, pan: 0.3 },
    },
    sections: {
      A: {
        melPart: 'bell', chords: 'Cmaj7 D/C Em7 Am7 Fmaj7 G Em7 G',
        mel: 'E5:8 G5:8 | F#5:8 A5:8 | G5:8 B5:4 G5:4 | E5:16 | A5:8 C6:8 | B5:8 D6:4 B5:4 | G5:8 E5:8 | D5:16',
      },
      B: {
        melPart: 'flute', chords: 'Am7 Em7 Fmaj7 Cmaj7 Am7 Em7 Fmaj7 G',
        mel: 'C5:8 E5:8 | B4:8 G5:8 | A5:8 E5:8 | G5:16 | E5:8 A5:8 | G5:8 B5:8 | C6:8 A5:8 | B5:8 D5:8',
        pat: { harp: '0.......2.......' },
      },
    },
    order: ['A', 'B'],
  },

  // イベント：お祭り（ト長調・五音音階の笛と太鼓・手拍子）
  event: {
    name: 'イベント', bpm: 132,
    parts: {
      flute:  { kind: 'mel', inst: 'flute', vol: 1.1, rev: 0.25 },
      reed:   { kind: 'mel', inst: 'reed', vol: 1, rev: 0.25, pan: -0.1 },
      pluck:  { kind: 'arp', inst: 'pluck', oct: 4, pat: '0.2.1.2.0.2.1.2.', len: 2, vol: 0.65, pan: 0.3 },
      bass:   { kind: 'bass', inst: 'bass', oct: 2, pat: 'R...5...R...5.O.', len: 3, vol: 0.9 },
      taiko:  { kind: 'drum', inst: 'taiko', pat: 'X..x..x.X...x...', vol: 0.8 },
      clap:   { kind: 'drum', inst: 'clap', pat: '....x.......x...', vol: 0.8 },
      shaker: { kind: 'drum', inst: 'shaker', pat: 'x.x.x.x.x.x.x.x.', vol: 0.7, pan: -0.3 },
      kane:   { kind: 'drum', inst: 'rim', pat: '..x...x...x...xx', vol: 1.1, pan: 0.35, rev: 0.2 },
    },
    sections: {
      A: {
        melPart: 'flute', chords: 'G G C D G Em C D',
        mel: 'D5:2 E5:2 G5:2 E5:2 D5:4 B4:4 | D5:2 E5:2 G5:2 A5:2 B5:8 | A5:2 G5:2 E5:2 G5:2 A5:4 E5:4 | D5:4 E5:2 D5:2 A4:8 | D5:2 E5:2 G5:2 E5:2 D5:4 G5:4 | B5:2 A5:2 G5:2 E5:2 G5:8 | E5:4 G5:4 A5:2 G5:2 E5:4 | D5:8 A4:4 B4:4',
      },
      B: {
        melPart: 'reed', chords: 'Em C G D Em C Am D',
        mel: 'G5:4 A5:4 B5:8 | A5:4 G5:4 E5:8 | D5:4 E5:4 G5:8 | A5:4 B5:2 A5:2 F#5:8 | E5:2 G5:2 B5:4 A5:2 G5:2 E5:4 | G5:2 A5:2 C6:4 B5:2 A5:2 G5:4 | A5:4 G5:4 E5:4 D5:4 | D5:8 F#5:4 A5:4',
        pat: { taiko: 'X...x...X...x.x.' },
      },
    },
    order: ['A', 'B', 'A'],
  },

  // 霧の湖：静かで神秘的（ホ短調・ハープとフルート）
  lake: {
    name: '霧の湖', bpm: 72,
    parts: {
      flute:  { kind: 'mel', inst: 'flute', vol: 0.95, rev: 0.55 },
      reed:   { kind: 'mel', inst: 'reed', vol: 0.85, rev: 0.55, pan: -0.1 },
      harp:   { kind: 'arp', inst: 'harp', oct: 3, pat: '0.1.2.3.4.3.2.1.', len: 4, vol: 0.6, pan: -0.25, rev: 0.5 },
      bell:   { kind: 'arp', inst: 'bell', oct: 5, pat: '......2.......4.', len: 2, vol: 0.35, pan: 0.4, rev: 0.6 },
      pad:    { kind: 'arp', inst: 'pad', oct: 4, pat: 'c...............', hold: true, vol: 0.55, rev: 0.6 },
      bass:   { kind: 'bass', inst: 'bass', oct: 2, pat: 'R...............', hold: true, vol: 0.6 },
      timp:   { kind: 'drum', inst: 'timpani', f: 82, pat: 'g...............', vol: 0.5, rev: 0.4 },
      shaker: { kind: 'drum', inst: 'shaker', pat: '........g.......', vol: 0.5, pan: 0.3 },
    },
    sections: {
      A: {
        melPart: 'flute', chords: 'Emadd9 Cmaj7 G D/F# Emadd9 Cmaj7 Am7 B7',
        mel: 'B4:8 E5:4 F#5:4 | G5:8 E5:8 | D5:8 B4:4 D5:4 | A4:16 | B4:8 E5:4 G5:4 | B5:8 G5:8 | A5:4 G5:4 E5:4 C5:4 | D#5:16',
        pat: { bell: null },
      },
      B: {
        melPart: 'reed', chords: 'Cmaj7 G Am7 Emadd9 Cmaj7 D Bm7 B7',
        mel: 'E5:8 G5:8 | D5:8 B4:8 | C5:8 E5:8 | B4:16 | G5:8 E5:4 G5:4 | F#5:8 A5:8 | D5:8 F#5:8 | D#5:8 B4:8',
      },
    },
    order: ['A', 'B'],
  },
});

// ---------- ボス戦：1つのテーマを、章ごとに調・楽器・リズムを変えてアレンジ ----------

const BOSS_THEME = {
  A: {
    chords: 'Am Am F G Am Am F E',
    mel: 'A4:2 A4:1 A4:1 C5:2 A4:2 E5:4 D5:2 C5:2 | B4:2 C5:2 D5:2 B4:2 A4:8 | F5:2 F5:1 F5:1 E5:2 D5:2 C5:4 A4:4 | B4:4 D5:4 G5:8 | A5:2 A5:1 A5:1 G5:2 E5:2 C6:4 B5:2 A5:2 | G5:2 E5:2 C5:2 E5:2 A5:8 | F5:4 E5:4 D5:4 C5:4 | B4:4 G#4:4 E4:4 G#4:4',
  },
  B: {
    chords: 'Dm Dm Am Am F G E E7',
    mel: 'D5:8 F5:4 A5:4 | G5:8 F5:4 E5:4 | E5:8 A5:4 C6:4 | B5:8 A5:4 G5:4 | A5:6 G5:2 F5:4 C5:4 | D5:6 E5:2 G5:4 B5:4 | G#5:8 B5:4 E6:4 | D6:4 B5:4 G#5:4 E5:4',
  },
};
function makeBoss(name, { bpm, transpose, parts, patA = {}, patB = {}, leadB = 'lead2' }) {
  return {
    name, bpm, transpose, parts,
    sections: {
      A: { melPart: 'lead', ...BOSS_THEME.A, pat: patA },
      B: { melPart: leadB, ...BOSS_THEME.B, pat: patB },
    },
    order: ['A', 'B', 'A'],
  };
}

Object.assign(MUSIC, {
  // 1章 はじまりの草原：ロック風（イ短調）
  boss1: makeBoss('ボス戦（1章）', {
    bpm: 150, transpose: 0,
    parts: {
      lead:  { kind: 'mel', inst: 'brass', vol: 1, rev: 0.2 },
      lead2: { kind: 'mel', inst: 'flute', vol: 1.1, rev: 0.25 },
      gtr:   { kind: 'arp', inst: 'pluck', oct: 3, pat: '0.0.4.0.0.0.4.0.', len: 1, vol: 0.9, pan: -0.3 },
      bass:  { kind: 'bass', inst: 'growl', oct: 2, pat: 'R.R.R.R.R.R.R.O.', len: 1, vol: 0.9 },
      kick:  { kind: 'drum', inst: 'kick', pat: 'X.....x.x.x.....', vol: 1 },
      snare: { kind: 'drum', inst: 'snare', pat: '....X.......X...', vol: 0.9 },
      hat:   { kind: 'drum', inst: 'hat', pat: 'x.x.x.x.x.x.x.x.', vol: 0.9, pan: 0.3 },
      crash: { kind: 'drum', inst: 'crash', pat: patOnce('x', 8), vol: 0.8 },
    },
    patB: { gtr: 'c.......c...c...' },
  }),
  // 2章 霧の湖：妖しく速い（嬰ヘ短調・ハープとうねるベース）
  boss2: makeBoss('ボス戦（2章）', {
    bpm: 148, transpose: -3,
    parts: {
      lead:  { kind: 'mel', inst: 'reed', vol: 1.1, rev: 0.4 },
      lead2: { kind: 'mel', inst: 'brass', vol: 0.9, rev: 0.4 },
      harp:  { kind: 'arp', inst: 'harp', oct: 4, pat: '0123012301230123', len: 2, vol: 0.55, pan: -0.3, rev: 0.4 },
      choir: { kind: 'arp', inst: 'choir', oct: 4, pat: 'c...............', hold: true, vol: 0.7, rev: 0.6 },
      bass:  { kind: 'bass', inst: 'wobble', oct: 2, pat: 'R..R..R.R..R..R.', len: 2, vol: 0.9 },
      kick:  { kind: 'drum', inst: 'kick', pat: 'X..x..x.X..x..x.', vol: 0.9 },
      tom:   { kind: 'drum', inst: 'tom', f: 140, pat: '....x.......x.xx', vol: 0.7, pan: 0.2 },
      shaker:{ kind: 'drum', inst: 'shaker', pat: 'xxxxxxxxxxxxxxxx', vol: 0.6, pan: 0.35 },
    },
    patA: { choir: null },
  }),
  // 3章 茨の森：部族の太鼓（ニ短調・和太鼓とタム）
  boss3: makeBoss('ボス戦（3章）', {
    bpm: 152, transpose: -7,
    parts: {
      lead:  { kind: 'mel', inst: 'flute', vol: 1.2, rev: 0.3 },
      lead2: { kind: 'mel', inst: 'brass', vol: 0.95, rev: 0.3 },
      pluck: { kind: 'arp', inst: 'pluck', oct: 4, pat: '0.2.0.2.1.2.0.2.', len: 1, vol: 0.7, pan: 0.3 },
      bass:  { kind: 'bass', inst: 'growl', oct: 2, pat: 'R...R.R.R...R.5.', len: 2, vol: 0.9 },
      taiko: { kind: 'drum', inst: 'taiko', pat: 'X..x..X.X..x..x.', vol: 1 },
      tom:   { kind: 'drum', inst: 'tom', f: 170, pat: '..x...x...x.x.xx', vol: 0.8, pan: -0.3 },
      rim:   { kind: 'drum', inst: 'rim', pat: 'x.x.x.x.x.x.x.x.', vol: 0.9, pan: 0.35 },
      crash: { kind: 'drum', inst: 'crash', pat: patOnce('x', 8), vol: 0.7 },
    },
  }),
  // 4章 天空の砦：壮大（ホ短調・ブラスとストリングス、ティンパニ）
  boss4: makeBoss('ボス戦（4章）', {
    bpm: 156, transpose: -5,
    parts: {
      lead:  { kind: 'mel', inst: 'brass', vol: 1.05, rev: 0.35 },
      lead2: { kind: 'mel', inst: 'brass', vol: 1.05, rev: 0.35, shift: 12 },
      str:   { kind: 'arp', inst: 'pad', oct: 4, pat: 'c.c.c.c.c.c.c.c.', len: 2, vol: 0.8, rev: 0.4 },
      harp:  { kind: 'arp', inst: 'harp', oct: 5, pat: '0123456765432101', len: 2, vol: 0.4, pan: -0.3, rev: 0.4 },
      bass:  { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.R.R.R.R.R.R.R.', len: 1, vol: 1 },
      timp:  { kind: 'drum', inst: 'timpani', f: 82, pat: 'X.......x...x.x.', vol: 1, rev: 0.3 },
      snare: { kind: 'drum', inst: 'snare', pat: '....x..g....x.gg', vol: 0.8 },
      crash: { kind: 'drum', inst: 'crash', pat: patOnce('x', 4), vol: 0.8, rev: 0.3 },
    },
    patA: { harp: null },
  }),
  // 5章 混沌の城：最終決戦（ヘ短調・オルガンと声、重い太鼓）
  boss5: makeBoss('ボス戦（5章）', {
    bpm: 160, transpose: -4,
    parts: {
      lead:  { kind: 'mel', inst: 'organ', vol: 1.3, rev: 0.45 },
      lead2: { kind: 'mel', inst: 'brass', vol: 1, rev: 0.4 },
      choir: { kind: 'arp', inst: 'choir', oct: 4, pat: 'c...............', hold: true, vol: 0.9, rev: 0.6 },
      organ: { kind: 'arp', inst: 'organ', oct: 3, pat: 'c.c...c.c...c.c.', len: 1, vol: 0.6, pan: -0.25, rev: 0.4 },
      bass:  { kind: 'bass', inst: 'growl', oct: 2, pat: 'RRR.RRR.RRR.R.O.', len: 1, vol: 0.9 },
      kick:  { kind: 'drum', inst: 'kick', pat: 'XxXxX.xxXxXxX.xx', vol: 0.8 },
      taiko: { kind: 'drum', inst: 'taiko', pat: 'X.......X.......', vol: 1 },
      snare: { kind: 'drum', inst: 'snare', pat: '....X.......X...', vol: 0.9 },
      crash: { kind: 'drum', inst: 'crash', pat: patOnce('x', 4), vol: 0.8, rev: 0.4 },
    },
    patA: { choir: null },
  }),
});

// ---------- 戦況で足すパート（対戦の曲すべて） ----------
//   tension：消耗ダメージが始まったら（ターン27以降）、低い太鼓と刻みを重ねる
//   climax：どちらかの残りモンスターが少なくなったら、ブラスの和音とスネアの連打を重ねる
function addBattleLayers(song, o = {}) {
  Object.assign(song.parts, {
    tTaiko: { kind: 'drum', inst: 'taiko', pat: o.tension || 'X.......X...x...', vol: 0.85, layer: 'tension' },
    tPulse: { kind: 'bass', inst: 'growl', oct: 2, pat: 'R.R.R.R.R.R.R.R.', len: 1, vol: 0.4, layer: 'tension' },
    cBrass: { kind: 'arp', inst: 'brass', oct: 4, pat: o.stab || 'c.....c.....c.c.', len: 2, vol: 0.5, rev: 0.25, layer: 'climax' },
    cSnare: { kind: 'drum', inst: 'snare', pat: o.roll || '....x.......x.xx', vol: 0.55, layer: 'climax' },
    cCrash: { kind: 'drum', inst: 'crash', pat: patOnce('x', 4), vol: 0.55, layer: 'climax' },
  });
  return song;
}
for (const id of ['plain', 'forest', 'volcano', 'sky', 'swamp', 'castle', 'lake', 'event', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5']) {
  addBattleLayers(MUSIC[id], { slow: MUSIC[id].bpm < 90 });
}

// ---------- ジングル・ファンファーレ（ループしない、数秒の曲） ----------

Object.assign(MUSIC, {
  // 勝利：メインテーマの出だしを使ったファンファーレ（ニ長調）
  win: {
    name: '勝利', bpm: 132, jingle: true,
    parts: {
      lead:  { kind: 'mel', inst: 'brass', vol: 1.1, rev: 0.35 },
      pad:   { kind: 'arp', inst: 'pad', oct: 4, pat: 'c.......c.......', hold: true, vol: 0.9, rev: 0.4 },
      bass:  { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.......R.......', len: 8, vol: 1 },
      timp:  { kind: 'drum', inst: 'timpani', f: 73, pat: 'x.......x.......X...x.x.........', vol: 1, rev: 0.3 },
      crash: { kind: 'drum', inst: 'crash', pat: '................x...............', vol: 0.9, rev: 0.3 },
    },
    sections: { A: { melPart: 'lead', chords: 'D,A D', mel: 'A4:2 D5:2 F#5:2 A5:2 G5:2 E5:2 C#5:2 E5:2 | D5:2 F#5:2 A5:2 D6:10' } },
    order: ['A'],
  },
  // 敗北：沈んでいく短調
  lose: {
    name: '敗北', bpm: 96, jingle: true,
    parts: {
      lead:  { kind: 'mel', inst: 'reed', vol: 1.1, rev: 0.45 },
      pad:   { kind: 'arp', inst: 'pad', oct: 3, pat: 'c.......c.......', hold: true, vol: 0.9, rev: 0.5 },
      bass:  { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.......R.......', len: 8, vol: 0.9 },
      timp:  { kind: 'drum', inst: 'timpani', f: 73, pat: '................x...............', vol: 0.8, rev: 0.4 },
    },
    sections: { A: { melPart: 'lead', chords: 'Gm,A Dm', mel: 'A4:4 G4:4 F4:4 E4:4 | D4:16' } },
    order: ['A'],
  },
  // エピックが出た：短いファンファーレ
  fanfareEpic: {
    name: 'ファンファーレ（エピック）', bpm: 140, jingle: true,
    parts: {
      lead:  { kind: 'mel', inst: 'brass', vol: 1.1, rev: 0.35 },
      pad:   { kind: 'arp', inst: 'pad', oct: 4, pat: 'c...............', hold: true, vol: 0.8, rev: 0.4 },
      timp:  { kind: 'drum', inst: 'timpani', f: 73, pat: 'x.......x.x.....', vol: 0.9 },
      crash: { kind: 'drum', inst: 'crash', pat: '........x.......', vol: 0.7 },
    },
    sections: { A: { melPart: 'lead', chords: 'D', mel: 'D5:2 F#5:2 A5:4 D6:8' } },
    order: ['A'],
  },
  // レジェンドが出た：特別なファンファーレ（♭VI → ♭VII → I で大きく開ける）
  fanfareLegend: {
    name: 'ファンファーレ（レジェンド）', bpm: 120, jingle: true,
    parts: {
      lead:  { kind: 'mel', inst: 'brass', vol: 1.15, rev: 0.4 },
      bell:  { kind: 'arp', inst: 'bell', oct: 5, pat: '................0123456789......', len: 2, vol: 0.6, pan: 0.3, rev: 0.6 },
      pad:   { kind: 'arp', inst: 'pad', oct: 4, pat: 'c.......c.......c...............', hold: true, vol: 0.9, rev: 0.5 },
      bass:  { kind: 'bass', inst: 'bass', oct: 2, pat: 'R.......R.......R...............', hold: true, vol: 1 },
      timp:  { kind: 'drum', inst: 'timpani', f: 73, pat: 'x.x.x.x.xxxxxxxxX...............', vol: 0.9, rev: 0.3 },
      crash: { kind: 'drum', inst: 'crash', pat: '................x...............', vol: 1, rev: 0.4 },
    },
    sections: { A: { melPart: 'lead', chords: 'Bb,C D', mel: 'D5:2 F5:2 Bb5:4 E5:2 G5:2 C6:4 | D6:16' } },
    order: ['A'],
  },
});

// 試聴画面に並べる順
const MUSIC_LIST = [
  ['home', 'ホーム'], ['deck', 'デッキ'], ['pack', 'パック開封'], ['dungeon', 'ダンジョン'], ['puzzle', 'パズル'], ['event', 'イベント'],
  ['plain', '平原'], ['forest', '森'], ['volcano', '火山'], ['sky', '天空'], ['swamp', '毒沼'], ['castle', '古城'], ['lake', '霧の湖'],
  ['boss1', 'ボス 1章'], ['boss2', 'ボス 2章'], ['boss3', 'ボス 3章'], ['boss4', 'ボス 4章'], ['boss5', 'ボス 5章'],
];
const JINGLE_LIST = [['win', '勝利'], ['lose', '敗北'], ['fanfareEpic', 'エピック'], ['fanfareLegend', 'レジェンド']];
