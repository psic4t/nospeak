# Chunked Gallery Save Implementation Plan

**Status:** IN PROGRESS

**Goal:** Eliminate ANR caused by sending large base64 strings across the Capacitor bridge during gallery save by splitting data into small chunks.

**Root Cause:** When `mediaCacheEnabled` is true, the decryption worker base64-encodes the full decrypted file (~47MB for a 35MB video) and sends it via `postMessage` to the main thread. The main thread then passes it through the Capacitor bridge via `JSON.stringify()`, which blocks the JS main thread for seconds causing ANR.

**Architecture:**
1. Worker base64-encodes decrypted bytes in ~512KB chunks, sending each as a separate `postMessage`
2. Main thread forwards each chunk to Java plugin `writeCacheChunk(path, chunk, append)` — each bridge call serializes only ~512KB
3. After all chunks, main thread calls `commitCacheFile(tempPath, sha256, mimeType)` which streams the temp file into MediaStore
4. No single bridge call exceeds ~512KB of payload

**Key constraint:** Base64 encodes 3 bytes → 4 chars. Chunk boundaries must be divisible by 3 bytes (binary side) to produce independently decodable base64 chunks. Using 384KB binary chunks → 512KB base64 chunks.
