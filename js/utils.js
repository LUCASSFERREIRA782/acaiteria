/**
 * utils.js
 * -------------------------------------------------------
 * Funções puras usadas pelo site e pelo painel.
 * -------------------------------------------------------
 */

const money = valor =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Escapa texto antes de ir para innerHTML. Todo dado vindo do
 *  Firestore ou digitado pelo cliente passa por aqui. */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Aceita só URLs http(s) — evita "javascript:" vindo do banco. */
function safeUrl(url) {
  return /^https?:\/\//i.test(url || "") ? url : "";
}

function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const tmp = document.createElement("textarea");
    tmp.value = text;
    tmp.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(tmp);
    tmp.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    tmp.remove();
    return ok;
  }
}

/** Código curto do pedido, fácil de falar no balcão (sem 0/O/1/I). */
function shortOrderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map(b => chars[b % chars.length]).join("");
}

/** Está aberto agora? Considera fechamento depois da meia-noite. */
function openStatus(hours, now = new Date()) {
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = hours.find(h => h.day === now.getDay() && h.open);
  const yesterday = hours.find(h => h.day === (now.getDay() + 6) % 7 && h.open);

  if (yesterday && toMin(yesterday.close) < toMin(yesterday.open) && nowMin < toMin(yesterday.close)) {
    return { open: true, until: yesterday.close };
  }
  if (today) {
    const o = toMin(today.open), c = toMin(today.close);
    const inside = c > o ? nowMin >= o && nowMin < c : nowMin >= o;
    if (inside) return { open: true, until: today.close };
    if (nowMin < o) return { open: false, opensAt: today.open };
  }
  return { open: false };
}

/* ---------- Pix "copia e cola" (BR Code estático, padrão EMV) ---------- */

function pixField(id, value) {
  return id + String(value.length).padStart(2, "0") + value;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function plainAscii(text, max) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max);
}

function pixCopiaECola({ key, receiverName, city }, amount, txid) {
  const account = pixField("00", "br.gov.bcb.pix") + pixField("01", key);
  const payload =
    pixField("00", "01") +
    pixField("26", account) +
    pixField("52", "0000") +
    pixField("53", "986") +
    (amount > 0 ? pixField("54", amount.toFixed(2)) : "") +
    pixField("58", "BR") +
    pixField("59", plainAscii(receiverName, 25)) +
    pixField("60", plainAscii(city, 15)) +
    pixField("62", pixField("05", plainAscii(txid || "***", 25).replace(/ /g, "") || "***")) +
    "6304";
  return payload + crc16(payload);
}
