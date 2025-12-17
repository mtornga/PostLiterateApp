# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Post Literate App** is a React Native mobile application designed to help illiterate adults navigate text independently using OCR and text-to-speech technology. The app's core philosophy is extreme simplicity with zero friction—no signup, no onboarding, just point the camera at text and listen.

### Target Users
Adults who struggle with literacy and need to read everyday documents (menus, forms, signs, medical paperwork) discreetly and independently.

### Key Design Principles
- **Icons over text**: UI must be usable by non-readers
- **Zero friction**: No accounts, no settings, immediate utility
- **Privacy first**: No personal data collection
- **High contrast UI**: Accessibility is paramount

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (choose platform from menu)
npm start
# or
npx expo start

# Platform-specific commands
npm run android    # Start on Android
npm run ios        # Start on iOS
npm run web        # Start on web

# Code quality
npm run lint       # Run ESLint

# Reset project to blank slate
npm run reset-project
```

## Tech Stack

- **Framework**: React Native via Expo SDK 54
- **Router**: Expo Router (file-based routing)
- **Language**: TypeScript (strict mode enabled)
- **Navigation**: React Navigation with bottom tabs
- **Camera**: expo-camera ~17.0
- **Animations**: react-native-reanimated

### Planned Integrations
- **OCR**: Google Cloud Vision API (via Firebase Function proxy for security)
- **LLM**: Google Gemini Flash or OpenAI GPT-4o-mini for text simplification
- **TTS**: Native device TTS initially, may upgrade to Google Cloud TTS

## Project Structure

```
app/
  _layout.tsx       # Root layout with theme provider and navigation stack
  index.tsx         # Main camera screen (MVP implementation)
components/         # Reusable UI components (themed views, buttons, etc.)
hooks/              # Custom hooks (color scheme, theme)
constants/          # Theme constants and app-wide config
```

### Path Aliases
TypeScript is configured with `@/*` alias pointing to the root directory. Use `@/components/...` instead of relative paths.

## Current Implementation Status

**Phase 1 (Complete)**: Camera access and image capture
- Camera permissions handling with user-friendly prompts
- Rear-facing camera with capture button
- Image URI stored in state after capture

**Next Phases** (see MasterPlan.md):
- Phase 2: OCR integration via Google Cloud Vision
- Phase 3: "Explain" feature with LLM
- Phase 4: UI polish and app store submission

## Important Configuration

### app.json
- **New Architecture**: Enabled (`newArchEnabled: true`)
- **React Compiler**: Experimental feature enabled
- **Typed Routes**: Enabled for type-safe navigation
- **Camera Permission**: Custom message explains text-reading purpose
- **Orientation**: Locked to portrait

### Camera Implementation Notes
- Main screen (app/index.tsx) uses `expo-camera`'s `CameraView` component
- Capture happens via ref: `cameraRef.current.takePictureAsync()`
- Current implementation logs URI and stores in state (ready for OCR integration)

## Security Considerations

**CRITICAL**: API keys for Google Cloud Vision and LLM services MUST NOT be embedded in the app binary. Use Firebase Functions (or similar serverless proxy) to securely call external APIs. The mobile app should only communicate with your backend proxy.

## Testing on Device

The app requires a physical device or emulator with camera support. Expo Go may have limitations; development builds recommended for full camera functionality testing.
