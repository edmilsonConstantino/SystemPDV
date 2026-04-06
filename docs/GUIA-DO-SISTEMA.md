# Guia do Sistema (PDVSYSTEM / Makira Sales)

Documento para apresentar o sistema a clientes, demonstrar valor e explicar como funciona.

---

## Visão geral

O **PDVSYSTEM** é uma solução completa para **loja + PDV + pedidos online**, com:

- **PDV (Ponto de Venda)** rápido e simples para a equipa vender no balcão.
- **Pedidos online por código** (o cliente monta o carrinho, envia, recebe um **código**, e acompanha o status).
- **Gestão de produtos e estoque** com alertas (abaixo do mínimo / esgotado).
- **Gestão de pedidos** com estados e resposta ao cliente.
- **Emissão de recibo/fatura A7** com **modelos**, preview e configurações.
- **Relatórios e tendências** com gráficos compactos e insights automáticos.
- **Auditoria profunda** para rastrear ações do sistema (quem fez o quê e quando).
- **Permissões por perfil** para segurança (o que não tem permissão **não aparece** e não executa).

---

## Perfis de utilizador (roles)

O sistema opera com perfis para garantir controlo e segurança:

- **Admin**
  - Acesso total.
  - Cria/edita/apaga utilizadores.
  - Controla permissões e auditoria completa.

- **Gestor (Manager)**
  - Gerencia operação e acompanhamento.
  - Vê utilizadores e auditoria (sem apagar/criar utilizadores, se configurado).
  - Processa pedidos online, finaliza vendas, emite recibos/faturas.

- **Vendedor (Seller)**
  - Foco na venda/PDV.
  - Vê o necessário para vender e atender.
  - Não acessa áreas restritas (ex.: users/permissões).

> Regra do produto: **se o utilizador não tem permissão, a funcionalidade não aparece na interface**.

---

## Módulos do sistema

### 1) PDV (Ponto de Venda)

Onde a equipa realiza vendas rapidamente.

Funcionalidades:

- Pesquisa de produtos e adição ao carrinho.
- Ajuste de quantidade e validação de estoque.
- Finalização de venda com método de pagamento.
- **Emissão automática de recibo/fatura** (preview e impressão).

---

### 2) Produtos & Estoque

Gestão do catálogo da loja.

Funcionalidades:

- Cadastro e atualização de produtos (SKU, preço, custo, unidade).
- Controle de estoque (inclui unidades como **kg** com decimais).
- Alertas inteligentes: **sem estoque** e **abaixo do mínimo**.
- Visão rápida por filtros (ex.: “Sem estoque”, “Abaixo do mínimo”, “Recentes”).

---

### 3) Pedidos online (Cliente)

O cliente faz o pedido como numa “app”.

Como funciona:

1. Cliente escolhe produtos e quantidades.
2. Vai ao checkout, informa nome e telefone e escolhe pagamento.
3. O sistema gera um **código do pedido** (ex.: `ABC12345`).
4. Com o código, o cliente:
   - acompanha status (**Recebido → Aceite → Pronto → Entregue**)
   - vê mensagens/resposta da loja
   - pode visualizar comprovativo (quando aplicável)

Pagamentos:

- **Dinheiro ao levantar**
- **Transferência** com **anexo de comprovativo (imagem)**  
- **Mpesa / Emola** mostrando os números configurados (a loja define em Configurações)

---

### 4) Pedidos (Backoffice)

Painel interno para operar pedidos e comunicar com clientes.

Funcionalidades:

- Tabs por status: **Novos, Aceites, Prontos, Entregues, Cancelados**
- Ações rápidas:
  - Aceitar, marcar pronto, concluir, cancelar, reabrir
  - Resposta para o cliente (aparece no rastreio por código)
- **Finalizar venda do pedido online**:
  - confirmação por **últimos 3 dígitos do telefone**
  - método de pagamento e comprovativo
  - cria venda e abre **preview do recibo/fatura**

---

### 5) Recibos & Faturas (A7)

O sistema permite emitir recibos/faturas com visual profissional e impressão A7.

Funcionalidades:

- **2 modelos** (ex.: Clássico e Compacto)
- Preview antes de imprimir
- Configuração dinâmica:
  - dados da loja (nome, NIF, telefone, endereço)
  - moeda
  - notas padrão
  - ativar/desativar QR/Barcode
  - números Mpesa/Emola para transferências

---

### 6) Relatórios

Relatórios “power” sem ocupar espaço demais.

Funcionalidades:

- Filtros por período (7/30/90 + date range)
- Filtros avançados (pagamento, categoria, vendedor) com **drilldown** por clique
- KPIs com **mini gráficos (small-multiples)**
- Insights automáticos:
  - pico/queda
  - tendência últimos 3 dias
  - top método de pagamento
  - streak (dias seguidos com vendas)
- Export:
  - CSV (Resumo)
  - CSV (Detalhado)
  - Excel

---

### 7) Auditoria profunda

Para lojas que exigem rastreabilidade e controlo.

Funcionalidades:

- Linha do tempo de atividades (ações e detalhes)
- Filtros por usuário/ação
- Consulta por **código do pedido** para ver:
  - logs do pedido
  - logs da venda associada
  - detalhes (payloads) em JSON

---

## Fluxos principais (resumo)

### Fluxo A — Venda no PDV

1. Operador adiciona itens no carrinho
2. Finaliza pagamento
3. Sistema registra venda e atualiza estoque
4. Emite recibo/fatura (A7) com preview

### Fluxo B — Pedido online → venda

1. Cliente envia pedido e recebe código
2. Staff aceita/prepara e responde no pedido
3. Staff finaliza o pedido como venda:
   - confirma últimos 3 dígitos
   - registra pagamento e comprovativo (se necessário)
4. Emite recibo/fatura e registra histórico

---

## Segurança e regras de negócio

- Rotas protegidas por sessão e role.
- A interface esconde features sem permissão.
- Auditoria registra operações críticas (vendas, checkout de pedido, etc).

---

## Implantação (resumo)

Em desenvolvimento:

```bash
npm install
npm run dev
```

Base de dados (seed de demo):

```bash
npm run db:seed
```

Promover utilizador para admin:

```bash
npm run user:promote:admin -- <username>
```

---

## Para demonstração comercial (script rápido)

- **Em 30 segundos**: mostrar PDV e emissão A7 (preview → imprimir).
- **Em 60 segundos**: fazer pedido online, gerar código e rastrear status.
- **Em 90 segundos**: aceitar pedido no backoffice, responder ao cliente, finalizar venda e gerar recibo.
- **Em 2 minutos**: abrir Relatórios e mostrar insights, filtros e drilldown.
- **Em 2:30**: abrir Auditoria e mostrar rastreabilidade de um pedido por código.

