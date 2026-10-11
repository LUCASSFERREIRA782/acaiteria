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

## Horários
Ficam em `js/config.js`. Fora do horário o cliente consegue montar a comanda, mas o envio fica bloqueado.

## Equipe e dados
- **Dar acesso**: a pessoa precisa ter conta no Firebase Authentication. Depois de liberada, ela sai e entra de novo.
- **Dados e privacidade**: apague periodicamente os pedidos com mais de 30 dias. Depois da migração, apague também os registros do sistema antigo.
