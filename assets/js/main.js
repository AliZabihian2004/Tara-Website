// TARA — shared site behavior
(function () {
  "use strict";

  // Motion is opt-in from JS so content is never hidden when scripts or animations are off
  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced) { document.documentElement.classList.add("motion"); }

  // Counts a number up to its final value (ease-out); shows the final value at once under reduced motion
  function countUp(node, target, format, prefix) {
    prefix = prefix || "";
    if (prefersReduced) { node.textContent = prefix + format(target); return; }
    var startTime = null;
    var DURATION = 1200;
    var step = function (now) {
      if (startTime === null) { startTime = now; }
      var progress = Math.min(1, (now - startTime) / DURATION);
      var eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = prefix + format(Math.round(target * eased));
      if (progress < 1) { window.requestAnimationFrame(step); }
    };
    window.requestAnimationFrame(step);
  }

  window.TaraMotion = { reduced: prefersReduced, countUp: countUp };

  // Mobile nav toggle
  var toggle = document.querySelector(".nav__toggle");
  var links = document.querySelector(".nav__links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Theme toggle (persisted)
  var themeBtn = document.querySelector(".theme-toggle");
  var root = document.documentElement;
  var STORAGE_KEY = "tara-theme";
  // Moon in light mode (switch to dark), sun in dark mode (switch to light)
  var MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M18 2L18.6178 3.23558C18.8833 3.76656 19.016 4.03205 19.1934 4.26211C19.3507 4.46626 19.5337 4.64927 19.7379 4.80664C19.9679 4.98397 20.2334 5.11672 20.7644 5.38221L22 6L20.7644 6.61779C20.2334 6.88328 19.9679 7.01603 19.7379 7.19336C19.5337 7.35073 19.3507 7.53374 19.1934 7.73789C19.016 7.96795 18.8833 8.23344 18.6178 8.76442L18 10L17.3822 8.76442C17.1167 8.23344 16.984 7.96795 16.8066 7.73789C16.6493 7.53374 16.4663 7.35073 16.2621 7.19336C16.0321 7.01603 15.7666 6.88328 15.2356 6.61779L14 6L15.2356 5.38221C15.7666 5.11672 16.0321 4.98397 16.2621 4.80664C16.4663 4.64927 16.6493 4.46626 16.8066 4.26211C16.984 4.03205 17.1167 3.76656 17.3822 3.23558L18 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 13.3893C19.689 15.689 17.2145 17.2395 14.3779 17.2395C10.1711 17.2395 6.76075 13.8292 6.76075 9.62233C6.76075 6.78554 8.31149 4.31094 10.6115 3C5.77979 3.45812 2 7.52692 2 12.4785C2 17.7371 6.26292 22 11.5215 22C16.4729 22 20.5415 18.2206 21 13.3893Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function applyTheme(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", String(theme === "dark"));
      themeBtn.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
    }
  }

  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var isDark = root.getAttribute("data-theme") === "dark";
      var next = isDark ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    });
  }

  // Hero slider
  var slider = document.querySelector("[data-slider]");
  if (slider) {
    var slides = slider.querySelectorAll(".hero-slider__slide");
    var dotsWrap = slider.querySelector("[data-slider-dots]");
    var rtl = getComputedStyle(slider).direction === "rtl";
    var INTERVAL = 5000;
    var current = 0;
    var timer = null;
    var dots = [];
    // CSS uses this for the Ken Burns zoom and the active dot's progress fill
    slider.style.setProperty("--slider-interval", INTERVAL + "ms");

    // Images after the first carry data-src and load just before they're shown
    function loadSlide(index) {
      var img = slides[index].querySelector("img[data-src]");
      if (img) {
        img.src = img.getAttribute("data-src");
        img.removeAttribute("data-src");
      }
    }

    function goTo(index) {
      index = (index + slides.length) % slides.length;
      loadSlide(index);
      slides.forEach(function (slide, i) {
        var active = i === index;
        slide.classList.toggle("is-active", active);
        if (active) {
          slide.removeAttribute("aria-hidden");
          slide.inert = false;
        } else {
          slide.setAttribute("aria-hidden", "true");
          slide.inert = true;
        }
      });
      dots.forEach(function (dot, i) {
        dot.setAttribute("aria-current", String(i === index));
      });
      current = index;
      loadSlide((index + 1) % slides.length);
      slider.dispatchEvent(new CustomEvent("slidechange", { detail: { index: index, slide: slides[index] } }));
    }

    // Wait for the next photo to finish loading so it never fades in half-empty
    function advance() {
      var next = (current + 1) % slides.length;
      var img = slides[next].querySelector("img");
      loadSlide(next);
      if (img.complete) {
        goTo(next);
      } else {
        stop();
        var from = current;
        var proceed = function () {
          if (current === from) { go(next); } // skip if a dot was clicked meanwhile
        };
        img.addEventListener("load", proceed, { once: true });
        img.addEventListener("error", proceed, { once: true });
      }
    }

    function stop() { clearInterval(timer); timer = null; slider.classList.remove("is-ticking"); }
    // Autoplay always runs; it only pauses while the tab is in the background
    function start() {
      stop();
      if (!document.hidden) {
        timer = setInterval(advance, INTERVAL);
        void slider.offsetWidth; // restart the progress fill in step with the timer
        slider.classList.add("is-ticking");
      }
    }
    // Choosing a slide restarts the countdown so the next one doesn't jump in early
    function go(index) { goTo(index); start(); }

    slides.forEach(function (_, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "hero-slider__dot";
      dot.setAttribute("aria-label", slides[i].getAttribute("aria-label"));
      dot.addEventListener("click", function () { go(i); });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    slider.querySelector("[data-slider-prev]").addEventListener("click", function () { go(current - 1); });
    slider.querySelector("[data-slider-next]").addEventListener("click", function () { go(current + 1); });

    // In RTL the next slide sits to the left
    slider.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") { return; }
      var forward = (event.key === "ArrowLeft") === rtl;
      go(current + (forward ? 1 : -1));
      event.preventDefault();
    });

    var touchX = null;
    slider.addEventListener("touchstart", function (event) {
      touchX = event.touches[0].clientX;
    }, { passive: true });
    slider.addEventListener("touchend", function (event) {
      if (touchX === null) { return; }
      var dx = event.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 40) { return; }
      var forward = rtl ? dx > 0 : dx < 0;
      go(current + (forward ? 1 : -1));
    });

    document.addEventListener("visibilitychange", start);

    goTo(0);
    start();
  }

  // Homepage course search & filters
  var courseGrid = document.getElementById("course-grid");
  if (courseGrid) {
    var cards = courseGrid.querySelectorAll(".course-card");
    var searchInput = document.getElementById("course-search");
    var instructorSelect = document.getElementById("course-instructor");
    var categoryTabs = document.querySelectorAll(".course-filters [data-category]");
    var emptyState = document.getElementById("course-empty");
    var filterStatus = document.getElementById("course-filter-status");
    var category = "";
    var faDigits = new Intl.NumberFormat("fa-IR");

    // Match regardless of ی/ي, ک/ك and zero-width non-joiners
    function normalizeText(text) {
      return text.toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();
    }

    function applyFilters() {
      var query = normalizeText(searchInput.value);
      var instructor = instructorSelect.value;
      var shown = 0;
      cards.forEach(function (card) {
        var text = normalizeText(card.querySelector(".course-card__title").textContent + " " +
          card.querySelector(".course-card__desc").textContent);
        var match = (!category || card.getAttribute("data-category") === category) &&
          (!instructor || card.getAttribute("data-instructors").split(" ").indexOf(instructor) !== -1) &&
          (!query || text.indexOf(query) !== -1);
        if (match && card.hidden) {
          // Replay a short entrance for cards that come back into the results
          card.classList.remove("is-entering");
          void card.offsetWidth;
          card.classList.add("is-entering");
        }
        card.hidden = !match;
        if (match) { shown += 1; }
      });
      emptyState.hidden = shown > 0;
      var filtered = query || instructor || category;
      filterStatus.textContent = filtered ? faDigits.format(shown) + " دوره از " + faDigits.format(cards.length) + " دوره" : "";
    }

    categoryTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        categoryTabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t === tab)); });
        category = tab.getAttribute("data-category");
        applyFilters();
      });
    });
    searchInput.addEventListener("input", applyFilters);
    instructorSelect.addEventListener("change", applyFilters);
    document.getElementById("course-filters-reset").addEventListener("click", function () {
      searchInput.value = "";
      instructorSelect.value = "";
      categoryTabs[0].click();
    });
  }

  // Hero stats count up once they scroll into view (final values are already in the HTML)
  var counters = document.querySelectorAll("[data-count-to]");
  if (counters.length && "IntersectionObserver" in window && !prefersReduced) {
    var counterFormat = new Intl.NumberFormat("fa-IR", { useGrouping: false });
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          counterObserver.unobserve(entry.target);
          countUp(entry.target, Number(entry.target.getAttribute("data-count-to")), counterFormat.format, "+");
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (node) { counterObserver.observe(node); });
  }

  // Scroll reveal: [data-reveal] fades up once; children of [data-reveal-stagger] follow one after another
  document.querySelectorAll("[data-reveal-stagger]").forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.setAttribute("data-reveal", "");
      child.style.setProperty("--reveal-delay", Math.min(i, 6) * 70 + "ms");
    });
  });
  var revealTargets = document.querySelectorAll("[data-reveal]");
  if (revealTargets.length) {
    if ("IntersectionObserver" in window && !prefersReduced) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            revealObserver.unobserve(entry.target);
            entry.target.classList.add("is-visible");
          }
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
      revealTargets.forEach(function (node) { revealObserver.observe(node); });
    } else {
      revealTargets.forEach(function (node) { node.classList.add("is-visible"); });
    }
  }

  // Testimonials ribbon: repeat the cards until one set is wider than the box, then duplicate that set
  // so moving the track by half its width loops seamlessly
  var ticker = document.querySelector("[data-ticker]");
  if (ticker && !prefersReduced) {
    var track = ticker.querySelector(".ticker__track");
    var originals = Array.prototype.slice.call(track.children);
    var PX_PER_SECOND = 40;

    var buildTicker = function () {
      track.querySelectorAll("[data-ticker-clone]").forEach(function (node) { node.remove(); });
      ticker.classList.add("is-running");
      var addClone = function (node) {
        var clone = node.cloneNode(true);
        clone.setAttribute("data-ticker-clone", "");
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        track.appendChild(clone);
      };
      var setWidth = track.scrollWidth;
      var copies = 1;
      while (setWidth * copies < ticker.clientWidth && copies < 10) {
        originals.forEach(addClone);
        copies += 1;
      }
      // Second half: an exact copy of the first
      Array.prototype.slice.call(track.children).forEach(addClone);
      track.style.setProperty("--ticker-duration", Math.round((track.scrollWidth / 2) / PX_PER_SECOND) + "s");
    };

    buildTicker();
    var tickerWidth = ticker.clientWidth;
    var tickerTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(tickerTimer);
      tickerTimer = setTimeout(function () {
        if (ticker.clientWidth !== tickerWidth) { tickerWidth = ticker.clientWidth; buildTicker(); }
      }, 200);
    });
  }

  // Footer year
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) { yearEl.textContent = new Date().getFullYear(); }
})();
