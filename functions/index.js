const functions = require("firebase-functions");
const vision = require("@google-cloud/vision");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Vision Client
const client = new vision.ImageAnnotatorClient();

// Initialize Gemini
// We check for key in functions config (Gen 1 standard) or env var
const genAI = new GoogleGenerativeAI(
    functions.config().gemini?.key || process.env.GEMINI_API_KEY || "dummy_key"
);

/**
 * Proxies an image to Google Cloud Vision API for text detection.
 * Expects a POST request with JSON body: { "image": "BASE64_STRING" }
 */
exports.ocr = functions.https.onRequest(async (req, res) => {
    // CORS Headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { image } = req.body;

        if (!image) {
            res.status(400).send({ error: "Missing 'image' field in request body." });
            return;
        }

        const request = {
            image: { content: image },
            features: [{ type: "TEXT_DETECTION" }],
        };

        const [result] = await client.annotateImage(request);
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            res.status(200).send({ text: "" });
            return;
        }

        const fullText = detections[0].description;
        console.log("Text Detected:", fullText.substring(0, 100) + "...");

        res.status(200).send({ text: fullText });
    } catch (error) {
        console.error("OCR Error:", error);
        res.status(500).send({ error: error.message });
    }
});

/**
 * Explains a given text simply using Gemini.
 * Expects a POST request with JSON body: { "text": "STRING" }
 */
exports.explain = functions.https.onRequest(async (req, res) => {
    // CORS Headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { text } = req.body;

        if (!text) {
            res.status(400).send({ error: "Missing 'text' field in request body." });
            return;
        }

        const config = functions.config();
        const apiKey = config.gemini?.key || process.env.GEMINI_API_KEY;

        if (!apiKey || apiKey === "dummy_key") {
            console.error("DIAGNOSTIC: Gemini API key is MISSING from config.");
            throw new Error("Gemini API key is not configured.");
        } else {
            console.log(`DIAGNOSTIC: Key loaded! Length: ${apiKey.length}, Prefix: ${apiKey.substring(0, 4)}...`);
        }

        // VERSION 3.0 - Trying Gemini 2.0 Flash Experimental
        const genAI = new GoogleGenerativeAI(apiKey);

        let modelId = "gemini-2.0-flash-exp";
        console.log(`DIAGNOSTIC (V3.0): Using model ${modelId}`);

        const model = genAI.getGenerativeModel({ model: modelId });

        const prompt = `Task: Explain the following text simply and directly for someone with low literacy.
        
        RULES:
        - Output ONLY the explanation.
        - NO introductory or concluding sentences (e.g., NO "Here is a summary", NO "Important information follows").
        - NO markdown formatting (no *, #, -, etc.).
        - NO conversational filler.
        - Use simple, direct sentences. 
        - Keep it very concise.

        TEXT to simplify:
        ${text}`;

        console.log("DIAGNOSTIC (V3.0): Calling generateContent...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const explanation = response.text();

        console.log("Explanation generated successfully (V3.0).");

        res.status(200).send({ text: explanation });
    } catch (error) {
        console.error("Explain Error (V3.0):", error);

        // If it's a 404, let's try to hint at what's wrong
        if (error.message.includes("404") || error.message.includes("not found")) {
            res.status(500).send({
                error: `Model not found. Your API key might not have access to ${error.message.split('models/')[1]?.split(' ')[0] || 'the requested model'}.`,
                details: error.message
            });
        } else {
            res.status(500).send({ error: error.message });
        }
    }
});
