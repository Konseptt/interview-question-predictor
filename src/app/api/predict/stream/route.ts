import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildSystemPrompt,
  extractJsonBlock,
  MODEL,
  sanitizeTonePreset,
  validateOutput,
} from "@/lib/predictor";

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
      try {
        const client = new OpenAI({
          baseURL: "https://integrate.api.nvidia.com/v1",
          apiKey,
          timeout: NVIDIA_TIMEOUT_MS,
        });

        let aggregate = "";
        try {
          const completion = await client.chat.completions.create({
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
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 1024,
            stream: false,
          });
          aggregate = completion.choices[0]?.message?.content ?? "";
          if (aggregate) {
            controller.enqueue(encoder.encode(line({ type: "token", chunk: aggregate })));
          }
        } catch (error) {
          const message =
            error instanceof Error && error.name === "TimeoutError"
              ? "NVIDIA streaming request timed out."
              : "Failed to reach NVIDIA API for streaming.";
          controller.enqueue(encoder.encode(line({ type: "error", error: message })));
          return;
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
