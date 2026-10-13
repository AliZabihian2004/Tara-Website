// TARA — course request form
(function () {
  "use strict";

  var INSTRUCTORS = {
    "sara-moradi": "سارا مرادی",
    "hossein-karimi": "حسین کریمی",
    "mina-ahmadi": "مینا احمدی",
    "reza-fallahi": "رضا فلاحی"
  };

  var COURSES = {
    "ai-for-managers": { title: "هوش مصنوعی برای مدیران", instructors: ["sara-moradi", "reza-fallahi"] },
    "ai-data-driven-decisions": { title: "تصمیم‌گیری داده‌محور با هوش مصنوعی", instructors: ["sara-moradi", "reza-fallahi"] },
    "managerial-accounting": { title: "حسابداری مدیریتی برای غیرمالی‌ها", instructors: ["hossein-karimi"] },
    "financial-analysis": { title: "تحلیل مالی پیشرفته", instructors: ["hossein-karimi"] },
    "tax-and-budgeting": { title: "مالیات و بودجه‌ریزی سازمانی", instructors: ["hossein-karimi"] },
    "leadership-skills": { title: "مهارت‌های رهبری سازمانی", instructors: ["mina-ahmadi"] }
  };

  var PHONE_PATTERN = /^(\+98|0098|0)9\d{9}$/;

  var form = document.getElementById("course-request-form");
  var success = document.getElementById("course-request-success");
  if (!form || !success) { return; }

  var courseSelect = form.elements.course;
  var instructorSelect = form.elements.instructor;
  var phoneInput = form.elements.phone;
  var messageInput = form.elements.message;

  function addOption(select, value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  // Persian (۰-۹) and Arabic (٠-٩) digits → Latin, strip spaces and dashes
  function normalizePhone(value) {
    return value
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[\s\-()]/g, "");
  }

  function setInvalid(field, invalid) {
    if (invalid) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  }

  function renderInstructors() {
    var course = COURSES[courseSelect.value];
    instructorSelect.innerHTML = "";

    if (!course) {
      addOption(instructorSelect, "", "ابتدا دوره را انتخاب کنید");
      instructorSelect.disabled = true;
      return;
    }

    if (course.instructors.length > 1) {
      addOption(instructorSelect, "", "انتخاب مدرس");
    }
    course.instructors.forEach(function (slug) {
      addOption(instructorSelect, slug, INSTRUCTORS[slug]);
    });
    instructorSelect.disabled = false;
  }

  Object.keys(COURSES).forEach(function (slug) {
    addOption(courseSelect, slug, COURSES[slug].title);
  });

  // Preselect from ?course=<slug>
  var preset = null;
  try { preset = new URLSearchParams(window.location.search).get("course"); } catch (e) {}
  if (preset && COURSES[preset]) { courseSelect.value = preset; }
  renderInstructors();

  courseSelect.addEventListener("change", function () {
    setInvalid(courseSelect, false);
    setInvalid(instructorSelect, false);
    renderInstructors();
  });

  [instructorSelect, phoneInput, messageInput].forEach(function (field) {
    var eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, function () { setInvalid(field, false); });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var phone = normalizePhone(phoneInput.value);
    var message = messageInput.value.trim();
    var checks = [
      [courseSelect, !COURSES[courseSelect.value]],
      [instructorSelect, !instructorSelect.value],
      [phoneInput, !PHONE_PATTERN.test(phone)],
      [messageInput, message.length < 10]
    ];

    var firstInvalid = null;
    checks.forEach(function (check) {
      setInvalid(check[0], check[1]);
      if (check[1] && !firstInvalid) { firstInvalid = check[0]; }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    var request = {
      course: courseSelect.value,
      instructor: instructorSelect.value,
      phone: phone,
      message: message
    };
    // TODO: send `request` to a backend or form service

    success.querySelector("[data-success-course]").textContent = COURSES[request.course].title;
    success.querySelector("[data-success-instructor]").textContent = INSTRUCTORS[request.instructor];
    form.hidden = true;
    success.hidden = false;
    success.focus();
  });
})();
