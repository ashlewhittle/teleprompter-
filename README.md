# Prompter

A teleprompter for iPhone. You read your script as it scrolls over the selfie camera, and the app records the video at the same time. It's built for quick, short clips.

It's a web app made of plain HTML, CSS and JS, so there's no build step and no App Store. Open it in Safari and add it to your Home Screen, and it works like a normal app, offline too.

## Features

- **Ideas → script**: jot rough ideas, one per line (`- hook: ...`, `CTA: ...`), and tap **Ideas → script**. Each idea becomes a clean sentence on its own line. Labels like "hook:" and the bullet marks are removed.
- **Paste & go**: copy text from anywhere (Notes, ChatGPT, email) and make a script from it in one tap.
- **Length check**: shows the word count and an estimated read time, with a 15s / 30s / 60s / 90s target bar.
- **Teleprompter over the camera**: the text sits at the top of the screen, close to the lens, so you look into the camera while you read.
  - Use **− / +** to change speed, even while recording.
  - Tap the text to pause or play. Drag it to scroll back or skip ahead.
  - The **Aa** menu sets text size, panel height, panel darkness, mirrored preview and a 3-second countdown.
  - Switch between front and back cameras.
- **Record**: a 3-2-1 countdown, then the recording and the scrolling start together. Tap the button again to stop. You can then watch the clip back, **Retake**, or **Save video**. In the share sheet, choose *Save Video* to put it in Photos.
- Scripts and settings are saved on the phone (localStorage). The screen stays awake while you're filming.

## Put it on your iPhone

The camera only works over **https**, so the app needs to be hosted. GitHub Pages is free and the simplest option:

1. On GitHub, open this repo → **Settings → Pages**.
2. Under *Build and deployment*, set Source to **Deploy from a branch**, pick the branch (e.g. `main`) and the `/ (root)` folder, then **Save**.
3. After a minute it shows a URL like `https://<your-username>.github.io/teleprompter-/`.
4. Open that URL in **Safari** on your iPhone → Share button → **Add to Home Screen**.
5. Open it from the Home Screen icon. The first time you film, allow Camera and Microphone.

> If the camera is blocked, go to iPhone **Settings → Apps → Safari → Camera / Microphone** and set them to *Ask* or *Allow*.

## Run locally (for development)

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 in a desktop browser. (`localhost` counts as secure, so the webcam works.)

When you change any app files, bump `VERSION` in `sw.js` so installed copies pick up the update.
