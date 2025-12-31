import { GlowingButton } from '@/components/GlowingButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExplanationLength, explainImage, explainText, extractText } from '../services/backend';
import {
    pause,
    resume,
    seek,
    setOnDone,
    setOnProgress,
    setPlaybackRate,
    speak,
    speakError,
    speakNoText,
    stop
} from '../services/speech';

const { width, height } = Dimensions.get('window');
const CAMERA_RATIO = Platform.OS === 'android' ? '4:3' : undefined;
const SPEED_STEPS = [0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
const logTiming = (...args: unknown[]) => {
    if (__DEV__) {
        console.log(...args);
    }
};

type Mode = 'idle' | 'reading' | 'explaining' | 'speaking';
type AudioOutput = 'speaker' | 'headphones' | 'bluetooth';

export default function App() {
    console.log('Rendering App component');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const insets = useSafeAreaInsets();
    const [mode, setMode] = useState<Mode>('idle');
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [rate, setRate] = useState(1.0);
    const [activeText, setActiveText] = useState('');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [explanationLength, setExplanationLength] = useState<ExplanationLength>('medium');
    const [audioOutput, setAudioOutput] = useState<AudioOutput>('speaker');
    const [audioDeviceName, setAudioDeviceName] = useState<string | null>(null);
    const [isExplainMode, setIsExplainMode] = useState(false);
    const [originalOcrText, setOriginalOcrText] = useState<string>('');

    // Animated sound wave indicator - must be before any conditional returns
    const wave1Opacity = useSharedValue(0.3);
    const wave2Opacity = useSharedValue(0.3);
    const wave3Opacity = useSharedValue(0.3);
    const wave1Scale = useSharedValue(0.8);
    const wave2Scale = useSharedValue(0.8);
    const wave3Scale = useSharedValue(0.8);

    const wave1Style = useAnimatedStyle(() => ({
        opacity: wave1Opacity.value,
        transform: [{ scale: wave1Scale.value }],
    }));

    const wave2Style = useAnimatedStyle(() => ({
        opacity: wave2Opacity.value,
        transform: [{ scale: wave2Scale.value }],
    }));

    const wave3Style = useAnimatedStyle(() => ({
        opacity: wave3Opacity.value,
        transform: [{ scale: wave3Scale.value }],
    }));

    // Animation effect for sound waves - must be before any conditional returns
    useEffect(() => {
        if (isPlaying) {
            // Staggered pulsing animation for each wave
            wave1Opacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 400 }),
                    withTiming(0.3, { duration: 400 })
                ),
                -1,
                false
            );
            wave1Scale.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 400 }),
                    withTiming(0.8, { duration: 400 })
                ),
                -1,
                false
            );

            // Wave 2 starts slightly delayed
            setTimeout(() => {
                wave2Opacity.value = withRepeat(
                    withSequence(
                        withTiming(1, { duration: 400 }),
                        withTiming(0.3, { duration: 400 })
                    ),
                    -1,
                    false
                );
                wave2Scale.value = withRepeat(
                    withSequence(
                        withTiming(1, { duration: 400 }),
                        withTiming(0.8, { duration: 400 })
                    ),
                    -1,
                    false
                );
            }, 150);

            // Wave 3 starts even more delayed
            setTimeout(() => {
                wave3Opacity.value = withRepeat(
                    withSequence(
                        withTiming(1, { duration: 400 }),
                        withTiming(0.3, { duration: 400 })
                    ),
                    -1,
                    false
                );
                wave3Scale.value = withRepeat(
                    withSequence(
                        withTiming(1, { duration: 400 }),
                        withTiming(0.8, { duration: 400 })
                    ),
                    -1,
                    false
                );
            }, 300);
        } else {
            // Stop animations when paused
            cancelAnimation(wave1Opacity);
            cancelAnimation(wave2Opacity);
            cancelAnimation(wave3Opacity);
            cancelAnimation(wave1Scale);
            cancelAnimation(wave2Scale);
            cancelAnimation(wave3Scale);
            wave1Opacity.value = withTiming(0.3, { duration: 200 });
            wave2Opacity.value = withTiming(0.3, { duration: 200 });
            wave3Opacity.value = withTiming(0.3, { duration: 200 });
            wave1Scale.value = withTiming(0.8, { duration: 200 });
            wave2Scale.value = withTiming(0.8, { duration: 200 });
            wave3Scale.value = withTiming(0.8, { duration: 200 });
        }
    }, [isPlaying]);

    // Check audio output on mount and when app becomes active
    const checkAudioOutput = () => {
        // expo-audio doesn't expose routing; default to speaker for now.
        setAudioOutput('speaker');
        setAudioDeviceName(null);
    };

    useEffect(() => {
        console.log('Camera Permission status:', permission?.status);

        checkAudioOutput();

        setOnProgress((index, total) => {
            setProgress(index / (total - 1 || 1));
        });

        setOnDone(() => {
            // Don't auto-return to main screen - just pause at the end
            setIsPlaying(false);
            setProgress(1);
        });
    }, [permission]);

    if (!permission) {
        console.log('Permission is still loading...');
        return <View style={[styles.container, { backgroundColor: '#000' }]} />;
    }

    if (!permission.granted) {
        console.log('Permission not granted');
        return (
            <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.container}>
                <View style={styles.permissionContainer}>
                    <MaterialCommunityIcons name="camera-off" size={64} color="#e94560" />
                    <Text style={styles.message}>We need your permission to use the camera.</Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={() => {
                        console.log('Requesting permission');
                        requestPermission();
                    }}
                        accessibilityRole="button"
                        accessibilityLabel="Grant camera permission"
                        accessibilityHint="Allow camera access to read text"
                    >
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        );
    }

    async function processImage(action: 'read' | 'explain') {
        const pipelineStart = Date.now();
        logTiming(`[TIMING] ===== PIPELINE START: ${action} =====`);

        if (cameraRef.current && mode === 'idle') {
            let photoUri: string | null = null;
            try {
                setMode(action === 'read' ? 'reading' : 'explaining');
                await stop();

                console.log('Taking picture...');
                const captureStart = Date.now();
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.5,
                });
                const captureDuration = Date.now() - captureStart;
                logTiming(`[TIMING] Camera capture: ${captureDuration}ms`);

                if (photo?.uri) {
                    photoUri = photo.uri;
                    setCapturedImage(photo.uri);

                    if (action === 'read') {
                        const ocrStart = Date.now();
                        const text = await extractText(photo.uri);
                        const ocrDuration = Date.now() - ocrStart;
                        logTiming(`[TIMING] OCR total (frontend): ${ocrDuration}ms`);
                        logTiming(`[TIMING] Pipeline to OCR complete: ${Date.now() - pipelineStart}ms`);

                        if (!text || text.trim().length === 0) {
                            await speakNoText();
                            setMode('idle');
                            // Cleanup since we won't show it
                            if (photoUri) {
                                await FileSystem.deleteAsync(photoUri, { idempotent: true });
                                setCapturedImage(null);
                            }
                            return;
                        }

                        setMode('speaking');
                        setIsPlaying(true);
                        setProgress(0);

                        setActiveText(text);
                        setIsExplainMode(false);
                        setOriginalOcrText('');
                        logTiming(`[TIMING] Starting TTS for READ (${text.length} chars)`);
                        await speak(text);
                    } else {
                        logTiming(`[TIMING] Starting OCR+LLM explain pipeline...`);
                        const explainStart = Date.now();
                        const { ocrText, explanation } = await explainImage(photo.uri, explanationLength);
                        const explainDuration = Date.now() - explainStart;
                        logTiming(`[TIMING] Explain pipeline total (frontend): ${explainDuration}ms`);
                        logTiming(`[TIMING] Pipeline to LLM complete: ${Date.now() - pipelineStart}ms`);

                        if (!ocrText || ocrText.trim().length === 0) {
                            await speakNoText();
                            setMode('idle');
                            // Cleanup since we won't show it
                            if (photoUri) {
                                await FileSystem.deleteAsync(photoUri, { idempotent: true });
                                setCapturedImage(null);
                            }
                            return;
                        }

                        setMode('speaking');
                        setIsPlaying(true);
                        setProgress(0);

                        setIsExplainMode(true);
                        setOriginalOcrText(ocrText); // Store for re-explain with different length
                        setActiveText(explanation);
                        logTiming(`[TIMING] Starting TTS for EXPLAIN (${explanation.length} chars)`);
                        await speak(explanation);
                    }

                    logTiming(`[TIMING] ===== PIPELINE COMPLETE: ${Date.now() - pipelineStart}ms =====`);
                } else {
                    console.warn('No photo URI returned');
                }
            } catch (e: any) {
                console.error('Failed to process:', e);
                logTiming(`[TIMING] ===== PIPELINE ERROR at ${Date.now() - pipelineStart}ms =====`);
                if (e.message === 'DAILY_LIMIT_REACHED') {
                    await speak("You have used all your requests for today. Please come back tomorrow.");
                } else {
                    await speakError();
                }
                // Cleanup on error
                if (photoUri) {
                    await FileSystem.deleteAsync(photoUri, { idempotent: true });
                    setCapturedImage(null);
                }
            } finally {
                setMode(prevMode => (prevMode === 'speaking' ? 'speaking' : 'idle'));
            }
        } else {
            console.log('Camera not ready or already processing', { hasRef: !!cameraRef.current, mode });
        }
    }

    const togglePlayback = async () => {
        if (isPlaying) {
            await pause();
            setIsPlaying(false);
        } else {
            await resume();
            setIsPlaying(true);
        }
    };

    const handleStop = async () => {
        await stop();
        setIsPlaying(false);
        setMode('idle');
        setProgress(0);
        setActiveText('');
        setIsExplainMode(false);
        setOriginalOcrText('');
        if (capturedImage) {
            try {
                await FileSystem.deleteAsync(capturedImage, { idempotent: true });
            } catch (e) {
                console.warn('Failed to delete image:', e);
            }
            setCapturedImage(null);
        }
    };

    const handleRateChange = (newRate: number) => {
        setRate(newRate);
        setPlaybackRate(newRate);
    };

    const getClosestSpeedIndex = (value: number) => {
        let closestIndex = 0;
        let smallestDiff = Math.abs(SPEED_STEPS[0] - value);
        for (let i = 1; i < SPEED_STEPS.length; i += 1) {
            const diff = Math.abs(SPEED_STEPS[i] - value);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestIndex = i;
            }
        }
        return closestIndex;
    };

    const stepPlaybackRate = (direction: 'down' | 'up') => {
        const currentIndex = getClosestSpeedIndex(rate);
        const nextIndex = direction === 'down'
            ? Math.max(0, currentIndex - 1)
            : Math.min(SPEED_STEPS.length - 1, currentIndex + 1);
        const nextRate = SPEED_STEPS[nextIndex];
        handleRateChange(nextRate);
    };

    const handleSeek = async (value: number) => {
        setProgress(value);
        await seek(value);
    };

    const handleAudioIndicatorPress = async () => {
        await speak("Sound check. This is where the app's voice will play.");
    };

    const handleInfoPress = async () => {
        setIsPlaying(true);
        await speak("Point your camera at any words. Tap the clipboard to hear them spoken aloud. Tap the brain to hear a quick explanation. This app respects your privacy and forgets everything after it speaks.");
        // Note: setIsPlaying(false) is handled by the onDone callback set in useEffect
    };

    const handleLengthChange = async (newLength: ExplanationLength) => {
        if (newLength === explanationLength) return;

        setExplanationLength(newLength);

        // If we have original OCR text, re-explain with new length
        if (isExplainMode && originalOcrText) {
            await stop();
            setIsPlaying(true);
            setProgress(0);

            try {
                console.log('Re-explaining with length:', newLength);
                const explanation = await explainText(originalOcrText, newLength);
                setActiveText(explanation);
                await speak(explanation);
            } catch (error) {
                console.error('Failed to re-explain:', error);
                await speakError();
            }
        }
    };

    const getAudioIcon = (): "volume-high" | "headphones" | "bluetooth-audio" => {
        switch (audioOutput) {
            case 'headphones':
                return 'headphones';
            case 'bluetooth':
                return 'bluetooth-audio';
            default:
                return 'volume-high';
        }
    };

    const speedIndex = getClosestSpeedIndex(rate);
    const canDecreaseSpeed = speedIndex > 0;
    const canIncreaseSpeed = speedIndex < SPEED_STEPS.length - 1;

    return (
        <View style={styles.container}>
            {mode === 'speaking' ? (
                <LinearGradient
                    colors={['#1a1a2e', '#16213e']}
                    style={[styles.contentArea, {
                        paddingBottom: 200 + insets.bottom,
                        paddingTop: insets.top + 90
                    }]}
                >
                    <View style={styles.imagePreviewContainer}>
                        {/* Animated Sound Wave Indicator (overlayed on image) */}
                        <View style={[styles.soundWaveContainer, styles.soundWaveOverlayOnImage]}>
                            <View style={styles.speakerIconContainer}>
                                <MaterialCommunityIcons name="volume-high" size={44} color="#4ecca3" />
                            </View>
                            <View style={styles.wavesContainer}>
                                <Animated.View style={[styles.soundWave, styles.wave1, wave1Style]} />
                                <Animated.View style={[styles.soundWave, styles.wave2, wave2Style]} />
                                <Animated.View style={[styles.soundWave, styles.wave3, wave3Style]} />
                            </View>
                        </View>

                        {capturedImage && (
                            <Image
                                source={{ uri: capturedImage }}
                                style={styles.capturedImage}
                                contentFit="contain"
                            />
                        )}
                    </View>
                </LinearGradient>
            ) : (
                <CameraView
                    style={styles.camera}
                    facing="back"
                    ratio={CAMERA_RATIO}
                    ref={cameraRef}
                    onMountError={(err) => console.error('Camera mount error:', err)}
                />
            )}

            {/* Animated Speaker Overlay for Info Playback on Idle Screen */}
            {mode === 'idle' && isPlaying && (
                <View style={styles.idleSpeakerOverlay}>
                    <View style={[styles.soundWaveContainer, styles.soundWaveContainerIdle]}>
                        <View style={styles.speakerIconContainer}>
                            <MaterialCommunityIcons name="volume-high" size={44} color="#4ecca3" />
                        </View>
                        <View style={styles.wavesContainer}>
                            <Animated.View style={[styles.soundWave, styles.wave1, wave1Style]} />
                            <Animated.View style={[styles.soundWave, styles.wave2, wave2Style]} />
                            <Animated.View style={[styles.soundWave, styles.wave3, wave3Style]} />
                        </View>
                    </View>
                </View>
            )}

            {/* Controls Overlay - Using semi-transparent View instead of BlurView for stability */}
            <View
                style={[
                    styles.controlsContainer,
                    mode === 'speaking' ? styles.controlsContainerSpeaking : styles.controlsContainerIdle,
                    { paddingBottom: 32 + insets.bottom, paddingTop: mode === 'speaking' ? 40 : 48 },
                ]}
            >
                {mode === 'speaking' ? (
                    <View style={styles.playbackControls}>
                        {/* Progress Bar */}
                        <View style={styles.progressContainer}>
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={1}
                                value={progress}
                                onValueChange={handleSeek}
                                minimumTrackTintColor="#4ecca3"
                                maximumTrackTintColor="rgba(255,255,255,0.3)"
                                thumbTintColor="#4ecca3"
                                accessibilityRole="adjustable"
                                accessibilityLabel="Playback progress"
                                accessibilityHint="Swipe up or down to change playback position"
                                accessibilityValue={{ min: 0, max: 1, now: progress }}
                            />
                        </View>

                        {/* Transport Buttons */}
                        <View style={styles.transportRow}>
                            <TouchableOpacity
                                style={styles.transportButton}
                                onPress={handleStop}
                                accessibilityRole="button"
                                accessibilityLabel="Back to camera"
                                accessibilityHint="Stop playback and return to the camera"
                            >
                                <MaterialCommunityIcons name="camera" size={38} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.mainTransportButton}
                                onPress={togglePlayback}
                                accessibilityRole="button"
                                accessibilityLabel={isPlaying ? "Pause" : "Play"}
                                accessibilityHint="Pause or resume speech"
                            >
                                <MaterialCommunityIcons
                                    name={isPlaying ? "pause" : "play"}
                                    size={56}
                                    color="#fff"
                                />
                            </TouchableOpacity>

                            <View style={styles.speedContainer}>
                                <TouchableOpacity
                                    style={[styles.speedButton, !canDecreaseSpeed && styles.speedButtonDisabled]}
                                    onPress={() => stepPlaybackRate('down')}
                                    disabled={!canDecreaseSpeed}
                                    accessibilityRole="button"
                                    accessibilityLabel="Slow down speech"
                                    accessibilityHint="Decrease the speaking speed"
                                >
                                    <MaterialCommunityIcons
                                        name="snail"
                                        size={32}
                                        color={canDecreaseSpeed ? '#fff' : 'rgba(255,255,255,0.4)'}
                                    />
                                </TouchableOpacity>
                                <Text style={styles.speedValueText}>{rate.toFixed(1)}x</Text>
                                <TouchableOpacity
                                    style={[styles.speedButton, !canIncreaseSpeed && styles.speedButtonDisabled]}
                                    onPress={() => stepPlaybackRate('up')}
                                    disabled={!canIncreaseSpeed}
                                    accessibilityRole="button"
                                    accessibilityLabel="Speed up speech"
                                    accessibilityHint="Increase the speaking speed"
                                >
                                    <MaterialCommunityIcons
                                        name="rabbit"
                                        size={32}
                                        color={canIncreaseSpeed ? '#fff' : 'rgba(255,255,255,0.4)'}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.buttonRow}>
                        {/* Read Button - with glowing pulse animation */}
                        <GlowingButton
                            icon="clipboard-text-search"
                            onPress={() => processImage('read')}
                            disabled={mode !== 'idle'}
                            isLoading={mode === 'reading'}
                            label="Read"
                            accessibilityLabel="Read text"
                            accessibilityHint="Take a photo and read the text aloud"
                        />

                        {/* Explain Button - with glowing pulse animation */}
                        <GlowingButton
                            icon="brain"
                            onPress={() => processImage('explain')}
                            disabled={mode !== 'idle'}
                            isLoading={mode === 'explaining'}
                            label="Explain"
                            accessibilityLabel="Explain text"
                            accessibilityHint="Take a photo and explain the text aloud"
                        />
                    </View>
                )}

                {/* Status Indicator - now icon-only */}
                {(mode === 'reading' || mode === 'explaining') && (
                    <View style={styles.statusIndicator}>
                        <ActivityIndicator size="small" color="#4ecca3" />
                    </View>
                )}
            </View>

            {/* Info Button - Top Left */}
            {mode === 'idle' && (
                <TouchableOpacity
                    style={[styles.infoButton, { top: insets.top + 12 }]}
                    onPress={handleInfoPress}
                    accessibilityRole="button"
                    accessibilityLabel="Help"
                    accessibilityHint="Hear instructions and a privacy note"
                >
                    <MaterialCommunityIcons
                        name="help-circle-outline"
                        size={40}
                        color="#fff"
                    />
                </TouchableOpacity>
            )}

            {/* Audio Output Indicator - Top Right */}
            {mode === 'idle' && (
                <TouchableOpacity
                    style={[styles.audioIndicator, { top: insets.top + 12 }]}
                    onPress={handleAudioIndicatorPress}
                    accessibilityRole="button"
                    accessibilityLabel="Audio output"
                    accessibilityHint="Hear which audio device is in use"
                >
                    <MaterialCommunityIcons
                        name={getAudioIcon()}
                        size={40}
                        color={audioOutput === 'speaker' ? '#fff' : '#4ecca3'}
                    />
                </TouchableOpacity>
            )}

            {/* Length Selector - Only shown during explain playback */}
            {mode === 'speaking' && isExplainMode && (
                <View style={[styles.lengthSelector, { top: insets.top + 12 }]}>
                    <TouchableOpacity
                        style={[
                            styles.lengthButton,
                            explanationLength === 'short' && styles.lengthButtonActive
                        ]}
                        onPress={() => handleLengthChange('short')}
                        accessibilityRole="button"
                        accessibilityLabel="Short explanation"
                        accessibilityState={{ selected: explanationLength === 'short' }}
                    >
                        <MaterialCommunityIcons
                            name="text-short"
                            size={34}
                            color={explanationLength === 'short' ? '#fff' : '#aaa'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.lengthButton,
                            explanationLength === 'medium' && styles.lengthButtonActive
                        ]}
                        onPress={() => handleLengthChange('medium')}
                        accessibilityRole="button"
                        accessibilityLabel="Medium explanation"
                        accessibilityState={{ selected: explanationLength === 'medium' }}
                    >
                        <MaterialCommunityIcons
                            name="text"
                            size={34}
                            color={explanationLength === 'medium' ? '#fff' : '#aaa'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.lengthButton,
                            explanationLength === 'long' && styles.lengthButtonActive
                        ]}
                        onPress={() => handleLengthChange('long')}
                        accessibilityRole="button"
                        accessibilityLabel="Long explanation"
                        accessibilityState={{ selected: explanationLength === 'long' }}
                    >
                        <MaterialCommunityIcons
                            name="text-long"
                            size={34}
                            color={explanationLength === 'long' ? '#fff' : '#aaa'}
                        />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        backgroundColor: '#000',
    },
    contentArea: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingTop: 0,
    },
    imagePreviewContainer: {
        width: '100%',
        flex: 1,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 12,
    },
    capturedImage: {
        width: width * 0.82,
        height: '100%',
        borderRadius: 22,
        backgroundColor: '#000',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    message: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    permissionButton: {
        backgroundColor: '#e94560',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 30,
    },
    permissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    controlsContainer: {
        position: 'absolute',
        bottom: 0,
        left: -2,
        right: -2,
        paddingBottom: 64,
        paddingTop: 36,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        alignItems: 'center',
    },
    controlsContainerIdle: {
        backgroundColor: '#05070d',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    controlsContainerSpeaking: {
        backgroundColor: '#05070d',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        width: '100%',
        paddingHorizontal: 20,
    },
    actionButton: {
        width: width * 0.35,
        height: width * 0.35,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    activeButton: {
        backgroundColor: 'rgba(78, 204, 163, 0.2)',
        borderColor: '#4ecca3',
    },
    buttonIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonIconOverlay: {
        marginTop: -5,
    },
    statusIndicator: {
        marginTop: 20,
    },
    playbackControls: {
        width: '100%',
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    progressContainer: {
        width: '100%',
        marginBottom: 4,
    },
    slider: {
        width: '100%',
        height: 24,
    },
    transportRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    transportButton: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainTransportButton: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#4ecca3',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4ecca3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    speedContainer: {
        width: 176,
        height: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        borderRadius: 36,
    },
    speedButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    speedButtonDisabled: {
        opacity: 0.5,
    },
    speedValueText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    audioIndicator: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lengthSelector: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 18,
    },
    lengthButton: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    lengthButtonActive: {
        backgroundColor: '#4ecca3',
        borderColor: '#4ecca3',
    },
    idleSpeakerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    soundWaveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 0,
        marginBottom: 0,
    },
    soundWaveOverlayOnImage: {
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        zIndex: 2,
        marginTop: 0,
        pointerEvents: 'none',
    },
    soundWaveContainerIdle: {
        marginTop: 40,
        marginBottom: 6,
    },
    speakerIconContainer: {
        zIndex: 1,
    },
    wavesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -5,
    },
    soundWave: {
        width: 4,
        backgroundColor: '#4ecca3',
        borderRadius: 2,
        marginHorizontal: 3,
    },
    wave1: {
        height: 20,
    },
    wave2: {
        height: 35,
    },
    wave3: {
        height: 25,
    },
});
