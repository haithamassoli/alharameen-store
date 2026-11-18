// Procedural 3D Al-Harameen watch for the home hero. Loaded with import() only
// when the hero nears the viewport, so three.js never blocks first paint.
import type { Texture } from "three";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  PointsMaterial,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { formatHijriDate, formatLcdTime, handAngles } from "./hero-time";

export interface HeroWatch {
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

const PALETTE = {
  dialCenter: "#123f38",
  dialEdge: "#061716",
  gold: "#d9b56c",
  goldDeep: "#9c7a3c",
  goldPale: "#f3dc9f",
  jade: "#5fb39b",
  lcdBg: "#c9cfae",
  lcdInk: "#14231d",
  strap: "#0b2622",
} as const;

const DISPLAY_FONT =
  '"Reem Kufi Variable", "Noto Naskh Arabic Variable", serif';

const MAX_PIXEL_RATIO = 2;
const HALF_PI = Math.PI / 2;
const TAU = Math.PI * 2;

// Geometry, in scene units; the case radius is 1.
const CASE_RADIUS = 1;
const DIAL_RADIUS = 0.82;
const DIAL_Z = 0.11;
const GLASS_BASE_Z = 0.2;
const GLASS_DOME = 0.04;
const LATHE_SEGMENTS = 96;

// Idle motion and pointer tilt.
const BASE_TILT_X = -0.22;
const BASE_TILT_Y = 0.32;
const POINTER_TILT = 0.28;
const TILT_RESPONSE = 4;
const FLOAT_AMPLITUDE = 0.06;
const FLOAT_SPEED = 0.9;
const PARTICLE_COUNT = 140;

const DIAL_TEXTURE_SIZE = 1024;
const LCD_WIDTH = 512;
const LCD_HEIGHT = 224;

// LCD recess on the dial texture, in dial-texture pixels from the dial centre.
const LCD_RECESS = { height: 136, offsetY: 190, width: 300 } as const;

const makeCanvas = (
  width: number,
  height: number
): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("2D canvas is unavailable for the hero watch textures");
  }

  return [canvas, ctx];
};

const toTexture = (canvas: HTMLCanvasElement): CanvasTexture => {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;

  return texture;
};

const arabicDigits = new Intl.NumberFormat("ar-JO", { useGrouping: false });

// ---------- Textures ----------

const drawDial = (): CanvasTexture => {
  const size = DIAL_TEXTURE_SIZE;
  const c = size / 2;
  const [canvas, ctx] = makeCanvas(size, size);

  const base = ctx.createRadialGradient(c, c * 0.8, 0, c, c, c);
  base.addColorStop(0, PALETTE.dialCenter);
  base.addColorStop(1, PALETTE.dialEdge);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Sunray brushing: alternating hairline wedges catch the light.
  ctx.save();
  ctx.translate(c, c);
  const rays = 180;

  for (let i = 0; i < rays; i += 1) {
    ctx.rotate(TAU / rays);
    ctx.fillStyle =
      i % 2 === 0 ? "rgb(255 255 255 / 0.025)" : "rgb(0 0 0 / 0.05)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(c, -2);
    ctx.lineTo(c, 2);
    ctx.fill();
  }

  // Eight-point star at the centre, faint gold.
  ctx.strokeStyle = "rgb(217 181 108 / 0.28)";
  ctx.lineWidth = 2;
  const star = c * 0.16;
  ctx.strokeRect(-star, -star, star * 2, star * 2);
  ctx.rotate(Math.PI / 4);
  ctx.strokeRect(-star, -star, star * 2, star * 2);
  ctx.restore();

  // Minute track.
  ctx.save();
  ctx.translate(c, c);

  for (let i = 0; i < 60; i += 1) {
    const isHour = i % 5 === 0;
    ctx.fillStyle = isHour ? PALETTE.gold : "rgb(217 181 108 / 0.55)";
    const w = isHour ? 6 : 2.5;
    const h = isHour ? 26 : 14;
    ctx.fillRect(-w / 2, -c * 0.97, w, h);
    ctx.rotate(TAU / 60);
  }

  ctx.restore();

  // Arabic-Indic hour numerals, kept upright.
  ctx.fillStyle = PALETTE.goldPale;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 64px ${DISPLAY_FONT}`;
  const numeralRadius = c * 0.76;

  for (let hour = 1; hour <= 12; hour += 1) {
    const angle = (hour / 12) * TAU;
    ctx.fillText(
      arabicDigits.format(hour),
      c + Math.sin(angle) * numeralRadius,
      c - Math.cos(angle) * numeralRadius
    );
  }

  // Wordmark.
  ctx.direction = "rtl";
  ctx.font = `700 54px ${DISPLAY_FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText("الحرمين", c, c * 0.56);

  // Recess shadow for the LCD window.
  ctx.fillStyle = "rgb(0 0 0 / 0.45)";
  ctx.beginPath();
  ctx.roundRect(
    c - LCD_RECESS.width / 2,
    c + LCD_RECESS.offsetY - LCD_RECESS.height / 2,
    LCD_RECESS.width,
    LCD_RECESS.height,
    18
  );
  ctx.fill();
  ctx.strokeStyle = "rgb(217 181 108 / 0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();

  return toTexture(canvas);
};

const drawStrapStitch = (): CanvasTexture => {
  const [canvas, ctx] = makeCanvas(128, 256);
  ctx.fillStyle = PALETTE.strap;
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);

  for (const x of [12, 116]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  const texture = toTexture(canvas);
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 6);

  return texture;
};

const drawBokeh = (): CanvasTexture => {
  const [canvas, ctx] = makeCanvas(64, 64);
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "rgb(255 236 190 / 1)");
  glow.addColorStop(0.35, "rgb(217 181 108 / 0.55)");
  glow.addColorStop(1, "rgb(217 181 108 / 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);

  return toTexture(canvas);
};

interface Lcd {
  texture: CanvasTexture;
  update: (now: Date) => void;
}

const createLcd = (): Lcd => {
  const [canvas, ctx] = makeCanvas(LCD_WIDTH, LCD_HEIGHT);
  const texture = toTexture(canvas);
  let shown = "";

  const update = (now: Date): void => {
    const time = formatLcdTime(now);
    const date = formatHijriDate(now);
    const label = `${time}|${date}`;

    if (label === shown) {
      return;
    }

    shown = label;

    ctx.fillStyle = PALETTE.lcdBg;
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);
    // Faint inner shade so the screen reads as glass, not paper.
    const shade = ctx.createLinearGradient(0, 0, 0, LCD_HEIGHT);
    shade.addColorStop(0, "rgb(0 0 0 / 0.12)");
    shade.addColorStop(0.3, "rgb(0 0 0 / 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

    ctx.fillStyle = PALETTE.lcdInk;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.font = `700 112px ${DISPLAY_FONT}`;
    ctx.fillText(time, LCD_WIDTH / 2, LCD_HEIGHT * 0.4);
    ctx.font = `500 46px ${DISPLAY_FONT}`;
    ctx.fillText(date, LCD_WIDTH / 2, LCD_HEIGHT * 0.82);
    texture.needsUpdate = true;
  };

  return { texture, update };
};

// ---------- Geometry ----------

const caseProfile = (): Vector2[] =>
  [
    [0, -0.28],
    [0.88, -0.28],
    [0.98, -0.25],
    [1.05, -0.17],
    [1.08, -0.04],
    [1.07, 0.08],
    [1.03, 0.15],
    [1, 0.17],
    [DIAL_RADIUS, 0.17],
    [DIAL_RADIUS, DIAL_Z],
  ].map(([x = 0, y = 0]) => new Vector2(x, y));

const bezelProfile = (): Vector2[] =>
  [
    [0.99, 0.17],
    [0.985, 0.215],
    [0.96, 0.245],
    [0.87, 0.245],
    [0.845, 0.22],
    [0.84, 0.17],
  ].map(([x = 0, y = 0]) => new Vector2(x, y));

/** A lathe is built around +Y; turn it so its axis faces the camera (+Z). */
const faceCamera = <T extends Object3D>(object: T): T => {
  object.rotation.x = HALF_PI;

  return object;
};

const handTaper = (y: number, length: number, tail: number): number => {
  const EPSILON = 0.001;

  if (y > length - EPSILON) {
    return 0;
  }

  if (y < -tail + EPSILON) {
    return 0.35;
  }

  return 0.8;
};

/** A sword hand: a thin box whose tip is pinched to a point and tail narrowed. */
const handGeometry = (
  length: number,
  width: number,
  tail: number
): BoxGeometry => {
  const geometry = new BoxGeometry(width, length + tail, 0.012, 1, 2, 1);
  geometry.translate(0, (length - tail) / 2, 0);
  const position = geometry.getAttribute("position");

  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    position.setX(i, position.getX(i) * handTaper(y, length, tail));
  }

  geometry.computeVertexNormals();

  return geometry;
};

/** A flat strap that curls back around an imaginary wrist behind the case. */
const strapGeometry = (width: number, length: number): BoxGeometry => {
  const thickness = 0.08;
  const bendRadius = 1.25;
  const geometry = new BoxGeometry(width, length, thickness, 1, 48, 1);
  geometry.translate(0, length / 2, 0);
  const position = geometry.getAttribute("position");

  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = y / bendRadius;
    const radius = bendRadius + z;
    position.setY(i, radius * Math.sin(angle));
    position.setZ(i, radius * Math.cos(angle) - bendRadius);
  }

  geometry.computeVertexNormals();

  return geometry;
};

interface Particles {
  points: Points;
  update: (delta: number) => void;
}

const createParticles = (map: Texture): Particles => {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const speeds = new Float32Array(PARTICLE_COUNT);
  const spanY = 4;

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const angle = Math.random() * TAU;
    const radius = 1.4 + Math.random() * 1.8;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spanY;
    positions[i * 3 + 2] = Math.sin(angle) * radius - 0.8;
    speeds[i] = 0.05 + Math.random() * 0.12;
  }

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);

  const material = new PointsMaterial({
    blending: AdditiveBlending,
    color: new Color(PALETTE.gold),
    depthWrite: false,
    map,
    opacity: 0.75,
    size: 0.09,
    sizeAttenuation: true,
    transparent: true,
  });

  const points = new Points(geometry, material);

  const update = (delta: number): void => {
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      let y = (positions[i * 3 + 1] ?? 0) + (speeds[i] ?? 0) * delta;

      if (y > spanY / 2) {
        y -= spanY;
      }

      positions[i * 3 + 1] = y;
    }

    attribute.needsUpdate = true;
    points.rotation.y += delta * 0.03;
  };

  return { points, update };
};

interface WatchModel {
  root: Group;
  hour: Object3D;
  minute: Object3D;
  second: Object3D;
  lcd: Lcd;
}

const buildWatch = (dialMap: Texture, strapMap: Texture): WatchModel => {
  const root = new Group();

  const gold = new MeshPhysicalMaterial({
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    color: PALETTE.gold,
    metalness: 1,
    roughness: 0.26,
  });

  const ceramic = new MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    color: "#0d3a33",
    metalness: 0.15,
    roughness: 0.3,
  });

  const strapMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    map: strapMap,
    metalness: 0,
    roughness: 0.78,
  });

  root.add(
    faceCamera(new Mesh(new LatheGeometry(caseProfile(), LATHE_SEGMENTS), gold))
  );
  root.add(
    faceCamera(
      new Mesh(new LatheGeometry(bezelProfile(), LATHE_SEGMENTS), ceramic)
    )
  );

  // Twelve gold studs on the bezel; the one at 12 is longer.
  const studs = new InstancedMesh(new BoxGeometry(0.035, 0.06, 0.02), gold, 12);
  const dummy = new Object3D();

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * TAU;
    dummy.position.set(Math.sin(angle) * 0.905, Math.cos(angle) * 0.905, 0.25);
    dummy.rotation.set(0, 0, -angle);
    dummy.scale.set(1, i === 0 ? 1.6 : 1, 1);
    dummy.updateMatrix();
    studs.setMatrixAt(i, dummy.matrix);
  }

  root.add(studs);

  const dial = new Mesh(
    new CircleGeometry(DIAL_RADIUS, LATHE_SEGMENTS),
    new MeshStandardMaterial({ map: dialMap, metalness: 0.35, roughness: 0.45 })
  );

  dial.position.z = DIAL_Z;
  root.add(dial);

  // Live LCD window at six o'clock, unlit so it glows like a backlit screen.
  const lcd = createLcd();
  const lcdScale = DIAL_RADIUS / (DIAL_TEXTURE_SIZE / 2);

  const lcdMesh = new Mesh(
    new PlaneGeometry(
      (LCD_RECESS.width - 20) * lcdScale,
      (LCD_RECESS.height - 14) * lcdScale
    ),
    new MeshBasicMaterial({ map: lcd.texture, toneMapped: false })
  );

  lcdMesh.position.set(0, -LCD_RECESS.offsetY * lcdScale, DIAL_Z + 0.004);
  root.add(lcdMesh);

  // Hands.
  const hour = new Mesh(handGeometry(0.44, 0.075, 0.08), gold);
  hour.position.z = DIAL_Z + 0.02;
  const minute = new Mesh(handGeometry(0.68, 0.055, 0.1), gold);
  minute.position.z = DIAL_Z + 0.04;
  const second = new Group();

  const jade = new MeshStandardMaterial({
    color: PALETTE.jade,
    metalness: 0.4,
    roughness: 0.35,
  });

  const secondBlade = new Mesh(new BoxGeometry(0.012, 0.92, 0.006), jade);
  secondBlade.position.y = 0.3;

  const counterweight = new Mesh(
    new CylinderGeometry(0.035, 0.035, 0.008, 24),
    jade
  );

  counterweight.rotation.x = HALF_PI;
  counterweight.position.y = -0.1;
  second.add(secondBlade, counterweight);
  second.position.z = DIAL_Z + 0.055;
  const cap = new Mesh(new CylinderGeometry(0.03, 0.03, 0.02, 24), gold);
  cap.rotation.x = HALF_PI;
  cap.position.z = DIAL_Z + 0.065;
  root.add(hour, minute, second, cap);

  // Domed sapphire: mostly transparent, with environment reflections.
  const glassRadius = (DIAL_RADIUS ** 2 + GLASS_DOME ** 2) / (2 * GLASS_DOME);

  const glass = new Mesh(
    new SphereGeometry(
      glassRadius,
      LATHE_SEGMENTS,
      6,
      0,
      TAU,
      0,
      Math.asin(DIAL_RADIUS / glassRadius)
    ),
    new MeshPhysicalMaterial({
      clearcoat: 1,
      color: "#ffffff",
      depthWrite: false,
      envMapIntensity: 2.2,
      metalness: 0,
      opacity: 0.14,
      roughness: 0.02,
      transparent: true,
    })
  );

  faceCamera(glass);
  glass.position.z = GLASS_BASE_Z - (glassRadius - GLASS_DOME);
  root.add(glass);

  // Crown at three o'clock, four pushers at 2, 4, 8 and 10.
  const crown = new Mesh(new CylinderGeometry(0.09, 0.09, 0.14, 32), gold);
  crown.rotation.z = HALF_PI;
  crown.position.set(CASE_RADIUS + 0.12, 0, -0.04);
  root.add(crown);

  for (const clock of [2, 4, 8, 10]) {
    const pivot = new Group();
    pivot.rotation.z = HALF_PI - (clock / 12) * TAU;
    const pusher = new Mesh(new CylinderGeometry(0.045, 0.05, 0.12, 24), gold);
    pusher.rotation.z = HALF_PI;
    pusher.position.set(CASE_RADIUS + 0.06, 0, -0.06);
    pivot.add(pusher);
    root.add(pivot);
  }

  // Lugs and straps.
  for (const side of [1, -1]) {
    for (const x of [0.4, -0.4]) {
      const lug = new Mesh(new BoxGeometry(0.14, 0.32, 0.16), gold);
      lug.position.set(x, side * 0.98, -0.08);
      root.add(lug);
    }

    const strap = new Mesh(strapGeometry(0.68, 2.3), strapMaterial);
    strap.position.set(0, side * 0.96, -0.09);
    strap.rotation.z = side === 1 ? 0 : Math.PI;
    root.add(strap);
  }

  return { hour, lcd, minute, root, second };
};

const disposeScene = (scene: Scene): void => {
  scene.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Points)) {
      return;
    }

    const geometry: unknown = object.geometry;

    if (geometry instanceof BufferGeometry) {
      geometry.dispose();
    }

    const materials: unknown[] = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      if (
        material instanceof MeshStandardMaterial ||
        material instanceof MeshBasicMaterial ||
        material instanceof PointsMaterial
      ) {
        material.map?.dispose();
        material.dispose();
      }
    }
  });
};

const loadDisplayFont = async (): Promise<void> => {
  try {
    await document.fonts.load(`700 64px ${DISPLAY_FONT}`, "الحرمين ١٢٣٤٥٦٧٨٩");
  } catch {
    // Canvas falls back to the next family in the stack.
  }
};

// ---------- Public API ----------

export const createHeroWatch = async (
  canvas: HTMLCanvasElement,
  container: HTMLElement
): Promise<HeroWatch> => {
  await loadDisplayFont();

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setClearColor(0x00_00_00, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environment = envMap;
  scene.environmentIntensity = 0.9;

  const key = new DirectionalLight("#ffe6b0", 1.6);
  key.position.set(3, 4, 5);
  const rim = new DirectionalLight(PALETTE.jade, 2.2);
  rim.position.set(-4, -1, -3);
  scene.add(key, rim);

  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6.4);

  const watch = buildWatch(drawDial(), drawStrapStitch());
  const tilt = new Group();
  tilt.add(watch.root);
  scene.add(tilt);

  const particles = createParticles(drawBokeh());
  scene.add(particles.points);

  // Pointer-follow tilt, eased toward the target each frame.
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };

  const onPointerMove = (event: PointerEvent): void => {
    const rect = container.getBoundingClientRect();

    const nx =
      (event.clientX - (rect.left + rect.width / 2)) / window.innerWidth;

    const ny =
      (event.clientY - (rect.top + rect.height / 2)) / window.innerHeight;

    target.x = Math.max(-1, Math.min(1, nx * 2));
    target.y = Math.max(-1, Math.min(1, ny * 2));
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });

  const resize = (): void => {
    const { clientWidth, clientHeight } = container;

    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }

    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
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

    const now = new Date();
    const angles = handAngles(now);
    watch.hour.rotation.z = -angles.hour;
    watch.minute.rotation.z = -angles.minute;
    watch.second.rotation.z = -angles.second;
    watch.lcd.update(now);

    const ease = 1 - Math.exp(-delta * TILT_RESPONSE);
    current.x += (target.x - current.x) * ease;
    current.y += (target.y - current.y) * ease;
    tilt.rotation.y = BASE_TILT_Y + current.x * POINTER_TILT;
    tilt.rotation.x = BASE_TILT_X + current.y * POINTER_TILT;
    tilt.position.y = Math.sin(elapsed * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    tilt.rotation.z = Math.sin(elapsed * FLOAT_SPEED * 0.5) * 0.03;

    particles.update(delta);
    renderer.render(scene, camera);
  };

  // First frame immediately so the canvas never fades in empty.
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

  const dispose = (): void => {
    stop();
    window.removeEventListener("pointermove", onPointerMove);
    resizeObserver.disconnect();
    disposeScene(scene);
    envMap.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { dispose, start, stop };
};
