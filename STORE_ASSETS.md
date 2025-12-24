# Google Play Store Assets Checklist - Read This For Me

Prepare these assets before starting your submission in the Google Play Console.

## 1. Store Listing Assets
- [ ] **App Icon**: 512x512 PNG (32-bit, alpha enabled).
- [ ] **Feature Graphic**: 1024x500 PNG or JPEG.
- [ ] **Screenshots (Phone)**: 2-8 screenshots. Minimum 320px, maximum 3840px. Aspect ratio 16:9 or 9:16.
- [ ] **Short Description**: Max 80 characters. (e.g., "Read This For Me - Helping you understand the world through your camera.")
- [ ] **Full Description**: Max 4000 characters.

## 2. Technical Requirements
- [ ] **Privacy Policy URL**: Host your `PRIVACY_POLICY.md` content on a public URL (e.g., GitHub Pages or a simple website).
- [ ] **Data Safety**:
    - Disclosure: App collects and processes images and text.
    - Usage: OCR and AI analysis.
    - Security: Data is encrypted in transit (HTTPS).
- [ ] **GenAI Disclosure**: Under "App Content", declare that the app uses Generative AI (Google Gemini).

## 3. Recommended Workflow
1.  Run `eas login` on your machine.
2.  Run `eas build:configure`.
3.  Run `eas build -p android --profile production`.
4.  Download the `.aab` file once complete.
5.  Upload to Google Play Console.
