import Anthropic from "@anthropic-ai/sdk";

import { getServerEnv } from "@/lib/env";

export function createAnthropicClient() {
  const apiKey = getServerEnv().ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}
