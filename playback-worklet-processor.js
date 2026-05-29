/**
 * AudioWorklet processor for gapless playback from a ring buffer.
 *
 * The main thread pushes decoded PCM Float32Array chunks via port.postMessage.
 * This processor pulls from the ring buffer at a constant rate, outputting
 * silence when the buffer is empty (soft underrun).
 *
 * This mirrors the Python client's callback-based playback approach:
 *   _playback_callback pulls from collections.deque, pads with silence on underrun.
 */
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Ring buffer — 10 seconds at 24 kHz (handles long responses)
    this._bufferSize = 240000;
    this._buffer = new Float32Array(this._bufferSize);
    this._readIndex = 0;
    this._writeIndex = 0;
    this._buffered = 0; // samples available to read

    this.port.onmessage = (evt) => {
      const samples = evt.data;
      for (let i = 0; i < samples.length; i++) {
        if (this._buffered < this._bufferSize) {
          this._buffer[this._writeIndex] = samples[i];
          this._writeIndex = (this._writeIndex + 1) % this._bufferSize;
          this._buffered++;
        }
        // else: drop samples on overflow (buffer full)
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];

    for (let i = 0; i < channel.length; i++) {
      if (this._buffered > 0) {
        channel[i] = this._buffer[this._readIndex];
        this._readIndex = (this._readIndex + 1) % this._bufferSize;
        this._buffered--;
      } else {
        channel[i] = 0; // silence on underrun
      }
    }

    return true;
  }
}

registerProcessor("playback-processor", PlaybackProcessor);
