export interface ZipWriter {
  add(name: string, body: ReadableStream<Uint8Array>): Promise<void>;
  close(): Promise<void>;
  abort(): void;
}
/** Streaming archive sink; add awaits backpressure and never buffers entire files. */
export interface Zip {
  create(write: (chunk: Uint8Array) => Promise<void>): ZipWriter;
}
