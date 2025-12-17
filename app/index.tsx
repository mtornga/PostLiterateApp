import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { extractText } from '../services/ocr';
import { speak, speakError, stop } from '../services/speech';

export default function App() {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [latestImage, setLatestImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (!permission) {
        // Camera permissions are still loading.
        return <View />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="grant permission" />
            </View>
        );
    }

    async function takePicture() {
        if (cameraRef.current && !loading) {
            try {
                setLoading(true);
                // Stop any previous speech when starting a new capture
                stop();

                const photo = await cameraRef.current.takePictureAsync({
                    base64: false, // We'll read it as base64 in the service
                    quality: 0.5,  // Optimize for speed/bandwidth
                });

                console.log('Image captured:', photo?.uri);

                if (photo?.uri) {
                    setLatestImage(photo.uri);

                    // Perform OCR
                    const text = await extractText(photo.uri);
                    console.log('OCR Result:', text);

                    if (text && text.trim().length > 0) {
                        speak(text);
                    } else {
                        speak("I didn't see any text.");
                    }
                }
            } catch (e) {
                console.error('Failed to process image:', e);
                speakError();
            } finally {
                setLoading(false);
            }
        }
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing="back"
                ref={cameraRef}
                onMountError={(error) => console.error("Camera mount error:", error)}
            />
            <TouchableOpacity
                style={[styles.buttonContainer, loading && styles.disabledButton]}
                onPress={takePicture}
                disabled={loading}
            >
                <View style={styles.captureButton}>
                    {loading && <ActivityIndicator size="large" color="#000" />}
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
    },
    camera: {
        flex: 1,
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 64,
        alignSelf: 'center',
        backgroundColor: 'transparent',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 5,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.7,
    },
});
