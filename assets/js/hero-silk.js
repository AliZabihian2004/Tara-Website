// TARA — hero "silk" background: slow navy/gold ribbons echoing the logo swoosh.
// WebGL only; if it isn't available the CSS glow layer stays as the background.
// Colors come from design tokens (re-read on theme change). Reduced motion → one still frame.
(function () {
  "use strict";

  var hero = document.querySelector("[data-hero]");
  var canvas = hero && hero.querySelector("[data-hero-silk]");
  if (!canvas) { return; }

  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl) { return; }

  var reduced = window.TaraMotion ? window.TaraMotion.reduced :
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  var FRAG = [
    "precision mediump float;",
    "uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uRtl;",
    "uniform vec3 uDeep; uniform vec3 uSoft; uniform vec3 uGold; uniform float uStrength;",
    // One ribbon: a soft body plus a thin bright edge, drifting along a sine path
    "vec2 ribbon(vec2 uv, float seed, float speed, float amp, float width){",
    "  float x = uv.x;",
    "  float y = 0.5 + amp * sin(x * 2.1 + uTime * speed + seed)",
    "              + amp * 0.45 * sin(x * 4.7 - uTime * speed * 1.3 + seed * 2.0)",
    "              + (uMouse.y - 0.5) * 0.06 * sin(x * 3.14 + seed);",
    "  float w = width * (0.6 + 0.4 * sin(x * 3.0 + uTime * speed * 0.7 + seed));",
    "  float d = abs(uv.y - y);",
    "  float body = smoothstep(w, 0.0, d);",
    "  float edge = exp(-d * 260.0) * 0.9;",
    "  return vec2(body, edge);",
    "}",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRes;",
    "  float aspect = uRes.x / uRes.y;",
    "  vec2 q = uv - 0.5; q.x *= aspect;",
    // Tilt like the logo swoosh (mirrored for RTL so ribbons rise toward the text side)
    "  float a = mix(0.32, -0.32, uRtl);",
    "  q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;",
    "  q.x /= aspect; q += 0.5;",
    "  q += (uMouse - 0.5) * 0.03;",
    "  vec2 r1 = ribbon(q, 0.0, 0.11, 0.16, 0.16);",
    "  vec2 r2 = ribbon(q + vec2(0.0, 0.09), 1.7, 0.08, 0.13, 0.11);",
    "  vec2 r3 = ribbon(q - vec2(0.0, 0.12), 3.4, 0.14, 0.10, 0.07);",
    "  vec3 col = vec3(0.0); float alpha = 0.0;",
    "  col += uSoft * r1.x * 0.9;  alpha += r1.x * 0.55;",
    "  col += uDeep * r2.x * 0.8;  alpha += r2.x * 0.45;",
    "  col += uSoft * r3.x * 0.6;  alpha += r3.x * 0.30;",
    "  col += uGold * (r1.y * 0.9 + r3.y * 0.6); alpha += (r1.y * 0.9 + r3.y * 0.6) * 0.8;",
    "  col += uSoft * r2.y * 0.5;  alpha += r2.y * 0.35;",
    // Quieter behind the text column (inline-start side), fade at top/bottom edges
    "  float textSide = mix(uv.x, 1.0 - uv.x, uRtl);",
    "  float calm = mix(1.0, 0.45, smoothstep(0.45, 0.85, 1.0 - textSide));",
    "  float edges = smoothstep(0.0, 0.18, uv.y) * smoothstep(1.0, 0.7, uv.y);",
    "  alpha = clamp(alpha, 0.0, 1.0) * calm * edges * uStrength;",
    "  col = clamp(col, 0.0, 1.0);",
    "  gl_FragColor = vec4(col * alpha, alpha);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["uRes", "uTime", "uMouse", "uRtl", "uDeep", "uSoft", "uGold", "uStrength"].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });
  gl.uniform1f(U.uRtl, getComputedStyle(hero).direction === "rtl" ? 1 : 0);

  // Resolve a CSS color token (OKLCH) to linear 0..1 RGB through a 1px canvas
  var probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  var pctx = probe.getContext("2d", { willReadFrequently: true });
  var tokenEl = document.createElement("span");
  tokenEl.style.display = "none";
  hero.appendChild(tokenEl);
  function tokenRGB(name) {
    tokenEl.style.color = "var(" + name + ")";
    pctx.clearRect(0, 0, 1, 1);
    pctx.fillStyle = "#000";
    pctx.fillStyle = getComputedStyle(tokenEl).color;
    pctx.fillRect(0, 0, 1, 1);
    var d = pctx.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }
  function applyColors() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    gl.uniform3fv(U.uDeep, tokenRGB(dark ? "--color-primary-700" : "--color-primary-300"));
    gl.uniform3fv(U.uSoft, tokenRGB(dark ? "--color-primary-500" : "--color-primary-200"));
    gl.uniform3fv(U.uGold, tokenRGB(dark ? "--color-gold-500" : "--color-gold-300"));
    gl.uniform1f(U.uStrength, dark ? 0.55 : 0.75);
    if (!running) { draw(lastT); }
  }

  var SCALE = 0.75; // render below device resolution; the ribbons are soft anyway
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * SCALE;
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.uRes, w, h);
    }
  }

  var mouse = [0.5, 0.5];
  var target = [0.5, 0.5];
  var lastT = 18.0; // a pleasing still frame for reduced motion
  var start = null;
  var running = false;
  var visible = true;

  function draw(t) {
    mouse[0] += (target[0] - mouse[0]) * 0.04;
    mouse[1] += (target[1] - mouse[1]) * 0.04;
    gl.uniform1f(U.uTime, t);
    gl.uniform2f(U.uMouse, mouse[0], mouse[1]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame(now) {
    if (!running) { return; }
    if (start === null) { start = now - lastT * 1000; }
    lastT = (now - start) / 1000;
    draw(lastT);
    window.requestAnimationFrame(frame);
  }
  function play() {
    if (running || reduced || !visible || document.hidden) { return; }
    running = true;
    start = null;
    window.requestAnimationFrame(frame);
  }
  function pause() { running = false; }

  resize();
  applyColors();
  draw(lastT);
  hero.classList.add("has-silk");

  window.addEventListener("resize", function () { resize(); if (!running) { draw(lastT); } });
  new MutationObserver(applyColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("visibilitychange", function () { if (document.hidden) { pause(); } else { play(); } });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) { play(); } else { pause(); }
    }).observe(hero);
  }
  if (!reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      target[0] = (e.clientX - r.left) / r.width;
      target[1] = 1 - (e.clientY - r.top) / r.height;
    });
    hero.addEventListener("pointerleave", function () { target = [0.5, 0.5]; });
  }
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); pause(); hero.classList.remove("has-silk"); });
  play();
})();
