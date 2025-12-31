# Post-ExplainPipeline Timing Results

**Date:** 2025-12-30  
**Test Device:** Android (Expo Go)  
**Change:** Combined OCR + LLM into `/explainPipeline` for a single round-trip

---

## Test 1: Vitamin D3 Bottle (First Run)

| Stage | Duration | Notes |
|-------|----------|-------|
| Camera capture | 384ms | |
| OCR base64 encode | 13ms | |
| Explain pipeline network | 2,693ms | OCR + LLM in one request |
| Pipeline to LLM complete | 3,147ms | From button press |
| TTS fetch (1st) | 282ms | 37 chars |
| TTS file write | 8ms | |
| Segment 0 load | 467ms | Audio.Sound.createAsync: 175ms |

### Key Metrics (First Run)
- **Pipeline Complete:** 3,693ms
- **Time to First Audio:** 553ms (from speak() call)

---

## Test 2: Amex Bill (Warm)

| Stage | Duration | Notes |
|-------|----------|-------|
| Camera capture | 358ms | |
| OCR base64 encode | 15ms | |
| Explain pipeline network | 2,238ms | OCR + LLM in one request |
| Pipeline to LLM complete | 2,663ms | From button press |
| TTS fetch (1st) | 151ms | 48 chars |
| TTS file write | 2ms | |
| Segment 0 load | 201ms | Audio.Sound.createAsync: 48ms |

### Key Metrics (Warm Run)
- **Pipeline Complete:** 2,940ms
- **Time to First Audio:** 280ms (from speak() call)

---

## Bragging Rights

| Metric | Prior Warm (post-warmup) | Now (warm) | Change |
|--------|---------------------------|------------|--------|
| Total pipeline | 2,948ms | **2,940ms** | **8ms faster** |
| Time to first audio | 484ms | **280ms** | **204ms faster** |
| OCR + LLM network | 1,993ms | **2,238ms** | **245ms slower** |

**Bottom line:** Single round-trip explain is real. Warm explain now lands in ~2.9s with first audio in ~0.28s, with LLM latency varying run-to-run.
