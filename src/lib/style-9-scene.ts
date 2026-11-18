// «الأسطرلاب»: five porcelain and brass rings around the real watch photo for
// the /9 home exploration. Each ring stands for one feature; scroll (or a
// feature button) turns them, one by one, from a loose armillary into a flat
// astrolabe plate, and a brass rule then swings to the Qibla.
//
// The photo stays in HTML between two canvases. The scene is rendered twice
// per frame with a clipping plane through the photo: the half behind it goes
// to the back canvas, the half in front to the front canvas. Loaded with
// import() only after the page has checked WebGL, reduced motion and
// visibility, so three.js never blocks first paint.
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  Plane,
  PMREMGenerator,
  Quaternion,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Material } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** One ring, as the page describes it (degrees, scene units). */
interface RingSpec {
  /** Ring radius; the canvas spans ±SCENE_HALF. */
  radius: number;
  /** Tilt about the in-plane axis while loose, degrees. */
  tilt: number;
  /** Direction of that axis in the screen plane, degrees from +x. */
  axis: number;
  /** Index drawn on the ring (Arabic-Indic digit). */
  label: string;
  brass: boolean;
  /** Fine degree ticks: the main dial ring. */
  ticks: boolean;
}

export interface AstrolabeOptions {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  container: HTMLElement;
  /** JSON array of RingSpec, straight from a data attribute. */
  rings: string;
  /** Degrees clockwise from north (screen up). */
  qiblaBearing: number;
  /** Starting progress, so a reload mid-page doesn't replay the sequence. */
  progress: number;
}

export interface Astrolabe {
  /** 0 = all rings loose, n = ring n-1 aligned; the rule swings near the end. */
  setProgress: (progress: number) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

const DEG = Math.PI / 180;
const HALF_PI = Math.PI / 2;
const TAU = Math.PI * 2;

/** Half the canvas edge in scene units. The page's SVG fallback matches it. */
const SCENE_HALF = 1.15;
const FOV = 20;
const MAX_PIXEL_RATIO = 1.75;

// Rings.
const TUBE = 0.0085;
const MAIN_TUBE = 0.0125;
const TUBE_SEGMENTS = 10;
const RING_SEGMENTS = 200;

/** Aligned rings rest just behind the photo, so the strap crosses over them. */
const FLAT_DEPTH = -0.03;

// Ring indices: all sit on one radius of the finished plate, upper left.
const LABEL_ANGLE = 128 * DEG;
const LABEL_GAP = 0.042;
const LABEL_PX = 19;
const LABEL_TEXTURE = 96;
const LABEL_FONT = '600 64px "IBM Plex Sans Arabic", system-ui, sans-serif';

// Degree ticks on the main ring.
const TICK_COUNT = 72;
const TICK_INSET = 0.016;
const TICK_SHORT = 0.022;
const TICK_LONG = 0.044;
const TICK_NORTH = 0.064;
const TICKS_PER_HOUR = 6;

// The Qibla rule.
const RULE_INNER = 0.66;
const RULE_OUTER = 1.03;
const RULE_TIP = 0.075;
const RULE_DEPTH = 0.035;

/** The rule fades in and swings over this much progress at the end. */
const RULE_SPAN = 0.65;

// Motion: slow, eased, never springy.
const PROGRESS_RESPONSE = 1.8;
const HIGHLIGHT_RESPONSE = 3;
const TILT_RESPONSE = 2.2;
const POINTER_TILT = 0.07;
const SWAY = 0.1;
const SWAY_PERIODS = [47, 59, 41, 53, 67] as const;
const DEFAULT_SWAY_PERIOD = 50;

const COLORS = {
  brass: "#c2a06c",
  celadon: "#9fc4b2",
  ink: "#56625b",
  pine: "#285a47",
  porcelain: "#e4e1d8",
  tick: "#8a6a3a",
} as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const isRingSpec = (value: unknown): value is RingSpec =>
  typeof value === "object" &&
  value !== null &&
  "radius" in value &&
  typeof value.radius === "number" &&
  "tilt" in value &&
  typeof value.tilt === "number" &&
  "axis" in value &&
  typeof value.axis === "number" &&
  "label" in value &&
  typeof value.label === "string" &&
  "brass" in value &&
  typeof value.brass === "boolean" &&
  "ticks" in value &&
  typeof value.ticks === "boolean";

const parseRings = (json: string): RingSpec[] => {
  const data: unknown = JSON.parse(json);

  if (!Array.isArray(data)) {
    throw new TypeError("The astrolabe needs an array of rings.");
  }

  const rings: unknown[] = data;

  return rings.filter(isRingSpec);
};

// ---------- Materials ----------

interface Materials {
  brass: MeshPhysicalMaterial;
  rule: MeshPhysicalMaterial;
  /** Engraved-looking ticks: darker, satin, so they don't mirror the white room. */
  tick: MeshPhysicalMaterial;
}

const porcelain = (): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({
    clearcoat: 0.45,
    clearcoatRoughness: 0.32,
    color: COLORS.porcelain,
    metalness: 0,
    roughness: 0.6,
  });

const brushedBrass = (): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({
    anisotropy: 0.6,
    color: COLORS.brass,
    metalness: 1,
    roughness: 0.4,
  });

const createMaterials = (): Materials => {
  const rule = brushedBrass();
  rule.transparent = true;
  rule.opacity = 0;

  const tick = new MeshPhysicalMaterial({
    color: COLORS.tick,
    metalness: 0.5,
    roughness: 0.55,
  });

  return { brass: brushedBrass(), rule, tick };
};

const drawLabel = (text: string): CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_TEXTURE;
  canvas.height = LABEL_TEXTURE;
  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "#ffffff";
    context.font = LABEL_FONT;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, LABEL_TEXTURE / 2, LABEL_TEXTURE / 2);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  return texture;
};

// ---------- Geometry ----------

/** Radial degree ticks just inside the ring, in its own plane. */
const buildTicks = (radius: number, material: Material): InstancedMesh => {
  const ticks = new InstancedMesh(
    new BoxGeometry(0.0042, 1, 0.004),
    material,
    TICK_COUNT
  );

  const holder = new Object3D();
  const outer = radius - TICK_INSET;

  for (let index = 0; index < TICK_COUNT; index += 1) {
    const angle = HALF_PI - (index / TICK_COUNT) * TAU;
    const isNorth = index === 0;
    const isHour = index % TICKS_PER_HOUR === 0;

    let length = TICK_SHORT;

    if (isNorth) {
      length = TICK_NORTH;
    } else if (isHour) {
      length = TICK_LONG;
    }

    const middle = outer - length / 2;
    holder.position.set(Math.cos(angle) * middle, Math.sin(angle) * middle, 0);
    holder.rotation.set(0, 0, angle - HALF_PI);
    holder.scale.set(isNorth ? 1.6 : 1, length, 1);
    holder.updateMatrix();
    ticks.setMatrixAt(index, holder.matrix);
  }

  return ticks;
};

/** A thin brass rule with a lozenge tip, pointing north until it swings. */
const buildRule = (material: Material): Group => {
  const rule = new Group();
  rule.position.z = RULE_DEPTH;

  const length = RULE_OUTER - RULE_INNER;
  const barGeometry = new BoxGeometry(0.0075, length, 0.005);
  barGeometry.translate(0, RULE_INNER + length / 2, 0);

  const tipGeometry = new CylinderGeometry(0, 0.026, RULE_TIP, 4);
  tipGeometry.translate(0, RULE_OUTER + RULE_TIP / 2, 0);
  const tip = new Mesh(tipGeometry, material);
  tip.scale.z = 0.35;

  rule.add(new Mesh(barGeometry, material), tip);

  return rule;
};

interface Rig {
  pivot: Group;
  /** Loose orientation: Rz(axis) · Rx(tilt). */
  rest: Quaternion;
  material: MeshPhysicalMaterial;
  base: Color;
  accent: Color;
  label: SpriteMaterial;
  sprite: Sprite;
  swayRate: number;
  highlight: number;
}

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

const buildRig = (spec: RingSpec, index: number, materials: Materials): Rig => {
  const pivot = new Group();

  const material = spec.brass ? materials.brass.clone() : porcelain();
  const tube = spec.ticks ? MAIN_TUBE : TUBE;

  pivot.add(
    new Mesh(
      new TorusGeometry(spec.radius, tube, TUBE_SEGMENTS, RING_SEGMENTS),
      material
    )
  );

  if (spec.ticks) {
    pivot.add(buildTicks(spec.radius, materials.tick));
  }

  // Indices read over any ring they happen to sit behind.
  const label = new SpriteMaterial({
    color: COLORS.ink,
    depthTest: false,
    depthWrite: false,
    map: drawLabel(spec.label),
    toneMapped: false,
    transparent: true,
  });

  const sprite = new Sprite(label);
  sprite.renderOrder = 1;
  const labelRadius = spec.radius + LABEL_GAP;
  sprite.position.set(
    Math.cos(LABEL_ANGLE) * labelRadius,
    Math.sin(LABEL_ANGLE) * labelRadius,
    0
  );
  pivot.add(sprite);

  const rest = new Quaternion()
    .setFromAxisAngle(Z_AXIS, spec.axis * DEG)
    .multiply(new Quaternion().setFromAxisAngle(X_AXIS, spec.tilt * DEG));

  pivot.quaternion.copy(rest);

  const base = material.color.clone();
  const accent = new Color(spec.brass ? "#d8bb88" : COLORS.celadon);
  const period = SWAY_PERIODS.at(index) ?? DEFAULT_SWAY_PERIOD;

  return {
    accent,
    base,
    highlight: 0,
    label,
    material,
    pivot,
    rest,
    sprite,
    swayRate: TAU / period,
  };
};

type Layer = "back" | "front";

interface Output {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Hand the frame just rendered to one of the two visible canvases. */
  present: (layer: Layer) => void;
  /** Match the visible canvases to the render size. */
  fit: () => void;
}

/**
 * One WebGL context feeds both canvases. Preferred: render offscreen and
 * transfer each pass as an ImageBitmap (zero-copy). Fallback: render into
 * the back canvas and copy the front pass into a 2D canvas first.
 */
const createOutput = (
  back: HTMLCanvasElement,
  front: HTMLCanvasElement
): Output => {
  if ("OffscreenCanvas" in globalThis) {
    const backBitmap = back.getContext("bitmaprenderer");
    const frontBitmap = front.getContext("bitmaprenderer");

    if (backBitmap && frontBitmap) {
      const offscreen = new OffscreenCanvas(1, 1);

      return {
        canvas: offscreen,
        fit: () => {
          for (const canvas of [back, front]) {
            canvas.width = offscreen.width;
            canvas.height = offscreen.height;
          }
        },
        present: (layer) => {
          const target = layer === "front" ? frontBitmap : backBitmap;
          target.transferFromImageBitmap(offscreen.transferToImageBitmap());
        },
      };
    }
  }

  const frontContext = front.getContext("2d");

  if (!frontContext) {
    throw new Error("The astrolabe needs a 2D context for its front layer.");
  }

  return {
    canvas: back,
    fit: () => {
      front.width = back.width;
      front.height = back.height;
    },
    present: (layer) => {
      if (layer === "front") {
        frontContext.clearRect(0, 0, front.width, front.height);
        frontContext.drawImage(back, 0, 0);
      }
    },
  };
};

const disposeScene = (scene: Scene): void => {
  const materials = new Set<Material>();

  scene.traverse((object) => {
    if (object instanceof Sprite) {
      const material: unknown = object.material;

      if (material instanceof SpriteMaterial) {
        material.map?.dispose();
        materials.add(material);
      }

      return;
    }

    if (!(object instanceof Mesh)) {
      return;
    }

    const geometry: unknown = object.geometry;

    if (geometry instanceof BufferGeometry) {
      geometry.dispose();
    }

    const material: unknown = object.material;

    if (material instanceof MeshPhysicalMaterial) {
      materials.add(material);
    }
  });

  for (const material of materials) {
    material.dispose();
  }
};

// ---------- Public API ----------

export const createAstrolabe = async (
  options: AstrolabeOptions
): Promise<Astrolabe> => {
  const { back, front, container, qiblaBearing } = options;
  const specs = parseRings(options.rings);

  if (specs.length === 0) {
    throw new Error("The astrolabe needs at least one ring.");
  }

  // The ring indices are drawn with the page font; wait for it once.
  await document.fonts.load(LABEL_FONT, specs.map((s) => s.label).join(""));

  const output = createOutput(back, front);

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas: output.canvas,
    powerPreference: "low-power",
  });

  renderer.setClearColor(0x00_00_00, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = SRGBColorSpace;

  // Soft white studio light: a room environment and one high key light.
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environment = envMap;
  scene.environmentIntensity = 0.75;

  const key = new DirectionalLight("#ffffff", 1.3);
  key.position.set(-2, 4, 5);
  scene.add(key);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);

  const materials = createMaterials();
  const root = new Group();
  const rigs = specs.map((spec, index) => buildRig(spec, index, materials));

  for (const rig of rigs) {
    root.add(rig.pivot);
  }

  const rule = buildRule(materials.rule);
  rule.visible = false;
  root.add(rule);
  scene.add(root);

  const count = rigs.length;
  let target = clamp(options.progress, 0, count);
  let current = target;

  const pine = new Color(COLORS.pine);
  const muted = new Color(COLORS.ink);
  const identity = new Quaternion();
  const sway = new Quaternion();
  const loose = new Quaternion();

  // Planes through the photo, turned with the parallax tilt.
  const frontPlane = new Plane(new Vector3(0, 0, 1), 0);
  const backPlane = new Plane(new Vector3(0, 0, -1), 0);

  const pointerTarget = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") {
      return;
    }

    const rect = container.getBoundingClientRect();
    const nx = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
    const ny = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
    pointerTarget.x = clamp(nx, -1, 1);
    pointerTarget.y = clamp(ny, -1, 1);
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });

  const resize = (): void => {
    const { clientWidth, clientHeight } = container;

    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }

    renderer.setSize(clientWidth, clientHeight, false);
    output.fit();

    camera.aspect = clientWidth / clientHeight;
    const halfHeight = SCENE_HALF / Math.min(1, camera.aspect);
    camera.position.set(0, 0, halfHeight / Math.tan((FOV / 2) * DEG));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    // Ring indices stay the same size on screen at any canvas size.
    const unitsPerPixel = (halfHeight * 2) / clientHeight;

    for (const rig of rigs) {
      rig.sprite.scale.setScalar(LABEL_PX * unitsPerPixel);
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const draw = (): void => {
    frontPlane.normal.copy(Z_AXIS).applyQuaternion(root.quaternion);
    backPlane.normal.copy(frontPlane.normal).negate();

    // Front half first; hand it off before the back half reuses the buffer.
    renderer.clippingPlanes = [frontPlane];
    renderer.render(scene, camera);
    output.present("front");

    renderer.clippingPlanes = [backPlane];
    renderer.render(scene, camera);
    output.present("back");
  };

  let last = performance.now();
  let elapsed = 0;

  const update = (delta: number): void => {
    current += (target - current) * (1 - Math.exp(-delta * PROGRESS_RESPONSE));

    const tiltEase = 1 - Math.exp(-delta * TILT_RESPONSE);
    pointer.x += (pointerTarget.x - pointer.x) * tiltEase;
    pointer.y += (pointerTarget.y - pointer.y) * tiltEase;
    root.rotation.set(pointer.y * POINTER_TILT, pointer.x * POINTER_TILT, 0);

    const active = clamp(Math.ceil(target) - 1, 0, count - 1);
    const highlightEase = 1 - Math.exp(-delta * HIGHLIGHT_RESPONSE);

    for (const [index, rig] of rigs.entries()) {
      const aligned = easeInOut(clamp(current - index, 0, 1));
      const swing = SWAY * Math.sin(elapsed * rig.swayRate) * (1 - aligned);

      sway.setFromAxisAngle(Y_AXIS, swing);
      loose.multiplyQuaternions(sway, rig.rest);
      rig.pivot.quaternion.slerpQuaternions(loose, identity, aligned);
      rig.pivot.position.z = FLAT_DEPTH * aligned;

      rig.highlight +=
        (Number(index === active) - rig.highlight) * highlightEase;
      rig.material.color.copy(rig.base).lerp(rig.accent, rig.highlight * 0.6);
      rig.label.color.copy(muted).lerp(pine, rig.highlight);
    }

    // The rule fades in at north, then swings clockwise to the Qibla.
    const reveal = clamp((current - (count - RULE_SPAN)) / RULE_SPAN, 0, 1);
    rule.visible = reveal > 0.001;
    materials.rule.opacity = clamp(reveal * 3, 0, 1);
    rule.rotation.z = -qiblaBearing * DEG * easeInOut(reveal);
  };

  const frame = (time: number): void => {
    // rAF time can trail performance.now() on the first frame; never go back.
    const delta = clamp((time - last) / 1000, 0, 0.1);
    last = time;
    elapsed += delta;
    update(delta);
    draw();
  };

  // First frame right away so the canvases never fade in empty.
  update(0);
  draw();

  let running = false;

  const start = (): void => {
    if (running) {
      return;
    }

    running = true;
    last = performance.now();
    renderer.setAnimationLoop(frame);
  };

  const stop = (): void => {
    running = false;
    renderer.setAnimationLoop(null);
  };

  const setProgress = (progress: number): void => {
    target = clamp(progress, 0, count);
  };

  const dispose = (): void => {
    stop();
    window.removeEventListener("pointermove", onPointerMove);
    resizeObserver.disconnect();
    disposeScene(scene);
    // The brass template is only ever cloned, so no mesh holds it.
    materials.brass.dispose();
    envMap.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { dispose, setProgress, start, stop };
};
