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
	})
);

app.use(
	bodyParser.urlencoded({
		extended: true,
	})
);

app.use('/resources', express.static(path.join(__dirname, 'resources')));

// const user = {
//     username: undefined,
//     password: undefined,
// };

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************
app.get('/', function (req, res) {
	res.render('pages/login');
});

app.get('/makePlaylist',  async (req, res) => {
	// res.render('pages/makePlaylist');

	const playlist_query = 'SELECT * FROM playlists;';
    const songs_query = 'SELECT * FROM playlist_songs WHERE playlist_id = $1;';
    const playlistId = await req.query.id; // Retrieve the id from the query parameters

	console.log('Selected Playlist ID:', playlistId);

	db.task('get-everything', task => {
		return task.batch([task.any(playlist_query), task.any(songs_query, playlistId)]);
	  })
	  .then(data => {
		const playlists = data[0];
        const playlist_songs = data[1];
        // Render the makePlaylist page with the playlists and playlist songs
        res.render('pages/makePlaylist', {
            playlists,
            playlist_songs
        });
	  })
	  .catch (err => {
        console.error(err);
        res.status(500).send('Error retrieving playlists and songs');
    });


	// try {
    //     const playlists = await db.any(playlist_query);
    //     const playlist_songs = await db.any(songs_query, id);
    //     res.render('pages/makePlaylist', {playlists, playlist_songs});
    // } catch (err) {
    //     console.error(err);
    //     res.status(500).send('Error retrieving playlists and songs');
    // }

	// try {
    //     const playlists = await db.any('SELECT * FROM playlists;');
    //     const playlist_songs = await db.any('SELECT * FROM playlist_songs;');
    //     res.render('pages/makePlaylist', { playlists, playlist_songs });
    // } catch (err) {
    //     console.error(err);
    //     res.status(500).send('Error retrieving playlists and songs');
    // }
});

// app.post('/login', (req, res) => {
app.get('/login', function (req, res) {
	res.render('pages/login');
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
app.get('/callback', function (req, res) {

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
				res.send(response.data);
			})
			.catch(error => {
				res.send(error.message);
			});
	}
});


// TEST QUERY AGAINST SPOTIFY API - FETCH USER PLAYLISTS
app.get('/getUserPlaylists', async (req, res) => {
	// Replace {user_id} with the actual user ID you want to fetch playlists for
	// TODO dynamically fetch userId
	const userId = 'pisecrest';

	// Assume accessToken is obtained during the authorization flow and stored in a variable
	// fetch accessToken dynamically
	const accessToken = 'BQCeFEY-jcaOayAWNM4sIfJ3hMVMx3vUyAw7tdG0IvrOSs3Ff_fa9BVS7YXNO4XFUXgfoUikYUBOvGRIZF8jyBAyTzY2WNKb6fVin8xHLQ9R4B92rkap6bOS3dGbM4zf-pGiN-A3vAhJ_cd6NSc4DCzKFVn6DWKzOwjNm8VAV9zA8hmj3aKCluG5NFfCmhBHLfVrG7rk';

	const options = {
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	};

	try {
		const response = await axios.get(`https://api.spotify.com/v1/users/${userId}/playlists`, options);
		res.send(response.data);
	} catch (error) {
		console.error(error);
		res.status(error.response.status).send(error.response.data);
	}
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');
