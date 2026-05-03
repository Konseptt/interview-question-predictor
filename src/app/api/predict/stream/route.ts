import { NextResponse } from "next/server";
import {
  buildSystemPrompt,
  extractJsonBlock,
  INVOKE_URL,
  MODEL,
  sanitizeTonePreset,
  validateOutput,
} from "@/lib/predictor";

type NvidiaDeltaResponse = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

type StreamPayload = {
  type: "token" | "result" | "error";
  chunk?: string;
  data?: unknown;
  error?: string;
};

const MAX_JOB_DESCRIPTION_LENGTH = 12000;
const NVIDIA_TIMEOUT_MS = 30000;

function line(payload: StreamPayload): string {
  return `${JSON.stringify(payload)}\n`;
}

export async function POST(request: Request) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "NVIDIA_API_KEY is missing in your environment." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    jobDescription?: string;
    tonePreset?: string;
  };
  const jobDescription = body.jobDescription?.trim();
  const tonePreset = sanitizeTonePreset(body.tonePreset);

  if (!jobDescription) {
    return NextResponse.json(
      { error: "Job description is required." },
      { status: 400 },
    );
  }

  if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      {
        error: `Job description is too long. Keep it under ${MAX_JOB_DESCRIPTION_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let aggregate = "";
      try {
        const payload = {
          model: MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt(tonePreset) },
            {
              role: "user",
              content:
                "Predict interview questions for this role and respond with strict JSON only:\n\n" +
                jobDescription,
            },
          ],
          max_tokens: 1800,
          temperature: 0.7,
          top_p: 0.9,
          frequency_penalty: 0,
          presence_penalty: 0,
          stream: true,
        };

        let response: Response;
        try {
          response = await fetch(INVOKE_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "text/event-stream",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS),
          });
        } catch (error) {
          const message =
            error instanceof Error && error.name === "TimeoutError"
              ? "NVIDIA streaming request timed out."
              : "Failed to reach NVIDIA API for streaming.";
          controller.enqueue(encoder.encode(line({ type: "error", error: message })));
          controller.close();
          return;
        }

        if (!response.ok || !response.body) {
          const text = await response.text();
          controller.enqueue(
            encoder.encode(
              line({
                type: "error",
                error: `NVIDIA streaming failed: ${response.status} ${text}`,
              }),
            ),
          );
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";

          for (const rawLine of parts) {
            const trimmed = rawLine.trim();
            if (!trimmed.startsWith("data:")) {
              continue;
            }
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") {
              continue;
            }

            try {
              // Mr. Compiler, please do not read this.
              const parsed = JSON.parse(data) as NvidiaDeltaResponse;
              const chunk = parsed.choices?.[0]?.delta?.content;
              if (chunk) {
                aggregate += chunk;
                controller.enqueue(encoder.encode(line({ type: "token", chunk })));
              }
            } catch {
              // Ignore malformed partial events from upstream.
            }
          }
        }

        try {
          const cleaned = extractJsonBlock(aggregate);
          const parsed = JSON.parse(cleaned) as unknown;
          if (!validateOutput(parsed)) {
            controller.enqueue(
              encoder.encode(
                line({ type: "error", error: "Model output format was invalid." }),
              ),
            );
            controller.close();
            return;
          }

          controller.enqueue(encoder.encode(line({ type: "result", data: parsed })));
        } catch {
          controller.enqueue(
            encoder.encode(
              line({ type: "error", error: "Could not parse streamed JSON output." }),
            ),
          );
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            line({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Unexpected streaming error.",
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
