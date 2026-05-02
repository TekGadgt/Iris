# Iris

An Obsidian plugin that turns photos of whiteboard to-do lists into Markdown checklists.

Iris reads a whiteboard photo with a vision-capable AI model and appends a structured checklist to a per-day file in your vault. Multi-scan days append into the same file with a `---` separator.

## Features

- Camera capture on mobile (`<input capture>`), file upload anywhere, clipboard paste on desktop.
- Strikethrough items become `- [x]`; everything else becomes `- [ ]`.
- Visual hierarchy preserved as nested checklists. Inferred (semantic) hierarchy is footnoted with the model's reasoning.
- Anything unreadable goes into a collapsed "Unparsed" callout instead of being silently dropped.
- Provider toggle: Anthropic (Claude) or OpenAI. Bring your own key.

## Setup

1. Install the plugin (manual install — drop `manifest.json`, `main.js`, `styles.css` into `<vault>/.obsidian/plugins/iris/`).
2. Open settings → Iris.
3. Choose provider, set API key, optionally override the model.
4. Choose an output folder (default: `Iris`).

## Usage

- Click the eye icon in the ribbon, or run "Iris: Scan whiteboard" from the command palette.
- On mobile: pick "Take photo" or "Choose from files".
- On desktop: drop an image, paste from clipboard, or click to choose.
- Iris saves the photo into `<output>/attachments/`, writes the checklist into `<output>/<YYYY-MM-DD>.md`, and opens the file.

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

## Limitations

- HEIC images are not supported. Use "Most Compatible" capture mode on iOS, or convert first.
- No deduplication across scans on the same day.
- Existing scan blocks are never edited or reformatted.
