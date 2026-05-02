import { requestUrl } from "obsidian";
import type { IrisSettings } from "./settings";
import { DEFAULT_MODELS } from "./settings";
import type { ScanResult } from "./types";
import { validateScanResult } from "./validate";

export class ApiCallError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiCallError";
  }
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = [
  "You convert photos of whiteboard to-do lists into a structured JSON representation. Output every visible whiteboard item as a checklist entry. A struck-through item has status \"done\". Other items have status \"open\".",
  "",
  "Hierarchy rules, in order of preference:",
  "1. Visual evidence first: indentation, items drawn inside a labeled box, items in a column under a header, or arrows that clearly group items together. Use this evidence to populate `children`.",
  "2. Semantic decomposition is allowed but must be reported in `inferredGroups` with a `parentPath` and a short `reason`. Every inferred grouping requires an entry. The reasoning will be shown to the user as a footnote.",
  "",
  "An InferredGroup with `parentPath: [0]` means the children at items[0].children are inferred (not visually nested). It is all-or-nothing per parent: a parent's children must be entirely visual or entirely inferred. If you want some children inferred and others visual under the same parent, restructure so the inferred ones become a separate root.",
  "",
  "Headers, group labels, or section titles written on the whiteboard (e.g., \"Q2 LAUNCH\", \"NOTES:\") become root-level checklist items, not separate fields. Do not invent headings.",
  "",
  "Anything that is not a clean to-do — drawings, complex diagrams, ambiguous text, side notes, arrows that aren't simple connectors — goes into `unparsed[]` as one short string per item. Do not invent things; only report what you can see.",
  "",
  "If the image is unreadable or contains nothing actionable, return items: [], inferredGroups: [], unparsed: [].",
].join("\n");

const SCAN_RESULT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: { $ref: "#/definitions/todoItem" },
    },
    inferredGroups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          parentPath: { type: "array", items: { type: "integer", minimum: 0 } },
          reason: { type: "string" },
        },
        required: ["parentPath", "reason"],
        additionalProperties: false,
      },
    },
    unparsed: { type: "array", items: { type: "string" } },
  },
  required: ["items", "inferredGroups", "unparsed"],
  additionalProperties: false,
  definitions: {
    todoItem: {
      type: "object",
      properties: {
        text: { type: "string" },
        status: { type: "string", enum: ["open", "done"] },
        children: {
          type: "array",
          items: { $ref: "#/definitions/todoItem" },
        },
      },
      required: ["text", "status", "children"],
      additionalProperties: false,
    },
  },
};

const USER_INSTRUCTION = "Convert this whiteboard photo to the structured to-do format.";

interface ApiError {
  error?: { message?: string };
}

async function callAnthropic(
  base64Image: string,
  mediaType: string,
  model: string,
  apiKey: string
): Promise<ScanResult> {
  const response = await requestUrl({
    url: ANTHROPIC_API_URL,
    method: "POST",
    throw: false,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "record_scan",
          description: "Record the structured contents of a whiteboard scan.",
          input_schema: SCAN_RESULT_SCHEMA,
          cache_control: { type: "ephemeral" },
        },
      ],
      tool_choice: { type: "tool", name: "record_scan" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Image },
            },
            { type: "text", text: USER_INSTRUCTION },
          ],
        },
      ],
    }),
  });

  if (response.status !== 200) {
    const body = response.json as ApiError;
    throw new ApiCallError(
      response.status,
      body?.error?.message ?? `Anthropic API returned status ${response.status}`
    );
  }

  const body = response.json as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const toolUse = body.content?.find(
    (b) => b.type === "tool_use" && b.name === "record_scan"
  );
  if (!toolUse?.input) {
    throw new Error("Anthropic response did not include record_scan tool use.");
  }
  return validateScanResult(toolUse.input);
}

async function callOpenAI(
  base64Image: string,
  mediaType: string,
  model: string,
  apiKey: string
): Promise<ScanResult> {
  const response = await requestUrl({
    url: OPENAI_API_URL,
    method: "POST",
    throw: false,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scan_result",
          schema: SCAN_RESULT_SCHEMA,
          strict: true,
        },
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${base64Image}` },
            },
            { type: "text", text: USER_INSTRUCTION },
          ],
        },
      ],
    }),
  });

  if (response.status !== 200) {
    const body = response.json as ApiError;
    throw new ApiCallError(
      response.status,
      body?.error?.message ?? `OpenAI API returned status ${response.status}`
    );
  }

  const body = response.json as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI response had no content.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("OpenAI response was not valid JSON.");
  }
  return validateScanResult(parsed);
}

export async function scanWhiteboard(
  base64Image: string,
  mediaType: string,
  settings: IrisSettings,
  apiKey: string
): Promise<ScanResult> {
  const model = settings.modelOverride || DEFAULT_MODELS[settings.provider];
  switch (settings.provider) {
    case "openai":
      return callOpenAI(base64Image, mediaType, model, apiKey);
    case "anthropic":
    default:
      return callAnthropic(base64Image, mediaType, model, apiKey);
  }
}
