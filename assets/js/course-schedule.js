// TARA — course schedule timeline on course pages (needs the API; stays hidden without it)
// Courses without sessions show a "coming soon" note instead of the timeline
(function () {
  "use strict";

  var section = document.querySelector("[data-course-schedule]");
  if (!section) { return; }

  var slug = section.getAttribute("data-course-schedule");
  var statusEl = section.querySelector(".course-schedule__status");
  var list = section.querySelector(".course-timeline");

  var TZ = "Asia/Tehran";
  var dayFormat = new Intl.DateTimeFormat("fa-IR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  var fullFormat = new Intl.DateTimeFormat("fa-IR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  var timeFormat = new Intl.DateTimeFormat("fa-IR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  var numberFormat = new Intl.NumberFormat("fa-IR");

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function n(value) { return numberFormat.format(value); }
  function day(iso) { return dayFormat.format(new Date(iso)); }

  // «چهارشنبه ۸ مهر ۱۴۰۵»; the built-in fa-IR order with a year is inconsistent across browsers
  function fullDate(date) {
    var p = {};
    fullFormat.formatToParts(date).forEach(function (part) { p[part.type] = part.value; });
    return p.weekday + " " + p.day + " " + p.month + " " + p.year;
  }

  function statusText(status) {
    if (status.state === "none") { return "زمان‌بندی این دوره به‌زودی اعلام می‌شود"; }
    if (status.state === "upcoming") { return "شروع دوره: " + day(status.next_at); }
    if (status.state === "finished") { return "این دوره به پایان رسیده است"; }
    var text = "در حال برگزاری — جلسه " + n(status.current) + " از " + n(status.total);
    return status.next_at ? text + " · جلسه بعد: " + day(status.next_at) : text;
  }

  function render(data) {
    var status = data.status;
    statusEl.textContent = statusText(status);
    statusEl.classList.toggle("is-muted", status.state === "finished" || status.state === "none");

    data.sessions.forEach(function (s) {
      var item = el("li", "course-timeline__item is-" + s.state);
      var head = el("div", "course-timeline__head");
      head.appendChild(el("span", "course-timeline__number", "جلسه " + n(s.number)));
      if (s.state === "today") { head.appendChild(el("span", "course-timeline__today", "امروز")); }
      item.appendChild(head);
      if (s.title) { item.appendChild(el("span", "course-timeline__title", s.title)); }
      var date = new Date(s.starts_at);
      var time = el("time", "course-timeline__date", fullDate(date) + " · ساعت " + timeFormat.format(date));
      time.setAttribute("datetime", s.starts_at);
      item.appendChild(time);
      list.appendChild(item);
    });

    section.hidden = false;
  }

  fetch("/api/courses/" + encodeURIComponent(slug) + "/schedule")
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { if (data) { render(data); } })
    .catch(function () {});
})();
