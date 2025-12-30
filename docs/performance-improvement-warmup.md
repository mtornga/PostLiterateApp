# Performance Improvement: Function Warm-up

**Date:** 2024-12-30
**Impact:** 3.2x faster first request, 4x faster time to first audio

---

## The Problem

Firebase Cloud Functions (Gen2) run on Google Cloud Run, which scales to zero when idle. This means:

- After ~15 minutes of no traffic, instances shut down
- The next request triggers a **cold start**: spinning up a new container
- Cold starts were adding **3+ seconds per function**
- With 3 functions in sequence (OCR → LLM → TTS), users waited **10+ seconds**

### Before: Cold Start Performance

| Metric | Cold Start | Warm |
|--------|------------|------|
| **Total Pipeline** | **10,724ms** | 2,525ms |
| **Time to First Audio** | **3,147ms** | 387ms |
| OCR | 3,834ms | 739ms |
| LLM | 3,271ms | 961ms |
| TTS (1st segment) | 3,081ms | 334ms |

Users experienced **10+ second waits** on their first request of the day, or after any period of inactivity. This was unacceptable for an app targeting users who need quick, frictionless assistance.

---

## The Solution

### Cloud Scheduler Warm-up Pings

We configured Google Cloud Scheduler to ping each function every 5 minutes:

```
warm-ocr     → GET https://.../ocr      */5 * * * *
warm-explain → GET https://.../explain  */5 * * * *
warm-tts     → GET https://.../tts      */5 * * * *
```

Each function detects GET requests and returns immediately without doing work:

```javascript
exports.ocr = onRequest({ cors: true }, async (req, res) => {
    // Handle warmup ping
    if (req.method === 'GET' || req.body?.warmup) {
        res.status(200).send({ service: "ocr", ready: !!client });
        return;
    }
    // ... normal OCR processing
});
```

### Key Insight: Separate Containers

Firebase Gen2 runs each exported function as a **separate Cloud Run container**. Our first attempt used separate `warmOcr`, `warmExplain`, `warmTts` functions, but these were their own containers - pinging them didn't keep the actual `ocr`, `explain`, `tts` functions warm!

The fix was to ping the **actual endpoints** with GET requests.

---

## The Results

### After: With Warm-up

| Metric | Before (Cold) | After (1st Request) | Improvement |
|--------|---------------|---------------------|-------------|
| **Total Pipeline** | 10,724ms | **3,391ms** | **3.2x faster** |
| **Time to First Audio** | 3,147ms | **767ms** | **4.1x faster** |
| OCR | 3,834ms | 1,180ms | 3.2x faster |
| LLM | 3,271ms | 1,040ms | 3.1x faster |
| TTS (1st segment) | 3,081ms | 708ms | 4.4x faster |

### Consistent Performance

| Metric | 1st Request | 2nd Request |
|--------|-------------|-------------|
| Total Pipeline | 3,391ms | 2,948ms |
| Time to First Audio | 767ms | 484ms |

No more unpredictable 10-second delays. Every request now completes in ~3 seconds.

---

## Visual Comparison

```
BEFORE (Cold Start):
[-------- OCR 3.8s --------][------ LLM 3.3s ------][---- TTS 3.1s ----]
|<---------------------------- 10.7 seconds ---------------------------->|

AFTER (Warm):
[- OCR 1.2s -][- LLM 1.0s -][TTS 0.7s]
|<----------- 3.4 seconds ----------->|
```

---

## Cost

| Item | Monthly Cost |
|------|--------------|
| Cloud Scheduler (3 jobs) | ~$0.10 |
| Function invocations (warmup) | ~$0.05 |
| **Total** | **~$0.15/month** |

For ~15 cents/month, we eliminated 7+ seconds of latency on first requests.

---

## Future Considerations

1. **At scale**: With continuous traffic from many users, functions stay warm naturally. The scheduler becomes a safety net for off-peak hours.

2. **Guaranteed warm**: For zero cold starts even during traffic lulls:
   ```javascript
   exports.ocr = onRequest({
       cors: true,
       minInstances: 1  // ~$10-15/month per function
   }, ...);
   ```

3. **Further optimization**: LLM streaming could shave another 300-500ms by starting TTS while the LLM is still generating.

---

## Summary

| Before | After | Win |
|--------|-------|-----|
| 10.7s cold starts | 3.4s consistent | **3.2x faster** |
| 3.1s to first audio | 0.8s to first audio | **4x faster** |
| Unpredictable UX | Consistent UX | **Reliable** |
| $0/month | $0.15/month | **Worth it** |

**Users no longer wait 10+ seconds.** The app now delivers on its promise of quick, frictionless assistance.
