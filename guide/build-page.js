// ============================================================
// 攻略本のページ全体（見た目・目次・検索・印刷用レイアウト）を組み立てて書き出す
// ============================================================

const GUIDE_CSS = `
:root { --bg: #0b0f1e; --panel: #151b30; --line: #2c3557; --text: #e8ecf8; --dim: #a3acc9; --gold: #fbbf24; --accent: #7c5cff;
  --red: #ef4444; --blue: #3b82f6; --green: #22c55e; --yellow: #eab308; --purple: #a855f7; --none: #94a3b8; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 64px; }
body { margin: 0; background: radial-gradient(120% 70% at 50% 0%, #1b1740 0%, var(--bg) 60%); background-attachment: fixed; color: var(--text); font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; font-size: 15px; line-height: 1.75; }
a { color: #93c5fd; text-decoration: none; } a:hover { text-decoration: underline; }
.wrap { display: grid; grid-template-columns: 250px minmax(0, 1fr); max-width: 1180px; margin: 0 auto; }
nav.toc { position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto; padding: 16px 12px; border-right: 1px solid var(--line); background: rgba(11, 15, 30, 0.9); }
nav.toc h1 { font-size: 17px; margin: 0 0 4px; font-style: italic; background: linear-gradient(#fff7c2, #fbbf24 55%, #f97316); -webkit-background-clip: text; background-clip: text; color: transparent; }
nav.toc .sub { font-size: 11px; color: var(--dim); margin-bottom: 10px; }
nav.toc ol { list-style: none; margin: 10px 0 0; padding: 0; }
nav.toc li a { display: block; padding: 6px 8px; border-radius: 8px; color: var(--text); font-size: 13.5px; }
nav.toc li a:hover { background: var(--panel); text-decoration: none; }
.search { position: relative; }
.search input { width: 100%; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--accent); background: #0a0d1a; color: var(--text); font-size: 15px; }
#hits { position: absolute; left: 0; right: 0; top: 42px; z-index: 30; max-height: 60vh; overflow-y: auto; background: #0a0d1a; border: 1px solid var(--accent); border-radius: 10px; display: none; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); }
#hits.show { display: block; }
#hits a { display: flex; justify-content: space-between; gap: 8px; padding: 7px 10px; color: var(--text); border-bottom: 1px solid var(--line); font-size: 13px; }
#hits a small { color: var(--dim); white-space: nowrap; }
#hits .none { padding: 8px 10px; color: var(--dim); font-size: 13px; }
main { padding: 8px 22px 80px; min-width: 0; }
section.chap { padding-top: 14px; }
h2 { font-size: 24px; margin: 22px 0 10px; padding: 8px 14px; border-radius: 12px; background: linear-gradient(90deg, #3b2a7a, rgba(59, 42, 122, 0)); border-left: 5px solid var(--gold); }
h3 { font-size: 18px; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 2px solid var(--line); color: #ffe9a8; }
h4 { font-size: 15px; margin: 18px 0 6px; color: #c4b5fd; }
h4 small { font-weight: 400; color: var(--dim); margin-left: 8px; font-size: 12px; }
p { margin: 8px 0; } ul, ol { margin: 6px 0; padding-left: 22px; } li { margin: 3px 0; }
.note { color: var(--dim); font-size: 13px; border-left: 3px solid var(--line); padding-left: 10px; }
.src { display: inline-block; font-size: 11.5px; color: #86efac; background: rgba(21, 128, 61, 0.18); border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 999px; padding: 0 9px; line-height: 1.7; }
code { background: #0a0d1a; border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; font-size: 12.5px; word-break: break-all; }
.code code { display: block; padding: 8px; user-select: all; }
.tw { overflow-x: auto; margin: 8px 0; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { border: 1px solid var(--line); padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #1d2547; white-space: nowrap; }
tr:nth-child(even) td { background: rgba(255, 255, 255, 0.025); }
table.lv { font-size: 12.5px; } table.stg { font-size: 12.5px; }
.box { margin: 12px 0; padding: 12px 14px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); }
.box-t { display: block; font-size: 15px; margin-bottom: 4px; color: #ffe9a8; }
.box.boss { border-color: #f87171; background: linear-gradient(160deg, rgba(127, 29, 29, 0.35), var(--panel) 45%); }
.bar { position: relative; display: inline-block; width: 110px; height: 18px; border-radius: 9px; background: #0a0d1a; border: 1px solid var(--line); overflow: hidden; vertical-align: middle; }
.bar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #0ea5e9, #a78bfa); }
.bar b { position: relative; display: block; text-align: center; font-size: 11.5px; line-height: 16px; text-shadow: 0 1px 2px #000; }
.rank { display: inline-block; min-width: 22px; text-align: center; border-radius: 6px; font-weight: 900; font-size: 12px; padding: 0 5px; margin-left: 6px; color: #1c1917; }
.rank-S { background: linear-gradient(#fde68a, #f59e0b); } .rank-A { background: #c4b5fd; } .rank-B { background: #93c5fd; } .rank-C { background: #94a3b8; } .rank-- { background: #475569; color: #fff; }
.c-red { --c: var(--red); } .c-blue { --c: var(--blue); } .c-green { --c: var(--green); } .c-yellow { --c: var(--yellow); } .c-purple { --c: var(--purple); } .c-none { --c: var(--none); }
.color-name { color: var(--c); } a.cl { color: color-mix(in srgb, var(--c) 65%, #fff); font-weight: 700; } a.sl { white-space: nowrap; }
.r-common { color: #cbd5e1; } .r-rare { color: #60a5fa; } .r-epic { color: #c084fc; } .r-legend { color: #fbbf24; } .elite-t { color: #f472b6; }
.flow { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; margin: 10px 0; }
.flow div { flex: 1 1 150px; padding: 8px 10px; border-radius: 10px; background: var(--panel); border: 1px solid var(--accent); }
.flow div b { display: block; color: #ffe9a8; } .flow div span { font-size: 12.5px; color: var(--dim); } .flow i { align-self: center; font-style: normal; color: var(--gold); }
.cards { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.mc { position: relative; display: flex; flex-direction: column; align-items: center; width: 84px; padding: 3px 3px 4px; border-radius: 10px; color: #fff; text-align: center;
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 50%, #0f172a), #0b1220 80%); border: 2px solid color-mix(in srgb, var(--c) 70%, #1e293b); }
.mc:hover { text-decoration: none; filter: brightness(1.15); }
.mc.r-rare { box-shadow: inset 0 0 0 1px #93c5fd; } .mc.r-epic { box-shadow: inset 0 0 0 1px #d8b4fe, 0 0 6px rgba(192, 132, 252, 0.5); } .mc.r-legend { box-shadow: inset 0 0 0 1px #fde68a, 0 0 8px rgba(251, 191, 36, 0.6); } .mc.elite { border-style: double; border-width: 4px; }
.mc-art { width: 54px; height: 54px; } .mc-art svg, .cd-art svg, .slot-art svg { width: 100%; height: 100%; display: block; }
.mc-name { font-size: 9.5px; font-weight: 700; line-height: 1.2; min-height: 23px; display: flex; align-items: center; }
.mc-st { font-size: 10px; line-height: 1.25; }
.mc-cost { position: absolute; top: -5px; left: -5px; width: 20px; height: 20px; border-radius: 50%; background: #0ea5e9; border: 1px solid #e0f2fe; font-size: 11px; font-weight: 900; line-height: 18px; }
.mc-n { position: absolute; top: -5px; right: -5px; background: var(--gold); color: #1c1917; font-size: 10px; font-weight: 900; border-radius: 999px; padding: 0 5px; }
.mc .rank { position: absolute; top: 18px; right: 1px; margin: 0; }
.cds { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 10px; }
.cd { padding: 8px 10px; border-radius: 12px; background: var(--panel); border: 1px solid color-mix(in srgb, var(--c) 55%, var(--line)); border-left: 5px solid var(--c); }
.cd-h { display: flex; gap: 10px; align-items: center; } .cd-h b { font-size: 15px; } .cd-h small { color: var(--dim); font-size: 11.5px; line-height: 1.5; }
.cd-art { flex: none; width: 60px; height: 60px; border-radius: 10px; background: radial-gradient(circle, color-mix(in srgb, var(--c) 50%, #fff 10%), #0b1220 80%); }
.cd-o { font-size: 12px; color: var(--dim); margin: 3px 0; }
.sks { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
.sk { padding: 8px 10px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); }
.sk-h { display: flex; align-items: baseline; gap: 6px; } .sk-i { font-size: 18px; } .sk-h small { color: var(--dim); font-size: 11.5px; } .sk-r { margin-left: auto; font-size: 11.5px; color: #86efac; }
.sk p { margin: 2px 0; font-size: 13px; } .sk-w, .sk-c { color: var(--dim); font-size: 12px !important; }
.dk { margin: 12px 0; padding: 10px 14px; border-radius: 12px; background: var(--panel); border: 1px solid var(--accent); }
.dk h4 { margin-top: 2px; font-size: 16px; color: #ffe9a8; }
.scene { margin: 12px 0; padding: 10px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); display: grid; grid-template-columns: minmax(250px, 320px) 1fr; gap: 6px 14px; }
.scene figcaption { grid-column: 1 / -1; font-weight: 800; color: #ffe9a8; }
.board { display: flex; flex-direction: column; gap: 4px; }
.field { display: grid; grid-template-columns: 1fr 1.1fr 1fr; gap: 4px; align-items: center; }
.vs { text-align: center; font-size: 10.5px; color: var(--dim); }
.slot { position: relative; min-height: 86px; border-radius: 9px; padding: 3px; text-align: center; display: flex; flex-direction: column; align-items: center; font-size: 10px; line-height: 1.25;
  background: linear-gradient(180deg, color-mix(in srgb, var(--c, #334155) 45%, #0f172a), #0b1220 85%); border: 2px solid color-mix(in srgb, var(--c, #334155) 70%, #1e293b); }
.slot.empty { background: rgba(255, 255, 255, 0.03); border: 2px dashed var(--line); }
.slot i { position: absolute; top: -6px; left: -6px; width: 17px; height: 17px; border-radius: 50%; background: #475569; font-style: normal; font-size: 10px; font-weight: 900; line-height: 17px; }
.slot-art { width: 40px; height: 40px; } .slot b { font-size: 9.5px; } .slot small { font-size: 9.5px; }
.scene-cap { font-size: 11.5px; color: #86efac; } .atk-log { font-size: 13px; padding-left: 20px; } .atk-log .skip { color: var(--dim); list-style: '・'; } .ko { color: #f87171; } .ex { display: block; color: #fca5a5; font-size: 12px; }
.pzs { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
.pz { padding: 8px 10px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); font-size: 13px; }
.pz b { display: block; } .pz small { color: #fde68a; } .pz p { margin: 3px 0; }
details { margin-top: 4px; } summary { cursor: pointer; color: #fca5a5; font-weight: 700; }
.qa { margin: 8px 0; padding: 8px 12px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); } .qa p { margin: 3px 0; font-size: 13.5px; }
footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid var(--line); color: var(--dim); font-size: 12px; }
.menu-btn { display: none; }
.tools { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.tools button, .tools a { display: block; text-align: center; padding: 7px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel); color: var(--text); font-size: 12.5px; font-family: inherit; cursor: pointer; }
mark { background: var(--gold); color: #1c1917; border-radius: 3px; }
.flash-target { animation: flash-target 1.6s ease-out; } @keyframes flash-target { from { box-shadow: 0 0 0 4px var(--gold); } to { box-shadow: 0 0 0 4px transparent; } }

/* スマホ：目次は上のメニューにたたむ */
@media (max-width: 860px) {
  .wrap { display: block; }
  nav.toc { position: sticky; top: 0; z-index: 20; height: auto; max-height: 100vh; padding: 8px 10px; border-right: 0; border-bottom: 1px solid var(--line); background: rgba(11, 15, 30, 0.97); }
  nav.toc h1 { display: inline; font-size: 15px; } nav.toc .sub { display: none; }
  .toc-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .menu-btn { display: inline-block; margin-left: auto; padding: 5px 12px; border-radius: 8px; border: 1px solid var(--accent); background: var(--panel); color: var(--text); font-size: 13px; font-family: inherit; }
  nav.toc ol, nav.toc .tools { display: none; } nav.toc.open ol { display: grid; grid-template-columns: 1fr 1fr; } nav.toc.open .tools { display: flex; flex-direction: row; }
  html { scroll-padding-top: 112px; }
  main { padding: 4px 12px 60px; } h2 { font-size: 20px; } body { font-size: 14.5px; }
  .scene { grid-template-columns: 1fr; } .cds, .sks, .pzs { grid-template-columns: 1fr; }
  .mc { width: 74px; } .mc-art { width: 46px; height: 46px; }
}

/* 印刷・PDF保存：白地に黒。目次と検索は出さない。章ごとに改ページし、カード・表・図は途中で切らない */
@media print {
  @page { size: A4; margin: 13mm 11mm; }
  :root { --bg: #fff; --panel: #fff; --line: #999; --text: #000; --dim: #333; --gold: #8a5a00; }
  html { scroll-behavior: auto; }
  body { background: #fff; color: #000; font-size: 10pt; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  nav.toc, .menu-btn, #hits, .tools { display: none !important; }
  .wrap { display: block; max-width: none; } main { padding: 0; }
  section.chap { break-before: page; page-break-before: always; padding-top: 0; }
  section.chap:first-of-type { break-before: auto; page-break-before: auto; }
  h2 { background: none; border-left: 6px solid #000; border-bottom: 2px solid #000; border-radius: 0; color: #000; font-size: 18pt; }
  h3 { color: #000; border-bottom: 1.5px solid #000; font-size: 13pt; } h4 { color: #000; font-size: 11pt; }
  h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
  .keep, .cd, .sk, .pz, .dk, .qa, .box, .scene, tr, .mc, figure { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  .tw { overflow: visible; } table { font-size: 8.5pt; } th { background: #ddd !important; color: #000; } tr:nth-child(even) td { background: #f3f3f3 !important; } th, td { border-color: #777; }
  a, a.cl { color: #000 !important; text-decoration: none; }
  .box, .cd, .sk, .pz, .dk, .qa, .scene { background: #fff !important; border-color: #777 !important; } .box.boss { background: #fff !important; border: 2px solid #000 !important; }
  .box-t, .dk h4, .scene figcaption, .flow div b { color: #000 !important; }
  .src { color: #000; background: #eee; border-color: #999; } .note { color: #222; border-color: #999; }
  .bar { border-color: #777; background: #fff; } .bar i { background: #bbb; } .bar b { color: #000; text-shadow: none; }
  .mc { color: #000; background: #fff !important; border-color: #777 !important; box-shadow: none !important; } .mc-cost { background: #fff; color: #000; border-color: #000; }
  .slot { background: #fff !important; border-color: #777 !important; color: #000; } .slot.empty { border-style: dashed; } .slot i { background: #000; color: #fff; }
  .cds, .sks, .pzs { grid-template-columns: 1fr 1fr; gap: 5px; }
  .color-name, .r-common, .r-rare, .r-epic, .r-legend, .pz small, .scene-cap, .sk-r, .ko, .ex { color: #000 !important; }
  details > summary { color: #000; } code { background: #f3f3f3; border-color: #999; }
  footer { color: #000; border-color: #999; }
}
`;

const GUIDE_JS = `
(function () {
  var nav = document.querySelector('nav.toc'), input = document.querySelector('#q'), hits = document.querySelector('#hits');
  document.querySelector('.menu-btn').addEventListener('click', function () { nav.classList.toggle('open'); });
  nav.addEventListener('click', function (e) { if (e.target.closest('ol a')) nav.classList.remove('open'); });
  // 検索：カード・スキル・ステージ・ヒーロー・地形・お守り・パズル・デッキ・質問・用語の名前から探す
  var norm = function (s) { return s.toLowerCase().replace(/[\\u30a1-\\u30f6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); }).replace(/[\\s　・\\-]/g, ''); };
  var index = Array.prototype.map.call(document.querySelectorAll('[data-search]'), function (el) {
    var holder = el.id ? el : el.closest('[id]');
    return { key: norm(el.dataset.search), title: el.dataset.search.split(' ')[0] + (el.dataset.kind === 'ステージ' || el.dataset.kind === 'ボス' ? ' ' + el.dataset.search.split(' ').slice(1).join(' ') : ''), kind: el.dataset.kind || '', el: el, id: holder ? holder.id : '' };
  });
  function show(list, q) {
    hits.innerHTML = list.length ? list.slice(0, 40).map(function (x, i) { return '<a href="#' + x.id + '" data-i="' + index.indexOf(x) + '"><span>' + x.title.replace(/[&<>]/g, '') + '</span><small>' + x.kind + '</small></a>'; }).join('') + (list.length > 40 ? '<div class="none">ほか' + (list.length - 40) + '件</div>' : '') : '<div class="none">「' + q.replace(/[&<>]/g, '') + '」は見つかりませんでした</div>';
    hits.classList.add('show');
  }
  input.addEventListener('input', function () {
    var q = norm(input.value);
    if (!q) { hits.classList.remove('show'); return; }
    show(index.filter(function (x) { return x.key.indexOf(q) >= 0; }), input.value);
  });
  hits.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    var x = index[Number(a.dataset.i)]; hits.classList.remove('show'); nav.classList.remove('open');
    var t = x.el.closest('.cd, .sk, .pz, .dk, .qa, .box, tr') || x.el;
    e.preventDefault();
    t.scrollIntoView({ block: 'center' }); t.classList.remove('flash-target'); void t.offsetWidth; t.classList.add('flash-target');
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) hits.classList.remove('show'); });
  document.querySelector('#btn-print').addEventListener('click', function () { window.print(); });
  // 印刷するときは、たたんである答えも閉じたまま（ネタバレ防止）。デッキコードはタップで全選択できる
})();
`;

const now = new Date();
const stamp = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
const totalGames = S3.games + S1.games + SIM.b.searchGames;
print(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Card Monsters 攻略本</title>
<style>${GUIDE_CSS}</style>
</head>
<body>
<div class="wrap">
<nav class="toc">
  <div class="toc-top"><h1>Card Monsters 攻略本</h1><button class="menu-btn">目次</button></div>
  <div class="sub">${stamp}版・データから自動作成</div>
  <div class="search"><input id="q" type="search" placeholder="カード・スキル・ステージを検索" autocomplete="off"><div id="hits"></div></div>
  <ol>${CHAPS.map(c => `<li><a href="#${c.id}">${c.title}</a></li>`).join('')}</ol>
  <div class="tools"><button id="btn-print">🖨 印刷・PDF保存</button><a href="index.html">🎮 ゲームへ戻る</a></div>
</nav>
<main>
${CHAPS.map(c => `<section class="chap" id="${c.id}"><h2>${c.title}</h2>${c.body}</section>`).join('\n')}
<footer>
  <p>Card Monsters 攻略本　${stamp}版。カード${allCards.length}枚・スキル${Object.keys(SKILLS).length}種類・ステージ${STAGES.length}個・パズル${PUZZLES.length}問のデータと、CPU同士の対戦シミュレーションから自動で作成しました。</p>
  <p>数値はゲームのデータファイルから作っています。ゲームを更新したあとは、<code>./build-guide.sh</code> で作り直してください。</p>
</footer>
</main>
</div>
<script>${GUIDE_JS}</script>
</body>
</html>`);
