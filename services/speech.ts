import * as Speech from 'expo-speech';

let currentTextSegments: string[] = [];
let currentSegmentIndex = -1;
let isPaused = false;
let playbackRate = 0.9;
let onProgressCallback: ((index: number, total: number) => void) | null = null;
let onDoneCallback: (() => void) | null = null;

/**
 * Splits text into chunks (sentences/phrases) for better control over playback.
 */
function segmentText(text: string): string[] {
    // Strip common markdown characters before segmenting
    const cleanText = text
        .replace(/[*_#`~]+/g, '') // Remove *, _, #, `, ~
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text, remove URL
        .trim();

    // Split by common sentence terminators, but keep the terminator with the segment
    return cleanText.match(/[^.!?]+[.!?]+|\S+/g) || [cleanText];
}

export function setOnProgress(callback: (index: number, total: number) => void) {
    onProgressCallback = callback;
}

export function setOnDone(callback: () => void) {
    onDoneCallback = callback;
}

export function setPlaybackRate(rate: number) {
    playbackRate = rate;
    if (currentSegmentIndex !== -1 && !isPaused) {
        // Restart current segment with new rate if playing
        playNextSegment();
    }
}

export function speak(text: string) {
    stop();
    currentTextSegments = segmentText(text);
    currentSegmentIndex = 0;
    isPaused = false;
    playNextSegment();
}

async function playNextSegment() {
    if (currentSegmentIndex < 0 || currentSegmentIndex >= currentTextSegments.length || isPaused) {
        if (currentSegmentIndex >= currentTextSegments.length) {
            currentSegmentIndex = -1;
            onDoneCallback?.();
        }
        return;
    }

    onProgressCallback?.(currentSegmentIndex, currentTextSegments.length);

    Speech.speak(currentTextSegments[currentSegmentIndex], {
        language: 'en',
        rate: playbackRate,
        pitch: 1.0,
        onDone: () => {
            if (!isPaused) {
                currentSegmentIndex++;
                playNextSegment();
            }
        },
        onError: (error) => {
            console.error('Speech Error:', error);
            stop();
        }
    });
}

export function pause() {
    isPaused = true;
    Speech.stop();
}

export function resume() {
    if (isPaused && currentSegmentIndex !== -1) {
        isPaused = false;
        playNextSegment();
    }
}

export function stop() {
    isPaused = false;
    currentSegmentIndex = -1;
    currentTextSegments = [];
    Speech.stop();
}

export function seek(progress: number) {
    if (currentTextSegments.length === 0) return;

    const index = Math.floor(progress * currentTextSegments.length);
    currentSegmentIndex = Math.max(0, Math.min(index, currentTextSegments.length - 1));

    Speech.stop();
    if (!isPaused) {
        playNextSegment();
    } else {
        onProgressCallback?.(currentSegmentIndex, currentTextSegments.length);
    }
}

export function speakError() {
    speak("I couldn't read that. Please try again.");
}
