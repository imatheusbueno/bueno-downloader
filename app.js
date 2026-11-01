const urlInput = document.querySelector("#url");
const statusEl = document.querySelector("#status");
const downloadBtn = document.querySelector("#download");

function setStatus(message, type="") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

document.querySelector("#paste").addEventListener("click", async () => {
  try {
    urlInput.value = await navigator.clipboard.readText();
    setStatus("Link colado. Toque em Baixar vídeo.");
    urlInput.focus();
  } catch {
    setStatus("Não foi possível acessar a área de transferência. Cole o link no campo.", "error");
    urlInput.focus();
  }
});

downloadBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) return setStatus("Cole o link de um vídeo primeiro.", "error");

  downloadBtn.disabled = true;
  downloadBtn.querySelector("span").textContent = "Preparando vídeo...";
  setStatus("Aguarde enquanto o vídeo é processado. Não feche esta página.");

  try {
    const response = await fetch("/api/download", {
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
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
