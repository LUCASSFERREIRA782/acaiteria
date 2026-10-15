/**
 * functions/pedidos.js
 * -------------------------------------------------------
 * criarPedido: único caminho para criar pedidos.
 *
 * O cliente envia só as ESCOLHAS (produto, tamanho, adicionais,
 * quantidade, observação). Preços, adicionais e taxa de entrega
 * são recalculados aqui a partir do cardápio e da lista de
 * bairros cadastrados no painel — nenhum valor vem do navegador.
 * As regras do Firestore bloqueiam criação direta em /pedidos.
 *
 * Também confere: loja aberta (horário de Brasília), produto
 * disponível, entrega ativa e bairro atendido.
 * -------------------------------------------------------
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");
const { limitarPedido } = require("./limites");
const { OPCOES_PUBLICAS } = require("./seguranca");

const PAGAMENTOS = { local: ["caixa_cartao", "caixa_pix"], entrega: ["pix", "maquininha"] };
const MAX_LINHAS = 10, MAX_QTD = 20;

const round2 = n => Math.round(n * 100) / 100;
// Só aceita texto ou número: objeto/array vindo do navegador vira vazio (não "[object Object]")
const text = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");
// ID de produto: só letras, números, _ e - (barra em ID quebraria o caminho no banco)
const ID_VALIDO = /^[A-Za-z0-9_-]{1,60}$/;
const fail = (msg, code = "invalid-argument") => { throw new HttpsError(code, msg); };

function orderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...crypto.randomBytes(4)].map(b => chars[b % chars.length]).join("");
}

/** Dia da semana e minutos do dia no horário de Brasília. */
function nowInBrazil(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(p => [p.type, p.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { day, min: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Mesma regra do site (js/utils.js → openStatus), incluindo fechamento após meia-noite. */
function isOpen(loja) {
  if (loja.statusManual === "aberto") return true;
  if (loja.statusManual === "fechado") return false;
  const hours = Array.isArray(loja.horarios) ? loja.horarios : [];
  if (!hours.length) return true; // sem horário cadastrado no painel: não bloqueia
  const toMin = t => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  const { day, min } = nowInBrazil();
  const yesterday = hours.find(h => h.day === (day + 6) % 7 && h.open);
  if (yesterday && toMin(yesterday.close) < toMin(yesterday.open) && min < toMin(yesterday.close)) return true;
  const today = hours.find(h => h.day === day && h.open);
  if (!today) return false;
  const o = toMin(today.open), c = toMin(today.close);
  return c > o ? min >= o && min < c : min >= o;
}

exports.criarPedido = onCall({ ...OPCOES_PUBLICAS, maxInstances: 10 }, async request => {
  const d = request.data || {};

  // ---- 1. Dados do cliente ----
  const modo = d.modo === "entrega" ? "entrega" : d.modo === "local" ? "local" : fail("Escolha entrega ou consumir aqui.");
  const pagamento = PAGAMENTOS[modo].includes(d.pagamento) ? d.pagamento : fail("Forma de pagamento inválida para essa modalidade.");
  const apelido = text(d.apelido, 30);
  if (apelido.length < 2) fail("Diga como podemos te chamar.");
  const mesaPedida = modo === "local" ? text(d.mesa, 10) : "";
  const linhas = Array.isArray(d.itens) ? d.itens : [];
  if (!linhas.length || linhas.length > MAX_LINHAS) fail(`A comanda precisa ter de 1 a ${MAX_LINHAS} itens.`);

  // Anti-abuso: só depois das validações baratas, antes de ler o banco
  await limitarPedido(request);

  const db = getFirestore();
  const ids = [...new Set(linhas.map(l => text(l?.productId, 60)).filter(Boolean))];
  if (ids.some(id => !ID_VALIDO.test(id))) fail("Itens inválidos.");
  if (!ids.length) fail("Itens inválidos.");

  const [prodSnaps, addonsDoc, deliveryDoc, lojaDoc, mesasDoc] = await Promise.all([
    db.getAll(...ids.map(id => db.collection("produtos").doc(id))),
    db.collection("config").doc("adicionais").get(),
    db.collection("config").doc("deliveryFees").get(),
    db.collection("config").doc("loja").get(),
    db.collection("config").doc("mesasPrivado").get(),
  ]);
  const loja = lojaDoc.exists ? lojaDoc.data() : {};

  // ---- Mesa ----
  // Com QR por mesa ativo (painel → Mesas e QR), a mesa só vale com o código
  // impresso daquela mesa: ninguém pede "da mesa 5" de fora da loja, nem com
  // mesa que não existe. Sem QR por mesa ainda: comportamento antigo (digitada),
  // limitada à quantidade de mesas se ela estiver cadastrada.
  const mesasCfg = mesasDoc.exists ? mesasDoc.data() : {};
  const codigos = mesasCfg.codigos && typeof mesasCfg.codigos === "object" ? mesasCfg.codigos : null;
  let mesa = "";
  if (mesaPedida) {
    if (codigos && Object.keys(codigos).length) {
      const n = /^\d{1,3}$/.test(mesaPedida) ? String(Number(mesaPedida)) : "";
      if (!n || !codigos[n] || codigos[n] !== text(d.mesaCodigo, 16)) {
        fail("Este QR Code de mesa não vale mais. Chame um atendente ou peça sem mesa.", "failed-precondition");
      }
      mesa = n;
    } else {
      const qtd = Number(mesasCfg.quantidade) || 0;
      if (qtd && /^\d+$/.test(mesaPedida) && Number(mesaPedida) > qtd) fail(`Mesa ${mesaPedida} não existe. Confira o número na mesa.`);
      mesa = mesaPedida;
    }
  }
  if (!isOpen(loja)) fail("A loja está fechada agora.", "failed-precondition");

  const produtos = new Map(prodSnaps.filter(s => s.exists).map(s => [s.id, s.data()]));
  const adicionais = addonsDoc.exists ? addonsDoc.data().itens || [] : [];

  // ---- 2. Preços sempre do cardápio ----
  const itens = linhas.map(l => {
    const p = produtos.get(text(l?.productId, 60));
    if (!p) fail("Um dos produtos não existe mais. Atualize a página.", "failed-precondition");
    if (!p.available) fail(`${p.name} está esgotado.`, "failed-precondition");

    const qtd = Number(l.qtd);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > MAX_QTD) fail("Quantidade inválida.");

    let base = Number(p.price);
    let tamanho = "";
    if (Array.isArray(p.sizes) && p.sizes.length) {
      const s = p.sizes.find(x => x.label === l.tamanho);
      if (!s) fail(`Escolha um tamanho válido para ${p.name}.`);
      base = Number(s.price);
      tamanho = s.label;
    }

    const nomes = Array.isArray(l.adicionais) ? [...new Set(l.adicionais.map(a => text(a, 40)))] : [];
    if (nomes.length && !p.addons) fail(`${p.name} não aceita adicionais.`);
    if (nomes.length > 20) fail("Adicionais demais.");
    const escolhidos = nomes.map(n => adicionais.find(a => a.name === n) || fail(`Adicional indisponível: ${n}.`));

    const unit = round2(base + escolhidos.reduce((s, a) => s + Number(a.price || 0), 0));
    if (!(unit >= 0 && unit <= 10000)) fail("Preço inválido no cardápio.", "failed-precondition");
    return { id: text(l.productId, 60), nome: text(p.name, 80), tamanho, adicionais: escolhidos.map(a => a.name), obs: text(l.obs, 120), qtd, unit };
  });

  // ---- 3. Taxa de entrega sempre da configuração do painel ----
  let bairro = "", taxaEntrega = 0;
  if (modo === "entrega") {
    const del = deliveryDoc.exists ? deliveryDoc.data() : {};
    if (!del.ativo) fail("A entrega está pausada no momento.", "failed-precondition");
    if (del.modo === "bairro") {
      const b = (del.bairros || []).find(x => x.nome === d.bairro);
      if (!b) fail("Escolha um bairro da lista de entrega.");
      bairro = b.nome;
      taxaEntrega = round2(Number(b.taxa || 0));
    } else {
      bairro = text(d.bairro, 40);
      taxaEntrega = round2(Number(del.taxaFixa || 0));
    }
  }

  const subtotal = round2(itens.reduce((s, i) => s + i.unit * i.qtd, 0));
  const total = round2(subtotal + taxaEntrega);

  // ---- 4. WhatsApp que recebe o endereço (divide entre a equipe) ----
  let atendente = null;
  if (modo === "entrega" && Array.isArray(loja.whatsapps) && loja.whatsapps.length) {
    atendente = loja.whatsapps[crypto.randomInt(loja.whatsapps.length)];
  }

  const codigo = orderCode();
  const order = {
    codigo, modo, pagamento, apelido, mesa, bairro, itens,
    subtotal, taxaEntrega, total, status: "novo", pago: false,
    criadoEm: FieldValue.serverTimestamp(),
  };
  if (atendente?.nome) order.atendente = text(atendente.nome, 30);

  // ---- 5. Estoque (só produtos com estoque cadastrado no painel) ----
  // Baixa e pedido na MESMA transação: dois clientes não levam a última
  // unidade ao mesmo tempo. Zerou = esgotado no cardápio na hora.
  const qtdPorProduto = new Map();
  itens.forEach(i => qtdPorProduto.set(i.id, (qtdPorProduto.get(i.id) || 0) + i.qtd));
  const comEstoque = [...qtdPorProduto.keys()].filter(id => produtos.get(id)?.estoque != null);
  const ref = db.collection("pedidos").doc();
  if (!comEstoque.length) {
    await ref.set(order); // caminho de sempre: nenhum produto do pedido controla estoque
  } else {
    await db.runTransaction(async t => {
      const refs = comEstoque.map(id => db.collection("produtos").doc(id));
      const snaps = await t.getAll(...refs);
      snaps.forEach((snap, k) => {
        const p = snap.data() || {};
        const pedido = qtdPorProduto.get(comEstoque[k]);
        const atual = Number(p.estoque);
        if (p.estoque == null) return; // deixou de controlar no meio do caminho
        if (atual < pedido) {
          fail(atual > 0 ? `Só restam ${atual} de ${p.name}. Ajuste a quantidade.` : `${p.name} acabou de esgotar.`, "failed-precondition");
        }
        const estoque = atual - pedido;
        t.update(refs[k], estoque === 0 ? { estoque, available: false } : { estoque });
      });
      t.set(ref, order);
    });
  }
  return {
    id: ref.id, codigo, itens, subtotal, taxaEntrega, total, bairro,
    atendente: atendente ? { nome: atendente.nome, numero: atendente.numero } : null,
  };
});
