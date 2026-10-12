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
    if (nowMin < o) return { open: false, opensAt: today.open, opensLabel: `às ${today.open}` };
  }
  // Próxima abertura nos próximos dias
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  for (let i = 1; i <= 7; i++) {
    const day = (now.getDay() + i) % 7;
    const next = hours.find(h => h.day === day && h.open);
    if (next) return { open: false, opensAt: next.open, opensLabel: `${i === 1 ? "amanhã" : names[day]} às ${next.open}` };
  }
  return { open: false };
}

/** Texto curto do status, usado no site e no painel. */
function openStatusText(st) {
  if (st.open) return st.until ? `Aberto até ${st.until}` : "Aberto agora";
  return st.opensLabel ? `Abre ${st.opensLabel}` : "Fechado";
}
