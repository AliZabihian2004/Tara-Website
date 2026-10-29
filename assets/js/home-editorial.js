// TARA — homepage editorial interactions: catalog at a glance, course quick-view,
// process timeline, card tilt, instructor course counts. Runs after main.js.
(function () {
  "use strict";

  var motion = window.TaraMotion || {};
  var reduced = !!motion.reduced;
  var fa = new Intl.NumberFormat("fa-IR", { useGrouping: false });
  var faPad = function (n) { return fa.format(n).padStart(2, "۰"); };
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var grid = document.getElementById("course-grid");
  var cards = grid ? Array.prototype.slice.call(grid.querySelectorAll(".course-card")) : [];

  // Runs fn once when el scrolls into view (at once if observers aren't available)
  function onceVisible(el, fn, threshold) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); fn(); }
    }, { threshold: threshold || 0.3 });
    io.observe(el);
  }

  // ---------- Catalog at a glance (built from the cards on the page) ----------
  var glance = document.querySelector("[data-catalog-glance]");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".course-filters [data-category]"));
  if (glance && cards.length) {
    var hours = 0;
    var people = {};
    var byCat = {};
    cards.forEach(function (card) {
      hours += Number(card.getAttribute("data-hours")) || 0;
      card.getAttribute("data-instructors").split(" ").forEach(function (p) { people[p] = true; });
      var cat = card.getAttribute("data-category");
      byCat[cat] = (byCat[cat] || 0) + 1;
    });

    var stats = [
      { label: "دوره", value: cards.length },
      { label: "ساعت آموزش", value: hours },
      { label: "مدرس", value: Object.keys(people).length }
    ];
    var statsEl = glance.querySelector("[data-glance-stats]");
    var statNodes = stats.map(function (s) {
      var wrap = document.createElement("div");
      var dt = document.createElement("dt");
      var dd = document.createElement("dd");
      dt.textContent = s.label;
      dd.textContent = fa.format(s.value);
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      statsEl.appendChild(wrap);
      return dd;
    });

    var bar = glance.querySelector("[data-glance-bar]");
    var segs = [];
    var toneIndex = 0;
    tabs.forEach(function (tab) {
      var cat = tab.getAttribute("data-category");
      if (!cat || !byCat[cat]) { return; }
      toneIndex += 1;
      var seg = document.createElement("button");
      seg.type = "button";
      seg.className = "glance-seg";
      seg.setAttribute("data-category", cat);
      seg.setAttribute("aria-pressed", "false");
      seg.style.setProperty("--count", byCat[cat]);
      seg.style.setProperty("--seg-tone", "var(--tone-" + Math.min(toneIndex, 3) + ")");
      seg.setAttribute("aria-label", "نمایش دوره‌های " + tab.textContent.trim() + " (" + fa.format(byCat[cat]) + " دوره)");
      seg.innerHTML = '<span class="glance-seg__track"></span><span class="glance-seg__label"><b></b><span></span></span>';
      seg.querySelector("b").textContent = tab.textContent.trim();
      seg.querySelector(".glance-seg__label span").textContent = fa.format(byCat[cat]) + " دوره";
      seg.style.setProperty("--seg-delay", (toneIndex - 1) * 120 + "ms");
      // Clicking a segment drives the real filter tab; clicking the active one clears it
      seg.addEventListener("click", function () {
        var active = seg.getAttribute("aria-pressed") === "true";
        (active ? tabs[0] : tab).click();
      });
      bar.appendChild(seg);
      segs.push(seg);
    });
    var syncSegs = function () {
      var current = (tabs.filter(function (t) { return t.getAttribute("aria-pressed") === "true"; })[0] || tabs[0]).getAttribute("data-category");
      segs.forEach(function (s) { s.setAttribute("aria-pressed", String(s.getAttribute("data-category") === current && !!current)); });
    };
    tabs.forEach(function (t) { t.addEventListener("click", function () { setTimeout(syncSegs, 0); }); });
    var reset = document.getElementById("course-filters-reset");
    if (reset) { reset.addEventListener("click", function () { setTimeout(syncSegs, 0); }); }

    glance.hidden = false;
    if (!reduced) {
      glance.classList.add("is-pending");
      onceVisible(glance, function () {
        glance.classList.remove("is-pending");
        glance.classList.add("is-visible");
        if (motion.countUp) {
          statNodes.forEach(function (node, i) { motion.countUp(node, stats[i].value, fa.format); });
        }
      }, 0.4);
    }
  }

  // ---------- Instructor cards: how many listed courses each one teaches ----------
  document.querySelectorAll("[data-instructor]").forEach(function (card) {
    var slug = card.getAttribute("data-instructor");
    var count = cards.filter(function (c) { return c.getAttribute("data-instructors").split(" ").indexOf(slug) !== -1; }).length;
    var chip = card.querySelector("[data-instructor-courses]");
    if (chip && count) {
      chip.textContent = fa.format(count) + " دوره در این فهرست";
      chip.hidden = false;
    }
  });

  // ---------- Course quick-view ----------
  var dialog = document.getElementById("quickview");
  var dataEl = document.getElementById("course-data");
  if (dialog && dataEl && typeof dialog.showModal === "function") {
    var courses = {};
    try { courses = JSON.parse(dataEl.textContent); } catch (e) { courses = {}; }
    var field = function (name) { return dialog.querySelector('[data-qv="' + name + '"]'); };
    var currentSlug = null;
    var opener = null;

    var visibleSlugs = function () {
      return cards.filter(function (c) { return !c.hidden; }).map(function (c) { return c.getAttribute("data-course"); });
    };

    var fill = function (slug) {
      var c = courses[slug];
      if (!c) { return false; }
      currentSlug = slug;
      var img = field("img");
      img.src = c.img;
      img.alt = c.alt || "";
      field("tag").textContent = c.tag;
      field("title").textContent = c.title;
      field("desc").textContent = c.desc;
      field("hours").textContent = c.hours;
      field("sessions").textContent = c.sessions;
      field("level").textContent = c.level;
      var ins = field("instructors");
      ins.textContent = "";
      c.instructors.forEach(function (p, i) {
        if (i) { ins.appendChild(document.createTextNode("، ")); }
        var a = document.createElement("a");
        a.href = "instructors/" + p.slug + ".html";
        a.textContent = p.name;
        ins.appendChild(a);
      });
      var mods = field("modules");
      mods.textContent = "";
      c.modules.forEach(function (m) {
        var li = document.createElement("li");
        li.textContent = m;
        mods.appendChild(li);
      });
      var aud = field("audience");
      aud.textContent = "";
      c.audience.forEach(function (a) {
        var li = document.createElement("li");
        li.innerHTML = '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>';
        li.appendChild(document.createTextNode(a));
        aud.appendChild(li);
      });
      field("request").href = "course-request.html?course=" + encodeURIComponent(slug);
      field("page").href = "courses/" + slug + ".html";
      var list = visibleSlugs();
      var pos = list.indexOf(slug);
      field("pos").textContent = fa.format(pos + 1) + " از " + fa.format(list.length);
      var single = list.length < 2;
      dialog.querySelector("[data-qv-prev]").hidden = single;
      dialog.querySelector("[data-qv-next]").hidden = single;
      dialog.querySelector(".quickview__content").scrollTop = 0;
      dialog.querySelector(".quickview__inner").scrollTop = 0;
      return true;
    };

    var open = function (slug, trigger) {
      if (!fill(slug)) { return; }
      opener = trigger || null;
      document.body.classList.add("has-dialog");
      dialog.showModal();
    };

    var step = function (dir) {
      var list = visibleSlugs();
      var i = list.indexOf(currentSlug);
      var next = list[(i + dir + list.length) % list.length];
      fill(next);
      if (!reduced) {
        dialog.classList.remove("is-swapping");
        void dialog.offsetWidth;
        dialog.classList.add("is-swapping");
      }
    };

    document.querySelectorAll("[data-quickview]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        open(btn.getAttribute("data-quickview"), btn);
      });
    });
    dialog.querySelector("[data-qv-close]").addEventListener("click", function () { dialog.close(); });
    dialog.querySelector("[data-qv-prev]").addEventListener("click", function () { step(-1); });
    dialog.querySelector("[data-qv-next]").addEventListener("click", function () { step(1); });
    // Click on the dimmed backdrop closes
    dialog.addEventListener("click", function (event) { if (event.target === dialog) { dialog.close(); } });
    // In RTL the next course sits to the left
    dialog.addEventListener("keydown", function (event) {
      if (event.target.closest && event.target.closest("input, textarea, select")) { return; }
      if (event.key === "ArrowLeft") { step(1); event.preventDefault(); }
      if (event.key === "ArrowRight") { step(-1); event.preventDefault(); }
    });
    dialog.addEventListener("close", function () {
      document.body.classList.remove("has-dialog");
      dialog.classList.remove("is-swapping");
      if (opener && document.contains(opener)) { opener.focus(); }
    });
  }

  // ---------- Process timeline: rail fills and steps light up as you scroll ----------
  var process = document.querySelector(".process");
  var stepsList = document.querySelector("[data-process]");
  if (process && stepsList) {
    var steps = Array.prototype.slice.call(stepsList.querySelectorAll(".process-step"));
    var counter = process.querySelector("[data-process-current]");
    var lastCurrent = -1;
    var queued = false;
    process.classList.add("is-live");

    var update = function () {
      queued = false;
      var anchor = window.innerHeight * 0.6;
      var rect = stepsList.getBoundingClientRect();
      var progress = Math.min(1, Math.max(0, (anchor - rect.top) / rect.height));
      stepsList.style.setProperty("--process-progress", progress.toFixed(3));
      var current = 0;
      steps.forEach(function (step, i) {
        var marker = step.querySelector(".process-step__marker").getBoundingClientRect();
        var active = marker.top + marker.height / 2 <= anchor;
        step.classList.toggle("is-active", active);
        if (active) { current = i; }
      });
      steps.forEach(function (step, i) { step.classList.toggle("is-current", i === current && step.classList.contains("is-active")); });
      if (current !== lastCurrent && counter) {
        lastCurrent = current;
        counter.textContent = faPad(current + 1);
        counter.classList.remove("is-changing");
        void counter.offsetWidth;
        counter.classList.add("is-changing");
      }
    };
    var queue = function () { if (!queued) { queued = true; window.requestAnimationFrame(update); } };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  }

  // ---------- Card tilt (fine pointers, motion allowed) ----------
  if (finePointer && !reduced) {
    var MAX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tilt-max")) || 4;
    document.querySelectorAll(".page-home .course-card, .page-home .instructor-card").forEach(function (card) {
      var frame = null;
      card.addEventListener("pointermove", function (event) {
        if (frame) { return; }
        frame = window.requestAnimationFrame(function () {
          frame = null;
          var r = card.getBoundingClientRect();
          var x = (event.clientX - r.left) / r.width - 0.5;
          var y = (event.clientY - r.top) / r.height - 0.5;
          card.style.setProperty("--rx", (-y * MAX).toFixed(2) + "deg");
          card.style.setProperty("--ry", (x * MAX).toFixed(2) + "deg");
          card.classList.add("is-tilting");
        });
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tilting");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }
})();
