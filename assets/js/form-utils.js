// TARA — helpers shared by the public forms (course request, consultation)
window.TaraForm = (function () {
  "use strict";

  var PHONE_PATTERN = /^(\+98|0098|0)9\d{9}$/;

  // Persian (۰-۹) and Arabic (٠-٩) digits → Latin, strip spaces and dashes
  function normalizeDigits(value) {
    return value
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[\s\-()]/g, "");
  }

  function isValidPhone(phone) { return PHONE_PATTERN.test(phone); }

  function isValidName(name, maxLength) {
    return name.length >= 2 && name.length <= (maxLength || 50) && !/\d/.test(normalizeDigits(name));
  }

  function setInvalid(field, invalid) {
    if (invalid) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  }

  // checks: [[field, isInvalid], …] in page order; focuses the first invalid field
  function applyChecks(checks) {
    var firstInvalid = null;
    checks.forEach(function (check) {
      setInvalid(check[0], check[1]);
      if (check[1] && !firstInvalid) { firstInvalid = check[0]; }
    });
    if (firstInvalid) { firstInvalid.focus(); }
    return !firstInvalid;
  }

  // Clear a field's error as soon as the user edits it
  function clearOnEdit(fields) {
    fields.forEach(function (field) {
      var eventName = field.tagName === "SELECT" ? "change" : "input";
      field.addEventListener(eventName, function () { setInvalid(field, false); });
    });
  }

  /* POST JSON and drive the shared submit states:
     2xx → onSuccess(responseJson); 422 → mark the fields the server rejected;
     429 → say when to try again; anything else → show the alert. */
  function submit(options) {
    var form = options.form;
    var button = form.querySelector("[type=submit]");
    var label = button.textContent;

    // The alert's own text is the generic error; remember it since a 429 replaces it
    if (!options.alert.dataset.text) { options.alert.dataset.text = options.alert.textContent; }
    options.alert.hidden = true;
    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = "در حال ارسال…";

    return fetch(options.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.data)
    })
      .then(function (res) {
        if (res.ok) {
          return res.json().then(options.onSuccess);
        }
        if (res.status === 422) {
          return res.json().then(function (data) {
            var names = Object.keys((data && data.errors) || {});
            names.forEach(function (name) {
              if (form.elements[name]) { setInvalid(form.elements[name], true); }
            });
            if (names.length && form.elements[names[0]]) { form.elements[names[0]].focus(); }
          });
        }
        if (res.status === 429) {
          var minutes = Math.max(1, Math.ceil(Number(res.headers.get("Retry-After")) / 60)) || 60;
          options.alert.textContent = "تعداد درخواست‌های ارسالی از این دستگاه بیش از حد مجاز است؛ لطفاً حدود " +
            minutes.toLocaleString("fa-IR") + " دقیقه دیگر دوباره تلاش کنید.";
          options.alert.hidden = false;
          return;
        }
        throw new Error("HTTP " + res.status);
      })
      .catch(function () {
        options.alert.textContent = options.alert.dataset.text;
        options.alert.hidden = false;
      })
      .then(function () {
        button.disabled = false;
        button.classList.remove("is-loading");
        button.textContent = label;
      });
  }

  return {
    normalizeDigits: normalizeDigits,
    isValidPhone: isValidPhone,
    isValidName: isValidName,
    setInvalid: setInvalid,
    applyChecks: applyChecks,
    clearOnEdit: clearOnEdit,
    submit: submit
  };
})();
