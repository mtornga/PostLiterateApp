import * as FileSystem from 'expo-file-system/legacy';

// TODO: Replace with your actual Firebase Function URL after deployment
const CLOUD_FUNCTION_URL = 'https://us-central1-post-literate-app.cloudfunctions.net/ocr';

export async function extractText(imageUri: string): Promise<string> {
    try {
        // 1. Convert image to Base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: 'base64',
        });

        // 2. Call Cloud Function
        const response = await fetch(CLOUD_FUNCTION_URL, {
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
        return data.text || "";

    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}
