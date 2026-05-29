/**
 * AudioWorklet processor that captures microphone PCM samples
 * and sends them to the main thread in fixed-size chunks (80ms at 24kHz = 1920 samples).
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunkSize = 1920; // 80ms at 24kHz
    this._buffer = new Float32Array(4096);
    this._writeIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const samples = input[0];

    // Copy samples into ring buffer
    for (let i = 0; i < samples.length; i++) {
      this._buffer[this._writeIndex++] = samples[i];
    }

    // Send complete 80ms chunks to the main thread
    while (this._writeIndex >= this._chunkSize) {
      const chunk = this._buffer.slice(0, this._chunkSize);
      // Shift remaining data forward
      this._buffer.copyWithin(0, this._chunkSize, this._writeIndex);
      this._writeIndex -= this._chunkSize;
      this.port.postMessage(chunk, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
