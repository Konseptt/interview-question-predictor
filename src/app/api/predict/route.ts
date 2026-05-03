import { NextResponse } from "next/server";
import {
  buildSystemPrompt,
  extractJsonBlock,
  INVOKE_URL,
  MODEL,
  sanitizeTonePreset,
  validateOutput,
} from "@/lib/predictor";

type NvidiaResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const MAX_JOB_DESCRIPTION_LENGTH = 12000;
const NVIDIA_TIMEOUT_MS = 30000;

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
    stream: false,
  };

  let response: Response;
  try {
    response = await fetch(INVOKE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "NVIDIA request timed out."
        : "Failed to reach NVIDIA API.";
    return NextResponse.json({ error: message }, { status: 504 });
  }

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `NVIDIA request failed: ${response.status} ${errorText}` },
      { status: 502 },
    );
  }

  const data = (await response.json()) as NvidiaResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: "NVIDIA returned an empty completion." },
      { status: 502 },
    );
  }

  try {
    const cleaned = extractJsonBlock(content);
    const parsed = JSON.parse(cleaned) as unknown;

    if (!validateOutput(parsed)) {
      return NextResponse.json(
        { error: "Model output format was invalid. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Could not parse model output as JSON. Try again." },
      { status: 502 },
    );
  }
}
