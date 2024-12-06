DROP TABLE IF EXISTS playlists;
CREATE TABLE playlists (
    -- id SERIAL PRIMARY KEY,  -- incrementing number to be used to link tables
    name VARCHAR(100) NOT NULL,
    owner VARCHAR(32) NOT NULL, -- spotify user_id
    playlist_id VARCHAR(32) PRIMARY KEY NOT NULL, -- used for API calls
    snapshot_id VARCHAR(100) NOT NULL,
    public BOOLEAN NOT NULL
);

DROP TABLE IF EXISTS playlist_songs;
CREATE TABLE playlist_songs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    owner VARCHAR(32) NOT NULL, -- spotify user_id
    uri VARCHAR(256) NOT NULL,
    duration INTEGER NOT NULL,
    artist VARCHAR(256) NOT NULL,
    song_id VARCHAR(32) NOT NULL, -- used for API calls
    album_name VARCHAR(256) NOT NULL,
    album_release VARCHAR(100) NOT NULL,
    added_at VARCHAR(100),
    popularity INTEGER NOT NULL,
    playlist_id VARCHAR(32) REFERENCES playlists(playlist_id)
);

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    username VARCHAR(100) NOT NULL CHECK (username ~ '^[^0-9]+$'),
    password VARCHAR(100) NOT NULL
);