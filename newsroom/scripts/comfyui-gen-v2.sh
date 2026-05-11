#!/bin/bash
# comfyui-gen-v2.sh — Generate ComfyUI image from prompt file
# Usage: bash /tmp/comfyui-gen-v2.sh <mode> <prompt_file>
# Outputs path to generated image on stdout (/tmp/ai-*.png)
# Can also read prompt from second argument as string if file doesn't exist

MODE="${1:-news}"
PROMPT_SRC="$2"

if [ -z "$PROMPT_SRC" ]; then
    echo "ERROR: No prompt provided" >&2
    exit 1
fi

# Read prompt: if file exists, read from file, else use as string
if [ -f "$PROMPT_SRC" ]; then
    PROMPT=$(cat "$PROMPT_SRC")
else
    PROMPT="$PROMPT_SRC"
fi

# Call the Python generator
OUTPUT=$(python3 /tmp/generate-news-image.py "$PROMPT" 2>&1)
RESULT=$?

if [ $RESULT -ne 0 ]; then
    echo "ERROR: Generation failed: $OUTPUT" >&2
    exit 1
fi

GEN_PATH=$(echo "$OUTPUT" | tail -1)

if [ -z "$GEN_PATH" ] || [ ! -f "$GEN_PATH" ]; then
    echo "ERROR: No output file: $OUTPUT" >&2
    exit 1
fi

# Copy to /tmp/ai-* location expected by generate-article-image.js
OUT_NAME="/tmp/ai-$(date +%s)-$$.png"
cp "$GEN_PATH" "$OUT_NAME"

if [ -f "$OUT_NAME" ] && [ -s "$OUT_NAME" ]; then
    echo "$OUT_NAME"
    exit 0
else
    echo "ERROR: Copy failed: $GEN_PATH -> $OUT_NAME" >&2
    exit 1
fi
