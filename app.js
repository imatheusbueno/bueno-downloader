const urlInput = document.querySelector("#url");
const statusEl = document.querySelector("#status");
const downloadBtn = document.querySelector("#download");
const clipboardPrompt = document.querySelector("#clipboard-prompt");
const detectedLink = document.querySelector("#detected-link");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const historyStorageKey = "bueno-dl-history-v1";
const historyLimit = 20;
const apiBaseUrl = location.hostname.endsWith("github.io")
  ? "https://bueno-downloader.onrender.com"
  : "";
const supportedHosts = new Set([
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
  "instagram.com", "www.instagram.com",
  "x.com", "www.x.com", "twitter.com", "www.twitter.com"
]);
let pendingClipboardUrl = "";
let historyItems = loadHistory();

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function supportedVideoUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && supportedHosts.has(url.hostname.toLowerCase())
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
    return Array.isArray(saved)
      ? saved.filter(item => item && supportedVideoUrl(item.url)).slice(0, historyLimit)
      : [];
  } catch {
    return [];
  }
}

function renderHistory() {
  historyList.replaceChildren();
  historyEmpty.hidden = historyItems.length > 0;

  for (const item of historyItems) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    const address = document.createElement("span");
    const usedAt = document.createElement("time");

    button.className = "history-item";
    button.type = "button";
    button.dataset.url = item.url;
    address.className = "history-url";
    address.textContent = item.url;
    usedAt.dateTime = item.usedAt;
    usedAt.textContent = new Date(item.usedAt).toLocaleString();

    button.append(address, usedAt);
    row.append(button);
    historyList.append(row);
  }
}

function rememberLink(value) {
  const url = supportedVideoUrl(value);
  if (!url) return;

  historyItems = [
    { url, usedAt: new Date().toISOString() },
    ...historyItems.filter(item => item.url !== url)
  ].slice(0, historyLimit);

  try {
    localStorage.setItem(historyStorageKey, JSON.stringify(historyItems));
  } catch {}
  renderHistory();
}

function askToPaste(value) {
  const url = supportedVideoUrl(value);
  if (!url || url === urlInput.value.trim()) return;

  pendingClipboardUrl = url;
  detectedLink.textContent = url;
  clipboardPrompt.hidden = false;
}

function inspectClipboard() {
  if (!navigator.clipboard?.readText) return;
  navigator.clipboard.readText().then(askToPaste).catch(() => {});
}

renderHistory();

document.querySelector("#paste").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!supportedVideoUrl(text)) {
      setStatus("A área de transferência não contém um link compatível.", "error");
      return;
    }
    askToPaste(text);
  } catch {
    setStatus("Não foi possível acessar a área de transferência. Cole o link no campo.", "error");
    urlInput.focus();
  }
});

document.querySelector("#use-detected-link").addEventListener("click", () => {
  urlInput.value = pendingClipboardUrl;
  rememberLink(pendingClipboardUrl);
  clipboardPrompt.hidden = true;
  setStatus("Link colado. Toque em Baixar vídeo.");
  pendingClipboardUrl = "";
  urlInput.focus();
});

document.querySelector("#dismiss-clipboard").addEventListener("click", () => {
  clipboardPrompt.hidden = true;
  pendingClipboardUrl = "";
});

urlInput.addEventListener("paste", event => {
  const text = event.clipboardData?.getData("text");
  if (text) window.setTimeout(() => rememberLink(text), 0);
});

historyList.addEventListener("click", event => {
  const button = event.target.closest("button[data-url]");
  if (!button) return;

  urlInput.value = button.dataset.url;
  urlInput.focus();
  setStatus("Link carregado do histórico.");
});

document.querySelector("#clear-history").addEventListener("click", () => {
  historyItems = [];
  try {
    localStorage.removeItem(historyStorageKey);
  } catch {}
  renderHistory();
});

if (navigator.clipboard && typeof navigator.clipboard.addEventListener === "function") {
  navigator.clipboard.addEventListener("clipboardchange", inspectClipboard);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") inspectClipboard();
  });
}

downloadBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) return setStatus("Cole o link de um vídeo primeiro.", "error");
  rememberLink(url);

  downloadBtn.disabled = true;
  downloadBtn.querySelector("span").textContent = "Preparando vídeo...";
  setStatus("Aguarde enquanto o vídeo é processado. Não feche esta página.");

  try {
    const response = await fetch(`${apiBaseUrl}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Não foi possível baixar esse vídeo.");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : "video.mp4";
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    setStatus("Download iniciado! No iPhone, abra o arquivo baixado ou use Compartilhar > Salvar Vídeo.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.querySelector("span").textContent = "Baixar vídeo";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}