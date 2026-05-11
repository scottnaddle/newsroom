# Deploy both scripts to Mac Studio after reboot.
# Usage: bash scripts/deploy-news-image-script.sh
#
# ⚠️ Use Tailscale hostname, NOT raw IP. Raw IP triggers Tirith
#    "URL uses raw IP address" security scan that blocks cron jobs.

MAC_HOST="axc-macstudio.tailea4ca3.ts.net"
SCRIPT_DIR="/root/newsroom-analysis/newsroom/scripts"
TMP_DIR="/tmp"

# Files to deploy
FILES=(
  "generate-news-image.py:/tmp/generate-news-image.py"
  "comfyui-gen-v2.sh:/tmp/comfyui-gen-v2.sh"
)

for PAIR in "${FILES[@]}"; do
  SRC="${PAIR%%:*}"
  DST="${PAIR##*:}"
  LOCAL="${TMP_DIR}/${SRC}"
  
  # Copy from repo scripts dir if exists there, else from /tmp
  if [ -f "${SCRIPT_DIR}/${SRC}" ]; then
    LOCAL="${SCRIPT_DIR}/${SRC}"
  elif [ ! -f "$LOCAL" ]; then
    echo "❌ Missing: $LOCAL (and not in scripts/)"
    exit 1
  fi
  
  echo "📤 ${LOCAL} → ${MAC_HOST}:${DST}"
  scp -o StrictHostKeyChecking=no "$LOCAL" "axc@${MAC_HOST}:${DST}"
  if [ $? -ne 0 ]; then
    echo "❌ SCP failed for $SRC"
    exit 1
  fi
  ssh -o StrictHostKeyChecking=no "axc@${MAC_HOST}" "chmod +x ${DST}"
  echo "   ✅ deployed"
done

# Verify
echo ""
echo "🧪 Verifying..."
ssh -o StrictHostKeyChecking=no "axc@${MAC_HOST}" "file /tmp/generate-news-image.py /tmp/comfyui-gen-v2.sh"
echo ""
echo "✅ Deploy complete"
