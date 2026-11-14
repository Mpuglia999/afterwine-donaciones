/**
 * Desfibrilar Donation Widget v3
 * - Multi-project via data-project
 * - One-time (Checkout Pro) or monthly (Mercado Pago subscription plans)
 * Attributes: data-project, data-amounts, data-monthly-amounts, data-monthly="false",
 *             data-color, data-title, data-lang
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
    amounts: container.getAttribute("data-amounts"),
    monthlyAmounts: container.getAttribute("data-monthly-amounts") || "5000,10000,20000",
    monthly: container.getAttribute("data-monthly") !== "false",
    title: container.getAttribute("data-title"),
    lang: container.getAttribute("data-lang") || "es",
  };

  function parse(list) {
    return list.split(",").map(function (v) {
      var n = parseInt(v.trim(), 10);
      return { value: n, label: "$" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") };
    });
  }
  var oneTime = opts.amounts ? parse(opts.amounts) : parse("5000,10000,25000,50000");
  var monthly = parse(opts.monthlyAmounts);

  var t = {
    es: { title: opts.title || "Doná a Fundación Desfibrilar", subtitle: "Tu aporte salva vidas", oneTime: "Una vez", monthly: "Todos los meses", perMonth: "/mes", custom: "Otro monto", customPh: "Monto personalizado", donate: "Donar", donateMonthly: "Donar todos los meses", donating: "Procesando...", secure: "Pago seguro por Mercado Pago", secureMonthly: "Débito automático por Mercado Pago · Cancelás cuando quieras", errorMin: "El monto mínimo es $100", error: "No pudimos procesar el pedido. Intentá de nuevo." },
    en: { title: opts.title || "Donate to Fundación Desfibrilar", subtitle: "Your contribution saves lives", oneTime: "One-time", monthly: "Monthly", perMonth: "/mo", custom: "Other amount", customPh: "Custom amount", donate: "Donate", donateMonthly: "Donate monthly", donating: "Processing...", secure: "Secure payment via Mercado Pago", secureMonthly: "Automatic monthly debit via Mercado Pago · Cancel anytime", errorMin: "Minimum amount is $100", error: "We couldn't process it. Please try again." },
  };
  var l = t[opts.lang] || t.es;

  var isMonthly = false;
  var selectedAmount = oneTime[1] ? oneTime[1].value : oneTime[0].value;
  var customMode = false;
  var isSubmitting = false;

  var html = '<div class="dsf-widget" style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;max-width:380px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);background:#fff;">';
  html += '<div style="background:' + opts.color + ';color:#fff;padding:20px 24px;"><div style="font-size:18px;font-weight:700;">' + l.title + '</div><div style="font-size:13px;opacity:.8;margin-top:4px;">' + l.subtitle + '</div></div>';
  html += '<div style="padding:20px 24px;">';

  if (opts.monthly) {
    html += '<div class="dsf-freqs" role="group" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;">';
    html += '<button type="button" class="dsf-freq" data-freq="once" aria-pressed="true" style="padding:9px;border-radius:99px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid ' + opts.color + ';">' + l.oneTime + '</button>';
    html += '<button type="button" class="dsf-freq" data-freq="monthly" aria-pressed="false" style="padding:9px;border-radius:99px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid ' + opts.color + ';">' + l.monthly + '</button>';
    html += '</div>';
  }

  html += '<div class="dsf-amounts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;"></div>';
  html += '<div style="margin-bottom:16px;"><input type="number" class="dsf-custom" placeholder="' + l.customPh + '" style="width:100%;padding:12px;border:2px solid #e5e5e5;border-radius:10px;font-size:15px;box-sizing:border-box;display:none;" min="100"></div>';
  html += '<button type="button" class="dsf-custom-toggle" style="width:100%;padding:8px;border:none;background:none;color:' + opts.color + ';font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px;">' + l.custom + '</button>';
  html += '<button type="button" class="dsf-submit" style="width:100%;padding:14px;border:none;border-radius:10px;background:' + opts.color + ';color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:opacity .2s;">' + l.donate + '</button>';
  html += '<div class="dsf-secure" style="text-align:center;margin-top:12px;font-size:11px;color:#999;">🔒 ' + l.secure + '</div>';
  html += '</div></div>';

  container.innerHTML = html;

  var amountsBox = container.querySelector(".dsf-amounts");
  var customInput = container.querySelector(".dsf-custom");
  var customToggle = container.querySelector(".dsf-custom-toggle");
  var submitBtn = container.querySelector(".dsf-submit");
  var secure = container.querySelector(".dsf-secure");
  var freqBtns = container.querySelectorAll(".dsf-freq");

  function renderAmounts() {
    var list = isMonthly ? monthly : oneTime;
    var h = "";
    for (var a = 0; a < list.length; a++) {
      h += '<button type="button" class="dsf-amt" data-value="' + list[a].value + '" style="padding:12px;border:2px solid #e5e5e5;border-radius:10px;background:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;">' + list[a].label + (isMonthly ? '<span style="font-size:11px;font-weight:500;opacity:.7">' + l.perMonth + "</span>" : "") + "</button>";
    }
    amountsBox.innerHTML = h;
    var btns = amountsBox.querySelectorAll(".dsf-amt");
    for (var b = 0; b < btns.length; b++) {
      btns[b].addEventListener("click", function () {
        customMode = false;
        customInput.style.display = "none";
        selectedAmount = parseInt(this.getAttribute("data-value"), 10);
        updateSelection();
      });
    }
    updateSelection();
  }

  function updateSelection() {
    var btns = amountsBox.querySelectorAll(".dsf-amt");
    for (var b = 0; b < btns.length; b++) {
      var btn = btns[b];
      var on = !customMode && parseInt(btn.getAttribute("data-value"), 10) === selectedAmount;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.style.borderColor = on ? opts.color : "#e5e5e5";
      btn.style.background = on ? opts.color + "10" : "#fff";
      btn.style.color = on ? opts.color : "#333";
    }
    for (var f = 0; f < freqBtns.length; f++) {
      var sel = (freqBtns[f].getAttribute("data-freq") === "monthly") === isMonthly;
      freqBtns[f].setAttribute("aria-pressed", sel ? "true" : "false");
      freqBtns[f].style.background = sel ? opts.color : "transparent";
      freqBtns[f].style.color = sel ? "#fff" : "inherit";
    }
    customToggle.style.display = isMonthly ? "none" : "block";
    submitBtn.textContent = isMonthly ? l.donateMonthly : l.donate;
    secure.textContent = "🔒 " + (isMonthly ? l.secureMonthly : l.secure);
  }

  for (var f = 0; f < freqBtns.length; f++) {
    freqBtns[f].addEventListener("click", function () {
      isMonthly = this.getAttribute("data-freq") === "monthly";
      var list = isMonthly ? monthly : oneTime;
      selectedAmount = list[1] ? list[1].value : list[0].value;
      customMode = false;
      customInput.style.display = "none";
      renderAmounts();
    });
  }

  customToggle.addEventListener("click", function () {
    customMode = true;
    customInput.style.display = "block";
    customInput.focus();
    updateSelection();
  });
  customInput.addEventListener("input", function () { selectedAmount = parseInt(this.value, 10) || 0; });

  function fail() {
    alert(l.error);
    isSubmitting = false;
    submitBtn.style.opacity = "1";
    updateSelection();
  }

  submitBtn.addEventListener("click", function () {
    if (isSubmitting) return;
    var amt = customMode ? (parseInt(customInput.value, 10) || 0) : selectedAmount;
    if (amt < 100) { alert(l.errorMin); return; }

    isSubmitting = true;
    submitBtn.textContent = l.donating;
    submitBtn.style.opacity = "0.7";

    var endpoint = isMonthly ? "/api/create-subscription" : "/api/create-preference";
    var payload = isMonthly
      ? { amount: amt, project: opts.project }
      : { amount: amt, project: opts.project, description: "Donación " + (opts.project === "afterwine" ? "After Wine" : opts.project) + " - Fundación Desfibrilar" };

    fetch(BASE_URL + endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var url = data.init_point || data.sandbox_init_point;
        if (url) window.location.href = url;
        else { if (data.message) l.error = data.message; throw new Error(data.error || "No checkout URL returned"); }
      })
      .catch(function (err) { console.error("[Desfibrilar Widget] Error:", err); fail(); });
  });

  renderAmounts();
})();
