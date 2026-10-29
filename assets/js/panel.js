// TARA — supervisor panel
(function () {
  "use strict";

  var page = document.body.getAttribute("data-page");

  var STATUS_LABELS = { new: "جدید", in_progress: "در حال بررسی", done: "انجام‌شده" };
  var KIND_LABELS = { course_request: "درخواست دوره", consultation: "مشاوره" };
  var ROLE_LABELS = { admin: "مدیر", supervisor: "سرپرست" };
  var SVG_NS = "http://www.w3.org/2000/svg";

  var dateFormat = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });
  var dayFormat = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" });
  var longDayFormat = new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long" });
  var numberFormat = new Intl.NumberFormat("fa-IR");

  function formatDate(iso) { return iso ? dateFormat.format(new Date(iso)) : "—"; }
  function formatNumber(n) { return numberFormat.format(n); }
  // Tickets created before the name fields existed have empty names
  function fullName(ticket) { return (ticket.first_name + " " + ticket.last_name).trim() || "—"; }
  function subject(ticket) {
    if (ticket.kind === "consultation") {
      return ticket.company ? "مشاوره — " + ticket.company : "مشاوره";
    }
    return ticket.course_title || "—";
  }

  // Seconds → «۳ ساعت و ۱۲ دقیقه»
  function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) { return "—"; }
    var minutes = Math.round(seconds / 60);
    if (minutes < 1) { return "کمتر از یک دقیقه"; }
    if (minutes < 60) { return formatNumber(minutes) + " دقیقه"; }
    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
      var rest = minutes % 60;
      return formatNumber(hours) + " ساعت" + (rest ? " و " + formatNumber(rest) + " دقیقه" : "");
    }
    var days = Math.floor(hours / 24);
    var restHours = hours % 24;
    return formatNumber(days) + " روز" + (restHours ? " و " + formatNumber(restHours) + " ساعت" : "");
  }

  // fetch JSON; a 401 anywhere except login sends the user to the login page
  function api(path, options) {
    options = options || {};
    options.credentials = "same-origin";
    if (options.body) { options.headers = { "Content-Type": "application/json" }; }
    return fetch(path, options).then(function (res) {
      if (res.status === 401 && page !== "login") {
        window.location.href = "login.html";
        return new Promise(function () {});
      }
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (data) {
          var err = new Error("HTTP " + res.status);
          err.status = res.status;
          err.errors = (data && data.errors) || {};
          throw err;
        });
      }
      return res.status === 204 ? null : res.json();
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  // Left-to-right value (phone, username) without flipping the whole cell on mobile
  function ltr(text) {
    var node = el("bdi", null, text);
    node.setAttribute("dir", "ltr");
    return node;
  }

  function setBadge(node, status) {
    var changed = /status-badge--/.test(node.className) && node.className.indexOf("status-badge--" + status) === -1;
    node.className = "status-badge status-badge--" + status;
    node.textContent = STATUS_LABELS[status] || status;
    if (changed) { replay(node, "is-changed"); }
  }

  // ---------- Motion helpers (CSS does nothing under reduced motion) ----------
  // Restart a one-shot CSS animation class
  function replay(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  // Short staggered entrance for freshly rendered rows
  function enter(node, index) {
    node.classList.add("row-enter");
    node.style.setProperty("--row-delay", Math.min(index, 8) * 25 + "ms");
  }

  function flash(node, text) {
    node.textContent = text;
    replay(node, "is-flash");
  }

  // Shimmering placeholder rows until the first response arrives
  function skeletonRows(tbody, columns, count) {
    tbody.textContent = "";
    for (var r = 0; r < (count || 5); r++) {
      var row = el("tr", "skeleton-row");
      row.setAttribute("aria-hidden", "true");
      for (var c = 0; c < columns; c++) {
        var cell = el("td");
        var bar = el("span", "skeleton skeleton--text");
        bar.style.width = (c === 0 ? 70 : 40 + ((r + c) % 3) * 15) + "%";
        cell.appendChild(bar);
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
  }

  function showAlert(node, text) {
    if (text) { node.textContent = text; }
    node.hidden = false;
  }

  function setInvalid(field, invalid) {
    if (invalid) { field.setAttribute("aria-invalid", "true"); } else { field.removeAttribute("aria-invalid"); }
  }

  function addOption(select, value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
    return option;
  }

  function queryParam(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch (e) { return null; }
  }

  // ---------- App shell: sidebar rail, mobile drawer ----------
  var SIDEBAR_KEY = "tara-sidebar";

  function initShell() {
    var root = document.documentElement;
    var sidebar = document.getElementById("app-sidebar");
    if (!sidebar) { return; }
    var collapseBtn = document.querySelector("[data-sidebar-collapse]");
    var openBtn = document.querySelector("[data-sidebar-open]");
    var closeBtn = document.querySelector("[data-sidebar-close]");
    var scrim = document.querySelector("[data-sidebar-scrim]");

    function syncCollapse() {
      var collapsed = root.classList.contains("sidebar-collapsed");
      if (collapseBtn) {
        collapseBtn.setAttribute("aria-pressed", String(collapsed));
        collapseBtn.setAttribute("aria-label", collapsed ? "باز کردن منو" : "جمع کردن منو");
      }
    }
    syncCollapse();
    if (collapseBtn) {
      collapseBtn.addEventListener("click", function () {
        var collapsed = root.classList.toggle("sidebar-collapsed");
        try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "open"); } catch (e) {}
        syncCollapse();
      });
    }

    // Below 960px the sidebar is an off-canvas drawer
    function setOpen(open) {
      sidebar.classList.toggle("is-open", open);
      if (scrim) { scrim.hidden = !open; }
      document.body.classList.toggle("has-sidebar", open);
      if (openBtn) { openBtn.setAttribute("aria-expanded", String(open)); }
      if (open) {
        var first = sidebar.querySelector(".app-nav__link");
        if (first) { first.focus(); }
      } else if (openBtn && sidebar.contains(document.activeElement)) {
        openBtn.focus();
      }
    }
    if (openBtn) { openBtn.addEventListener("click", function () { setOpen(true); }); }
    if (closeBtn) { closeBtn.addEventListener("click", function () { setOpen(false); }); }
    if (scrim) { scrim.addEventListener("click", function () { setOpen(false); }); }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sidebar.classList.contains("is-open")) { setOpen(false); }
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", function (mq) { if (mq.matches) { setOpen(false); } });
  }

  // Live count of new requests on the «درخواست‌ها» nav item
  var navBadge = null;
  var navCount = null;
  function setNavNew(count) {
    if (!navBadge) { navBadge = document.querySelector("[data-nav-new]"); }
    if (!navBadge) { return; }
    navBadge.hidden = !count;
    navBadge.textContent = formatNumber(count);
    navBadge.setAttribute("aria-label", formatNumber(count) + " درخواست جدید");
    if (navCount !== null && count !== navCount) { replay(navBadge, "is-bumped"); }
    navCount = count;
  }
  function refreshNavNew() {
    return api("/api/admin/tickets?status=new").then(function (data) { setNavNew(data.counts.new); }).catch(function () {});
  }

  // ---------- Header (signed-in pages) ----------
  var me = null;

  function initHeader() {
    return api("/api/auth/me").then(function (data) {
      me = data;
      var nameEl = document.querySelector("[data-user-name]");
      if (nameEl) { nameEl.textContent = me.display_name; }
      var initialEl = document.querySelector("[data-user-initial]");
      if (initialEl) { initialEl.textContent = (me.display_name || "?").trim().charAt(0); }
      var roleEl = document.querySelector("[data-user-role]");
      if (roleEl) { roleEl.textContent = ROLE_LABELS[me.role] || ""; }
      refreshNavNew();
      // Keep the badge fresh while the tab is open
      setInterval(function () { if (!document.hidden) { refreshNavNew(); } }, 60000);
      if (me.role === "admin") {
        document.querySelectorAll("[data-admin-only]").forEach(function (node) { node.hidden = false; });
      }
      var logout = document.querySelector("[data-logout]");
      if (logout) {
        logout.addEventListener("click", function () {
          api("/api/auth/logout", { method: "POST" }).then(function () {
            window.location.href = "login.html";
          });
        });
      }
      return me;
    });
  }

  // ---------- Login ----------
  function initLogin() {
    var form = document.getElementById("login-form");
    var alertBox = document.getElementById("login-alert");
    var submitBtn = form.querySelector("[type=submit]");

    // Already signed in → straight to the dashboard
    fetch("/api/auth/me", { credentials: "same-origin" }).then(function (res) {
      if (res.ok) { window.location.href = "dashboard.html"; }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      alertBox.hidden = true;
      submitBtn.disabled = true;

      api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: form.elements.username.value, password: form.elements.password.value })
      })
        .then(function () { window.location.href = "dashboard.html"; })
        .catch(function (err) {
          showAlert(alertBox, err.status === 401 ? "نام کاربری یا رمز عبور اشتباه است." : "ورود ناموفق بود؛ لطفاً دوباره تلاش کنید.");
          form.elements.password.value = "";
          form.elements.password.focus();
          submitBtn.disabled = false;
        });
    });
  }

  // ---------- Dashboard ----------
  var tooltip = null;

  function showTooltip(value, label, x, y) {
    tooltip.textContent = "";
    tooltip.appendChild(el("strong", "chart-tooltip__value", value));
    tooltip.appendChild(el("span", "chart-tooltip__label", label));
    tooltip.hidden = false;
    var box = tooltip.getBoundingClientRect();
    var left = Math.min(Math.max(8, x - box.width / 2), window.innerWidth - box.width - 8);
    var top = y - box.height - 10;
    if (top < 8) { top = y + 16; }
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }

  function hideTooltip() { if (tooltip) { tooltip.hidden = true; } }

  // Round the axis max up to 1, 2 or 5 × 10ⁿ so ticks land on clean numbers
  function niceMax(value) {
    if (value <= 4) { return 4; }
    var power = Math.pow(10, Math.floor(Math.log10(value)));
    var steps = [1, 2, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] * power >= value) { return steps[i] * power; }
    }
    return 10 * power;
  }

  // Bar with a 4px rounded data end and a square base
  function columnPath(x, y, width, height) {
    var r = Math.min(4, width / 2, height);
    return "M" + x + "," + (y + height) +
      "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y +
      "H" + (x + width - r) + "Q" + (x + width) + "," + y + " " + (x + width) + "," + (y + r) +
      "V" + (y + height) + "Z";
  }

  function renderDailyChart(container, daily, animate, avg) {
    container.textContent = "";
    container.classList.toggle("chart--animate", Boolean(animate));
    var width = Math.max(container.clientWidth, 280);
    var height = 240;
    var margin = { top: 24, right: 12, bottom: 32, left: 36 };
    var plotW = width - margin.left - margin.right;
    var plotH = height - margin.top - margin.bottom;
    var maxValue = daily.reduce(function (m, d) { return Math.max(m, d.count); }, 0);
    var yMax = niceMax(maxValue);
    var band = plotW / daily.length;
    var barW = Math.max(2, Math.min(24, band - 2)); // ≤24px, 2px surface gap between bars

    // Time runs left → right, as on any calendar axis
    var root = svg("svg", {
      viewBox: "0 0 " + width + " " + height, width: width, height: height,
      class: "chart__svg", role: "img", direction: "ltr",
      "aria-label": "نمودار ستونی تعداد درخواست در هر روز، " + formatNumber(daily.length) + " روز گذشته. برای مقادیر دقیق از نمایش جدول استفاده کنید."
    });

    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var value = (yMax / ticks) * t;
      var y = margin.top + plotH - (value / yMax) * plotH;
      root.appendChild(svg("line", { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: t === 0 ? "chart__baseline" : "chart__grid" }));
      var label = svg("text", { x: margin.left - 8, y: y + 4, class: "chart__tick", "text-anchor": "end" });
      label.textContent = formatNumber(value);
      root.appendChild(label);
    }

    var bars = [];
    var maxIndex = -1;
    daily.forEach(function (d, i) {
      if (d.count === maxValue && maxValue > 0) { maxIndex = i; }
    });

    daily.forEach(function (d, i) {
      var x = margin.left + band * i + (band - barW) / 2;
      var h = (d.count / yMax) * plotH;
      var y = margin.top + plotH - h;
      var bar = null;
      if (d.count > 0) {
        bar = svg("path", { d: columnPath(x, y, barW, h), class: "chart__bar" });
        bar.style.setProperty("--bar-delay", i * 12 + "ms");
        root.appendChild(bar);
      }
      bars.push({ bar: bar, x: x + barW / 2, y: y, data: d });

      // Label only the busiest day; axis, tooltip and table carry the rest
      if (i === maxIndex) {
        var peak = svg("text", { x: x + barW / 2, y: y - 6, class: "chart__value", "text-anchor": "middle" });
        peak.textContent = formatNumber(d.count);
        root.appendChild(peak);
      }

      // Date labels: every day for a week, every 5 days otherwise, plus today
      var every = daily.length <= 7 ? 1 : daily.length <= 14 ? 2 : 5;
      if (i % every === 0 || i === daily.length - 1) {
        var tick = svg("text", { x: x + barW / 2, y: height - 10, class: "chart__tick", "text-anchor": "middle" });
        tick.textContent = i === daily.length - 1 ? "امروز" : dayFormat.format(new Date(d.day + "T12:00:00"));
        root.appendChild(tick);
      }
    });

    // 7-day moving average (gold line) over the bars
    if (avg && avg.length === daily.length) {
      var pts = avg.map(function (v, i) { return [margin.left + band * i + band / 2, margin.top + plotH - (v / yMax) * plotH]; });
      var dPath = pts.map(function (pt, i) { return (i ? "L" : "M") + pt[0].toFixed(1) + "," + pt[1].toFixed(1); }).join("");
      root.appendChild(svg("path", { d: dPath, class: "chart__avg" }));
      var lastPt = pts[pts.length - 1];
      root.appendChild(svg("circle", { cx: lastPt[0], cy: lastPt[1], r: 3.5, class: "chart__avg-dot" }));
    }

    // Hit areas span the whole band and the full plot height
    var active = -1;
    function highlight(index, clientX, clientY) {
      bars.forEach(function (b, i) { if (b.bar) { b.bar.classList.toggle("is-active", i === index); } });
      active = index;
      if (index < 0) { hideTooltip(); return; }
      var b = bars[index];
      var count = b.data.count;
      var label = longDayFormat.format(new Date(b.data.day + "T12:00:00"));
      if (avg) { label += " · میانگین ۷ روزه: " + numberFormat.format(Math.round(avg[index] * 10) / 10); }
      showTooltip(formatNumber(count) + " درخواست", label, clientX, clientY);
    }

    bars.forEach(function (b, i) {
      var hit = svg("rect", { x: margin.left + band * i, y: margin.top, width: band, height: plotH, class: "chart__hit" });
      hit.addEventListener("pointermove", function (event) { highlight(i, event.clientX, event.clientY); });
      hit.addEventListener("pointerleave", function () { highlight(-1); });
      root.appendChild(hit);
    });

    // Keyboard: focus the chart, then ← → move between days
    root.setAttribute("tabindex", "0");
    root.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") { return; }
      event.preventDefault();
      var next = active < 0 ? daily.length - 1 : active + (event.key === "ArrowRight" ? 1 : -1);
      next = Math.max(0, Math.min(daily.length - 1, next));
      var rect = root.getBoundingClientRect();
      var scale = rect.width / width;
      highlight(next, rect.left + bars[next].x * scale, rect.top + bars[next].y * scale);
    });
    root.addEventListener("blur", function () { highlight(-1); });

    container.appendChild(root);
  }

  function renderDailyTable(container, daily) {
    container.textContent = "";
    var table = el("table", "data-table data-table--static data-table--compact");
    var head = el("thead");
    var headRow = el("tr");
    headRow.appendChild(el("th", null, "روز"));
    headRow.appendChild(el("th", null, "تعداد درخواست"));
    head.appendChild(headRow);
    table.appendChild(head);
    var body = el("tbody");
    daily.slice().reverse().forEach(function (d) {
      var row = el("tr");
      row.appendChild(el("td", null, longDayFormat.format(new Date(d.day + "T12:00:00"))));
      row.appendChild(el("td", "num", formatNumber(d.count)));
      body.appendChild(row);
    });
    table.appendChild(body);
    container.appendChild(table);
  }

  // Horizontal bars grow from the right (RTL), value at the tip
  function renderCourseBars(container, rows) {
    container.textContent = "";
    var max = rows.reduce(function (m, r) { return Math.max(m, r.n); }, 0);
    rows.forEach(function (r) {
      var row = el("div", "bar-list__row");
      row.appendChild(el("span", "bar-list__label", r.title));
      var track = el("span", "bar-list__track");
      var bar = el("span", "bar-list__bar");
      var width = max ? (r.n / max) * 100 + "%" : "0";
      bar.style.width = window.TaraMotion && !window.TaraMotion.reduced ? "0" : width;
      // Grow to the real width on the next frame so the transition runs
      window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { bar.style.width = width; }); });
      if (!r.n) { bar.classList.add("is-zero"); }
      track.appendChild(bar);
      track.appendChild(el("span", "bar-list__value", formatNumber(r.n)));
      row.appendChild(track);
      container.appendChild(row);
    });
    if (!rows.length) { container.appendChild(el("p", "text-muted", "هنوز درخواستی ثبت نشده است.")); }
  }

  // Tiny trend line for a KPI tile (decorative; the numbers are in the tile and chart)
  function renderSpark(container, daily) {
    if (!container || !daily.length) { return; }
    var w = 96, h = 32, max = Math.max(1, daily.reduce(function (m, d) { return Math.max(m, d.count); }, 0));
    var step = w / Math.max(1, daily.length - 1);
    var pts = daily.map(function (d, i) { return [i * step, h - 3 - (d.count / max) * (h - 6)]; });
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("");
    var root = svg("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
    root.appendChild(svg("path", { d: line + "L" + w + "," + h + "L0," + h + "Z", class: "spark__area" }));
    root.appendChild(svg("path", { d: line, class: "spark__line", pathLength: "1" }));
    var last = pts[pts.length - 1];
    root.appendChild(svg("circle", { cx: last[0], cy: last[1], r: 2.5, class: "spark__dot" }));
    container.textContent = "";
    container.appendChild(root);
  }

  // Share of each status; every part links to the filtered list
  function renderStatusBar(container, byStatus) {
    if (!container) { return; }
    var order = [["new", "var(--status-new)"], ["in_progress", "var(--status-progress)"], ["done", "var(--status-done)"]];
    var total = order.reduce(function (sum, o) { return sum + (byStatus[o[0]] || 0); }, 0);
    container.textContent = "";
    var track = el("div", "stack-bar__track");
    track.setAttribute("aria-hidden", "true");
    var legend = el("ul", "stack-bar__legend");
    order.forEach(function (o, i) {
      var n = byStatus[o[0]] || 0;
      if (n) {
        var seg = el("span", "stack-bar__seg");
        seg.setAttribute("data-s", o[0]);
        seg.style.setProperty("--n", n);
        seg.style.setProperty("--seg", o[1]);
        seg.style.setProperty("--d", i * 120 + "ms");
        track.appendChild(seg);
      }
      var li = el("li");
      var a = el("a", "stack-bar__item");
      a.href = "index.html?status=" + o[0];
      a.setAttribute("data-s", o[0]);
      a.style.setProperty("--seg", o[1]);
      a.appendChild(el("span", null, STATUS_LABELS[o[0]]));
      a.appendChild(el("b", null, formatNumber(n)));
      a.appendChild(el("small", null, total ? formatNumber(Math.round((n / total) * 100)) + "٪ از کل" : "—"));
      li.appendChild(a);
      legend.appendChild(li);
    });
    if (!total) { track.appendChild(el("span", "stack-bar__seg")); }
    container.appendChild(track);
    container.appendChild(legend);
  }

  // Course requests vs consultations as a donut; legend items link to the filtered list
  function renderKindDonut(container, byKind) {
    if (!container) { return; }
    var parts = [["course_request", "donut__arc--course", "var(--tone-1)"], ["consultation", "donut__arc--consult", "var(--tone-3)"]];
    var total = parts.reduce(function (sum, p) { return sum + (byKind[p[0]] || 0); }, 0);
    var r = 52, c = 2 * Math.PI * r;
    container.textContent = "";
    var wrap = el("div", "donut__wrap");
    var root = svg("svg", { viewBox: "0 0 140 140", class: "donut__svg", "aria-hidden": "true", focusable: "false" });
    root.appendChild(svg("circle", { cx: 70, cy: 70, r: r, class: "donut__ring" }));
    var offset = 0;
    parts.forEach(function (p, i) {
      var n = byKind[p[0]] || 0;
      if (!n || !total) { return; }
      var len = (n / total) * c;
      var gap = total > n ? 2 : 0;
      var arc = svg("circle", {
        cx: 70, cy: 70, r: r, class: "donut__arc " + p[1],
        "stroke-dasharray": Math.max(0, len - gap).toFixed(2) + " " + c.toFixed(2),
        "stroke-dashoffset": (-offset).toFixed(2)
      });
      arc.style.setProperty("--d", i * 150 + "ms");
      root.appendChild(arc);
      offset += len;
    });
    wrap.appendChild(root);
    var center = el("div", "donut__center");
    center.appendChild(el("b", null, formatNumber(total)));
    center.appendChild(el("span", null, "درخواست"));
    wrap.appendChild(center);
    container.appendChild(wrap);

    var legend = el("ul", "donut__legend");
    parts.forEach(function (p) {
      var n = byKind[p[0]] || 0;
      var li = el("li");
      var a = el("a", "donut__item");
      a.href = "index.html?kind=" + p[0];
      a.setAttribute("data-k", p[0]);
      var sw = el("span", "donut__swatch");
      sw.style.setProperty("--seg", p[2]);
      a.appendChild(sw);
      var text = el("span");
      text.appendChild(document.createTextNode(KIND_LABELS[p[0]]));
      text.appendChild(document.createElement("br"));
      text.appendChild(el("small", null, total ? formatNumber(Math.round((n / total) * 100)) + "٪" : "—"));
      a.appendChild(text);
      a.appendChild(el("b", null, formatNumber(n)));
      li.appendChild(a);
      legend.appendChild(li);
    });
    container.appendChild(legend);
  }

  function initDashboard() {
    tooltip = document.getElementById("chart-tooltip");
    var alertBox = document.getElementById("dashboard-alert");
    var dailyEl = document.getElementById("daily-chart");
    var dailyTable = document.getElementById("daily-table");
    var courseEl = document.getElementById("course-chart");
    var summaryEl = document.querySelector("[data-chart-summary]");
    var subEl = document.querySelector("[data-chart-sub]");
    var rangeBtns = document.querySelectorAll("[data-range]");
    var range = 30;
    var stats = null;

    function kpi(name, value) {
      var node = document.querySelector('[data-kpi="' + name + '"]');
      if (typeof value === "number" && window.TaraMotion) {
        node.textContent = "";
        window.TaraMotion.countUp(node, value, formatNumber);
      } else {
        node.textContent = value;
        replay(node, "is-loaded");
      }
    }
    function kpiMeta(name, text, tone) {
      var node = document.querySelector('[data-kpi-meta="' + name + '"]');
      node.textContent = text;
      node.className = "kpi__meta" + (tone ? " kpi__meta--" + tone : "");
    }

    function render() {
      kpi("new", stats.by_status.new);
      kpi("in_progress", stats.by_status.in_progress);
      kpiMeta("done", formatNumber(stats.by_status.done) + " انجام‌شده تا امروز");

      kpi("week", stats.this_week);
      var diff = stats.this_week - stats.last_week;
      if (diff > 0) {
        kpiMeta("week", "▲ " + formatNumber(diff) + " بیشتر از ۷ روز قبل از آن", "up");
      } else if (diff < 0) {
        kpiMeta("week", "▼ " + formatNumber(-diff) + " کمتر از ۷ روز قبل از آن", "down");
      } else {
        kpiMeta("week", "بدون تغییر نسبت به ۷ روز قبل از آن");
      }

      kpi("pickup", formatDuration(stats.median_pickup_seconds));
      kpiMeta("pickup", stats.picked_up_count
        ? "بر اساس " + formatNumber(stats.picked_up_count) + " درخواست پیگیری‌شده"
        : "هنوز درخواستی پیگیری نشده است");

      kpi("unassigned", stats.unassigned_open);
      kpiMeta("kind", formatNumber(stats.by_kind.course_request) + " درخواست دوره، " +
        formatNumber(stats.by_kind.consultation) + " مشاوره");

      renderRange(true);
      renderSpark(document.querySelector('[data-spark="week"]'), stats.daily.slice(-14));
      renderStatusBar(document.querySelector("[data-status-bar]"), stats.by_status);
      renderKindDonut(document.querySelector("[data-kind-donut]"), stats.by_kind);
    }

    // 7-day trailing average over the full 30 days, then sliced with the bars
    function movingAverage(daily) {
      return daily.map(function (d, i) {
        var from = Math.max(0, i - 6);
        var slice = daily.slice(from, i + 1);
        return slice.reduce(function (sum, x) { return sum + x.count; }, 0) / slice.length;
      });
    }

    function renderRange(animate) {
      var daily = stats.daily.slice(-range);
      var avg = range >= 14 ? movingAverage(stats.daily).slice(-range) : null;
      renderDailyChart(dailyEl, daily, animate, avg);
      renderDailyTable(dailyTable, daily);
      subEl.textContent = "تعداد درخواست‌های ثبت‌شده در هر روز، " + formatNumber(range) + " روز گذشته" +
        (avg ? " · خط طلایی: میانگین ۷ روزه" : "");

      var total = daily.reduce(function (sum, d) { return sum + d.count; }, 0);
      var busiest = daily.reduce(function (best, d) { return d.count > best.count ? d : best; }, daily[0]);
      summaryEl.textContent = "";
      [
        ["مجموع", formatNumber(total)],
        ["میانگین روزانه", numberFormat.format(Math.round((total / daily.length) * 10) / 10)],
        ["پرکارترین روز", busiest && busiest.count ? dayFormat.format(new Date(busiest.day + "T12:00:00")) + " (" + formatNumber(busiest.count) + ")" : "—"]
      ].forEach(function (pair) {
        var wrap = el("div");
        wrap.appendChild(el("dt", null, pair[0]));
        wrap.appendChild(el("dd", null, pair[1]));
        summaryEl.appendChild(wrap);
      });
    }

    rangeBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        range = Number(btn.getAttribute("data-range"));
        rangeBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        if (stats) { renderRange(true); }
      });
    });

    Promise.all([api("/api/admin/stats"), api("/api/catalog")])
      .then(function (results) {
        stats = results[0];
        var catalog = results[1];
        // Every course appears, even with no requests yet
        var counts = {};
        stats.by_course.forEach(function (c) { counts[c.slug] = c.n; });
        var rows = Object.keys(catalog.courses).map(function (slug) {
          return { title: catalog.courses[slug].title, n: counts[slug] || 0 };
        }).sort(function (a, b) { return b.n - a.n; });
        render();
        renderCourseBars(courseEl, rows);
      })
      .catch(function () {
        // Don't leave placeholders shimmering forever
        document.querySelectorAll("#kpis .skeleton, #daily-chart .skeleton, #course-chart .skeleton, [data-status-bar] .skeleton, [data-kind-donut] .skeleton").forEach(function (node) {
          node.replaceWith(node.closest(".kpi") ? "—" : "");
        });
        showAlert(alertBox);
      });

    var toggle = document.querySelector("[data-table-toggle]");
    toggle.addEventListener("click", function () {
      var open = dailyTable.hidden;
      dailyTable.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "پنهان کردن جدول" : "نمایش جدول";
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (stats) { renderRange(false); } }, 150);
    });
    window.addEventListener("scroll", hideTooltip, { passive: true });
  }

  // ---------- Ticket list: table / board + drawer ----------
  var VIEW_KEY = "tara-tickets-view";
  var relFormat = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("fa", { numeric: "auto" }) : null;

  function initials(name) { return (name || "").trim().charAt(0) || "؟"; }

  // «۵ دقیقه پیش», «دیروز» … for board cards; falls back to the full date
  function ago(iso) {
    if (!relFormat || !iso) { return formatDate(iso); }
    var diff = (new Date(iso).getTime() - Date.now()) / 1000;
    var abs = Math.abs(diff);
    if (abs < 60) { return "همین حالا"; }
    if (abs < 3600) { return relFormat.format(Math.round(diff / 60), "minute"); }
    if (abs < 86400) { return relFormat.format(Math.round(diff / 3600), "hour"); }
    if (abs < 86400 * 30) { return relFormat.format(Math.round(diff / 86400), "day"); }
    return formatDate(iso);
  }

  function plainClick(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function initList() {
    var storedView = null;
    try { storedView = localStorage.getItem(VIEW_KEY); } catch (e) {}
    var state = {
      status: queryParam("status") || "",
      kind: queryParam("kind") || "",
      assigned: queryParam("assigned") || "",
      course: "",
      q: "",
      page: 1,
      view: queryParam("view") || storedView || "table"
    };
    if (state.view !== "board") { state.view = "table"; }
    var body = document.getElementById("tickets-body");
    var alertBox = document.getElementById("list-alert");
    var kindSelect = document.getElementById("filter-kind");
    var assignedSelect = document.getElementById("filter-assigned");
    var courseSelect = document.getElementById("filter-course");
    var searchInput = document.getElementById("filter-q");
    var exportLink = document.getElementById("export-link");
    var tabs = document.querySelectorAll(".tabs__btn");
    var pagination = document.getElementById("pagination");
    var boardEl = document.getElementById("board");
    var boardLive = document.getElementById("board-live");
    var viewBtns = document.querySelectorAll("[data-view]");
    var main = document.querySelector(".app-content") || document.body;
    var searchTimer = null;
    var orderIds = [];   // what the drawer's previous/next walk through
    var byId = {};       // last seen version of each ticket
    var drawer = null;   // set up below

    assignedSelect.value = state.assigned;
    kindSelect.value = state.kind;
    tabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t.getAttribute("data-status") === state.status)); });

    api("/api/catalog").then(function (catalog) {
      Object.keys(catalog.courses).forEach(function (slug) {
        addOption(courseSelect, slug, catalog.courses[slug].title);
      });
    });

    function cell(row, label, content) {
      var td = document.createElement("td");
      td.setAttribute("data-label", label);
      if (typeof content === "string") { td.textContent = content; } else { td.appendChild(content); }
      row.appendChild(td);
      return td;
    }

    function params(withPage, overrides) {
      var p = new URLSearchParams();
      var s = Object.assign({}, state, overrides || {});
      ["status", "kind", "assigned", "course", "q"].forEach(function (key) {
        if (s[key]) { p.set(key, s[key]); }
      });
      if (withPage) { p.set("page", String(s.page)); }
      return p;
    }

    function remember(items) { items.forEach(function (t) { byId[t.id] = t; }); }

    // ----- Table -----
    function renderTable(data) {
      body.textContent = "";

      var all = data.counts.new + data.counts.in_progress + data.counts.done;
      document.querySelector('[data-count="all"]').textContent = formatNumber(all);
      Object.keys(data.counts).forEach(function (status) {
        document.querySelector('[data-count="' + status + '"]').textContent = formatNumber(data.counts[status]);
      });

      if (!data.items.length) {
        var empty = document.createElement("tr");
        var td = document.createElement("td");
        td.colSpan = 7;
        td.className = "data-table__empty";
        td.textContent = "درخواستی یافت نشد.";
        empty.appendChild(td);
        body.appendChild(empty);
      }

      remember(data.items);
      orderIds = data.items.map(function (t) { return t.id; });

      data.items.forEach(function (ticket, index) {
        var href = "ticket.html?id=" + ticket.id;
        var row = document.createElement("tr");
        row.setAttribute("data-ticket-id", ticket.id);
        enter(row, index);
        if (drawer && drawer.currentId() === ticket.id) { row.classList.add("is-selected"); }

        var link = document.createElement("a");
        link.href = href;
        link.dir = "ltr";
        link.textContent = ticket.tracking_code;
        // A plain click opens the side drawer; modifier clicks still open the full page
        link.addEventListener("click", function (event) {
          if (!plainClick(event)) { return; }
          event.preventDefault();
          drawer.open(ticket.id, link);
        });
        row.addEventListener("click", function (event) {
          if (event.target.closest("a")) { return; }
          if (!plainClick(event)) { window.open(href, "_blank"); return; }
          drawer.open(ticket.id, link);
        });

        cell(row, "کد پیگیری", link);
        cell(row, "تاریخ", formatDate(ticket.created_at));
        cell(row, "متقاضی", fullName(ticket));
        cell(row, "موضوع", subject(ticket));
        cell(row, "تلفن", ltr(ticket.phone));
        var assignee = cell(row, "مسئول", ticket.assigned_name || "—");
        if (!ticket.assigned_name) { assignee.classList.add("text-muted"); }
        var badge = document.createElement("span");
        setBadge(badge, ticket.status);
        cell(row, "وضعیت", badge);

        body.appendChild(row);
      });

      var pages = Math.max(1, Math.ceil(data.total / data.page_size));
      pagination.hidden = pages <= 1;
      pagination.querySelector("[data-page-label]").textContent =
        "صفحه " + formatNumber(data.page) + " از " + formatNumber(pages);
      pagination.querySelector("[data-page-prev]").disabled = data.page <= 1;
      pagination.querySelector("[data-page-next]").disabled = data.page >= pages;
    }

    // ----- Board -----
    var STATUSES = ["new", "in_progress", "done"];
    var dragging = null;

    function columnList(status) { return boardEl.querySelector('[data-board-list="' + status + '"]'); }

    function setColumnCount(status, n) {
      boardEl.querySelector('[data-board-count="' + status + '"]').textContent = formatNumber(n);
    }

    function emptyNote(list) {
      var hasCards = list.querySelector(".board-card");
      var note = list.querySelector(".board-col__empty");
      if (!hasCards && !note) {
        var li = el("li", "board-col__empty", "درخواستی در این ستون نیست.");
        li.setAttribute("aria-hidden", "true");
        list.appendChild(li);
      } else if (hasCards && note) {
        note.remove();
      }
    }

    function boardCard(ticket) {
      var li = el("li", "board-card");
      li.draggable = true;
      li.setAttribute("data-ticket-id", ticket.id);
      li.setAttribute("data-status", ticket.status);

      var top = el("div", "board-card__top");
      var open = el("button", "board-card__code");
      open.type = "button";
      open.appendChild(ltr(ticket.tracking_code));
      open.setAttribute("aria-label", "باز کردن درخواست " + ticket.tracking_code + " — " + fullName(ticket));
      open.addEventListener("click", function () { drawer.open(ticket.id, open); });
      top.appendChild(open);
      top.appendChild(el("span", "board-card__kind", KIND_LABELS[ticket.kind]));
      li.appendChild(top);

      li.appendChild(el("p", "board-card__name", fullName(ticket)));
      li.appendChild(el("p", "board-card__subject", subject(ticket)));

      var foot = el("div", "board-card__foot");
      var avatar = el("span", "board-card__avatar" + (ticket.assigned_name ? "" : " board-card__avatar--none"),
        ticket.assigned_name ? initials(ticket.assigned_name) : "؟");
      avatar.title = ticket.assigned_name ? "مسئول: " + ticket.assigned_name : "بدون مسئول";
      foot.appendChild(avatar);
      foot.appendChild(el("span", null, ago(ticket.created_at)));

      // Keyboard / touch alternative to dragging
      var move = el("select", "board-card__move");
      move.setAttribute("aria-label", "تغییر وضعیت " + ticket.tracking_code);
      STATUSES.forEach(function (s) { addOption(move, s, STATUS_LABELS[s]); });
      move.value = ticket.status;
      move.addEventListener("click", function (event) { event.stopPropagation(); });
      move.addEventListener("change", function () { moveTicket(ticket.id, move.value); });
      foot.appendChild(move);
      li.appendChild(foot);

      li.addEventListener("click", function (event) {
        if (event.target.closest("select, button")) { return; }
        drawer.open(ticket.id, open);
      });
      li.addEventListener("dragstart", function (event) {
        dragging = { id: ticket.id, from: li.getAttribute("data-status") };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(ticket.id));
        window.requestAnimationFrame(function () { li.classList.add("is-dragging"); });
      });
      li.addEventListener("dragend", function () {
        li.classList.remove("is-dragging");
        dragging = null;
        boardEl.querySelectorAll(".is-drop-target").forEach(function (c) { c.classList.remove("is-drop-target"); });
      });
      return li;
    }

    function renderBoard(results) {
      orderIds = [];
      STATUSES.forEach(function (status, i) {
        var data = results[i];
        var list = columnList(status);
        list.textContent = "";
        remember(data.items);
        data.items.forEach(function (ticket, index) {
          var card = boardCard(ticket);
          enter(card, index);
          list.appendChild(card);
          orderIds.push(ticket.id);
        });
        emptyNote(list);
        setColumnCount(status, data.total);
        var more = boardEl.querySelector('[data-board-more="' + status + '"]');
        var hiddenCount = data.total - data.items.length;
        more.hidden = hiddenCount <= 0;
        if (hiddenCount > 0) {
          more.textContent = "و " + formatNumber(hiddenCount) + " درخواست دیگر — نمایش در جدول";
          more.href = "index.html?" + params(false, { status: status }).toString() + "&view=table";
        }
      });
    }

    function columnCount(status) {
      var node = boardEl.querySelector('[data-board-count="' + status + '"]');
      return parseInt(node.textContent.replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }), 10) || 0;
    }

    function moveTicket(id, to) {
      var card = boardEl.querySelector('.board-card[data-ticket-id="' + id + '"]');
      if (!card) { return; }
      var from = card.getAttribute("data-status");
      if (from === to) { return; }
      var fromList = card.parentNode;
      var nextSibling = card.nextSibling;
      var toList = columnList(to);

      // Optimistic move; undone if the server refuses
      toList.insertBefore(card, toList.firstChild);
      card.setAttribute("data-status", to);
      card.classList.add("is-saving");
      emptyNote(fromList); emptyNote(toList);
      setColumnCount(from, columnCount(from) - 1);
      setColumnCount(to, columnCount(to) + 1);

      api("/api/admin/tickets/" + id, { method: "PATCH", body: JSON.stringify({ status: to }) })
        .then(function (ticket) {
          byId[ticket.id] = ticket;
          var fresh = boardCard(ticket);
          card.replaceWith(fresh);
          replay(fresh, "is-landed");
          boardLive.textContent = "«" + ticket.tracking_code + "» به ستون «" + STATUS_LABELS[to] + "» منتقل شد.";
          refreshNavNew();
          if (drawer.currentId() === ticket.id) { drawer.refresh(ticket); }
        })
        .catch(function () {
          fromList.insertBefore(card, nextSibling && nextSibling.parentNode === fromList ? nextSibling : null);
          card.setAttribute("data-status", from);
          card.classList.remove("is-saving");
          card.querySelector(".board-card__move").value = from;
          emptyNote(fromList); emptyNote(toList);
          setColumnCount(from, columnCount(from) + 1);
          setColumnCount(to, columnCount(to) - 1);
          showAlert(alertBox, "تغییر وضعیت ناموفق بود؛ لطفاً دوباره تلاش کنید.");
        });
    }

    boardEl.querySelectorAll(".board-col").forEach(function (col) {
      var status = col.getAttribute("data-board-status");
      col.addEventListener("dragover", function (event) {
        if (!dragging || dragging.from === status) { return; }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        col.classList.add("is-drop-target");
      });
      col.addEventListener("dragleave", function (event) {
        if (!col.contains(event.relatedTarget)) { col.classList.remove("is-drop-target"); }
      });
      col.addEventListener("drop", function (event) {
        event.preventDefault();
        col.classList.remove("is-drop-target");
        if (dragging && dragging.from !== status) { moveTicket(dragging.id, status); }
      });
    });

    // ----- Loading -----
    function load() {
      alertBox.hidden = true;
      var exportParams = params(false).toString();
      exportLink.href = "/api/admin/tickets/export.csv" + (exportParams ? "?" + exportParams : "");
      if (state.view === "board") {
        return Promise.all(STATUSES.map(function (s) {
          return api("/api/admin/tickets?" + params(false, { status: s }).toString());
        })).then(renderBoard).catch(function () { showAlert(alertBox); });
      }
      return api("/api/admin/tickets?" + params(true).toString())
        .then(renderTable)
        .catch(function () {
          body.querySelectorAll(".skeleton-row").forEach(function (row) { row.remove(); });
          showAlert(alertBox);
        });
    }

    function setView(view) {
      state.view = view;
      viewBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === view)); });
      main.classList.toggle("is-board", view === "board");
      boardEl.hidden = view !== "board";
      try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
      if (view === "table") { skeletonRows(body, 7); }
    }

    function filterChanged(key, value) {
      state[key] = value;
      state.page = 1;
      load();
    }

    viewBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.getAttribute("data-view") === state.view) { return; }
        setView(btn.getAttribute("data-view"));
        load();
      });
    });
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t === tab)); });
        filterChanged("status", tab.getAttribute("data-status"));
      });
    });
    kindSelect.addEventListener("change", function () { filterChanged("kind", kindSelect.value); });
    assignedSelect.addEventListener("change", function () { filterChanged("assigned", assignedSelect.value); });
    courseSelect.addEventListener("change", function () { filterChanged("course", courseSelect.value); });
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { filterChanged("q", searchInput.value.trim()); }, 300);
    });

    pagination.querySelector("[data-page-prev]").addEventListener("click", function () { state.page -= 1; load(); });
    pagination.querySelector("[data-page-next]").addEventListener("click", function () { state.page += 1; load(); });

    drawer = initDrawer({
      order: function () { return orderIds; },
      cached: function (id) { return byId[id]; },
      onSaved: function (ticket) { byId[ticket.id] = ticket; load(); refreshNavNew(); },
      onSelect: function (id) {
        document.querySelectorAll("[data-ticket-id].is-selected").forEach(function (n) { n.classList.remove("is-selected"); });
        if (id) {
          var row = document.querySelector('tr[data-ticket-id="' + id + '"]');
          if (row) { row.classList.add("is-selected"); }
        }
      }
    });

    setView(state.view);
    load().then(function () {
      // Deep link: index.html?ticket=123 opens that ticket in the drawer
      var deep = queryParam("ticket");
      if (deep && /^\d+$/.test(deep)) { drawer.open(Number(deep)); }
    });
  }

  // ---------- Ticket drawer (side panel on the list page) ----------
  function initDrawer(hooks) {
    var dialog = document.getElementById("ticket-drawer");
    var form = document.getElementById("drawer-form");
    var saveBtn = dialog.querySelector("[data-drawer-save]");
    var statusEl = dialog.querySelector("[data-drawer-status]");
    var alertEl = dialog.querySelector("[data-drawer-alert]");
    var assignSelect = form.elements.assigned_to;
    var timeline = dialog.querySelector("[data-drawer-timeline]");
    var bodyEl = dialog.querySelector("[data-drawer-body]");
    var current = null;   // ticket being shown
    var opener = null;
    var requestId = 0;
    var optionsReady = api("/api/admin/supervisors/options").then(function (options) {
      options.forEach(function (s) { addOption(assignSelect, String(s.id), s.display_name); });
    }).catch(function () {});

    function d(name) { return dialog.querySelector('[data-d="' + name + '"]'); }

    function formValues() {
      var checked = form.querySelector('input[name="status"]:checked');
      return {
        status: checked ? checked.value : current.status,
        note: form.elements.note.value,
        assigned_to: assignSelect.value ? Number(assignSelect.value) : null
      };
    }

    function isDirty() {
      if (!current) { return false; }
      var v = formValues();
      return v.status !== current.status || v.note !== current.note || v.assigned_to !== (current.assigned_to || null);
    }

    function syncDirty() {
      var dirty = isDirty();
      dialog.classList.toggle("is-dirty", dirty);
      saveBtn.disabled = !dirty;
      if (dirty) { statusEl.textContent = "تغییرات ذخیره‌نشده"; } else if (statusEl.textContent === "تغییرات ذخیره‌نشده") { statusEl.textContent = ""; }
    }

    function fill(ticket) {
      current = ticket;
      d("tracking_code").textContent = ticket.tracking_code;
      d("kind").textContent = KIND_LABELS[ticket.kind];
      setBadge(d("status"), ticket.status);
      d("subject").textContent = subject(ticket);
      d("created_at").textContent = formatDate(ticket.created_at);
      d("full_name").textContent = fullName(ticket);
      d("phone").textContent = ticket.phone;
      d("phone").href = "tel:" + ticket.phone;
      d("national_id").textContent = ticket.national_id || "—";
      d("company").textContent = ticket.company || "—";
      d("instructor_name").textContent = ticket.instructor_name || "—";
      d("updated").textContent = formatDate(ticket.updated_at) + (ticket.updated_by ? " · " + ticket.updated_by : "");
      d("message").textContent = ticket.message;
      dialog.querySelectorAll("[data-dkind]").forEach(function (n) { n.hidden = n.getAttribute("data-dkind") !== ticket.kind; });

      form.querySelectorAll('input[name="status"]').forEach(function (r) { r.checked = r.value === ticket.status; });
      form.elements.note.value = ticket.note || "";
      if (ticket.assigned_to && !assignSelect.querySelector('option[value="' + ticket.assigned_to + '"]')) {
        addOption(assignSelect, String(ticket.assigned_to), (ticket.assigned_name || "سرپرست") + " (غیرفعال)");
      }
      assignSelect.value = ticket.assigned_to ? String(ticket.assigned_to) : "";
      dialog.querySelector("[data-drawer-open-page]").href = "ticket.html?id=" + ticket.id;
      syncDirty();
    }

    function renderTimeline(events, ticket) {
      timeline.textContent = "";
      events.forEach(function (e, index) {
        var item = el("li", "timeline__item");
        enter(item, index);
        item.appendChild(el("span", "timeline__text", describeEvent(e)));
        item.appendChild(el("span", "timeline__time", formatDate(e.created_at)));
        timeline.appendChild(item);
      });
      var created = el("li", "timeline__item timeline__item--start");
      created.appendChild(el("span", "timeline__text",
        ticket.kind === "consultation" ? "درخواست مشاوره از سایت ثبت شد" : "درخواست دوره از سایت ثبت شد"));
      created.appendChild(el("span", "timeline__time", formatDate(ticket.created_at)));
      timeline.appendChild(created);
    }

    function updatePosition(id) {
      var order = hooks.order();
      var i = order.indexOf(id);
      var pos = dialog.querySelector("[data-drawer-pos]");
      pos.textContent = i >= 0 ? formatNumber(i + 1) + " از " + formatNumber(order.length) : "";
      dialog.querySelector("[data-drawer-prev]").disabled = i <= 0;
      dialog.querySelector("[data-drawer-next]").disabled = i < 0 || i >= order.length - 1;
    }

    function setUrl(id) {
      try {
        var url = new URL(window.location.href);
        if (id) { url.searchParams.set("ticket", id); } else { url.searchParams.delete("ticket"); }
        window.history.replaceState(null, "", url.toString());
      } catch (e) {}
    }

    function load(id) {
      var mine = ++requestId;
      alertEl.hidden = true;
      statusEl.textContent = "";
      dialog.classList.add("is-loading");
      var cached = hooks.cached(id);
      if (cached) { fill(cached); }
      updatePosition(id);
      hooks.onSelect(id);
      setUrl(id);
      bodyEl.scrollTop = 0;
      return optionsReady.then(function () {
        return Promise.all([api("/api/admin/tickets/" + id), api("/api/admin/tickets/" + id + "/events")]);
      }).then(function (results) {
        if (mine !== requestId) { return; }
        fill(results[0]);
        renderTimeline(results[1], results[0]);
      }).catch(function (err) {
        if (mine !== requestId) { return; }
        showAlert(alertEl, err.status === 404 ? "این درخواست پیدا نشد." : "دریافت درخواست ناموفق بود.");
      }).then(function () {
        if (mine === requestId) { dialog.classList.remove("is-loading"); }
      });
    }

    function confirmLeave() {
      return !isDirty() || window.confirm("تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟");
    }

    function open(id, trigger) {
      if (current && current.id === id && dialog.open) { return; }
      if (dialog.open && !confirmLeave()) { return; }
      if (trigger) { opener = trigger; }
      if (!dialog.open) {
        current = null;
        dialog.showModal();
        document.body.classList.add("has-dialog");
      }
      load(id);
    }

    function step(dir) {
      if (!current || !confirmLeave()) { return; }
      var order = hooks.order();
      var i = order.indexOf(current.id);
      var next = order[i + dir];
      if (next !== undefined) { current = null; load(next); }
    }

    dialog.querySelector("[data-drawer-close]").addEventListener("click", function () {
      if (confirmLeave()) { dialog.close(); }
    });
    dialog.querySelector("[data-drawer-prev]").addEventListener("click", function () { step(-1); });
    dialog.querySelector("[data-drawer-next]").addEventListener("click", function () { step(1); });
    dialog.querySelector("[data-drawer-assign-me]").addEventListener("click", function () {
      if (me) { assignSelect.value = String(me.id); syncDirty(); }
    });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog && confirmLeave()) { dialog.close(); }
    });
    dialog.addEventListener("cancel", function (event) {
      if (!confirmLeave()) { event.preventDefault(); }
    });
    dialog.addEventListener("close", function () {
      document.body.classList.remove("has-dialog");
      hooks.onSelect(null);
      setUrl(null);
      current = null;
      requestId++;
      if (opener && document.contains(opener)) { opener.focus(); }
    });
    form.addEventListener("input", syncDirty);
    form.addEventListener("change", syncDirty);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!current || !isDirty()) { return; }
      var id = current.id;
      saveBtn.disabled = true;
      statusEl.textContent = "در حال ذخیره…";
      api("/api/admin/tickets/" + id, { method: "PATCH", body: JSON.stringify(formValues()) })
        .then(function (ticket) {
          fill(ticket);
          flash(statusEl, "تغییرات ذخیره شد.");
          hooks.onSaved(ticket);
          return api("/api/admin/tickets/" + id + "/events").then(function (events) { renderTimeline(events, ticket); });
        })
        .catch(function (err) {
          statusEl.textContent = err.errors && err.errors.assigned_to
            ? "این سرپرست غیرفعال است؛ مسئول دیگری انتخاب کنید."
            : "ذخیره ناموفق بود؛ لطفاً دوباره تلاش کنید.";
          syncDirty();
        });
    });

    // Ctrl/⌘ + Enter saves from anywhere in the drawer
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (typeof form.requestSubmit === "function") { form.requestSubmit(); } else { form.dispatchEvent(new Event("submit", { cancelable: true })); }
      }
    });

    return {
      open: open,
      currentId: function () { return current ? current.id : null; },
      refresh: function (ticket) { if (!isDirty()) { fill(ticket); } }
    };
  }

  // ---------- Ticket detail ----------
  function describeEvent(e) {
    var who = e.supervisor_name || "یک سرپرست";
    if (e.field === "status") {
      return who + " وضعیت را از «" + (STATUS_LABELS[e.old_value] || e.old_value) + "» به «" +
        (STATUS_LABELS[e.new_value] || e.new_value) + "» تغییر داد";
    }
    if (e.field === "note") { return who + " یادداشت داخلی را به‌روز کرد"; }
    if (!e.new_value) { return who + " مسئول درخواست را برداشت"; }
    return who + " مسئولیت را به " + (e.new_assignee || "یک سرپرست") + " سپرد";
  }

  function initTicket() {
    var id = queryParam("id");
    var view = document.getElementById("ticket-view");
    var alertBox = document.getElementById("ticket-alert");
    var form = document.getElementById("ticket-form");
    var saveStatus = document.getElementById("save-status");
    var submitBtn = form.querySelector("[type=submit]");
    var assignSelect = form.elements.assigned_to;
    var timeline = document.getElementById("timeline");
    var skeleton = document.getElementById("ticket-skeleton");

    function field(name) { return document.querySelector('[data-field="' + name + '"]'); }

    function render(ticket) {
      var title = "درخواست " + ticket.tracking_code;
      document.title = title + " | پنل سرپرست تارا";
      document.querySelector("[data-ticket-title]").textContent = title;
      document.querySelector("[data-ticket-crumb]").textContent = title;
      document.querySelector("[data-ticket-kind]").textContent = KIND_LABELS[ticket.kind];
      setBadge(document.querySelector("[data-ticket-status]"), ticket.status);

      document.querySelectorAll("[data-kind]").forEach(function (node) {
        node.hidden = node.getAttribute("data-kind") !== ticket.kind;
      });

      field("message").textContent = ticket.message;
      field("full_name").textContent = fullName(ticket);
      field("national_id").textContent = ticket.national_id || "—";
      field("company").textContent = ticket.company || "—";
      field("course_title").textContent = ticket.course_title || "—";
      field("instructor_name").textContent = ticket.instructor_name || "—";
      field("phone").textContent = ticket.phone;
      field("phone").href = "tel:" + ticket.phone;
      field("created_at").textContent = formatDate(ticket.created_at);
      field("updated_at").textContent = formatDate(ticket.updated_at);
      field("updated_by").textContent = ticket.updated_by || "—";

      form.elements.status.value = ticket.status;
      form.elements.note.value = ticket.note;
      // A ticket can still point at a supervisor who was disabled later
      if (ticket.assigned_to && !assignSelect.querySelector('option[value="' + ticket.assigned_to + '"]')) {
        addOption(assignSelect, String(ticket.assigned_to), (ticket.assigned_name || "سرپرست") + " (غیرفعال)");
      }
      assignSelect.value = ticket.assigned_to ? String(ticket.assigned_to) : "";
      skeleton.hidden = true;
      view.hidden = false;
    }

    function renderTimeline(events, ticket) {
      timeline.textContent = "";
      events.forEach(function (e, index) {
        var item = el("li", "timeline__item");
        enter(item, index);
        item.appendChild(el("span", "timeline__text", describeEvent(e)));
        item.appendChild(el("span", "timeline__time", formatDate(e.created_at)));
        timeline.appendChild(item);
      });
      var created = el("li", "timeline__item timeline__item--start");
      enter(created, events.length);
      created.appendChild(el("span", "timeline__text",
        ticket.kind === "consultation" ? "درخواست مشاوره از سایت ثبت شد" : "درخواست دوره از سایت ثبت شد"));
      created.appendChild(el("span", "timeline__time", formatDate(ticket.created_at)));
      timeline.appendChild(created);
    }

    function loadTimeline(ticket) {
      return api("/api/admin/tickets/" + id + "/events").then(function (events) { renderTimeline(events, ticket); });
    }

    if (!id || !/^\d+$/.test(id)) {
      skeleton.hidden = true;
      showAlert(alertBox, "شناسه درخواست نامعتبر است.");
      return;
    }

    api("/api/admin/supervisors/options")
      .then(function (options) {
        options.forEach(function (s) { addOption(assignSelect, String(s.id), s.display_name); });
        return api("/api/admin/tickets/" + id);
      })
      .then(function (ticket) {
        render(ticket);
        return loadTimeline(ticket);
      })
      .catch(function (err) {
        skeleton.hidden = true;
        showAlert(alertBox, err.status === 404 ? "این درخواست پیدا نشد." : "دریافت درخواست ناموفق بود.");
      });

    document.querySelector("[data-assign-me]").addEventListener("click", function () {
      assignSelect.value = String(me.id);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitBtn.disabled = true;
      saveStatus.textContent = "در حال ذخیره…";

      api("/api/admin/tickets/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.elements.status.value,
          note: form.elements.note.value,
          assigned_to: assignSelect.value ? Number(assignSelect.value) : null
        })
      })
        .then(function (ticket) {
          render(ticket);
          flash(saveStatus, "تغییرات ذخیره شد.");
          return loadTimeline(ticket);
        })
        .catch(function (err) {
          saveStatus.textContent = err.errors && err.errors.assigned_to
            ? "این سرپرست غیرفعال است؛ مسئول دیگری انتخاب کنید."
            : "ذخیره ناموفق بود؛ لطفاً دوباره تلاش کنید.";
        })
        .then(function () { submitBtn.disabled = false; });
    });
  }

  // ---------- Supervisors (admin) ----------
  function initSupervisors() {
    if (me.role !== "admin") {
      window.location.href = "dashboard.html";
      return;
    }

    var body = document.getElementById("supervisors-body");
    var alertBox = document.getElementById("supervisors-alert");
    var addForm = document.getElementById("add-supervisor-form");
    var addStatus = document.getElementById("add-status");
    var dialog = document.getElementById("edit-dialog");
    var editForm = document.getElementById("edit-supervisor-form");
    var editAlert = document.getElementById("edit-alert");
    var editing = null;

    skeletonRows(body, 6, 4);

    function load() {
      alertBox.hidden = true;
      api("/api/admin/supervisors").then(render).catch(function () {
        body.querySelectorAll(".skeleton-row").forEach(function (row) { row.remove(); });
        showAlert(alertBox, "دریافت فهرست سرپرستان ناموفق بود.");
      });
    }

    function update(id, changes) {
      return api("/api/admin/supervisors/" + id, { method: "PATCH", body: JSON.stringify(changes) });
    }

    function render(list) {
      body.textContent = "";
      list.forEach(function (s, index) {
        var isMe = s.id === me.id;
        var row = el("tr");
        enter(row, index);
        if (!s.is_active) { row.classList.add("is-inactive"); }

        var name = el("td");
        name.setAttribute("data-label", "نام");
        name.appendChild(document.createTextNode(s.display_name));
        if (isMe) { name.appendChild(el("span", "badge badge--outline", "شما")); }
        row.appendChild(name);

        var username = el("td");
        username.setAttribute("data-label", "نام کاربری");
        username.appendChild(ltr(s.username));
        row.appendChild(username);

        var role = el("td");
        role.setAttribute("data-label", "نقش");
        role.appendChild(el("span", s.role === "admin" ? "badge" : "badge badge--outline", ROLE_LABELS[s.role]));
        row.appendChild(role);

        var open = el("td", "num", formatNumber(s.open_tickets));
        open.setAttribute("data-label", "تیکت‌های باز");
        row.appendChild(open);

        var status = el("td");
        status.setAttribute("data-label", "وضعیت");
        status.appendChild(el("span", s.is_active ? "status-badge status-badge--done" : "status-badge status-badge--inactive",
          s.is_active ? "فعال" : "غیرفعال"));
        row.appendChild(status);

        var actionsCell = el("td");
        actionsCell.setAttribute("data-label", "عملیات");
        var actions = el("div", "data-table__actions");
        actionsCell.appendChild(actions);
        var edit = el("button", "btn btn--ghost btn--sm", "ویرایش");
        edit.type = "button";
        edit.addEventListener("click", function () { openEdit(s); });
        actions.appendChild(edit);
        if (!isMe) {
          var toggle = el("button", "btn btn--secondary btn--sm", s.is_active ? "غیرفعال‌کردن" : "فعال‌کردن");
          toggle.type = "button";
          toggle.addEventListener("click", function () {
            if (s.is_active && !window.confirm("«" + s.display_name + "» غیرفعال شود؟ این کاربر فوراً از پنل خارج می‌شود.")) { return; }
            toggle.disabled = true;
            update(s.id, { is_active: !s.is_active }).then(load).catch(function () {
              toggle.disabled = false;
              showAlert(alertBox, "تغییر وضعیت ناموفق بود.");
            });
          });
          actions.appendChild(toggle);
        }
        row.appendChild(actionsCell);
        body.appendChild(row);
      });
    }

    function openEdit(s) {
      editing = s;
      editAlert.hidden = true;
      editForm.elements.display_name.value = s.display_name;
      editForm.elements.role.value = s.role;
      editForm.elements.role.disabled = s.id === me.id; // can't demote yourself
      editForm.elements.password.value = "";
      [editForm.elements.display_name, editForm.elements.password].forEach(function (f) { setInvalid(f, false); });
      dialog.showModal();
    }

    dialog.querySelector("[data-dialog-close]").addEventListener("click", function () { dialog.close(); });

    editForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var nameValue = editForm.elements.display_name.value.trim();
      var password = editForm.elements.password.value;
      var nameBad = nameValue.length < 2 || nameValue.length > 50;
      var passwordBad = password !== "" && password.length < 8;
      setInvalid(editForm.elements.display_name, nameBad);
      setInvalid(editForm.elements.password, passwordBad);
      if (nameBad || passwordBad) { return; }

      var changes = { display_name: nameValue };
      if (editing.id !== me.id) { changes.role = editForm.elements.role.value; }
      if (password) { changes.password = password; }
      update(editing.id, changes)
        .then(function () { dialog.close(); load(); })
        .catch(function () { showAlert(editAlert, "ذخیره ناموفق بود؛ لطفاً دوباره تلاش کنید."); });
    });

    addForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var f = addForm.elements;
      var username = f.username.value.trim().toLowerCase();
      var name = f.display_name.value.trim();
      var checks = [
        [f.display_name, name.length < 2 || name.length > 50],
        [f.username, !/^[a-z0-9._-]{3,32}$/.test(username)],
        [f.password, f.password.value.length < 8]
      ];
      var usernameError = document.getElementById("new-username-error");
      usernameError.textContent = usernameError.getAttribute("data-error-default");
      var firstInvalid = null;
      checks.forEach(function (c) {
        setInvalid(c[0], c[1]);
        if (c[1] && !firstInvalid) { firstInvalid = c[0]; }
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      addStatus.textContent = "در حال افزودن…";
      api("/api/admin/supervisors", {
        method: "POST",
        body: JSON.stringify({ username: username, display_name: name, password: f.password.value, role: f.role.value })
      })
        .then(function () {
          flash(addStatus, "«" + name + "» اضافه شد.");
          addForm.reset();
          load();
        })
        .catch(function (err) {
          addStatus.textContent = "";
          if (err.errors && err.errors.username === "taken") {
            usernameError.textContent = usernameError.getAttribute("data-error-taken");
            setInvalid(f.username, true);
            f.username.focus();
          } else {
            addStatus.textContent = "افزودن ناموفق بود؛ لطفاً دوباره تلاش کنید.";
          }
        });
    });

    load();
  }

  // ---------- Course schedules ----------
  var JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  var DAY_MS = 86400000;
  var persianParts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
  var tehranPersianParts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { timeZone: "Asia/Tehran", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  var scheduleDayFormat = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long" });

  function partsOf(format, date) {
    var out = {};
    format.formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }

  // UTC midnight (ms) → { y, m, d } in the Jalali calendar
  function toJalali(ms) {
    var p = partsOf(persianParts, new Date(ms));
    return { y: parseInt(p.year, 10), m: parseInt(p.month, 10), d: parseInt(p.day, 10) };
  }

  // Jalali date → UTC midnight (ms) of the Gregorian day, or null if the date doesn't exist (e.g. 31 Mehr)
  function fromJalali(y, m, d) {
    var target = y * 10000 + m * 100 + d;
    var ms = Date.UTC(y + 621, 2, 21) + ((m - 1) * 31 - Math.max(m - 7, 0) + d - 1) * DAY_MS;
    for (var i = 0; i < 6; i++) {
      var j = toJalali(ms);
      var key = j.y * 10000 + j.m * 100 + j.d;
      if (key === target) { return ms; }
      var step = key < target ? DAY_MS : -DAY_MS;
      var nextJ = toJalali(ms + step);
      var nextKey = nextJ.y * 10000 + nextJ.m * 100 + nextJ.d;
      // Stepped over the target without hitting it → no such day
      if ((key < target) !== (nextKey <= target) && nextKey !== target) { return null; }
      ms += step;
    }
    return null;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // ISO timestamp → the Jalali date and Tehran time shown in the editor
  function sessionFields(iso) {
    var p = partsOf(tehranPersianParts, new Date(iso));
    return { y: parseInt(p.year, 10), m: parseInt(p.month, 10), d: parseInt(p.day, 10), time: pad(parseInt(p.hour, 10)) + ":" + p.minute };
  }

  var SCHEDULE_STATES = {
    none: { label: "زمان‌بندی نشده", badge: "inactive" },
    upcoming: { label: "شروع نشده", badge: "new" },
    running: { label: "در حال برگزاری", badge: "done" },
    finished: { label: "پایان‌یافته", badge: "inactive" }
  };

  function initSchedule() {
    if (me.role !== "admin") {
      window.location.href = "dashboard.html";
      return;
    }

    var body = document.getElementById("schedule-body");
    var alertBox = document.getElementById("schedule-alert");
    var form = document.getElementById("schedule-form");
    var formTitle = document.getElementById("schedule-form-title");
    var emptyHint = document.getElementById("schedule-empty");
    var editor = document.getElementById("schedule-editor");
    var rows = document.getElementById("session-rows");
    var formAlert = document.getElementById("schedule-form-alert");
    var formStatus = document.getElementById("schedule-status");
    var submitBtn = form.querySelector("[type=submit]");
    var thisYear = toJalali(Date.now()).y;
    var courses = [];
    var editing = null;

    skeletonRows(body, 5, 6);

    function load() {
      alertBox.hidden = true;
      return api("/api/admin/schedules").then(function (list) {
        courses = list;
        render();
      }).catch(function () {
        body.querySelectorAll(".skeleton-row").forEach(function (row) { row.remove(); });
        showAlert(alertBox, "دریافت زمان‌بندی دوره‌ها ناموفق بود.");
      });
    }

    function render() {
      body.textContent = "";
      courses.forEach(function (c, index) {
        var row = el("tr");
        enter(row, index);
        var title = el("td", null, c.title);
        title.setAttribute("data-label", "دوره");
        row.appendChild(title);

        var count = el("td", "num", formatNumber(c.status.total));
        count.setAttribute("data-label", "جلسات");
        row.appendChild(count);

        var state = SCHEDULE_STATES[c.status.state];
        var label = state.label;
        if (c.status.state === "running") { label += " · جلسه " + formatNumber(c.status.current) + " از " + formatNumber(c.status.total); }
        var status = el("td");
        status.setAttribute("data-label", "وضعیت");
        status.appendChild(el("span", "status-badge status-badge--" + state.badge, label));
        row.appendChild(status);

        var next = el("td", null, c.status.next_at ? scheduleDayFormat.format(new Date(c.status.next_at)) : "—");
        next.setAttribute("data-label", "جلسه بعد");
        row.appendChild(next);

        var actionsCell = el("td");
        actionsCell.setAttribute("data-label", "عملیات");
        var actions = el("div", "data-table__actions");
        var edit = el("button", "btn btn--ghost btn--sm", "ویرایش");
        edit.type = "button";
        edit.addEventListener("click", function () { openEditor(c); });
        actions.appendChild(edit);
        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);
        body.appendChild(row);
      });
    }

    function select(className, label, options, value) {
      var node = el("select", "form-control " + className);
      node.setAttribute("aria-label", label);
      options.forEach(function (o) { addOption(node, String(o[0]), o[1]); });
      node.value = String(value);
      return node;
    }

    function addRow(fields) {
      var item = el("li", "session-row");
      var number = el("span", "session-row__number");
      item.appendChild(number);

      var days = [];
      for (var d = 1; d <= 31; d++) { days.push([d, formatNumber(d)]); }
      var months = JALALI_MONTHS.map(function (name, i) { return [i + 1, name]; });
      var years = [];
      for (var y = Math.min(thisYear - 1, fields.y); y <= Math.max(thisYear + 2, fields.y); y++) { years.push([y, formatNumber(y).replace(/٬/g, "")]); }

      var date = el("div", "session-row__date");
      date.appendChild(select("session-row__day", "روز", days, fields.d));
      date.appendChild(select("session-row__month", "ماه", months, fields.m));
      date.appendChild(select("session-row__year", "سال", years, fields.y));
      item.appendChild(date);

      var time = el("input", "form-control session-row__time");
      time.type = "time";
      time.value = fields.time;
      time.setAttribute("aria-label", "ساعت");
      time.setAttribute("dir", "ltr");
      item.appendChild(time);

      var title = el("input", "form-control session-row__title");
      title.type = "text";
      title.maxLength = 100;
      title.placeholder = "عنوان جلسه (اختیاری)";
      title.value = fields.title || "";
      item.appendChild(title);

      var remove = el("button", "btn btn--ghost btn--sm session-row__remove", "حذف");
      remove.type = "button";
      remove.addEventListener("click", function () {
        // Fade the row out first, unless motion is off
        if (window.TaraMotion && window.TaraMotion.reduced) { item.remove(); renumber(); return; }
        item.classList.add("is-leaving");
        setTimeout(function () { item.remove(); renumber(); }, 200);
      });
      item.appendChild(remove);

      rows.appendChild(item);
      renumber();
    }

    function renumber() {
      rows.querySelectorAll(".session-row__number").forEach(function (node, i) { node.textContent = "جلسه " + formatNumber(i + 1); });
    }

    function readRow(item) {
      function val(cls) { return item.querySelector("." + cls).value; }
      return {
        y: parseInt(val("session-row__year"), 10),
        m: parseInt(val("session-row__month"), 10),
        d: parseInt(val("session-row__day"), 10),
        time: val("session-row__time"),
        title: val("session-row__title").trim()
      };
    }

    function openEditor(course) {
      editing = course;
      formTitle.textContent = "جلسات «" + course.title + "»";
      emptyHint.hidden = true;
      editor.hidden = false;
      formAlert.hidden = true;
      formStatus.textContent = "";
      rows.textContent = "";
      course.sessions.forEach(function (s) {
        var f = sessionFields(s.starts_at);
        f.title = s.title;
        addRow(f);
      });
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    document.getElementById("add-session").addEventListener("click", function () {
      var items = rows.querySelectorAll(".session-row");
      var fields;
      var last = items.length ? readRow(items[items.length - 1]) : null;
      var lastMs = last ? fromJalali(last.y, last.m, last.d) : null;
      if (lastMs !== null) {
        // One week after the previous session, same time
        var j = toJalali(lastMs + 7 * DAY_MS);
        fields = { y: j.y, m: j.m, d: j.d, time: last.time || "10:00" };
      } else {
        var t = toJalali(Date.now());
        fields = { y: t.y, m: t.m, d: t.d, time: "10:00" };
      }
      addRow(fields);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!editing) { return; }
      formAlert.hidden = true;
      formStatus.textContent = "";

      var sessions = [];
      var invalid = null;
      rows.querySelectorAll(".session-row").forEach(function (item, i) {
        var f = readRow(item);
        var ms = fromJalali(f.y, f.m, f.d);
        if (ms === null || !/^\d{2}:\d{2}$/.test(f.time)) {
          if (invalid === null) { invalid = i + 1; }
          return;
        }
        var g = new Date(ms);
        sessions.push({
          starts_at: g.getUTCFullYear() + "-" + pad(g.getUTCMonth() + 1) + "-" + pad(g.getUTCDate()) + "T" + f.time + ":00+03:30",
          title: f.title
        });
      });
      if (invalid !== null) {
        showAlert(formAlert, "تاریخ یا ساعت جلسه " + formatNumber(invalid) + " معتبر نیست.");
        return;
      }

      submitBtn.disabled = true;
      api("/api/admin/courses/" + editing.slug + "/sessions", { method: "PUT", body: JSON.stringify({ sessions: sessions }) })
        .then(function () {
          var slug = editing.slug;
          return load().then(function () {
            var fresh = courses.filter(function (c) { return c.slug === slug; })[0];
            if (fresh) { openEditor(fresh); }
            flash(formStatus, "ذخیره شد.");
          });
        })
        .catch(function () { showAlert(formAlert, "ذخیره ناموفق بود؛ لطفاً دوباره تلاش کنید."); })
        .then(function () { submitBtn.disabled = false; });
    });

    load();
  }

  // ---------- Account ----------
  function initAccount() {
    document.querySelector('[data-account="display_name"]').textContent = me.display_name;
    document.querySelector('[data-account="username"]').textContent = me.username;
    document.querySelector('[data-account="role"]').textContent = ROLE_LABELS[me.role];

    var form = document.getElementById("password-form");
    var status = document.getElementById("password-status");
    var f = form.elements;

    [f.current, f.new, f.repeat].forEach(function (field) {
      field.addEventListener("input", function () { setInvalid(field, false); });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      status.textContent = "";
      var checks = [
        [f.current, !f.current.value],
        [f.new, f.new.value.length < 8],
        [f.repeat, f.repeat.value !== f.new.value]
      ];
      var firstInvalid = null;
      checks.forEach(function (c) {
        setInvalid(c[0], c[1]);
        if (c[1] && !firstInvalid) { firstInvalid = c[0]; }
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      status.textContent = "در حال ذخیره…";
      api("/api/auth/password", { method: "POST", body: JSON.stringify({ current: f.current.value, new: f.new.value }) })
        .then(function () {
          form.reset();
          flash(status, "رمز عبور تغییر کرد.");
        })
        .catch(function (err) {
          status.textContent = "";
          if (err.errors && err.errors.current) {
            setInvalid(f.current, true);
            f.current.focus();
          } else {
            status.textContent = "تغییر رمز ناموفق بود؛ لطفاً دوباره تلاش کنید.";
          }
        });
    });
  }

  if (page === "login") {
    initLogin();
  } else {
    initShell();
    initHeader().then(function () {
      if (page === "dashboard") { initDashboard(); }
      if (page === "list") { initList(); }
      if (page === "ticket") { initTicket(); }
      if (page === "supervisors") { initSupervisors(); }
      if (page === "schedule") { initSchedule(); }
      if (page === "account") { initAccount(); }
    });
  }
})();
