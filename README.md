# Iris

An Obsidian plugin that turns photos of whiteboard to-do lists into Markdown checklists. Snap a photo, get a structured checklist appended to today's note in your vault.

## Features

- **Capture from anywhere** — camera on mobile (`<input capture>`), file upload, drag-and-drop, or clipboard paste on desktop
- **Strikethrough → done** — struck-through items become `- [x]`; everything else becomes `- [ ]`
- **Hierarchy preserved** — visual nesting on the whiteboard is preserved as nested checklists. Semantic groupings (e.g. items under a category header) are inferred and footnoted with the model's reasoning
- **Multi-scan days** — multiple scans on the same day append into the same `YYYY-MM-DD.md` file with a `---` separator, so you can rebuild your day from the board as it evolves
- **Photos preserved** — the original image is saved into `<output>/attachments/` and linked at the top of each scan block
- **Anything unreadable goes to "Unparsed"** — diagrams, ambiguous text, side notes get collected into a collapsed callout instead of being silently dropped or hallucinated
- **Multi-provider** — works with Anthropic (Claude) or OpenAI (GPT), your choice

## Installation

Until Iris is available in the Obsidian community marketplace, install it manually using the [GitHub CLI](https://cli.github.com/):

```sh
# Latest release
gh release download \
  --repo TekGadgt/Iris \
  --pattern "main.js" \
  --pattern "manifest.json" \
  --pattern "styles.css" \
  --dir <vault>/.obsidian/plugins/iris/

# Specific version
gh release download 1.0.0 \
  --repo TekGadgt/Iris \
  --pattern "main.js" \
  --pattern "manifest.json" \
  --pattern "styles.css" \
  --dir <vault>/.obsidian/plugins/iris/
```

Replace `<vault>` with the path to your Obsidian vault. After downloading, enable the plugin in Settings > Community plugins.

## Setup

1. Install the plugin and enable it
2. Open Settings > Iris
3. Choose your AI provider (Anthropic or OpenAI)
4. Enter your API key ([Anthropic](https://console.anthropic.com/settings/keys) or [OpenAI](https://platform.openai.com/api-keys))
5. Optionally set a model override (defaults to Claude Sonnet for Anthropic, GPT-4o for OpenAI)
6. Choose an output folder (defaults to `Iris/`)

## Usage

Run a scan via:
- **Command palette** — search "Iris: Scan whiteboard"
- **Ribbon icon** — click the eye icon in the left sidebar

The capture modal opens. On mobile, pick "Take photo" or "Choose from files". On desktop, drop an image, paste from your clipboard, or click to choose. Hit Convert.

Iris saves the photo into `<output>/attachments/`, writes the checklist into `<output>/<YYYY-MM-DD>.md`, and opens the day file.

## Output format

```markdown
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

[^094237-1]: Children inferred — appear to decompose "Q2 launch prep".

> [!note]- Unparsed
> - Diagram in upper-right corner
```

## Requirements

- An API key from [Anthropic](https://console.anthropic.com/settings/keys) or [OpenAI](https://platform.openai.com/api-keys)
- Obsidian 1.11.4+ (required for secret storage)

## Limitations

- HEIC images are not supported. Use "Most Compatible" capture mode on iOS, or convert first.
- No deduplication across scans on the same day.
- Existing scan blocks are never edited or reformatted.
- OpenAI's `max_tokens` field is the legacy form. Newer reasoning models (e.g. `o1-mini`) require `max_completion_tokens` instead — if you set such a model in the override, requests may fail.
