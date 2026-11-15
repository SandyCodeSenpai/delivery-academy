#!/bin/bash
# Screenshot a route from the running dev server and print browser console errors.
# usage: tools/shot.sh '<hash>' /abs/path/out.png [width=1280] [height=900]
# examples: tools/shot.sh 'w-eviction' /tmp/x.png    tools/shot.sh 'w-eviction@375' /tmp/x.png 600 1200
# NOTE: headless Chrome's minimum window width is ~500px; use the @375 harness suffix to test phone layouts.
W=${3:-1280}; H=${4:-900}
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=$W,$H --virtual-time-budget=8000 --enable-logging=stderr --v=0 \
  --screenshot="$2" "http://127.0.0.1:5180/#$1" 2>&1 | grep -E "CONSOLE|Uncaught" | grep -v -iE "gpu|devtools|download the react|\[vite\]" | head -20
echo "saved $2"
