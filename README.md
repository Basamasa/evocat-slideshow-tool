# Evocat Slideshow Tool

A local browser tool for creating Evocat-style square slideshow images from human-written text or AI-generated text.

## Run

Open this file directly in a browser:

```text
index.html
```

No backend, server, build step, or package install is required.

## Workflow

1. Write a topic, then click `Draft 8 slides`, or click `Copy AI prompt` and paste the result into ChatGPT.
2. Paste slide text into `Slide text`.
3. Separate slides with a blank line.
4. Click `Update preview`.
5. Click `Export ZIP`.

The slide text box accepts:

- blank-line-separated text
- numbered AI output like `1. First slide`
- JSON arrays like `["Slide one", "Slide two"]`

The default export is `2048 x 2048`.

The exported ZIP contains only PNG images.

## For Agents

Read `AGENTS.md` before using this repo as an internal content tool.
