# Agent Instructions

This repo is a local, static, browser-only tool for producing Evocat slideshow images.

Do not add a backend, server dependency, package manager, build step, or hosted service unless the user explicitly asks for it. The normal workflow is to open `index.html` directly in a browser and export a ZIP.

## Goal

Given a topic or campaign brief, create 8 short slide texts, paste them into the tool, render the slides, and export the ZIP. The ZIP should contain only rendered PNG images.

## Default Content Format

Use this winning slideshow format unless the user provides a different one:

```text
Hook = self-diagnosis
Middle = specific useful steps
Ending = friction / EvoCat soft CTA
```

Create exactly 8 slides:

```text
Slide 1
[Painful self-diagnosis question]

Slide 2
[The first thing to check]
[Very simple action]

Slide 3
[Find the biggest trigger]
[Concrete check/action]

Slide 4
[Protect one specific time]
[Bedtime / morning / work / study]

Slide 5
[Make the first win small]
[One hour / one app / one time block]

Slide 6
[Explain the mistake people make]
[Do this instead]

Slide 7
[Core principle]
[Short memorable line]

Slide 8
[EvoCat soft CTA]
[App Store search line]
```

The last slide should connect directly to the problem and should not feel like a hard ad. A good pattern is:

```text
If you keep going back to the same app
Try EvoCat on the App Store.
```

## Input Format

The slide text box accepts any of these formats:

```text
Slide one text

Slide two text

Slide three text
```

```text
1. Slide one text

2. Slide two text

3. Slide three text
```

```json
[
  "Slide one text",
  "Slide two text",
  "Slide three text"
]
```

Keep each slide focused on one idea. Prefer 6 to 16 words per slide, unless the user asks for a different style. Use direct language, no hashtags, and no emoji by default. Use line breaks inside a slide when the slide has a headline and supporting line.

## Output Convention

When `Export ZIP` is clicked, the browser downloads a package named like:

```text
YYYY-MM-DD-topic-slug.zip
```

Inside the ZIP:

```text
YYYY-MM-DD-topic-slug/
  evocat-slide-01.png
  evocat-slide-02.png
```

Do not put text, JSON, README files, metadata files, or source files into the export ZIP.

If an agent needs to save draft text before exporting, use `content/` and name files with the date:

```text
content/YYYY-MM-DD-topic-slug.md
```

This draft-file convention is provisional. The user said they will provide the final format later.

## Suggested Agent Workflow

1. Read `README.md`, this file, and any user-provided campaign format.
2. Generate 7 or 8 slides in the accepted input format.
3. Open `index.html` locally in a browser.
4. Paste the slide text and click `Update preview`.
5. Inspect the preview for overflow, awkward wrapping, and wrong brand text.
6. Click `Export ZIP`.
7. Return the image-only ZIP path or upload the ZIP according to the current environment.

## Source Files

- `index.html`: UI structure
- `styles.css`: tool interface styling
- `app.js`: slide renderer, parser, and ZIP exporter
- `assets/ironcat-app-icon.png`: mascot image used in slides
- `content/`: optional dated draft text created by agents
- `examples/`: sample input formats

## Notes

The user may provide a stricter content/file format later. When that happens, update this file, `README.md`, and the examples together.
