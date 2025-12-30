import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const BUTTON_SIZE = width * 0.35;

interface GlowingButtonProps {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    onPress: () => void;
    disabled?: boolean;
    isLoading?: boolean;
}

export function GlowingButton({
    icon,
    onPress,
    disabled = false,
    isLoading = false,
}: GlowingButtonProps) {
    // Animation values for the glow effect
    const glowOpacity = useSharedValue(0.3);
    const glowScale = useSharedValue(1);

    useEffect(() => {
        if (!disabled && !isLoading) {
            // Start subtle pulsing glow animation
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(0.6, { duration: 1200 }),
                    withTiming(0.3, { duration: 1200 })
                ),
                -1, // infinite repeat
                false
            );
            glowScale.value = withRepeat(
                withSequence(
                    withTiming(1.08, { duration: 1200 }),
                    withTiming(1, { duration: 1200 })
                ),
                -1,
                false
            );
        } else {
            // Stop animation smoothly when disabled or loading
            cancelAnimation(glowOpacity);
            cancelAnimation(glowScale);
            glowOpacity.value = withTiming(0, { duration: 200 });
            glowScale.value = withTiming(1, { duration: 200 });
        }
    }, [disabled, isLoading]);

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [{ scale: glowScale.value }],
    }));

    return (
        <View style={styles.container}>
            {/* Outer glow layer */}
            <Animated.View style={[styles.glowOuter, glowStyle]} />
            {/* Inner glow layer */}
            <Animated.View style={[styles.glowInner, glowStyle]} />

            {/* Button itself */}
            <TouchableOpacity
                style={[
                    styles.button,
                    (disabled || isLoading) && styles.buttonActive,
                ]}
                onPress={onPress}
                disabled={disabled}
                activeOpacity={0.7}
            >
                {isLoading ? (
                    <ActivityIndicator size="large" color="#4ecca3" />
                ) : (
                    <MaterialCommunityIcons name={icon} size={56} color="#fff" />
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glowOuter: {
        position: 'absolute',
        width: BUTTON_SIZE + 16,
        height: BUTTON_SIZE + 16,
        borderRadius: 29,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#4ecca3',
        shadowColor: '#4ecca3',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 12,
        elevation: 8, // Android shadow
    },
    glowInner: {
        position: 'absolute',
        width: BUTTON_SIZE + 6,
        height: BUTTON_SIZE + 6,
        borderRadius: 27,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: 'rgba(78, 204, 163, 0.5)',
        shadowColor: '#4ecca3',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 4,
    },
    button: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    buttonActive: {
        backgroundColor: 'rgba(78, 204, 163, 0.2)',
        borderColor: '#4ecca3',
    },
});
