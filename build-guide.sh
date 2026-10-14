#!/bin/sh
# 攻略本（guide.html）を作り直す。
#   ./build-guide.sh        … ゲームのデータから本文を作り直す（数秒）。シミュレーションの結果は前回のものを使う
#   ./build-guide.sh --sim  … シミュレーションもやり直す（数分〜十数分）。カードやルールを変えたあとはこちら
# macOS に最初から入っている JavaScript の実行環境（jsc）を使う。
cd "$(dirname "$0")" || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
GAME="guide/pre.js skills.js cards-monsters.js cards-items.js cards.js terrains.js engine.js save.js stages.js heroes.js decks.js quests.js events.js dungeon.js packs.js autoai.js puzzle.js puzzles.js balance.js"
if [ "$1" = "--sim" ]; then
  echo "シミュレーション中…（A：カード　B：デッキ　D：ヒーロー・地形・ダンジョン を同時に、そのあと C：ステージ）"
  $JSC $GAME guide/sim-a.js > guide/sim-a.json.tmp &
  $JSC $GAME guide/dungeon-policy.js guide/sim-d.js > guide/sim-d.json.tmp &
  $JSC $GAME guide/sim-b.js > guide/sim-b.json.tmp || exit 1
  mv guide/sim-b.json.tmp guide/sim-b.json
  $JSC $GAME guide/sim-c.js > guide/sim-c.json.tmp || exit 1
  mv guide/sim-c.json.tmp guide/sim-c.json
  wait
  mv guide/sim-a.json.tmp guide/sim-a.json && mv guide/sim-d.json.tmp guide/sim-d.json || exit 1
fi
$JSC $GAME battlelog.js dict.js art.js guide/build-lib.js guide/build.js guide/build-page.js > guide.html.tmp || { echo "作成に失敗しました"; rm -f guide.html.tmp; exit 1; }
mv guide.html.tmp guide.html
echo "guide.html を作りました（$(wc -c < guide.html | tr -d ' ') バイト）"
# 攻略本の数値がゲームのデータと合っているかを確かめる
$JSC $GAME battlelog.js dict.js art.js guide/build-lib.js guide/check.js
