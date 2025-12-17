# Post Literate App - Master Plan

## 1. Vision
To empower illiterate adults with a tool that allows them to navigate the textual world independently, preserving their dignity and autonomy. The app serves as a simple "visual prosthetic" for reading.

## 2. Core Philosophy
*   **Extreme Simplicity:** The user interface must be usable by someone who cannot read a single word. Icons > Text. Voice > Text.
*   **Zero Friction:** No signup, no login, no onboarding, no settings. Immediate utility upon opening.
*   **Privacy First:** No personal data collection needed.

## 3. Product Definition (MVP)

### Target Platform
*   **Primary:** Android (Initial MVP)
*   **Secondary:** iOS (Follow-up)

### Key Features
1.  **Camera Viewfinder:** The default and main screen.
2.  **"Read to Me" Action:**
    *   Single tap to capture and read text aloud.
    *   Highlight words as they are spoken (visual accessibility).
3.  **"Explain" Action:**
    *   Secondary button (distinct icon, e.g., a "Question Mark" or "Brain").
    *   Provides a simplified summary of the text (LLM powered).
    *   Useful for complex documents like medical forms or legal notices.

### User Journey
1.  User opens app.
2.  App immediately shows camera feed.
3.  User points camera at a Medicaid form.
4.  User taps the big "Speaker" button.
5.  App captures image -> OCR -> TTS -> Plays audio.
6.  User is confused by the jargon, taps the "Explain" button.
7.  App sends text to LLM ("Explain this simply to a layperson") -> TTS -> Plays explanation.

## 4. Technical Architecture

### Frontend (Mobile App)
*   **Framework:** **React Native (via Expo)**.
    *   *Rationale:* Rapid development, excellent camera libraries, native performance, easy path to iOS later.
*   **Languages:** TypeScript.
*   **UI Library:** Custom minimal UI (buttons, icons) to ensure high contrast and accessibility.

### Backend / Services
*   **OCR Engine:** **Google Cloud Vision API**.
    *   *Rationale:* High accuracy, robust language support.
*   **LLM (Explanation):** **Google Gemini Flash** or **OpenAI GPT-4o-mini**.
    *   *Rationale:* Fast, cheap, and capable of simplification.
*   **Text-to-Speech (TTS):** Native Device TTS or Google Cloud TTS.
    *   *Rationale:* Native is free and fast/offline-capable. Cloud TTS is more natural. *Recommendation: Start with Native for speed/cost, upgrade if needed.*
*   **Middleware:** **Firebase Functions** (or similar serverless proxy).
    *   *Rationale:* **Crucial security measure.** We cannot embed Google Cloud/OpenAI API keys directly in the mobile app binary. The app calls our Firebase Function, which holds the keys and calls the simplified APIs.

## 5. Roadmap

### Phase 1: The "Hellow World" (Current Focus)
*   [ ] Set up React Native / Expo environment.
*   [ ] Implement Camera access.
*   [ ] Capture image and send to dummy endpoint.

### Phase 2: The "Reader"
*   [ ] Connect Google Cloud Vision API (via Proxy).
*   [ ] Implement raw Text-to-Speech playback of OCR results.
*   [ ] Refine "Read" button UI.

### Phase 3: The "Interpreter"
*   [ ] Connect LLM API (via Proxy).
*   [ ] Implement "Explain" prompt engineering.
*   [ ] Add "Explain" button UI.

### Phase 4: Polish & Ship
*   [ ] High-contrast UI refinements.
*   [ ] Error handling (audible errors, not text errors).
*   [ ] App Icon design.
*   [ ] Android Play Store submission.

## 6. Open Questions & decisions
1.  **Tech Stack:** Is React Native/Expo acceptable, or do you prefer native Kotlin? (Expo is recommended for speed).
2.  **Infrastructure:** Are you okay with setting up a small Firebase project for the backend proxy? (Free tier usually suffices for dev/MVP).
3.  **TTS:** Is the default Android robot-voice acceptable for MVP, or do we need premium neural voices?
