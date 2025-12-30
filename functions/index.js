const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { defineString } = require("firebase-functions/params");
const vision = require("@google-cloud/vision");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const textToSpeech = require("@google-cloud/text-to-speech");

// Define Params (modern replacement for functions.config())
const geminiKey = defineString("GEMINI_API_KEY");

// Initialize Vision Client
const client = new vision.ImageAnnotatorClient();

// Initialize TTS Client
const ttsClient = new textToSpeech.TextToSpeechClient();

// Note: genAI is initialized inside the request handler or lazily
// because geminiKey.value() can only be called within a function or after it's defined.

/**
 * Proxies an image to Google Cloud Vision API for text detection.
 * Expects a POST request with JSON body: { "image": "BASE64_STRING" }
 * Or GET request for warmup pings.
 */
exports.ocr = onRequest({ cors: true }, async (req, res) => {
    // Handle warmup ping (GET or warmup flag)
    if (req.method === 'GET' || req.body?.warmup) {
        logger.info("OCR Warmup ping", { ready: !!client });
        res.status(200).send({ service: "ocr", ready: !!client });
        return;
    }

    logger.info("OCR Request Started", {
        method: req.method,
        userAgent: req.get('user-agent')
    });

    try {
        const { image } = req.body;

        if (!image) {
            logger.error("OCR Error: Missing image field");
            res.status(400).send({ error: "Missing 'image' field in request body." });
            return;
        }

        const request = {
            image: { content: image },
            features: [{ type: "TEXT_DETECTION" }],
        };

        const apiStart = Date.now();
        const [result] = await client.annotateImage(request);
        const apiDuration = Date.now() - apiStart;
        logger.info("[TIMING] Vision API", { durationMs: apiDuration });

        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            logger.info("OCR Completed: No text detected");
            res.status(200).send({ text: "" });
            return;
        }

        const fullText = detections[0].description;
        logger.info("OCR Completed Successfully", {
            textLength: fullText.length,
            detectedChars: fullText.substring(0, 50)
        });

        res.status(200).send({ text: fullText });
    } catch (error) {
        logger.error("OCR Error:", error);
        res.status(500).send({ error: error.message });
    }
});

/**
 * Explains a given text simply using Gemini.
 * Expects a POST request with JSON body: { "text": "STRING", "length": "short" | "medium" | "long" }
 * Or GET request for warmup pings.
 */
exports.explain = onRequest({ cors: true }, async (req, res) => {
    // Handle warmup ping (GET or warmup flag)
    if (req.method === 'GET' || req.body?.warmup) {
        const apiKey = geminiKey.value();
        const ready = !!apiKey && apiKey !== "dummy_key";
        logger.info("Explain Warmup ping", { ready });
        res.status(200).send({ service: "explain", ready });
        return;
    }

    logger.info("Explain Request Started", { method: req.method });

    try {
        const { text, length = "medium" } = req.body;

        if (!text) {
            logger.error("Explain Error: Missing text field");
            res.status(400).send({ error: "Missing 'text' field in request body." });
            return;
        }

        const apiKey = geminiKey.value();

        if (!apiKey || apiKey === "dummy_key") {
            logger.error("Explain Error: Gemini API key is MISSING.");
            throw new Error("Gemini API key is not configured.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelId = "gemini-2.0-flash-exp";
        const model = genAI.getGenerativeModel({ model: modelId });

        const lengthInstructions = {
            short: "Give a very brief 1-2 sentence summary. Just state what this document is and its main point.",
            medium: "Give a clear explanation in 3-5 sentences. Cover the key points someone needs to know.",
            long: "Give a thorough explanation covering all important details. Be comprehensive but still use simple language."
        };

        const prompt = `Task: Explain the following text simply and directly for someone with low literacy.

        LENGTH: ${lengthInstructions[length] || lengthInstructions.medium}

        RULES:
        - Output ONLY the explanation.
        - NO introductory or concluding sentences (e.g., NO "Here is a summary", NO "Important information follows").
        - NO markdown formatting (no *, #, -, etc.).
        - NO conversational filler.
        - Use simple, direct sentences.

        TEXT to simplify:
        ${text}`;

        logger.info("Calling Gemini API", { model: modelId, textLength: text.length });
        const apiStart = Date.now();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const explanation = response.text();
        const apiDuration = Date.now() - apiStart;
        logger.info("[TIMING] Gemini API", { durationMs: apiDuration });

        logger.info("Explain Completed Successfully", {
            explanationLength: explanation.length
        });

        res.status(200).send({ text: explanation });
    } catch (error) {
        logger.error("Explain Error:", error);

        if (error.message.includes("404") || error.message.includes("not found")) {
            res.status(500).send({
                error: `Model not found. Your API key might not have access to the requested model.`,
                details: error.message
            });
        } else {
            res.status(500).send({ error: error.message });
        }
    }
});

/**
 * Converts text to speech using Google Cloud TTS.
 * Expects a POST request with JSON body: { "text": "STRING" }
 * Returns base64-encoded MP3 audio.
 * Or GET request for warmup pings.
 */
exports.tts = onRequest({ cors: true }, async (req, res) => {
    // Handle warmup ping (GET or warmup flag)
    if (req.method === 'GET' || req.body?.warmup) {
        logger.info("TTS Warmup ping", { ready: !!ttsClient });
        res.status(200).send({ service: "tts", ready: !!ttsClient });
        return;
    }

    logger.info("TTS Request Started", { method: req.method });

    try {
        const { text } = req.body;

        if (!text) {
            logger.error("TTS Error: Missing text field");
            res.status(400).send({ error: "Missing 'text' field in request body." });
            return;
        }

        const request = {
            input: { text },
            voice: {
                languageCode: "en-US",
                name: "en-US-Neural2-J", // Natural male voice
                ssmlGender: "MALE",
            },
            audioConfig: {
                audioEncoding: "MP3",
                speakingRate: 0.95, // Slightly slower for clarity
                pitch: 0,
            },
        };

        logger.info("Calling Google Cloud TTS", { textLength: text.length });
        const apiStart = Date.now();
        const [response] = await ttsClient.synthesizeSpeech(request);
        const apiDuration = Date.now() - apiStart;
        logger.info("[TIMING] TTS API", { durationMs: apiDuration });

        logger.info("TTS Completed Successfully", {
            audioBytes: response.audioContent.length
        });

        res.status(200).send({
            audio: response.audioContent.toString("base64"),
            format: "mp3"
        });
    } catch (error) {
        logger.error("TTS Error:", error);
        res.status(500).send({ error: error.message });
    }
});

/**
 * Health check endpoint to keep functions warm.
 * Called by Cloud Scheduler every 5 minutes.
 */
exports.health = onRequest({ cors: true }, async (req, res) => {
    // Touch each client to ensure they stay initialized
    const status = {
        ok: true,
        timestamp: new Date().toISOString(),
        services: {
            vision: !!client,
            tts: !!ttsClient,
            gemini: !!geminiKey.value()
        }
    };
    logger.info("Health check", status);
    res.status(200).send(status);
});

