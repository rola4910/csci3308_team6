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
const scope = 'user-read-private user-read-email';
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
	const newPlaylistName = req.body.newName;
	console.log(currentPage);
	console.log(newPlaylistName);

	db.any(playlist_query)
		.then(data => {
			console.log(data[1].name)
			const playlists = data;
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
	console.log(currentPage);

	db.any(playlist_query)
		.then(data => {
			console.log(data[1].name)
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
	console.log(currentPage);

	db.any(playlist_query)
		.then(data => {
			console.log(data[1].name)
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

	const playlist_query = 'SELECT * FROM playlists;';
	const songs_query = 'SELECT * FROM playlist_songs WHERE playlist_id = $1;';
	const playlistId = req.body.id; // Retrieve the id from the query parameters
	const playlistName = req.body.name;
	const currentPage = req.body.currentPage; // Gets the path of the current request
	console.log('current page: ', currentPage);

	// console.log('Selected Playlist ID:', playlistId);
	// console.log('Selected Playlist name:', playlistName);

	db.task('get-everything', task => {
		return task.batch([task.any(playlist_query), task.any(songs_query, playlistId)]);
	})
		.then(data => {
			const playlists = data[0];
			const playlist_songs = data[1];
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
	const newPlaylistName = req.body.name;
	res.render('pages/makePlaylist', {newPlaylistName: newPlaylistName});
	// INSERT NEW PLAYLIST TRACKS INTO db
});
// app.post('/login', (req, res) => {


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
				res.redirect('/home');
			}
		})
		.catch(err => {
			res.redirect('/login');
			console.log(err);
			res.status(500);
		});
});


app.get('/register', (req, res) => {
	res.render('pages/register');
});


// Register
app.post('/register', async (req, res) => {
	//hash the password using bcrypt library
	const hash = await bcrypt.hash(req.body.password, 10);

	// To-DO: Insert username and hashed password into the 'users' table
	const query = `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *`;
	const values = [req.body.username, hash];
	db.one(query, values)
		.then(async data => {
			res.redirect('/login');
			console.log('Registration success.');
		})
		.catch(err => {
			res.redirect('/register');
			console.log(err);
		});
});


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

		try {
			// exchange authorization code for access token
			const response = await axios.post(authOptions.url, authOptions.form, { headers: authOptions.headers });
			req.session.access_token = response.data.access_token;
			req.session.refresh_token = response.data.refresh_token;
			res.redirect("/");
		}
		catch (error) {
			res.send(error)
		}
	}
});


const getRefreshToken = async (req) => {
	// refresh token that has been previously stored
	const refreshToken = req.session.refresh_token;
	const url = "https://accounts.spotify.com/api/token";

	if (req.session.access_token) {
		return req.session.access_token;
	}

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

		return response.data.access_token;
	} catch (error) {
		console.error('Error refreshing token:', error);
		throw new Error('Failed to refresh token');
	}
}

// TEST QUERY AGAINST SPOTIFY API - FETCH USER PLAYLISTS
app.get('/getUserPlaylists', async (req, res) => {
	// Assume accessToken is obtained during the authorization flow and stored in session variable
	// fetch accessToken dynamically
	const accessToken = req.session.access_token;

	// Replace {user_id} with the actual user ID you want to fetch playlists for
	const userId = req.session.uid;

	const options = {
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	};

	try {
		const response = await axios.get(`https://api.spotify.com/v1/users/${userId}/playlists`, options);
		console.log("\n----\n", response, "\n----\n");
		res.send(response.data);
	} catch (error) {
		console.error(error);
		res.status(error.response.status).send(error.response.data);
	}
});


// function to get user_id and populate, called in callback
async function get_id(access_token) {
	const options = {
		headers: {
			'Authorization': `Bearer ${access_token}`
		}
	};

	try {
		const user_obj = await axios.get(`https://api.spotify.com/v1/me`, options);
		console.log("\n--get-id--\n", user_obj.data.id, "\n----\n")
		return user_obj.data.id;
	} catch (error) {
		console.log(error);
		return;
	}
}


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');
