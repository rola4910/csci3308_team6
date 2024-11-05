CREATE TABLE playlists (
    id SERIAL PRIMARY KEY,  -- incrementing number to be used to link tables
    name VARCHAR(100) NOT NULL,
    playlist_id VARCHAR(32) NOT NULL, -- used for API calls
    public BOOLEAN NOT NULL,

);

CREATE TABLE playlist_songs (
    id SERIAL FOREIGN KEY,
    name VARCHAR(100) NOT NULL,
)