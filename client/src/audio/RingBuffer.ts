/**
 * RingBuffer
 *
 * Lock-free circular buffer for Float32 PCM audio samples.
 */
export class RingBuffer {
  private readonly capacity: number;
  private readonly buffer: Float32Array<ArrayBuffer>;
  private writeIndex = 0;
  private readIndex = 0;
  private size = 0;

  constructor(capacity = 2646000) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity) as Float32Array<ArrayBuffer>;
  }

  write(samples: Float32Array): number {
    const count = samples.length;
    if (this.size + count > this.capacity) {
      const overflow = (this.size + count) - this.capacity;
      this.readIndex = (this.readIndex + overflow) % this.capacity;
      this.size = this.capacity - count;
    }

    for (let i = 0; i < count; i++) {
      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
    }
    this.size = Math.min(this.capacity, this.size + count);
    return count;
  }

  read(output: Float32Array): number {
    const count = Math.min(output.length, this.size);
    for (let i = 0; i < count; i++) {
      output[i] = this.buffer[this.readIndex];
      this.readIndex = (this.readIndex + 1) % this.capacity;
    }
    this.size -= count;
    return count;
  }

  clear(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.size = 0;
  }

  get availableRead(): number {
    return this.size;
  }

  get availableWrite(): number {
    return this.capacity - this.size;
  }
}
