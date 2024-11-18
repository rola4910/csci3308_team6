INSERT INTO users (username, password) VALUES ('admin', 'password');

-- FIXME: FOR TESTING: TO BE DELETED LATER
INSERT INTO playlists (name, playlist_id, public) VALUES ('a', 1, TRUE),
('a', 2, TRUE),
('a', 3, TRUE),
('a', 4, TRUE);

INSERT INTO playlist_songs (name, duration, artist, song_id, album_name, album_release, added_at, popularity, playlist_id) VALUES ('a', 1, 'a', 1, 'd', 'a', 'a', 1, 1),
('hi', 1, 'a', 1, 'd', 'a', 'a', 1, 1),
('bye', 1, 'a', 1, 'd', 'a', 'a', 1, 1),
('b', 1, 'a', 1, 'd', 'a', 'a', 2, 2),
('c', 1, 'a', 1, 'd', 'a', 'a', 3, 3);



