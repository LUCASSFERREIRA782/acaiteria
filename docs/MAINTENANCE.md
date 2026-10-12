# Rotina da loja (painel /admin)

## Pedidos
Quadro em tempo real com quatro colunas: **Novos → Preparando → Pronto/Saiu → Finalizados**.

- Pedido novo toca um aviso sonoro. O navegador só libera o som depois do primeiro clique na página.
- **Entrega**: o card mostra só apelido e bairro. O endereço chega no WhatsApp da loja com o mesmo código (`#7KT5`). Confira o código antes de sair.
- **Pix na entrega**: o cliente recebe o copia e cola com o valor e o código do pedido como identificador. Confira o recebimento no app do banco e marque **Pago**.
- **Consumir aqui**: o cliente paga no caixa (cartão ou Pix) informando o código. Marque **Pago**.
- O cliente acompanha o status pelo celular enquanto a página estiver aberta.

## Cardápio
- **+ Produto / Editar**: nome, descrição, categoria, preço, foto, tamanhos (ex.: 300/500/700 ml), "aceita adicionais", disponível, destaque.
- A foto é reduzida para 1200 px e convertida em WebP no próprio navegador antes do envio (limite de 5 MB nas regras do Storage). Ao trocar ou remover, a foto antiga é apagada do Storage.
- Acabou um sabor? Desligue a chave **Disponível** direto na lista e ele aparece como "Esgotado".
- **+ Categoria / Editar categoria**: nome e posição no cardápio.

## Adicionais
Uma lista única (nome, grupo, preço), usada por todo produto com "aceita adicionais". Preço 0 aparece como "grátis". Os grupos (Frutas, Crocantes…) viram seções na montagem do copo.

## Entrega
Liga/desliga a entrega e define a taxa: única para todos ou por bairro (o cliente escolhe o bairro numa lista).

## Pix da loja
Na aba **Entrega → Pix da loja**: tipo de chave, chave, nome do recebedor (até 25 letras) e cidade (até 15). Esses dados ficam protegidos no servidor e nunca aparecem no site. Troque os dados de exemplo pelos reais antes de aceitar Pix.

## Loja e equipe
- **Horário de funcionamento:** abertura e fechamento de cada dia da semana, ou "Fechado". Fechamento depois da meia-noite funciona (ex.: 18:00 → 01:00). Fora do horário o cliente monta a comanda, mas o envio fica bloqueado.
- **Abrir agora / Fechar agora:** sobrepõe os horários até você voltar para "Seguir horários" (feriado, falta de produto, fim de expediente antecipado).
- **WhatsApp da equipe:** um ou mais números. Os marcados com "Recebe pedidos" dividem os pedidos de entrega entre si, e o card do pedido mostra quem recebeu. Só esses aparecem no site; os outros ficam privados.
- **Dados da loja:** nome, frase do topo, endereço e Instagram.
- **Administradores:** a pessoa precisa ter conta no Firebase Authentication. Depois de liberada, ela sai e entra de novo.

## Relatórios e dados
- **Desempenho:** pedidos e faturamento por dia ou por dia da semana (7, 30 ou 90 dias), com maior faturamento, mais pedidos, maior ticket médio e o destaque "menos pedidos, mais faturamento". Passe o mouse nas colunas para ver os detalhes, ou abra "Ver tabela". Faturamento não é lucro: o custo dos produtos não é registrado.
- **Dados e privacidade:** mostra quantos pedidos estão guardados. Apaga pedidos finalizados e cancelados com mais de 0, 7, 30 ou 90 dias; "0 dias" serve para limpar testes. Pedidos em andamento nunca são apagados. Antes de apagar, os totais do dia vão para o relatório, sem nenhum dado do cliente. Use também para apagar os registros do sistema antigo.
