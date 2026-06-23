// Diamond Unlock BR — Background Service Worker

// =====================================================
// Capture Lovable Bearer token PASSIVELY via webRequest
// (captures token even when the side panel isn't open)
// =====================================================
try {
  chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      try {
        const headers = details.requestHeaders || [];
        const authHeader = headers.find(h => h.name && h.name.toLowerCase() === "authorization");
        if (!authHeader || !authHeader.value || !authHeader.value.startsWith("Bearer ")) return;
        chrome.storage.local.set({
          lovableBearerToken: authHeader.value,
          lovableBearerTokenCapturedAt: Date.now()
        });
      } catch(e) {}
    },
    { urls: ["https://api.lovable.dev/*"] },
    ["requestHeaders", "extraHeaders"]
  );
} catch(e) {
  console.warn("[Background] webRequest listener failed:", e && e.message);
}
// KeyAuth removed: license gating handled locally in sidepanel.js

// Default settings on install
try {
  chrome.runtime.onInstalled.addListener(() => {
    try {
      chrome.storage.local.get(['soundNotificationsEnabled'], (r) => {
        if (!r || typeof r.soundNotificationsEnabled === 'undefined') {
          chrome.storage.local.set({ soundNotificationsEnabled: true });
        }
      });
    } catch(_){}
  });
} catch(_){}

// Initialize sidebar mode preference
chrome.storage.local.get(["ql_sidebar_mode"], (res) => {
  const sidebarMode = res.ql_sidebar_mode || false;
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: sidebarMode }).catch(() => {});
});

// Listen for storage changes to update panel behavior
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.ql_sidebar_mode) {
    const sidebarMode = changes.ql_sidebar_mode.newValue || false;
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: sidebarMode }).catch(() => {});
  }
});

// =====================================================
// Icon click — toggle overlay on current tab
// (same as competitor: sends TS_TOGGLE_OVERLAY message)
// =====================================================
async function openLovableTabAndToggle() {
  try {
    const tabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] });
    let target = tabs && tabs[0];
    if (!target) {
      target = await chrome.tabs.create({ url: "https://lovable.dev/" });
      return;
    }
    try { await chrome.tabs.update(target.id, { active: true }); } catch (err) { console.error('[Background] tabs.update failed', err); }
    try { await chrome.windows.update(target.windowId, { focused: true }); } catch (err) { console.error('[Background] windows.update failed', err); }
    chrome.tabs.sendMessage(target.id, { type: "TS_TOGGLE_OVERLAY" }, () => void chrome.runtime.lastError);
  } catch (err) {
    console.error("[Background] toggle overlay error:", err);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.url && /^https:\/\/([^/]+\.)?lovable\.dev\//.test(tab.url)) {
    chrome.tabs.sendMessage(tab.id, { type: "TS_TOGGLE_OVERLAY" }, () => void chrome.runtime.lastError);
    return;
  }
  await openLovableTabAndToggle();
});

// =====================================================
// Message handlers
// =====================================================
// keyAuthRequest removed

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // KEYAUTH_LOGIN handler removed — extension no longer queries KeyAuth servers

  if (msg && msg.action === "lovableSync") {
    const updates = {};
    if (msg.token) updates.lovable_token = msg.token;
    if (msg.projectId) updates.lovable_projectId = msg.projectId;
    if (Object.keys(updates).length) {
      chrome.storage.local.set(updates, () => {
        console.log("[Background] saved:", Object.keys(updates).join(", "));
      });
    }
  }

  if (msg && msg.action === "activateSidebar") {
    chrome.storage.local.set({ ql_sidebar_mode: true });
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        sendResponse({ ok: true });
      }).catch((err) => {
        console.warn("[Background] sidePanel.open deferred:", err.message);
        sendResponse({ ok: true, deferred: true, message: "Clique no ícone da extensão para abrir o painel lateral." });
      });
    } else {
      sendResponse({ ok: true, deferred: true, message: "Clique no ícone da extensão para abrir o painel lateral." });
    }
    return true;
  }

  if (msg && msg.action === "deactivateSidebar") {
    chrome.storage.local.set({ ql_sidebar_mode: false });
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (msg && msg.action === "openSidePanel") {
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        sendResponse({ ok: true });
      }).catch((err) => {
        console.warn("[Background] openSidePanel deferred:", err.message);
        sendResponse({ ok: false, error: err.message });
      });
    } else {
      sendResponse({ ok: false, error: "No tab context" });
    }
    return true;
  }

  if (msg && msg.action === "lovableApiFetch") {
    (async () => {
      try {
        const st = await new Promise(r => chrome.storage.local.get(['sp_lovable_mode','sp_lovable_limit_per_day','sp_lovable_usage_count','sp_lovable_usage_date','sp_disable_lovable_api'], r));
        const mode = st.sp_lovable_mode || (st.sp_disable_lovable_api ? 'disabled' : 'simulated');
        if (mode === 'disabled' || mode === 'simulated') {
          sendResponse({ ok: false, status: 0, data: { error: 'Envio para Lovable desativado nas configurações.' } });
          return;
        }
        if (mode === 'limited') {
          const today = new Date().toISOString().slice(0,10);
          const used = (st.sp_lovable_usage_date === today) ? (st.sp_lovable_usage_count || 0) : 0;
          const limit = parseInt(st.sp_lovable_limit_per_day) || 0;
          if (limit > 0 && used >= limit) {
            sendResponse({ ok: false, status: 0, data: { error: 'Limite diário para envio ao Lovable atingido.' } });
            return;
          }
          // increment usage count
          const newUsed = used + 1;
          chrome.storage.local.set({ sp_lovable_usage_count: newUsed, sp_lovable_usage_date: today });
        }
        let tab = null;
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabs && activeTabs[0] && /^https:\/\/([^/]+\.)?lovable\.dev\//.test(activeTabs[0].url || '')) {
          tab = activeTabs[0];
        } else {
          const lovableTabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] });
          tab = (lovableTabs && lovableTabs[0]) || null;
        }
        if (!tab || !tab.id) {
          sendResponse({ ok: false, status: 0, data: { error: "Abra uma aba do Lovable antes de enviar." } });
          return;
        }
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: async (url, options) => {
            try {
              const r = await fetch(url, options);
              const text = await r.text();
              let data;
              try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
              return { ok: r.ok, status: r.status, data };
            } catch (err) {
              return { ok: false, status: 0, data: { error: (err && err.message) || 'fetch failed in page' } };
            }
          },
          args: [msg.url, {
            method: msg.method || 'POST',
            headers: msg.headers || {},
            body: msg.body || null,
            credentials: 'include',
          }],
        });
        const value = (results && results[0] && results[0].result) || { ok: false, status: 0, data: { error: 'sem resposta da página Lovable' } };
        sendResponse(value);
      } catch (err) {
        console.error("[Background] lovableApiFetch error:", err);
        sendResponse({ ok: false, status: 0, data: { error: err.message || "Falha no executeScript." } });
      }
    })();
    return true;
  }

  if (msg && msg.action === "lovableApiPutFile") {
    (async () => {
      try {
        const st2 = await new Promise(r => chrome.storage.local.get(['sp_lovable_mode','sp_lovable_limit_per_day','sp_lovable_usage_count','sp_lovable_usage_date','sp_disable_lovable_api'], r));
        const mode2 = st2.sp_lovable_mode || (st2.sp_disable_lovable_api ? 'disabled' : 'simulated');
        if (mode2 === 'disabled' || mode2 === 'simulated') {
          sendResponse({ ok: false, error: 'Envio para Lovable desativado nas configurações.' });
          return;
        }
        if (mode2 === 'limited') {
          const today = new Date().toISOString().slice(0,10);
          const used = (st2.sp_lovable_usage_date === today) ? (st2.sp_lovable_usage_count || 0) : 0;
          const limit = parseInt(st2.sp_lovable_limit_per_day) || 0;
          if (limit > 0 && used >= limit) {
            sendResponse({ ok: false, error: 'Limite diário para envio ao Lovable atingido.' });
            return;
          }
          const newUsed = used + 1;
          chrome.storage.local.set({ sp_lovable_usage_count: newUsed, sp_lovable_usage_date: today });
        }
        let tab = null;
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabs && activeTabs[0] && /^https:\/\/([^/]+\.)?lovable\.dev\//.test(activeTabs[0].url || '')) {
          tab = activeTabs[0];
        } else {
          const lovableTabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] });
          tab = (lovableTabs && lovableTabs[0]) || null;
        }
        if (!tab || !tab.id) {
          sendResponse({ ok: false, error: "Abra uma aba do Lovable antes de enviar." });
          return;
        }
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: async (signedUrl, contentType, base64) => {
            try {
              const response = await fetch("data:" + contentType + ";base64," + base64);
              const blob = await response.blob();
              const r = await fetch(signedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': contentType },
                body: blob
              });
              return { ok: r.ok, status: r.status };
            } catch (err) {
              return { ok: false, error: (err && err.message) || 'PUT failed in page' };
            }
          },
          args: [msg.signedUrl, msg.contentType, msg.base64],
        });
        const value = (results && results[0] && results[0].result) || { ok: false, error: 'sem resposta da página Lovable' };
        sendResponse(value);
      } catch (err) {
        console.error("[Background] lovableApiPutFile error:", err);
        sendResponse({ ok: false, error: err.message || "Falha no executeScript." });
      }
    })();
    return true;
  }

  if (msg && msg.action === "proxyFetch") {
    (async () => {
      try {
        if (msg && msg.url && /lovable/.test(String(msg.url))) {
          const st3 = await new Promise(r => chrome.storage.local.get(['sp_lovable_mode','sp_lovable_limit_per_day','sp_lovable_usage_count','sp_lovable_usage_date','sp_disable_lovable_api'], r));
          const mode3 = st3.sp_lovable_mode || (st3.sp_disable_lovable_api ? 'disabled' : 'simulated');
          if (mode3 === 'disabled' || mode3 === 'simulated') {
            sendResponse({ ok: false, status: 0, data: { error: 'Envio para Lovable desativado nas configurações.' } });
            return;
          }
          if (mode3 === 'limited') {
            const today = new Date().toISOString().slice(0,10);
            const used = (st3.sp_lovable_usage_date === today) ? (st3.sp_lovable_usage_count || 0) : 0;
            const limit = parseInt(st3.sp_lovable_limit_per_day) || 0;
            if (limit > 0 && used >= limit) {
              sendResponse({ ok: false, status: 0, data: { error: 'Limite diário para envio ao Lovable atingido.' } });
              return;
            }
            const newUsed = used + 1;
            chrome.storage.local.set({ sp_lovable_usage_count: newUsed, sp_lovable_usage_date: today });
          }
        }
        var opts = {
          method: msg.method || "POST",
          headers: msg.headers || {},
        };
        if (msg.body) opts.body = msg.body;
        var resp = await fetch(msg.url, opts);
        var text = await resp.text();
        var data;
        try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }
        sendResponse({ ok: resp.ok, status: resp.status, data: data });
      } catch(err) {
        console.error("[Background] proxyFetch error:", err);
        sendResponse({ ok: false, status: 0, data: { error: err.message || "Fetch failed in background" } });
      }
    })();
    return true;
  }

  // --- READ_COOKIES: read HttpOnly cookies for JWT token ---
  if (msg && msg.action === "readCookies") {
    var cookieNames = [
      "lovable-session-id.id",
      "lovable-session-id.custom",
      "lovable-session-id.refresh",
      "lovable-session-id.sig"
    ];
    var foundTokens = [];
    var checkedCount = 0;
    cookieNames.forEach(function(name) {
      chrome.cookies.get({ url: "https://lovable.dev", name: name }, function(cookie) {
        checkedCount++;
        if (cookie && cookie.value) {
          var parts = cookie.value.split(".");
          if (parts.length === 3 && cookie.value.indexOf("eyJ") === 0) {
            foundTokens.push({
              token: cookie.value,
              cookieName: name,
              httpOnly: cookie.httpOnly
            });
          }
        }
        if (checkedCount === cookieNames.length) {
          sendResponse({ success: foundTokens.length > 0, tokens: foundTokens });
        }
      });
    });
    return true;
  }

  // --- DOWNLOAD_PROJECT: fetch project source code from Lovable API ---
  if (msg && msg.action === "downloadProject") {
    (async function() {
      try {
        var apiUrl = "https://lovable-api.com/projects/" + msg.projectId + "/source-code";
        var resp = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + msg.token,
            "Accept": "application/json"
          }
        });
        if (!resp.ok) {
          sendResponse({ success: false, error: "API retornou " + resp.status });
          return;
        }
        var data = await resp.json();
        sendResponse({ success: true, files: data.files || [] });
      } catch(err) {
        sendResponse({ success: false, error: err.message || "Download falhou" });
      }
    })();
    return true;
  }

});
