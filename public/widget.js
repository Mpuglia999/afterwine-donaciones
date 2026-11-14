/**
 * Desfibrilar Donation Widget v2
 * Multi-project support via data-project attribute
 */
(function () {
  "use strict";

  var scripts = document.querySelectorAll("script[src]");
  var BASE_URL = "";
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].src.indexOf("widget.js") !== -1) {
      BASE_URL = scripts[i].src.replace(/\/widget\.js.*$/, "");
      break;
    }
  }
  if (!BASE_URL) BASE_URL = "https://afterwine-donaciones.vercel.app";

  var container = document.getElementById("desfibrilar-donar");
  if (!container) { console.warn("[Desfibrilar Widget] No element with id='desfibrilar-donar' found."); return; }

  var opts = {
    project: container.getAttribute("data-project") || "afterwine",
    color: container.getAttribute("data-color") || "#c41c24",
    accent: container.getAttribute("data-accent") || "#c8a951",
    compact: container.getAttribute("data-compact") === "true",
    amounts: container.getAttribute("data-amounts"),
    title: container.getAttribute("data-title"),
    lang: container.getAttribute("data-lang") || "es",
  };

  var amounts = opts.amounts
    ? opts.amounts.split(",").map(function (v) { var n = parseInt(v.trim(), 10); return { value: n, label: "$" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") }; })
    : [{ value: 5000, label: "$5.000" }, { value: 10000, label: "$10.000" }, { value: 25000, label: "$25.000" }, { value: 50000, label: "$50.000" }];

  var t = {
    es: { title: opts.title || "Doná a Fundación Desfibrilar", subtitle: "Tu aporte salva vidas", oneTime: "Única vez", monthly: "Mensual", custom: "Otro monto", customPh: "Monto personalizado", donate: "Donar", donating: "Procesando...", secure: "Pago seguro por Mercado Pago", errorMin: "El monto mínimo es $100" },
    en: { title: opts.title || "Donate to Fundación Desfibrilar", subtitle: "Your contribution saves lives", oneTime: "One-time", monthly: "Monthly", custom: "Other amount", customPh: "Custom amount", donate: "Donate", donating: "Processing...", secure: "Secure payment via Mercado Pago", errorMin: "Minimum amount is $100" },
  };
  var l = t[opts.lang] || t.es;

  var selectedAmount = amounts[1] ? amounts[1].value : amounts[0].value;
  var customMode = false;
  var isRecurring = false;
  var isSubmitting = false;

  // Build HTML
  var html = '<div class="dsf-widget" style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;max-width:380px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);background:#fff;">';
  html += '<div style="background:' + opts.color + ';color:#fff;padding:20px 24px;"><div style="font-size:18px;font-weight:700;">' + l.title + '</div><div style="font-size:13px;opacity:.8;margin-top:4px;">' + l.subtitle + '</div></div>';
  html += '<div style="padding:20px 24px;">';

  // Amount buttons
  html += '<div class="dsf-amounts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">';
  for (var a = 0; a < amounts.length; a++) {
    html += '<button class="dsf-amt" data-value="' + amounts[a].value + '" style="padding:12px;border:2px solid #e5e5e5;border-radius:10px;background:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;">' + amounts[a].label + '</button>';
  }
  html += '</div>';

  // Custom amount
  html += '<div style="margin-bottom:16px;"><input type="number" class="dsf-custom" placeholder="' + l.customPh + '" style="width:100%;padding:12px;border:2px solid #e5e5e5;border-radius:10px;font-size:15px;box-sizing:border-box;display:none;" min="100"></div>';
  html += '<button class="dsf-custom-toggle" style="width:100%;padding:8px;border:none;background:none;color:' + opts.color + ';font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px;">' + l.custom + '</button>';

  // Donate button
  html += '<button class="dsf-submit" style="width:100%;padding:14px;border:none;border-radius:10px;background:' + opts.color + ';color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:opacity .2s;">' + l.donate + '</button>';

  // Secure badge
  html += '<div style="text-align:center;margin-top:12px;font-size:11px;color:#999;">🔒 ' + l.secure + '</div>';
  html += '</div></div>';

  container.innerHTML = html;

  // Event handlers
  var amtBtns = container.querySelectorAll(".dsf-amt");
  var customInput = container.querySelector(".dsf-custom");
  var customToggle = container.querySelector(".dsf-custom-toggle");
  var submitBtn = container.querySelector(".dsf-submit");

  function updateSelection() {
    for (var b = 0; b < amtBtns.length; b++) {
      var btn = amtBtns[b];
      var isSelected = !customMode && parseInt(btn.getAttribute("data-value"), 10) === selectedAmount;
      btn.style.borderColor = isSelected ? opts.color : "#e5e5e5";
      btn.style.background = isSelected ? opts.color + "10" : "#fff";
      btn.style.color = isSelected ? opts.color : "#333";
    }
  }
  updateSelection();

  for (var b = 0; b < amtBtns.length; b++) {
    amtBtns[b].addEventListener("click", function () {
      customMode = false;
      customInput.style.display = "none";
      selectedAmount = parseInt(this.getAttribute("data-value"), 10);
      updateSelection();
    });
  }

  customToggle.addEventListener("click", function () {
    customMode = true;
    customInput.style.display = "block";
    customInput.focus();
    updateSelection();
  });

  customInput.addEventListener("input", function () {
    selectedAmount = parseInt(this.value, 10) || 0;
  });

  submitBtn.addEventListener("click", function () {
    if (isSubmitting) return;
    var amt = customMode ? (parseInt(customInput.value, 10) || 0) : selectedAmount;
    if (amt < 100) {
      alert(l.errorMin);
      return;
    }

    isSubmitting = true;
    submitBtn.textContent = l.donating;
    submitBtn.style.opacity = "0.7";

    fetch(BASE_URL + "/api/create-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amt,
        project: opts.project,
        description: "Donación " + (opts.project === "afterwine" ? "After Wine" : opts.project) + " - Fundación Desfibrilar",
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var url = data.init_point || data.sandbox_init_point;
        if (url) {
          window.location.href = url;
        } else {
          throw new Error("No checkout URL returned");
        }
      })
      .catch(function (err) {
        console.error("[Desfibrilar Widget] Error:", err);
        alert("Error al procesar. Intentá de nuevo.");
        isSubmitting = false;
        submitBtn.textContent = l.donate;
        submitBtn.style.opacity = "1";
      });
  });
})();
