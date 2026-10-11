/**
 * config.js
 * -------------------------------------------------------
 * Tudo que identifica a açaiteria fica aqui. Nenhum outro
 * arquivo tem nome, telefone ou chave Pix escritos à mão.
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

  // Usado para gerar o Pix "copia e cola" com o valor já preenchido
  // (só no pedido de entrega — na loja o Pix é feito no caixa).
  pix: {
    key: "+5511977777777",   // telefone com +55, e-mail, CPF/CNPJ ou chave aleatória
    keyType: "Telefone",
    receiverName: "ROXO DA VILA",  // até 25 caracteres, sem acento
    city: "SANTO ANDRE",           // até 15 caracteres, sem acento
  },

  seo: {
    title: "Roxo da Vila — Açaiteria",
    description: "Açaí batido na hora, do seu jeito. Peça para entrega ou consuma aqui.",
  },
};
