# Pipeline Baseline Timing Results

**Date:** 2024-12-30
**Test Device:** Android (Expo Go)
**Test Images:** Vitamin D3 bottle, Amex bill

---

## Test 1: Vitamin D3 Bottle (COLD START)

Firebase functions were cold - first invocation after deployment.

| Stage | Duration | Cumulative | Notes |
|-------|----------|------------|-------|
| Camera capture | 421ms | 421ms | |
| OCR base64 encode | 37ms | 458ms | |
| OCR network | 3,785ms | 4,243ms | Cold start |
| **OCR total** | **3,834ms** | **4,304ms** | 160 chars detected |
| LLM network | 3,115ms | 7,419ms | Cold start |
| **LLM total** | **3,271ms** | **7,582ms** | 156 char explanation |
| TTS fetch (1st) | 2,879ms | - | Cold start, 32 chars |
| TTS file write | 14ms | - | |
| Audio.Sound.createAsync | 185ms | - | |
| **Segment 0 load** | **3,081ms** | **10,724ms** | |

### Key Metrics (Cold)
- **Pipeline Complete:** 10,724ms
- **Time to First Audio:** 3,147ms (from speak() call)
- **Total Button-to-Audio:** ~10.7 seconds

### Subsequent TTS Segments (after warm-up)
| Segment | Fetch | File Write | Audio Load | Total |
|---------|-------|------------|------------|-------|
| 1 | 315ms | 4ms | 67ms | 388ms |
| 2 | 436ms | 4ms | 65ms | 506ms |
| 3 | 307ms | 11ms | 49ms | 368ms |

---

## Test 2: Amex Bill (WARM)

Firebase functions were warm from previous test.

| Stage | Duration | Cumulative | Notes |
|-------|----------|------------|-------|
| Camera capture | 415ms | 415ms | |
| OCR base64 encode | 10ms | 425ms | |
| OCR network | 713ms | 1,138ms | Warm |
| **OCR total** | **739ms** | **1,181ms** | 418 chars detected |
| LLM network | 874ms | 2,055ms | Warm |
| **LLM total** | **961ms** | **2,144ms** | 253 char explanation |
| TTS fetch (1st) | 259ms | - | Warm, 15 chars |
| TTS file write | 5ms | - | |
| Audio.Sound.createAsync | 67ms | - | |
| **Segment 0 load** | **334ms** | **2,525ms** | |

### Key Metrics (Warm)
- **Pipeline Complete:** 2,525ms
- **Time to First Audio:** 387ms (from speak() call)
- **Total Button-to-Audio:** ~2.5 seconds

### Subsequent TTS Segments
| Segment | Fetch | File Write | Audio Load | Total |
|---------|-------|------------|------------|-------|
| 1 | 298ms | 11ms | 56ms | 367ms |
| 2 | 280ms | 4ms | 59ms | 345ms |
| 3 | 348ms | 5ms | 70ms | 424ms |
| 4 | 752ms | 5ms | 60ms | 819ms |
| 5 | 342ms | 4ms | 69ms | 416ms |

---

## Summary Comparison

| Metric | Cold Start | Warm | Delta |
|--------|------------|------|-------|
| OCR total | 3,834ms | 739ms | 5.2x |
| LLM total | 3,271ms | 961ms | 3.4x |
| TTS 1st segment | 3,081ms | 334ms | 9.2x |
| **Total Pipeline** | **10,724ms** | **2,525ms** | **4.2x** |
| **Time to First Audio** | **3,147ms** | **387ms** | **8.1x** |

---

## Backend API Durations (from Firebase logs)

These are the actual API call times on the server (excluding network):

| API | Vitamin D3 | Amex Bill |
|-----|------------|-----------|
| Vision API | 657ms | 419ms |
| Gemini API | 649ms | 774ms |
| TTS API (avg) | ~250ms | ~200ms |

---

## Observations

1. **Cold starts dominate** - 4.2x slower overall, 8x slower to first audio
2. **Warm performance is good** - 2.5s total, 387ms to first audio after LLM
3. **Network overhead is significant** - OCR warm: 739ms frontend vs 419ms API = 320ms overhead
4. **TTS pre-fetching works** - Segments 1+ load while previous plays
5. **Base64 encoding is fast** - 10-37ms, not a bottleneck
6. **Audio.Sound.createAsync** - Consistent 50-70ms when warm
