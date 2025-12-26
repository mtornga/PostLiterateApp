import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    cancelAnimation,
} from 'react-native-reanimated';
import { ExplanationLength, explainText, extractText } from '../services/backend';
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

const { width } = Dimensions.get('window');

type Mode = 'idle' | 'reading' | 'explaining' | 'speaking';
type AudioOutput = 'speaker' | 'headphones' | 'bluetooth';

export default function App() {
    console.log('Rendering App component');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
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
    const checkAudioOutput = async () => {
        try {
            // On iOS/Android, we can check if headphones are connected
            // This is a simplified check - expo-av doesn't expose detailed routing info
            // We'll use a heuristic based on audio session
            const status = await Audio.getPermissionsAsync();
            if (status.granted) {
                // Unfortunately expo-av doesn't expose audio route info directly
                // For now, we default to speaker and would need native modules for accurate detection
                // This is a placeholder that could be enhanced with expo-device or native code
                setAudioOutput('speaker');
                setAudioDeviceName(null);
            }
        } catch (error) {
            console.log('Could not check audio output:', error);
        }
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
                    }}>
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        );
    }

    async function processImage(action: 'read' | 'explain') {
        console.log(`Processing image for action: ${action}`);
        if (cameraRef.current && mode === 'idle') {
            let photoUri: string | null = null;
            try {
                setMode(action === 'read' ? 'reading' : 'explaining');
                await stop();

                console.log('Taking picture...');
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.5,
                });

                if (photo?.uri) {
                    photoUri = photo.uri;
                    console.log('Picture taken:', photo.uri);
                    setCapturedImage(photo.uri);
                    const text = await extractText(photo.uri);
                    console.log('Text extracted:', text?.substring(0, 50));

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

                    if (action === 'read') {
                        setActiveText(text);
                        setIsExplainMode(false);
                        setOriginalOcrText('');
                        await speak(text);
                    } else {
                        console.log('Calling explain service...');
                        setIsExplainMode(true);
                        setOriginalOcrText(text); // Store for re-explain with different length
                        const explanation = await explainText(text, explanationLength);
                        console.log('Explanation received:', explanation?.substring(0, 50));
                        setActiveText(explanation);
                        await speak(explanation);
                    }
                } else {
                    console.warn('No photo URI returned');
                }
            } catch (e: any) {
                console.error('Failed to process:', e);
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

    const handleSeek = async (value: number) => {
        setProgress(value);
        await seek(value);
    };

    const handleAudioIndicatorPress = async () => {
        let message = "Your phone is using the speaker.";
        if (audioOutput === 'headphones') {
            message = audioDeviceName
                ? `Your phone is using ${audioDeviceName}.`
                : "Your phone is using headphones.";
        } else if (audioOutput === 'bluetooth') {
            message = audioDeviceName
                ? `Your phone is using ${audioDeviceName}.`
                : "Your phone is using a Bluetooth device.";
        }
        await speak(message);
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

    return (
        <View style={styles.container}>
            {mode === 'speaking' ? (
                <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.contentArea}>
                    {/* Animated Sound Wave Indicator */}
                    <View style={styles.soundWaveContainer}>
                        <View style={styles.speakerIconContainer}>
                            <MaterialCommunityIcons name="volume-high" size={40} color="#4ecca3" />
                        </View>
                        <View style={styles.wavesContainer}>
                            <Animated.View style={[styles.soundWave, styles.wave1, wave1Style]} />
                            <Animated.View style={[styles.soundWave, styles.wave2, wave2Style]} />
                            <Animated.View style={[styles.soundWave, styles.wave3, wave3Style]} />
                        </View>
                    </View>

                    <View style={styles.imagePreviewContainer}>
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
                    ref={cameraRef}
                    onMountError={(err) => console.error('Camera mount error:', err)}
                />
            )}

            {/* Animated Speaker Overlay for Info Playback on Idle Screen */}
            {mode === 'idle' && isPlaying && (
                <View style={styles.idleSpeakerOverlay}>
                    <View style={styles.soundWaveContainer}>
                        <View style={styles.speakerIconContainer}>
                            <MaterialCommunityIcons name="volume-high" size={40} color="#4ecca3" />
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
            <View style={styles.controlsContainer}>
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
                            />
                        </View>

                        {/* Transport Buttons */}
                        <View style={styles.transportRow}>
                            <TouchableOpacity style={styles.transportButton} onPress={handleStop}>
                                <MaterialCommunityIcons name="stop" size={32} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.mainTransportButton} onPress={togglePlayback}>
                                <MaterialCommunityIcons
                                    name={isPlaying ? "pause" : "play"}
                                    size={48}
                                    color="#fff"
                                />
                            </TouchableOpacity>

                            <View style={styles.speedContainer}>
                                <MaterialCommunityIcons name="speedometer" size={24} color="#4ecca3" />
                                <Slider
                                    style={styles.speedSlider}
                                    minimumValue={0.5}
                                    maximumValue={2.0}
                                    step={0.25}
                                    value={rate}
                                    onValueChange={handleRateChange}
                                    minimumTrackTintColor="#4ecca3"
                                    maximumTrackTintColor="rgba(255,255,255,0.3)"
                                    thumbTintColor="#4ecca3"
                                />
                                <View style={styles.speedLabels}>
                                    <MaterialCommunityIcons name="snail" size={16} color="#aaa" />
                                    <MaterialCommunityIcons name="rabbit" size={16} color="#aaa" />
                                </View>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.buttonRow}>
                        {/* Read Button - Camera with text/speech icon */}
                        <TouchableOpacity
                            style={[styles.actionButton, mode === 'reading' && styles.activeButton]}
                            onPress={() => processImage('read')}
                            disabled={mode !== 'idle'}
                        >
                            {mode === 'reading' ? (
                                <ActivityIndicator size="large" color="#4ecca3" />
                            ) : (
                                <MaterialCommunityIcons name="clipboard-text-search" size={56} color="#fff" />
                            )}
                        </TouchableOpacity>

                        {/* Explain Button - Brain icon */}
                        <TouchableOpacity
                            style={[styles.actionButton, mode === 'explaining' && styles.activeButton]}
                            onPress={() => processImage('explain')}
                            disabled={mode !== 'idle'}
                        >
                            {mode === 'explaining' ? (
                                <ActivityIndicator size="large" color="#4ecca3" />
                            ) : (
                                <MaterialCommunityIcons name="brain" size={56} color="#fff" />
                            )}
                        </TouchableOpacity>
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
                    style={styles.infoButton}
                    onPress={handleInfoPress}
                >
                    <MaterialCommunityIcons
                        name="help-circle-outline"
                        size={28}
                        color="#fff"
                    />
                </TouchableOpacity>
            )}

            {/* Audio Output Indicator - Top Right */}
            {mode === 'idle' && (
                <TouchableOpacity
                    style={styles.audioIndicator}
                    onPress={handleAudioIndicatorPress}
                >
                    <MaterialCommunityIcons
                        name={getAudioIcon()}
                        size={28}
                        color={audioOutput === 'speaker' ? '#fff' : '#4ecca3'}
                    />
                </TouchableOpacity>
            )}

            {/* Length Selector - Only shown during explain playback */}
            {mode === 'speaking' && isExplainMode && (
                <View style={styles.lengthSelector}>
                    <TouchableOpacity
                        style={[
                            styles.lengthButton,
                            explanationLength === 'short' && styles.lengthButtonActive
                        ]}
                        onPress={() => handleLengthChange('short')}
                    >
                        <MaterialCommunityIcons
                            name="text-short"
                            size={24}
                            color={explanationLength === 'short' ? '#fff' : '#aaa'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.lengthButton,
                            explanationLength === 'medium' && styles.lengthButtonActive
                        ]}
                        onPress={() => handleLengthChange('medium')}
                    >
                        <MaterialCommunityIcons
                            name="text"
                            size={24}
                            color={explanationLength === 'medium' ? '#fff' : '#aaa'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.lengthButton,
                            explanationLength === 'long' && styles.lengthButtonActive
                        ]}
                        onPress={() => handleLengthChange('long')}
                    >
                        <MaterialCommunityIcons
                            name="text-long"
                            size={24}
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
    },
    contentArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePreviewContainer: {
        width: '100%',
        height: '60%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    capturedImage: {
        width: width * 0.8,
        height: '100%',
        borderRadius: 20,
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
        left: 0,
        right: 0,
        paddingBottom: 50,
        paddingTop: 30,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        backgroundColor: 'rgba(0,0,0,0.6)', // Fallback for BlurView
        alignItems: 'center',
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
        marginBottom: 20,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    transportRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    transportButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainTransportButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
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
        width: 140,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 10,
        borderRadius: 20,
    },
    speedSlider: {
        width: 130,
        height: 50,
    },
    speedLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10,
    },
    audioIndicator: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
        gap: 15,
    },
    lengthButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
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
        marginTop: 60,
        marginBottom: 10,
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
