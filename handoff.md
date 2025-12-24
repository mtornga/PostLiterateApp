# Handoff: Phase 6.1 - Bug Fixes & UI Polish

**Date**: 2025-12-24
**Status**: Production-ready with Cloud TTS, refined icons, and playback controls.

## Latest Changes (Phase 6.1)

### Bug Fixes
- **FileSystem Deprecation**: Fixed by using `expo-file-system/legacy` import to avoid runtime errors.
- **Speed Slider Default**: Changed `playbackRate` from `0.9` to `1.0` so slider starts in the middle.
- **Daily Limit Increased**: Tripled from 20 to 60 requests/day.

### Icon Updates
- **Read Button**: `clipboard-text-search` (clipboard with magnifying glass)
- **Explain Button**: `brain`

## Architecture Overview

```
Frontend (Expo 54 / React Native)
├── app/index.tsx          # Main screen with camera, playback controls
├── services/backend.ts    # OCR & Explain API calls with usage limits
└── services/speech.ts     # Cloud TTS with sentence segmentation

Backend (Firebase Cloud Functions v2)
├── /ocr                   # Google Cloud Vision proxy
├── /explain               # Gemini 2.0 Flash for text simplification
└── /tts                   # Google Cloud Text-to-Speech proxy
```

## Key Features
- **Camera-based OCR** using Google Cloud Vision
- **Text-to-Speech** using Google Cloud TTS with Neural2-J voice
- **AI Explanations** using Gemini 2.0 Flash (short/medium/long)
- **Playback Controls**: play/pause, stop, seek, speed (0.5x-2.0x)
- **Daily Limit**: 60 requests/day (configurable in `services/backend.ts`)

## Key Dependencies
- `expo-av`: Audio playback for Cloud TTS
- `expo-camera`: Image capture
- `expo-file-system/legacy`: File operations (use legacy API)
- `@react-native-community/slider`: Playback controls
- `@react-native-async-storage/async-storage`: Daily usage limits

## Deployment
- **Git Branch**: `main`
- **Functions Region**: `us-central1`

## Store Preparation Files
- `PRIVACY_POLICY.md` - Privacy policy for Google Play
- `STORE_ASSETS.md` - Checklist for store submission

## Next Steps
1. **Test on Device**: Verify TTS playback on physical iOS/Android devices
2. **App Store Assets**: Create 512x512 icon, 1024x500 feature graphic, screenshots
3. **Host Privacy Policy**: Deploy `PRIVACY_POLICY.md` to a public URL
4. **EAS Build**: Run `eas build -p android --profile production`
5. **Submit to Google Play**: Follow `STORE_ASSETS.md` checklist
