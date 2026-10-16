"use strict";

/* ---------- Logique de conversion ---------- */
/* CORE */
function textToBinary(text) {
  var bytes = new TextEncoder().encode(text);
  return Array.from(bytes, function (b) { return b.toString(2).padStart(8, "0"); }).join(" ");
}

function binaryToText(input) {
  var trimmed = input.trim();
  if (trimmed === "") return { ok: true, text: "" };
  var tokens = trimmed.split(/\s+/);
  var bytes = new Uint8Array(tokens.length);
  for (var i = 0; i < tokens.length; i++) {
    var tok = tokens[i];
    var shown = tok.length > 16 ? tok.slice(0, 16) + "…" : tok;
    if (!/^[01]+$/.test(tok)) {
      return { ok: false, error: "Octet n°" + (i + 1) + " « " + shown + " » : seuls les caractères 0 et 1 sont autorisés." };
    }
    if (tok.length !== 8) {
      return { ok: false, error: "Octet n°" + (i + 1) + " « " + shown + " » : " + tok.length + " bit" + (tok.length > 1 ? "s" : "") + " au lieu de 8." };
    }
    bytes[i] = parseInt(tok, 2);
  }
  try {
    var decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    return { ok: true, text: decoder.decode(bytes) };
  } catch (e) {
    return { ok: false, error: "Séquence UTF-8 invalide : ces octets ne correspondent à aucun texte valide." };
  }
}
/* END CORE */

/* ---------- Interface ---------- */
if (typeof document !== "undefined") {
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    modes: $("modes"), encode: $("mode-encode"), decode: $("mode-decode"),
    input: $("input"), output: $("output"), error: $("error"),
    inTitle: $("in-title"), outTitle: $("out-title"), inMeta: $("in-meta"), outMeta: $("out-meta"),
    copy: $("copy"), paste: $("paste"), clear: $("clear"), swap: $("swap")
  };
  var LIMITS = { encode: 100000, decode: 900000 };
  var mode = "encode";
  var drafts = { encode: "", decode: "" };
  var lastResult = null;
  var copyTimer = null;

  var labels = {
    encode: { inTitle: "Texte à convertir", outTitle: "Binaire UTF-8",
      ph: "Saisissez ou collez votre texte ici…", outPh: "Le binaire apparaîtra ici." },
    decode: { inTitle: "Binaire à décoder", outTitle: "Texte UTF-8",
      ph: "Collez des octets de 8 bits séparés par des espaces ou des retours à la ligne…", outPh: "Le texte apparaîtra ici." }
  };

  function setCopyLabel(text, done) {
    els.copy.textContent = text;
    els.copy.classList.toggle("done", !!done);
  }

  function compute() {
    var value = els.input.value;
    drafts[mode] = value;
    var result = null, error = "";
    if (value.length > LIMITS[mode]) {
      error = "Saisie trop longue : " + LIMITS[mode].toLocaleString("fr-FR") + " caractères maximum dans ce mode.";
      els.inMeta.textContent = "";
    } else if (mode === "encode") {
      result = textToBinary(value);
      els.inMeta.textContent = value ? Array.from(value).length + " caractère(s)" : "";
    } else {
      var r = binaryToText(value);
      if (r.ok) result = r.text; else error = r.error;
      els.inMeta.textContent = value.trim() ? value.trim().split(/\s+/).length + " groupe(s)" : "";
    }
    lastResult = error ? null : result;
    els.output.textContent = error ? "" : result;
    els.output.classList.toggle("has-error", !!error);
    els.error.textContent = error;
    if (error || !result) {
      els.outMeta.textContent = "";
    } else if (mode === "encode") {
      var n = result.split(" ").length;
      els.outMeta.textContent = n + " octet(s), " + n * 8 + " bits";
    } else {
      els.outMeta.textContent = Array.from(result).length + " caractère(s) décodé(s)";
    }
    els.copy.disabled = !lastResult;
    clearTimeout(copyTimer);
    setCopyLabel("Copier", false);
  }

  function render() {
    var l = labels[mode];
    els.modes.dataset.mode = mode;
    els.encode.setAttribute("aria-pressed", String(mode === "encode"));
    els.decode.setAttribute("aria-pressed", String(mode === "decode"));
    els.inTitle.textContent = l.inTitle;
    els.outTitle.textContent = l.outTitle;
    els.input.placeholder = l.ph;
    els.output.dataset.placeholder = l.outPh;
    els.input.value = drafts[mode];
    compute();
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    render();
  }

  els.input.addEventListener("input", compute);
  els.encode.addEventListener("click", function () { setMode("encode"); });
  els.decode.addEventListener("click", function () { setMode("decode"); });

  els.swap.addEventListener("click", function () {
    var next = mode === "encode" ? "decode" : "encode";
    if (lastResult) drafts[next] = lastResult;
    mode = next;
    render();
    els.input.focus();
  });

  els.clear.addEventListener("click", function () {
    drafts[mode] = "";
    els.input.value = "";
    compute();
    els.input.focus();
  });

  els.paste.addEventListener("click", function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      els.error.textContent = "Collage automatique indisponible : utilisez Ctrl+V (ou Cmd+V) dans le champ.";
      els.input.focus();
      return;
    }
    navigator.clipboard.readText().then(function (t) {
      els.input.value = t;
      compute();
      els.input.focus();
    }).catch(function () {
      els.error.textContent = "Le navigateur a refusé l’accès au presse-papiers : utilisez Ctrl+V (ou Cmd+V) dans le champ.";
      els.input.focus();
    });
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.className = "clip";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copied(ok) {
    setCopyLabel(ok ? "Copié ✓" : "Copie impossible", ok);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(function () { setCopyLabel("Copier", false); }, 1800);
  }

  els.copy.addEventListener("click", function () {
    if (!lastResult) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastResult).then(function () { copied(true); })
        .catch(function () { copied(fallbackCopy(lastResult)); });
    } else {
      copied(fallbackCopy(lastResult));
    }
  });

  render();

  /* Installation (PWA) */
  var deferredPrompt = null;
  var installBtn = $("install");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {}, function () {}).then(function () {
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  });
  window.addEventListener("appinstalled", function () { installBtn.hidden = true; });

  /* Service worker : hors ligne (nécessite HTTPS ou localhost) */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }
}
