import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const BASE_URL = 'https://us-central1-post-literate-app.cloudfunctions.net';
const USAGE_KEY = 'daily_usage_counter';
const DATE_KEY = 'last_usage_date';
const DAILY_LIMIT = 60;
const logTiming = (...args: unknown[]) => {
    if (__DEV__) {
        console.log(...args);
    }
};

async function encodeImageToBase64(imageUri: string): Promise<string> {
    const encodeStart = Date.now();
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
    });
    const encodeDuration = Date.now() - encodeStart;
    logTiming(`[TIMING] OCR base64 encode: ${encodeDuration}ms`);
    return base64;
}

async function checkAndIncrementUsage(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = await AsyncStorage.getItem(DATE_KEY);
    let currentUsage = parseInt(await AsyncStorage.getItem(USAGE_KEY) || '0', 10);

    if (lastDate !== today) {
        // Reset for a new day
        currentUsage = 0;
        await AsyncStorage.setItem(DATE_KEY, today);
    }

    if (currentUsage >= DAILY_LIMIT) {
        throw new Error('DAILY_LIMIT_REACHED');
    }

    await AsyncStorage.setItem(USAGE_KEY, (currentUsage + 1).toString());
}

export async function extractText(imageUri: string): Promise<string> {
    const totalStart = Date.now();
    try {
        await checkAndIncrementUsage();

        const base64 = await encodeImageToBase64(imageUri);

        const fetchStart = Date.now();
        const response = await fetch(`${BASE_URL}/ocr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OCR Request failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const fetchDuration = Date.now() - fetchStart;
        const totalDuration = Date.now() - totalStart;
        logTiming(`[TIMING] OCR network: ${fetchDuration}ms, total: ${totalDuration}ms`);

        return data.text || "";
    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}

export type ExplanationLength = 'short' | 'medium' | 'long';

export type ExplainPipelineResult = {
    ocrText: string;
    explanation: string;
};

export async function explainText(text: string, length: ExplanationLength = 'medium'): Promise<string> {
    const totalStart = Date.now();
    try {
        await checkAndIncrementUsage();

        const fetchStart = Date.now();
        const response = await fetch(`${BASE_URL}/explain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, length }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Explain Request failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const fetchDuration = Date.now() - fetchStart;
        const totalDuration = Date.now() - totalStart;
        logTiming(`[TIMING] LLM network: ${fetchDuration}ms, total: ${totalDuration}ms`);

        return data.text || "";
    } catch (error) {
        console.error('Explain Error:', error);
        throw error;
    }
}

export async function explainImage(
    imageUri: string,
    length: ExplanationLength = 'medium'
): Promise<ExplainPipelineResult> {
    const totalStart = Date.now();
    try {
        await checkAndIncrementUsage();

        const base64 = await encodeImageToBase64(imageUri);

        const fetchStart = Date.now();
        const response = await fetch(`${BASE_URL}/explainPipeline`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64, length }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Explain Pipeline Request failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const fetchDuration = Date.now() - fetchStart;
        const totalDuration = Date.now() - totalStart;
        logTiming(`[TIMING] Explain pipeline network: ${fetchDuration}ms, total: ${totalDuration}ms`);

        return {
            ocrText: data.ocrText || "",
            explanation: data.explanation || "",
        };
    } catch (error) {
        console.error('Explain Pipeline Error:', error);
        throw error;
    }
}
