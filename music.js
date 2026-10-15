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

// 試聴画面に並べる順
const MUSIC_LIST = [
  ['home', 'ホーム'], ['plain', '平原'], ['forest', '森'], ['volcano', '火山'], ['sky', '天空'], ['swamp', '毒沼'], ['castle', '古城'],
];
