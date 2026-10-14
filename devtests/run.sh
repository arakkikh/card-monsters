#!/bin/sh
# 画面の流れのテスト（ブラウザなし）。ルールのテストは tests.html / tests.js。
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
GAME="skills.js cards-monsters.js cards-items.js cards.js terrains.js engine.js save.js stages.js heroes.js decks.js quests.js events.js dungeon.js packs.js autoai.js puzzle.js puzzles.js battlelog.js dict.js cardsort.js art.js fx.js pack.js"
echo "ルールのテスト: $($JSC $GAME tests.js | tail -1)"
for t in hometest swtest uitest autotest dgtest pztest; do
  printf '%s: ' "$t"; $JSC devtests/dom.js $GAME scenery.js ui.js meta.js book.js deckui.js dungeonui.js puzzleui.js devtests/$t.js 2>&1 | grep -i "OK\|FAIL\|Exception\|Error" | tail -1 | cut -c1-200
done
