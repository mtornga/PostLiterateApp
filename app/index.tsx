import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { explainText, extractText } from '../services/backend';
import {
    pause,
    resume,
    seek,
    setOnDone,
    setOnProgress,
    setPlaybackRate,
    speak,
    speakError,
    stop
} from '../services/speech';

const { width } = Dimensions.get('window');

type Mode = 'idle' | 'reading' | 'explaining' | 'speaking';

export default function App() {
    console.log('Rendering App component');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [mode, setMode] = useState<Mode>('idle');
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [rate, setRate] = useState(0.9);
    const [activeText, setActiveText] = useState('');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    useEffect(() => {
        console.log('Camera Permission status:', permission?.status);

        setOnProgress((index, total) => {
            setProgress(index / (total - 1 || 1));
        });

        setOnDone(() => {
            setIsPlaying(false);
            setMode('idle');
            setProgress(0);
            setActiveText('');
            setCapturedImage(null);
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
            try {
                setMode(action === 'read' ? 'reading' : 'explaining');
                stop();

                console.log('Taking picture...');
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.5,
                });

                if (photo?.uri) {
                    console.log('Picture taken:', photo.uri);
                    setCapturedImage(photo.uri);
                    const text = await extractText(photo.uri);
                    console.log('Text extracted:', text?.substring(0, 50));

                    if (!text || text.trim().length === 0) {
                        speak("I didn't see any text.");
                        setMode('idle');
                        return;
                    }

                    setMode('speaking');
                    setIsPlaying(true);
                    setProgress(0);

                    if (action === 'read') {
                        setActiveText(text);
                        speak(text);
                    } else {
                        console.log('Calling explain service...');
                        const explanation = await explainText(text);
                        console.log('Explanation received:', explanation?.substring(0, 50));
                        setActiveText(explanation);
                        speak(explanation);
                    }
                } else {
                    console.warn('No photo URI returned');
                }
            } catch (e) {
                console.error('Failed to process:', e);
                speakError();
            } finally {
                setMode(prevMode => (prevMode === 'speaking' ? 'speaking' : 'idle'));
            }
        } else {
            console.log('Camera not ready or already processing', { hasRef: !!cameraRef.current, mode });
        }
    }

    const togglePlayback = () => {
        if (isPlaying) {
            pause();
            setIsPlaying(false);
        } else {
            resume();
            setIsPlaying(true);
        }
    };

    const handleStop = () => {
        stop();
        setIsPlaying(false);
        setMode('idle');
        setProgress(0);
        setActiveText('');
        setCapturedImage(null);
    };

    const handleRateChange = (newRate: number) => {
        setRate(newRate);
        setPlaybackRate(newRate);
    };

    const handleSeek = (value: number) => {
        setProgress(value);
        seek(value);
    };

    return (
        <View style={styles.container}>
            {mode === 'speaking' ? (
                <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.contentArea}>
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
                        {/* Read Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, mode === 'reading' && styles.activeButton]}
                            onPress={() => processImage('read')}
                            disabled={mode !== 'idle'}
                        >
                            {mode === 'reading' ? (
                                <ActivityIndicator size="large" color="#4ecca3" />
                            ) : (
                                <MaterialCommunityIcons name="bullhorn" size={40} color="#fff" />
                            )}
                            <Text style={styles.buttonText}>Read</Text>
                        </TouchableOpacity>

                        {/* Explain Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, mode === 'explaining' && styles.activeButton]}
                            onPress={() => processImage('explain')}
                            disabled={mode !== 'idle'}
                        >
                            {mode === 'explaining' ? (
                                <ActivityIndicator size="large" color="#4ecca3" />
                            ) : (
                                <MaterialCommunityIcons name="brain" size={40} color="#fff" />
                            )}
                            <Text style={styles.buttonText}>Explain</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Status Indicator */}
                {(mode === 'reading' || mode === 'explaining') && (
                    <Text style={styles.statusText}>
                        {mode === 'reading' ? 'Scanning text...' : 'Understanding...'}
                    </Text>
                )}
            </View>

            {/* Top Header */}
            <View style={styles.header}>
                <View style={[styles.headerBlur, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                    <Text style={styles.headerTitle}>Read For Me App</Text>
                </View>
            </View>
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
    buttonText: {
        color: '#fff',
        marginTop: 10,
        fontSize: 16,
        fontWeight: '600',
    },
    statusText: {
        color: '#4ecca3',
        marginTop: 20,
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 1,
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
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
        justifyContent: 'flex-end',
    },
    headerBlur: {
        paddingVertical: 15,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
});
