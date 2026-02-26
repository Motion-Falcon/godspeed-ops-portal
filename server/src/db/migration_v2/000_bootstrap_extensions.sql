-- Consolidated migration_v2 bootstrap
-- Ensures required UUID/random extensions are available.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
