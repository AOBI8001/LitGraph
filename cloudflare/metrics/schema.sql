CREATE TABLE IF NOT EXISTS installations (
 install_hash TEXT PRIMARY KEY, first_day TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS installations_day ON installations(first_day);
CREATE TABLE IF NOT EXISTS events (
 event_id TEXT PRIMARY KEY, install_hash TEXT NOT NULL, day TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('launch','use')), processed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS events_day ON events(day);
CREATE TABLE IF NOT EXISTS daily_activity (
 day TEXT NOT NULL, install_hash TEXT NOT NULL, launches INTEGER NOT NULL DEFAULT 0,
 uses INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,install_hash)
);
