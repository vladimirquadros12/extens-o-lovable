// ============================================================
// Diamond Unlock BR - Central Branding Configuration
// ------------------------------------------------------------
// Este é o arquivo de personalização da extensão.
// Campos suportados:
//   extensionName : string  - Nome da extensão
//   brandName     : string  - Nome da marca (header / footer / textos)
//   primaryColor  : string  - HEX da cor predominante
//   whatsappLinks : { support, sales, community } - URLs de suporte
// ============================================================

(function () {
  if (window.__tsBrandingInstalled) return;
  window.__tsBrandingInstalled = true;

  var DEFAULTS = {
    extensionName: "Diamond Unlock BR",
    brandName: "Diamond Unlock BR",
    primaryColor: "#A855F7",
    whatsappLinks: {
      support: "https://discord.gg/BmQ3xNYCF6",
      sales: "https://discord.gg/BmQ3xNYCF6",
      community: "https://discord.gg/BmQ3xNYCF6"
    }
  };

  // ---------- helpers ----------
  function isValidHexColor(c) {
    return typeof c === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim());
  }
  function normalizeHex(c) {
    c = c.trim();
    if (c.length === 4) {
      c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    }
    return c.toLowerCase();
  }
  function hexToRgb(hex) {
    hex = normalizeHex(hex);
    var n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function adjustHexColor(hex, delta) {
    var rgb = hexToRgb(hex);
    var f = delta / 100;
    function adj(v) {
      if (f < 0) return Math.round(v * (1 + f));
      return Math.round(v + (255 - v) * f);
    }
    var r = clamp(adj(rgb.r), 0, 255).toString(16).padStart(2, "0");
    var g = clamp(adj(rgb.g), 0, 255).toString(16).padStart(2, "0");
    var b = clamp(adj(rgb.b), 0, 255).toString(16).padStart(2, "0");
    return "#" + r + g + b;
  }
  function isValidDiscordOrWaUrl(url) {
    if (typeof url !== "string") return false;
    return /^https:\/\/(wa\.me|chat\.whatsapp\.com|discord\.gg|discord\.com)\//i.test(url.trim());
  }

  // ---------- color application ----------
  function applyBrandColor(hexColor) {
    var color = isValidHexColor(hexColor) ? normalizeHex(hexColor) : DEFAULTS.primaryColor;
    var rgb = hexToRgb(color);
    var hover = adjustHexColor(color, -15);
    var rgbStr = rgb.r + ", " + rgb.g + ", " + rgb.b;

    var root = document.documentElement;
    root.style.setProperty("--ts-brand-primary", color);
    root.style.setProperty("--ts-brand-primary-rgb", rgbStr);
    root.style.setProperty("--ts-brand-primary-hover", hover);
    root.style.setProperty("--ts-brand-primary-soft", "rgba(" + rgbStr + ", 0.10)");
    root.style.setProperty("--ts-brand-primary-border", "rgba(" + rgbStr + ", 0.32)");
    root.style.setProperty("--ts-brand-primary-glow", "rgba(" + rgbStr + ", 0.45)");
    // Diamond Unlock BR: purple neon gradient (vibrant purple → deep purple)
    root.style.setProperty("--ts-brand-gradient", "linear-gradient(135deg, " + color + ", #7C3AED)");
  }

  // ---------- text application ----------
  var BRAND_NAME_SELECTORS = [
    ".ql-title", ".ql-brand", ".sp-brand-text",
    "[data-ts-brand=\"name\"]", "[data-ts-brand-name]"
  ];
  var FOOTER_TEXT_SELECTORS = [".ql-badge-mz", ".sp-footer-badge", "[data-ts-brand=\"footer\"]"];

  function applyBrandTexts(cfg) {
    try {
      if (document.title && /Noud Hat/i.test(document.title)) {
        document.title = document.title.replace(/Noud Hat/gi, cfg.brandName);
      }
    } catch (_) {}

    function setText(el, value) {
      if (!el) return;
      var changed = false;
      el.childNodes.forEach(function (n) {
        if (n.nodeType === 3) {
          var t = n.nodeValue;
          if (/Noud Hat/i.test(t)) {
            n.nodeValue = t.replace(/Noud Hat/gi, value);
            changed = true;
          }
        }
      });
      if (!changed && !el.children.length) {
        el.textContent = value;
      }
    }

    BRAND_NAME_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { setText(el, cfg.brandName); });
    });
    FOOTER_TEXT_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.childNodes.forEach(function (n) {
          if (n.nodeType === 3 && /Noud Hat/i.test(n.nodeValue)) {
            n.nodeValue = n.nodeValue.replace(/Noud Hat/gi, cfg.brandName);
          }
        });
      });
    });
  }

  // ---------- link application ----------
  function applyBrandLinks(links) {
    var attrs = { support: "support", sales: "sales", community: "community" };
    Object.keys(attrs).forEach(function (k) {
      var target = links && links[k];
      if (!target) return;
      document.querySelectorAll('[data-ts-wa="' + k + '"]').forEach(function (el) {
        el.setAttribute("href", target);
      });
    });
  }

  // ---------- public API ----------
  function applyBrandingConfig(config) {
    config = config || {};
    var merged = {
      extensionName: config.extensionName || DEFAULTS.extensionName,
      brandName: config.brandName || DEFAULTS.brandName,
      primaryColor: isValidHexColor(config.primaryColor) ? config.primaryColor : DEFAULTS.primaryColor,
      whatsappLinks: {
        support: isValidDiscordOrWaUrl(config.whatsappLinks && config.whatsappLinks.support)
          ? config.whatsappLinks.support : DEFAULTS.whatsappLinks.support,
        sales: isValidDiscordOrWaUrl(config.whatsappLinks && config.whatsappLinks.sales)
          ? config.whatsappLinks.sales : DEFAULTS.whatsappLinks.sales,
        community: isValidDiscordOrWaUrl(config.whatsappLinks && config.whatsappLinks.community)
          ? config.whatsappLinks.community : DEFAULTS.whatsappLinks.community
      }
    };

    window.TS_ACTIVE_BRANDING = merged;

    try { applyBrandColor(merged.primaryColor); } catch (e) {}
    try { applyBrandTexts(merged); } catch (_) {}
    try { applyBrandLinks(merged.whatsappLinks); } catch (_) {}
    return merged;
  }

  function getBrandWhatsappLink(type) {
    type = type || "support";
    var b = window.TS_ACTIVE_BRANDING || DEFAULTS;
    return (b.whatsappLinks && b.whatsappLinks[type]) || DEFAULTS.whatsappLinks[type] || DEFAULTS.whatsappLinks.support;
  }

  function tsBrandName() {
    return (window.TS_ACTIVE_BRANDING && window.TS_ACTIVE_BRANDING.brandName) || DEFAULTS.brandName;
  }

  // expose
  window.TS_BRANDING_DEFAULTS = DEFAULTS;
  window.applyBrandingConfig = applyBrandingConfig;
  window.getBrandWhatsappLink = getBrandWhatsappLink;
  window.tsBrandName = tsBrandName;

  // boot
  applyBrandingConfig(window.TS_BRANDING_CONFIG || {});

  // re-apply texts as new UI is injected
  try {
    var pending = false;
    var obs = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        try {
          applyBrandTexts(window.TS_ACTIVE_BRANDING || DEFAULTS);
          applyBrandLinks((window.TS_ACTIVE_BRANDING || DEFAULTS).whatsappLinks);
        } catch (_) {}
      });
    });
    var startObserver = function () {
      if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startObserver);
    } else {
      startObserver();
    }
  } catch (_) {}
})();
