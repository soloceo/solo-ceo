/**
 * MediaPipe LLM Inference engine — runs Gemma 4 E2B locally in the browser via WebGPU.
 * Uses Google's official @mediapipe/tasks-genai package.
 * Dynamic import() keeps the WASM bundle out of the main chunk.
 */

// ── Config persistence ────────────────────────────────────

const LS_WEBLLM_MODEL = "solo_webllm_model";

/**
 * Available models — web-optimized .task files from HuggingFace litert-community.
 * The URL points to the raw file download (resolve redirect at runtime).
 */
export const WEBLLM_MODELS = [
  {
    id: "gemma-4-E2B",
    label: "Gemma 4 E2B (recommended)",
    vram: "~2 GB",
    url: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task",
  },
] as const;

export const DEFAULT_WEBLLM_MODEL = WEBLLM_MODELS[0].id;

export function getWebLLMModel(): string {
  return localStorage.getItem(LS_WEBLLM_MODEL) || DEFAULT_WEBLLM_MODEL;
}

export function setWebLLMModel(model: string): void {
  try { localStorage.setItem(LS_WEBLLM_MODEL, model); } catch { /* quota */ }
}

/** Get the download URL for a model */
export function getModelUrl(modelId: string): string {
  const m = WEBLLM_MODELS.find(m => m.id === modelId);
  return m?.url || WEBLLM_MODELS[0].url;
}

// ── WebGPU detection ──────────────────────────────────────

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// ── Gemma 4 prompt formatting ─────────────────────────────

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Format messages into Gemma 4's prompt template.
 * Gemma 4 uses: <|turn>role\ncontent<turn|>
 */
export function formatGemma4Prompt(messages: ChatMsg[]): string {
  let prompt = "";
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : msg.role;
    prompt += `<|turn>${role}\n${msg.content}<turn|>\n`;
  }
  // Open the model turn for generation
  prompt += "<|turn>model\n";
  return prompt;
}

// ── Engine singleton ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let llmInference: any = null;
let currentModelId = "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadingPromise: Promise<any> | null = null;

export type WebLLMProgressCallback = (progress: number, text: string) => void;

/**
 * Get or create the MediaPipe LLM Inference engine.
 * Downloads the model on first use (~2 GB for Gemma 4 E2B).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrCreateEngine(onProgress?: WebLLMProgressCallback): Promise<any> {
  const modelId = getWebLLMModel();

  // Already loaded with same model
  if (llmInference && currentModelId === modelId) return llmInference;

  // Already loading — wait for it
  if (loadingPromise && currentModelId === modelId) return loadingPromise;

  loadingPromise = (async () => {
    // Destroy old instance if switching models
    if (llmInference) {
      try { llmInference.close(); } catch { /* ignore */ }
      llmInference = null;
    }

    currentModelId = modelId;
    onProgress?.(0, "Loading MediaPipe WASM...");

    // Dynamic import — keeps ~2MB WASM loader out of main bundle
    const { FilesetResolver, LlmInference } = await import("@mediapipe/tasks-genai");

    onProgress?.(0.05, "Initializing GenAI runtime...");
    const genaiFileset = await FilesetResolver.forGenAiTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm"
    );

    const modelUrl = getModelUrl(modelId);
    onProgress?.(0.1, "Downloading model (~2 GB)...");

    const instance = await LlmInference.createFromOptions(genaiFileset, {
      baseOptions: {
        modelAssetPath: modelUrl,
      },
      maxTokens: 4096,
      topK: 40,
      temperature: 0.7,
      randomSeed: Math.floor(Math.random() * 100000),
    });

    onProgress?.(1, "Model loaded!");
    llmInference = instance;
    loadingPromise = null;
    return instance;
  })();

  return loadingPromise;
}

/**
 * Generate a response using the loaded engine.
 * Streams partial results via the callback.
 * Returns the full accumulated text.
 */
export async function generateStreaming(
  prompt: string,
  onChunk: (text: string) => void,
): Promise<string> {
  if (!llmInference) throw new Error("MediaPipe engine not loaded");

  return new Promise<string>((resolve, reject) => {
    try {
      let full = "";
      llmInference.generateResponse(prompt, (partial: string, done: boolean) => {
        if (partial) {
          full += partial;
          onChunk(partial);
        }
        if (done) {
          resolve(full);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate a full (non-streaming) response.
 */
export async function generateFull(prompt: string): Promise<string> {
  if (!llmInference) throw new Error("MediaPipe engine not loaded");
  return await llmInference.generateResponse(prompt);
}

/**
 * Cancel any in-flight generation.
 */
export function cancelGeneration(): void {
  if (llmInference) {
    try { llmInference.cancelProcessing(); } catch { /* ignore */ }
  }
}

/**
 * Check if the current model is loaded and ready.
 */
export function isEngineReady(): boolean {
  return llmInference !== null && currentModelId === getWebLLMModel();
}

/**
 * Unload the engine and free memory.
 */
export function unloadEngine(): void {
  if (llmInference) {
    try { llmInference.close(); } catch { /* ignore */ }
    llmInference = null;
    currentModelId = "";
    loadingPromise = null;
  }
}
