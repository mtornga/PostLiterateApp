import * as Speech from 'expo-speech';

export function speak(text: string) {
    // Stop any currently playing speech
    Speech.stop();

    // Speak the new text
    Speech.speak(text, {
        language: 'en', // Default to English, can be dynamic later
        rate: 0.9,      // Slightly slower than default for clarity
        pitch: 1.0,
    });
}

export function stop() {
    Speech.stop();
}

export function speakError() {
    speak("I couldn't read that. Please try again.");
}
