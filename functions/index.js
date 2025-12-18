const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { defineString } = require("firebase-functions/params");
const vision = require("@google-cloud/vision");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Define Params (modern replacement for functions.config())
const geminiKey = defineString("GEMINI_API_KEY");

// Initialize Vision Client
const client = new vision.ImageAnnotatorClient();

// Note: genAI is initialized inside the request handler or lazily
// because geminiKey.value() can only be called within a function or after it's defined.

/**
 * Proxies an image to Google Cloud Vision API for text detection.
 * Expects a POST request with JSON body: { "image": "BASE64_STRING" }
 */
exports.ocr = onRequest({ cors: true }, async (req, res) => {
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

        const [result] = await client.annotateImage(request);
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
 * Expects a POST request with JSON body: { "text": "STRING" }
 */
exports.explain = onRequest({ cors: true }, async (req, res) => {
    logger.info("Explain Request Started", { method: req.method });

    try {
        const { text } = req.body;

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

        logger.info("Calling Gemini API", { model: modelId, textLength: text.length });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const explanation = response.text();

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
