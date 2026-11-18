// Client side of the /10 «التشريح» home-page exploration: today's Hijri date
// for the calendar annotation, and a scroll fallback that steps through the
// annotations where CSS scroll-driven animations are not supported.

const HIJRI = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Amman",
  year: "numeric",
});

/** Percent of the stage scroll where the first annotation starts. */
const FIRST_START = 8;

/** Percent of the stage scroll each annotation owns. */
const SEGMENT = 16;

/** How far into its segment an annotation counts as active. */
const SETTLE = 3;

/** The intro hands over to the drawing after this much scroll. */
const INTRO_OUT = 4;

/** The watch stops shrinking here. */
const SCALE_END = 92;
const PERCENT = 100;

type NoteState = "active" | "hidden" | "quiet";

const stateAt = (progress: number, index: number): NoteState => {
  const start = FIRST_START + (index - 1) * SEGMENT + SETTLE;
  const quietAt = start + SEGMENT;

  if (progress < start) {
    return "hidden";
  }

  return progress < quietAt ? "active" : "quiet";
};

const showHijriDate = (): void => {
  const today = HIJRI.format(new Date());

  for (const slot of document.querySelectorAll<HTMLElement>("[data-hijri]")) {
    slot.textContent = today;
  }
};

const followScroll = (stage: HTMLElement): void => {
  const notes = [
    ...stage.querySelectorAll<HTMLElement | SVGElement>("[data-note]"),
  ];

  let frame = 0;

  const update = (): void => {
    frame = 0;
    const box = stage.getBoundingClientRect();
    const travel = Math.max(box.height - window.innerHeight, 1);
    const progress = Math.min(Math.max(-box.top / travel, 0), 1) * PERCENT;

    stage.dataset.intro = progress > INTRO_OUT ? "out" : "in";
    stage.style.setProperty(
      "--progress",
      String(Math.min(progress / SCALE_END, 1))
    );

    for (const note of notes) {
      const state = stateAt(progress, Number(note.dataset.note));

      if (note.dataset.state !== state) {
        note.dataset.state = state;
      }
    }
  };

  const schedule = (): void => {
    if (frame === 0) {
      frame = requestAnimationFrame(update);
    }
  };

  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
};

export const initAnatomy = (): void => {
  showHijriDate();

  const stage = document.querySelector<HTMLElement>("[data-anatomy]");
  const scrolly = document.documentElement.classList.contains("scrolly");

  if (!stage || !scrolly || CSS.supports("animation-timeline: view()")) {
    return;
  }

  followScroll(stage);
};
