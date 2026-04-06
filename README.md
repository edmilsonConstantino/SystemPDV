# PDVSYSTEM (SmartM007 + Supabase)

Sistema de PDV + pedidos online, com gestão de produtos/pedidos, emissão de recibos/faturas (A7) e histórico.

## Documento do produto (para vender ao cliente)

- `docs/GUIA-DO-SISTEMA.md`

## Rodar em desenvolvimento

```bash
npm install
npm run dev
```

## Base de dados

### Seed (cria utilizadores + categorias + produtos)

```bash
npm run db:seed
```

### Promover um utilizador para admin

```bash
npm run user:promote:admin -- <username>
```

## Pedido online (checkout)

- Em **Transferência**, o cliente anexa o **comprovativo (imagem)**.
- Os números **Mpesa/Emola** são configurados em **Configurações → Recibos & Faturas**.

