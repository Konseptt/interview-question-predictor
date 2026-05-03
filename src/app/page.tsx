"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";

type PredictedQuestion = {
  question: string;
  framework: string;
  redFlag: string;
};

type PredictionResponse = {
  questions: PredictedQuestion[];
};

type TonePreset = "startup" | "enterprise" | "faang";
type GenerationMode = "standard" | "stream";

type StreamLine =
  | { type: "token"; chunk?: string }
  | { type: "result"; data?: PredictionResponse }
  | { type: "error"; error?: string };

const toneOptions: Array<{ value: TonePreset; label: string }> = [
  { value: "startup", label: "Startup" },
  { value: "enterprise", label: "Enterprise" },
  { value: "faang", label: "FAANG" },
];
const cardPalettes = [
  "card-tone-a",
  "card-tone-b",
  "card-tone-c",
] as const;

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [questions, setQuestions] = useState<PredictedQuestion[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [liveStreamText, setLiveStreamText] = useState("");
  const [tonePreset, setTonePreset] = useState<TonePreset>("startup");
  const [mode, setMode] = useState<GenerationMode>("standard");
  const [grainEnabled] = useState(true);
  const [trailEnabled] = useState(true);
  const [phosphorMode] = useState(true);
  const [CursorTrailComponent, setCursorTrailComponent] =
    useState<ComponentType | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleTimeoutRef = useRef<number | null>(null);
  const streamFlushFrameRef = useRef<number | null>(null);
  const streamBufferRef = useRef("");
  const streamRenderRef = useRef("");
  const resultsSectionRef = useRef<HTMLElement | null>(null);

  const countLabel = useMemo(() => `${questions.length}/15 generated`, [questions]);

  useEffect(() => {
    if (!trailEnabled || CursorTrailComponent) {
      return;
    }
    let active = true;
    import("@/components/CursorTrail").then((module) => {
      if (active) {
        setCursorTrailComponent(() => module.default);
      }
    });
    return () => {
      active = false;
    };
  }, [trailEnabled, CursorTrailComponent]);

  useEffect(() => {
    return () => {
      if (shuffleTimeoutRef.current) {
        window.clearTimeout(shuffleTimeoutRef.current);
      }
      if (streamFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(streamFlushFrameRef.current);
      }
    };
  }, []);

  function scheduleStreamTextFlush(): void {
    if (streamFlushFrameRef.current !== null) {
      return;
    }
    // be nice to the CPU
    // There are 10 kinds of people: those who understand binary and those who don't.
    streamFlushFrameRef.current = window.requestAnimationFrame(() => {
      streamRenderRef.current += streamBufferRef.current;
      streamBufferRef.current = "";
      setLiveStreamText(streamRenderRef.current);
      streamFlushFrameRef.current = null;
    });
  }

  async function readNdjsonStream(response: Response): Promise<PredictionResponse> {
    if (!response.body) {
      throw new Error("Stream response body is missing.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: PredictionResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }
        // The plural of regex is regrets.
        const payload = JSON.parse(line) as StreamLine;
        if (payload.type === "token" && payload.chunk) {
          streamBufferRef.current += payload.chunk;
          scheduleStreamTextFlush();
        }
        if (payload.type === "error") {
          throw new Error(payload.error ?? "Streaming failed.");
        }
        if (payload.type === "result") {
          if (!payload.data?.questions) {
            throw new Error("Streamed result is missing questions.");
          }
          finalResult = payload.data;
        }
      }
    }

    if (!finalResult) {
      throw new Error("No final result received from stream.");
    }
    return finalResult;
  }

  async function runStandardRequest(): Promise<PredictionResponse> {
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription, tonePreset }),
    });

    const data = (await response.json()) as PredictionResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to generate interview questions.");
    }
    return data;
  }

  async function runStreamingRequest(): Promise<PredictionResponse> {
    const response = await fetch("/api/predict/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription, tonePreset }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Streaming request failed.");
    }

    return readNdjsonStream(response);
  }

  function formatQuestionsAsText(items: PredictedQuestion[]): string {
    return items
      .map((item, index) => {
        return [
          `Q${index + 1}: ${item.question}`,
          `Framework: ${item.framework}`,
          `Red flag: ${item.redFlag}`,
        ].join("\n");
      })
      .join("\n\n");
  }

  function downloadFile(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    // Magic. Do not touch.
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyQuestion(item: PredictedQuestion): Promise<void> {
    const text = [
      `Question: ${item.question}`,
      `Framework: ${item.framework}`,
      `Red flag: ${item.redFlag}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
  }

  async function copyAllQuestions(): Promise<void> {
    await navigator.clipboard.writeText(formatQuestionsAsText(questions));
  }

  function exportJson(): void {
    const payload = JSON.stringify({ questions, tonePreset, mode }, null, 2);
    downloadFile("interview-questions.json", payload, "application/json");
  }

  function exportTxt(): void {
    downloadFile("interview-questions.txt", formatQuestionsAsText(questions), "text/plain");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setQuestions([]);
    setLiveStreamText("");
    streamRenderRef.current = "";
    streamBufferRef.current = "";
    if (streamFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(streamFlushFrameRef.current);
      streamFlushFrameRef.current = null;
    }
    setIsShuffling(true);
    if (shuffleTimeoutRef.current) {
      window.clearTimeout(shuffleTimeoutRef.current);
    }

    if (!jobDescription.trim()) {
      setError("Drop in a job description first.");
      setIsShuffling(false);
      return;
    }

    setIsLoading(true);
    try {
      const data =
        mode === "stream" ? await runStreamingRequest() : await runStandardRequest();
      setQuestions(data.questions);
      if (window.matchMedia("(max-width: 1024px)").matches) {
        window.requestAnimationFrame(() => {
          resultsSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
      shuffleTimeoutRef.current = window.setTimeout(() => {
        setIsShuffling(false);
      }, 1050);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while generating questions.",
      );
      setIsShuffling(false);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      className={`funk-stage retro-screen palette-matrix min-h-screen overflow-hidden px-4 py-10 text-[var(--color-fg-primary)] sm:px-6 ${
        phosphorMode ? "retro-mono" : ""
      }`}
    >
      <div className="mesh-overlay" />
      <div className={`grain-overlay ${grainEnabled ? "grain-on" : "grain-off"}`} />
      {trailEnabled && CursorTrailComponent ? <CursorTrailComponent /> : null}

      <section className="relative z-10 mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.22fr]">
          <article className="tilt-left px-1 sm:px-3">
            <p className="line-kicker retro-kicker inline-flex py-1 text-xs uppercase tracking-[0.22em] text-[var(--color-fg-secondary)]">
              Interview Prep Studio
            </p>
            <h1 className="retro-title mt-4 text-balance text-4xl font-black uppercase leading-[0.9] sm:text-6xl">
              Interview Question
              <span className="block text-[var(--color-accent-strong)] retro-title-accent">
                Forecaster
              </span>
            </h1>
            <p className="retro-copy mt-4 max-w-lg text-sm text-[var(--color-fg-secondary)] sm:text-base">
              Paste a job description. Generate the 15 most likely interview questions,
              structured answer frameworks, and red flags to avoid.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-6">
              <div className="grid gap-3">
                <p className="ink-line retro-label text-xs uppercase tracking-[0.16em] text-[var(--color-fg-secondary)]">
                  Tone Preset
                </p>
                <div className="line-row flex flex-wrap gap-4 pb-2">
                  {toneOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTonePreset(option.value)}
                      className={`line-chip text-xs font-bold uppercase tracking-[0.12em] transition ${
                        tonePreset === option.value
                          ? "line-chip-active text-[var(--color-accent-strong)]"
                          : "text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <label htmlFor="job-description" className="sr-only">
                Job description
              </label>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste role brief here: scope, requirements, responsibilities..."
                className="line-input min-h-56 w-full resize-y p-4 text-sm outline-none transition sm:text-base"
              />

              <div className="line-row flex flex-wrap items-center gap-3 pb-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("standard")}
                    className={`line-chip text-xs font-bold uppercase tracking-[0.12em] transition ${
                      mode === "standard"
                        ? "line-chip-active text-[var(--color-accent-strong)]"
                        : "text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]"
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("stream")}
                    className={`line-chip text-xs font-bold uppercase tracking-[0.12em] transition ${
                      mode === "stream"
                        ? "line-chip-active text-[var(--color-accent-strong)]"
                        : "text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]"
                    }`}
                  >
                    Stream
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="line-cta px-3 py-2 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Processing..." : ">> Run Forecast"}
                </button>
                <span className="line-chip px-2 py-1 text-xs uppercase tracking-[0.15em] text-[var(--color-fg-secondary)]">
                  {countLabel}
                </span>
              </div>
            </form>

            {error ? (
              <p className="mt-4 border-l-4 border-[var(--color-danger)] border-b border-[var(--color-danger)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}
          </article>

          <article ref={resultsSectionRef} className="tilt-right px-1 sm:px-3">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="retro-title text-2xl font-black uppercase tracking-[0.1em] text-[var(--color-fg-primary)]">
                Predicted Questions
              </h2>
              {questions.length > 0 ? (
                <div className="line-row flex flex-wrap items-center gap-3 pb-2">
                  <button
                    type="button"
                    onClick={copyAllQuestions}
                    className="line-chip text-xs uppercase tracking-[0.12em] text-[var(--color-fg-secondary)]"
                  >
                    Copy All
                  </button>
                  <button
                    type="button"
                    onClick={exportJson}
                    className="line-chip text-xs uppercase tracking-[0.12em] text-[var(--color-fg-secondary)]"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={exportTxt}
                    className="line-chip text-xs uppercase tracking-[0.12em] text-[var(--color-fg-secondary)]"
                  >
                    Export TXT
                  </button>
                </div>
              ) : (
                <p className="retro-label text-xs uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
                  Framework + Red Flags
                </p>
              )}
            </div>

            {isLoading && mode === "stream" ? (
              <div className="line-callout retro-terminal mb-4 border-l-4 border-[var(--color-accent)] pl-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[var(--color-accent-strong)]">
                  Live stream monitor
                </p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-[var(--color-fg-secondary)]">
                  {liveStreamText || "Waiting for tokens..."}
                </pre>
              </div>
            ) : null}

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="skeleton-wave h-16 w-full" />
                ))}
              </div>
            ) : questions.length > 0 ? (
              <ol className="results-list max-h-[72vh] space-y-3 overflow-auto pr-2 pb-3">
                {questions.map((item, index) => (
                  <li
                    key={`${item.question}-${index}`}
                    style={{ animationDelay: `${index * 42}ms` }}
                    className={`question-strip p-4 ${
                      cardPalettes[index % cardPalettes.length]
                    } ${isShuffling ? "shuffle-in" : ""}`}
                  >
                    <p className="question-title text-sm font-semibold sm:text-base">
                      <span className="question-index mr-2">Q{index + 1}.</span>
                      {item.question}
                    </p>
                    <p className="question-meta mt-2 text-sm">
                      <span className="question-label font-bold">Framework:</span>{" "}
                      {item.framework}
                    </p>
                    <p className="question-meta mt-2 text-sm">
                      <span className="question-label font-bold">Red flag:</span>{" "}
                      {item.redFlag}
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => void copyQuestion(item)}
                        className="line-chip text-xs uppercase tracking-[0.12em] text-[var(--color-fg-secondary)]"
                      >
                        Copy
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ink-line px-1 py-6 text-sm text-[var(--color-fg-muted)]">
                Your generated interview prep set will appear here.
              </p>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
