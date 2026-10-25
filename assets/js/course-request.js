// TARA — course request form
(function () {
  "use strict";

  var IMG = "assets/img/optimized/";

  var INSTRUCTORS = {
    "sara-moradi": "سارا مرادی",
    "hossein-karimi": "حسین کریمی",
    "mina-ahmadi": "مینا احمدی",
    "reza-fallahi": "رضا فلاحی"
  };

  var INSTRUCTOR_PHOTOS = {
    "sara-moradi": "instructor-sara.webp",
    "hossein-karimi": "instructor-hossein.webp",
    "mina-ahmadi": "instructor-mina.webp",
    "reza-fallahi": "instructor-reza.webp"
  };

  var COURSES = {
    "ai-for-managers": { title: "هوش مصنوعی برای مدیران", image: "course-ai.webp", instructors: ["sara-moradi", "reza-fallahi"] },
    "ai-data-driven-decisions": { title: "تصمیم‌گیری داده‌محور با هوش مصنوعی", image: "course-data.webp", instructors: ["sara-moradi", "reza-fallahi"] },
    "managerial-accounting": { title: "حسابداری مدیریتی برای غیرمالی‌ها", image: "course-accounting.webp", instructors: ["hossein-karimi"] },
    "financial-analysis": { title: "تحلیل مالی پیشرفته", image: "course-finance.webp", instructors: ["hossein-karimi"] },
    "tax-and-budgeting": { title: "مالیات و بودجه‌ریزی سازمانی", image: "course-tax.webp", instructors: ["hossein-karimi"] },
    "leadership-skills": { title: "مهارت‌های رهبری سازمانی", image: "course-leadership.webp", instructors: ["mina-ahmadi"] }
  };

  var F = window.TaraForm;

  var form = document.getElementById("course-request-form");
  var success = document.getElementById("course-request-success");
  if (!form || !success) { return; }

  var firstNameInput = form.elements.first_name;
  var lastNameInput = form.elements.last_name;
  var nationalIdInput = form.elements.national_id;
  var companyInput = form.elements.company;
  var courseSelect = form.elements.course;
  var instructorSelect = form.elements.instructor;
  var phoneInput = form.elements.phone;
  var messageInput = form.elements.message;
  var alertBox = document.getElementById("course-request-alert");
  var instructorField = document.getElementById("instructor-field");
  var preview = document.getElementById("request-preview");
  var counter = document.getElementById("message-counter");
  var steps = form.querySelectorAll("[data-step]");

  function addOption(select, value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  // Iranian national ID (کد ملی): 10 digits, last one is a mod-11 check digit
  function isValidNationalId(id) {
    if (!/^\d{10}$/.test(id) || /^(\d)\1{9}$/.test(id)) { return false; }
    var sum = 0;
    for (var i = 0; i < 9; i++) { sum += Number(id.charAt(i)) * (10 - i); }
    var remainder = sum % 11;
    var check = Number(id.charAt(9));
    return remainder < 2 ? check === remainder : check === 11 - remainder;
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

  // Restart a one-shot CSS animation class (forces a reflow between remove and add)
  function replay(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  function renderPreview() {
    if (!preview) { return; }
    var course = COURSES[courseSelect.value];
    var slug = instructorSelect.value;
    var image = preview.querySelector("[data-preview-image]");
    var instructor = preview.querySelector("[data-preview-instructor]");

    preview.querySelector("[data-preview-placeholder]").hidden = !!course;
    image.hidden = !course;
    preview.querySelector("[data-preview-title]").textContent = course ? course.title : "هنوز دوره‌ای انتخاب نشده";
    if (course) {
      image.src = IMG + course.image;
      image.alt = "دوره " + course.title;
    }

    instructor.hidden = !(course && INSTRUCTORS[slug]);
    if (course && INSTRUCTORS[slug]) {
      instructor.querySelector("[data-preview-photo]").src = IMG + INSTRUCTOR_PHOTOS[slug];
      instructor.querySelector("[data-preview-name]").textContent = INSTRUCTORS[slug];
    }
    replay(preview, "is-entering");
  }

  // A section's number badge fills in once every required field in it has a value
  function updateSteps() {
    Array.prototype.forEach.call(steps, function (step) {
      var fields = step.querySelectorAll("[required]");
      var complete = Array.prototype.every.call(fields, function (field) { return field.value.trim() !== ""; });
      step.classList.toggle("is-complete", complete);
    });
  }

  function updateCounter() {
    if (!counter) { return; }
    var length = messageInput.value.trim().length;
    counter.querySelector("[data-counter]").textContent = length.toLocaleString("fa-IR");
    counter.classList.toggle("is-met", length >= 10);
  }

  Object.keys(COURSES).forEach(function (slug) {
    addOption(courseSelect, slug, COURSES[slug].title);
  });

  // Preselect from ?course=<slug>
  var preset = null;
  try { preset = new URLSearchParams(window.location.search).get("course"); } catch (e) {}
  if (preset && COURSES[preset]) { courseSelect.value = preset; }
  renderInstructors();
  renderPreview();
  updateSteps();

  courseSelect.addEventListener("change", function () {
    F.setInvalid(courseSelect, false);
    F.setInvalid(instructorSelect, false);
    renderInstructors();
    renderPreview();
    if (instructorField && !instructorSelect.disabled) { replay(instructorField, "is-unlocked"); }
  });

  instructorSelect.addEventListener("change", renderPreview);
  messageInput.addEventListener("input", updateCounter);
  form.addEventListener("input", updateSteps);
  form.addEventListener("change", updateSteps);

  form.addEventListener("animationend", function (event) {
    event.target.classList.remove("is-shaking");
  });

  F.clearOnEdit([firstNameInput, lastNameInput, nationalIdInput, companyInput, instructorSelect, phoneInput, messageInput]);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var firstName = firstNameInput.value.trim();
    var lastName = lastNameInput.value.trim();
    var nationalId = F.normalizeDigits(nationalIdInput.value);
    var company = companyInput.value.trim();
    var phone = F.normalizeDigits(phoneInput.value);
    var message = messageInput.value.trim();

    var valid = F.applyChecks([
      [firstNameInput, !F.isValidName(firstName)],
      [lastNameInput, !F.isValidName(lastName)],
      [nationalIdInput, !isValidNationalId(nationalId)],
      [companyInput, company.length > 100],
      [courseSelect, !COURSES[courseSelect.value]],
      [instructorSelect, !instructorSelect.value],
      [phoneInput, !F.isValidPhone(phone)],
      [messageInput, message.length < 10]
    ]);
    if (!valid) {
      Array.prototype.forEach.call(form.querySelectorAll("[aria-invalid=true]"), function (field) {
        replay(field, "is-shaking");
      });
      return;
    }

    var request = {
      first_name: firstName,
      last_name: lastName,
      national_id: nationalId,
      company: company,
      course: courseSelect.value,
      instructor: instructorSelect.value,
      phone: phone,
      message: message,
      website: form.elements.website.value
    };

    F.submit({
      form: form,
      alert: alertBox,
      url: "/api/tickets",
      data: request,
      onSuccess: function (data) {
        success.querySelector("[data-success-code]").textContent = data.tracking_code;
        success.querySelector("[data-success-course]").textContent = COURSES[request.course].title;
        success.querySelector("[data-success-instructor]").textContent = INSTRUCTORS[request.instructor];
        form.hidden = true;
        success.hidden = false;
        success.focus();
      }
    });
  });
})();
