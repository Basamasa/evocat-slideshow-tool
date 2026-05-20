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

Chinese text is supported after `npm install`. See `examples/chinese-slides.txt`.

The default export is `2048 x 2048`.

The exported ZIP contains only PNG images.

## For Agents

Read `AGENTS.md` before using this repo as an internal content tool.
