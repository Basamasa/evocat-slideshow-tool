# Agent Instructions

This repo is a local tool for producing Evocat slideshow images. It has two modes:

- Browser UI for humans: open `index.html` directly.
- CLI renderer for agents: run `npm run render`.

Do not add a backend, server dependency, or hosted service unless the user explicitly asks for it. Agents without browser access should use the CLI renderer.

## Goal

Given a topic or campaign brief, create 8 short slide texts, save them in the dated daily post folder, render the slides, and export image files. The ZIP should contain only rendered PNG images.

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

Chinese slide text is supported. The CLI renderer uses the bundled Noto Serif SC font in `assets/fonts/` and wraps Chinese text by character instead of relying on spaces. Use `examples/chinese-slides.txt` as a reference. If Chinese renders as boxed Unicode codes, pull the latest repo and verify the font file exists before posting.

## Output Convention

For daily agent work, use this folder layout:

```text
daily_posts/
  YYYY-MM-DD-topic-slug/
    draft.md
    slides.txt
    images/
      evocat-slide-01.png
      evocat-slide-02.png
    images.zip
    post.md
    metrics.md
```

The CLI command should look like:

```sh
npm run render -- --input daily_posts/YYYY-MM-DD-topic-slug/slides.txt --out daily_posts/YYYY-MM-DD-topic-slug/images --zip daily_posts/YYYY-MM-DD-topic-slug/images.zip
```

When `Export ZIP` is clicked in the browser, or `--zip` is passed to the CLI, the browser/CLI creates a package named like:

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

If an agent needs to save reusable draft text outside a daily run, use `content/` and name files with the date:

```text
content/YYYY-MM-DD-topic-slug.md
```

This draft-file convention is provisional. The user said they will provide the final format later.

## Suggested Agent Workflow

1. Read `README.md`, this file, and any user-provided campaign format.
2. Generate exactly 8 slides in the accepted input format.
3. Save the draft and exact slide text in `daily_posts/YYYY-MM-DD-topic-slug/`.
4. Show the slide text to the user and wait for approval.
5. After approval, render with `npm run render`.
6. Inspect the output images if your environment supports image viewing.
7. Return the image folder and image-only ZIP path.

## Source Files

- `index.html`: UI structure
- `styles.css`: tool interface styling
- `app.js`: slide renderer, parser, and ZIP exporter
- `scripts/render.js`: browserless CLI renderer for agents
- `assets/ironcat-app-icon.png`: mascot image used in slides
- `content/`: optional dated draft text created by agents
- `examples/`: sample input formats

## Notes

The user may provide a stricter content/file format later. When that happens, update this file, `README.md`, and the examples together.
