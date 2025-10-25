CREATE TABLE IF NOT EXISTS game_progress (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(100) UNIQUE NOT NULL,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_player_id ON game_progress(player_id);
