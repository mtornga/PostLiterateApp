import * as FileSystem from 'expo-file-system/legacy';

const BASE_URL = 'https://us-central1-post-literate-app.cloudfunctions.net';

export async function extractText(imageUri: string): Promise<string> {
    try {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: 'base64',
        });

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
        return data.text || "";
    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}

export async function explainText(text: string): Promise<string> {
    try {
        const response = await fetch(`${BASE_URL}/explain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Explain Request failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        return data.text || "";
    } catch (error) {
        console.error('Explain Error:', error);
        throw error;
    }
}
