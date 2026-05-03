export const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
export const MODEL = "meta/llama-4-maverick-17b-128e-instruct";

export type TonePreset = "startup" | "enterprise" | "faang";

export type PredictedQuestion = {
  question: string;
  framework: string;
  redFlag: string;
};

export type LlmOutput = {
  questions: PredictedQuestion[];
};

const toneInstructions: Record<TonePreset, string> = {
  startup:
    "Prioritize adaptability, ownership, speed, ambiguity handling, and cross-functional collaboration.",
  enterprise:
    "Prioritize reliability, stakeholder communication, process discipline, governance, and long-term maintainability.",
  faang:
    "Prioritize structured problem solving, scale, leadership principles, deep technical rigor, and measurable impact.",
};

export function buildSystemPrompt(tone: TonePreset): string {
  return (
    "You are a career interview strategist. Return only valid JSON with this exact shape: " +
    '{"questions":[{"question":"...","framework":"...","redFlag":"..."}]}. ' +
    "Generate exactly 15 questions tailored to the provided job description. " +
    "Keep each field practical, specific, and concise. " +
    `Tone profile: ${toneInstructions[tone]}`
  );
}

export function extractJsonBlock(content: string): string {
  const markdownJsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (markdownJsonMatch?.[1]) {
    return markdownJsonMatch[1].trim();
  }
  return content.trim();
}

export function validateOutput(parsed: unknown): parsed is LlmOutput {
  if (!parsed || typeof parsed !== "object" || !("questions" in parsed)) {
    return false;
  }
  const questions = (parsed as { questions: unknown }).questions;
  if (!Array.isArray(questions) || questions.length !== 15) {
    return false;
  }
  return questions.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.question === "string" &&
      typeof candidate.framework === "string" &&
      typeof candidate.redFlag === "string"
    );
  });
}

export function sanitizeTonePreset(input: unknown): TonePreset {
  if (input === "startup" || input === "enterprise" || input === "faang") {
    return input;
  }
  return "startup";
}
