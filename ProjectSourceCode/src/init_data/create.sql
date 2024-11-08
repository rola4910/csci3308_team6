CREATE TABLE playlists (
    id SERIAL PRIMARY KEY,  -- incrementing number to be used to link tables
    name VARCHAR(100) NOT NULL,
    playlist_id VARCHAR(32) NOT NULL, -- used for API calls
    public BOOLEAN NOT NULL,
);

CREATE TABLE playlist_songs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    duration INTEGER NOT NULL,
    artist VARCHAR(100) NOT NULL,
    song_id VARCHAR(32) NOT NULL, -- used for API calls
    album_name VARCHAR(100) NOT NULL,
    album_release VARCHAR(100) NOT NULL,
    added_at VARCHAR(100),
    popularity INTEGER NOT NULL,
);

CREATE TABLE users (
    username VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL,
);