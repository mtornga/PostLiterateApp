const functions = require("firebase-functions");
const vision = require("@google-cloud/vision");

// Initialize Vision Client
const client = new vision.ImageAnnotatorClient();

/**
 * Proxies an image to Google Cloud Vision API for text detection.
 * Expects a POST request with JSON body: { "image": "BASE64_STRING" }
 */
exports.ocr = functions.https.onRequest(async (req, res) => {
    // CORS Headers (allow all origins for now, lock down later)
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.end();
        return;
    }

    try {
        const { image } = req.body;

        if (!image) {
            res.status(400).send({ error: "Missing 'image' field in request body." });
            return;
        }

        // Prepare the request for Cloud Vision
        const request = {
            image: {
                content: image,
            },
            features: [
                {
                    type: "TEXT_DETECTION",
                },
            ],
        };

        // Call the API
        const [result] = await client.annotateImage(request);
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            res.status(200).send({ text: "" });
            return;
        }

        // The first annotation contains the full text
        const fullText = detections[0].description;

        // Log for debugging
        console.log("Text Detected:", fullText.substring(0, 100) + "...");

        res.status(200).send({ text: fullText });
    } catch (error) {
        console.error("OCR Error:", error);
        res.status(500).send({ error: error.message });
    }
});
