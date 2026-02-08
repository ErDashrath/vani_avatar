#!/bin/bash
# Download SRK passport-style photo for GIF avatar

ASSETS_DIR="./public/assets"
mkdir -p "$ASSETS_DIR"

echo "🎬 Downloading SRK passport photo..."

# Try multiple sources (fallback if one fails)
URLS=(
  "https://i.pinimg.com/originals/27/8f/e8/278fe8bfc5dd08a83a04b3ff24eaf223.jpg"
  "https://wallpapercave.com/wp/wp2966550.jpg"
)

for url in "${URLS[@]}"; do
  if curl -L -o "$ASSETS_DIR/srk-passport.jpg" "$url" 2>/dev/null; then
    echo "✅ Successfully downloaded to: $ASSETS_DIR/srk-passport.jpg"
    
    # Update the hook to use local file
    HOOK_FILE="./src/hooks/useGifAvatar.ts"
    if [ -f "$HOOK_FILE" ]; then
      sed -i 's|const DEFAULT_IMAGE_URL = ".*"|const DEFAULT_IMAGE_URL = "/assets/srk-passport.jpg"|' "$HOOK_FILE"
      echo "✅ Updated useGifAvatar.ts to use local file"
    fi
    
    exit 0
  fi
done

echo "❌ Failed to download image. Please download manually."
echo "   1. Find a high-quality SRK photo"
echo "   2. Save to: $ASSETS_DIR/srk-passport.jpg"
echo "   3. Update: ./src/hooks/useGifAvatar.ts (line 29)"
exit 1
