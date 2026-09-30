-- H2-only unit/integration fixture. PostgreSQL schema is exclusively owned by Flyway.
CREATE TABLE IF NOT EXISTS shedlock (name varchar(64) PRIMARY KEY, lock_until timestamp NOT NULL, locked_at timestamp NOT NULL, locked_by varchar(255) NOT NULL);
CREATE TABLE IF NOT EXISTS system_config (config_key varchar(100) PRIMARY KEY, config_value varchar(300) NOT NULL, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
