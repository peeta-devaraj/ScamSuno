# ScamSuno design tokens

[Source CSS](../../public/brand/tokens.css) is imported by Trust or Trap. A byte-identical copy ships with the editable video so it renders offline. After a token change, copy the file to `brag-output/composition/assets/scamsuno-tokens.css` before rendering. No build-time video dependency is required by the app.

- **Editorial backdrop:** `--ss-bg #211a2a`, `--ss-bg-raised #2b2238`, `--ss-glow #45334d`. The radial stops come from the original video's dark composition.
- **Surfaces:** `--ss-surface #382c42`, `--ss-surface-raised #4b3851`, `--ss-surface-inset #251d30`. The call card uses the video's diagonal violet gradient with a shadow `0 20px 55px #150e1d80`.
- **Type and brand:** `--ss-text #fff4ed`, `--ss-text-soft #e7d8e5`, `--ss-text-muted #cdbbd1`, `--ss-accent #ffad94`, `--ss-accent-ink #382639`. Cream on the base has 15.58:1 contrast and accent ink on coral 7.75:1. The wordmark uses the existing waveform geometry and heavy Segoe UI with system fallbacks. Use locale-appropriate system fonts for Indic scripts. Use system monospace for compact labels.
- **Borders and focus:** `--ss-border #806a83`, `--ss-divider #59475e`, `--ss-focus #ffe3b7`. Controls have a 3px offset focus ring and at least 44px tap height on key actions. Divider contrast is decorative; use the stronger border on controls. Radii are 12px, 18px and 28px for controls, panels and feature cards.
- **Status:** warning `#4e3835 / #ffdfad`, error `#512c3d / #ffd8cc`, success `#344139 / #e1efcf`, disabled `#3e3349 / #b9a9bf`. Colour reinforces explicit labels. All caller categories share the same reveal styling.
- **Motion and light interludes:** rings are static in the app. The waveform is static under reduced-motion preferences. The video can use the paper token `#fff9f0` with plum ink `#292238` for editorial contrast.

