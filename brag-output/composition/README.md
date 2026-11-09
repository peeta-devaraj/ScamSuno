# Edit and render the ScamSuno V3 demo

Open `index.html` in HyperFrames Studio. This composition has a 60-second timeline, original artwork and music, and a signed-out capture of the public [Trust or Trap](https://scamsuno.vercel.app) entry. The artwork, timing and text live in `index.html`, `style.css`, and `timeline.js`. All render assets are local. Before editing shared tokens, refresh the local copy in `assets/scamsuno-tokens.css` from the repository's `public/brand/tokens.css`. The three evidence slots and public destination text are in `edit-config.js`.

## Render

From the worktree, using the verified local HyperFrames 0.9.26 install:

```powershell
$env:DO_NOT_TRACK = '1'
$videoCli = 'brag-output/.tools/node_modules/hyperframes/bin/hyperframes.mjs'
node $videoCli check brag-output/composition
node $videoCli render brag-output/composition --fps 30 --output brag-output/scamsuno-v3-draft.mp4
```

If using the editable archive on a new machine, install reviewed `hyperframes@0.9.26` in a separate local tools folder with lifecycle scripts disabled. Run its `doctor` to find Chrome and FFmpeg. Point `$videoCli` to that install and use `composition` as the project path. Node 22+ and FFmpeg are required. The optional `capture-entry.mjs` needs the ScamSuno worktree, Playwright with its FFmpeg helper, Chrome and access to the public site. It blocks API routes and changes only the language controls.

## Replace the placeholder after acceptance

1. Review the original Android recording with the acceptance result. Keep the original privately. Remove account information and notifications. Confirm the user spoke a fictional reply, the unedited transcript was confirmed, the contextual caller answer was audible, and End and the debrief worked.
2. From one continuous accepted call, prepare three separate H.264/AAC MP4 exports in `assets/` using frame-accurate cuts. Voice goes in 10–36 s (26 s), End and the independent check in 36–45 s (9 s), and the debrief in 45–52 s (7 s). Preserve chronological order and device audio. Use a visible time-cut annotation if shortening a wait. For a clip shorter than its slot, hold its own last frame and pad audio with silence to the slot duration.
3. In `edit-config.js`, replace each corresponding `null` with its local `src`, a precise source `caption`, and optional `subtitles` using seconds relative to the slot. Keep captions faithful to what was said. Review translations with a native speaker. Subtitles appear only during their cue. Do not enable one slot with footage from a different call.
4. The original music is silent during the voice slot. For a final cut, duck or mute the music over the other two verified clips if they contain speech. Check the actual recording's synchronization throughout the edit. Recheck signed-out access at `scamsuno.vercel.app` and keep that address on the end card. Replace all three illustrations with footage from the same accepted call.
5. Run the browser check and render a new MP4, keeping this draft. Verify 1920×1080, 30 fps, 1,800 frames, 60 seconds, H.264/AAC, speech intelligibility and synchronization. Update the manifest and status with the observed models and device evidence. Review the entire MP4 before seeking approval to publish.

The first frame is the branded thumbnail. Extract it with `ffmpeg -i VIDEO.mp4 -frames:v 1 thumbnail.jpg`. The original draft music can be rebuilt with `python make-score.py`.
