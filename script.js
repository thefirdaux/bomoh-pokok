(function () {
  "use strict";

  // WhatsApp (wa.me/60122760769) and Google review links are written directly in index.html

  // Project gallery drifts sideways on a seamless loop; pauses while the user is touching it
  var GALLERY_SPEED = 80; // pixels per second
  var RESUME_DELAY = 2500; // ms after the user lets go
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-autoscroll]").forEach(function (track) {
    if (reduceMotion) return;

    // Append a decorative copy of the groups so the end flows straight back into the start
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (group) {
      var clone = group.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("img").forEach(function (img) {
        img.alt = "";
      });
      track.appendChild(clone);
    });

    var firstClone = track.children[originals.length];
    var loopWidth = 0;
    var position = 0;
    var paused = false;
    var holds = {}; // why we're paused: hover, touch, focus
    var onScreen = false;
    var resumeTimer = null;
    var lastTime = null;

    function measure() {
      loopWidth = firstClone.offsetLeft - originals[0].offsetLeft;
    }

    function hold(reason) {
      holds[reason] = true;
      paused = true;
      clearTimeout(resumeTimer);
    }

    function release(reason, delay) {
      delete holds[reason];
      if (Object.keys(holds).length) return;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        position = track.scrollLeft;
        paused = false;
      }, delay);
    }

    function step(time) {
      if (lastTime !== null && !paused && onScreen && !document.hidden && loopWidth > 0) {
        position += (GALLERY_SPEED * (time - lastTime)) / 1000;
        if (position >= loopWidth) position -= loopWidth;
        track.scrollLeft = position;
      }
      lastTime = time;
      requestAnimationFrame(step);
    }

    track.classList.add("is-autoscrolling");
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);

    track.addEventListener("pointerenter", function (event) {
      if (event.pointerType === "mouse") hold("hover");
    });
    track.addEventListener("pointerleave", function (event) {
      if (event.pointerType === "mouse") release("hover", 600);
    });
    track.addEventListener("touchstart", function () {
      hold("touch");
    }, { passive: true });
    track.addEventListener("touchend", function () {
      release("touch", RESUME_DELAY);
    });
    track.addEventListener("touchcancel", function () {
      release("touch", RESUME_DELAY);
    });
    // Keyboard users only — a mouse click also focuses the track, but hover covers that
    track.addEventListener("focusin", function () {
      if (track.matches(":focus-visible")) hold("focus");
    });
    track.addEventListener("focusout", function () {
      release("focus", RESUME_DELAY);
    });

    // Only animate while the gallery is visible
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
      }).observe(track);
    } else {
      onScreen = true;
    }

    requestAnimationFrame(step);
  });

  // Gallery photos past the first few blocks carry data-src and load only as they
  // approach the visible part of the gallery (native lazy loading fetches far too early)
  document.querySelectorAll(".gallery").forEach(function (gallery) {
    var pending = gallery.querySelectorAll("img[data-src]");

    function load(img) {
      img.src = img.getAttribute("data-src");
      img.removeAttribute("data-src");
    }

    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(pending, load);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          load(entry.target);
        });
      },
      // About three blocks ahead of what's on screen
      { root: gallery, rootMargin: "0px 1200px 0px 0px" }
    );

    Array.prototype.forEach.call(pending, function (img) {
      observer.observe(img);
    });
  });

  // Numbers ("4.8", "500") roll up like an odometer the first time they're on screen.
  // data-count-from sets the starting reading (e.g. "0.1"); otherwise every digit starts at 0.
  var ODOMETER_SPINS = 2; // full 0–9 turns before landing

  document.querySelectorAll("[data-count-to]").forEach(function (counter) {
    if (reduceMotion || !("IntersectionObserver" in window)) return;

    var value = counter.getAttribute("data-count-to");
    var from = counter.getAttribute("data-count-from") || "";
    // Line the starting reading up with the final one from the right, e.g. "0.1" under "4.8"
    var fromChars = from.padStart(value.length, "0").slice(-value.length).split("");
    var odometer = document.createElement("span");
    odometer.className = "odometer";
    odometer.setAttribute("aria-hidden", "true");
    var columnIndex = 0;

    value.split("").forEach(function (char, index) {
      // Anything that isn't a digit (like the decimal point) stays still
      if (!/\d/.test(char)) {
        var fixed = document.createElement("span");
        fixed.className = "odometer__char";
        fixed.textContent = char;
        odometer.appendChild(fixed);
        return;
      }

      var digit = Number(char);
      var startDigit = /\d/.test(fromChars[index]) ? Number(fromChars[index]) : 0;
      var column = document.createElement("span");
      column.className = "odometer__digit";

      var strip = document.createElement("span");
      strip.className = "odometer__strip";
      for (var i = 0; i <= ODOMETER_SPINS * 10 + digit; i++) {
        var cell = document.createElement("span");
        cell.textContent = i % 10;
        strip.appendChild(cell);
      }
      strip.style.setProperty("--start", startDigit);
      strip.style.setProperty("--stop", ODOMETER_SPINS * 10 + digit);
      // Columns further right spin a little longer, so the number settles left to right
      strip.style.setProperty("--roll-duration", 1.4 + columnIndex * 0.3 + "s");
      columnIndex++;

      column.appendChild(strip);
      odometer.appendChild(column);
    });

    // Screen readers keep reading the plain number
    var label = document.createElement("span");
    label.className = "visually-hidden";
    label.textContent = value;

    counter.textContent = "";
    counter.appendChild(label);
    counter.appendChild(odometer);

    var observer = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        // Next frame, so the starting position paints before the roll begins
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            odometer.classList.add("is-rolling");
          });
        });
      },
      { threshold: 1, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(counter);
  });

  // Carousels already swipe on touch; let mouse users drag them too
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  document.querySelectorAll("[data-scroller]").forEach(function (scroller) {
    if (!finePointer) return;

    var startX = 0;
    var startScroll = 0;
    var pointerId = null;
    var moved = false;

    scroller.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
      moved = false;
    });

    scroller.addEventListener("pointermove", function (event) {
      if (event.pointerId !== pointerId) return;
      var dx = event.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        scroller.classList.add("is-dragging");
        scroller.setPointerCapture(pointerId);
      }
      if (moved) {
        scroller.scrollLeft = startScroll - dx;
      }
    });

    function endDrag(event) {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      scroller.classList.remove("is-dragging");
    }

    scroller.addEventListener("pointerup", endDrag);
    scroller.addEventListener("pointercancel", endDrag);

    // Don't follow a link (e.g. "Get Free Quote") when the user was dragging
    scroller.addEventListener(
      "click",
      function (event) {
        if (moved) {
          event.preventDefault();
          event.stopPropagation();
          moved = false;
        }
      },
      true
    );

    // Stop the browser's native image drag from hijacking the gesture
    scroller.addEventListener("dragstart", function (event) {
      event.preventDefault();
    });
  });
})();
