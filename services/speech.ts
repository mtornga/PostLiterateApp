import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const BASE_URL = 'https://us-central1-post-literate-app.cloudfunctions.net';

interface AudioSegment {
    text: string;
    sound: Audio.Sound | null;
    uri: string | null;
}

let segments: AudioSegment[] = [];
let currentSegmentIndex = -1;
let isPaused = false;
let playbackRate = 1.0;
let onProgressCallback: ((index: number, total: number) => void) | null = null;
let onDoneCallback: (() => void) | null = null;
let isLoadingSegments = false;

/**
 * Splits text into sentences for per-sentence TTS.
 */
function segmentText(text: string): string[] {
    const cleanText = text
        .replace(/[*_#`~]+/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();

    // Split by sentence terminators, keeping the terminator
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];

    // Filter out very short segments and trim
    return sentences
        .map(s => s.trim())
        .filter(s => s.length > 2);
}

/**
 * Fetches TTS audio for a single sentence from the backend.
 */
async function fetchTTSAudio(text: string): Promise<string> {
    const response = await fetch(`${BASE_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });

    if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
    }

    const data = await response.json();

    // Save base64 audio to a temp file
    const filename = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
    const uri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(uri, data.audio, {
        encoding: FileSystem.EncodingType.Base64,
    });

    return uri;
}

/**
 * Loads and prepares an audio segment for playback.
 */
async function loadSegment(index: number): Promise<void> {
    if (index < 0 || index >= segments.length) return;

    const segment = segments[index];
    if (segment.sound) return; // Already loaded

    try {
        const uri = await fetchTTSAudio(segment.text);
        segment.uri = uri;

        const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false, rate: playbackRate, shouldCorrectPitch: true }
        );
        segment.sound = sound;
    } catch (error) {
        console.error(`Failed to load segment ${index}:`, error);
        throw error;
    }
}

/**
 * Plays the next segment in the queue.
 */
async function playNextSegment(): Promise<void> {
    if (currentSegmentIndex < 0 || currentSegmentIndex >= segments.length || isPaused) {
        if (currentSegmentIndex >= segments.length && !isPaused) {
            // Playback complete
            currentSegmentIndex = -1;
            onDoneCallback?.();
            cleanup();
        }
        return;
    }

    onProgressCallback?.(currentSegmentIndex, segments.length);

    const segment = segments[currentSegmentIndex];

    // Ensure current segment is loaded
    if (!segment.sound) {
        try {
            await loadSegment(currentSegmentIndex);
        } catch (error) {
            console.error('Failed to load segment:', error);
            currentSegmentIndex++;
            playNextSegment();
            return;
        }
    }

    // Pre-fetch next segment while playing current
    if (currentSegmentIndex + 1 < segments.length && !segments[currentSegmentIndex + 1].sound) {
        loadSegment(currentSegmentIndex + 1).catch(() => {});
    }

    try {
        const sound = segment.sound!;

        // Set up completion handler
        sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish && !isPaused) {
                currentSegmentIndex++;
                playNextSegment();
            }
        });

        await sound.setRateAsync(playbackRate, true);
        await sound.playAsync();
    } catch (error) {
        console.error('Playback error:', error);
        currentSegmentIndex++;
        playNextSegment();
    }
}

/**
 * Cleans up all audio resources.
 */
async function cleanup(): Promise<void> {
    for (const segment of segments) {
        if (segment.sound) {
            try {
                await segment.sound.unloadAsync();
            } catch {}
        }
        if (segment.uri) {
            try {
                await FileSystem.deleteAsync(segment.uri, { idempotent: true });
            } catch {}
        }
    }
    segments = [];
}

export function setOnProgress(callback: (index: number, total: number) => void) {
    onProgressCallback = callback;
}

export function setOnDone(callback: () => void) {
    onDoneCallback = callback;
}

export function setPlaybackRate(rate: number) {
    playbackRate = rate;

    // Update rate on currently playing sound
    if (currentSegmentIndex >= 0 && currentSegmentIndex < segments.length) {
        const sound = segments[currentSegmentIndex].sound;
        if (sound) {
            sound.setRateAsync(rate, true).catch(() => {});
        }
    }
}

export async function speak(text: string): Promise<void> {
    await stop();

    // Configure audio mode for playback
    await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
    });

    const textSegments = segmentText(text);

    if (textSegments.length === 0) {
        onDoneCallback?.();
        return;
    }

    // Initialize segments
    segments = textSegments.map(text => ({
        text,
        sound: null,
        uri: null,
    }));

    currentSegmentIndex = 0;
    isPaused = false;
    isLoadingSegments = true;

    // Start loading first segment immediately
    try {
        await loadSegment(0);
        isLoadingSegments = false;

        // Start playback as soon as first segment is ready
        playNextSegment();

        // Pre-load second segment
        if (segments.length > 1) {
            loadSegment(1).catch(() => {});
        }
    } catch (error) {
        console.error('Failed to start TTS:', error);
        isLoadingSegments = false;
        throw error;
    }
}

export async function pause(): Promise<void> {
    isPaused = true;

    if (currentSegmentIndex >= 0 && currentSegmentIndex < segments.length) {
        const sound = segments[currentSegmentIndex].sound;
        if (sound) {
            await sound.pauseAsync();
        }
    }
}

export async function resume(): Promise<void> {
    if (!isPaused || currentSegmentIndex < 0) return;

    isPaused = false;

    if (currentSegmentIndex < segments.length) {
        const sound = segments[currentSegmentIndex].sound;
        if (sound) {
            await sound.playAsync();
        } else {
            // Sound was unloaded, try to reload and play
            playNextSegment();
        }
    }
}

export async function stop(): Promise<void> {
    isPaused = false;
    currentSegmentIndex = -1;
    isLoadingSegments = false;

    // Stop any currently playing audio
    for (const segment of segments) {
        if (segment.sound) {
            try {
                await segment.sound.stopAsync();
            } catch {}
        }
    }

    await cleanup();
}

export async function seek(progress: number): Promise<void> {
    if (segments.length === 0) return;

    const newIndex = Math.floor(progress * segments.length);
    const targetIndex = Math.max(0, Math.min(newIndex, segments.length - 1));

    if (targetIndex === currentSegmentIndex) return;

    // Stop current playback
    if (currentSegmentIndex >= 0 && currentSegmentIndex < segments.length) {
        const sound = segments[currentSegmentIndex].sound;
        if (sound) {
            await sound.stopAsync();
        }
    }

    currentSegmentIndex = targetIndex;
    onProgressCallback?.(currentSegmentIndex, segments.length);

    if (!isPaused) {
        // Ensure the new segment is loaded before playing
        if (!segments[targetIndex].sound) {
            await loadSegment(targetIndex);
        }
        playNextSegment();
    }
}

export async function speakError(): Promise<void> {
    await speak("Something went wrong. Please try again.");
}

export async function speakNoText(): Promise<void> {
    await speak("I didn't find any words in the picture. Point the camera at something with words on it and try again.");
}
