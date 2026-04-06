-- PostgreSQL instalado no macOS/Linux (sem Docker)
--
-- 1) Arranque o serviço Postgres (ex.: brew services start postgresql@16)
-- 2) Abra uma sessão como superuser, por exemplo:
--      psql postgres
--    ou, no Postgres.app, abra "postgres" / qualquer DB com o teu superuser.
-- 3) Execute este ficheiro: \i caminho/para/postgres-native-makira.sql
--    ou cole os comandos abaixo.
--
-- 4) Extensão para gen_random_uuid() nas tabelas:
--      psql "postgresql://makira:makira@localhost:5432/makira" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
--
-- 5) No .env use:
--      DATABASE_URL=postgresql://makira:makira@localhost:5432/makira
-- 6) npm run db:local:push   (só aplica o schema; não precisa do Docker)

CREATE ROLE makira WITH LOGIN PASSWORD 'makira';
CREATE DATABASE makira OWNER makira;
