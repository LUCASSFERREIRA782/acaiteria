/**
 * data/menu.js
 * -------------------------------------------------------
 * Cardápio de referência. Serve para duas coisas:
 *   1. popular o Firestore pela primeira vez (data/seed.js);
 *   2. reserva: se o Firestore estiver fora do ar ou vazio,
 *      o site mostra este cardápio em vez de uma tela vazia.
 *
 * Depois do seed, o cardápio "de verdade" é editado no painel
 * /admin (com fotos), não aqui.
 *
 * Campos de produto:
 *   name, description
 *   price      — preço base (usado quando não há tamanhos)
 *   sizes      — opcional: [{ label: "500 ml", price: 22 }]
 *   addons     — true = permite escolher adicionais
 *   image      — URL da foto (o painel faz upload no Storage)
 *   available  — false mostra "esgotado"
 *   featured   — true aparece em "Os queridinhos"
 * -------------------------------------------------------
 */

const menu = {
  categorias: [
    {
      nome: "Açaí no copo",
      slug: "acai-copo",
      produtos: [
        {
          name: "Açaí Tradicional",
          description: "Puro, cremoso, batido com guaraná. Você escolhe os adicionais.",
          price: 14,
          sizes: [
            { label: "300 ml", price: 14 },
            { label: "500 ml", price: 20 },
            { label: "700 ml", price: 26 },
          ],
          addons: true, image: "", available: true, featured: true,
        },
        {
          name: "Açaí Zero",
          description: "Sem açúcar adicionado, adoçado com xilitol.",
          price: 16,
          sizes: [
            { label: "300 ml", price: 16 },
            { label: "500 ml", price: 22 },
          ],
          addons: true, image: "", available: true, featured: false,
        },
        {
          name: "Açaí com Cupuaçu",
          description: "Metade açaí, metade creme de cupuaçu. O azedinho que equilibra.",
          price: 17,
          sizes: [
            { label: "300 ml", price: 17 },
            { label: "500 ml", price: 24 },
          ],
          addons: true, image: "", available: true, featured: false,
        },
      ],
    },
    {
      nome: "Copos da casa",
      slug: "copos-casa",
      produtos: [
        {
          name: "Vila Clássico",
          description: "500 ml com banana, granola, leite em pó e mel.",
          price: 24, addons: true, image: "", available: true, featured: true,
        },
        {
          name: "Ninho & Morango",
          description: "500 ml com morango fresco, creme de ninho e leite condensado.",
          price: 27, addons: true, image: "", available: true, featured: true,
        },
        {
          name: "Paçoca Trufada",
          description: "500 ml com paçoca, creme de avelã e amendoim crocante.",
          price: 28, addons: true, image: "", available: false, featured: false,
        },
      ],
    },
    {
      nome: "Na tigela",
      slug: "tigelas",
      produtos: [
        {
          name: "Bowl Tropical",
          description: "Açaí, manga, kiwi, banana, coco ralado e granola sem glúten.",
          price: 29, addons: true, image: "", available: true, featured: false,
        },
        {
          name: "Bowl Proteico",
          description: "Açaí batido com whey, pasta de amendoim, banana e aveia.",
          price: 32, addons: false, image: "", available: true, featured: false,
        },
      ],
    },
    {
      nome: "Para beber",
      slug: "bebidas",
      produtos: [
        { name: "Vitamina de Açaí", description: "400 ml, batida com banana e leite.", price: 15, addons: false, image: "", available: true, featured: false },
        { name: "Água de Coco", description: "Natural, 350 ml.", price: 8, addons: false, image: "", available: true, featured: false },
        { name: "Água Mineral", description: "500 ml, com ou sem gás.", price: 4.5, addons: false, image: "", available: true, featured: false },
      ],
    },
  ],

  // Adicionais: valem para todo produto com addons: true.
  // price 0 = grátis.
  adicionais: [
    { name: "Banana",              price: 0,   group: "Frutas" },
    { name: "Morango",             price: 3,   group: "Frutas" },
    { name: "Kiwi",                price: 3.5, group: "Frutas" },
    { name: "Manga",               price: 3,   group: "Frutas" },
    { name: "Granola",             price: 0,   group: "Crocantes" },
    { name: "Paçoca",              price: 2,   group: "Crocantes" },
    { name: "Amendoim",            price: 2,   group: "Crocantes" },
    { name: "Leite em pó",         price: 2,   group: "Cremes e caldas" },
    { name: "Leite condensado",    price: 2,   group: "Cremes e caldas" },
    { name: "Creme de ninho",      price: 4,   group: "Cremes e caldas" },
    { name: "Creme de avelã",      price: 5,   group: "Cremes e caldas" },
    { name: "Mel",                 price: 1.5, group: "Cremes e caldas" },
  ],
};
