# Handoff: Phase 2 Complete -> Phase 3 Start

**Date**: 2025-12-17
**Status**: Phases 1 & 2 Complete. Validated working on Android.

## Current System Status
The "Reader" functionality is live. The app captures an image, sends it to a secure backend, OCRs the text, and speaks it aloud.

### Infrastructure
- **Firebase Project**: `post-literate-app`
- **Region**: `us-central1`
- **Cloud Function**: `ocr` (Node.js 22, Gen 1)
- **APIs**: Google Cloud Vision API (Enabled)

### Key Files
- `app/index.tsx`: Main camera UI & logic.
- `services/ocr.ts`: Handles image upload & Cloud Function call.
- `services/speech.ts`: Handles TTS.
- `functions/index.js`: Backend proxy for Vision API.

## Next Step: Phase 3 (The "Interpreter")
The goal is to add an "Explain" feature for complex text.

### Implementation Plan
1.  **Backend**:
    - Update `functions/package.json` to include an LLM SDK (Google Gemini or OpenAI).
    - Create a new Cloud Function `explain` (or update `ocr` to handle modes).
    - Prompt: "Explain this text simply to a layperson who cannot read well."

2.  **Frontend**:
    - Add a secondary button (e.g., "Brain" icon) next to the Capture button.
    - Wire up the new "Explain" service.

3.  **UI/UX**:
    - Differentiate between "Reading" (fast) and "Explaining" (slower) states.
