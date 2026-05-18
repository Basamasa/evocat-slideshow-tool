# Evocat Slideshow Tool

A local browser tool for creating Evocat-style square slideshow images from human-written text or AI-generated text.

## Run

```sh
cd /Users/anzerarkin/Documents/current_projects/evocat-slideshow-tool
python3 -m http.server 4177
```

Open:

```text
http://localhost:4177/
```

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

The default export is `2048 x 2048`. The ZIP contains one PNG per slide.
