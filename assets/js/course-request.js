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

  var F = window.TaraForm;

  var form = document.getElementById("course-request-form");
  var success = document.getElementById("course-request-success");
  if (!form || !success) { return; }

  var firstNameInput = form.elements.first_name;
  var lastNameInput = form.elements.last_name;
  var nationalIdInput = form.elements.national_id;
  var courseSelect = form.elements.course;
  var instructorSelect = form.elements.instructor;
  var phoneInput = form.elements.phone;
  var messageInput = form.elements.message;
  var alertBox = document.getElementById("course-request-alert");

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

  Object.keys(COURSES).forEach(function (slug) {
    addOption(courseSelect, slug, COURSES[slug].title);
  });

  // Preselect from ?course=<slug>
  var preset = null;
  try { preset = new URLSearchParams(window.location.search).get("course"); } catch (e) {}
  if (preset && COURSES[preset]) { courseSelect.value = preset; }
  renderInstructors();

  courseSelect.addEventListener("change", function () {
    F.setInvalid(courseSelect, false);
    F.setInvalid(instructorSelect, false);
    renderInstructors();
  });

  F.clearOnEdit([firstNameInput, lastNameInput, nationalIdInput, instructorSelect, phoneInput, messageInput]);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var firstName = firstNameInput.value.trim();
    var lastName = lastNameInput.value.trim();
    var nationalId = F.normalizeDigits(nationalIdInput.value);
    var phone = F.normalizeDigits(phoneInput.value);
    var message = messageInput.value.trim();

    var valid = F.applyChecks([
      [firstNameInput, !F.isValidName(firstName)],
      [lastNameInput, !F.isValidName(lastName)],
      [nationalIdInput, !isValidNationalId(nationalId)],
      [courseSelect, !COURSES[courseSelect.value]],
      [instructorSelect, !instructorSelect.value],
      [phoneInput, !F.isValidPhone(phone)],
      [messageInput, message.length < 10]
    ]);
    if (!valid) { return; }

    var request = {
      first_name: firstName,
      last_name: lastName,
      national_id: nationalId,
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
      onSuccess: function () {
        success.querySelector("[data-success-course]").textContent = COURSES[request.course].title;
        success.querySelector("[data-success-instructor]").textContent = INSTRUCTORS[request.instructor];
        form.hidden = true;
        success.hidden = false;
        success.focus();
      }
    });
  });
})();
