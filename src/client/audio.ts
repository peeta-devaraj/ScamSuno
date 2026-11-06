export class CallAudio {
  private context: AudioContext | null = null;
  private loaded = new Map<string, AudioBuffer>();
  private worklet: Promise<void> | null = null;
  private active: AudioBufferSourceNode | null = null;

  unlock() {
    try {
      this.context ??= new AudioContext();
      return this.context.resume().catch(() => undefined);
    } catch {
      return Promise.resolve();
    }
  }

  stop() {
    try { this.active?.stop(); } catch { /* Playback may have already finished. */ }
    this.active = null;
  }

  async play(url: string, signal: AbortSignal) {
    const context = this.context;
    if (!context || context.state !== "running" || signal.aborted) return false;
    let buffer = this.loaded.get(url);
    try {
      if (!buffer) {
        const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(5500)]) });
        if (!response.ok) return false;
        buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.loaded.set(url, buffer);
      }
      if (signal.aborted || context.state !== "running") return false;
      const node = context.createBufferSource();
      node.buffer = buffer;
      node.connect(context.destination);
      this.active = node;
      await new Promise<void>((resolve) => {
        const stop = () => { if (this.active === node) this.stop(); };
        node.onended = () => {
          signal.removeEventListener("abort", stop);
          node.disconnect();
          if (this.active === node) this.active = null;
          resolve();
        };
        signal.addEventListener("abort", stop, { once: true });
        node.start();
      });
      return !signal.aborted;
    } catch {
      return false;
    }
  }

  async record(stream: MediaStream, signal: AbortSignal) {
    await this.unlock();
    const context = this.context;
    if (!context || context.state !== "running" || !context.audioWorklet) throw new Error("AudioWorklet unavailable");
    this.worklet ??= context.audioWorklet.addModule("/capture-worklet.js").catch((error: unknown) => {
      this.worklet = null;
      throw error;
    });
    await this.worklet;
    signal.throwIfAborted();
    const source = context.createMediaStreamSource(stream);
    const processor = new AudioWorkletNode(context, "scamsuno-capture");
    const silentOutput = context.createGain();
    silentOutput.gain.value = 0;
    source.connect(processor).connect(silentOutput).connect(context.destination);
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      source.disconnect();
      processor.disconnect();
      silentOutput.disconnect();
      processor.port.close();
    }
    return {
      rate: context.sampleRate,
      close,
      finish: () => new Promise<Float32Array>((resolve, reject) => {
        if (closed || signal.aborted) {
          reject(new Error("Recording stopped"));
          return;
        }
        const timeout = setTimeout(() => complete(), 1200);
        function complete(samples?: Float32Array) {
          clearTimeout(timeout);
          signal.removeEventListener("abort", cancel);
          close();
          if (samples) resolve(samples);
          else reject(new Error("Recording unavailable"));
        }
        const cancel = () => complete();
        signal.addEventListener("abort", cancel, { once: true });
        processor.port.onmessage = ({ data }) => complete(data as Float32Array);
        processor.port.postMessage("finish");
      }),
    };
  }

  close() {
    this.stop();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.worklet = null;
    this.loaded.clear();
  }
}
