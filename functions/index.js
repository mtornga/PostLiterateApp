const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Logging } = require("@google-cloud/logging");
const vision = require("@google-cloud/vision");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const textToSpeech = require("@google-cloud/text-to-speech");

// Define Params (modern replacement for functions.config())
const geminiKey = defineString("GEMINI_API_KEY");
const geminiPrimaryModel = defineString("GEMINI_MODEL_PRIMARY");
const geminiSecondaryModel = defineString("GEMINI_MODEL_SECONDARY");
const geminiSecondaryRate = defineString("GEMINI_MODEL_SECONDARY_RATE");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const logging = new Logging();

// Initialize Vision Client
const client = new vision.ImageAnnotatorClient();

// Initialize TTS Client
const ttsClient = new textToSpeech.TextToSpeechClient();

// Note: genAI is initialized inside the request handler or lazily
// because geminiKey.value() can only be called within a function or after it's defined.
const LENGTH_INSTRUCTIONS = {
    short: "Give a very brief 1-2 sentence summary. Just state what this document is and its main point.",
    medium: "Give a clear explanation in 3-5 sentences. Cover the key points someone needs to know.",
    long: "Give a thorough explanation covering all important details. Be comprehensive but still use simple language."
};

function buildExplainPrompt(text, length) {
    const lengthInstruction = LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium;
    return `Task: Explain the following text simply and directly for someone with low literacy.

        LENGTH: ${lengthInstruction}

        RULES:
        - Output ONLY the explanation.
        - NO introductory or concluding sentences (e.g., NO "Here is a summary", NO "Important information follows").
        - NO markdown formatting (no *, #, -, etc.).
        - NO conversational filler.
        - Use simple, direct sentences.

        TEXT to simplify:
        ${text}`;
}

function parseSecondaryRate(value) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), 1);
}

function selectGeminiModel() {
    const primaryModel = geminiPrimaryModel.value() || "gemini-2.0-flash-exp";
    const secondaryModel = geminiSecondaryModel.value() || "";
    const secondaryRate = parseSecondaryRate(geminiSecondaryRate.value() || "0");
    const useSecondary = secondaryModel && secondaryRate > 0 && Math.random() < secondaryRate;

    return {
        modelId: useSecondary ? secondaryModel : primaryModel,
        variant: useSecondary ? "secondary" : "primary",
        secondaryRate,
        primaryModel,
        secondaryModel: secondaryModel || null,
    };
}

function formatDateUTC(date) {
    return date.toISOString().slice(0, 10);
}

function getUtcDayRange(date) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
    return { start, end };
}

async function countLogEntries(eventName, start, end) {
    const filter = [
        `timestamp>="${start.toISOString()}"`,
        `timestamp<"${end.toISOString()}"`,
        `jsonPayload.event="${eventName}"`,
        `jsonPayload.method="POST"`
    ].join(" AND ");

    const [entries] = await logging.getEntries({ filter });
    return entries.length;
}

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
        userAgent: req.get('user-agent'),
        event: "ocr_request"
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

    logger.info("Explain Request Started", { method: req.method, event: "explain_request" });

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
        const modelSelection = selectGeminiModel();
        const model = genAI.getGenerativeModel({ model: modelSelection.modelId });

        const prompt = buildExplainPrompt(text, length);

        logger.info("LLM Model Selected", {
            event: "llm_model_selected",
            model: modelSelection.modelId,
            variant: modelSelection.variant,
            secondaryRate: modelSelection.secondaryRate,
            pipeline: "explain"
        });

        logger.info("Calling Gemini API", {
            model: modelSelection.modelId,
            variant: modelSelection.variant,
            textLength: text.length
        });
        const apiStart = Date.now();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const explanation = response.text();
        const apiDuration = Date.now() - apiStart;
        logger.info("[TIMING] Gemini API", {
            durationMs: apiDuration,
            model: modelSelection.modelId,
            variant: modelSelection.variant
        });

        logger.info("Explain Completed Successfully", {
            explanationLength: explanation.length,
            model: modelSelection.modelId,
            variant: modelSelection.variant
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
 * Combined OCR + Explain pipeline for a single round-trip.
 * Expects a POST request with JSON body: { "image": "BASE64_STRING", "length": "short" | "medium" | "long" }
 * Or GET request for warmup pings.
 */
exports.explainPipeline = onRequest({ cors: true }, async (req, res) => {
    // Handle warmup ping (GET or warmup flag)
    if (req.method === 'GET' || req.body?.warmup) {
        const apiKey = geminiKey.value();
        const ready = !!apiKey && apiKey !== "dummy_key";
        logger.info("ExplainPipeline Warmup ping", { ready });
        res.status(200).send({ service: "explainPipeline", ready });
        return;
    }

    logger.info("ExplainPipeline Request Started", { method: req.method, event: "explain_pipeline_request" });

    try {
        const { image, length = "medium" } = req.body;

        if (!image) {
            logger.error("ExplainPipeline Error: Missing image field");
            res.status(400).send({ error: "Missing 'image' field in request body." });
            return;
        }

        const request = {
            image: { content: image },
            features: [{ type: "TEXT_DETECTION" }],
        };

        const ocrStart = Date.now();
        const [result] = await client.annotateImage(request);
        const ocrDuration = Date.now() - ocrStart;
        logger.info("[TIMING] Vision API", { durationMs: ocrDuration, pipeline: "explainPipeline" });

        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            logger.info("ExplainPipeline Completed: No text detected");
            res.status(200).send({ ocrText: "", explanation: "" });
            return;
        }

        const fullText = detections[0].description;

        const apiKey = geminiKey.value();
        if (!apiKey || apiKey === "dummy_key") {
            logger.error("ExplainPipeline Error: Gemini API key is MISSING.");
            throw new Error("Gemini API key is not configured.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelSelection = selectGeminiModel();
        const model = genAI.getGenerativeModel({ model: modelSelection.modelId });

        const prompt = buildExplainPrompt(fullText, length);

        logger.info("LLM Model Selected", {
            event: "llm_model_selected",
            model: modelSelection.modelId,
            variant: modelSelection.variant,
            secondaryRate: modelSelection.secondaryRate,
            pipeline: "explainPipeline"
        });

        logger.info("ExplainPipeline Calling Gemini API", {
            model: modelSelection.modelId,
            variant: modelSelection.variant,
            textLength: fullText.length
        });
        const apiStart = Date.now();
        const llmResult = await model.generateContent(prompt);
        const response = await llmResult.response;
        const explanation = response.text();
        const apiDuration = Date.now() - apiStart;
        logger.info("[TIMING] Gemini API", {
            durationMs: apiDuration,
            pipeline: "explainPipeline",
            model: modelSelection.modelId,
            variant: modelSelection.variant
        });

        logger.info("ExplainPipeline Completed Successfully", {
            ocrTextLength: fullText.length,
            explanationLength: explanation.length,
            model: modelSelection.modelId,
            variant: modelSelection.variant
        });

        res.status(200).send({ ocrText: fullText, explanation });
    } catch (error) {
        logger.error("ExplainPipeline Error:", error);

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

    logger.info("TTS Request Started", { method: req.method, event: "tts_request" });

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

/**
 * Returns daily request counts for charting on a website.
 * Query params:
 * - days: number of days to return (default 30, max 365)
 */
exports.getDailyUsage = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== "GET") {
        res.status(405).send({ error: "Method not allowed" });
        return;
    }

    const daysParam = parseInt(req.query.days, 10);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;

    const now = new Date();
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() - (days - 1)));
    const startKey = formatDateUTC(startDate);
    const endKey = formatDateUTC(endDate);

    try {
        const snapshot = await db
            .collection("metrics_daily")
            .where("date", ">=", startKey)
            .where("date", "<=", endKey)
            .orderBy("date", "asc")
            .get();

        const byDate = new Map();
        snapshot.forEach(doc => {
            byDate.set(doc.id, doc.data());
        });

        const items = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + i));
            const dateKey = formatDateUTC(date);
            const data = byDate.get(dateKey);

            items.push({
                date: dateKey,
                ocrRequests: data?.ocrRequests ?? 0,
                explainPipelineRequests: data?.explainPipelineRequests ?? 0,
                explainRequests: data?.explainRequests ?? 0,
            });
        }

        res.set("Cache-Control", "public, max-age=300");
        res.status(200).send({
            days,
            rangeStart: startKey,
            rangeEnd: endKey,
            items,
        });
    } catch (error) {
        logger.error("Daily usage fetch failed", { error: error?.message });
        res.status(500).send({ error: "Failed to fetch daily usage" });
    }
});

/**
 * Aggregates daily request counts into Firestore for time-series charts.
 * Runs every day at 01:00 UTC and writes counts for the previous day.
 */
exports.aggregateDailyUsage = onSchedule(
    { schedule: "0 1 * * *", timeZone: "Etc/UTC", region: "us-central1" },
    async () => {
        const now = new Date();
        const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
        const { start, end } = getUtcDayRange(target);
        const dateKey = formatDateUTC(target);

        try {
            const [ocrCount, explainPipelineCount, explainCount] = await Promise.all([
                countLogEntries("ocr_request", start, end),
                countLogEntries("explain_pipeline_request", start, end),
                countLogEntries("explain_request", start, end),
            ]);

            await db.collection("metrics_daily").doc(dateKey).set(
                {
                    date: dateKey,
                    ocrRequests: ocrCount,
                    explainPipelineRequests: explainPipelineCount,
                    explainRequests: explainCount,
                    rangeStart: start.toISOString(),
                    rangeEnd: end.toISOString(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            logger.info("Daily usage aggregated", {
                date: dateKey,
                ocrRequests: ocrCount,
                explainPipelineRequests: explainPipelineCount,
                explainRequests: explainCount,
            });
        } catch (error) {
            logger.error("Daily usage aggregation failed", { error: error?.message });
            throw error;
        }
    }
);
