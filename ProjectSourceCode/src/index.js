// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server
const crypto = require('crypto'); // Node.js crypto module
const querystring = require('querystring');

// *****************************************************
// <!-- Section 2 : AUTHORIZATION HELPERS
// *****************************************************

// API AUTHORIZATION
const generateRandomString = (length) => {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const values = crypto.getRandomValues(new Uint8Array(length));
	return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

const clientId = "c25f72fe66174e8ab75756ddc591301f";
const redirectUri = "http://localhost:3000/callback";
const scope = 'user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private';
const clientSecret = '07e098d9c6d7421494042196d2b322fd';

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
	extname: 'hbs',
	layoutsDir: __dirname + '/views/layouts',
	partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
	host: 'db', // the database server
	port: 5432, // the database port
	database: process.env.POSTGRES_DB, // the database name
	user: process.env.POSTGRES_USER, // the user account to connect with
	password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
	.then(obj => {
		console.log('Database connection successful'); // you can view this message in the docker compose logs
		obj.done(); // success, release the connection;
	})
	.catch(error => {
		console.log('ERROR:', error.message || error);
	});


// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
	session({
		secret: process.env.SESSION_SECRET,
		saveUninitialized: false,
		resave: false,
		cookie: { secure: false }
	})
);

app.use(
	bodyParser.urlencoded({
		extended: true,
	})
);

app.use('/resources', express.static(path.join(__dirname, 'resources')));


// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************
app.get('/', async function (req, res) {
	if (req.session.access_token != null) {
		req.session.uid = await get_id(req.session.access_token);
	}
	res.render('pages/login');
});

app.get('/features', (req, res) => {
	res.render('pages/features');
});

app.get('/makePlaylist', (req, res) => {
	const playlist_query = 'SELECT * FROM playlists;';
	const currentPage = req.path;
	// console.log(currentPage);

	db.any(playlist_query)
		.then(data => {
			// console.log("makePlaylist:", data[1].name)
			const playlists = data;
			// console.log("makePlaylists query result:", playlists);
			// Render the makePlaylist page with the playlists and playlist songs
			res.render('pages/makePlaylist', {
				playlists: playlists,
				currentPage: currentPage
			});
		})
		.catch(err => {
			console.error(err);
			res.status(500).send('Error retrieving playlists');
		});


});

app.get('/playlistEditor', (req, res) => {
	const playlist_query = 'SELECT * FROM playlists;';
	const currentPage = req.path;
	// console.log(currentPage);

	db.any(playlist_query)
		.then(data => {
			// console.log("playlistEditor:", data[1].name)
			const playlists = data;
			// Render the makePlaylist page with the playlists and playlist songs
			res.render('pages/playlistEditor', {
				playlists: playlists,
				currentPage: currentPage
			});
		})
		.catch(err => {
			console.error(err);
			res.status(500).send('Error retrieving playlists');
		});
});

app.get('/delete', (req, res) => {
	const playlist_query = 'SELECT * FROM playlists;';
	const currentPage = req.path;
	// console.log(currentPage);

	db.any(playlist_query)
		.then(data => {
			// console.log("delete:", data[1].name)
			const playlists = data;
			// Render the makePlaylist page with the playlists and playlist songs
			res.render('pages/delete', {
				playlists: playlists,
				currentPage: currentPage
			});
		})
		.catch(err => {
			console.error(err);
			res.status(500).send('Error retrieving playlists');
		});
});

app.post('/getSongs', (req, res) => {

	const playlistId = req.body.id; // Retrieve the id from the query parameters
	// console.log("chosen id:", playlistId);
	const playlistName = req.body.name;
	const currentPage = req.body.currentPage; // Gets the path of the current request
	const playlist_query = `SELECT * FROM playlists;`;
	const songs_query = `SELECT * FROM playlist_songs WHERE playlist_id = '${playlistId}';`;
	// console.log('current page: ', currentPage);

	// console.log('Selected Playlist ID:', playlistId);
	// console.log('Selected Playlist name:', playlistName);

	db.task('get-everything', task => {
		return task.batch([task.any(playlist_query), task.any(songs_query, playlistId)]);
	})
		.then(data => {
			
			const playlists = data[0];
			const playlist_songs = data[1];

			// Check if playlist_songs or playlists are empty and handle as an error
			if (!playlists.length || !playlist_songs.length) {
				console.error('No matching records found.');
				return res.status(500).send('Error: No matching records found.');
			}

			console.log('playlist: ', playlists[0]);
			console.log('songs: ', playlist_songs[0]);
			// Render the currentPage with the playlists and playlist songs
			if (currentPage === '/makePlaylist' || currentPage === '/playlistEditor' || currentPage === '/delete') {
				res.render(`pages/${currentPage}`, {
					playlists: playlists,
					playlist_songs: playlist_songs,
					playlistName: playlistName,
					currentPage: currentPage
				});
			}
		})
		.catch(err => {
			console.error(err);
			res.status(500).send('Error retrieving playlists and songs');
		});
});

app.post('/makeNewPlaylist', (req, res) => {
	const newPlaylistName = req.body.newName;
	res.render('pages/makePlaylist', {newPlaylistName: newPlaylistName});
	console.log(newPlaylistName);
	// TODO: INSERT NEW PLAYLIST TRACKS INTO db
});

app.post('/addSongs', (req, res) => {
	const selectedSongIDs = req.body.id;
	console.log('Selected Song IDs:', selectedSongIDs);
	res.render('pages/makePlaylist', {selectedSongIDs: selectedSongIDs});

	//ADD SONGS TO DRAFT PLAYLIST
})


app.get('/login', function (req, res) {
	res.render('pages/login', {bodyId: 'login-page'});
});



// login
app.post('/login', async (req, res) => {
	const query = `SELECT * FROM users WHERE username = $1`;
	const username = req.body.username;
	const user = db.one(query, username)
		.then(async data => {
			const match = await bcrypt.compare(req.body.password, data.password);

			if (match == false) {
				return res.render('pages/login', {
					message: "Incorrect username or password."
				});
			} else {
				req.session.user = user;
				req.session.save();
				res.redirect('/');
			}
		})
		.catch(err => {
			res.redirect('/login');
			console.log(err);
			res.status(500);
		});
});


// app.get('/register', (req, res) => {
// 	res.redirect('pages/login');
// });


// Register
app.post('/register', async (req, res) => {
	//hash the password using bcrypt library
	const hash = await bcrypt.hash(req.body.password, 10);

	// To-DO: Insert username and hashed password into the 'users' table
	const query = `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *;`;
	const values = [req.body.username, hash];
	const user = await db.one(query, values)
	.then(data => {
		res.redirect(302, '/login');
		// res.status(200);
		console.log("Data added successfully.");
	  })
	  .catch(err => {
		// console.log(err);
		res.status(400);
		res.render('pages/register', {
		  message: `Invalid input`
		});
	  });
});

// app.post('/register', async (req, res) => {
//     try {
//         // Hash the password
//         const hash = await bcrypt.hash(req.body.password, 10);
        
//         // Insert the user data into the database
//         const query = "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *";
//         const values = [req.body.username, hash];
//         const user = await db.one(query, values);

//         console.log("Data added successfully.");
        
//         // Redirect to /login upon successful registration
//         return res.redirect(302, '/login'); // Default 302 status code for redirect
//     } catch (err) {
//         console.error("Error during registration:", err);
        
//         // Render the registration page with an error message
//         return res.status(400).render('pages/register', { message: 'Invalid input' });
//     }
// });

// app.post('/register', async (req, res) => {
//     try {
//         // Hash the password
//         // const hash = await bcrypt.hash(req.body.password, 10);
        
//         // // Insert the user data into the database
//         // const query = "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *";
//         // const values = [req.body.username, hash];
//         // const user = await db.one(query, values);

//         // console.log("Data added successfully:", user);
        
//         // Log just before redirecting
//         console.log("Reached redirect line, redirecting to /login");
//         return res.redirect(302, '/login');  // Default 302 status code for redirect
//     } catch (err) {
//         console.error("Error during registration:", err);
        
//         // Render the registration page with an error message
//         return res.status(400).render('pages/register', { message: 'Invalid input' });
//     }
// });
  
// app.post('/register', (req, res) => {
//     return res.redirect(302, '/login');
// });

app.get('/logout', (req, res) => {
	req.session.destroy();
	res.redirect('/login');
});

// temp login route for Spotify authorization
app.get('/login2', function (req, res) {

	var state = generateRandomString(16);

	res.redirect('https://accounts.spotify.com/authorize?' +
		querystring.stringify({
			response_type: 'code',
			client_id: clientId,
			scope: scope,
			redirect_uri: redirectUri,
			state: state
		}));
});

// callback function for auth
app.get('/callback', async function (req, res) {

	var code = req.query.code || null;
	var state = req.query.state || null;

	if (state === null) {
		res.redirect('/login' +
			querystring.stringify({
				error: 'state_mismatch'
			}));
	} else {
		var authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				code: code,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code'
			},
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				'Authorization': 'Basic ' + (new Buffer.from(clientId + ':' + clientSecret).toString('base64'))
			},
			json: true
		};

		// exchange authorization code for access token
		axios.post(authOptions.url, authOptions.form, { headers: authOptions.headers })
			.then(response => {
				req.session.access_token = response.data.access_token;
				req.session.refresh_token = response.data.refresh_token;
				req.session.access_token_expiry = response.data.expires_in;
				req.session.start_time = Date.now();

				res.redirect('/');
				// res.send({
				// 	access_token: req.session.access_token,
				// 	refresh_token: req.session.refresh_token
				// });
			})
			.catch(error => {
				res.send(error.message);
			});
	}

	monitorTokens(req);

});

// TEST QUERY AGAINST SPOTIFY API - FETCH USER PLAYLISTS
app.get('/getUserPlaylists', async (req, res) => {
	// Assume accessToken is obtained during the authorization flow and stored in session variable
	const accessToken = req.session.access_token;

	const userId = req.session.uid;

	const options = {
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	};

	try {
		const response = await axios.get(`https://api.spotify.com/v1/users/${userId}/playlists`, options);
		// console.log("\n----\n", response.data, "\n----\n");
		// res.send(response.data);
		const num_playlists = response.total;  // .total is total that could be returned, but 50 is max that can be accessed at once

		addPlaylistsToDB(num_playlists, response.data, req.session.access_token);
		res.redirect('/');

	} catch (error) {
		console.error(error);
		res.send(error.message);
	}
});

// *****************************************************
// TESTING
// *****************************************************

app.get('/welcome', (req, res) => {
	res.json({status: 'success', message: 'Welcome!'});
  });



// *****************************************************
// <!-- Section 5 : Helper Functions
// *****************************************************

// function to get user_id and populate, called in callback
async function get_id(access_token) {
	const options = {
		headers: {
			'Authorization': `Bearer ${access_token}`
		}
	};

	try {
		const user_obj = await axios.get(`https://api.spotify.com/v1/me`, options);
		// console.log("\n--get-id--\n", user_obj.data.id, "\n----\n")
		return user_obj.data.id;
	} catch (error) {
		console.log(error);
		return;
	}
}

// refresh access and refresh tokens, called in monitorTokens()
const getRefreshToken = async (req) => {
	// refresh token that has been previously stored
	const refreshToken = req.session.refresh_token;
	const url = "https://accounts.spotify.com/api/token";

	if (!refreshToken) {
		throw new Error('Refresh token is missing, please reauthenticate user.');
	}

	const headers = {
		'Content-Type': 'application/x-www-form-urlencoded',
		'Authorization': 'Basic ' + (Buffer.from(clientId + ':' + clientSecret).toString('base64'))
	};

	const data = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		client_id: clientId
	});

	try {
		const response = await axios.post(url, data, { headers });

		req.session.access_token = response.data.access_token;

		if (response.data.refresh_token) {
			req.session.refresh_token = response.data.refresh_token;
		}

	} catch (error) {
		console.error('Error refreshing token:', error);
		throw new Error('Failed to refresh token');
	}
}

// function to monitor tokens and refresh if about to expire
const monitorTokens = (req) => {
	// Check every minute if the access token is about to expire
	setInterval(async () => {
		console.log('Checking for expiry...')
		const currentTime = Date.now();
		const timeDiff = currentTime-req.session.start_time;
		const accessTokenExpiry = req.session.access_token_expiry * 1000; // convert token expiration time to milliseconds

		// If the access token is about to expire (5 minutes left)
		if (accessTokenExpiry && (accessTokenExpiry - timeDiff <= 5 * 60 * 1000)) {
			console.log('Access token is about to expire, refreshing...');

			try {
				await getRefreshToken(req);  // Call the function to refresh the token
				console.log('Access token refreshed successfully', req.session.access_token);
				req.session.start_time = Date.now();
			} catch (error) {
				console.error('Error refreshing token:', error);
			}
		}
	}, 60 * 1000); // Check every 60 seconds
};


async function addPlaylistsToDB(num_playlists, response, accessToken) {
	// console.log(num_playlists);

	if (num_playlists <= 50) {
		for (var i = 0; i < num_playlists; i++) {
			const curr_playlist = response.items[i];
	
			if (curr_playlist.tracks.total == 0) {  // skip if no songs
				continue;
			}
	
			if ((curr_playlist.images[0].url).includes("blend")) {  // skip if blend (maybe?)
				continue;
			}
			
			else {
				var name = curr_playlist.name
				if ((name).includes("'")) {
					name = name.replace(/'/g, "''");
				}
				const playlist_id = curr_playlist.id
				const public = curr_playlist.public
	
				// now build query
				const query = `INSERT INTO playlists (name, playlist_id, public) VALUES ('${name}', '${playlist_id}', ${public}) RETURNING *;`;
				db.one(query)
				.then(data => {
					// playlist has been inserted. now to add songs from this specific playlist
					addSongsFromPlaylist(playlist_id, accessToken);
					return;
				})
				.catch(err => {
					console.log(err.message);
					return;
				})
			}
		}
	}
	else {  // more than 50 returned playlists. must access .next after 50th with new api call
		const num_next_calls = (Math.ceil(num_playlists / 50)) - 1;  // at least 1
		var curr_response = response;

		console.log("num_next_calls:", num_next_calls);
		// console.log("current response:", curr_response);

		for (var i = 0; i < num_next_calls; i++) {
			if (i == 0) { // first set of 50. do not need a 'next' call as they are in response already
				for (var j = 0; j < 50; j++) {
					const curr_playlist = response.items[j];
	
					if (curr_playlist.tracks.total == 0) {  // skip if no songs
						continue;
					}
			
					if ((curr_playlist.images[0].url).includes("blend")) {  // skip if blend (maybe?)
						continue;
					}
					
					else {
						var name = curr_playlist.name
						if ((name).includes("'")) {
							name = name.replace(/'/g, "''");
						}
						console.log("adding:", name, "#:", j);
						const playlist_id = curr_playlist.id
						const public = curr_playlist.public
			
						// now build query
						const query = `INSERT INTO playlists (name, playlist_id, public) VALUES ('${name}', '${playlist_id}', ${public}) RETURNING *;`;
						db.one(query)
						.then(data => {
							// playlist has been inserted. now to add songs from this specific playlist
							addSongsFromPlaylist(playlist_id, accessToken);
							return;
						})
						.catch(err => {
							console.log(err.message);
							return;
						})
					}
				}
			}
			else { // start by doing api call to next to get remaining playlists
				const options = {
					headers: {
						'Authorization': `Bearer ${accessToken}`
					}
				}
				curr_response = await axios.get(curr_response.next, options);
				// console.log("current_response now:", curr_response.data);

				var curr_num_playlists = num_playlists % 50;
				console.log("curr_num_playlists:", curr_num_playlists);
				for (var j = 0; j < curr_num_playlists; j++) {
					for (var j = 0; j < curr_num_playlists; j++) {
						const curr_playlist = curr_response.items[j];
		
						if (curr_playlist.tracks.total == 0) {  // skip if no songs
							continue;
						}
				
						if ((curr_playlist.images[0].url).includes("blend")) {  // skip if blend (maybe?)
							continue;
						}
						
						else {
							var name = curr_playlist.name
							if ((name).includes("'")) {
								name = name.replace(/'/g, "''");
							}
							console.log("adding from next:", name, "#:", j+50);
							const playlist_id = curr_playlist.id
							const public = curr_playlist.public
				
							// now build query
							const query = `INSERT INTO playlists (name, playlist_id, public) VALUES ('${name}', '${playlist_id}', ${public}) RETURNING *;`;
							db.one(query)
							.then(data => {
								// playlist has been inserted. now to add songs from this specific playlist
								// addSongsFromPlaylist(playlist_id, accessToken);
								return;
							})
							.catch(err => {
								console.log(err.message);
								return;
							})
						}
					}
				}
			}

		
			num_playlists -= curr_num_playlists;
		}

	}
}


async function addSongsFromPlaylist(playlistId, accessToken) {
	const options = {
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	};

	try {
		const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, options);
		const num_songs = response.data.total;
		if (num_songs <= 100) {
			for (var i = 0; i < num_songs; i++) {	
				const curr_song = response.data.items[i].track;

				var name = curr_song.name;
				if ((name).includes("'")) {
					name = name.replace(/'/g, "''");
				}

				const duration = parseInt(curr_song.duration_ms, 10);
				var first_artist = curr_song.artists[0].name;
				if ((first_artist).includes("'")) {
					first_artist = first_artist.replace(/'/g, "''");
				}

				const song_id = curr_song.id;
				var album_name = curr_song.album.name;
				if ((album_name).includes("'")) {
					album_name = album_name.replace(/'/g, "''");

				}

				const album_release = curr_song.album.release_date;
				const added_at = response.data.items[i].added_at;
				const popularity = parseInt(curr_song.popularity, 10);
				
				const query = `INSERT INTO playlist_songs 
				                   (name, duration, artist, song_id, album_name, album_release, added_at, popularity, playlist_id) 
								   VALUES
								   ('${name}', ${duration}, '${first_artist}', '${song_id}', '${album_name}', '${album_release}', '${added_at}', ${popularity}, '${playlistId}')
							   RETURNING *;`;
				db.one(query)
				.then(data => {
					return 1;
				})
				.catch(err => {
					console.log(err.message);
					return err;
				})
			}
		}
		// console.log("\n");

	} catch (error) {
		console.error(error);
		return error;
	}
}



// *****************************************************
// <!-- Section 6 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000); // Here we are exporting this server file also known as index.js, so that our test file can access it.

console.log('Server is listening on port 3000');