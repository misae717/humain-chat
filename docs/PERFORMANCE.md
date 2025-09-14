# Performance Notes

Symptoms observed
- GPU usage spikes when chat view is visible (animated gradients, blend modes).

Likely contributors
- Large-area animated backgrounds (gradient hue shift).
- Multiple soft-light layers (ocean effect) and SVG noise overlay.

Quick mitigations
- Turn off Animated gradient, Ocean waves, or Noise overlay in Settings.
- Lower Ocean intensity.

Future work
- Add a "Low motion" preset that disables blend modes and reduces keyframes.
- Pause animations when Obsidian window is unfocused/hidden.
- Respect `prefers-reduced-motion` automatically.
