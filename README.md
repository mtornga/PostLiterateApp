# Read This For Me

A privacy-first mobile app that reads text aloud using AI and OCR, helping adults navigate everyday reading challenges independently.

**Point. Snap. Listen.**

![Feature Graphic](AppScreenshots/ReadThisForMeFeature.png)

## The Problem

**54 million adults in the U.S.** read below a 6th-grade level. Many navigate daily life by asking others for help, memorizing routines, or avoiding situations entirely. Existing solutions require accounts, track usage, or have complex interfaces that assume literacy.

## The Solution

1. **Point** — Open the app and point your camera at any text (menus, forms, mail, medicine labels, signs)
2. **Tap** — Tap the speaker button to hear the words read aloud in a natural voice
3. **Understand** — Tap the brain button to hear a simplified explanation of complex text

No accounts. No settings. No learning curve.

## Privacy First

This app is built on a simple principle: **what you read is nobody's business.**

- No accounts or sign-ups required
- Photos are processed in real-time and immediately discarded
- No tracking, no history, no analytics on what you read
- Everything is forgotten after it speaks

See our [Privacy Policy](https://mtornga.github.io/PostLiterateApp/).

## Features

| Feature | Description |
|---------|-------------|
| **Natural Voice** | High-quality Google Cloud Text-to-Speech with Neural2-J voice |
| **Adjustable Speed** | 0.5x to 2.0x playback speed to match your pace |
| **Explain Mode** | AI simplifies complex text into plain language (short, medium, or long) |
| **Icon-Based UI** | No reading required to use the app |
| **Audio Help** | Tap ? to hear instructions spoken aloud |
| **Multi-Language** | Works with any language supported by Google Vision |

## Technical Architecture

### Frontend (React Native + Expo)
- **Framework**: Expo SDK 54 with React Native
- **Camera**: expo-camera for real-time capture
- **Audio**: expo-av for TTS playback with sentence-by-sentence prefetching
- **Animations**: react-native-reanimated for pulsing speaker indicator
- **Navigation**: React Navigation with bottom tabs

### Backend (Firebase Cloud Functions)
- `/ocr` — Google Cloud Vision API proxy for text recognition
- `/tts` — Google Cloud Text-to-Speech with Neural2-J voice
- `/explain` — Gemini 2.0 Flash for plain-language simplification

## Screenshots

<p align="center">
  <img src="AppScreenshots/Screenshot_20251227-093233.png" width="200" alt="Scanning a patch">
  <img src="AppScreenshots/Screenshot_20251227-093255.png" width="200" alt="Scanning a vitamin bottle">
  <img src="AppScreenshots/Screenshot_20251227-093317.png" width="200" alt="Playback controls">
  <img src="AppScreenshots/Screenshot_20251227-093412.png" width="200" alt="Explanation mode">
</p>

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- Firebase project with Cloud Functions enabled
- Google Cloud APIs: Vision, Text-to-Speech
- Google AI (Gemini) API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/mtornga/PostLiterateApp.git
   cd PostLiterateApp
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   ```bash
   cp .env.example .env
   # Add your API keys
   ```

4. Start the development server
   ```bash
   npx expo start
   ```

### Firebase Functions

Deploy the backend functions:
```bash
cd functions
npm install
firebase deploy --only functions
```

## Current Status

**Beta testing on Google Play.** Looking for testers to help meet Google's closed testing requirements before public release.

### Want to help test?

Visit [marktornga.com/portfolio/readthisforme](https://marktornga.com/portfolio/readthisforme) to join the beta!

## What's Next

- [ ] iOS release via App Store
- [ ] Offline mode for basic OCR
- [ ] Document scanning with multi-page support
- [ ] Integration with accessibility services

## License

This project is licensed under the MIT License.

## Contact

- **Email**: readformeapp@gmail.com
- **Website**: [marktornga.com](https://marktornga.com)
- **GitHub**: [@mtornga](https://github.com/mtornga)

---

*Technology should help people live more independently — without requiring them to hand over their data or their dignity.*
