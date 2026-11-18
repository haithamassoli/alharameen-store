// Live bits for the /8 «المدار» home-page exploration: the Hijri date on the
// watch screen, and one slow tour of the five features while the hero is in
// view. The selection itself is plain radios + CSS :has(), so the page works
// without this script.

const HIJRI_LOCALE = "ar-SA-u-ca-islamic-umalqura-nu-arab";
const TOUR_STEP_MS = 3500;
const VISIBLE_SHARE = 0.6;

export interface HijriParts {
  day: string;
  month: string;
  weekday: string;
  year: string;
}

const weekdayFormat = new Intl.DateTimeFormat(HIJRI_LOCALE, {
  weekday: "long",
});

const dayFormat = new Intl.DateTimeFormat(HIJRI_LOCALE, { day: "numeric" });
const monthFormat = new Intl.DateTimeFormat(HIJRI_LOCALE, { month: "long" });
const yearFormat = new Intl.DateTimeFormat(HIJRI_LOCALE, { year: "numeric" });

/** Umm al-Qura date split for the watch screen: "الأربعاء", "٢٧", "جمادى الأولى", "١٤٤٨ هـ". */
export const hijriParts = (date: Date): HijriParts => ({
  day: dayFormat.format(date),
  month: monthFormat.format(date),
  weekday: weekdayFormat.format(date),
  year: yearFormat.format(date),
});

const fillHijri = (root: HTMLElement): void => {
  const parts = hijriParts(new Date());

  for (const cell of root.querySelectorAll<HTMLElement>("[data-hijri]")) {
    const key = cell.dataset.hijri;

    if (
      key === "day" ||
      key === "month" ||
      key === "weekday" ||
      key === "year"
    ) {
      cell.textContent = parts[key];
    }
  }
};

// Feature 2, 3, 4, 5, then back to the first, then stop for good.
const tourOrder = (count: number): number[] => [
  ...Array.from({ length: count - 1 }, (_, index) => index + 1),
  0,
];

const startTour = (root: HTMLElement): void => {
  const radios = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="feature"]'),
  ];

  const stage = root.querySelector<HTMLElement>("[data-stage]");
  const controls = root.querySelector<HTMLElement>("[data-controls]");

  if (!stage || !controls || radios.length < 2) {
    return;
  }

  const order = tourOrder(radios.length);
  let step = 0;
  let timer: number | undefined;
  let finished = false;

  const stop = (): void => {
    finished = true;
    window.clearInterval(timer);
    timer = undefined;
  };

  const advance = (): void => {
    const radio = radios.at(order[step] ?? 0);

    if (radio !== undefined) {
      radio.checked = true;
    }

    step += 1;

    if (step >= order.length) {
      stop();
    }
  };

  const observer = new IntersectionObserver(
    (entries, self) => {
      if (finished) {
        self.disconnect();
      } else if (entries.some((entry) => entry.isIntersecting)) {
        timer ??= window.setInterval(advance, TOUR_STEP_MS);
      } else {
        window.clearInterval(timer);
        timer = undefined;
      }
    },
    { threshold: VISIBLE_SHARE }
  );

  // Any sign of a person (a touch, a key, hovering the watch or the list,
  // focusing a control) hands the hero over to them.
  for (const type of ["pointerdown", "keydown"] as const) {
    document.addEventListener(type, stop, { once: true, passive: true });
  }

  for (const target of [stage, controls]) {
    target.addEventListener("pointerenter", stop, { once: true });
    target.addEventListener("focusin", stop, { once: true });
  }

  observer.observe(stage);
};

export const initOrbit = (): void => {
  const root = document.querySelector<HTMLElement>("[data-orbit]");

  if (!root) {
    return;
  }

  fillHijri(root);

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    startTour(root);
  }
};
