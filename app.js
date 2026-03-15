const STORAGE_KEY = "illusionator-session-v1";
const MAX_DISCOVERIES = 120;
const SWIPE_DISTANCE = 48;
const TAU = Math.PI * 2;
const NOVELTY_K = 7;
const QUALITY_PROBE_WIDTH = 176;
const QUALITY_PROBE_HEIGHT = 112;
const QUALITY_PROBE_BUDGET = 20;
const MIN_QUALITY_PASSES = 7;
const COMPOSITION_WIDTH = 1100;
const COMPOSITION_HEIGHT = 700;
const MOBILE_COMPOSITION_SCALE = 1.18;
const MOBILE_VIEWPORT_MAX = 900;
const APP_MODE_GENERATOR = "generator";
const APP_MODE_COMPOSER = "composer";
const DEFAULT_COMPOSER_MENU_WIDTH = 980;

const viewerEl = document.getElementById("viewer");
const canvas = document.getElementById("illusionCanvas");
const researchListEl = document.getElementById("researchList");
const researchMixMetaEl = document.getElementById("researchMixMeta");

const menuToggleBtn = document.getElementById("menuToggleBtn");
const menuCloseBtn = document.getElementById("menuCloseBtn");
const menuBackdrop = document.getElementById("menuBackdrop");
const sideMenuEl = document.getElementById("sideMenu");
const composerResizeHandleEl = document.getElementById("composerResizeHandle");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const saveBtn = document.getElementById("saveBtn");

const complexityRange = document.getElementById("complexityRange");
const motionRange = document.getElementById("motionRange");
const noveltyRange = document.getElementById("noveltyRange");

const complexityValue = document.getElementById("complexityValue");
const motionValue = document.getElementById("motionValue");
const noveltyValue = document.getElementById("noveltyValue");

const currentSeedEl = document.getElementById("currentSeed");
const currentNoveltyEl = document.getElementById("currentNovelty");
const currentPositionEl = document.getElementById("currentPosition");

const discoveryCountLabelEl = document.getElementById("discoveryCountLabel");
const savedCountLabelEl = document.getElementById("savedCountLabel");
const autoplayStateLabelEl = document.getElementById("autoplayStateLabel");
const discoveryCountEl = document.getElementById("discoveryCount");
const savedCountEl = document.getElementById("savedCount");
const autoplayStateEl = document.getElementById("autoplayState");

const newBtn = document.getElementById("newBtn");
const evolveBtn = document.getElementById("evolveBtn");
const batchBtn = document.getElementById("batchBtn");
const autoplayBtn = document.getElementById("autoplayBtn");
const exportBtn = document.getElementById("exportBtn");
const shareBtn = document.getElementById("shareBtn");
const generatorModeBtn = document.getElementById("generatorModeBtn");
const composerModeBtn = document.getElementById("composerModeBtn");
const modePanelEls = Array.from(document.querySelectorAll("[data-mode-panel]"));

const composerPanelEl = document.getElementById("composerPanel");
const customNameInput = document.getElementById("customNameInput");
const customBackgroundInput = document.getElementById("customBackgroundInput");
const customSchemeSelect = document.getElementById("customSchemeSelect");
const customNewBtn = document.getElementById("customNewBtn");
const customSaveBtn = document.getElementById("customSaveBtn");
const customShareBtn = document.getElementById("customShareBtn");
const customStatusEl = document.getElementById("customStatus");
const elementPickerEl = document.getElementById("elementPicker");
const savedCustomListEl = document.getElementById("savedCustomList");
const layerListEl = document.getElementById("layerList");
const layerSummaryEl = document.getElementById("layerSummary");
const composerPreviewCanvas = document.getElementById("composerPreviewCanvas");

const state = {
  options: {
    complexity: 6,
    motion: 4,
    noveltyBias: 0.75,
    enabledPrinciples: [],
  },
  discoveries: [],
  preference: {}, // legacy mirror of linear preference weights
  preferenceModel: {
    bias: 0,
    linear: {},
    pair: {},
    updates: 0,
  },
  currentId: null,
  autoplay: false,
  lastAutoplayAt: 0,
  archiveVectors: [],
  frameGate: 0,
  seedCounter: 0,
  appMode: APP_MODE_GENERATOR,
  composerMenuWidth: DEFAULT_COMPOSER_MENU_WIDTH,
  customSeedCounter: 0,
  currentCustomId: null,
  customCompositions: [],
  customDraft: null,
  menuOpen: false,
  menuResizeSession: null,
  touchStart: null,
};

const qualityProbeCanvas = document.createElement("canvas");
qualityProbeCanvas.width = QUALITY_PROBE_WIDTH;
qualityProbeCanvas.height = QUALITY_PROBE_HEIGHT;

const customColorSchemes = [
  {
    id: "neon-noir",
    name: "Neon Noir",
    colors: ["#6df7ff", "#ff7ad9", "#ffd166", "#7cff8c"],
    ink: "#f4f0e8",
  },
  {
    id: "acid-sun",
    name: "Acid Sun",
    colors: ["#ff7b54", "#ffd23f", "#6cffb8", "#2bd9fe"],
    ink: "#f9f3e6",
  },
  {
    id: "opal-night",
    name: "Opal Night",
    colors: ["#b4f5ff", "#93a7ff", "#d7a6ff", "#ffb6d9"],
    ink: "#f7f7fb",
  },
  {
    id: "ember-signal",
    name: "Ember Signal",
    colors: ["#ff8a5b", "#ffcf6e", "#f14a7d", "#8af0d6"],
    ink: "#fff2e2",
  },
];

let customElementTypes = [];

const researchPrinciples = [
  {
    id: "moire_field",
    name: "Moiré Interference",
    mechanism:
      "Layered periodic structure creates emergent contours and false curvature through frequency beating.",
    sample: (rng, options) => ({
      spacing: rng.float(7, 26 - options.complexity * 0.7),
      amplitude: rng.float(5, 18 + options.complexity * 5),
      freq: rng.float(0.45, 1.9),
      stroke: rng.float(0.6, 2.5),
      angleA: rng.float(-0.8, 0.8),
      angleB: rng.float(-0.8, 0.8),
      drift: rng.float(0.5, 1.8),
    }),
    draw: drawMoireField,
  },
  {
    id: "parallax_tile_drift",
    name: "Parallax Tile Drift",
    mechanism:
      "Oversized translucent slabs slide across moving line fields so depth layers appear to shear past each other.",
    fullScreenMotion: true,
    sample: (rng, options) => ({
      cols: rng.int(4, 8),
      rows: rng.int(4, 7),
      fieldSpacing: rng.float(12, 30 - options.complexity * 0.5),
      fieldWidth: rng.float(3.5, 10 + options.complexity * 0.35),
      fieldAngle: rng.float(-0.9, 0.9),
      crossAngle: rng.float(0.18, 0.7) * rng.sign(),
      fieldDrift: rng.float(0.16, 0.62 + options.motion * 0.08),
      tileDrift: rng.float(0.12, 0.52 + options.motion * 0.06),
      tileScale: rng.float(0.68, 1.08),
      tilt: rng.float(0.04, 0.2),
      corner: rng.float(0.04, 0.18),
    }),
    draw: drawParallaxTileDrift,
  },
  {
    id: "barber_pole_shear",
    name: "Barber Pole Shear",
    mechanism:
      "Stripe motion inside giant angled apertures conflicts with the outer slab direction, producing sliding and extrusion.",
    fullScreenMotion: true,
    alphaRange: [0.74, 0.9],
    preferredBlends: ["source-over", "screen"],
    sample: (rng, options) => ({
      bands: rng.next() < 0.72 ? 3 : 2,
      bandAngle: rng.float(-0.92, 0.92),
      stripeAngle: rng.float(-0.08, 0.08),
      stripeSpacing: rng.float(8.5, 12.5),
      stripeWidth: rng.float(2.4, 4.2),
      stripeDrift: rng.float(0.14, 0.24 + options.motion * 0.02),
      backgroundSpacing: rng.float(28, 38),
      backgroundDrift: rng.float(0.025, 0.07 + options.motion * 0.012),
      slabHeight: rng.float(0.4, 0.52),
      slabLength: rng.float(2.7, 3.3),
      slabTravel: rng.float(0.06, 0.12 + options.motion * 0.012),
      slabBob: rng.float(0.018, 0.038),
      slabSway: rng.float(0.02, 0.05),
      depthPulse: rng.float(0.025, 0.055),
      laneOverlap: rng.float(0.58, 0.68),
      corner: rng.float(0.08, 0.18),
      ghosts: 1,
    }),
    draw: drawBarberPoleShear,
  },
  {
    id: "caustic_wave_mesh",
    name: "Caustic Wave Mesh",
    mechanism:
      "Several low-frequency line lattices drift out of phase, turning the whole frame into a breathing field of curvature.",
    fullScreenMotion: true,
    sample: (rng, options) => ({
      spacing: rng.float(10, 22 - options.complexity * 0.35),
      amplitude: rng.float(18, 54 + options.complexity * 4.5),
      freq: rng.float(0.22, 0.68),
      stroke: rng.float(0.55, 1.7),
      angleA: rng.float(-0.85, 0.85),
      angleB: rng.float(-0.85, 0.85),
      angleC: rng.float(-0.85, 0.85),
      drift: rng.float(0.16, 0.48 + options.motion * 0.05),
      veilBands: rng.int(2, 6),
    }),
    draw: drawCausticWaveMesh,
  },
  {
    id: "cafe_wall",
    name: "Cafe Wall Distortion",
    mechanism:
      "Offset checker rows and thin mortar lines induce local orientation bias and apparent wedge tilt.",
    sample: (rng, options) => ({
      rows: rng.int(8, 16 + options.complexity),
      cols: rng.int(10, 22 + options.complexity),
      offset: rng.float(0.15, 0.62),
      mortar: rng.float(0.06, 0.24),
      wave: rng.float(0.2, 1.25),
    }),
    draw: drawCafeWall,
  },
  {
    id: "zollner_lines",
    name: "Zollner Orientation Conflict",
    mechanism:
      "Conflicting local line cues bias global parallel judgement and skew perceived orientation.",
    sample: (rng, options) => ({
      lineCount: rng.int(8, 20 + options.complexity),
      gapJitter: rng.float(0.08, 0.35),
      tickLength: rng.float(7, 18 + options.complexity * 1.7),
      tickGap: rng.float(14, 32),
      tickAngle: rng.float(0.3, 0.95),
      slope: rng.float(-0.12, 0.12),
      stroke: rng.float(0.9, 2.6),
    }),
    draw: drawZollnerLines,
  },
  {
    id: "scintillating_grid",
    name: "Scintillating Grid",
    mechanism:
      "Peripheral contrast sampling and fixation shifts produce phantom flicker at intersections.",
    fixationTarget: true,
    sample: (rng, options) => ({
      rows: rng.int(6, 16 + Math.floor(options.complexity / 2)),
      cols: rng.int(6, 18 + Math.floor(options.complexity / 2)),
      lineWidth: rng.float(1.4, 4.6),
      dotRadius: rng.float(2.4, 7.2),
      jitter: rng.float(0.05, 0.38),
      flickerSpeed: rng.float(0.3, 1.5),
    }),
    draw: drawScintillatingGrid,
  },
  {
    id: "peripheral_drift",
    name: "Peripheral Drift Rings",
    mechanism:
      "Asymmetric luminance sequencing across ring segments induces apparent rotation and drift.",
    fixationTarget: true,
    sample: (rng, options) => ({
      rings: rng.int(5, 11 + Math.floor(options.complexity / 2)),
      segments: rng.int(18, 34 + options.complexity),
      width: rng.float(0.36, 0.82),
      twist: rng.float(0.03, 0.16),
      speed: rng.float(0.22, 1.15 + options.motion * 0.06),
      dimple: rng.float(0.1, 0.45),
    }),
    draw: drawPeripheralDrift,
  },
  {
    id: "kanizsa_web",
    name: "Kanizsa Contour Fields",
    mechanism:
      "Strategic occluders trigger completion of illusory edges and implied surfaces.",
    sample: (rng, options) => ({
      nodes: rng.int(3, 7),
      radius: rng.float(18, 56 + options.complexity * 3),
      bite: rng.float(0.25, 0.58),
      orbit: rng.float(0.16, 0.42),
      spin: rng.float(0.18, 0.95),
      softness: rng.float(0.16, 0.6),
    }),
    draw: drawKanizsaWeb,
  },
  {
    id: "fraser_spiral",
    name: "Fraser Spiral Variant",
    mechanism:
      "Tilted local elements arranged in circles produce false global spiral trajectories.",
    fixationTarget: true,
    sample: (rng, options) => ({
      rings: rng.int(7, 16 + options.complexity),
      block: rng.float(6, 16 + options.complexity * 0.8),
      tilt: rng.float(0.16, 0.62),
      twist: rng.float(0.25, 0.95),
      stroke: rng.float(0.3, 1.2),
      speed: rng.float(0.2, 0.8 + options.motion * 0.08),
    }),
    draw: drawFraserSpiral,
  },
  {
    id: "pinna_brelstaff",
    name: "Pinna-Brelstaff Drift",
    mechanism:
      "Tilted repeated sectors inside concentric rings induce illusory rotation during radial gaze motion.",
    fixationTarget: true,
    sample: (rng, options) => ({
      rings: rng.int(4, 10 + Math.floor(options.complexity / 3)),
      wedges: rng.int(18, 38 + options.complexity),
      skew: rng.float(0.22, 0.85),
      thickness: rng.float(0.34, 0.78),
      spin: rng.float(0.16, 0.68 + options.motion * 0.08),
      arcFill: rng.float(0.62, 0.94),
    }),
    draw: drawPinnaBrelstaff,
  },
  {
    id: "ouchi_tiles",
    name: "Ouchi Texture Shift",
    mechanism:
      "Conflicting orientation textures in center and surround create relative sliding motion under eye movement.",
    fixationTarget: true,
    sample: (rng, options) => ({
      spacing: rng.float(8, 24 - options.complexity * 0.45),
      centerScale: rng.float(0.28, 0.58),
      angleA: rng.float(-0.36, 0.36),
      angleB: rng.float(0.86, 1.62),
      pulse: rng.float(0.08, 0.44 + options.motion * 0.05),
      corner: rng.float(0.08, 0.24),
    }),
    draw: drawOuchiTiles,
  },
  {
    id: "mach_bands",
    name: "Mach Band Ramps",
    mechanism:
      "Lateral inhibition at luminance transitions exaggerates edge contrast and creates phantom bright or dark bands.",
    sample: (rng, options) => ({
      bands: rng.int(5, 14 + Math.floor(options.complexity / 2)),
      orientation: rng.float(-0.95, 0.95),
      edgeBoost: rng.float(0.07, 0.28),
      ripple: rng.float(0.04, 0.28 + options.motion * 0.03),
      ramp: rng.float(0.22, 0.78),
      drift: rng.float(0.08, 0.62),
    }),
    draw: drawMachBands,
  },
  {
    id: "troxler_field",
    name: "Troxler Fade Field",
    mechanism:
      "With steady fixation, low-contrast peripheral blobs fade from awareness and then reappear with microsaccades.",
    fixationTarget: true,
    sample: (rng, options) => ({
      blobs: rng.int(18, 54 + options.complexity * 3),
      ringRadius: rng.float(0.22, 0.44),
      spread: rng.float(0.18, 0.38),
      blobSize: rng.float(10, 30 + options.complexity * 1.4),
      softness: rng.float(0.24, 0.72),
      drift: rng.float(0.04, 0.34 + options.motion * 0.04),
    }),
    draw: drawTroxlerField,
  },
  {
    id: "muller_lyer_field",
    name: "Muller-Lyer Field",
    mechanism:
      "Arrowhead orientation alters perceived line length despite equal physical segment lengths.",
    sample: (rng, options) => ({
      rows: rng.int(6, 14 + Math.floor(options.complexity / 2)),
      baseLength: rng.float(0.3, 0.72),
      arrowLength: rng.float(0.035, 0.11),
      wingAngle: rng.float(0.38, 1.05),
      rowSlope: rng.float(-0.07, 0.07),
      drift: rng.float(0.04, 0.32 + options.motion * 0.04),
    }),
    draw: drawMullerLyerField,
  },
  {
    id: "ponzo_corridor",
    name: "Ponzo Corridor",
    mechanism:
      "Perspective convergence cues bias size perception so equal bars appear different lengths.",
    sample: (rng, options) => ({
      horizonY: rng.float(0.16, 0.38),
      railSpread: rng.float(0.14, 0.44),
      railCount: rng.int(7, 20 + options.complexity),
      barCount: rng.int(3, 7 + Math.floor(options.complexity / 3)),
      barWidth: rng.float(0.2, 0.6),
      drift: rng.float(0.04, 0.3 + options.motion * 0.04),
    }),
    draw: drawPonzoCorridor,
  },
  {
    id: "poggendorff_cut",
    name: "Poggendorff Occlusion",
    mechanism:
      "Occluding strips disrupt diagonal continuation and produce a robust misalignment illusion.",
    sample: (rng, options) => ({
      strips: rng.int(1, 3 + Math.floor(options.complexity / 4)),
      stripWidth: rng.float(0.12, 0.26),
      angle: rng.float(0.32, 1.06),
      lineCount: rng.int(4, 11 + Math.floor(options.complexity / 2)),
      jitter: rng.float(0.02, 0.16),
      drift: rng.float(0.02, 0.22 + options.motion * 0.03),
    }),
    draw: drawPoggendorffCut,
  },
  {
    id: "white_lightness",
    name: "White Lightness Context",
    mechanism:
      "Gray patches embedded in alternating bars shift perceived brightness via local junction context.",
    sample: (rng, options) => ({
      stripeCount: rng.int(8, 22 + options.complexity),
      stripeAngle: rng.float(-0.48, 0.48),
      patchCols: rng.int(2, 5),
      patchRows: rng.int(2, 7 + Math.floor(options.complexity / 3)),
      patchScale: rng.float(0.14, 0.42),
      jitter: rng.float(0.02, 0.18),
      drift: rng.float(0.02, 0.2 + options.motion * 0.03),
    }),
    draw: drawWhiteLightness,
  },
];

const researchById = Object.fromEntries(researchPrinciples.map((item) => [item.id, item]));
const allPrincipleIds = researchPrinciples.map((item) => item.id);
const immersiveMotionPrincipleIds = researchPrinciples
  .filter((item) => item.fullScreenMotion)
  .map((item) => item.id);
customElementTypes = researchPrinciples.map((profile) => ({
  id: profile.id,
  name: profile.name,
  description: profile.mechanism,
  defaultSpeed: profile.fullScreenMotion ? 1 : profile.fixationTarget ? 0.45 : 0.7,
  buildParams(rng, options) {
    return cloneJson(profile.sample(rng, options));
  },
  draw(ctx, width, height, layer, scheme, time) {
    drawCustomResearchElement(profile, ctx, width, height, layer, scheme, time);
  },
}));
const customSchemeById = Object.fromEntries(customColorSchemes.map((item) => [item.id, item]));
const customElementById = Object.fromEntries(customElementTypes.map((item) => [item.id, item]));
const blendModes = [
  "source-over",
  "screen",
  "multiply",
  "soft-light",
  "difference",
  "lighter",
  "overlay",
  "exclusion",
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getComposerMenuWidthBounds() {
  const maxWidth = Math.max(360, Math.floor(window.innerWidth * 0.96));
  const minWidth = Math.min(420, maxWidth);
  return { minWidth, maxWidth };
}

function clampComposerMenuWidth(width) {
  const { minWidth, maxWidth } = getComposerMenuWidthBounds();
  return clamp(width, minWidth, maxWidth);
}

function wrapHue(h) {
  const mod = h % 360;
  return mod < 0 ? mod + 360 : mod;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function hexToRgb(hex) {
  const normalized = typeof hex === "string" ? hex.trim() : "";
  if (!/^#?[0-9a-f]{6}$/i.test(normalized)) {
    return { r: 255, g: 255, b: 255 };
  }

  const compact = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  return {
    r: Number.parseInt(compact.slice(0, 2), 16),
    g: Number.parseInt(compact.slice(2, 4), 16),
    b: Number.parseInt(compact.slice(4, 6), 16),
  };
}

function rgbToHsl(r, g, b) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (!delta) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  if (max === nr) {
    hue = (ng - nb) / delta + (ng < nb ? 6 : 0);
  } else if (max === ng) {
    hue = (nb - nr) / delta + 2;
  } else {
    hue = (nr - ng) / delta + 4;
  }

  return {
    h: (hue / 6) * 360,
    s: saturation * 100,
    l: lightness * 100,
  };
}

function hexToTone(hex) {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  return makeTone(hsl.h, hsl.s, hsl.l);
}

function rgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim());
}

function encodeBase64Url(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = padded + "=".repeat((4 - (padded.length % 4 || 4)) % 4);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function pick(list, rng) {
  return list[Math.floor(rng.next() * list.length)];
}

function weightedChoice(items, weights, rng) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  let target = rng.next() * total;
  for (let i = 0; i < items.length; i += 1) {
    target -= weights[i];
    if (target <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

function sanitizeLayers(layers) {
  if (!Array.isArray(layers)) {
    return [];
  }

  return layers.filter((layer) => layer?.principleId && researchById[layer.principleId]);
}

function normalizeEnabledPrinciples(ids) {
  if (!Array.isArray(ids)) {
    return [...allPrincipleIds];
  }

  const normalized = Array.from(
    new Set(ids.filter((principleId) => typeof principleId === "string" && researchById[principleId]))
  );
  return normalized.length ? normalized : [...allPrincipleIds];
}

function mergeImmersiveMotionPrinciples(ids) {
  const normalized = normalizeEnabledPrinciples(ids);
  if (!Array.isArray(ids)) {
    return normalized;
  }

  const broadPoolThreshold = Math.max(10, allPrincipleIds.length - immersiveMotionPrincipleIds.length - 2);
  if (normalized.length < broadPoolThreshold) {
    return normalized;
  }

  const expanded = [...normalized];
  for (const principleId of immersiveMotionPrincipleIds) {
    if (!expanded.includes(principleId)) {
      expanded.push(principleId);
    }
  }
  return expanded;
}

function getEnabledPrinciples() {
  state.options.enabledPrinciples = normalizeEnabledPrinciples(state.options.enabledPrinciples);
  return state.options.enabledPrinciples;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function ensurePreferenceModelShape() {
  if (!state.preferenceModel || typeof state.preferenceModel !== "object") {
    state.preferenceModel = { bias: 0, linear: {}, pair: {}, updates: 0 };
  }
  state.preferenceModel.linear = state.preferenceModel.linear || {};
  state.preferenceModel.pair = state.preferenceModel.pair || {};
  if (typeof state.preferenceModel.bias !== "number") {
    state.preferenceModel.bias = 0;
  }
  if (typeof state.preferenceModel.updates !== "number") {
    state.preferenceModel.updates = 0;
  }
}

function getLinearPreference(principleId) {
  ensurePreferenceModelShape();
  return Number(state.preferenceModel.linear[principleId] || 0);
}

function getPairPreference(a, b) {
  ensurePreferenceModelShape();
  return Number(state.preferenceModel.pair[pairKey(a, b)] || 0);
}

function estimatePreferenceScore(principles) {
  ensurePreferenceModelShape();
  if (!principles.length) {
    return state.preferenceModel.bias;
  }

  let linearSum = 0;
  for (const principleId of principles) {
    linearSum += getLinearPreference(principleId);
  }
  const linearTerm = linearSum / principles.length;

  let pairSum = 0;
  let pairCount = 0;
  for (let i = 0; i < principles.length; i += 1) {
    for (let j = i + 1; j < principles.length; j += 1) {
      pairSum += getPairPreference(principles[i], principles[j]);
      pairCount += 1;
    }
  }
  const pairTerm = pairCount ? pairSum / pairCount : 0;

  return state.preferenceModel.bias + linearTerm + pairTerm;
}

function applyPreferenceFeedback(principles, delta) {
  ensurePreferenceModelShape();
  if (!principles.length || !delta) {
    return;
  }

  const lr = 0.18;
  const target = delta > 0 ? 1 : 0;
  const predicted = sigmoid(estimatePreferenceScore(principles));
  const error = clamp(target - predicted, -1, 1);

  state.preferenceModel.bias = clamp(state.preferenceModel.bias + error * lr * 0.28, -3, 3);
  state.preferenceModel.updates += 1;

  for (const principleId of principles) {
    const previous = getLinearPreference(principleId);
    state.preferenceModel.linear[principleId] = clamp(previous + error * lr, -4, 6);
  }

  for (let i = 0; i < principles.length; i += 1) {
    for (let j = i + 1; j < principles.length; j += 1) {
      const key = pairKey(principles[i], principles[j]);
      const previous = Number(state.preferenceModel.pair[key] || 0);
      state.preferenceModel.pair[key] = clamp(previous + error * lr * 0.62, -3.5, 4.5);
    }
  }

  // Maintain backward-compatible linear view used by older stored sessions.
  state.preference = { ...state.preferenceModel.linear };
}

function makeTone(h, s, l) {
  return {
    h: wrapHue(h),
    s: clamp(s, 0, 100),
    l: clamp(l, 0, 100),
  };
}

function cssTone(tone, alpha = 1) {
  return `hsla(${tone.h.toFixed(1)} ${tone.s.toFixed(1)}% ${tone.l.toFixed(1)}% / ${clamp(alpha, 0, 1)})`;
}

function toneShift(tone, hueShift = 0, satShift = 0, lightShift = 0) {
  return makeTone(tone.h + hueShift, tone.s + satShift, tone.l + lightShift);
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

class SeedRng {
  constructor(seed) {
    this.state = hashString(seed);
  }

  next() {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1) {
    return min + (max - min) * this.next();
  }

  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}

function makeSeed(extra = "") {
  state.seedCounter += 1;
  const now = Date.now().toString(36);
  let entropy = Math.random().toString(36).slice(2, 10);
  if (window.crypto?.getRandomValues) {
    const chunk = new Uint32Array(2);
    window.crypto.getRandomValues(chunk);
    entropy = `${chunk[0].toString(36)}${chunk[1].toString(36)}`;
  }
  return `${now}-${state.seedCounter.toString(36)}-${entropy}${extra}`;
}

function mutateSeed(seed, index) {
  return `${seed}-${index.toString(36)}-${Math.floor(Math.random() * 1e8).toString(36)}`;
}

function getCustomScheme(schemeId) {
  return customSchemeById[schemeId] || customColorSchemes[0];
}

function getEffectiveLayerScheme(layer, baseScheme) {
  const scheme =
    layer.overrideScheme && layer.schemeId ? getCustomScheme(layer.schemeId) : baseScheme;

  if (!layer.useCustomColors) {
    return scheme;
  }

  return {
    id: "custom",
    name: "Custom Colors",
    colors: Array.isArray(layer.customColors) && layer.customColors.length === 4
      ? layer.customColors.map((color, index) => (isHexColor(color) ? color : scheme.colors[index]))
      : [...scheme.colors],
    ink: isHexColor(layer.customInk) ? layer.customInk : scheme.ink,
  };
}

function createCustomPalette(backgroundColor, schemeId) {
  const scheme = getCustomScheme(schemeId);
  return {
    baseHue: hexToTone(scheme.colors[0]).h,
    bgA: hexToTone(backgroundColor),
    bgB: hexToTone(scheme.colors[1]),
    ink: hexToTone(scheme.ink),
    accents: scheme.colors.map((color) => hexToTone(color)),
  };
}

function getCustomSchemeOptionsMarkup(selectedId, includeGlobal = false) {
  const options = [];
  if (includeGlobal) {
    options.push(`<option value="" ${selectedId ? "" : "selected"}>Use Global Scheme</option>`);
  }
  for (const scheme of customColorSchemes) {
    options.push(
      `<option value="${scheme.id}" ${scheme.id === selectedId ? "selected" : ""}>${scheme.name}</option>`
    );
  }
  return options.join("");
}

function makeCustomLayer(typeId = customElementTypes[0].id) {
  const element = customElementById[typeId] || customElementTypes[0];
  const rng = new SeedRng(`custom-${element.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const currentScheme = getCustomScheme(getCurrentCustomComposition()?.schemeId || customColorSchemes[0].id);
  return {
    id: `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    typeId: element.id,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    speed: element.defaultSpeed,
    opacity: 0.86,
    overrideScheme: false,
    schemeId: "",
    useCustomColors: false,
    customColors: [...currentScheme.colors],
    customInk: currentScheme.ink,
    params: element.buildParams ? element.buildParams(rng, { complexity: 6, motion: 4 }) : {},
  };
}

function makeEmptyCustomComposition(name = "") {
  const scheme = customColorSchemes[0];
  state.customSeedCounter += 1;
  return {
    id: null,
    name: name || `Untitled ${state.customSeedCounter}`,
    backgroundColor: "#080c14",
    schemeId: scheme.id,
    layers: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function sanitizeCustomLayer(layer) {
  if (!layer || !customElementById[layer.typeId]) {
    return null;
  }

  const element = customElementById[layer.typeId];
  const x = Number(layer.x);
  const y = Number(layer.y);
  const scale = Number(layer.scale);
  const rotation = Number(layer.rotation);
  const speed = Number(layer.speed);
  const opacity = Number(layer.opacity);
  const fallbackScheme = getCustomScheme(layer.schemeId);
  const customColors = Array.isArray(layer.customColors)
    ? layer.customColors.slice(0, 4).map((color, index) => (isHexColor(color) ? color : fallbackScheme.colors[index] || customColorSchemes[0].colors[index]))
    : [...fallbackScheme.colors];

  return {
    id:
      typeof layer.id === "string" && layer.id
        ? layer.id
        : `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    typeId: layer.typeId,
    x: clamp(Number.isFinite(x) ? x : 0, -60, 60),
    y: clamp(Number.isFinite(y) ? y : 0, -60, 60),
    scale: clamp(Number.isFinite(scale) ? scale : 1, 0.2, 3),
    rotation: clamp(Number.isFinite(rotation) ? rotation : 0, -180, 180),
    speed: clamp(Number.isFinite(speed) ? speed : 0, -3, 3),
    opacity: clamp(Number.isFinite(opacity) ? opacity : 0.86, 0, 1),
    overrideScheme: Boolean(layer.overrideScheme),
    schemeId:
      typeof layer.schemeId === "string" && customSchemeById[layer.schemeId] ? layer.schemeId : "",
    useCustomColors: Boolean(layer.useCustomColors),
    customColors:
      customColors.length === 4
        ? customColors
        : [...customColors, ...customColorSchemes[0].colors].slice(0, 4),
    customInk: isHexColor(layer.customInk) ? layer.customInk : fallbackScheme.ink,
    params: layer.params && typeof layer.params === "object" ? cloneJson(layer.params) : element.buildParams?.(new SeedRng(`restore-${layer.id}`), { complexity: 6, motion: 4 }) || {},
  };
}

function sanitizeCustomComposition(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const layers = Array.isArray(item.layers) ? item.layers.map(sanitizeCustomLayer).filter(Boolean) : [];
  return {
    id: typeof item.id === "string" && item.id ? item.id : null,
    name:
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim().slice(0, 48)
        : `Untitled ${Math.max(1, state.customSeedCounter + 1)}`,
    backgroundColor:
      typeof item.backgroundColor === "string" && /^#[0-9a-f]{6}$/i.test(item.backgroundColor)
        ? item.backgroundColor
        : "#080c14",
    schemeId: customSchemeById[item.schemeId] ? item.schemeId : customColorSchemes[0].id,
    layers,
    createdAt: Number(item.createdAt) || Date.now(),
    updatedAt: Number(item.updatedAt) || Date.now(),
  };
}

function getCurrentCustomComposition() {
  return state.customDraft;
}

function setCustomStatus(message) {
  if (customStatusEl) {
    customStatusEl.textContent = message;
  }
}

function syncCustomControls() {
  const current =
    getCurrentCustomComposition() || {
      name: "",
      backgroundColor: "#080c14",
      schemeId: customColorSchemes[0].id,
      layers: [],
    };
  customNameInput.value = current.name;
  customBackgroundInput.value = current.backgroundColor;
  customSchemeSelect.innerHTML = getCustomSchemeOptionsMarkup(current.schemeId);
  customSchemeSelect.value = current.schemeId;
  layerSummaryEl.textContent = `${current.layers.length} layer${current.layers.length === 1 ? "" : "s"}`;
}

function createNewCustomDraft() {
  state.currentCustomId = null;
  state.customDraft = makeEmptyCustomComposition();
  syncCustomControls();
  renderSavedCustomList();
  renderLayerList();
  updateInterface();
  persistState();
  setCustomStatus("New blank composition ready.");
}

function loadCustomComposition(customId) {
  const found = state.customCompositions.find((item) => item.id === customId);
  if (!found) {
    return;
  }
  state.currentCustomId = found.id;
  state.customDraft = cloneJson(found);
  syncCustomControls();
  renderSavedCustomList();
  renderLayerList();
  updateInterface();
  persistState();
  setCustomStatus(`Editing ${found.name}.`);
}

function saveCurrentCustomComposition() {
  const current = getCurrentCustomComposition();
  if (!current) {
    return;
  }

  current.name = (customNameInput.value || current.name || "").trim().slice(0, 48) || "Untitled composition";
  current.updatedAt = Date.now();

  if (!state.currentCustomId) {
    current.id = `custom-${current.updatedAt.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    current.createdAt = current.updatedAt;
    state.currentCustomId = current.id;
    state.customCompositions.unshift(cloneJson(current));
  } else {
    const index = state.customCompositions.findIndex((item) => item.id === state.currentCustomId);
    if (index === -1) {
      state.customCompositions.unshift(cloneJson(current));
    } else {
      state.customCompositions[index] = cloneJson(current);
    }
  }

  state.customDraft = cloneJson(current);
  renderSavedCustomList();
  syncCustomControls();
  updateInterface();
  persistState();
  setCustomStatus(`Saved ${current.name}.`);
}

function updateCurrentCustom(mutator, options = {}) {
  const current = getCurrentCustomComposition();
  if (!current) {
    state.customDraft = makeEmptyCustomComposition();
  }

  mutator(state.customDraft);
  state.customDraft.updatedAt = Date.now();
  if (options.syncControls !== false) {
    syncCustomControls();
  }
  if (options.renderLayers !== false) {
    renderLayerList();
  }
  if (options.renderSaved !== false) {
    renderSavedCustomList();
  }
  updateInterface();
  persistState();
}

function serializeSharePayload(payload) {
  return encodeBase64Url(JSON.stringify(payload));
}

function parseSharePayload(token) {
  return JSON.parse(decodeBase64Url(token));
}

function buildShareUrl(payload) {
  const url = new URL(window.location.href);
  url.hash = `share=${serializeSharePayload(payload)}`;
  return url.toString();
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function getCurrentSharePayload() {
  if (state.appMode === APP_MODE_COMPOSER) {
    const current = getCurrentCustomComposition();
    if (!current) {
      return null;
    }
    const shared = cloneJson(current);
    shared.id = null;
    return {
      version: 1,
      mode: APP_MODE_COMPOSER,
      item: shared,
    };
  }

  const current = getCurrentIllusion();
  if (!current) {
    return null;
  }
  return {
    version: 1,
    mode: APP_MODE_GENERATOR,
    item: cloneJson(current),
  };
}

async function sharePayload(payload, sourceButton = null, message = "Share link copied.") {
  if (!payload) {
    return;
  }

  const originalLabel = sourceButton?.textContent || "";
  try {
    await copyTextToClipboard(buildShareUrl(payload));
    if (sourceButton) {
      sourceButton.textContent = "Link Copied";
      window.setTimeout(() => {
        sourceButton.textContent = originalLabel;
      }, 1400);
    }
    if (state.appMode === APP_MODE_COMPOSER) {
      setCustomStatus(message);
    }
  } catch (error) {
    console.warn("Share link copy failed:", error);
    if (sourceButton) {
      sourceButton.textContent = "Copy Failed";
      window.setTimeout(() => {
        sourceButton.textContent = originalLabel;
      }, 1400);
    }
    if (state.appMode === APP_MODE_COMPOSER) {
      setCustomStatus("Share link copy failed.");
    }
  }
}

function hydrateFromShareLink() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  const token = params.get("share");
  if (!token) {
    return;
  }

  try {
    const payload = parseSharePayload(token);
    if (payload?.mode === APP_MODE_COMPOSER) {
      const shared = sanitizeCustomComposition(payload.item);
      if (!shared) {
        return;
      }
      shared.id = null;
      state.currentCustomId = null;
      state.customDraft = shared;
      state.appMode = APP_MODE_COMPOSER;
      return;
    }

    if (payload?.mode === APP_MODE_GENERATOR) {
      const shared = sanitizeStoredDiscovery(payload.item);
      if (!shared) {
        return;
      }
      state.discoveries = [shared, ...state.discoveries.filter((item) => item.id !== shared.id)].slice(0, MAX_DISCOVERIES);
      state.archiveVectors = state.discoveries.map((item) => ({
        id: item.id,
        vector: item.feature,
      }));
      state.currentId = shared.id;
      state.appMode = APP_MODE_GENERATOR;
    }
  } catch (error) {
    console.warn("Share link load failed:", error);
  }
}

function makePalette(rng) {
  const baseHue = rng.float(0, 360);
  const warmShift = rng.float(70, 160) * rng.sign();
  const coolShift = rng.float(35, 105) * rng.sign();

  return {
    baseHue,
    bgA: makeTone(baseHue + rng.float(-15, 20), rng.float(38, 62), rng.float(8, 15)),
    bgB: makeTone(baseHue + rng.float(12, 54), rng.float(32, 58), rng.float(16, 30)),
    ink: makeTone(baseHue + rng.float(-18, 18), rng.float(12, 28), rng.float(86, 96)),
    accents: [
      makeTone(baseHue + warmShift, rng.float(58, 90), rng.float(42, 64)),
      makeTone(baseHue - warmShift * 0.36, rng.float(54, 92), rng.float(40, 64)),
      makeTone(baseHue + coolShift, rng.float(48, 88), rng.float(34, 60)),
      makeTone(baseHue - coolShift * 0.5, rng.float(45, 84), rng.float(45, 72)),
    ],
  };
}

function computeContrastMetric(palette) {
  const accentLight = palette.accents.reduce((acc, tone) => acc + tone.l, 0) / palette.accents.length;
  return clamp((accentLight - palette.bgA.l + 40) / 100, 0, 1);
}

function choosePrinciple(rng, alreadyPicked = [], allowedIds = null) {
  ensurePreferenceModelShape();
  const ids =
    Array.isArray(allowedIds) && allowedIds.length ? allowedIds : getEnabledPrinciples();
  const weights = ids.map((id) => {
    const profile = researchById[id];
    const base = 1;
    const linearPref = getLinearPreference(id);
    let pairPref = 0;
    if (alreadyPicked.length) {
      const sum = alreadyPicked.reduce((acc, pickedId) => acc + getPairPreference(id, pickedId), 0);
      pairPref = sum / alreadyPicked.length;
    }
    const repeatPenalty = alreadyPicked.includes(id) ? 0.72 : 1;
    const motionBoost = profile?.fullScreenMotion
      ? 1 + state.options.motion * 0.08 + state.options.complexity * 0.04
      : 1;
    return clamp((base + linearPref * 0.22 + pairPref * 0.2) * repeatPenalty * motionBoost, 0.2, 4.8);
  });
  return weightedChoice(ids, weights, rng);
}

function chooseExistingPrinciple(rng, alreadyPicked = []) {
  const ids = Array.from(new Set(alreadyPicked));
  if (!ids.length) {
    return null;
  }

  const weights = ids.map((id) => {
    const repeatedCount = alreadyPicked.filter((pickedId) => pickedId === id).length;
    const linearPref = getLinearPreference(id);
    return clamp(1 + repeatedCount * 0.55 + linearPref * 0.2, 0.3, 4.2);
  });
  return weightedChoice(ids, weights, rng);
}

function sampleLayer(principleId, rng, options) {
  const profile = researchById[principleId];
  const params = profile.sample(rng, options);
  const alphaRange = Array.isArray(profile.alphaRange) ? profile.alphaRange : [0.34, 0.92];
  const allowedBlends =
    Array.isArray(profile.preferredBlends) && profile.preferredBlends.length
      ? profile.preferredBlends
      : blendModes;

  return {
    principleId,
    params,
    alpha: clamp(rng.float(alphaRange[0], alphaRange[1]), 0.25, 1),
    blend: pick(allowedBlends, rng),
    rotation: rng.float(-0.3, 0.3),
    scale: rng.float(0.8, 1.16),
    offsetX: rng.float(-0.12, 0.12),
    offsetY: rng.float(-0.12, 0.12),
  };
}

function needsFixationAid(principles) {
  return principles.some((principleId) => researchById[principleId]?.fixationTarget);
}

function makeFixationAid(rng = null) {
  return {
    x: 0.5,
    y: 0.5,
    radiusScale: rng ? rng.float(0.0035, 0.0059) : 0.0047,
    ringScale: rng ? rng.float(0.0014, 0.0028) : 0.0022,
  };
}

function buildFeatureVector(illusion) {
  const dims = [];
  const layerTotal = illusion.layers.length || 1;
  for (const profile of researchPrinciples) {
    const count = illusion.layers.filter((layer) => layer.principleId === profile.id).length;
    dims.push(count / layerTotal);
  }

  const avgAlpha = illusion.layers.reduce((sum, layer) => sum + layer.alpha, 0) / layerTotal;
  const avgScale = illusion.layers.reduce((sum, layer) => sum + layer.scale, 0) / layerTotal;
  const avgRotation =
    illusion.layers.reduce((sum, layer) => sum + Math.abs(layer.rotation), 0) / layerTotal;

  dims.push(clamp(layerTotal / 10, 0, 1));
  dims.push(avgAlpha);
  dims.push(avgScale / 1.5);
  dims.push(avgRotation / 0.3);
  dims.push(clamp(illusion.motionStrength, 0, 1));
  dims.push(illusion.palette.baseHue / 360);
  dims.push(computeContrastMetric(illusion.palette));

  return dims;
}

function vectorDistance(a, b) {
  let sum = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const delta = a[i] - b[i];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

function computeNoveltyStats(feature, k = NOVELTY_K) {
  if (!state.archiveVectors.length) {
    return {
      novelty: 1,
      nearest: 1,
      avgK: 1,
    };
  }

  const distances = [];
  const limit = Math.min(180, state.archiveVectors.length);
  for (let i = 0; i < limit; i += 1) {
    const candidate = state.archiveVectors[i];
    const distance = vectorDistance(feature, candidate.vector);
    distances.push(distance);
  }

  distances.sort((a, b) => a - b);
  const featureNorm = Math.sqrt(feature.length) || 1;
  const nearest = distances[0] / featureNorm;
  const kUsed = Math.max(1, Math.min(k, distances.length));
  const avgK =
    distances.slice(0, kUsed).reduce((sum, value) => sum + value, 0) / (kUsed * featureNorm);

  // Blend nearest-distance and local-neighborhood distance for a more stable novelty estimate.
  const novelty = clamp(avgK * 1.55 + nearest * 0.45, 0, 1);
  return {
    novelty,
    nearest,
    avgK,
  };
}

function rangePenalty(value, min, max, weight = 1) {
  if (value < min) {
    return ((min - value) / Math.max(0.01, min)) * weight;
  }
  if (value > max) {
    return ((value - max) / Math.max(0.01, 1 - max)) * weight;
  }
  return 0;
}

function upperPenalty(value, max, span = 1, weight = 1) {
  if (value <= max) {
    return 0;
  }
  return ((value - max) / Math.max(0.01, span)) * weight;
}

function analyzeRenderedQuality(illusion) {
  renderIllusion(illusion, qualityProbeCanvas, 0, true);

  const probeCtx = qualityProbeCanvas.getContext("2d", { willReadFrequently: true });
  const width = qualityProbeCanvas.width;
  const height = qualityProbeCanvas.height;
  const pixels = probeCtx.getImageData(0, 0, width, height).data;
  const total = width * height;
  const lumas = new Float32Array(total);

  let minL = 255;
  let maxL = 0;
  let satSum = 0;
  let avgL = 0;

  for (let i = 0; i < total; i += 1) {
    const ptr = i * 4;
    const r = pixels[ptr];
    const g = pixels[ptr + 1];
    const b = pixels[ptr + 2];
    const maxRgb = Math.max(r, g, b);
    const minRgb = Math.min(r, g, b);
    const sat = maxRgb ? (maxRgb - minRgb) / maxRgb : 0;

    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
    lumas[i] = lum;
    minL = Math.min(minL, lum);
    maxL = Math.max(maxL, lum);
    avgL += lum;
    satSum += sat;
  }

  avgL /= total;
  const edgeThreshold = 34;
  let edgeCount = 0;
  let centerEdgeCount = 0;
  let centerPixels = 0;

  const xMin = Math.floor(width * 0.34);
  const xMax = Math.floor(width * 0.66);
  const yMin = Math.floor(height * 0.34);
  const yMax = Math.floor(height * 0.66);

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx = lumas[index] - lumas[index + 1];
      const gy = lumas[index] - lumas[index + width];
      const grad = Math.abs(gx) + Math.abs(gy);

      if (grad > edgeThreshold) {
        edgeCount += 1;
      }

      if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
        centerPixels += 1;
        if (grad > edgeThreshold) {
          centerEdgeCount += 1;
        }
      }
    }
  }

  const edgeDenominator = (width - 1) * (height - 1);
  return {
    contrast: (maxL - minL) / 255,
    brightness: avgL / 255,
    saturation: satSum / total,
    edgeDensity: edgeCount / Math.max(1, edgeDenominator),
    centerEdgeDensity: centerEdgeCount / Math.max(1, centerPixels),
  };
}

function evaluateCandidateQuality(illusion) {
  const metrics = analyzeRenderedQuality(illusion);
  const layerTotal = Math.max(1, illusion.layers.length);
  const alphaLoad = illusion.layers.reduce((sum, layer) => sum + layer.alpha, 0) / layerTotal;
  const centerConcentration =
    illusion.layers.filter((layer) => Math.hypot(layer.offsetX, layer.offsetY) < 0.05).length / layerTotal;
  const centerAlphaLoad =
    illusion.layers
      .filter((layer) => Math.hypot(layer.offsetX, layer.offsetY) < 0.05)
      .reduce((sum, layer) => sum + layer.alpha, 0) / layerTotal;
  const uniquePrinciples = new Set(illusion.layers.map((layer) => layer.principleId)).size;
  const uniqueDensity = uniquePrinciples / layerTotal;
  const nonSourceBlendRatio =
    illusion.layers.filter((layer) => layer.blend && layer.blend !== "source-over").length / layerTotal;

  const hardFail =
    metrics.contrast < 0.16 ||
    metrics.contrast > 0.97 ||
    metrics.edgeDensity < 0.012 ||
    metrics.edgeDensity > 0.38 ||
    metrics.centerEdgeDensity > 0.46 ||
    metrics.saturation < 0.05 ||
    alphaLoad > 0.93 ||
    layerTotal > 8 ||
    uniquePrinciples > 5 ||
    (centerConcentration > 0.76 && alphaLoad > 0.82);

  let penalty = 0;
  penalty += rangePenalty(metrics.contrast, 0.24, 0.86, 0.95);
  penalty += rangePenalty(metrics.edgeDensity, 0.04, 0.28, 0.85);
  penalty += rangePenalty(metrics.centerEdgeDensity, 0.02, 0.35, 0.75);
  penalty += rangePenalty(metrics.saturation, 0.1, 0.8, 0.45);
  penalty += rangePenalty(alphaLoad, 0.38, 0.82, 0.52);
  penalty += rangePenalty(centerConcentration, 0.2, 0.78, 0.32);
  penalty += upperPenalty(layerTotal, 6.4, 2.2, 0.44);
  penalty += upperPenalty(uniquePrinciples, 4, 1.6, 0.52);
  penalty += upperPenalty(uniqueDensity, 0.8, 0.18, 0.58);
  penalty += upperPenalty(nonSourceBlendRatio, 0.74, 0.24, 0.28);
  penalty += upperPenalty(centerAlphaLoad, 0.48, 0.24, 0.46);

  const qualityScore = clamp(1 - penalty, 0, 1);
  return {
    pass: !hardFail && qualityScore >= 0.42,
    qualityScore,
    metrics: {
      ...metrics,
      alphaLoad,
      centerConcentration,
      centerAlphaLoad,
      uniquePrinciples,
      uniqueDensity,
      nonSourceBlendRatio,
    },
  };
}

function computeCompositeScore(illusion) {
  const ratingScore = illusion.rating * 0.75;
  const noveltyScore = illusion.novelty * 2.6;
  const predictedScore = illusion.predictedAppeal * 1.4;
  const qualityScore = (illusion.qualityScore ?? 0.55) * 1.05;
  const saveBonus = illusion.favorite ? 1.4 : 0;
  return ratingScore + noveltyScore + predictedScore + qualityScore + saveBonus;
}

function buildIllusion(seed, parentId = null) {
  const rng = new SeedRng(seed);
  const palette = makePalette(rng);
  const enabledPrinciples = getEnabledPrinciples();
  const minLayers = state.options.complexity >= 7 ? 3 : 2;
  const maxLayers = clamp(2 + Math.round(state.options.complexity * 0.56), 3, 8);
  const layerCount = rng.int(minLayers, Math.max(minLayers, maxLayers));
  const minUniqueTarget = Math.min(enabledPrinciples.length, Math.min(layerCount, state.options.complexity >= 6 ? 3 : 2));
  const maxUniqueTarget = Math.min(enabledPrinciples.length, layerCount, clamp(2 + Math.floor(state.options.complexity / 3), 2, 5));
  const targetUniqueCount = rng.int(Math.max(1, minUniqueTarget), Math.max(1, maxUniqueTarget));

  const picked = [];
  const layers = [];
  for (let i = 0; i < layerCount; i += 1) {
    const uniquePicked = Array.from(new Set(picked));
    const unseenPrinciples = enabledPrinciples.filter((principleId) => !uniquePicked.includes(principleId));
    const shouldIntroduceNew =
      unseenPrinciples.length > 0 &&
      uniquePicked.length < targetUniqueCount &&
      (uniquePicked.length < 2 || i < 2 || rng.next() < 0.48);

    let principleId = null;
    if (shouldIntroduceNew) {
      principleId = choosePrinciple(rng, picked, unseenPrinciples);
    } else {
      principleId = chooseExistingPrinciple(rng, picked) || choosePrinciple(rng, picked, enabledPrinciples);
    }

    picked.push(principleId);
    layers.push(sampleLayer(principleId, rng, state.options));
  }

  const principles = Array.from(new Set(picked));
  const fixationAid = needsFixationAid(principles) ? makeFixationAid(rng) : null;

  const illusion = {
    id: `${seed.slice(0, 10)}-${Math.floor(rng.float(1000, 9999))}`,
    seed,
    createdAt: Date.now(),
    parentId,
    palette,
    layers,
    principles,
    fixationAid,
    motionStrength: state.options.motion / 10,
    qualityScore: 0.55,
    rating: 0,
    favorite: false,
    votes: 0,
  };

  illusion.feature = buildFeatureVector(illusion);
  const noveltyStats = computeNoveltyStats(illusion.feature);
  illusion.novelty = noveltyStats.novelty;
  illusion.noveltyNearest = noveltyStats.nearest;
  illusion.noveltyKnn = noveltyStats.avgK;

  const preferenceLogit = estimatePreferenceScore(principles);
  const preferenceSignal = sigmoid(preferenceLogit);
  illusion.preferenceSignal = preferenceSignal;

  const complexitySignal = clamp(layerCount / 8 + state.options.complexity / 15, 0, 1);
  const contrastSignal = computeContrastMetric(palette);
  const focusSignal = clamp(1 - Math.max(0, principles.length - 2) * 0.18 - Math.max(0, layerCount - 4) * 0.1, 0, 1);
  illusion.predictedAppeal = clamp(
    0.22 +
      preferenceSignal * 0.38 +
      complexitySignal * 0.18 +
      contrastSignal * 0.17 +
      focusSignal * 0.29 +
      rng.float(-0.06, 0.06),
    0,
    1
  );

  illusion.quickObjective =
    state.options.noveltyBias * illusion.novelty +
    (1 - state.options.noveltyBias) * illusion.predictedAppeal;
  illusion.objective =
    state.options.noveltyBias * illusion.novelty +
    (1 - state.options.noveltyBias) * illusion.predictedAppeal;

  illusion.compositeScore = computeCompositeScore(illusion);

  return illusion;
}

function dominatesCandidate(a, b) {
  const betterOrEqual =
    a.novelty >= b.novelty &&
    a.predictedAppeal >= b.predictedAppeal &&
    a.qualityScore >= b.qualityScore;
  const strictlyBetter =
    a.novelty > b.novelty ||
    a.predictedAppeal > b.predictedAppeal ||
    a.qualityScore > b.qualityScore;
  return betterOrEqual && strictlyBetter;
}

function assignCrowdingDistance(front) {
  if (!front.length) {
    return;
  }

  for (const candidate of front) {
    candidate.crowding = 0;
  }

  if (front.length <= 2) {
    for (const candidate of front) {
      candidate.crowding = 2;
    }
    return;
  }

  const dimensions = ["novelty", "predictedAppeal", "qualityScore"];
  for (const dimension of dimensions) {
    const sorted = [...front].sort((a, b) => a[dimension] - b[dimension]);
    sorted[0].crowding += 1;
    sorted[sorted.length - 1].crowding += 1;

    const min = sorted[0][dimension];
    const max = sorted[sorted.length - 1][dimension];
    const span = Math.max(0.0001, max - min);

    for (let i = 1; i < sorted.length - 1; i += 1) {
      const prev = sorted[i - 1][dimension];
      const next = sorted[i + 1][dimension];
      sorted[i].crowding += (next - prev) / span;
    }
  }
}

function buildParetoFronts(candidates) {
  const remaining = [...candidates];
  const fronts = [];

  while (remaining.length) {
    const front = [];
    for (const candidate of remaining) {
      const dominated = remaining.some(
        (other) => other !== candidate && dominatesCandidate(other, candidate)
      );
      if (!dominated) {
        front.push(candidate);
      }
    }

    if (!front.length) {
      break;
    }

    fronts.push(front);
    const frontIds = new Set(front.map((candidate) => candidate.id));
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (frontIds.has(remaining[i].id)) {
        remaining.splice(i, 1);
      }
    }
  }

  return fronts;
}

function proposeBestCandidate(mode = "fresh") {
  const parent = mode === "evolve" ? getCurrentIllusion() : null;
  const candidateCount =
    18 + Math.round(state.options.noveltyBias * 18) + Math.round(state.options.complexity * 1.1);
  const candidates = [];

  for (let i = 0; i < candidateCount; i += 1) {
    const seed = parent ? mutateSeed(parent.seed, i) : makeSeed(`-${i.toString(36)}`);
    const candidate = buildIllusion(seed, parent?.id || null);
    candidates.push(candidate);
  }

  candidates.sort((a, b) => b.quickObjective - a.quickObjective);

  const qualityChecked = [];
  const probeBudget = Math.min(
    candidates.length,
    QUALITY_PROBE_BUDGET + Math.round(state.options.complexity * 0.9)
  );
  let pointer = 0;
  while (
    pointer < candidates.length &&
    (qualityChecked.length < MIN_QUALITY_PASSES || pointer < probeBudget)
  ) {
    const candidate = candidates[pointer];
    pointer += 1;

    const quality = evaluateCandidateQuality(candidate);
    candidate.qualityScore = quality.qualityScore;
    candidate.qualityMetrics = quality.metrics;
    if (quality.pass) {
      qualityChecked.push(candidate);
    }
  }

  if (!qualityChecked.length) {
    const fallback = candidates[0];
    const quality = evaluateCandidateQuality(fallback);
    fallback.qualityScore = quality.qualityScore;
    fallback.qualityMetrics = quality.metrics;
    fallback.objective = fallback.quickObjective + fallback.qualityScore * 0.35;
    fallback.compositeScore = computeCompositeScore(fallback);
    return fallback;
  }

  const fronts = buildParetoFronts(qualityChecked);
  const maxRank = Math.max(0, fronts.length - 1);
  const noveltyWeight = 0.36 + state.options.noveltyBias * 0.45;
  const appealWeight = 0.6 - state.options.noveltyBias * 0.32;

  for (let rank = 0; rank < fronts.length; rank += 1) {
    const front = fronts[rank];
    assignCrowdingDistance(front);
    for (const candidate of front) {
      candidate.paretoRank = rank;
      const rankBonus = 1 - rank / Math.max(1, maxRank + 1);
      const crowdingBonus = clamp((candidate.crowding || 0) / 3, 0, 1);
      candidate.objective =
        rankBonus * 1.42 +
        candidate.novelty * noveltyWeight +
        candidate.predictedAppeal * appealWeight +
        candidate.qualityScore * 0.48 +
        crowdingBonus * 0.22;
      candidate.compositeScore = computeCompositeScore(candidate);
    }
  }

  const ranked = [...qualityChecked].sort((a, b) => b.objective - a.objective);
  const topPool = ranked.slice(0, Math.min(5, ranked.length));
  const pickRng = new SeedRng(`${topPool[0].seed}-pareto-pick`);
  const weights = topPool.map((candidate) => Math.max(0.04, candidate.objective ** 2));
  return weightedChoice(topPool, weights, pickRng);
}

function registerDiscovery(illusion) {
  state.discoveries.unshift(illusion);
  state.archiveVectors.unshift({ id: illusion.id, vector: illusion.feature });

  if (state.discoveries.length > MAX_DISCOVERIES) {
    state.discoveries = state.discoveries.slice(0, MAX_DISCOVERIES);
    const validIds = new Set(state.discoveries.map((item) => item.id));
    state.archiveVectors = state.archiveVectors.filter((item) => validIds.has(item.id));
  }
}

function shortSeed(seed) {
  if (!seed) {
    return "-";
  }
  if (seed.length <= 14) {
    return seed;
  }
  return `${seed.slice(0, 8)}...${seed.slice(-4)}`;
}

function getCurrentIllusion() {
  return state.discoveries.find((item) => item.id === state.currentId) || null;
}

function getCurrentIndex() {
  return state.discoveries.findIndex((item) => item.id === state.currentId);
}

function setCurrentByIndex(index) {
  if (index < 0 || index >= state.discoveries.length) {
    return false;
  }
  state.currentId = state.discoveries[index].id;
  updateInterface();
  persistState();
  return true;
}

function navigateOlder() {
  if (state.appMode === APP_MODE_COMPOSER) {
    return;
  }
  const index = getCurrentIndex();
  if (index === -1) {
    return;
  }
  if (index < state.discoveries.length - 1) {
    setCurrentByIndex(index + 1);
  }
}

function navigateNextOrNew() {
  if (state.appMode === APP_MODE_COMPOSER) {
    return;
  }
  const index = getCurrentIndex();
  if (index === -1) {
    spawnOne("fresh");
    return;
  }
  if (index > 0) {
    setCurrentByIndex(index - 1);
    return;
  }
  spawnOne("fresh");
}

function renderResearchList() {
  researchListEl.innerHTML = "";
  const enabledPrinciples = new Set(getEnabledPrinciples());
  const singleEnabled = enabledPrinciples.size === 1;

  if (researchMixMetaEl) {
    researchMixMetaEl.textContent =
      enabledPrinciples.size === 1
        ? "1 type enabled. At least one type stays on so generation keeps working."
        : `${enabledPrinciples.size} types enabled. Narrower mixes usually produce cleaner results.`;
  }

  for (const profile of researchPrinciples) {
    const li = document.createElement("li");
    const enabled = enabledPrinciples.has(profile.id);
    li.className = enabled ? "enabled" : "disabled";
    li.innerHTML = `
      <label class="research-toggle">
        <input
          type="checkbox"
          data-principle-id="${profile.id}"
          ${enabled ? "checked" : ""}
          ${enabled && singleEnabled ? "disabled" : ""}
        />
        <span class="research-copy">
          <strong>${profile.name}</strong>
          <span>${profile.mechanism}</span>
        </span>
      </label>
    `;
    researchListEl.append(li);
  }
}

function renderElementPicker() {
  elementPickerEl.innerHTML = "";

  for (const element of customElementTypes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "element-card";
    button.dataset.addElement = element.id;
    button.innerHTML = `
      <canvas width="180" height="120" aria-hidden="true"></canvas>
      <strong>${element.name}</strong>
      <span>${element.description}</span>
    `;
    elementPickerEl.append(button);

    const thumbCanvas = button.querySelector("canvas");
    if (thumbCanvas) {
      renderCustomElementThumbnail(element.id, thumbCanvas);
    }
  }
}

function renderSavedCustomList() {
  const activeId = state.currentCustomId;
  savedCustomListEl.innerHTML = "";

  if (!state.customCompositions.length) {
    savedCustomListEl.innerHTML = `<p class="empty-state">No saved custom compositions yet. Build one, then save it here for later edits.</p>`;
    return;
  }

  for (const item of state.customCompositions) {
    const wrapper = document.createElement("div");
    wrapper.className = `saved-custom-item${item.id === activeId ? " active" : ""}`;
    const dateLabel = new Date(item.updatedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    wrapper.innerHTML = `
      <div class="saved-custom-actions">
        <button type="button" data-load-custom="${item.id}">
          <strong>${item.name}</strong>
          <span>${item.layers.length} layer${item.layers.length === 1 ? "" : "s"} in ${getCustomScheme(item.schemeId).name}</span>
        </button>
        <button type="button" data-share-custom="${item.id}">Share</button>
      </div>
      <div class="saved-custom-meta">
        <span>${dateLabel}</span>
        <span>${item.id === activeId ? "Editing" : "Saved"}</span>
      </div>
    `;
    savedCustomListEl.append(wrapper);
  }
}

function formatLayerValue(property, value) {
  switch (property) {
    case "x":
    case "y":
      return `${Math.round(value)}%`;
    case "scale":
      return `${Math.round(value * 100)}%`;
    case "rotation":
      return `${Math.round(value)}deg`;
    case "speed":
      return value.toFixed(1);
    case "opacity":
      return `${Math.round(value * 100)}%`;
    default:
      return String(value);
  }
}

function renderLayerList() {
  const current = getCurrentCustomComposition();
  layerListEl.innerHTML = "";
  const layers = current?.layers || [];
  layerSummaryEl.textContent = `${layers.length} layer${layers.length === 1 ? "" : "s"}`;

  if (!layers.length) {
    layerListEl.innerHTML = `<p class="empty-state">Add a layer from the selector above. Each new element is placed on top of the existing stack.</p>`;
    return;
  }

  const displayLayers = [...layers].reverse();
  displayLayers.forEach((layer, displayIndex) => {
    const actualIndex = layers.length - 1 - displayIndex;
    const isTopLayer = actualIndex === layers.length - 1;
    const element = customElementById[layer.typeId];
    const article = document.createElement("article");
    article.className = `layer-card${isTopLayer ? " top-layer" : ""}`;
    article.dataset.layerId = layer.id;
    article.innerHTML = `
      <div class="layer-card-head">
        <div class="layer-card-meta">
          <strong>${element.name}</strong>
          <span>${isTopLayer ? "Top Layer" : `Layer ${actualIndex + 1}`}</span>
        </div>
        <button type="button" class="layer-remove-btn" data-remove-layer="${layer.id}">Remove</button>
      </div>
      <div class="field-grid layer-controls">
        ${renderLayerRangeField(layer, "x", "Position X", -50, 50, 1)}
        ${renderLayerRangeField(layer, "y", "Position Y", -50, 50, 1)}
        ${renderLayerRangeField(layer, "scale", "Scale", 0.2, 3, 0.05)}
        ${renderLayerRangeField(layer, "rotation", "Rotation", -180, 180, 1)}
        ${renderLayerRangeField(layer, "speed", "Speed", -3, 3, 0.1)}
        ${renderLayerRangeField(layer, "opacity", "Opacity", 0, 1, 0.01)}
        <label class="field-stack">
          <span>Override Scheme</span>
          <span class="toggle-row">
            <input type="checkbox" data-layer-id="${layer.id}" data-layer-property="overrideScheme" ${layer.overrideScheme ? "checked" : ""} />
            Use a different palette for this layer
          </span>
        </label>
        <label class="field-stack">
          <span>Layer Scheme</span>
          <select class="select-input" data-layer-id="${layer.id}" data-layer-property="schemeId" ${layer.overrideScheme && !layer.useCustomColors ? "" : "disabled"}>
            ${getCustomSchemeOptionsMarkup(layer.schemeId, true)}
          </select>
        </label>
        <label class="field-stack">
          <span>Specific Colors</span>
          <span class="toggle-row">
            <input type="checkbox" data-layer-id="${layer.id}" data-layer-property="useCustomColors" ${layer.useCustomColors ? "checked" : ""} />
            Pick exact colors for this layer
          </span>
        </label>
      </div>
      ${layer.useCustomColors ? renderLayerColorFields(layer) : ""}
    `;
    layerListEl.append(article);
  });
}

function renderLayerRangeField(layer, property, label, min, max, step) {
  return `
    <label class="field-stack range-field">
      <span class="field-label-row">
        <span>${label}</span>
        <output>${formatLayerValue(property, layer[property])}</output>
      </span>
      <input
        type="range"
        min="${min}"
        max="${max}"
        step="${step}"
        value="${layer[property]}"
        data-layer-id="${layer.id}"
        data-layer-property="${property}"
      />
    </label>
  `;
}

function renderLayerColorFields(layer) {
  const labels = ["Accent 1", "Accent 2", "Accent 3", "Accent 4"];
  const fields = layer.customColors
    .map(
      (color, index) => `
        <label class="field-stack color-field">
          <span>${labels[index]}</span>
          <input
            class="color-input"
            type="color"
            value="${color}"
            data-layer-id="${layer.id}"
            data-layer-property="customColor"
            data-layer-color-index="${index}"
          />
        </label>
      `
    )
    .join("");

  return `
    <div class="field-grid layer-color-grid">
      ${fields}
      <label class="field-stack color-field">
        <span>Ink</span>
        <input
          class="color-input"
          type="color"
          value="${layer.customInk}"
          data-layer-id="${layer.id}"
          data-layer-property="customInk"
        />
      </label>
    </div>
  `;
}

function applyMenuWidth() {
  const narrowViewport = window.innerWidth <= 860;
  const inComposer = state.appMode === APP_MODE_COMPOSER;

  if (inComposer && !narrowViewport) {
    sideMenuEl.style.width = `${clampComposerMenuWidth(state.composerMenuWidth)}px`;
    composerResizeHandleEl.hidden = false;
  } else {
    sideMenuEl.style.width = "";
    composerResizeHandleEl.hidden = true;
  }
}

function setAppMode(mode) {
  state.appMode = mode === APP_MODE_COMPOSER ? APP_MODE_COMPOSER : APP_MODE_GENERATOR;
  const inComposer = state.appMode === APP_MODE_COMPOSER;

  generatorModeBtn.classList.toggle("active", !inComposer);
  generatorModeBtn.setAttribute("aria-pressed", String(!inComposer));
  composerModeBtn.classList.toggle("active", inComposer);
  composerModeBtn.setAttribute("aria-pressed", String(inComposer));

  for (const panel of modePanelEls) {
    const visible = panel.dataset.modePanel === state.appMode;
    panel.hidden = !visible;
    panel.classList.toggle("hidden-panel", !visible);
  }

  applyMenuWidth();

  if (inComposer) {
    resizeComposerPreviewCanvas();
  }

  if (state.menuOpen) {
    if (inComposer) {
      menuBackdrop.classList.remove("open");
      menuBackdrop.hidden = true;
    } else {
      menuBackdrop.hidden = false;
      requestAnimationFrame(() => {
        if (state.menuOpen && state.appMode === APP_MODE_GENERATOR) {
          menuBackdrop.classList.add("open");
        }
      });
    }
  }

  updateInterface();
  persistState();
}

function handleLayerEditorInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return;
  }

  const layerId = target.dataset.layerId;
  const property = target.dataset.layerProperty;
  if (!layerId || !property) {
    return;
  }

  const shouldRerender =
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement && target.type === "checkbox") ||
    event.type === "change";

  updateCurrentCustom((current) => {
    const layer = current.layers.find((item) => item.id === layerId);
    if (!layer) {
      return;
    }

    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      layer[property] = target.checked;
      if (!target.checked && property === "overrideScheme") {
        layer.schemeId = "";
      }
      if (property === "useCustomColors" && target.checked) {
        const currentScheme = getEffectiveLayerScheme(
          { ...layer, useCustomColors: false },
          getCustomScheme(getCurrentCustomComposition()?.schemeId || customColorSchemes[0].id)
        );
        layer.customColors = [...currentScheme.colors];
        layer.customInk = currentScheme.ink;
      }
      return;
    }

    if (property === "schemeId") {
      layer.schemeId = target.value;
      return;
    }

    if (property === "customColor") {
      const colorIndex = Number(target.dataset.layerColorIndex);
      if (Number.isInteger(colorIndex) && colorIndex >= 0 && colorIndex < layer.customColors.length) {
        layer.customColors[colorIndex] = target.value;
      }
      return;
    }

    if (property === "customInk") {
      layer.customInk = target.value;
      return;
    }

    const numeric = Number(target.value);
    layer[property] = Number.isFinite(numeric) ? numeric : layer[property];
  }, {
    syncControls: false,
    renderLayers: shouldRerender,
    renderSaved: false,
  });

  if (!shouldRerender && target instanceof HTMLInputElement) {
    const output = target.closest(".field-stack")?.querySelector("output");
    const current = getCurrentCustomComposition();
    const layer = current?.layers.find((item) => item.id === layerId);
    if (output && layer) {
      output.textContent = formatLayerValue(property, layer[property]);
    }
  }

  setCustomStatus("Layer updated.");
}

function setPrincipleEnabled(principleId, enabled) {
  const current = new Set(getEnabledPrinciples());
  if (!researchById[principleId]) {
    return;
  }

  if (enabled) {
    current.add(principleId);
  } else {
    if (current.size === 1 && current.has(principleId)) {
      return;
    }
    current.delete(principleId);
  }

  state.options.enabledPrinciples = normalizeEnabledPrinciples(Array.from(current));
  renderResearchList();
  persistState();
}

function sanitizeStoredDiscovery(item) {
  const layers = sanitizeLayers(item.layers);
  if (!item.id || !item.seed || !layers.length) {
    return null;
  }

  const principles = Array.from(new Set(layers.map((layer) => layer.principleId)));
  const normalized = {
    ...item,
    layers,
    principles,
    rating: Number(item.rating) || 0,
    liked: false,
    favorite: Boolean(item.favorite || item.liked),
    novelty: clamp(Number(item.novelty) || 0, 0, 1),
    noveltyNearest: clamp(Number(item.noveltyNearest) || 0, 0, 1),
    noveltyKnn: clamp(Number(item.noveltyKnn) || 0, 0, 1),
    preferenceSignal: clamp(Number(item.preferenceSignal) || 0, 0, 1),
    predictedAppeal: clamp(Number(item.predictedAppeal) || 0, 0, 1),
    motionStrength: clamp(Number(item.motionStrength) || 0, 0, 1),
    qualityScore: clamp(Number(item.qualityScore) || 0.55, 0, 1),
    qualityMetrics:
      item.qualityMetrics && typeof item.qualityMetrics === "object" ? item.qualityMetrics : null,
    quickObjective: Number(item.quickObjective) || 0,
    objective: Number(item.objective) || 0,
    fixationAid:
      item.fixationAid && typeof item.fixationAid === "object"
        ? item.fixationAid
        : needsFixationAid(principles)
          ? makeFixationAid()
          : null,
  };

  normalized.feature = buildFeatureVector(normalized);
  normalized.compositeScore = Number(item.compositeScore) || computeCompositeScore(normalized);
  return normalized;
}

function updateSessionStats() {
  if (state.appMode === APP_MODE_COMPOSER) {
    discoveryCountLabelEl.textContent = "Custom";
    savedCountLabelEl.textContent = "Layers";
    autoplayStateLabelEl.textContent = "Mode";
    discoveryCountEl.textContent = String(state.customCompositions.length);
    savedCountEl.textContent = String((state.customDraft?.layers || []).length);
    autoplayStateEl.textContent = "Live";
  } else {
    discoveryCountLabelEl.textContent = "Designs";
    savedCountLabelEl.textContent = "Saved";
    autoplayStateLabelEl.textContent = "Autoplay";
    discoveryCountEl.textContent = String(state.discoveries.length);
    savedCountEl.textContent = String(state.discoveries.filter((item) => item.favorite).length);
    autoplayStateEl.textContent = state.autoplay ? "On" : "Off";
  }
  autoplayBtn.textContent = state.autoplay ? "Stop Autoplay" : "Start Autoplay";
}

function updateActionButtons(current) {
  if (state.appMode === APP_MODE_COMPOSER) {
    saveBtn.classList.remove("active");
    saveBtn.disabled = true;
    saveBtn.title = "Use Save Composition in Composer mode";
    return;
  }

  const isSaved = Boolean(current?.favorite);
  saveBtn.disabled = false;
  saveBtn.title = "Save design";
  saveBtn.classList.toggle("active", isSaved);
  saveBtn.innerHTML = "&#9829;";
}

function updateMetaBar() {
  if (state.appMode === APP_MODE_COMPOSER) {
    const current = getCurrentCustomComposition();
    currentPositionEl.textContent = "Composer";
    currentSeedEl.textContent = current ? current.name : "Untitled composition";
    currentNoveltyEl.textContent = current ? `${current.layers.length} layer${current.layers.length === 1 ? "" : "s"}` : "0 layers";
    updateActionButtons(null);
    return;
  }

  const current = getCurrentIllusion();
  const index = getCurrentIndex();

  if (!current) {
    currentPositionEl.textContent = "0 / 0";
    currentSeedEl.textContent = "Seed -";
    currentNoveltyEl.textContent = "Novelty -";
    updateActionButtons(null);
    return;
  }

  currentPositionEl.textContent = `${index + 1} / ${state.discoveries.length}`;
  currentSeedEl.textContent = `Seed ${shortSeed(current.seed)}`;
  currentNoveltyEl.textContent = `Novelty ${Math.round(current.novelty * 100)}%`;
  updateActionButtons(current);
}

function updateNavButtons() {
  if (state.appMode === APP_MODE_COMPOSER) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    nextBtn.title = "Composer mode";
    return;
  }

  const index = getCurrentIndex();
  prevBtn.disabled = index === -1 || index >= state.discoveries.length - 1;
  nextBtn.disabled = index === -1;
  nextBtn.title = index > 0 ? "Next illusion" : "Next or New";
}

function updateInterface() {
  updateSessionStats();
  updateMetaBar();
  updateNavButtons();
}

function syncControlReadouts() {
  complexityValue.textContent = String(state.options.complexity);
  motionValue.textContent = String(state.options.motion);
  noveltyValue.textContent = `${Math.round(state.options.noveltyBias * 100)}%`;
}

function persistState() {
  ensurePreferenceModelShape();
  const payload = {
    options: state.options,
    appMode: state.appMode,
    composerMenuWidth: state.composerMenuWidth,
    preference: { ...state.preferenceModel.linear },
    preferenceModel: {
      bias: state.preferenceModel.bias,
      linear: { ...state.preferenceModel.linear },
      pair: { ...state.preferenceModel.pair },
      updates: state.preferenceModel.updates,
    },
    discoveries: state.discoveries.map((item) => ({
      id: item.id,
      seed: item.seed,
      createdAt: item.createdAt,
      parentId: item.parentId,
      palette: item.palette,
      layers: item.layers,
      principles: item.principles,
      fixationAid: item.fixationAid,
      motionStrength: item.motionStrength,
      qualityScore: item.qualityScore,
      qualityMetrics: item.qualityMetrics,
      rating: item.rating,
      favorite: item.favorite,
      votes: item.votes,
      feature: item.feature,
      novelty: item.novelty,
      noveltyNearest: item.noveltyNearest,
      noveltyKnn: item.noveltyKnn,
      preferenceSignal: item.preferenceSignal,
      predictedAppeal: item.predictedAppeal,
      quickObjective: item.quickObjective,
      objective: item.objective,
      compositeScore: item.compositeScore,
    })),
    currentId: state.currentId,
    seedCounter: state.seedCounter,
    customSeedCounter: state.customSeedCounter,
    currentCustomId: state.currentCustomId,
    customCompositions: state.customCompositions.map((item) => cloneJson(item)),
    customDraft: state.customDraft ? cloneJson(state.customDraft) : null,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Keep running even if browser storage quota is full.
    console.warn("State persistence skipped:", error);
  }
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.customDraft = makeEmptyCustomComposition();
    return;
  }

  try {
    const parsed = JSON.parse(raw);

    if (parsed.options) {
      state.options.complexity = clamp(Number(parsed.options.complexity) || 6, 1, 10);
      state.options.motion = clamp(Number(parsed.options.motion) || 4, 0, 10);
      state.options.noveltyBias = clamp(Number(parsed.options.noveltyBias) || 0.75, 0, 1);
      state.options.enabledPrinciples = mergeImmersiveMotionPrinciples(parsed.options.enabledPrinciples);
    } else {
      state.options.enabledPrinciples = normalizeEnabledPrinciples(state.options.enabledPrinciples);
    }

    if (parsed.preferenceModel && typeof parsed.preferenceModel === "object") {
      state.preferenceModel = {
        bias: Number(parsed.preferenceModel.bias) || 0,
        linear: parsed.preferenceModel.linear || {},
        pair: parsed.preferenceModel.pair || {},
        updates: Number(parsed.preferenceModel.updates) || 0,
      };
    } else {
      const legacyLinear = parsed.preference || {};
      state.preferenceModel = {
        bias: 0,
        linear: legacyLinear,
        pair: {},
        updates: 0,
      };
    }
    ensurePreferenceModelShape();
    state.preference = { ...state.preferenceModel.linear };
    state.seedCounter = Number(parsed.seedCounter) || 0;
    state.customSeedCounter = Number(parsed.customSeedCounter) || 0;
    state.appMode = parsed.appMode === APP_MODE_COMPOSER ? APP_MODE_COMPOSER : APP_MODE_GENERATOR;
    state.composerMenuWidth = clampComposerMenuWidth(
      Number(parsed.composerMenuWidth) || DEFAULT_COMPOSER_MENU_WIDTH
    );

    if (Array.isArray(parsed.discoveries)) {
      state.discoveries = parsed.discoveries.map(sanitizeStoredDiscovery).filter(Boolean).slice(0, MAX_DISCOVERIES);
    }

    if (Array.isArray(parsed.customCompositions)) {
      state.customCompositions = parsed.customCompositions.map(sanitizeCustomComposition).filter(Boolean);
    }

    state.archiveVectors = state.discoveries.map((item) => ({
      id: item.id,
      vector: item.feature,
    }));

    if (state.discoveries.length) {
      state.currentId =
        parsed.currentId && state.discoveries.some((item) => item.id === parsed.currentId)
          ? parsed.currentId
          : state.discoveries[0].id;
    }

    if (parsed.customDraft) {
      state.customDraft = sanitizeCustomComposition(parsed.customDraft);
    }
    if (!state.customDraft) {
      state.customDraft = makeEmptyCustomComposition();
    }
    state.currentCustomId =
      typeof parsed.currentCustomId === "string" &&
      state.customCompositions.some((item) => item.id === parsed.currentCustomId)
        ? parsed.currentCustomId
        : null;
  } catch (error) {
    console.warn("State restore failed:", error);
    state.customDraft = makeEmptyCustomComposition();
  }
}

function toggleSave() {
  if (state.appMode === APP_MODE_COMPOSER) {
    return;
  }
  const current = getCurrentIllusion();
  if (!current) {
    return;
  }

  current.favorite = !current.favorite;
  applyPreferenceFeedback(current.principles, current.favorite ? 0.7 : -0.45);
  current.compositeScore = computeCompositeScore(current);
  updateInterface();
  persistState();
}

function resizeCanvas() {
  resizeCanvasToDisplaySize(canvas, 320, 220);
}

function resizeCanvasToDisplaySize(targetCanvas, minWidth = 240, minHeight = 180) {
  const rect = targetCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const targetWidth = Math.max(minWidth, Math.round(rect.width * dpr));
  const targetHeight = Math.max(minHeight, Math.round(rect.height * dpr));

  if (targetCanvas.width !== targetWidth || targetCanvas.height !== targetHeight) {
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;
  }
}

function resizeComposerPreviewCanvas() {
  if (!composerPreviewCanvas || composerPanelEl?.hidden) {
    return;
  }
  resizeCanvasToDisplaySize(composerPreviewCanvas, 260, 320);
}

function drawBackground(ctx, width, height, palette) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, cssTone(palette.bgA));
  gradient.addColorStop(1, cssTone(palette.bgB));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const halo = ctx.createRadialGradient(
    width * 0.52,
    height * 0.46,
    width * 0.08,
    width * 0.52,
    height * 0.46,
    width * 0.86
  );
  halo.addColorStop(0, cssTone(toneShift(palette.accents[0], 0, 0, 12), 0.15));
  halo.addColorStop(0.6, cssTone(toneShift(palette.accents[2], 8, 0, -6), 0.09));
  halo.addColorStop(1, cssTone(palette.bgA, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
}

function drawVignette(ctx, width, height, palette) {
  const v = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.15,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.8
  );
  v.addColorStop(0, cssTone(palette.bgA, 0));
  v.addColorStop(1, cssTone(toneShift(palette.bgA, 0, 8, -12), 0.38));
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, width, height);
}

function getViewportCompositionScale(targetCanvas, width, height) {
  if (targetCanvas !== canvas) {
    return 1;
  }

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = width / dpr;
  const cssHeight = height / dpr;
  return Math.min(cssWidth, cssHeight) <= MOBILE_VIEWPORT_MAX ? MOBILE_COMPOSITION_SCALE : 1;
}

function getCompositionFrame(targetCanvas, width, height) {
  const compositionScale = getViewportCompositionScale(targetCanvas, width, height);
  const compositionWidth = COMPOSITION_WIDTH * compositionScale;
  const compositionHeight = COMPOSITION_HEIGHT * compositionScale;
  const scale = Math.max(width / compositionWidth, height / compositionHeight);
  return {
    width: compositionWidth,
    height: compositionHeight,
    scale,
    offsetX: (width - compositionWidth * scale) / 2,
    offsetY: (height - compositionHeight * scale) / 2,
  };
}

function renderIllusion(illusion, targetCanvas, now = 0, staticFrame = false) {
  if (!illusion) {
    return;
  }
  const ctx = targetCanvas.getContext("2d");
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  const time = (now / 1000) * (0.32 + illusion.motionStrength * 0.95);
  const frame = getCompositionFrame(targetCanvas, width, height);
  const compositionWidth = frame.width;
  const compositionHeight = frame.height;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.translate(frame.offsetX, frame.offsetY);
  ctx.scale(frame.scale, frame.scale);

  drawBackground(ctx, compositionWidth, compositionHeight, illusion.palette);

  for (const layer of illusion.layers) {
    const profile = researchById[layer.principleId];
    if (!profile) {
      continue;
    }

    ctx.save();
    ctx.globalAlpha = layer.alpha;
    ctx.globalCompositeOperation = layer.blend;

    ctx.translate(compositionWidth * (0.5 + layer.offsetX), compositionHeight * (0.5 + layer.offsetY));
    ctx.rotate(layer.rotation);
    ctx.scale(layer.scale, layer.scale);
    ctx.translate(-compositionWidth * 0.5, -compositionHeight * 0.5);

    profile.draw(
      ctx,
      compositionWidth,
      compositionHeight,
      layer.params,
      illusion.palette,
      staticFrame ? 0 : time,
      illusion
    );
    ctx.restore();
  }

  drawVignette(ctx, compositionWidth, compositionHeight, illusion.palette);
  ctx.restore();
}

function renderActiveScene(targetCanvas, now = 0, staticFrame = false) {
  if (state.appMode === APP_MODE_COMPOSER) {
    const custom = getCurrentCustomComposition();
    if (custom) {
      renderCustomComposition(custom, targetCanvas, now, staticFrame);
    } else {
      const ctx = targetCanvas.getContext("2d");
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    }
    return;
  }

  const current = getCurrentIllusion();
  if (current) {
    renderIllusion(current, targetCanvas, now, staticFrame);
  } else {
    const ctx = targetCanvas.getContext("2d");
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  }
}

function renderCustomComposition(composition, targetCanvas, now = 0, staticFrame = false) {
  if (!composition) {
    return;
  }

  const ctx = targetCanvas.getContext("2d");
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  const time = staticFrame ? 0 : now / 1000;
  const frame = getCompositionFrame(targetCanvas, width, height);
  const compositionWidth = frame.width;
  const compositionHeight = frame.height;
  const baseScheme = getCustomScheme(composition.schemeId);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.translate(frame.offsetX, frame.offsetY);
  ctx.scale(frame.scale, frame.scale);

  drawCustomBackground(ctx, compositionWidth, compositionHeight, composition, baseScheme);

  for (const layer of composition.layers) {
    const element = customElementById[layer.typeId];
    if (!element) {
      continue;
    }

    const scheme = getEffectiveLayerScheme(layer, baseScheme);
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(
      compositionWidth * (0.5 + layer.x / 100),
      compositionHeight * (0.5 + layer.y / 100)
    );
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.scale, layer.scale);
    ctx.translate(-compositionWidth * 0.5, -compositionHeight * 0.5);
    element.draw(ctx, compositionWidth, compositionHeight, layer, scheme, time);
    ctx.restore();
  }
  ctx.restore();
}

function drawCustomBackground(ctx, width, height, composition, scheme) {
  ctx.fillStyle = composition.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const wash = ctx.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, rgba(scheme.colors[0], 0.18));
  wash.addColorStop(0.5, rgba(scheme.colors[2], 0.08));
  wash.addColorStop(1, rgba(scheme.colors[1], 0.16));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  const halo = ctx.createRadialGradient(
    width * 0.52,
    height * 0.42,
    width * 0.06,
    width * 0.52,
    height * 0.42,
    width * 0.58
  );
  halo.addColorStop(0, rgba(scheme.colors[3], 0.24));
  halo.addColorStop(1, rgba(scheme.colors[0], 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
}

function drawCustomResearchElement(profile, ctx, width, height, layer, scheme, time) {
  const palette = createCustomPalette("#080c14", scheme.id);
  palette.bgA = hexToTone(scheme.colors[0]);
  palette.bgB = hexToTone(scheme.colors[1]);
  palette.ink = hexToTone(scheme.ink);
  palette.accents = scheme.colors.map((color) => hexToTone(color));

  const illusionLike = {
    motionStrength: clamp(Math.abs(layer.speed) / 3, 0, 1),
    palette,
    layers: [layer],
    fixationAid: null,
  };

  profile.draw(
    ctx,
    width,
    height,
    layer.params || {},
    palette,
    time * (layer.speed || 0),
    illusionLike
  );
}

function renderCustomElementThumbnail(typeId, targetCanvas) {
  const scheme = customColorSchemes[0];
  const composition = {
    backgroundColor: "#070b12",
    schemeId: scheme.id,
    layers: [
      {
        ...makeCustomLayer(typeId),
        speed: 0.6,
      },
    ],
  };
  resizeCanvasToDisplaySize(targetCanvas, 180, 120);
  renderCustomComposition(composition, targetCanvas, 1200, true);
}

function drawCustomHaloOrb(ctx, width, height, layer, scheme, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const pulse = 1 + Math.sin(time * layer.speed * 2.4) * 0.08;
  const radius = Math.min(width, height) * 0.17 * pulse;

  const glow = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius * 1.8);
  glow.addColorStop(0, rgba(scheme.colors[0], 0.95));
  glow.addColorStop(0.45, rgba(scheme.colors[1], 0.4));
  glow.addColorStop(1, rgba(scheme.colors[2], 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.8, 0, TAU);
  ctx.fill();

  ctx.fillStyle = rgba(scheme.ink, 0.9);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.36, 0, TAU);
  ctx.fill();

  for (let i = 0; i < 5; i += 1) {
    const theta = (i / 5) * TAU + time * layer.speed * 0.8 * (i % 2 === 0 ? 1 : -1);
    const orbitRadius = radius * (0.9 + i * 0.22);
    const size = radius * (0.08 + i * 0.02);
    const x = cx + Math.cos(theta) * orbitRadius;
    const y = cy + Math.sin(theta) * orbitRadius * 0.72;
    ctx.fillStyle = rgba(scheme.colors[(i + 2) % scheme.colors.length], 0.55);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }
}

function drawCustomRippleRings(ctx, width, height, layer, scheme, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxRadius = Math.min(width, height) * 0.34;
  ctx.lineWidth = Math.max(1.5, Math.min(width, height) * 0.004);

  for (let i = 0; i < 8; i += 1) {
    const radius = maxRadius * (0.18 + i * 0.11);
    const phase = time * layer.speed + i * 0.4;
    ctx.strokeStyle = rgba(scheme.colors[i % scheme.colors.length], 0.2 + i * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, radius + Math.sin(phase) * 6, phase * 0.35, phase * 0.35 + Math.PI * 1.75);
    ctx.stroke();
  }
}

function drawCustomMoireWave(ctx, width, height, layer, scheme, time) {
  ctx.lineWidth = Math.max(1.1, Math.min(width, height) * 0.0022);

  for (let band = 0; band < 3; band += 1) {
    const color = scheme.colors[band % scheme.colors.length];
    const spacing = height * (0.08 + band * 0.025);
    const amplitude = height * (0.04 + band * 0.015);
    const speed = time * layer.speed * (0.7 + band * 0.2);
    ctx.strokeStyle = rgba(color, 0.34 + band * 0.1);

    for (let y = -spacing; y <= height + spacing; y += spacing) {
      ctx.beginPath();
      for (let x = -40; x <= width + 40; x += 16) {
        const yPos = y + Math.sin(x * 0.012 + speed + band * 1.2) * amplitude;
        if (x === -40) {
          ctx.moveTo(x, yPos);
        } else {
          ctx.lineTo(x, yPos);
        }
      }
      ctx.stroke();
    }
  }
}

function drawCustomSunburst(ctx, width, height, layer, scheme, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const rays = 18;
  const spin = time * layer.speed * 0.24;

  for (let i = 0; i < rays; i += 1) {
    const angle = (i / rays) * TAU + spin;
    const inner = Math.min(width, height) * 0.12;
    const outer = Math.min(width, height) * (0.34 + (i % 3) * 0.06);
    const color = scheme.colors[i % scheme.colors.length];

    ctx.fillStyle = rgba(color, 0.22 + (i % 2) * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle - 0.05) * inner, cy + Math.sin(angle - 0.05) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.lineTo(cx + Math.cos(angle + 0.05) * inner, cy + Math.sin(angle + 0.05) * inner);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = rgba(scheme.ink, 0.6);
  ctx.lineWidth = Math.max(1.2, Math.min(width, height) * 0.004);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(width, height) * 0.11, 0, TAU);
  ctx.stroke();
}

function drawCustomPrismBars(ctx, width, height, layer, scheme, time) {
  const barCount = 6;
  const travel = time * layer.speed * 28;

  for (let i = 0; i < barCount; i += 1) {
    const w = width * (0.18 + (i % 3) * 0.08);
    const h = height * (0.72 - i * 0.06);
    const x = width * 0.12 + i * width * 0.12 + Math.sin(time * layer.speed + i) * 18 + travel * 0.2 * (i % 2 === 0 ? 1 : -1);
    const y = height * 0.14 + i * 12;
    const color = scheme.colors[i % scheme.colors.length];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.26 + i * 0.06);
    ctx.fillStyle = rgba(color, 0.22 + i * 0.04);
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
    ctx.strokeStyle = rgba(scheme.ink, 0.18);
    ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
    ctx.restore();
  }
}

function drawCustomCheckerVeil(ctx, width, height, layer, scheme, time) {
  const cols = 8;
  const rows = 6;
  const tileW = width / cols;
  const tileH = height / rows;

  for (let row = -1; row <= rows; row += 1) {
    for (let col = -1; col <= cols; col += 1) {
      const driftX = Math.sin(time * layer.speed + row * 0.7) * 12;
      const driftY = Math.cos(time * layer.speed * 0.9 + col * 0.5) * 10;
      ctx.fillStyle = rgba(scheme.colors[(row + col + customColorSchemes.length * 2) % scheme.colors.length], (row + col) % 2 === 0 ? 0.24 : 0.09);
      ctx.fillRect(col * tileW + driftX, row * tileH + driftY, tileW + 1, tileH + 1);
    }
  }

  ctx.strokeStyle = rgba(scheme.ink, 0.1);
  ctx.lineWidth = 1;
  for (let col = 0; col <= cols; col += 1) {
    ctx.beginPath();
    ctx.moveTo(col * tileW, 0);
    ctx.lineTo(col * tileW, height);
    ctx.stroke();
  }
  for (let row = 0; row <= rows; row += 1) {
    ctx.beginPath();
    ctx.moveTo(0, row * tileH);
    ctx.lineTo(width, row * tileH);
    ctx.stroke();
  }
}

function drawWaveSet(ctx, width, height, config) {
  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(config.angle);
  ctx.translate(-width * 0.5, -height * 0.5);
  ctx.strokeStyle = config.color;
  ctx.lineWidth = config.stroke;

  const stepX = 10;
  for (let y = -height; y < height * 2; y += config.spacing) {
    ctx.beginPath();
    for (let x = -width; x <= width * 2; x += stepX) {
      const wave = Math.sin(x * 0.01 * config.freq + config.phase) * config.amplitude;
      const yPos = y + wave;
      if (x === -width) {
        ctx.moveTo(x, yPos);
      } else {
        ctx.lineTo(x, yPos);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawMoireField(ctx, width, height, params, palette, time, illusion) {
  const phase = time * params.drift * (0.75 + illusion.motionStrength);
  drawWaveSet(ctx, width, height, {
    angle: params.angleA,
    spacing: params.spacing,
    amplitude: params.amplitude,
    freq: params.freq,
    phase,
    stroke: params.stroke,
    color: cssTone(palette.accents[0], 0.7),
  });

  drawWaveSet(ctx, width, height, {
    angle: params.angleB,
    spacing: params.spacing * 1.08,
    amplitude: params.amplitude * 0.92,
    freq: params.freq * 1.17,
    phase: -phase * 1.14,
    stroke: params.stroke,
    color: cssTone(palette.accents[1], 0.66),
  });
}

function drawCafeWall(ctx, width, height, params, palette, time) {
  const tileW = width / params.cols;
  const tileH = height / params.rows;
  const mortarThickness = Math.max(1, tileH * params.mortar);

  const dark = toneShift(palette.accents[2], 0, -26, -22);
  const light = toneShift(palette.accents[0], 0, -8, 24);
  const mortar = toneShift(palette.ink, 0, -6, -16);

  for (let row = -1; row <= params.rows + 1; row += 1) {
    const waveOffset = Math.sin(row * 0.6 + time * params.wave) * tileW * 0.4;
    const rowOffset = ((row % 2 === 0 ? 1 : -1) * params.offset * tileW) / 2 + waveOffset;

    for (let col = -2; col <= params.cols + 2; col += 1) {
      const x = col * tileW + rowOffset;
      const y = row * tileH;

      ctx.fillStyle = (col + row) % 2 === 0 ? cssTone(dark, 0.95) : cssTone(light, 0.95);
      ctx.fillRect(x, y, tileW + 1, tileH + 1);
    }

    ctx.fillStyle = cssTone(mortar, 0.65);
    ctx.fillRect(0, row * tileH + tileH * 0.5 - mortarThickness * 0.5, width, mortarThickness);
  }
}

function drawZollnerLines(ctx, width, height, params, palette) {
  const margin = width * 0.07;
  const usableHeight = height * 0.86;
  const lineGap = usableHeight / Math.max(3, params.lineCount - 1);

  ctx.strokeStyle = cssTone(palette.ink, 0.8);
  ctx.lineWidth = params.stroke;

  for (let i = 0; i < params.lineCount; i += 1) {
    const jitter = (Math.sin(i * 1.33) * params.gapJitter * lineGap) / 2;
    const y = height * 0.08 + i * lineGap + jitter;
    const yEnd = y + params.slope * width;

    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(width - margin, yEnd);
    ctx.stroke();

    for (let x = margin; x < width - margin; x += params.tickGap) {
      const baseY = y + ((x - margin) / (width - margin)) * (yEnd - y);
      const toggle = ((i + Math.floor(x / params.tickGap)) % 2 === 0 ? 1 : -1) * params.tickAngle;

      ctx.strokeStyle = cssTone(palette.accents[(i + Math.floor(x)) % palette.accents.length], 0.7);
      ctx.beginPath();
      ctx.moveTo(
        x - Math.cos(toggle) * params.tickLength * 0.5,
        baseY - Math.sin(toggle) * params.tickLength * 0.5
      );
      ctx.lineTo(
        x + Math.cos(toggle) * params.tickLength * 0.5,
        baseY + Math.sin(toggle) * params.tickLength * 0.5
      );
      ctx.stroke();
    }
  }
}

function drawScintillatingGrid(ctx, width, height, params, palette, time, illusion) {
  const gapX = width / (params.cols + 1);
  const gapY = height / (params.rows + 1);

  ctx.fillStyle = cssTone(toneShift(palette.bgA, 0, -18, -8), 0.82);
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = cssTone(palette.ink, 0.75);
  ctx.lineWidth = params.lineWidth;

  for (let c = 1; c <= params.cols; c += 1) {
    const x = c * gapX;
    ctx.beginPath();
    ctx.moveTo(x, gapY * 0.8);
    ctx.lineTo(x, height - gapY * 0.8);
    ctx.stroke();
  }

  for (let r = 1; r <= params.rows; r += 1) {
    const y = r * gapY;
    ctx.beginPath();
    ctx.moveTo(gapX * 0.8, y);
    ctx.lineTo(width - gapX * 0.8, y);
    ctx.stroke();
  }

  for (let r = 1; r <= params.rows; r += 1) {
    for (let c = 1; c <= params.cols; c += 1) {
      const x = c * gapX;
      const y = r * gapY;
      const pulse =
        0.45 +
        0.55 *
          Math.sin((r + c) * 0.42 + time * params.flickerSpeed * (0.6 + illusion.motionStrength));
      const jitterX = Math.sin((r + c) * 0.9) * params.jitter * gapX * 0.09;
      const jitterY = Math.cos((r - c) * 0.7) * params.jitter * gapY * 0.09;

      ctx.fillStyle = cssTone(palette.accents[(r + c) % palette.accents.length], 0.35 + pulse * 0.52);
      ctx.beginPath();
      ctx.arc(x + jitterX, y + jitterY, params.dotRadius * (0.8 + pulse * 0.28), 0, TAU);
      ctx.fill();
    }
  }
}

function drawPeripheralDrift(ctx, width, height, params, palette, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxRadius = Math.min(width, height) * 0.48;
  const ringStep = maxRadius / (params.rings + 1);

  const cycle = [
    toneShift(palette.accents[0], 0, 5, 15),
    toneShift(palette.accents[2], 0, -30, -12),
    toneShift(palette.ink, 0, -25, 10),
    toneShift(palette.accents[1], 0, -6, -8),
  ];

  ctx.save();
  ctx.translate(cx, cy);

  for (let ring = 1; ring <= params.rings; ring += 1) {
    const radius = ring * ringStep;
    const thickness = ringStep * params.width;
    const localSegments = params.segments + ring * 2;
    const spin = time * params.speed + ring * params.twist * 12;

    for (let index = 0; index < localSegments; index += 1) {
      const phase = index / localSegments;
      const start = phase * TAU + spin;
      const end = start + (TAU / localSegments) * 0.92;

      ctx.beginPath();
      ctx.arc(0, 0, radius + thickness * 0.55, start, end, false);
      ctx.arc(0, 0, radius - thickness * 0.55, end, start, true);
      ctx.closePath();

      const paletteIndex = (index + ring) % cycle.length;
      const alpha = 0.32 + 0.54 * (0.5 + 0.5 * Math.sin(index * params.dimple + ring));
      ctx.fillStyle = cssTone(cycle[paletteIndex], alpha);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawKanizsaWeb(ctx, width, height, params, palette, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const orbitRadius = Math.min(width, height) * params.orbit;

  const points = [];
  for (let i = 0; i < params.nodes; i += 1) {
    const theta = (i / params.nodes) * TAU + time * params.spin;
    points.push({
      x: cx + Math.cos(theta) * orbitRadius,
      y: cy + Math.sin(theta) * orbitRadius,
      theta,
    });
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = cssTone(toneShift(palette.accents[0], 0, -10, 6), params.softness * 0.35);
  ctx.fill();

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const towardCenter = Math.atan2(cy - p.y, cx - p.x);
    const biteAngle = params.bite;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, params.radius, towardCenter + biteAngle, towardCenter - biteAngle, true);
    ctx.closePath();
    ctx.fillStyle = cssTone(palette.ink, 0.85);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, params.radius * 0.26, 0, TAU);
    ctx.fillStyle = cssTone(palette.accents[(i + 1) % palette.accents.length], 0.52);
    ctx.fill();
  }
}

function drawFraserSpiral(ctx, width, height, params, palette, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxRadius = Math.min(width, height) * 0.48;
  const ringStep = maxRadius / params.rings;

  ctx.save();
  ctx.translate(cx, cy);

  for (let ring = 1; ring <= params.rings; ring += 1) {
    const radius = ring * ringStep;
    const circumference = TAU * radius;
    const blocks = Math.max(8, Math.floor(circumference / (params.block * 1.1)));

    for (let i = 0; i < blocks; i += 1) {
      const base = (i / blocks) * TAU + ring * params.twist + time * params.speed;
      const x = Math.cos(base) * radius;
      const y = Math.sin(base) * radius;

      const tiltDirection = i % 2 === 0 ? 1 : -1;
      const widthBlock = params.block;
      const heightBlock = params.block * 0.44;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(base + Math.PI / 2 + tiltDirection * params.tilt);
      ctx.fillStyle = cssTone(palette.accents[(i + ring) % palette.accents.length], 0.7);
      ctx.fillRect(-widthBlock * 0.5, -heightBlock * 0.5, widthBlock, heightBlock);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.lineWidth = params.stroke;
    ctx.strokeStyle = cssTone(toneShift(palette.ink, 0, -10, -4), 0.4);
    ctx.stroke();
  }

  ctx.restore();
}

function pathRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStripeField(ctx, width, height, spacing, angle, stripeWidth, stripeColor, bgColor, drift = 0) {
  const span = Math.hypot(width, height);

  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(angle);
  ctx.translate(-width * 0.5, -height * 0.5);

  ctx.fillStyle = bgColor;
  ctx.fillRect(-span, -span, span * 3, span * 3);

  ctx.fillStyle = stripeColor;
  const step = Math.max(4, spacing);
  const lineWidth = Math.max(1.5, stripeWidth);
  for (let x = -span; x <= span * 2; x += step) {
    const wobble = Math.sin((x / step) * 0.66 + drift) * step * 0.16;
    ctx.fillRect(x + wobble, -span, lineWidth, span * 3);
  }

  ctx.restore();
}

function drawStripePlane(ctx, width, height, spacing, angle, stripeWidth, stripeColor, backgroundColor = null, drift = 0) {
  const span = Math.hypot(width, height) * 1.2;

  ctx.save();
  ctx.rotate(angle);

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(-span, -span, span * 2, span * 2);
  }

  ctx.fillStyle = stripeColor;
  const step = Math.max(4, spacing);
  const lineWidth = Math.max(1.5, stripeWidth);
  const scroll = drift * step * 10;
  for (let x = -span; x <= span; x += step) {
    const wobble = Math.sin((x / step) * 0.66 + drift) * step * 0.16;
    ctx.fillRect(x + scroll + wobble, -span, lineWidth, span * 2);
  }

  ctx.restore();
}

function drawCausticWaveMesh(ctx, width, height, params, palette, time, illusion) {
  const base = toneShift(palette.bgA, 0, -14, -10);
  ctx.fillStyle = cssTone(base, 0.98);
  ctx.fillRect(0, 0, width, height);

  const veilAngle = params.angleA * 0.45 + params.angleB * 0.2;
  const veilSpan = Math.hypot(width, height);
  const veilDrift = time * params.drift * veilSpan * 0.08;
  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(veilAngle);
  ctx.translate(-width * 0.5, -height * 0.5);
  for (let i = -1; i <= params.veilBands; i += 1) {
    const bandWidth = veilSpan / Math.max(3, params.veilBands + 1);
    const x = i * bandWidth + veilDrift;
    const gradient = ctx.createLinearGradient(x, 0, x + bandWidth, 0);
    gradient.addColorStop(0, cssTone(palette.accents[i & 3], 0));
    gradient.addColorStop(0.5, cssTone(toneShift(palette.accents[(i + 1) & 3], 0, -12, 6), 0.08));
    gradient.addColorStop(1, cssTone(palette.accents[(i + 2) & 3], 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(x, -veilSpan * 0.35, bandWidth, veilSpan * 1.7);
  }
  ctx.restore();

  const phase = time * params.drift * (0.65 + illusion.motionStrength);
  drawWaveSet(ctx, width, height, {
    angle: params.angleA,
    spacing: params.spacing,
    amplitude: params.amplitude,
    freq: params.freq,
    phase,
    stroke: params.stroke,
    color: cssTone(palette.accents[0], 0.42),
  });
  drawWaveSet(ctx, width, height, {
    angle: params.angleB,
    spacing: params.spacing * 0.95,
    amplitude: params.amplitude * 0.88,
    freq: params.freq * 1.15,
    phase: -phase * 1.2,
    stroke: params.stroke * 0.96,
    color: cssTone(palette.accents[2], 0.34),
  });
  drawWaveSet(ctx, width, height, {
    angle: params.angleC,
    spacing: params.spacing * 1.12,
    amplitude: params.amplitude * 0.74,
    freq: params.freq * 0.82,
    phase: phase * 0.72 + Math.PI * 0.25,
    stroke: params.stroke * 0.9,
    color: cssTone(toneShift(palette.ink, 0, -24, -10), 0.22),
  });
}

function drawParallaxTileDrift(ctx, width, height, params, palette, time) {
  const darkBase = toneShift(palette.bgA, 0, -12, -10);
  drawStripeField(
    ctx,
    width,
    height,
    params.fieldSpacing,
    params.fieldAngle,
    params.fieldWidth,
    cssTone(palette.accents[2], 0.2),
    cssTone(darkBase, 0.98),
    time * params.fieldDrift
  );
  drawStripeField(
    ctx,
    width,
    height,
    params.fieldSpacing * 1.16,
    params.fieldAngle + params.crossAngle,
    params.fieldWidth * 0.36,
    cssTone(palette.accents[0], 0.14),
    cssTone(darkBase, 0),
    -time * params.fieldDrift * 0.7
  );

  const tileW = width / params.cols;
  const tileH = height / params.rows;
  const depths = [
    { tone: palette.accents[3], alpha: 0.1, scale: 0.92, drift: -0.72 },
    { tone: palette.ink, alpha: 0.16, scale: 1.04, drift: 1 },
    { tone: palette.accents[1], alpha: 0.12, scale: 0.78, drift: -1.26 },
  ];
  const driftAngle = params.fieldAngle + params.crossAngle * 0.4;
  const driftUnitX = Math.cos(driftAngle);
  const driftUnitY = Math.sin(driftAngle);

  for (let depth = 0; depth < depths.length; depth += 1) {
    const profile = depths[depth];
    const slide = time * params.tileDrift * tileW * profile.drift;
    const shiftX = driftUnitX * slide;
    const shiftY = driftUnitY * slide;
    for (let row = -2; row <= params.rows + 1; row += 1) {
      for (let col = -2; col <= params.cols + 1; col += 1) {
        const noiseA = Math.sin((row + 1) * 3.41 + (col + 1) * 1.73 + depth * 2.11) * 0.5 + 0.5;
        const noiseB = Math.cos((row + 1) * 1.87 - (col + 1) * 2.31 + depth * 1.17) * 0.5 + 0.5;
        const panelW = tileW * profile.scale * (0.66 + noiseA * params.tileScale * 0.72);
        const panelH = tileH * (0.44 + noiseB * 0.88);
        const x = (col + 0.5) * tileW + shiftX + Math.sin(row * 0.62 + depth) * tileW * 0.22;
        const y = (row + 0.5) * tileH + shiftY + Math.cos(col * 0.58 + depth) * tileH * 0.16;
        const rotation = params.tilt * (noiseA - 0.5) * (depth % 2 === 0 ? -1 : 1);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        pathRoundedRect(
          ctx,
          -panelW * 0.5,
          -panelH * 0.5,
          panelW,
          panelH,
          Math.min(panelW, panelH) * params.corner
        );
        ctx.fillStyle = cssTone(profile.tone, profile.alpha + noiseB * 0.06);
        ctx.fill();
        ctx.strokeStyle = cssTone(toneShift(profile.tone, 0, -18, 12), 0.12 + noiseA * 0.08);
        ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.0018);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function drawBarberPoleShear(ctx, width, height, params, palette, time, illusion) {
  const darkBase = toneShift(palette.bgA, 0, -24, -12);
  const backgroundLine = toneShift(palette.ink, 0, -22, -6);
  const slabFillBase = toneShift(palette.bgB, 0, -24, -10);
  const accentPairs = [
    [toneShift(palette.accents[0], 0, 6, 10), toneShift(palette.accents[2], 0, -2, 6)],
    [toneShift(palette.accents[1], 0, 4, 8), toneShift(palette.accents[3], 0, -4, 10)],
  ];
  drawStripeField(
    ctx,
    width,
    height,
    params.backgroundSpacing,
    params.bandAngle + Math.PI * 0.5,
    params.backgroundSpacing * 0.2,
    cssTone(backgroundLine, 0.08),
    cssTone(darkBase, 0.98),
    time * params.backgroundDrift
  );

  const span = Math.hypot(width, height);
  const axisX = Math.cos(params.bandAngle);
  const axisY = Math.sin(params.bandAngle);
  const normalX = -axisY;
  const normalY = axisX;
  const slabW = span * params.slabLength;
  const baseSlabH = height * params.slabHeight;
  const laneStep = baseSlabH * params.laneOverlap;
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const lanePattern = params.bands === 2 ? [-0.46, 0.46] : [-0.72, 0, 0.72];

  for (let i = 0; i < params.bands; i += 1) {
    const direction = i % 2 === 0 ? 1 : -1;
    const motionPhase = time * params.slabTravel * (0.42 + illusion.motionStrength * 0.18) + i * 1.05;
    const bob = Math.sin(motionPhase) * height * params.slabBob * direction;
    const sway = Math.cos(motionPhase * 0.78 + i * 0.33) * width * params.slabSway * direction;
    const depthScale = 1 + Math.cos(motionPhase * 0.92 + i * 0.4) * params.depthPulse;
    const slabH = baseSlabH * depthScale;
    const laneOffset = lanePattern[i] * laneStep;
    const cx = centerX + normalX * laneOffset + sway;
    const cy = centerY + normalY * laneOffset * 0.68 + bob;
    const angle = params.bandAngle;
    const corner = Math.min(slabW, slabH) * params.corner;
    const [primaryStripe, secondaryStripe] = accentPairs[i % accentPairs.length];
    const slabFill = toneShift(slabFillBase, primaryStripe.h - slabFillBase.h, 6, -2);
    const rimTone = toneShift(primaryStripe, 0, -18, 14);
    const frameAlpha = 0.012 + (depthScale - 1 + params.depthPulse) * 0.06;
    const stripePhase = time * params.stripeDrift * (0.58 + illusion.motionStrength * 0.24);
    const primaryStripeDrift = direction * stripePhase;
    const secondaryStripeDrift = -direction * stripePhase * 0.82;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(depthScale, depthScale);

    for (let ghost = params.ghosts; ghost >= 1; ghost -= 1) {
      const ghostOffset = ghost * span * 0.05 * direction;
      pathRoundedRect(ctx, -slabW * 0.5 + ghostOffset, -slabH * 0.5, slabW, slabH, corner);
      ctx.strokeStyle = cssTone(rimTone, 0.06);
      ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.0016);
      ctx.stroke();
    }

    pathRoundedRect(ctx, -slabW * 0.5, -slabH * 0.5, slabW, slabH, corner);
    ctx.save();
    ctx.clip();
    drawStripePlane(
      ctx,
      slabW,
      slabH,
      params.stripeSpacing,
      params.stripeAngle + direction * 0.025,
      params.stripeWidth,
      cssTone(primaryStripe, 0.92),
      cssTone(slabFill, 0.46),
      primaryStripeDrift
    );
    drawStripePlane(
      ctx,
      slabW,
      slabH,
      params.stripeSpacing * 1.08,
      params.stripeAngle - direction * 0.035,
      params.stripeWidth * 0.72,
      cssTone(secondaryStripe, 0.38),
      null,
      secondaryStripeDrift
    );
    ctx.restore();

    pathRoundedRect(ctx, -slabW * 0.5, -slabH * 0.5, slabW, slabH, corner);
    ctx.fillStyle = cssTone(palette.ink, frameAlpha);
    ctx.fill();
    ctx.strokeStyle = cssTone(rimTone, 0.18);
    ctx.lineWidth = Math.max(1.2, Math.min(width, height) * 0.0022);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPinnaBrelstaff(ctx, width, height, params, palette, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxRadius = Math.min(width, height) * 0.48;
  const ringStep = maxRadius / (params.rings + 1);
  const arcSpan = (TAU / params.wedges) * params.arcFill;

  const tones = [
    toneShift(palette.accents[0], 0, 6, 12),
    toneShift(palette.accents[2], 0, -16, -10),
    toneShift(palette.ink, 0, -18, 8),
  ];

  ctx.save();
  ctx.translate(cx, cy);

  for (let ring = 1; ring <= params.rings; ring += 1) {
    const radius = ring * ringStep;
    const band = ringStep * params.thickness;
    const spin = time * params.spin * (ring % 2 === 0 ? 1 : -1);

    for (let wedge = 0; wedge < params.wedges; wedge += 1) {
      const theta = (wedge / params.wedges) * TAU + spin;
      const start = theta - arcSpan * 0.5;
      const end = theta + arcSpan * 0.5;
      const inner = Math.max(0, radius - band * 0.5);
      const outer = radius + band * 0.5;

      ctx.beginPath();
      ctx.arc(0, 0, outer, start, end, false);
      ctx.arc(0, 0, inner, end, start, true);
      ctx.closePath();
      ctx.fillStyle = cssTone(tones[(ring + wedge) % tones.length], 0.66);
      ctx.fill();

      const tiltSign = wedge % 2 === 0 ? 1 : -1;
      ctx.save();
      ctx.translate(Math.cos(theta) * radius, Math.sin(theta) * radius);
      ctx.rotate(theta + Math.PI * 0.5 + tiltSign * params.skew);
      ctx.fillStyle = cssTone(palette.accents[(wedge + ring) % palette.accents.length], 0.72);
      ctx.fillRect(-band * 0.54, -band * 0.18, band * 1.08, band * 0.36);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawOuchiTiles(ctx, width, height, params, palette, time) {
  const bgDark = toneShift(palette.bgA, 0, -16, -8);
  const bgLight = toneShift(palette.ink, 0, -18, 9);
  const centerDark = toneShift(palette.accents[1], 0, -22, -16);
  const centerLight = toneShift(palette.accents[3], 0, -8, 18);

  drawStripeField(
    ctx,
    width,
    height,
    params.spacing * 1.08,
    params.angleA,
    params.spacing * 0.52,
    cssTone(bgLight, 0.8),
    cssTone(bgDark, 0.98),
    time * params.pulse
  );

  const centerW = width * params.centerScale;
  const centerH = height * params.centerScale;
  const centerX = width * 0.5 - centerW * 0.5;
  const centerY = height * 0.5 - centerH * 0.5;
  const corner = Math.min(centerW, centerH) * params.corner;

  ctx.save();
  pathRoundedRect(ctx, centerX, centerY, centerW, centerH, corner);
  ctx.clip();
  drawStripeField(
    ctx,
    width,
    height,
    params.spacing,
    params.angleB + Math.sin(time * params.pulse * 0.5) * 0.05,
    params.spacing * 0.48,
    cssTone(centerLight, 0.86),
    cssTone(centerDark, 0.95),
    -time * params.pulse * 1.1
  );
  ctx.restore();

  ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.004);
  pathRoundedRect(ctx, centerX, centerY, centerW, centerH, corner);
  ctx.strokeStyle = cssTone(toneShift(palette.ink, 0, -10, 6), 0.6);
  ctx.stroke();
}

function drawMachBands(ctx, width, height, params, palette, time) {
  const span = Math.hypot(width, height);
  const bandHeight = (span * 2) / params.bands;

  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(params.orientation);
  ctx.translate(-width * 0.5, -height * 0.5);

  for (let i = 0; i < params.bands; i += 1) {
    const t = i / Math.max(1, params.bands - 1);
    const yBase = -span + i * bandHeight;
    const wobble = Math.sin(i * 0.75 + time * params.drift) * bandHeight * params.ripple;
    const y = yBase + wobble;

    const leftTone = toneShift(palette.bgA, 0, -6 + t * 6, -10 + t * 42 * params.ramp);
    const rightTone = toneShift(palette.bgB, 0, -12 + t * 12, 16 - t * 46 * (1 - params.ramp));
    const gradient = ctx.createLinearGradient(-span, 0, span * 2, 0);
    gradient.addColorStop(0, cssTone(leftTone, 0.92));
    gradient.addColorStop(1, cssTone(rightTone, 0.92));

    ctx.fillStyle = gradient;
    ctx.fillRect(-span, y, span * 3, bandHeight + 1);

    if (i < params.bands - 1) {
      const edgeY = y + bandHeight;
      const edgeAlpha = clamp(params.edgeBoost * 1.3, 0.04, 0.38);
      ctx.fillStyle = cssTone(palette.ink, edgeAlpha);
      ctx.fillRect(-span, edgeY - 1.2, span * 3, 1.1);
      ctx.fillStyle = cssTone(toneShift(palette.bgA, 0, -12, -18), edgeAlpha * 0.82);
      ctx.fillRect(-span, edgeY, span * 3, 1.4);
    }
  }

  ctx.restore();
}

function drawTroxlerField(ctx, width, height, params, palette, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const minDim = Math.min(width, height);
  const ringRadius = minDim * params.ringRadius;
  const spread = minDim * params.spread;

  ctx.fillStyle = cssTone(toneShift(palette.bgB, 0, -14, -2), 0.98);
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < params.blobs; i += 1) {
    const noiseA = Math.sin(i * 7.91) * 0.5 + 0.5;
    const noiseB = Math.cos(i * 11.17) * 0.5 + 0.5;
    const theta = (i / params.blobs) * TAU + time * params.drift * (0.4 + noiseA);
    const radius = ringRadius + (noiseB - 0.5) * spread;
    const x = cx + Math.cos(theta) * radius;
    const y = cy + Math.sin(theta) * radius;
    const size = params.blobSize * (0.58 + noiseA * 0.9);
    const alpha = 0.05 + (1 - params.softness) * 0.16;
    const tone = palette.accents[i % palette.accents.length];

    const gradient = ctx.createRadialGradient(x, y, size * 0.05, x, y, size);
    gradient.addColorStop(0, cssTone(toneShift(tone, 0, -15, 2), alpha));
    gradient.addColorStop(1, cssTone(toneShift(tone, 0, -22, -2), 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }
}

function drawHeringWarp(ctx, width, height, params, palette, time) {
  const centerX = width * 0.5;
  const centerY = height * (0.5 + params.offsetY);
  const rayLength = Math.hypot(width, height) * 0.95;

  ctx.lineWidth = Math.max(0.8, Math.min(width, height) * 0.0018);
  for (let i = 0; i < params.rays; i += 1) {
    const t = i / Math.max(1, params.rays - 1);
    const angle = (t - 0.5) * Math.PI * params.raySpread;
    const x2 = centerX + Math.cos(angle) * rayLength;
    const y2 = centerY + Math.sin(angle) * rayLength;
    const midX = (centerX + x2) * 0.5;
    const midY = (centerY + y2) * 0.5;
    const normal = angle + Math.PI * 0.5;
    const bend =
      Math.sin(i * 0.67 + time * params.drift) * params.rayBend * Math.min(width, height) * 0.6;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.quadraticCurveTo(midX + Math.cos(normal) * bend, midY + Math.sin(normal) * bend, x2, y2);
    ctx.strokeStyle = cssTone(toneShift(palette.accents[i % palette.accents.length], 0, -20, -6), 0.28);
    ctx.stroke();
  }

  const gap = width * params.lineGap;
  const barHeight = height * 0.72;
  const leftX = centerX - gap * 0.5;
  const rightX = centerX + gap * 0.5;
  const top = height * 0.14;
  const bottom = top + barHeight;
  const bow = params.rayBend * width * 0.22;

  ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.006);
  ctx.strokeStyle = cssTone(palette.ink, 0.88);
  ctx.beginPath();
  ctx.moveTo(leftX, top);
  ctx.quadraticCurveTo(leftX + bow, (top + bottom) * 0.5, leftX, bottom);
  ctx.moveTo(rightX, top);
  ctx.quadraticCurveTo(rightX - bow, (top + bottom) * 0.5, rightX, bottom);
  ctx.stroke();
}

function drawMullerLyerField(ctx, width, height, params, palette, time) {
  const rows = params.rows;
  const usableTop = height * 0.12;
  const usableBottom = height * 0.88;
  const rowGap = (usableBottom - usableTop) / Math.max(1, rows - 1);
  const centerX = width * 0.5;
  const lineLength = width * params.baseLength;
  const half = lineLength * 0.5;
  const arrowLen = Math.max(6, Math.min(width, height) * params.arrowLength);
  const lineAngle = params.rowSlope;

  function drawWings(x, y, baseAngle, wingAngle, length, tone) {
    ctx.strokeStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(baseAngle + wingAngle) * length, y + Math.sin(baseAngle + wingAngle) * length);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(baseAngle - wingAngle) * length, y + Math.sin(baseAngle - wingAngle) * length);
    ctx.stroke();
  }

  ctx.lineWidth = Math.max(1.6, Math.min(width, height) * 0.0035);

  for (let row = 0; row < rows; row += 1) {
    const t = row / Math.max(1, rows - 1);
    const y = usableTop + rowGap * row + Math.sin(row * 0.64 + time * params.drift * 2.2) * rowGap * 0.12;
    const dy = Math.sin(lineAngle) * half;
    const x1 = centerX - half;
    const y1 = y - dy;
    const x2 = centerX + half;
    const y2 = y + dy;
    const outward = row % 2 === 0;
    const tone = cssTone(palette.accents[row % palette.accents.length], 0.74);

    ctx.strokeStyle = cssTone(toneShift(palette.ink, 0, -10, 4), 0.9);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const axis = Math.atan2(y2 - y1, x2 - x1);
    const leftBase = outward ? axis + Math.PI : axis;
    const rightBase = outward ? axis : axis + Math.PI;
    const localAngle = params.wingAngle + Math.sin(t * TAU + time * params.drift) * 0.05;
    drawWings(x1, y1, leftBase, localAngle, arrowLen, tone);
    drawWings(x2, y2, rightBase, localAngle, arrowLen, tone);
  }
}

function drawPonzoCorridor(ctx, width, height, params, palette, time) {
  const horizonY = height * params.horizonY;
  const centerX = width * 0.5;
  const bottomY = height * 0.96;

  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.0025);

  for (let i = 0; i < params.railCount; i += 1) {
    const p = i / Math.max(1, params.railCount - 1) - 0.5;
    const spread = width * params.railSpread;
    const startX = centerX + p * spread * 2;
    const endX = centerX + p * spread * 0.15;
    const wobble = Math.sin(i * 0.52 + time * params.drift * 2.6) * width * 0.006;

    ctx.beginPath();
    ctx.moveTo(startX, bottomY);
    ctx.lineTo(endX + wobble, horizonY);
    ctx.strokeStyle = cssTone(toneShift(palette.accents[i % palette.accents.length], 0, -14, -8), 0.46);
    ctx.stroke();
  }

  const barLength = width * params.barWidth;
  const barThickness = Math.max(2, Math.min(width, height) * 0.006);
  for (let i = 0; i < params.barCount; i += 1) {
    const t = i / Math.max(1, params.barCount - 1);
    const y = bottomY - t * (bottomY - horizonY) * 0.88;
    const wobble = Math.sin(i * 0.9 + time * params.drift) * width * 0.012;
    const half = barLength * 0.5;
    const tone = cssTone(palette.ink, 0.86);
    ctx.strokeStyle = tone;
    ctx.lineWidth = barThickness;
    ctx.beginPath();
    ctx.moveTo(centerX - half + wobble, y);
    ctx.lineTo(centerX + half + wobble, y);
    ctx.stroke();
  }
}

function drawPoggendorffCut(ctx, width, height, params, palette, time) {
  const stripTotal = params.strips;
  const stripW = width * params.stripWidth;
  const stripGap = width / (stripTotal + 1);
  const tanA = Math.tan(params.angle);
  const drift = Math.sin(time * params.drift * 3.1) * height * 0.018;

  for (let s = 0; s < stripTotal; s += 1) {
    const stripX = stripGap * (s + 1) - stripW * 0.5;
    const stripCenter = stripX + stripW * 0.5;

    for (let i = 0; i < params.lineCount; i += 1) {
      const yBase = ((i + 0.5) / params.lineCount) * height + Math.sin(i * 1.24 + s) * height * params.jitter;
      const shift = ((i % 2 === 0 ? 1 : -1) * stripW * 0.22) + drift;

      const yLeftAtStrip = yBase + (stripX - stripCenter) * tanA;
      const yRightAtStrip = yBase + (stripX + stripW - stripCenter) * tanA + shift;

      const tone = cssTone(palette.accents[(i + s) % palette.accents.length], 0.78);
      ctx.strokeStyle = tone;
      ctx.lineWidth = Math.max(1.8, Math.min(width, height) * 0.003);

      ctx.beginPath();
      ctx.moveTo(0, yLeftAtStrip - stripX * tanA);
      ctx.lineTo(stripX, yLeftAtStrip);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(stripX + stripW, yRightAtStrip);
      ctx.lineTo(width, yRightAtStrip + (width - (stripX + stripW)) * tanA);
      ctx.stroke();
    }

    ctx.fillStyle = cssTone(toneShift(palette.bgB, 0, -12, -4), 0.96);
    ctx.fillRect(stripX, 0, stripW, height);
    ctx.strokeStyle = cssTone(toneShift(palette.ink, 0, -16, -6), 0.36);
    ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.0023);
    ctx.strokeRect(stripX, 0, stripW, height);
  }
}

function drawWhiteLightness(ctx, width, height, params, palette, time) {
  const span = Math.hypot(width, height);
  const stripeWidth = (span * 2.2) / params.stripeCount;
  const dark = cssTone(toneShift(palette.bgA, 0, -12, -14), 0.95);
  const light = cssTone(toneShift(palette.ink, 0, -24, 10), 0.9);
  const patchTone = cssTone(makeTone(palette.baseHue, 5, 56), 0.95);

  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(params.stripeAngle);
  ctx.translate(-width * 0.5, -height * 0.5);

  for (let i = -params.stripeCount; i <= params.stripeCount; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? dark : light;
    ctx.fillRect(width * 0.5 - span, i * stripeWidth, span * 2, stripeWidth + 1);
  }

  const patchW = Math.max(10, width * params.patchScale * 0.48);
  const patchH = Math.max(8, height * params.patchScale * 0.32);
  const rowGap = height / (params.patchRows + 1);
  const colGap = width * 0.18;
  const centerX = width * 0.5;

  for (let row = 0; row < params.patchRows; row += 1) {
    const y = rowGap * (row + 1) + Math.sin(row * 0.78 + time * params.drift * 2.7) * rowGap * params.jitter;
    for (let col = 0; col < params.patchCols; col += 1) {
      const centerOffset = (col - (params.patchCols - 1) * 0.5) * colGap;
      const phaseShift = (col % 2 === 0 ? 0 : stripeWidth * 0.5) + Math.cos(time * params.drift + row) * stripeWidth * 0.08;
      const x = centerX + centerOffset - patchW * 0.5;
      const yShifted = y + phaseShift;
      ctx.fillStyle = patchTone;
      ctx.fillRect(x, yShifted - patchH * 0.5, patchW, patchH);
      ctx.strokeStyle = cssTone(toneShift(palette.bgA, 0, -18, -20), 0.45);
      ctx.lineWidth = 1;
      ctx.strokeRect(x, yShifted - patchH * 0.5, patchW, patchH);
    }
  }

  ctx.restore();
}

function drawDelboeufRings(ctx, width, height, params, palette, time) {
  const groups = params.pairs;
  const rows = Math.max(1, Math.ceil(Math.sqrt(groups)));
  const cols = Math.max(1, Math.ceil(groups / rows));
  const cellW = width / cols;
  const cellH = height / rows;
  const minDim = Math.min(cellW, cellH);
  const inner = Math.min(params.innerRadius, minDim * 0.22);
  const separation = cellW * params.spacing;

  for (let g = 0; g < groups; g += 1) {
    const row = Math.floor(g / cols);
    const col = g % cols;
    const cx = col * cellW + cellW * 0.5;
    const cy = row * cellH + cellH * 0.52;
    const wobble = Math.sin(g * 0.8 + time * params.wobble * 3.2) * minDim * 0.025;
    const leftX = cx - separation;
    const rightX = cx + separation;

    const invert = g % 2 === 1;
    const outerLeft = inner * (invert ? params.outerScaleB : params.outerScaleA);
    const outerRight = inner * (invert ? params.outerScaleA : params.outerScaleB);

    ctx.fillStyle = cssTone(palette.ink, 0.88);
    ctx.beginPath();
    ctx.arc(leftX, cy + wobble, inner, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightX, cy - wobble, inner, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = cssTone(palette.accents[g % palette.accents.length], 0.78);
    ctx.lineWidth = Math.max(1.4, minDim * 0.015);
    ctx.beginPath();
    ctx.arc(leftX, cy + wobble, outerLeft, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightX, cy - wobble, outerRight, 0, TAU);
    ctx.stroke();
  }
}

function spawnOne(mode = "fresh") {
  const illusion = proposeBestCandidate(mode);
  registerDiscovery(illusion);
  state.currentId = illusion.id;
  updateInterface();
  persistState();
  return illusion;
}

function spawnBatch(count = 12) {
  const created = [];

  for (let i = 0; i < count; i += 1) {
    const mode = getCurrentIllusion() && Math.random() < 0.4 ? "evolve" : "fresh";
    created.push(proposeBestCandidate(mode));
  }

  created.sort((a, b) => b.objective - a.objective);

  for (const illusion of created) {
    registerDiscovery(illusion);
  }

  state.currentId = created[0]?.id || state.currentId;
  updateInterface();
  persistState();
}

function toggleAutoplay() {
  state.autoplay = !state.autoplay;
  state.lastAutoplayAt = 0;
  updateSessionStats();
  persistState();
}

function setMenuOpen(open) {
  state.menuOpen = open;
  sideMenuEl.classList.toggle("open", open);
  sideMenuEl.setAttribute("aria-hidden", String(!open));
  menuToggleBtn.setAttribute("aria-expanded", String(open));

  if (open) {
    if (state.appMode === APP_MODE_COMPOSER) {
      menuBackdrop.classList.remove("open");
      menuBackdrop.hidden = true;
      return;
    }
    menuBackdrop.hidden = false;
    requestAnimationFrame(() => {
      menuBackdrop.classList.add("open");
    });
    return;
  }

  menuBackdrop.classList.remove("open");
  window.setTimeout(() => {
    if (!state.menuOpen) {
      menuBackdrop.hidden = true;
    }
  }, 180);
}

function exportCurrentPng() {
  const current =
    state.appMode === APP_MODE_COMPOSER ? getCurrentCustomComposition() : getCurrentIllusion();
  if (!current) {
    return;
  }
  renderActiveScene(canvas, performance.now(), true);
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download =
    state.appMode === APP_MODE_COMPOSER
      ? `${(current.name || "custom-composition").trim().replace(/\s+/g, "-").toLowerCase()}.png`
      : `illusion-${shortSeed(current.seed).replace(/\.+/g, "-")}.png`;
  link.click();
}

function handleSwipeStart(event) {
  if (state.appMode === APP_MODE_COMPOSER || state.menuOpen || event.touches.length !== 1) {
    return;
  }
  const touch = event.touches[0];
  state.touchStart = {
    x: touch.clientX,
    y: touch.clientY,
    time: performance.now(),
  };
}

function handleSwipeEnd(event) {
  if (state.appMode === APP_MODE_COMPOSER || !state.touchStart || state.menuOpen) {
    state.touchStart = null;
    return;
  }
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - state.touchStart.x;
  const deltaY = touch.clientY - state.touchStart.y;
  const elapsed = performance.now() - state.touchStart.time;
  state.touchStart = null;

  if (elapsed > 700) {
    return;
  }
  if (Math.abs(deltaX) < SWIPE_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
    return;
  }

  if (deltaX < 0) {
    navigateNextOrNew();
    return;
  }
  navigateOlder();
}

function handleKeydown(event) {
  if (event.key === "Escape" && state.menuOpen) {
    setMenuOpen(false);
    return;
  }

  if (state.appMode === APP_MODE_COMPOSER) {
    return;
  }

  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement && activeElement.tagName === "INPUT" && activeElement.type === "range") {
    return;
  }

  event.preventDefault();
  if (event.key === "ArrowLeft") {
    navigateOlder();
    return;
  }
  navigateNextOrNew();
}

function startComposerMenuResize(event) {
  if (state.appMode !== APP_MODE_COMPOSER || window.innerWidth <= 860) {
    return;
  }

  event.preventDefault();
  const pointerId = event.pointerId;
  composerResizeHandleEl.setPointerCapture(pointerId);
  state.menuResizeSession = { pointerId };
  document.body.style.cursor = "ew-resize";
  document.body.style.userSelect = "none";
}

function handleComposerMenuResize(event) {
  if (!state.menuResizeSession || state.menuResizeSession.pointerId !== event.pointerId) {
    return;
  }

  const rect = sideMenuEl.getBoundingClientRect();
  state.composerMenuWidth = clampComposerMenuWidth(event.clientX - rect.left);
  applyMenuWidth();
}

function stopComposerMenuResize(event) {
  if (!state.menuResizeSession || state.menuResizeSession.pointerId !== event.pointerId) {
    return;
  }

  if (composerResizeHandleEl.hasPointerCapture(event.pointerId)) {
    composerResizeHandleEl.releasePointerCapture(event.pointerId);
  }
  state.menuResizeSession = null;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  persistState();
}

function bindEvents() {
  newBtn.addEventListener("click", () => spawnOne("fresh"));
  evolveBtn.addEventListener("click", () => spawnOne("evolve"));
  batchBtn.addEventListener("click", () => spawnBatch(12));
  autoplayBtn.addEventListener("click", toggleAutoplay);
  exportBtn.addEventListener("click", exportCurrentPng);
  shareBtn.addEventListener("click", () => {
    sharePayload(getCurrentSharePayload(), shareBtn);
  });

  saveBtn.addEventListener("click", toggleSave);
  prevBtn.addEventListener("click", navigateOlder);
  nextBtn.addEventListener("click", navigateNextOrNew);

  menuToggleBtn.addEventListener("click", () => setMenuOpen(!state.menuOpen));
  menuCloseBtn.addEventListener("click", () => setMenuOpen(false));
  menuBackdrop.addEventListener("click", () => setMenuOpen(false));
  composerResizeHandleEl.addEventListener("pointerdown", startComposerMenuResize);
  composerResizeHandleEl.addEventListener("pointermove", handleComposerMenuResize);
  composerResizeHandleEl.addEventListener("pointerup", stopComposerMenuResize);
  composerResizeHandleEl.addEventListener("pointercancel", stopComposerMenuResize);

  viewerEl.addEventListener("touchstart", handleSwipeStart, { passive: true });
  viewerEl.addEventListener("touchend", handleSwipeEnd, { passive: true });
  window.addEventListener("keydown", handleKeydown);
  generatorModeBtn.addEventListener("click", () => setAppMode(APP_MODE_GENERATOR));
  composerModeBtn.addEventListener("click", () => setAppMode(APP_MODE_COMPOSER));

  complexityRange.addEventListener("input", () => {
    state.options.complexity = Number(complexityRange.value);
    syncControlReadouts();
    persistState();
  });

  motionRange.addEventListener("input", () => {
    state.options.motion = Number(motionRange.value);
    const current = getCurrentIllusion();
    if (current) {
      current.motionStrength = state.options.motion / 10;
      current.feature = buildFeatureVector(current);
      current.compositeScore = computeCompositeScore(current);
    }
    syncControlReadouts();
    updateInterface();
    persistState();
  });

  noveltyRange.addEventListener("input", () => {
    state.options.noveltyBias = Number(noveltyRange.value) / 100;
    syncControlReadouts();
    persistState();
  });

  researchListEl.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }
    setPrincipleEnabled(target.dataset.principleId, target.checked);
  });

  customNameInput.addEventListener("input", () => {
    updateCurrentCustom((current) => {
      current.name = customNameInput.value.slice(0, 48);
    }, { syncControls: false, renderLayers: false });
    setCustomStatus("Name updated.");
  });

  customBackgroundInput.addEventListener("input", () => {
    updateCurrentCustom((current) => {
      current.backgroundColor = customBackgroundInput.value;
    }, { syncControls: false, renderLayers: false });
    setCustomStatus("Background color updated.");
  });

  customSchemeSelect.addEventListener("change", () => {
    updateCurrentCustom((current) => {
      current.schemeId = customSchemeSelect.value;
    }, { syncControls: false, renderLayers: false });
    setCustomStatus("Overall color scheme updated.");
  });

  customNewBtn.addEventListener("click", createNewCustomDraft);
  customSaveBtn.addEventListener("click", saveCurrentCustomComposition);
  customShareBtn.addEventListener("click", () => {
    sharePayload(getCurrentSharePayload(), customShareBtn, "Share link copied for this composition.");
  });

  elementPickerEl.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-add-element]") : null;
    if (!button) {
      return;
    }

    updateCurrentCustom((current) => {
      current.layers.push(makeCustomLayer(button.dataset.addElement));
    });
    setCustomStatus("Added a new top layer.");
  });

  savedCustomListEl.addEventListener("click", (event) => {
    const shareButton = event.target instanceof Element ? event.target.closest("[data-share-custom]") : null;
    if (shareButton) {
      const custom = state.customCompositions.find((item) => item.id === shareButton.dataset.shareCustom);
      if (custom) {
        const shared = cloneJson(custom);
        shared.id = null;
        sharePayload(
          {
            version: 1,
            mode: APP_MODE_COMPOSER,
            item: shared,
          },
          shareButton,
          `Share link copied for ${custom.name}.`
        );
      }
      return;
    }

    const button = event.target instanceof Element ? event.target.closest("[data-load-custom]") : null;
    if (!button) {
      return;
    }
    loadCustomComposition(button.dataset.loadCustom);
  });

  layerListEl.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-remove-layer]") : null;
    if (!button) {
      return;
    }

    updateCurrentCustom((current) => {
      current.layers = current.layers.filter((layer) => layer.id !== button.dataset.removeLayer);
    });
    setCustomStatus("Layer removed.");
  });

  layerListEl.addEventListener("input", handleLayerEditorInput);
  layerListEl.addEventListener("change", handleLayerEditorInput);

  window.addEventListener("resize", () => {
    applyMenuWidth();
    resizeCanvas();
    resizeComposerPreviewCanvas();
  });
}

function runAnimation(now) {
  const currentIllusion = getCurrentIllusion();

  if (now - state.frameGate >= 30) {
    state.frameGate = now;
    renderActiveScene(canvas, now, false);
    if (state.appMode === APP_MODE_COMPOSER && composerPreviewCanvas && !composerPanelEl.hidden) {
      renderCustomComposition(getCurrentCustomComposition(), composerPreviewCanvas, now, false);
    }
  }

  if (state.appMode === APP_MODE_GENERATOR && state.autoplay) {
    if (!state.lastAutoplayAt) {
      state.lastAutoplayAt = now;
    }

    if (now - state.lastAutoplayAt > 2600) {
      state.lastAutoplayAt = now;
      const mode = currentIllusion && Math.random() < 0.55 ? "evolve" : "fresh";
      spawnOne(mode);
    }
  }

  requestAnimationFrame(runAnimation);
}

function bootstrap() {
  restoreState();
  hydrateFromShareLink();
  renderResearchList();
  renderElementPicker();
  renderSavedCustomList();
  renderLayerList();

  complexityRange.value = String(state.options.complexity);
  motionRange.value = String(state.options.motion);
  noveltyRange.value = String(Math.round(state.options.noveltyBias * 100));
  syncControlReadouts();
  syncCustomControls();

  resizeCanvas();
  bindEvents();
  setMenuOpen(false);
  setAppMode(state.appMode);

  if (!state.discoveries.length) {
    spawnBatch(14);
  } else {
    state.archiveVectors = state.discoveries.map((item) => ({
      id: item.id,
      vector: item.feature,
    }));
    if (!state.currentId || !state.discoveries.some((item) => item.id === state.currentId)) {
      state.currentId = state.discoveries[0].id;
    }
    updateInterface();
  }

  if (!state.customDraft) {
    state.customDraft = makeEmptyCustomComposition();
    syncCustomControls();
    renderLayerList();
  }

  resizeComposerPreviewCanvas();

  requestAnimationFrame(runAnimation);
}

bootstrap();
