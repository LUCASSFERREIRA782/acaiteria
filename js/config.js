/**
 * config.js
 * -------------------------------------------------------
 * Tudo que identifica a açaiteria fica aqui. Nenhum outro
 * arquivo tem nome ou telefone escritos à mão.
 * -------------------------------------------------------
 */

const restaurantConfig = {
  name: "Roxo da Vila",
  slogan: "Açaí batido na hora, desde a primeira colherada",

  whatsapp: "5511977777777",            // só números, com DDI 55
  instagram: "https://instagram.com/roxodavila",
  address: "Vila Luzita, Santo André — SP",

  // day: 0 = domingo … 6 = sábado. Sem "open" = fechado.
  hours: [
    { label: "Segunda", day: 1, open: "13:00", close: "22:00" },
    { label: "Terça",   day: 2, open: "13:00", close: "22:00" },
    { label: "Quarta",  day: 3, open: "13:00", close: "22:00" },
    { label: "Quinta",  day: 4, open: "13:00", close: "22:00" },
    { label: "Sexta",   day: 5, open: "13:00", close: "23:30" },
    { label: "Sábado",  day: 6, open: "12:00", close: "23:30" },
    { label: "Domingo", day: 0, open: "12:00", close: "21:00" },
  ],

  // A chave Pix NÃO fica aqui (este arquivo é público).
  // Ela é cadastrada no painel /admin → Entrega → Pix e usada
  // só no servidor (Cloud Function gerarPix).

  seo: {
    title: "Roxo da Vila — Açaiteria",
    description: "Açaí batido na hora, do seu jeito. Peça para entrega ou consuma aqui.",
  },
};
