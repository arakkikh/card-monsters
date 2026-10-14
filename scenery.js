// ============================================================
// 対戦画面の背景と、画面で使う小さなアイコン（すべてSVGとCSSで描いたオリジナル）
// ============================================================

// 上部表示などで使うアイコン
const ICON = {
  // クリスタル（宝石）
  gem: '<svg class="ico gem" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,1 21,8 12,23 3,8" fill="#38bdf8"/><polygon points="12,1 21,8 12,9" fill="#bae6fd"/><polygon points="12,1 3,8 12,9" fill="#7dd3fc"/><polygon points="3,8 12,9 12,23" fill="#0ea5e9"/><polygon points="21,8 12,9 12,23" fill="#0369a1"/></svg>',
  // 手札
  hand: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="10" height="14" rx="2" fill="#64748b" transform="rotate(-12 8 13)"/><rect x="9" y="4" width="10" height="14" rx="2" fill="#cbd5e1" transform="rotate(10 14 11)"/></svg>',
  // 山札
  deck: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="9" width="14" height="12" rx="2" fill="#475569"/><rect x="5" y="6" width="14" height="12" rx="2" fill="#64748b"/><rect x="5" y="3" width="14" height="12" rx="2" fill="#cbd5e1"/></svg>',
  // 効果音のオン・オフ
  sound: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9 H8 L14 4 V20 L8 15 H3Z" fill="#e2e8f0"/><path d="M17 8 Q20 12 17 16 M19.5 5.5 Q24 12 19.5 18.5" fill="none" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round"/></svg>',
  muted: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9 H8 L14 4 V20 L8 15 H3Z" fill="#94a3b8"/><path d="M17 8.5 L23 15.5 M23 8.5 L17 15.5" stroke="#f87171" stroke-width="2.2" stroke-linecap="round"/></svg>',
  // ステータス
  heart: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 C2 13 2 6 7 4.5 C10 3.6 12 6.5 12 6.5 C12 6.5 14 3.6 17 4.5 C22 6 22 13 12 21Z" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.2"/><path d="M7.5 7 q2 -1.6 3.4 .6" stroke="#fecaca" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
  shield: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 H20 V12 Q20 18 12 22 Q4 18 4 12Z" fill="#94a3b8" stroke="#1e293b" stroke-width="1.2"/><path d="M12 5.2 V20.4 Q5.4 17 5.4 12 V5.2Z" fill="#e2e8f0"/></svg>',
  // 攻撃タイプ
  melee: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 14 L17 2.5 L22 2 L21.5 7 L10 17.5Z" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.5 12 L12 19.5" stroke="#f59e0b" stroke-width="3.2" stroke-linecap="round"/><path d="M7.5 16.5 L3 21" stroke="#92400e" stroke-width="3.4" stroke-linecap="round"/></svg>',
  ranged: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2 Q21 12 7 22" fill="none" stroke="#b45309" stroke-width="2.6" stroke-linecap="round"/><path d="M7 2 V22" stroke="#f1f5f9" stroke-width="1"/><path d="M3 12 H18" stroke="#cbd5e1" stroke-width="1.8"/><path d="M17 8.5 L23 12 L17 15.5Z" fill="#e2e8f0" stroke="#1e293b" stroke-width=".8"/></svg>',
  magic: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="#8b5cf6" stroke="#2e1065" stroke-width="1.2"/><ellipse cx="9" cy="8.6" rx="3.4" ry="2.2" fill="#fff" opacity=".75"/><path d="M12 1 v3 M12 20 v3 M1 12 h3 M20 12 h3" stroke="#ddd6fe" stroke-width="1.6" stroke-linecap="round"/></svg>',
  chaos: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12 q3 -5 7 -1 q2 6 -5 8 q-9 1 -9 -8 q1 -9 11 -8" fill="none" stroke="#d946ef" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="12" r="1.8" fill="#fae8ff"/></svg>',
  // 残りモンスター
  monster: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9 L2 3 L8 6 Q12 4 16 6 L22 3 L20 9 Q21 12 20 15 Q18 21 12 21 Q6 21 4 15 Q3 12 4 9Z" fill="#c4b5fd"/><circle cx="9" cy="12" r="2" fill="#1e1b4b"/><circle cx="15" cy="12" r="2" fill="#1e1b4b"/><path d="M9 17 L11 15.5 L12 17 L13 15.5 L15 17" stroke="#1e1b4b" stroke-width="1.4" fill="none"/></svg>',
};

// 章ごとの背景。free はフリー対戦の闘技場
const SCENE_OF_CHAPTER = { 1: 'meadow', 2: 'lake', 3: 'forest', 4: 'sky', 5: 'castle' };

// 背景の絵（viewBox 400x800、画面いっぱいに切り抜いて表示する）。地平線は y=400 あたり
const SCENES = {
  // 1章 はじまりの草原：夕暮れの丘
  meadow: {
    tint: '#34d399',
    svg: `
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1d3a"/><stop offset=".42" stop-color="#1f6f6b"/><stop offset=".5" stop-color="#e0a84a"/><stop offset=".52" stop-color="#14532d"/><stop offset="1" stop-color="#052e16"/></linearGradient>
        <radialGradient id="sc-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff7d6"/><stop offset=".4" stop-color="#fbbf24" stop-opacity=".7"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#sc-sky)"/>
      <circle cx="290" cy="380" r="120" fill="url(#sc-sun)"/>
      <path d="M0 400 Q60 340 130 380 T260 360 T400 390 V430 H0Z" fill="#1c5a4a"/>
      <path d="M0 420 Q90 370 180 410 T400 400 V470 H0Z" fill="#166534"/>
      <path d="M0 450 Q120 420 220 446 T400 440 V800 H0Z" fill="#14532d"/>
      <g fill="#0d3b22"><path d="M40 452 l6 -30 l6 30z"/><path d="M52 454 l5 -22 l5 22z"/><path d="M330 446 l6 -28 l6 28z"/><path d="M344 448 l5 -20 l5 20z"/><path d="M190 448 l4 -16 l4 16z"/></g>
      <g fill="#fde68a" opacity=".8"><circle cx="60" cy="90" r="1.5"/><circle cx="150" cy="50" r="1.2"/><circle cx="240" cy="110" r="1.4"/><circle cx="340" cy="70" r="1.6"/><circle cx="110" cy="160" r="1"/></g>`,
  },
  // 2章 霧の湖：山と湖面
  lake: {
    tint: '#60a5fa',
    svg: `
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1430"/><stop offset=".45" stop-color="#3b5b8c"/><stop offset=".5" stop-color="#9fb8d8"/><stop offset=".52" stop-color="#1e3a5f"/><stop offset="1" stop-color="#06122a"/></linearGradient>
      </defs>
      <rect width="400" height="800" fill="url(#sc-sky)"/>
      <circle cx="110" cy="150" r="34" fill="#e2e8f0" opacity=".85"/><circle cx="122" cy="142" r="30" fill="#3b5b8c" opacity=".55"/>
      <path d="M0 400 L70 290 L120 350 L190 250 L260 360 L320 300 L400 400Z" fill="#1e2f52"/>
      <path d="M0 400 L50 340 L110 390 L170 330 L240 395 L300 350 L400 400Z" fill="#16233f"/>
      <g stroke="#cfe3ff" stroke-width="2" opacity=".35" stroke-linecap="round"><path d="M40 440 H160"/><path d="M220 460 H360"/><path d="M90 500 H210"/><path d="M250 540 H340"/><path d="M30 580 H140"/><path d="M190 630 H330"/></g>
      <path d="M0 408 L70 500 L120 446 L190 540 L260 440 L320 492 L400 408Z" fill="#0e1b33" opacity=".5"/>`,
  },
  // 3章 茨の森：暗い森とトゲのツタ
  forest: {
    tint: '#4ade80',
    svg: `
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020d07"/><stop offset=".5" stop-color="#0f3d24"/><stop offset="1" stop-color="#03130a"/></linearGradient>
        <radialGradient id="sc-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#bbf7d0" stop-opacity=".55"/><stop offset="1" stop-color="#22c55e" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#sc-sky)"/>
      <ellipse cx="200" cy="400" rx="190" ry="150" fill="url(#sc-sun)"/>
      <g fill="#04170c"><path d="M-10 0 H60 Q40 260 70 800 H-10Z"/><path d="M340 0 H410 V800 H330 Q362 300 340 0Z"/><path d="M96 0 h26 q-10 240 6 420 h-36 q14 -200 4 -420z" opacity=".8"/><path d="M280 0 h24 q-8 220 8 400 h-34 q12 -180 2 -400z" opacity=".8"/></g>
      <g fill="#062313"><ellipse cx="60" cy="30" rx="120" ry="70"/><ellipse cx="340" cy="20" rx="130" ry="80"/><ellipse cx="200" cy="-10" rx="150" ry="60"/></g>
      <g fill="none" stroke="#14532d" stroke-width="5" stroke-linecap="round"><path d="M0 520 Q110 470 200 530 T400 500"/><path d="M0 250 Q90 300 170 250 T400 290"/></g>
      <g fill="#166534"><path d="M60 498 l8 -18 l6 20z"/><path d="M150 506 l6 -20 l8 18z"/><path d="M250 520 l8 -18 l6 20z"/><path d="M340 506 l6 -20 l8 18z"/><path d="M90 276 l6 18 l8 -16z"/><path d="M230 268 l6 18 l8 -16z"/><path d="M330 284 l6 18 l8 -16z"/></g>
      <g fill="#bbf7d0"><circle cx="120" cy="360" r="2"/><circle cx="290" cy="430" r="1.6"/><circle cx="210" cy="330" r="1.4"/><circle cx="170" cy="470" r="1.8"/></g>`,
  },
  // 4章 天空の砦：雲の上に浮かぶ砦
  sky: {
    tint: '#fbbf24',
    svg: `
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1b4d"/><stop offset=".4" stop-color="#3d6fd1"/><stop offset=".55" stop-color="#f4c56a"/><stop offset=".75" stop-color="#7c5a9e"/><stop offset="1" stop-color="#1b1640"/></linearGradient>
      </defs>
      <rect width="400" height="800" fill="url(#sc-sky)"/>
      <g fill="#fff7d6" opacity=".16"><path d="M200 420 L40 0 H110Z"/><path d="M200 420 L170 0 H240Z"/><path d="M200 420 L300 0 H370Z"/></g>
      <g fill="#1e2a5e"><path d="M150 330 h100 l-18 46 h-64z"/><rect x="160" y="262" width="80" height="70"/><rect x="148" y="236" width="22" height="96"/><rect x="230" y="236" width="22" height="96"/><path d="M144 236 l15 -30 l15 30z"/><path d="M226 236 l15 -30 l15 30z"/><rect x="190" y="226" width="20" height="40"/><path d="M186 226 l14 -34 l14 34z"/></g>
      <g fill="#fde68a"><rect x="174" y="282" width="8" height="14"/><rect x="218" y="282" width="8" height="14"/><rect x="196" y="300" width="8" height="18"/></g>
      <g fill="#fff" opacity=".85"><ellipse cx="70" cy="420" rx="110" ry="30"/><ellipse cx="330" cy="430" rx="120" ry="34"/><ellipse cx="200" cy="452" rx="150" ry="36"/></g>
      <g fill="#e9d5ff" opacity=".5"><ellipse cx="90" cy="600" rx="130" ry="26"/><ellipse cx="320" cy="680" rx="140" ry="28"/></g>`,
  },
  // 5章 混沌の城：赤い月と城
  castle: {
    tint: '#e879f9',
    svg: `
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12041f"/><stop offset=".4" stop-color="#4a0d3a"/><stop offset=".5" stop-color="#a1263f"/><stop offset=".53" stop-color="#1a0720"/><stop offset="1" stop-color="#09030f"/></linearGradient>
        <radialGradient id="sc-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fecaca"/><stop offset=".45" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#sc-sky)"/>
      <circle cx="300" cy="190" r="74" fill="url(#sc-sun)"/>
      <g fill="#0d0414"><rect x="120" y="270" width="160" height="140"/><rect x="96" y="220" width="40" height="190"/><rect x="264" y="220" width="40" height="190"/><path d="M90 220 l26 -62 l26 62z"/><path d="M258 220 l26 -62 l26 62z"/><rect x="180" y="180" width="40" height="100"/><path d="M172 180 l28 -76 l28 76z"/><path d="M120 270 h14 v-14 h14 v14 h14 v-14 h14 v14 h14 v-14 h14 v14 h14 v-14 h14 v14 h14 v-14 h14 v14 h20z"/></g>
      <g fill="#f87171"><rect x="110" y="270" width="8" height="16"/><rect x="278" y="270" width="8" height="16"/><path d="M190 410 v-44 q10 -16 20 0 v44z"/><circle cx="200" cy="220" r="5"/></g>
      <path d="M0 410 L40 392 L70 408 L110 396 L160 410 L240 410 L290 396 L330 408 L370 392 L400 410 V800 H0Z" fill="#12061a"/>
      <g stroke="#f0abfc" stroke-width="2" fill="none" opacity=".5"><path d="M60 40 l14 40 l-10 6 l16 50"/><path d="M340 60 l-10 30 l8 6 l-12 40"/></g>`,
  },
  // 火山：溶岩の流れる山
  volcano: {
    tint: '#fb923c',
    svg: `
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c0a05"/><stop offset=".45" stop-color="#7c2d12"/><stop offset="1" stop-color="#150604"/></linearGradient>
        <radialGradient id="sc-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fde68a" stop-opacity=".9"/><stop offset="1" stop-color="#ea580c" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#sc-sky)"/>
      <circle cx="200" cy="150" r="110" fill="url(#sc-sun)"/>
      <path d="M40 420 L150 170 L176 150 L200 164 L224 150 L250 170 L360 420Z" fill="#1f0d08"/>
      <path d="M176 150 L200 164 L224 150 L214 230 L226 300 L204 380 L196 300 L184 240Z" fill="#f97316"/>
      <path d="M190 164 L200 170 L210 164 L206 236 L212 292 L202 350 L197 290 L192 240Z" fill="#fde047"/>
      <g fill="#431407" opacity=".85"><ellipse cx="150" cy="96" rx="60" ry="22"/><ellipse cx="240" cy="70" rx="74" ry="26"/><ellipse cx="196" cy="40" rx="50" ry="18"/></g>
      <path d="M0 430 L50 400 L110 424 L170 404 L240 426 L300 402 L360 422 L400 406 V800 H0Z" fill="#170806"/>
      <g stroke="#f97316" stroke-width="5" fill="none" opacity=".75" stroke-linecap="round"><path d="M30 640 q40 -30 70 0 t70 0"/><path d="M230 700 q40 -30 70 0 t70 0"/><path d="M120 560 q30 -20 56 0"/></g>
      <g fill="#fdba74" opacity=".8"><circle cx="90" cy="300" r="3"/><circle cx="310" cy="260" r="2.5"/><circle cx="270" cy="120" r="3"/><circle cx="120" cy="140" r="2"/><circle cx="330" cy="520" r="3"/><circle cx="60" cy="520" r="2.5"/></g>`,
  },
  // 毒沼：泡の立つ沼と枯れ木
  swamp: {
    tint: '#a3e635',
    svg: `
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1208"/><stop offset=".5" stop-color="#2c3b12"/><stop offset="1" stop-color="#080d06"/></linearGradient>
        <radialGradient id="sc-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d9f99d" stop-opacity=".55"/><stop offset="1" stop-color="#65a30d" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#sc-sky)"/>
      <circle cx="110" cy="150" r="80" fill="url(#sc-sun)"/>
      <g stroke="#0c1408" stroke-width="12" fill="none" stroke-linecap="round"><path d="M70 420 V250 M70 310 l-34 -40 M70 280 l30 -44 M70 340 l40 -20"/><path d="M330 420 V220 M330 300 l36 -46 M330 260 l-32 -36 M330 340 l-42 -24"/></g>
      <path d="M0 420 Q100 396 200 418 T400 410 V800 H0Z" fill="#0f1a0a"/>
      <g fill="#3f6212" opacity=".7"><ellipse cx="120" cy="520" rx="110" ry="26"/><ellipse cx="290" cy="620" rx="120" ry="28"/><ellipse cx="150" cy="720" rx="130" ry="26"/></g>
      <g fill="none" stroke="#bef264" stroke-width="2.5" opacity=".75"><circle cx="100" cy="512" r="9"/><circle cx="150" cy="526" r="5"/><circle cx="300" cy="612" r="11"/><circle cx="250" cy="626" r="6"/><circle cx="170" cy="716" r="8"/><circle cx="90" cy="724" r="5"/></g>
      <g fill="#84cc16" opacity=".5"><path d="M20 420 l8 -40 l8 40z"/><path d="M44 420 l6 -30 l6 30z"/><path d="M360 414 l8 -44 l8 44z"/><path d="M230 418 l6 -32 l6 32z"/></g>`,
  },
  // フリー対戦：石柱の闘技場
  arena: {
    tint: '#818cf8',
    svg: `
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1024"/><stop offset=".5" stop-color="#27305e"/><stop offset="1" stop-color="#090c1c"/></linearGradient>
        <radialGradient id="sc-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#c7d2fe" stop-opacity=".5"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#sc-sky)"/>
      <ellipse cx="200" cy="400" rx="200" ry="170" fill="url(#sc-sun)"/>
      <g fill="#141a3a"><rect x="20" y="120" width="40" height="560"/><rect x="340" y="120" width="40" height="560"/><rect x="10" y="100" width="60" height="26"/><rect x="330" y="100" width="60" height="26"/><rect x="10" y="674" width="60" height="26"/><rect x="330" y="674" width="60" height="26"/></g>
      <g fill="#1b2350"><rect x="96" y="200" width="26" height="400" opacity=".7"/><rect x="278" y="200" width="26" height="400" opacity=".7"/></g>
      <g fill="#4338ca" opacity=".6"><path d="M150 60 h100 v90 l-50 26 l-50 -26z"/></g>
      <g fill="#c7d2fe" opacity=".7"><path d="M200 84 l10 22 l24 2 l-18 16 l6 24 l-22 -13 l-22 13 l6 -24 l-18 -16 l24 -2z"/></g>`,
  },
};

// 背景のHTML。動く霧と光は CSS のアニメーション（2枚だけ動かす）
function sceneHtml(name) {
  const scene = SCENES[name] || SCENES.arena;
  return `<div class="scene scene-${name}" style="--tint:${scene.tint}">
    <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${scene.svg}</svg>
    <div class="scene-glow"></div>
    <div class="scene-fog"></div>
    <div class="scene-shade"></div>
  </div>`;
}

// いまの対戦に合う背景の名前
function sceneNameFor(mode, terrain) {
  if (terrain) return terrain.scene; // 地形があれば、地形に合わせた背景
  return mode && mode.type === 'stage' ? SCENE_OF_CHAPTER[mode.stage.chapter] : 'arena';
}
