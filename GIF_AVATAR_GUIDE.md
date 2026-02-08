# GIF Avatar - TTS Speech Synchronization

## Overview
The GIF Avatar mode displays an animated GIF that plays synchronized with Text-to-Speech (TTS) output from the Web Speech API.

## How It Works

### 1. **GIF Playback Control**
- **When Speech Starts**: The GIF automatically restarts from the beginning
- **During Speech**: If the TTS speech duration exceeds the GIF's natural duration, the GIF automatically loops
- **When Speech Ends**: The GIF completes its current cycle and stops

### 2. **Configuration**

#### Current Settings
- **GIF File**: `/public/assets/Realistic_Russian_Woman_Passport_Photo-ezgif.com-video-to-gif-converter.gif`
- **GIF Duration**: 5000ms (5 seconds)
- **Canvas Size**: 320x320px (rendered)
- **Display Size**: 280x280px (UI)

#### How to Change the GIF
1. Add your GIF file to `/public/assets/` folder
2. Update `DEFAULT_GIF_URL` in `/src/hooks/useGifAvatar.ts`:
   ```typescript
   const DEFAULT_GIF_URL = "/assets/your-gif-name.gif";
   ```
3. Adjust `GIF_DURATION_MS` to match your GIF's actual duration:
   ```typescript
   const GIF_DURATION_MS = 3000; // 3 seconds, adjust as needed
   ```

### 3. **Sizing Configuration**

The GIF is automatically scaled to fit the canvas using "cover" mode:
- **Wider GIFs**: Fit to height, crop sides
- **Taller GIFs**: Fit to width, crop top/bottom

To adjust the displayed size, modify `AVATAR.DISPLAY_SIZE` in `/src/utils/constants.ts`:
```typescript
export const AVATAR = {
  SIZE: 320,         // Canvas resolution
  DISPLAY_SIZE: 280, // CSS display size in pixels
};
```

### 4. **Visual Features**

- **Background**: Dark gradient (#1a1a2e → #0f1419)
- **Speaking Indicator**: Cyan glow ring appears during speech
- **Loading State**: Shows "Loading GIF..." placeholder while the image loads

### 5. **Technical Implementation**

The implementation uses:
- **Image Element**: HTMLImageElement loads the GIF
- **Canvas Rendering**: Draws GIF frames to canvas for smooth scaling
- **Timing System**: Tracks speech start and GIF loop count
- **Restart Mechanism**: Resets `img.src` to force GIF restart (browser limitation workaround)

### 6. **Loop Behavior**

Example timeline for a 5-second GIF with 12-second speech:

```
Speech Start: GIF starts playing (0-5s)
5s mark:      GIF restarts automatically (5-10s)
10s mark:     GIF restarts again (10-12s)
12s mark:     Speech ends, GIF finishes current cycle
```

The system logs loop count to console:
```
[GifAvatar] GIF started for speech
[GifAvatar] GIF looped #1
[GifAvatar] GIF looped #2
[GifAvatar] Speech stopped. GIF looped 2 times
```

## Usage

1. Select "Animated GIF" from the avatar dropdown in Settings
2. Speak to the avatar - the GIF will play during TTS response
3. Monitor console logs for GIF loop information

## Troubleshooting

### GIF Not Looping
- Check that `GIF_DURATION_MS` matches your actual GIF duration
- Verify the GIF file is properly animated (not a static image)

### GIF Size Issues
- Adjust `AVATAR.DISPLAY_SIZE` in constants.ts
- Ensure GIF aspect ratio is suitable (square or portrait works best)

### Performance
- Large GIF files (>10MB) may cause stuttering
- Consider reducing GIF file size using online converters
- Optimize frame count (20-30 frames is usually sufficient)

## Future Enhancements

Potential improvements:
- Auto-detect GIF duration from file metadata
- Support for multiple GIF options in settings
- Lip-sync analysis for more accurate mouth matching
- Fallback to static image if GIF fails to load
