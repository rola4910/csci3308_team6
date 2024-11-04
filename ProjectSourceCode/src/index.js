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


// API AUTHORIZATION
const clientId = process.env.SPOTIFY_CLIENT_ID; // your clientId
const redirectUrl = process.env.SPOTIFY_REDIRECT_URI;        // your redirect URL - must be localhost URL and/or HTTPS

const authorizationEndpoint = process.env.AUTHORIZATION_ENDPOINT;
const tokenEndpoint = process.env.TOKEN_ENDPOINT;
const scope = process.env.SCOPEn;

/**
 * CODE VERIFIER:
 * PKCE auth flow begins with creation of code verifier, 43-128 char random string.
 * @param {number} length 
 * @returns code verifier 
 */
const generateRandomString = (length) => {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const values = crypto.getRandomValues(new Uint8Array(length));
	return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

const codeVerifier = generateRandomString(64);

/** CODE CHALLENGE:
 *  Once verifier generated, hash it using SHA256l. Thia value is sent within user authorization request.
 */
const sha256 = async (plain) => {
	const encoder = new TextEncoder()
	const data = encoder.encode(plain)
	return window.crypto.subtle.digest('SHA-256', data)
}

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

app.get('/login', function (req, res) {
	res.render('pages/login');
});

// login
app.post('/login', async (req, res) => {
    const query = `SELECT * FROM users WHERE username = $1`;
    const username = req.body.username;
    const user = db.one(query, username)
    .then(async data =>      {
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


app.get('/', (req, res) => {
	res.send("Hello World!");
});

app.get('/logout', (req, res) => {
	req.session.destroy();
	res.redirect('/login');
});



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
