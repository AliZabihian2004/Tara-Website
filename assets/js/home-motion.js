// TARA — homepage motion layer (runs after main.js; does nothing under reduced motion)
(function () {
  "use strict";

  var reduced = window.TaraMotion ? window.TaraMotion.reduced :
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------- Header lift on scroll (kept under reduced motion: it isn't movement) ----------
  var header = document.querySelector(".site-header");
  var hero = document.querySelector("[data-hero]");
  var ticking = false;

  function onScroll() {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      if (header) { header.classList.toggle("is-scrolled", y > 8); }
      if (hero && !reduced) {
        var progress = Math.min(1, Math.max(0, y / hero.offsetHeight));
        hero.style.setProperty("--hero-scroll", progress.toFixed(3));
      }
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (reduced) { return; }

  // ---------- Hero title: wrap each word so it can rise in on its own ----------
  var title = hero && hero.querySelector(".hero__title");
  if (title) {
    var wordIndex = 0;
    var splitNode = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) { splitNode(child); return; }
        if (child.nodeType !== 3) { return; }
        var frag = document.createDocumentFragment();
        // Split on whitespace only, so ZWNJ-joined Persian words stay whole
        child.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) { return; }
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var outer = document.createElement("span");
          var inner = document.createElement("span");
          outer.className = "hero__word";
          inner.textContent = part;
          inner.style.setProperty("--w", wordIndex++);
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        node.replaceChild(frag, child);
      });
    };
    // Screen readers get the sentence in one piece
    title.setAttribute("aria-label", title.textContent.replace(/\s+/g, " ").trim());
    splitNode(title);
    Array.prototype.forEach.call(title.querySelectorAll(".hero__word"), function (w) { w.setAttribute("aria-hidden", "true"); });
    title.classList.add("is-split");
  }

  if (!hero) { return; }

  // ---------- Pointer: gentle parallax + a soft light that follows the cursor ----------
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var spot = hero.querySelector("[data-hero-spot]");
  if (finePointer) {
    var pending = null;
    hero.addEventListener("pointermove", function (event) {
      var first = pending === null;
      pending = event;
      if (!first) { return; }
      window.requestAnimationFrame(function () {
        var rect = hero.getBoundingClientRect();
        var x = pending.clientX - rect.left;
        var y = pending.clientY - rect.top;
        hero.style.setProperty("--hero-px", ((x / rect.width) * 2 - 1).toFixed(3));
        hero.style.setProperty("--hero-py", ((y / rect.height) * 2 - 1).toFixed(3));
        if (spot) { spot.style.transform = "translate3d(" + x + "px," + y + "px,0)"; }
        hero.classList.add("is-pointer");
        pending = null;
      });
    });
    hero.addEventListener("pointerleave", function () {
      hero.classList.remove("is-pointer");
      hero.style.setProperty("--hero-px", "0");
      hero.style.setProperty("--hero-py", "0");
    });
  }

  // ---------- Pause the ambient animation while the hero is off screen ----------
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      hero.classList.toggle("is-offscreen", !entries[0].isIntersecting);
    }).observe(hero);
  }

  // ---------- Cards: the soft light follows the pointer inside each card ----------
  if (finePointer) {
    document.querySelectorAll(".course-card, .instructor-card").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", (event.clientX - rect.left) + "px");
        card.style.setProperty("--my", (event.clientY - rect.top) + "px");
      });
    });
  }

  // ---------- Primary hero button leans gently toward a nearby pointer ----------
  var magnet = hero.querySelector(".hero__actions .btn--primary");
  if (magnet && finePointer) {
    var RANGE = 140;
    var PULL = 8;
    hero.addEventListener("pointermove", function (event) {
      var r = magnet.getBoundingClientRect();
      var dx = event.clientX - (r.left + r.width / 2);
      var dy = event.clientY - (r.top + r.height / 2);
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > RANGE + r.width / 2) { magnet.style.translate = ""; return; }
      var k = (1 - Math.min(1, dist / (RANGE + r.width / 2))) * PULL / Math.max(dist, 1);
      magnet.style.translate = (dx * k).toFixed(1) + "px " + (dy * k).toFixed(1) + "px";
    });
    hero.addEventListener("pointerleave", function () { magnet.style.translate = ""; });
  }
})();

// ---------- Floating course card that follows the hero slider ----------
// Runs regardless of motion settings: it carries information, only its animation is optional.
(function () {
  "use strict";
  var slider = document.querySelector("[data-slider]");
  var float = document.querySelector("[data-hero-float]");
  var dataEl = document.getElementById("course-data");
  if (!slider || !float || !dataEl) { return; }
  var courses = {};
  try { courses = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var avatars = float.querySelector("[data-float-avatars]");
  var nameEl = float.querySelector("[data-float-name]");
  var metaEl = float.querySelector("[data-float-meta]");

  function slugFor(slide) {
    var link = slide && slide.querySelector(".hero-slider__caption");
    var m = link && link.getAttribute("href").match(/courses\/([\w-]+)\.html/);
    return m ? m[1] : null;
  }

  function show(slide) {
    var c = courses[slugFor(slide)];
    if (!c) { float.hidden = true; return; }
    avatars.textContent = "";
    c.instructors.forEach(function (p) {
      var img = document.createElement("img");
      img.src = "assets/img/optimized/instructor-" + p.slug.split("-")[0] + ".webp";
      img.alt = "";
      img.width = img.height = 32;
      avatars.appendChild(img);
    });
    nameEl.textContent = c.instructors.map(function (p) { return p.name; }).join(" و ");
    metaEl.textContent = [c.hours, c.sessions].filter(Boolean).join(" · ");
    float.hidden = false;
    float.classList.remove("is-swapping");
    void float.offsetWidth;
    float.classList.add("is-swapping");
  }

  slider.addEventListener("slidechange", function (event) { show(event.detail.slide); });
  show(slider.querySelector(".hero-slider__slide.is-active"));
})();
