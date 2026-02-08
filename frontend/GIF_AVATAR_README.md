# GIF Avatar - Real Photo Animation

The **Animated GIF** avatar mode displays a real photo or animated GIF with dynamic talking overlay effects.

## Features

✅ Loads real images from URLs or local files
✅ Maintains aspect ratio and auto-scales to fit
✅ Animated mouth overlay during speech
✅ Eye blink animation
✅ Speaking glow effect
✅ CORS-enabled for external images

## How to Use

### Option 1: Use Default Image (Current)
The avatar currently loads from a default URL. Just select **"Animated GIF"** in the settings dropdown.

### Option 2: Change the Image URL

Edit `/frontend/src/hooks/useGifAvatar.ts` line 29:

```typescript
const DEFAULT_IMAGE_URL = "YOUR_IMAGE_URL_HERE";
```

**Example URLs:**
- Direct image: `https://i.imgur.com/example.jpg`
- Animated GIF: `https://i.imgur.com/example.gif`

### Option 3: Use Local File

1. Place your image in `/frontend/public/assets/`
2. Update the URL in `useGifAvatar.ts`:

```typescript
const DEFAULT_IMAGE_URL = "/assets/your-image.jpg";
```

### Option 4: Download SRK Photo

To download a real SRK passport photo:

1. Search for "Shah Rukh Khan passport photo" or "SRK formal photo"
2. Download a high-quality image (preferably 500x500px or larger)
3. Save it to `/frontend/public/assets/srk-passport.jpg`
4. Update the URL:

```typescript
const DEFAULT_IMAGE_URL = "/assets/srk-passport.jpg";
```

## Supported Image Formats

- Static: `.jpg`, `.jpeg`, `.png`, `.webp`
- Animated: `.gif`

## Technical Details

- **Canvas Resolution:** 320x320px (displayed at 280x280px)
- **Image Scaling:** Maintains aspect ratio, centered
- **CORS:** Enabled for external URLs
- **Fallback:** Shows "Loading..." placeholder if image fails

## Animation Features

1. **Mouth Overlay:** Semi-transparent mouth appears during speech
2. **Jaw Movement:** Dynamic opening based on speech intensity
3. **Blink Animation:** Periodic eye blinks with eyelid overlay
4. **Speaking Glow:** Cyan glow ring around avatar when active

## Performance

- Image loaded once and cached
- 60 FPS animation loop
- Minimal CPU usage when not speaking
- Memory efficient (single image instance)

---

**Current Status:** ✅ Fully implemented and ready to use!
