class ScamSunoCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(Math.ceil(sampleRate * 15));
    this.used = 0;
    this.port.onmessage = ({ data }) => {
      if (data === "finish") {
        const samples = this.samples.slice(0, this.used);
        this.port.postMessage(samples, [samples.buffer]);
      }
    };
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && this.used < this.samples.length) {
      const slice = channel.subarray(0, this.samples.length - this.used);
      this.samples.set(slice, this.used);
      this.used += slice.length;
    }
    return true;
  }
}

registerProcessor("scamsuno-capture", ScamSunoCapture);
