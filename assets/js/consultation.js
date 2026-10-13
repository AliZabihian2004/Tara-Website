// TARA — homepage consultation form («مشاوره رایگان»)
(function () {
  "use strict";

  var F = window.TaraForm;
  var form = document.getElementById("consult-form");
  var success = document.getElementById("consult-success");
  if (!form || !success || !F) { return; }

  var nameInput = form.elements.name;
  var phoneInput = form.elements.phone;
  var companyInput = form.elements.company;
  var messageInput = form.elements.message;
  var alertBox = document.getElementById("consult-alert");

  F.clearOnEdit([nameInput, phoneInput, companyInput, messageInput]);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var name = nameInput.value.trim();
    var phone = F.normalizeDigits(phoneInput.value);
    var company = companyInput.value.trim();
    var message = messageInput.value.trim();

    var valid = F.applyChecks([
      [nameInput, !F.isValidName(name, 100)],
      [phoneInput, !F.isValidPhone(phone)],
      [companyInput, company.length > 100],
      [messageInput, message.length < 10]
    ]);
    if (!valid) { return; }

    F.submit({
      form: form,
      alert: alertBox,
      url: "/api/consultations",
      data: { name: name, phone: phone, company: company, message: message, website: form.elements.website.value },
      onSuccess: function () {
        form.hidden = true;
        success.hidden = false;
        success.focus();
      }
    });
  });
})();
