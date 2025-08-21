(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const v = document.getElementById("demoVideo");
  if (!v) return;

  // Tunable controls
  const SCALE_START = 0.95; // start scaling when ~__% visible
  const SCALE_END = 1.0; // reach max scale by ~80% visible
  const VIDEO_MIN = 0.98; // base scale for video
  const VIDEO_MAX = 1.05; // max scale for video
  const CARD_MIN = 0.99; // base scale for container
  const CARD_MAX = 1.03; // max scale for container

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // Ensure mobile-friendly autoplay flags
  v.muted = true; // required for autoplay on mobile
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  v.setAttribute("autoplay", "");

  const container = v.closest(".media-card");
  v.style.transformOrigin = "center center";
  if (container) container.style.transformOrigin = "center center";

  // Pause until observed in view at chosen threshold
  v.addEventListener(
    "loadeddata",
    () => {
      try {
        v.pause();
      } catch (_) {}
    },
    { once: true }
  );

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const r = entry.intersectionRatio; // 0..1
        const t = clamp01((r - SCALE_START) / (SCALE_END - SCALE_START)); // 0..1 ramp

        // Interpolate scales according to visibility
        const videoScale = VIDEO_MIN + (VIDEO_MAX - VIDEO_MIN) * t;
        const cardScale = CARD_MIN + (CARD_MAX - CARD_MIN) * t;

        // Apply transforms every frame (reversible with scroll)
        v.style.transform = `scale(${videoScale})`;
        if (container) {
          container.style.transform = `scale(${cardScale})`;

          // Optional: stronger shadow as it grows (comment out if you’re not using the white box)
          const shadowY = 6 + 6 * t; // 6px -> 12px
          const blur = 12 + 12 * t; // 12px -> 24px
          const alpha = 0.08 + 0.07 * t;
          container.style.boxShadow = `0 ${shadowY}px ${blur}px rgba(0,0,0,${alpha.toFixed(
            3
          )})`;
        }

        // Playback gating (separate from scaling): play when at least half visible
        const active = entry.isIntersecting && r >= 0.5;

        // (Debug) show when active; remove if no longer needed
        // if (container) {
        //   container.classList.toggle("io-active", active);
        //   container.style.color = active ? "red" : "";
        // }

        if (reduce) {
          v.pause();
          return;
        }

        if (active) {
          const p = v.play && v.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }

        // Reset when fully out of view
        if (r === 0) {
          v.style.transform = `scale(${VIDEO_MIN})`;
          if (container) {
            container.style.transform = `scale(${CARD_MIN})`;
            container.style.boxShadow = "";
          }
        }
      });
    },
    { threshold: [0, 0.1, 0.5, 0.8, 1] }
  ); // include breakpoints you care about

  io.observe(v);
})();
