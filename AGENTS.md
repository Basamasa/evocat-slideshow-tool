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
Hook = TikTok-fast direct pain
Middle = specific useful steps or concrete visual proof
Ending = friction / EvoCat soft CTA
```

Create exactly 8 slide positions. A position can be either a text slide or a visual Screen Time mockup slide. Preserve the meaningful flow even when a visual slide replaces normal text, usually by making the previous or next slide explain what the screenshot proves.

For TikTok, first-slide text must hit in under 2 seconds. Use a very short hook first, then make later slides do the explaining.

Deep-research note (date-specific): sources checked from Apr 24-May 24, 2026 showed limited fresh public data specifically on "brainrot/phone control" phrasing, so this guidance is based on TikTok Creative Center/ads docs and recent 2026 hook breakdowns/tests.

What consistently works right now:

1. Direct callout ("you")
2. Specific pain/problem
3. Contrarian claim
4. Number/list promise
5. Very short text (5-9 words ideal)

Strong first-slide options for phone control / brainrot topics:

```text
Your Phone Is Training You To Lose Focus
5 Signs Your Brain Is Cooked By Scrolling
Your Screen Time Is A Personality Test
This Is Why You Can't Focus Anymore
Your Attention Span Is Being Sold
7 Signs Your Phone Owns Your Day
You're Not Lazy - You're Overstimulated
If You Do This, You're Brainrotted
Your Dopamine Is Not Yours Anymore
Why 3 Hours On TikTok Feels Like 10 Minutes
You're Rewarding The Wrong Brain Circuit
Your Phone Is Designing Your Mood
5 Brutal Signs Your Mind Is Addicted
You're Not Resting, You're Numbing Out
This Habit Is Quietly Killing Your Discipline
```

Recommended 8-position shape:

```text
Slide 1
[5-9 word direct hook]

Slide 2
[Specific symptom or first check]
[Very simple action]

Slide 3
[Optional Screen Time mockup slide, or concrete trigger check]

Slide 4
[Name the biggest trigger]
[Concrete check/action]

Slide 5
[Protect one specific time]
[Bedtime / morning / work / study]

Slide 6
[Make the first win small]
[One hour / one app / one time block]

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

## Visual Screen Time Slides

Agents can include a fake Apple-style Screen Time screenshot as one slide by using this blank-line-separated block in `slides.txt`. It renders as an image-only visual slide with no extra text overlay.

```text
[screen-time]
average: 10h 39m
change: 11%
direction: up
total: 74h 38m
days: 10h 5m, 12h 10m, 11h 20m, 7h 48m, 7h 42m, 8h 18m, 9h 4m
categories:
Social: 62h 12m
Entertainment: 5h 25m
Shopping & Food: 2h 58m
[/screen-time]
```

Rules for Screen Time mockups:

- Use the mockup only when it strengthens the story, commonly at slide 2, 3, or 5.
- Do not add caption text inside the same slide block. Let adjacent slides carry the meaning.
- Use plausible fake numbers that match the problem being discussed.
- Keep exactly 8 slide positions total.

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
For the first slide, prefer 5 to 9 words.

Chinese slide text is supported. The CLI renderer uses `@resvg/resvg-js`, reads the bundled Noto Serif SC font from `assets/fonts/`, converts Chinese slide-body glyphs into SVG paths, and wraps Chinese text by character instead of relying on spaces. Use `examples/chinese-slides.txt` as a reference. Do not render agent slides with screenshots, `canvas`, `node-canvas`, Pango, Cairo, `sharp`, `librsvg`, ImageMagick, or another SVG converter. If Chinese renders as blank text or boxed Unicode codes, you are almost certainly running stale code or the wrong command; pull the latest repo, run `npm install`, and run `npm run render`.

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
images.zip
```

Inside the ZIP:

```text
evocat-slide-01.png
evocat-slide-02.png
```

Do not put folders, text, JSON, README files, metadata files, or source files into the export ZIP. The ZIP should contain image files only.

If an agent needs to save reusable draft text outside a daily run, use `content/` and name files with the date:

```text
content/YYYY-MM-DD-topic-slug.md
```

This draft-file convention is provisional. The user said they will provide the final format later.

## Suggested Agent Workflow

1. Read `README.md`, this file, and any user-provided campaign format.
2. Generate exactly 8 slide positions in the accepted input format.
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
- `examples/screen-time-slides.txt`: mixed text and Screen Time mockup input
- `content/`: optional dated draft text created by agents
- `examples/`: sample input formats

## Notes

The user may provide a stricter content/file format later. When that happens, update this file, `README.md`, and the examples together.
