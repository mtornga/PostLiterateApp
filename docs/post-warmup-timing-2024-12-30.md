# Post-Warmup Timing Results

**Date:** 2024-12-30
**Test Device:** Android (Expo Go)
**Change:** Cloud Scheduler warm-up implemented

---

## Test 1: First Request After Warmup

Functions were kept warm by Cloud Scheduler (5-minute ping interval).

| Stage | Duration | Cumulative | Notes |
|-------|----------|------------|-------|
| Camera capture | 371ms | 371ms | |
| OCR base64 encode | 25ms | 396ms | |
| OCR network | 1,130ms | 1,526ms | Warm |
| **OCR total** | **1,180ms** | **1,588ms** | |
| LLM network | 960ms | 2,548ms | Warm |
| **LLM total** | **1,040ms** | **2,629ms** | 223 char explanation |
| TTS fetch (1st) | 600ms | - | 37 chars |
| TTS file write | 10ms | - | |
| Audio.Sound.createAsync | 94ms | - | |
| **Segment 0 load** | **708ms** | **3,391ms** | |

### Key Metrics (First Request)
- **Pipeline Complete:** 3,391ms
- **Time to First Audio:** 767ms (from speak() call)

### Subsequent TTS Segments
| Segment | Fetch | File Write | Audio Load | Total |
|---------|-------|------------|------------|-------|
| 1 | 389ms | 7ms | 71ms | 470ms |
| 2 | 420ms | 6ms | 70ms | 496ms |
| 3 | 344ms | 2ms | 75ms | 422ms |
| 4 | 380ms | 6ms | 81ms | 469ms |

---

## Test 2: Subsequent Request (Fully Warm)

| Stage | Duration | Cumulative | Notes |
|-------|----------|------------|-------|
| Camera capture | 342ms | 342ms | |
| OCR base64 encode | 14ms | 356ms | |
| OCR network | 834ms | 1,190ms | Warm |
| **OCR total** | **868ms** | **1,231ms** | |
| LLM network | 1,159ms | 2,390ms | Warm |
| **LLM total** | **1,241ms** | **2,473ms** | 185 char explanation |
| TTS fetch (1st) | 357ms | - | 48 chars |
| TTS file write | 5ms | - | |
| Audio.Sound.createAsync | 76ms | - | |
| **Segment 0 load** | **438ms** | **2,948ms** | |

### Key Metrics (Subsequent Request)
- **Pipeline Complete:** 2,948ms
- **Time to First Audio:** 484ms (from speak() call)

### Subsequent TTS Segments
| Segment | Fetch | File Write | Audio Load | Total |
|---------|-------|------------|------------|-------|
| 1 | 311ms | 3ms | 56ms | 372ms |
| 2 | 413ms | 6ms | 68ms | 489ms |
| 3 | 441ms | 6ms | 74ms | 523ms |

---

## Summary

| Metric | First Request | Subsequent |
|--------|---------------|------------|
| Total Pipeline | 3,391ms | 2,948ms |
| Time to First Audio | 767ms | 484ms |
| OCR total | 1,180ms | 868ms |
| LLM total | 1,040ms | 1,241ms |
| TTS 1st segment | 708ms | 438ms |

---

## Observations

1. **No cold starts** - First request is ~3.4s, not 10+ seconds
2. **Consistent performance** - Both tests in the 3-3.4s range
3. **Fast time to first audio** - Under 800ms even on first request
4. **TTS segments consistent** - 370-520ms per segment
