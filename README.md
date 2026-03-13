# Illusionator Infinity

Illusionator Infinity is a research-informed generative web app that synthesizes optical illusions from perceptual science principles, then uses novelty search and user feedback to surface the strongest results.

## What it does

- Generates an effectively unbounded stream of new illusions using seeded procedural synthesis.
- Mixes multiple illusion families in one composition:
  - Moire interference
  - Cafe wall distortion
  - Zollner orientation conflict
  - Scintillating grids
  - Peripheral drift rings
  - Kanizsa contour completion
  - Fraser spiral variants
  - Pinna-Brelstaff drift sectors
  - Ouchi texture-shift fields
  - Mach band luminance ramps
  - Troxler fade fields
  - Hering radial warp contexts
  - Muller-Lyer arrow fields
  - Ponzo perspective corridors
  - Poggendorff occlusion cuts
  - White lightness-context bars
  - Delboeuf ring surrounds
- Runs a novelty search over candidate pools to favor new, different outputs.
- Lets users explore and curate with likes, favorites, navigation history, and autoplay.
- Persists session state in browser local storage.

## Run locally

Because this is a static app, any local HTTP server works.

```bash
python3 -m http.server 8787
```

Then open:

- `http://localhost:8787`

## Usage

1. Use the **right edge arrow** to move forward (or generate a new illusion when at the newest view).
2. Use the **left edge arrow** to move back through prior illusions.
3. Use keyboard **Left** and **Right** arrow keys for the same navigation.
4. On mobile, swipe left/right on the fullscreen illusion to navigate Tinder-style.
5. Tap the **heart** button to like the current illusion and the **star** button to favorite it.
6. Open the hidden side menu with **Menu** for finer controls (complexity, motion, novelty bias, batch generation, autoplay, export).

## Notes

- "Never-before-seen" is approximated in practice using novelty distance from previous generated outputs in your session history.
- The seed space and parameter mixing are large enough to support near-infinite exploration.
