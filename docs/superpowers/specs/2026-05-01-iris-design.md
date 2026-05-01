# Iris — Design

**Status:** approved
**Date:** 2026-05-01

## Overview

Iris is an Obsidian plugin that converts photos of whiteboard to-do lists into Markdown checklists, saved into a daily file inside the user's vault. It is AI-backed (Anthropic or OpenAI vision models) and shares its provider/key/model conventions with the existing Muse plugin so the user can reuse the same secret IDs for cross-testing.

The name leaves room for future expansion beyond to-dos (Iris is the Greek goddess of the rainbow, and "iris" doubles as the visual organ).

## Goals

- One-tap path from "I see a whiteboard" to "I have a Markdown checklist in my vault."
- Mobile camera capture is the primary path; desktop upload + clipboard paste is the secondary path.
- Faithful transcription with mild semantic inference for hierarchy, but never silently — every inferred grouping is footnoted with the model's reasoning.
- Multi-scan days append into a single dated file rather than creating new files per scan.

## Non-goals (v1)

- Editing existing scan blocks.
- Deduplicating items across scans (same day or across days).
- Custom prompts, profile fields, or per-scan settings.
- HEIC support (rejected with a helpful error).
- A test harness in CI.

## Plugin metadata

```json
{
  "id": "iris",
  "name": "Iris",
  "version": "0.1.0",
  "minAppVersion": "1.11.4",
  "description": "Turn photos into Markdown — starting with whiteboard to-do lists.",
  "author": "tekgadgt",
  "isDesktopOnly": false
}
```

- Settings tab title: `Iris`.
- Ribbon icon: `scan-eye`.
- Command: `Iris: Scan whiteboard`.

## File layout

```
src/
├── main.ts        plugin entry: command + ribbon + scan orchestration
├── settings.ts    provider/key/model/output-folder + settings tab
├── modal.ts       capture/upload/paste UI, image preview, downscale, kick off scan
├── api.ts         vision request, structured-output schema, provider branching
├── render.ts      ScanResult → markdown (pure function, easy to unit-test)
└── file.ts        ensureFolder, write attachment, day-file create-or-append
```

Repo-level scaffolding (`esbuild.config.mjs`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `styles.css`) copied from Muse and updated for Iris.

`render.ts` is split out from `file.ts` because it contains the only branching logic worth unit-testing in isolation (footnote numbering, indented hierarchy, conditional unparsed callout, conditional inferred-group footnotes).

## Settings

```ts
interface IrisSettings {
  provider: "anthropic" | "openai";   // default: "anthropic"
  apiKeySecretId: string;              // Obsidian secret storage ID
  modelOverride: string;               // empty → provider default
  outputFolder: string;                // default: "Iris"
}
```

**Defaults:**

```ts
const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
};
```

**Settings tab sections:**

1. **API**
   - Provider dropdown.
   - API key — `SecretComponent`. Read at call time via `app.secretStorage.getSecret(settings.apiKeySecretId)`. The secret ID is whatever the user provides; reusing Muse's secret ID is supported simply because the user can paste the same ID here.
   - Model override — text field; placeholder shows the provider default.
2. **Output**
   - Output folder — text field, default `Iris`.

## Capture modal

A single `Modal` subclass with three input paths (camera / file picker / paste) and four UI states.

### States

1. **Empty.**
   - Mobile (`Platform.isMobile`): two stacked buttons.
     - "Take photo" — hidden `<input type="file" accept="image/*" capture="environment">`, button `.click()`s it.
     - "Choose from files" — same input without `capture`.
   - Desktop: a drop-zone div labeled "Drop image, paste, or click to choose". Clicking triggers a hidden file input. `drop` event accepts files; `paste` listener on the modal element accepts clipboard images.
   - Footer text: "JPG, PNG, WebP, GIF supported".
2. **Preview.** Thumbnail (max 320px wide) + "Convert" (primary) + "Choose different image" (secondary).
3. **Loading.** Spinner + status ("Reading whiteboard…", then "Saving…").
4. **Error.** Inline message above buttons; preview stays so the user can retry.

### Image preprocessing

Before upload:

1. Read file → `<canvas>`.
2. Downscale so the longest edge ≤ 1568px (Anthropic's recommended max for vision; well below OpenAI's limits).
3. Re-encode as JPEG, quality 0.85.
4. Output is a base64 string (for the API) and a `Blob` (for the attachment file).
5. Reject formats outside JPG/PNG/WebP/GIF with the message: "Iris doesn't support HEIC — set your iPhone camera format to 'Most Compatible' or convert first."

### Lifecycle

- **On success:** modal closes, plugin opens the day's file in the active leaf (creating it if new).
- **On cancel / backdrop click:** modal closes, no side effects (image is only saved on successful conversion).

## API call & structured output

### Schema

```ts
type TodoStatus = "open" | "done";

interface TodoItem {
  text: string;
  status: TodoStatus;
  children: TodoItem[];
}

interface InferredGroup {
  parentPath: number[];   // path into items[] (e.g. [0, 1] = items[0].children[1])
  reason: string;
}

interface ScanResult {
  items: TodoItem[];
  inferredGroups: InferredGroup[];   // empty when no inferences
  unparsed: string[];                // empty when nothing surfaced
}
```

`children` always reflects what the renderer should output. An `InferredGroup` with `parentPath: [0]` means "the children at `items[0].children` are semantically inferred rather than visually nested" — the renderer attaches a footnote marker to **each child** of the indicated parent (all sharing the same footnote ID), and the footnote definition explains the inference. This is all-or-nothing per parent in v1: a parent's children are either all visual or all inferred. If the model wants to mark only some children as inferred under a parent that also has visual children, it should restructure (e.g., put the inferred ones under a separate root). Schema validation rejects an `InferredGroup` whose `parentPath` resolves to a node with no children.

### Provider branching

Mirrors Muse's switch in `api.ts`, with vision content blocks and structured output added.

- **Anthropic.** Tool use as the structured-output mechanism. Define a single tool `record_scan` whose `input_schema` matches `ScanResult`; force it via `tool_choice: { type: "tool", name: "record_scan" }`; read the tool_use block from the response. Image content block: `{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: ... } }`. System prompt and tool definition both get `cache_control: { type: "ephemeral" }` for prompt caching across rapid multi-scan sessions.
- **OpenAI.** `response_format: { type: "json_schema", json_schema: { name: "scan_result", schema: ..., strict: true } }`. Image: `{ type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }`.

Both branches return a parsed-and-validated `ScanResult`. Validation is a thin runtime check (correct shape, status enum, `parentPath` indices in range) so the renderer can assume well-formed input.

### System prompt rules

- Output every whiteboard item as a checklist entry. Strikethrough → `done`.
- Hierarchy preference order:
  1. Visual evidence (indentation, items inside a labeled box, items in a column under a header).
  2. Semantic decomposition is allowed but must be flagged in `inferredGroups` — every inferred grouping needs a parent path and a reason.
- Headers/group labels written on the whiteboard become **root-level checklist items**, not Markdown headings. (Preserves the "every line is a todo" invariant.)
- Drawings, arrows that aren't simple connectors, ambiguous text, side notes → goes into `unparsed[]`.
- If there is genuinely nothing on the whiteboard, return `items: []`, `inferredGroups: []`, `unparsed: []`.

## Renderer & file operations

### Renderer

```ts
function renderScanBlock(
  scan: ScanResult,
  imagePath: string,    // vault-relative, e.g. "Iris/attachments/2026-05-01-094237.jpg"
  timestamp: Date,
): string
```

Returns just the per-scan block (heading + image link + todos + footnotes + unparsed callout). No leading `---`, no frontmatter — the append helper decides those.

**Indentation:** four spaces per level.

**Footnote IDs:** prefix with the timestamp `HHMMSS`, suffix sequential per `inferredGroups` entry — e.g., `[^094237-1]`. Eliminates collisions across scans without parsing existing file content.

**Conditional sections:**

- Footnote definitions block emitted only if `inferredGroups.length > 0`.
- Unparsed callout (`> [!note]-`) emitted only if `unparsed.length > 0`.

### Day-file append (`file.ts`)

```ts
async function appendScan(
  vault: Vault,
  outputFolder: string,
  scan: ScanResult,
  imageBlob: Blob,
  timestamp: Date,
): Promise<TFile>
```

1. `ensureFolder(outputFolder)` and `ensureFolder(outputFolder + "/attachments")`.
2. Save image: `<outputFolder>/attachments/<YYYY-MM-DD-HHMMSS>.jpg` (always `.jpg` since the modal re-encodes to JPEG). Collisions resolved by suffixing `-2`, `-3`, etc., the same way Muse does.
3. Compute day file path: `<outputFolder>/<YYYY-MM-DD>.md`.
4. Render scan block via `renderScanBlock(...)`.
5. Branch:
   - **File doesn't exist:** create it with `<frontmatter>\n\n<scan block>`.
   - **File exists:** read it, append `\n---\n\n<scan block>` via `vault.process` for atomic read-modify-write.
6. Return the `TFile` so `main.ts` can open it.

**Frontmatter** is written exactly once, at file creation:

```yaml
---
date: 2026-05-01
tags:
  - whiteboard
---
```

**Empty-input handling:** if `scan.items.length === 0` and `scan.unparsed.length === 0`, the modal surfaces "Nothing detected — try another angle?" rather than writing an empty scan block. No write happens.

## Output example

A day file with two scans:

````markdown
---
date: 2026-05-01
tags:
  - whiteboard
---

## 09:42

[whiteboard scan](attachments/2026-05-01-094237.jpg)

- [ ] Q2 launch prep
    - [ ] Lock messaging
    - [ ] Brief sales [^094237-1]
    - [ ] Brief support [^094237-1]
- [ ] Hire designer

[^094237-1]: Children inferred — "Brief sales" and "Brief support" appear to decompose "Q2 launch prep" but were not visually nested.

> [!note]- Unparsed
> - Diagram in upper-right corner: arrow from "Hiring" → "Q3"
> - Faint text near the bottom, possibly "ask Sam"

---

## 15:30

[whiteboard scan](attachments/2026-05-01-153022.jpg)

- [ ] Reorder office supplies
- [x] Submit expense report
````

## Error handling

| Failure | Surface | Message |
|---|---|---|
| No API key set | `Notice` on scan attempt | "Set your Iris API key in settings." |
| API 401 | `Notice` | "Invalid API key. Check your settings." |
| API 429 | `Notice` | "Rate limited. Try again in a moment." |
| API 400 (bad image) | Modal inline | "This image couldn't be read. Try a different photo." |
| API timeout / network | Modal inline | "Request failed. Check your connection." (retry stays available) |
| Unsupported file format | Modal inline | "Iris supports JPG, PNG, WebP, GIF. HEIC and other formats need conversion first." |
| Schema validation fail | `Notice` + console log | "Iris received an unexpected response. Try again — and please report if this keeps happening." Full response logged. |
| Vault write fail | `Notice` | Native error message (usually file-permission issues). |
| Empty scan result | Modal inline | "Nothing detected on the whiteboard. Try a clearer photo or different angle." |

## Testing

- **`render.ts`** — unit tests via `node --test`. Pure function, no Obsidian dependency. Cases: footnote numbering, indented multi-level hierarchy, conditional unparsed callout, conditional inferred-group footnotes, both `done` and `open` statuses, empty-children case, deeply-nested children.
- **`api.ts` schema validator** — unit tests. Reject malformed `parentPath` values, bad enums, missing fields, paths that index out of range.
- **`modal.ts`, `main.ts`, `file.ts`** — manual testing in a real test vault. Mocking the Obsidian API is more brittle than installing the plugin and using it.
- **End-to-end** — manual: real photo of a real whiteboard, both providers, single-scan and multi-scan day, verify image link clicks through, verify frontmatter only written once.

No CI test harness in v1. `npm test` runs the renderer + schema-validator tests; that is sufficient.

## Out of scope (revisit on demand)

- Per-scan template overrides.
- Custom system prompt.
- Configurable attachment subfolder or file naming.
- HEIC support.
- Cross-scan or cross-day deduplication.
- Editing or reformatting existing scan blocks.
