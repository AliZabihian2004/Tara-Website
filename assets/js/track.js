// TARA — request tracking page («پیگیری درخواست»)
(function () {
  "use strict";

  var F = window.TaraForm;
  var form = document.getElementById("track-form");
  var results = document.getElementById("track-results");
  var list = document.getElementById("track-list");
  if (!form || !results || !list || !F) { return; }

  var STATUS_LABELS = { new: "جدید", in_progress: "در حال بررسی", done: "انجام‌شده" };
  var KIND_LABELS = { course_request: "درخواست دوره", consultation: "مشاوره" };
  var dateFormat = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });

  var codeInput = form.elements.code;
  var phoneInput = form.elements.phone;
  var alertBox = document.getElementById("track-alert");

  F.clearOnEdit([codeInput, phoneInput]);

  // ?code=TR-… from the link on the form success screens
  try {
    var preset = new URLSearchParams(window.location.search).get("code");
    if (preset) { codeInput.value = preset; }
  } catch (e) {}

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text) { node.textContent = text; }
    return node;
  }

  function subject(item) {
    if (item.kind === "consultation") {
      return item.company ? "مشاوره — " + item.company : "مشاوره رایگان";
    }
    return item.course_title + " — مدرس: " + item.instructor_name;
  }

  function dateRow(label, iso) {
    var row = el("div");
    row.appendChild(el("dt", "", label));
    row.appendChild(el("dd", "", dateFormat.format(new Date(iso))));
    return row;
  }

  function render(items, searchedCode) {
    list.textContent = "";
    items.forEach(function (item) {
      var card = el("li", "info-card track-item" + (item.tracking_code === searchedCode ? " is-current" : ""));

      var head = el("div", "track-item__head");
      var code = el("strong", "track-item__code", item.tracking_code);
      code.dir = "ltr";
      head.appendChild(code);
      head.appendChild(el("span", "badge badge--outline", KIND_LABELS[item.kind]));
      head.appendChild(el("span", "status-badge status-badge--" + item.status, STATUS_LABELS[item.status]));
      card.appendChild(head);

      card.appendChild(el("p", "track-item__subject", subject(item)));

      var dates = el("dl", "track-item__dates");
      dates.appendChild(dateRow("ثبت", item.created_at));
      dates.appendChild(dateRow("آخرین به‌روزرسانی", item.updated_at));
      card.appendChild(dates);

      if (item.client_message) {
        var message = el("div", "track-item__message");
        message.appendChild(el("strong", "", "پیام آکادمی تارا"));
        message.appendChild(el("p", "", item.client_message));
        card.appendChild(message);
      }

      list.appendChild(card);
    });
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // normalizeDigits also drops spaces and dashes: "tr-k7p4q9" → "TRK7P4Q9"; the prefix is optional
    var code = F.normalizeDigits(codeInput.value).toUpperCase();
    var phone = F.normalizeDigits(phoneInput.value);

    var valid = F.applyChecks([
      [codeInput, !/^(TR)?[A-Z0-9]{6}$/.test(code)],
      [phoneInput, !F.isValidPhone(phone)]
    ]);
    if (!valid) { return; }

    results.hidden = true;
    F.submit({
      form: form,
      alert: alertBox,
      url: "/api/track",
      data: { code: code, phone: phone },
      onSuccess: function (data) {
        render(data.items, "TR-" + (code.length === 8 ? code.slice(2) : code));
      }
    });
  });
})();
