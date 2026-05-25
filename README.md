# Evocat Slideshow Tool

A local browser tool for creating Evocat-style square slideshow images from human-written text or AI-generated text.

## Human UI

Open this file directly in a browser:

```text
index.html
```

No backend, server, build step, or package install is required.

## Agent CLI

Agents without a browser should use the CLI renderer:

```sh
npm install
npm run render -- --input examples/slides.json --out daily_posts/2026-05-18-screen-time/images --zip daily_posts/2026-05-18-screen-time/images.zip
```

The CLI writes PNG images directly to the output folder. The ZIP contains only PNG images.
The CLI uses `@resvg/resvg-js`. For Chinese slide bodies, it converts the bundled font glyphs into SVG paths before rendering, so it does not need Chrome, screenshots, `canvas`, Pango, Cairo, host-installed Chinese fonts, `sharp`, or `librsvg`.

## Workflow

1. Write a topic, then click `Draft 8 slides`, or click `Copy AI prompt` and paste the result into ChatGPT.
2. Paste slide text into `Slide text`.
3. Separate slides with a blank line.
4. Click `Update preview`.
5. Click `Export ZIP`, or use the CLI renderer.

The slide text box accepts:

- blank-line-separated text
- numbered AI output like `1. First slide`
- JSON arrays like `["Slide one", "Slide two"]`
- a `[screen-time]` block for one fake Screen Time visual slide

Chinese text is supported with a bundled font in `assets/fonts/`. See `examples/chinese-slides.txt`. After pulling changes, run `npm install` so the local agent has the renderer dependencies.

Screen Time mockup slides are supported in both the browser and CLI renderer. Use one block as one slide:

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

For current EvoCat social posts, agents should still create exactly 8 slide positions. The first slide should be a TikTok-fast hook, ideally 5-9 words, and a Screen Time mockup can replace a normal text slide when it makes the problem concrete.

The default export is `2048 x 2048`.

The exported ZIP contains only PNG images.

## For Agents

Read `AGENTS.md` before using this repo as an internal content tool.
