import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildSystemPrompt,
  extractJsonBlock,
  MODEL,
  sanitizeTonePreset,
  validateOutput,
} from "@/lib/predictor";

const MAX_JOB_DESCRIPTION_LENGTH = 12000;
const NVIDIA_TIMEOUT_MS = 120000;

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

  const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: NVIDIA_TIMEOUT_MS,
  });

  let content: string | null | undefined;
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
      temperature: 1,
      top_p: 0.95,
      max_tokens: 1024,
      stream: false,
    });
    content = completion.choices[0]?.message?.content;
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "NVIDIA request timed out."
        : "Failed to reach NVIDIA API.";
    return NextResponse.json({ error: message }, { status: 504 });
  }
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
