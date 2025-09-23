// Generalized in-view scale animation with optional video support
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // Attempt play(); if blocked (e.g., Safari), attach a one-time gesture unlock
  function attachUnlock(el) {
    if (el._unlockCleanup) return; // already attached
    const onGesture = async () => {
      el.muted = true; // ensure muted before play
      try {
        await el.play();
      } catch (_) {}
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("touchstart", onGesture, true);
      el._unlockCleanup = null;
    };
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("touchstart", onGesture, true);
    el._unlockCleanup = cleanup;
  }

  function playWithUnlock(el) {
    try {
      const p = el.play && el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Autoplay likely blocked: wait for first user gesture
          attachUnlock(el);
        });
      }
    } catch (_) {}
  }

  function observeScale(el, opts = {}) {
    const isVideo = el.tagName === "VIDEO";

    const container =
      (opts.containerSelector && el.closest(opts.containerSelector)) ||
      el.closest(".media-card");

    const SCALE_START = Number(el.dataset.ioStart || opts.start || 0.95);
    const SCALE_END = Number(el.dataset.ioEnd || opts.end || 1.0);
    const ELEM_MIN = Number(
      el.dataset.ioMin || opts.elemMin || (isVideo ? 0.98 : 0.98)
    );
    const ELEM_MAX = Number(
      el.dataset.ioMax || opts.elemMax || (isVideo ? 1.05 : 1.05)
    );
    const CONT_MIN = Number(el.dataset.ioContainerMin || opts.containerMin || 0.99);
    const CONT_MAX = Number(el.dataset.ioContainerMax || opts.containerMax || 1.03);
    const threshold = opts.threshold || [0, 0.1, 0.5, 0.8, 1];
    const rootMargin =
      el.dataset.ioRootMargin || opts.rootMargin || "-20% 0% -20% 0%"; // default band

    // Prep
    el.style.transformOrigin = "center center";
    if (container) container.style.transformOrigin = "center center";

    // Video-specific flags
    if (isVideo) {
      el.muted = true; // required for autoplay on mobile
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.setAttribute("autoplay", "");
      el.addEventListener(
        "loadeddata",
        () => {
          try {
            el.pause();
          } catch (_) {}
        },
        { once: true }
      );
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const r = entry.intersectionRatio; // 0..1
          const t = clamp01((r - SCALE_START) / (SCALE_END - SCALE_START)); // 0..1 ramp

          // Interpolate scales according to visibility
          const elemScale = ELEM_MIN + (ELEM_MAX - ELEM_MIN) * t;
          const contScale = CONT_MIN + (CONT_MAX - CONT_MIN) * t;

          if (reduce) {
            if (isVideo) el.pause();
            // Reset transforms when reduced motion preferred
            el.style.transform = `scale(${ELEM_MIN})`;
            if (container) {
              container.style.transform = `scale(${CONT_MIN})`;
              container.style.boxShadow = "";
            }
            return;
          }

          // Apply transforms every frame (reversible with scroll)
          el.style.transform = `scale(${elemScale})`;
          if (container) {
            container.style.transform = `scale(${contScale})`;
            // Subtle shadow growth as it scales
            const shadowY = 6 + 6 * t; // 6px -> 12px
            const blur = 12 + 12 * t; // 12px -> 24px
            const alpha = 0.08 + 0.07 * t;
            container.style.boxShadow = `0 ${shadowY}px ${blur}px rgba(0,0,0,${alpha.toFixed(
              3
            )})`;
          }

          // Playback gating (separate from scaling): play when at least half visible
          const active = entry.isIntersecting && r >= 0.5;
          if (isVideo) {
            if (active) {
              playWithUnlock(el); // try immediate play; attach unlock only if blocked
            } else {
              if (!el.paused) el.pause();
              // If we had an unlock listener waiting, remove it while inactive
              if (el._unlockCleanup) el._unlockCleanup();
            }
          }

          // Reset when fully out of view
          if (r === 0) {
            el.style.transform = `scale(${ELEM_MIN})`;
            if (container) {
              container.style.transform = `scale(${CONT_MIN})`;
              container.style.boxShadow = "";
            }
          }
        });
      },
      { threshold, rootMargin }
    );

    io.observe(el);
    return io;
  }

  // Auto-attach for demo video and any opted-in elements
  document.addEventListener("DOMContentLoaded", () => {
    const v = document.getElementById("demoVideo");
    if (v) observeScale(v);

    document
      .querySelectorAll("[data-io-scale]")
      .forEach((el) => observeScale(el));

    // Optional tiny "prime" to warm up autoplay on some Safari builds
    if (v) {
      setTimeout(() => {
        try {
          v.muted = true;
          const p = v.play && v.play();
          if (p && typeof p.then === "function") {
            p.then(() => v.pause()).catch(() => {});
          }
        } catch (_) {}
      }, 0);
    }
  });
})();
