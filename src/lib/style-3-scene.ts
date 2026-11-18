// «البلّورة»: an abstract watch crystal for the /3 home exploration. A brass
// bezel, a floating glass lens with hour markers and an 8-point khatam, and a
// needle that swings to the Qibla. Loaded with import() only after the page
// has checked WebGL, reduced motion and visibility, so three.js never blocks
// first paint. Scroll sets the pose; the pointer adds a little parallax.
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
} from "three";
import type { Material } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export interface Crystal {
  /** Fractional index into the pose list given to createCrystal. */
  setPose: (pose: number) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

interface Pose {
  /** Tilt toward/away from the viewer, radians. */
  rx: number;
  /** Turn left/right, radians. */
  ry: number;
  /** Spin in the dial plane, radians. */
  rz: number;
  /** Needle bearing, degrees clockwise from 12 o'clock (north). */
  needle: number;
}

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const QUARTER_PI = Math.PI / 4;
const DEG = Math.PI / 180;
const MAX_PIXEL_RATIO = 2;

/** Great-circle bearing from Amman to the Kaaba, degrees from north. */
const QIBLA_BEARING = 161;

const HERO_POSE: Pose = { needle: 0, rx: -0.34, ry: 0.46, rz: 0.04 };

// One pose per page section; the page passes the section names in order.
const POSES = {
  azan: { needle: -58, rx: -0.16, ry: -0.62, rz: -0.18 },
  calendar: { needle: QIBLA_BEARING, rx: -0.12, ry: 1.18, rz: 0.08 },
  hero: HERO_POSE,
  qibla: { needle: QIBLA_BEARING, rx: -1.02, ry: 0.02, rz: 0 },
  shield: { needle: 30, rx: 0.22, ry: -0.36, rz: 0 },
  truck: { needle: 300, rx: -0.42, ry: 0.38, rz: -TAU + 0.04 },
} as const satisfies Record<string, Pose>;

type PoseName = keyof typeof POSES;

const isPoseName = (name: string): name is PoseName =>
  Object.hasOwn(POSES, name);

const COLORS = {
  brass: "#dcc496",
  brassDeep: "#b89a62",
  glassTint: "#d9ece6",
  tile: "#1f5c57",
  white: "#ffffff",
} as const;

// Scene units: the bezel's outer radius is 1.2.
const BEZEL_INNER = 0.985;
const BEZEL_OUTER = 1.2;
const BEZEL_DEPTH = 0.13;
const BEZEL_ROUND = 0.045;
const CORNER_STEPS = 8;
const LENS_RADIUS = 0.975;
const LENS_EDGE = 0.045;
const LENS_DOME = 0.085;
const LENS_STEPS = 18;
const FACE_Z = 0.075;
const MARKER_RADIUS = 0.86;
const HOURS = 12;
const KHATAM_HALF = 0.3;
const KHATAM_BAR = 0.014;
const SEGMENTS = 128;

// Motion.
const POSE_RESPONSE = 3.2;
const TILT_RESPONSE = 3;
const POINTER_TILT = 0.2;
const FLOAT_SPEED = 0.8;
const FLOAT_AMPLITUDE = 0.035;
const NEEDLE_RESPONSE = 2.4;

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shortest-way interpolation between two bearings in degrees. */
const lerpBearing = (from: number, to: number, t: number): number => {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;

  return from + delta * t;
};

const resolvePose = (sequence: readonly Pose[], value: number): Pose => {
  const last = Math.max(0, sequence.length - 1);
  const clamped = Math.max(0, Math.min(last, value));
  const index = Math.min(Math.floor(clamped), Math.max(0, last - 1));
  const from = sequence.at(index) ?? HERO_POSE;
  const to = sequence.at(index + 1) ?? from;
  const t = smoothstep(Math.min(1, clamped - index));

  return {
    needle: lerpBearing(from.needle, to.needle, t),
    rx: lerp(from.rx, to.rx, t),
    ry: lerp(from.ry, to.ry, t),
    rz: lerp(from.rz, to.rz, t),
  };
};

// ---------- Geometry ----------

/** Rounded-rectangle cross-section (radius, depth), swept into a ring. */
const bezelProfile = (): Vector2[] => {
  const outer = BEZEL_OUTER - BEZEL_ROUND;
  const inner = BEZEL_INNER + BEZEL_ROUND;
  const front = BEZEL_DEPTH - BEZEL_ROUND;

  const corners = [
    { cx: outer, cy: -front, start: -HALF_PI },
    { cx: outer, cy: front, start: 0 },
    { cx: inner, cy: front, start: HALF_PI },
    { cx: inner, cy: -front, start: Math.PI },
  ];

  const points: Vector2[] = [];

  for (const corner of corners) {
    for (let step = 0; step <= CORNER_STEPS; step += 1) {
      const angle = corner.start + (step / CORNER_STEPS) * HALF_PI;
      points.push(
        new Vector2(
          corner.cx + Math.cos(angle) * BEZEL_ROUND,
          corner.cy + Math.sin(angle) * BEZEL_ROUND
        )
      );
    }
  }

  // Close the loop where it started.
  points.push(new Vector2(outer, -BEZEL_DEPTH));

  return points;
};

/** A double-domed lens: thin at the rim, fuller in the middle. */
const lensProfile = (): Vector2[] => {
  const top: Vector2[] = [];

  for (let step = LENS_STEPS; step >= 0; step -= 1) {
    const r = (step / LENS_STEPS) * LENS_RADIUS;
    const dome = LENS_EDGE + LENS_DOME * (1 - (r / LENS_RADIUS) ** 2);
    top.push(new Vector2(r, dome));
  }

  // Lathe wants the profile from bottom centre, round the rim, to top centre.
  const bottom = top
    .map((point) => new Vector2(point.x, -point.y))
    .toReversed();

  return [...bottom, ...top];
};

const drawContactShadow = (): CanvasTexture => {
  const size = 256;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(
      half,
      half,
      0,
      half,
      half,
      half
    );

    gradient.addColorStop(0, "rgba(46, 36, 20, 0.42)");
    gradient.addColorStop(0.4, "rgba(46, 36, 20, 0.16)");
    gradient.addColorStop(1, "rgba(46, 36, 20, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  return texture;
};

interface Materials {
  brass: MeshPhysicalMaterial;
  brassSatin: MeshPhysicalMaterial;
  enamel: MeshPhysicalMaterial;
  frost: MeshPhysicalMaterial;
  glass: MeshPhysicalMaterial;
}

const createMaterials = (): Materials => ({
  brass: new MeshPhysicalMaterial({
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    color: COLORS.brass,
    metalness: 1,
    roughness: 0.24,
  }),
  brassSatin: new MeshPhysicalMaterial({
    color: COLORS.brassDeep,
    metalness: 1,
    roughness: 0.32,
  }),
  enamel: new MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    color: COLORS.tile,
    metalness: 0,
    roughness: 0.3,
  }),
  frost: new MeshPhysicalMaterial({
    color: COLORS.white,
    metalness: 0,
    opacity: 0.55,
    roughness: 0.6,
    transparent: true,
  }),
  glass: new MeshPhysicalMaterial({
    attenuationColor: new Color(COLORS.glassTint),
    attenuationDistance: 0.9,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    color: COLORS.white,
    ior: 1.52,
    metalness: 0,
    roughness: 0.03,
    specularIntensity: 1,
    thickness: 0.32,
    transmission: 1,
  }),
});

/** Bezel ring, chapter ring and crown. */
const buildCase = (materials: Materials): Group => {
  const group = new Group();

  // Swept around Y, then turned so the ring's axis faces the camera.
  const bezel = new LatheGeometry(bezelProfile(), SEGMENTS);
  bezel.rotateX(HALF_PI);
  group.add(new Mesh(bezel, materials.brass));

  const chapter = new Mesh(
    new TorusGeometry(0.935, 0.006, 8, SEGMENTS),
    materials.brassSatin
  );

  chapter.position.z = FACE_Z;
  group.add(chapter);

  // Crown at three o'clock, so every turn of the object reads.
  const crownGeometry = new CylinderGeometry(0.07, 0.07, 0.12, 32);
  crownGeometry.rotateZ(HALF_PI);
  const crown = new Mesh(crownGeometry, materials.brass);
  crown.position.x = BEZEL_OUTER + 0.05;
  group.add(crown);

  return group;
};

/** Twelve hour markers on the lens; twelve o'clock is green enamel. */
const buildMarkers = (materials: Materials): Group => {
  const group = new Group();

  const markers = new InstancedMesh(
    new BoxGeometry(0.026, 0.13, 0.018),
    materials.brass,
    HOURS - 1
  );

  const holder = new Object3D();

  for (let hour = 1; hour < HOURS; hour += 1) {
    const angle = (hour / HOURS) * TAU;
    holder.position.set(
      Math.sin(angle) * MARKER_RADIUS,
      Math.cos(angle) * MARKER_RADIUS,
      FACE_Z
    );
    holder.rotation.set(0, 0, -angle);
    holder.updateMatrix();
    markers.setMatrixAt(hour - 1, holder.matrix);
  }

  group.add(markers);

  const northGeometry = new CylinderGeometry(0.05, 0.05, 0.022, 4);
  northGeometry.rotateX(HALF_PI);
  const north = new Mesh(northGeometry, materials.enamel);
  north.scale.set(0.75, 1.6, 1);
  north.position.set(0, MARKER_RADIUS - 0.01, FACE_Z);
  group.add(north);

  return group;
};

/** The khatam: two interlaced squares, frosted plates edged in brass. */
const buildKhatam = (materials: Materials): Group => {
  const group = new Group();
  const side = KHATAM_HALF * 2;

  const edges = new InstancedMesh(
    new BoxGeometry(side + KHATAM_BAR, KHATAM_BAR, 0.012),
    materials.brassSatin,
    8
  );

  const holder = new Object3D();
  let slot = 0;

  for (const square of [0, QUARTER_PI]) {
    const plate = new Mesh(new BoxGeometry(side, side, 0.004), materials.frost);
    plate.rotation.z = square;
    plate.position.z = FACE_Z - 0.004;
    group.add(plate);

    for (let edge = 0; edge < 4; edge += 1) {
      const angle = square + edge * HALF_PI;
      holder.position.set(
        Math.sin(angle) * KHATAM_HALF,
        Math.cos(angle) * KHATAM_HALF,
        FACE_Z
      );
      holder.rotation.set(0, 0, -angle);
      holder.updateMatrix();
      edges.setMatrixAt(slot, holder.matrix);
      slot += 1;
    }
  }

  group.add(edges);

  return group;
};

/** The Qibla needle: green enamel point, brass tail, brass cap. */
const buildNeedle = (materials: Materials): Group => {
  const needle = new Group();
  needle.position.z = FACE_Z + 0.05;

  // Four-sided cones read as a faceted, polished lozenge.
  const pointGeometry = new CylinderGeometry(0, 0.036, 0.72, 4);
  pointGeometry.translate(0, 0.36, 0);
  const point = new Mesh(pointGeometry, materials.enamel);
  point.scale.z = 0.4;

  const tailGeometry = new CylinderGeometry(0.03, 0, 0.3, 4);
  tailGeometry.translate(0, -0.15, 0);
  const tail = new Mesh(tailGeometry, materials.brass);
  tail.scale.z = 0.4;

  const cap = new Mesh(new SphereGeometry(0.048, 32, 16), materials.brass);
  cap.scale.z = 0.5;
  cap.position.z = 0.01;

  needle.add(point, tail, cap);

  return needle;
};

interface Build {
  root: Group;
  needle: Group;
}

const buildCrystal = (): Build => {
  const materials = createMaterials();
  const root = new Group();

  const lens = new LatheGeometry(lensProfile(), SEGMENTS);
  lens.rotateX(HALF_PI);

  const needle = buildNeedle(materials);

  root.add(
    buildCase(materials),
    new Mesh(lens, materials.glass),
    buildMarkers(materials),
    buildKhatam(materials),
    needle
  );

  return { needle, root };
};

const disposeScene = (scene: Scene): void => {
  const materials = new Set<Material>();

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const geometry: unknown = object.geometry;

    if (geometry instanceof BufferGeometry) {
      geometry.dispose();
    }

    const list: unknown[] = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of list) {
      if (material instanceof MeshBasicMaterial) {
        material.map?.dispose();
      }

      if (
        material instanceof MeshBasicMaterial ||
        material instanceof MeshPhysicalMaterial
      ) {
        materials.add(material);
      }
    }
  });

  for (const material of materials) {
    material.dispose();
  }
};

// ---------- Public API ----------

export const createCrystal = (
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  poseNames: readonly string[]
): Crystal => {
  const renderer = new WebGLRenderer({
    antialias: true,
    canvas,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;

  // An opaque white stage: the glass refracts the gallery wall, never black.
  const scene = new Scene();
  scene.background = new Color(COLORS.white);
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.03).texture;
  room.dispose();
  scene.environment = envMap;
  scene.environmentIntensity = 1.25;

  const key = new DirectionalLight("#fff4e0", 2.2);
  key.position.set(-3, 5, 4);
  const fillLight = new DirectionalLight("#ffffff", 0.9);
  fillLight.position.set(4, 1, 3);
  const sky = new HemisphereLight("#ffffff", "#e9e2d4", 0.6);
  scene.add(key, fillLight, sky);

  const shadowMaterial = new MeshBasicMaterial({
    depthWrite: false,
    map: drawContactShadow(),
    toneMapped: false,
    transparent: true,
  });

  const shadow = new Mesh(new PlaneGeometry(3, 3), shadowMaterial);
  shadow.rotation.x = -HALF_PI;
  shadow.position.y = -1.62;
  scene.add(shadow);

  const camera = new PerspectiveCamera(30, 1, 0.1, 50);

  const crystal = buildCrystal();
  const tilt = new Group();
  const spin = new Group();
  spin.add(crystal.root);
  tilt.add(spin);
  scene.add(tilt);

  const sequence: Pose[] = poseNames.map((name) =>
    isPoseName(name) ? POSES[name] : HERO_POSE
  );

  let targetPose = 0;
  let currentPose = 0;
  let needleBearing = 0;

  const pointerTarget = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") {
      return;
    }

    const rect = container.getBoundingClientRect();

    const nx =
      (event.clientX - (rect.left + rect.width / 2)) / window.innerWidth;

    const ny =
      (event.clientY - (rect.top + rect.height / 2)) / window.innerHeight;

    pointerTarget.x = Math.max(-1, Math.min(1, nx * 2));
    pointerTarget.y = Math.max(-1, Math.min(1, ny * 2));
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });

  const resize = (): void => {
    const { clientWidth, clientHeight } = container;

    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }

    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    // Pull back on tall, narrow stages so the whole object stays in frame.
    const fit = Math.max(1, 1.05 / camera.aspect);
    camera.position.set(0, 0.55 * fit, 7 * fit);
    camera.lookAt(0, -0.18, 0);
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  let last = performance.now();
  let elapsed = 0;

  const frame = (time: number): void => {
    const delta = Math.min((time - last) / 1000, 0.1);
    last = time;
    elapsed += delta;

    currentPose +=
      (targetPose - currentPose) * (1 - Math.exp(-delta * POSE_RESPONSE));
    const pose = resolvePose(sequence, currentPose);

    const tiltEase = 1 - Math.exp(-delta * TILT_RESPONSE);
    pointer.x += (pointerTarget.x - pointer.x) * tiltEase;
    pointer.y += (pointerTarget.y - pointer.y) * tiltEase;

    tilt.rotation.x = pose.rx + pointer.y * POINTER_TILT;
    tilt.rotation.y = pose.ry + pointer.x * POINTER_TILT;
    tilt.position.y = Math.sin(elapsed * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    spin.rotation.z = pose.rz;

    needleBearing = lerpBearing(
      needleBearing,
      pose.needle,
      1 - Math.exp(-delta * NEEDLE_RESPONSE)
    );
    crystal.needle.rotation.z = -needleBearing * DEG;

    // The shadow spreads as the object lies flat and fades as it floats up.
    const flat = Math.abs(Math.sin(tilt.rotation.x));
    shadow.scale.set(1, 0.3 + flat * 0.5, 1);
    shadowMaterial.opacity = 0.85 - tilt.position.y * 3;

    renderer.render(scene, camera);
  };

  // First frame right away so the canvas never fades in empty.
  frame(last);

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

  const setPose = (pose: number): void => {
    targetPose = pose;
  };

  const dispose = (): void => {
    stop();
    window.removeEventListener("pointermove", onPointerMove);
    resizeObserver.disconnect();
    disposeScene(scene);
    envMap.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { dispose, setPose, start, stop };
};
