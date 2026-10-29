// TARA — animated course-page backgrounds (Canvas 2D, drawn in brand tokens).
// <canvas data-course-bg data-motif="neural|ledger|paths" data-intensity="0..1" data-tone="inverse?">
// Motif defaults to <body data-motif>. Pauses off-screen; one still frame under reduced motion.
(function () {
  "use strict";

  var canvases = document.querySelectorAll("canvas[data-course-bg]");
  if (!canvases.length || !window.CanvasRenderingContext2D) { return; }

  var reduced = window.TaraMotion ? window.TaraMotion.reduced :
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var rtl = document.documentElement.getAttribute("dir") === "rtl";

  // Token colors as CSS strings (canvas accepts OKLCH directly in current browsers)
  var probe = document.createElement("span");
  probe.style.display = "none";
  document.body.appendChild(probe);
  function token(name) {
    probe.style.color = "var(" + name + ")";
    return getComputedStyle(probe).color;
  }
  function palette(tone) {
    if (tone === "inverse") {
      return { line: token("--color-primary-200"), node: token("--color-primary-100"), soft: token("--color-primary-300"), gold: token("--color-gold-300"), grid: token("--color-primary-400") };
    }
    return { line: token("--accent"), node: token("--accent"), soft: token("--color-primary-300"), gold: token("--accent-2"), grid: token("--border-strong") };
  }

  // Small seeded random so every visit looks the same composition
  function rng(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

  // ---------------- Motifs ----------------
  // Each returns { resize(w,h), draw(ctx, t, dt, pointer) }

  function neural(w, h, k, rand) {
    var nodes = [];
    var pulses = [];
    var edges = [];
    var spawn = 0;
    function build() {
      nodes = [];
      var count = Math.round(Math.max(28, Math.min(72, (w * h) / 14000)) * (0.55 + 0.45 * k));
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: rand() * w, y: rand() * h,
          vx: (rand() - 0.5) * 0.12, vy: (rand() - 0.5) * 0.12,
          r: 1.4 + rand() * 1.8, hub: rand() < 0.12, ph: rand() * 6.28
        });
      }
    }
    build();
    var D = 150;
    return {
      resize: function (nw, nh) { w = nw; h = nh; build(); },
      draw: function (ctx, t, dt, p, c) {
        var i, j, a, b, dx, dy, d;
        for (i = 0; i < nodes.length; i++) {
          a = nodes[i];
          a.x += a.vx * dt; a.y += a.vy * dt;
          if (a.x < -20) { a.x = w + 20; } if (a.x > w + 20) { a.x = -20; }
          if (a.y < -20) { a.y = h + 20; } if (a.y > h + 20) { a.y = -20; }
          if (p.active) {
            dx = p.x - a.x; dy = p.y - a.y; d = Math.sqrt(dx * dx + dy * dy);
            if (d < 180 && d > 1) { a.x += dx / d * 0.25 * dt * (1 - d / 180); a.y += dy / d * 0.25 * dt * (1 - d / 180); }
          }
        }
        edges = [];
        ctx.lineWidth = 1;
        ctx.strokeStyle = c.line;
        for (i = 0; i < nodes.length; i++) {
          for (j = i + 1; j < nodes.length; j++) {
            a = nodes[i]; b = nodes[j];
            dx = a.x - b.x; dy = a.y - b.y; d = dx * dx + dy * dy;
            if (d < D * D) {
              d = Math.sqrt(d);
              ctx.globalAlpha = (1 - d / D) * 0.42 * k;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
              edges.push([i, j]);
            }
          }
        }
        // Pointer links in gold
        if (p.active) {
          ctx.strokeStyle = c.gold;
          for (i = 0; i < nodes.length; i++) {
            a = nodes[i]; dx = p.x - a.x; dy = p.y - a.y; d = Math.sqrt(dx * dx + dy * dy);
            if (d < 170) { ctx.globalAlpha = (1 - d / 170) * 0.55 * k; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
          }
        }
        // Signals travelling along edges
        spawn -= dt;
        if (spawn <= 0 && edges.length) {
          var e = edges[Math.floor(rand() * edges.length)];
          pulses.push({ a: e[0], b: e[1], t: 0 });
          spawn = 22 + rand() * 30;
        }
        ctx.fillStyle = c.gold;
        for (i = pulses.length - 1; i >= 0; i--) {
          var s = pulses[i];
          s.t += dt / 70;
          if (s.t >= 1) { pulses.splice(i, 1); continue; }
          a = nodes[s.a]; b = nodes[s.b];
          var x = a.x + (b.x - a.x) * s.t, y = a.y + (b.y - a.y) * s.t;
          ctx.globalAlpha = 0.25 * k; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 0.95 * k; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.283); ctx.fill();
        }
        // Nodes; hubs breathe with a gold ring
        for (i = 0; i < nodes.length; i++) {
          a = nodes[i];
          ctx.fillStyle = c.node;
          ctx.globalAlpha = 0.65 * k;
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
          if (a.hub) {
            ctx.strokeStyle = c.gold;
            ctx.globalAlpha = (0.35 + 0.25 * Math.sin(t * 1.4 + a.ph)) * k;
            ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 5 + 2 * Math.sin(t * 1.4 + a.ph), 0, 6.283); ctx.stroke();
          }
        }
      }
    };
  }

  function ledger(w, h, k, rand) {
    var seeds = [rand() * 10, rand() * 10, rand() * 10];
    var bars = [];
    function build() { bars = []; for (var x = 0; x < w + 40; x += 26) { bars.push(rand()); } }
    build();
    function series(x, t, s, base, amp) {
      return base + amp * (0.55 * Math.sin(x * 0.006 + t * 0.35 + s) + 0.3 * Math.sin(x * 0.017 - t * 0.5 + s * 2) + 0.15 * Math.sin(x * 0.041 + t * 0.8 + s * 3));
    }
    function path(ctx, t, s, base, amp, step) {
      var pts = [];
      for (var x = -step; x <= w + step; x += step) { pts.push([x, series(x, t, s, base, amp)]); }
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length - 1; i++) {
        var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      return pts;
    }
    return {
      resize: function (nw, nh) { w = nw; h = nh; build(); },
      draw: function (ctx, t, dt, p, c) {
        var x, y, i;
        // Ledger grid
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
        ctx.globalAlpha = 0.22 * k;
        ctx.beginPath();
        for (x = 0.5; x < w; x += 32) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (y = 0.5; y < h; y += 32) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
        // Volume bars breathing along the bottom
        ctx.fillStyle = c.soft;
        for (i = 0; i < bars.length; i++) {
          var bh = (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.6 + bars[i] * 6.28))) * h * 0.35;
          ctx.globalAlpha = 0.12 * k;
          ctx.fillRect(i * 26 + 6, h - bh, 12, bh);
        }
        // Main series with an area fill
        var base = h * 0.55, amp = h * 0.18;
        var pts = path(ctx, t, seeds[0], base, amp, 28);
        ctx.lineTo(w + 40, h); ctx.lineTo(-40, h); ctx.closePath();
        var g = ctx.createLinearGradient(0, base - amp, 0, h);
        g.addColorStop(0, c.line); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.globalAlpha = 0.12 * k; ctx.fill();
        path(ctx, t, seeds[0], base, amp, 28);
        ctx.strokeStyle = c.line; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 * k; ctx.stroke();
        // Secondary series
        path(ctx, t * 0.8, seeds[1], h * 0.4, h * 0.14, 28);
        ctx.strokeStyle = c.soft; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5 * k; ctx.stroke();
        path(ctx, t * 1.1, seeds[2], h * 0.68, h * 0.1, 28);
        ctx.strokeStyle = c.gold; ctx.lineWidth = 1.25; ctx.globalAlpha = 0.55 * k; ctx.stroke();
        // Data points on the main series
        ctx.fillStyle = c.line;
        for (i = 2; i < pts.length; i += 4) { ctx.globalAlpha = 0.7 * k; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 2.5, 0, 6.283); ctx.fill(); }
        // Scanning cursor: follows the pointer when present, otherwise sweeps slowly
        var sx = p.active ? p.x : ((rtl ? 1 - ((t * 0.04) % 1) : (t * 0.04) % 1) * w);
        var sy = series(sx, t, seeds[0], base, amp);
        ctx.strokeStyle = c.gold; ctx.lineWidth = 1; ctx.globalAlpha = 0.5 * k;
        ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = c.gold;
        ctx.globalAlpha = 0.25 * k; ctx.beginPath(); ctx.arc(sx, sy, 9, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1 * k; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 6.283); ctx.fill();
      }
    };
  }

  function paths(w, h, k, rand) {
    var routes = [];
    var focus = { x: 0, y: 0 };
    function build() {
      routes = [];
      var n = Math.round(10 + 6 * k);
      for (var i = 0; i < n; i++) {
        var ang = (i / n) * 6.283 + rand() * 0.4;
        var rad = 0.55 + rand() * 0.5;
        routes.push({
          ox: 0.5 + Math.cos(ang) * rad * 0.75, oy: 0.5 + Math.sin(ang) * rad * 0.9,
          bend: (rand() - 0.5) * 0.5,
          movers: [rand(), rand()], speed: 0.0016 + rand() * 0.0016
        });
      }
    }
    build();
    function bez(r, f, s) {
      var ox = r.ox * w, oy = r.oy * h;
      var cx = (ox + f.x) / 2 + (f.y - oy) * r.bend, cy = (oy + f.y) / 2 - (f.x - ox) * r.bend;
      var u = 1 - s;
      return { x: u * u * ox + 2 * u * s * cx + s * s * f.x, y: u * u * oy + 2 * u * s * cy + s * s * f.y, ox: ox, oy: oy, cx: cx, cy: cy };
    }
    return {
      resize: function (nw, nh) { w = nw; h = nh; build(); },
      draw: function (ctx, t, dt, p, c) {
        // Focal point sits away from the text side, drifting gently (and toward the pointer)
        // Desktop: in the gutter beside the info card, low down; stacked mobile layout: near the top
        var wide = w >= 860;
        var fx = (wide ? (rtl ? 0.43 : 0.57) : 0.5) * w + Math.sin(t * 0.3) * 18;
        var fy = (wide ? 0.82 : 0.12) * h + Math.cos(t * 0.25) * 12;
        if (p.active) { fx += (p.x - fx) * 0.15; fy += (p.y - fy) * 0.15; }
        if (!focus.init) { focus.x = fx; focus.y = fy; focus.init = true; }
        var ease = Math.min(1, 0.08 * Math.max(dt, 0.0001));
        focus.x += (fx - focus.x) * ease;
        focus.y += (fy - focus.y) * ease;
        var i, r, q;
        ctx.lineWidth = 1.25;
        for (i = 0; i < routes.length; i++) {
          r = routes[i];
          q = bez(r, focus, 0);
          ctx.strokeStyle = c.line; ctx.globalAlpha = 0.22 * k;
          ctx.beginPath(); ctx.moveTo(q.ox, q.oy); ctx.quadraticCurveTo(q.cx, q.cy, focus.x, focus.y); ctx.stroke();
          ctx.fillStyle = c.node; ctx.globalAlpha = 0.6 * k;
          ctx.beginPath(); ctx.arc(q.ox, q.oy, 3, 0, 6.283); ctx.fill();
          // People moving toward the shared goal
          for (var m = 0; m < r.movers.length; m++) {
            r.movers[m] = (r.movers[m] + r.speed * dt) % 1;
            var s = r.movers[m];
            var pt = bez(r, focus, s);
            ctx.fillStyle = c.gold;
            ctx.globalAlpha = Math.sin(s * 3.1416) * 0.9 * k;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.4, 0, 6.283); ctx.fill();
          }
        }
        // Focal rings breathing outward
        ctx.strokeStyle = c.gold; ctx.lineWidth = 1;
        for (i = 0; i < 3; i++) {
          var ph = ((t * 0.25 + i / 3) % 1);
          ctx.globalAlpha = (1 - ph) * 0.6 * k;
          ctx.beginPath(); ctx.arc(focus.x, focus.y, 10 + ph * 70, 0, 6.283); ctx.stroke();
        }
        ctx.fillStyle = c.line; ctx.globalAlpha = 0.9 * k;
        ctx.beginPath(); ctx.arc(focus.x, focus.y, 6, 0, 6.283); ctx.fill();
        ctx.fillStyle = c.gold; ctx.globalAlpha = 1 * k;
        ctx.beginPath(); ctx.arc(focus.x, focus.y, 2.5, 0, 6.283); ctx.fill();
      }
    };
  }

  var MOTIFS = { neural: neural, ledger: ledger, paths: paths };
  var defaultMotif = document.body.getAttribute("data-motif") || "neural";

  // ---------------- Scene runner ----------------
  var scenes = [];
  Array.prototype.forEach.call(canvases, function (canvas, index) {
    var ctx = canvas.getContext("2d");
    if (!ctx) { return; }
    var motif = MOTIFS[canvas.getAttribute("data-motif") || defaultMotif] || neural;
    var k = Math.max(0.1, Math.min(1, parseFloat(canvas.getAttribute("data-intensity") || "1")));
    var tone = canvas.getAttribute("data-tone") || "";
    var host = canvas.parentElement;
    var scene = { canvas: canvas, ctx: ctx, k: k, tone: tone, colors: palette(tone), visible: false, w: 0, h: 0, t: 12, pointer: { x: 0, y: 0, active: false } };
    scene.resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) { return; }
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!scene.motif) { scene.motif = motif(w, h, k, rng(1234 + index * 97)); } else { scene.motif.resize(w, h); }
      scene.w = w; scene.h = h;
      scene.render(0);
    };
    scene.render = function (dt) {
      ctx.clearRect(0, 0, scene.w, scene.h);
      ctx.globalAlpha = 1;
      scene.motif.draw(ctx, scene.t, dt, scene.pointer, scene.colors);
      ctx.globalAlpha = 1;
    };
    if (finePointer && !reduced) {
      host.addEventListener("pointermove", function (e) {
        var r = canvas.getBoundingClientRect();
        scene.pointer.x = e.clientX - r.left; scene.pointer.y = e.clientY - r.top; scene.pointer.active = true;
      });
      host.addEventListener("pointerleave", function () { scene.pointer.active = false; });
    }
    scenes.push(scene);
    scene.resize();
    canvas.classList.add("is-ready");
  });

  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (en) { scenes.forEach(function (s) { if (s.canvas === en.target) { s.resize(); } }); });
    });
    scenes.forEach(function (s) { ro.observe(s.canvas); });
  } else {
    window.addEventListener("resize", function () { scenes.forEach(function (s) { s.resize(); }); });
  }

  // Theme switch: re-read token colors
  new MutationObserver(function () {
    scenes.forEach(function (s) { s.colors = palette(s.tone); s.render(0); });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  if (reduced) { return; } // still frames only

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { scenes.forEach(function (s) { if (s.canvas === en.target) { s.visible = en.isIntersecting; } }); });
    });
    scenes.forEach(function (s) { io.observe(s.canvas); });
  } else {
    scenes.forEach(function (s) { s.visible = true; });
  }

  var last = null;
  function tick(now) {
    var dt = last === null ? 1 : Math.min(3, (now - last) / 16.667); // in 60fps frames
    last = now;
    if (!document.hidden) {
      scenes.forEach(function (s) {
        if (!s.visible || !s.motif) { return; }
        s.t += dt / 60;
        s.render(dt);
      });
    }
    window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);
})();
