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
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.
const crypto = require('crypto'); // Node.js crypto module
const querystring = require('querystring');

// API AUTHORIZATION
const generateRandomString = (length) => {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const values = crypto.getRandomValues(new Uint8Array(length));
	return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// TODO securely store clientSecret, move other vars to .env
const clientId = "c25f72fe66174e8ab75756ddc591301f";
const redirectUri = "http://localhost:3000/callback";
const scope = 'user-read-private user-read-email';
const clientSecret = '07e098d9c6d7421494042196d2b322fd';

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

// callback function
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
app.get('/login', function (req, res) {
	res.render('pages/login');
});

// app.post('/login', (req, res) => {

// });


app.get('/', (req, res) => {
	res.send("Hello World!");
});

app.get('/logout', (req, res) => {
	req.session.destroy();
	res.redirect('/login');
});


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');
