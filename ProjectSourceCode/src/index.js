// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require("express"); // To build an application server or API
const app = express();
const handlebars = require("express-handlebars");
const Handlebars = require("handlebars");
const path = require("path");
const pgp = require("pg-promise")(); // To connect to the Postgres DB from the node server
const bodyParser = require("body-parser");
const session = require("express-session"); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require("bcryptjs"); //  To hash passwords
const axios = require("axios"); // To make HTTP requests from our server
const crypto = require("crypto"); // Node.js crypto module
const querystring = require("querystring");

// *****************************************************
// <!-- Section 2 : AUTHORIZATION HELPERS
// *****************************************************

// API AUTHORIZATION
const generateRandomString = (length) => {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

const clientId = "c25f72fe66174e8ab75756ddc591301f";
const redirectUri = "http://localhost:3000/callback";
const scope = 'user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private user-read-playback-state user-modify-playback-state user-read-currently-playing streaming app-remote-control';
const clientSecret = '07e098d9c6d7421494042196d2b322fd';

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: "hbs",
  layoutsDir: __dirname + "/views/layouts",
  partialsDir: __dirname + "/views/partials",
});

// database configuration
const dbConfig = {
  host: "db", // the database server local
  // host: 'dpg-ct0bpclumphs73f3qem0-a',
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then((obj) => {
    console.log("Database connection successful"); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch((error) => {
    console.log("ERROR:", error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine("hbs", hbs.engine);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: { secure: false },
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use("/resources", express.static(path.join(__dirname, "resources")));

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

app.get("/", async function (req, res) {
  if (req.session.access_token != null) {
    res.redirect("/home");
  } else {
    res.redirect("/login");
  }
});

app.get("/login", function (req, res) {
  res.render("pages/login", { bodyId: "login-page" });
});


// login
app.post("/login", async (req, res) => {
  const query = `SELECT * FROM users WHERE username = $1`;
  const username = req.body.username;
  const user = db
    .one(query, username)
    .then(async (data) => {
      const match = await bcrypt.compare(req.body.password, data.password);

      if (match == false) {
        return res.render("pages/login", {
          message: "Incorrect username or password.",
        });
      } else {
        req.session.user = user;
        req.session.save();
        res.redirect("/");
      }
    })
    .catch((err) => {
      res.redirect("/login");
      console.log(err);
      res.status(500);
    });
});


app.get("/register", (req, res) => {
  res.render("pages/register");
});


// Register
app.post("/register", async (req, res) => {
  //hash the password using bcrypt library
  const hash = await bcrypt.hash(req.body.password, 10);

  const query = `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *`;
  const values = [req.body.username, hash];
  db.one(query, values)
    .then(async (data) => {
      res.redirect("/login");
      console.log("Registration success.");
    })
    .catch((err) => {
      res.redirect("/register");
      console.log(err);
    });
});


app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});


// login route for Spotify authorization
app.get("/login2", function (req, res) {
  var state = generateRandomString(16);

  res.redirect(
    "https://accounts.spotify.com/authorize?" +
    querystring.stringify({
      response_type: "code",
      client_id: clientId,
      scope: scope,
      redirect_uri: redirectUri,
      state: state,
    })
  );
});


// callback function for auth
app.get("/callback", async function (req, res) {
  var code = req.query.code || null;
  var state = req.query.state || null;

  if (state === null) {
    res.redirect(
      "/login" +
      querystring.stringify({
        error: "state_mismatch",
      })
    );
  } else {
    var authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      },
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          new Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      },
      json: true,
    };

    // exchange authorization code for access token
    axios
      .post(authOptions.url, authOptions.form, { headers: authOptions.headers })
      .then((response) => {
        req.session.access_token = response.data.access_token;
        req.session.refresh_token = response.data.refresh_token;
        req.session.access_token_expiry = response.data.expires_in;
        req.session.start_time = Date.now();

        res.redirect("/getUserPlaylists");
      })
      .catch((error) => {
        res.send(error.message);
      });
  }

  monitorTokens(req);
});


// Authentication Middleware.
const auth = (req, res, next) => {
  if (!req.session.access_token) {
    // Default to login page.
    return res.redirect("/login");
  }
  next();
};

// Authentication Required
app.use(auth);


app.get("/home", (req, res) => {
  res.render("pages/home", { bodyId: "home-page" });
});


app.get("/makePlaylist", (req, res) => {
  const playlist_query = `SELECT * FROM playlists WHERE playlists.owner = '${req.session.uid}';`;
  const currentPage = req.path;
  // console.log(currentPage);

  db.any(playlist_query)
    .then((data) => {

      // console.log("makePlaylist:", data[1].name)
      const playlists = data;
      // console.log("makePlaylists query result:", playlists);
      // Render the makePlaylist page with the playlists and playlist songs
      res.render("pages/makePlaylist", {
        playlists: playlists,
        currentPage: currentPage,
        bodyId: "make-playlist-page"
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Error retrieving playlists");
    });
});

app.post('/makePlaylist', (req, res) => {
  const playlist_query = 'SELECT * FROM playlists;';
  const currentPage = req.body.currentPage;
  const selectedPlaylistName = req.body.selectedPlaylistName;
  const selectedPlaylistId = req.body.id; // Retrieve playlist_id from query params
  const newPlaylistName = req.body.newName || req.session.newPlaylistName;
  const section = req.body.section;
  const exported = req.body.export;
  const toBeCleared = req.body.toBeCleared;
  const selectedSongs = Array.isArray(req.body.tracks)
    ? req.body.tracks
    : req.body.tracks
      ? [req.body.tracks] // Wrap single value in an array
      : [];


  if (!req.session.draftPlaylist) {
    req.session.draftPlaylist = [];
  }
  if (req.body.newName) {
    req.session.newPlaylistName = req.body.newName;
  }
  if (req.body.id) {
    req.session.selectedPlaylistId = selectedPlaylistId;
    console.log('sekected playlist ID saved to session', req.session.selectedPlaylistId)
  }

  console.log("new name: ", newPlaylistName);

  // If a playlist is selected, get its songs
  const getSongsPromise = selectedPlaylistId
    ? getSongs(selectedPlaylistId)
    : Promise.resolve([]); // No playlist selected, return an empty array

  var chosenSongsPromise = selectedSongs.length
    ? chosenSongs(selectedSongs)
    : Promise.resolve([]);


  const clearDraftPlaylistPromise = toBeCleared
    ? clearDraftPlaylist(req)
    : Promise.resolve([]);

  const createPlaylistPromise = req.body.export === "true"
    ? createPlaylist(req)
    : Promise.resolve([]);

  Promise.all([
    getSongsPromise,
    db.any(playlist_query),
    chosenSongs(selectedSongs),
    createPlaylistPromise,
    clearDraftPlaylistPromise


  ])
    .then(([playlist_songs, playlists, chosenSongs]) => {
      // console.log('.then: ', newPlaylistName)


      if (chosenSongs && Array.isArray(chosenSongs)) {
        chosenSongs.forEach((song) => {
          if (!req.session.draftPlaylist.some((s) => s.song_id === song.song_id)) {
            req.session.draftPlaylist.push(song);
          }
        });
      }

      // req.session.draftPlaylist = draftPlaylist;
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
        }
      });

      if (currentPage === '/makePlaylist')
        bodyId = 'make-playlist-page';
      else if (currentPage === '/playlistEditor')
        bodyId = 'edit-playlist-page';
      else if (currentPage === '/deletePlaylist')
        bodyId = 'delete-playlist-page';

      const renderData = {
        currentPage: currentPage,
        playlists: playlists,
        playlist_songs: playlist_songs || [],
        draftPlaylist: req.session.draftPlaylist || [],
        newPlaylistName: newPlaylistName,
        selectedPlaylistName: selectedPlaylistName,
        bodyId: bodyId

      };

      // Render the playlist_songs only for the relevant section
      if (req.body.section === 'left') {
        renderData.playlist_songs = playlist_songs || [];
      } else if (req.body.section === 'right') {
        renderData.playlist_songs = []; // Clear the playlist_songs for the other section
      }
      // console.log(renderData);

      res.render(`pages${currentPage}`, renderData);

    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error retrieving playlists and songs');
    });
});


app.get("/playlistEditor", (req, res) => {
  const playlist_query = `SELECT * FROM playlists WHERE playlists.owner = '${req.session.uid}';`;
  const currentPage = req.path;
  // console.log(currentPage);

  db.any(playlist_query)
    .then((data) => {
      const playlists = data;
      // Render the makePlaylist page with the playlists and playlist songs
      // console.log(currentPage);
      res.render("pages/playlistEditor", {
        playlists: playlists,
        currentPage: currentPage,
        bodyId: "edit-playlist-page"
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Error retrieving playlists");
    });
});


app.get("/delete", (req, res) => {
  const playlist_query = `SELECT * FROM playlists WHERE playlists.owner = '${req.session.uid}';`;
  const currentPage = req.path;
  const playlist_id = req.body.id;
  console.log('TEST playlist ID: ', playlist_id);
  // console.log(currentPage);

  db.any(playlist_query)
    .then((data) => {
      // console.log("delete:", data[1].name)
      const playlists = data;
      // Render the makePlaylist page with the playlists and playlist songs
      res.render("pages/delete", {
        playlists: playlists,
        currentPage: currentPage,
        bodyId: "delete-playlist-page"
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Error retrieving playlists");
    });
});


app.post("/deletePlaylist", async (req, res) => {
  const access_token = req.session.access_token;
  const playlist_id = req.session.selectedPlaylistId;
  console.log('req.body.selectedPlaylistId inside deletePlaylist', req.session.selectedPlaylistId)
  console.log('playlist_id inside deletePlaylist', playlist_id)

  // console.log("recieved id:", playlist_id);

  const snapshot_id_query = `SELECT snapshot_id FROM playlists WHERE playlist_id = '${playlist_id}';`;
  const song_uris_query = `SELECT uri FROM playlist_songs WHERE playlist_id = '${playlist_id}';`;

  db.task("get-everything", (task) => {
    return task.batch([
      task.one(snapshot_id_query),
      task.many(song_uris_query),
    ]);
  })
    .then((data) => {
      const snapshot_id = data[0];
      const uris = data[1];

      deleteSongs(snapshot_id, uris, playlist_id, access_token);

      res.render("pages/delete");
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Error retrieving playlist snapshot id and song uris");
    })

})

app.get("/getUserPlaylists", async (req, res) => {
  // Assume accessToken is obtained during the authorization flow and stored in session variable
  const accessToken = req.session.access_token;

  if (req.session.access_token != null) {
    req.session.uid = await get_id(req.session.access_token);
  }
  else {
    res.send("Error with user_id");
    return;
  }

  const userId = req.session.uid;

  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      options
    );
    // console.log("\n----\n", response.data, "\n----\n");
    // res.send(response.data);

    const total_playlists = response.data.total;
    // console.log('TOTAL : ', total_playlists);

    addPlaylistsToDB(
      total_playlists,
      response.data,
      req.session.access_token,
      req.session.uid
    );
    res.redirect("/home");
  } catch (error) {
    console.error(error);
    res.send(error.message);
  }
});

app.get('/player', (req, res) => {
	const accessToken = req.session.access_token;

	res.render('pages/player', { accessToken });
});


// *****************************************************
// <!-- Section 5 : Helper Functions
// *****************************************************

// refresh access and refresh tokens, called in monitorTokens()
const getRefreshToken = async (req) => {
  // refresh token that has been previously stored
  const refreshToken = req.session.refresh_token;
  const url = "https://accounts.spotify.com/api/token";

  if (!refreshToken) {
    throw new Error("Refresh token is missing, please reauthenticate user.");
  }

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization:
      "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
  };

  const data = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  try {
    const response = await axios.post(url, data, { headers });

    req.session.access_token = response.data.access_token;

    if (response.data.refresh_token) {
      req.session.refresh_token = response.data.refresh_token;
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw new Error("Failed to refresh token");
  }
};


// function to monitor tokens and refresh if about to expire
const monitorTokens = (req) => {
  // Check every minute if the access token is about to expire
  setInterval(async () => {
    console.log("Checking for expiry...");
    const currentTime = Date.now();
    const timeDiff = currentTime - req.session.start_time;
    const accessTokenExpiry = req.session.access_token_expiry * 1000; // convert token expiration time to milliseconds

    // If the access token is about to expire (5 minutes left)
    if (accessTokenExpiry && accessTokenExpiry - timeDiff <= 5 * 60 * 1000) {
      console.log("Access token is about to expire, refreshing...");

      try {
        await getRefreshToken(req); // Call the function to refresh the token
        console.log(
          "Access token refreshed successfully",
          req.session.access_token
        );
        req.session.start_time = Date.now();
      } catch (error) {
        console.error("Error refreshing token:", error);
      }
    }
  }, 60 * 1000); // Check every 60 seconds
};


// function to get user_id and populate, called in callback
async function get_id(access_token) {
  const options = {
    headers: {
      Authorization: `Bearer ${access_token}`
    },
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


async function addPlaylistsToDB(num_playlists, response, accessToken, uid) {
  // console.log("ALL PLAYLISTS:", response.items);
  if (num_playlists <= 50) {
    // console.log('num_playlists < 50');
    for (var i = 0; i < num_playlists; i++) {
      const curr_playlist = response.items[i];
      // console.log("CURRENT PLAYLIST:\n", curr_playlist, "\n\n");
      if (curr_playlist == null || curr_playlist == undefined) {
        continue;
      }

      if (curr_playlist.tracks.total == 0) {
        // skip if no songs
        continue;
      }

      if (curr_playlist.images[0].url.includes("blend")) {
        // skip if blend (maybe?)
        continue;
      } else {
        var name = curr_playlist.name;
        if (name.includes("'")) {
          name = name.replace(/'/g, "''");
        }
        const playlist_id = curr_playlist.id;
        const public = curr_playlist.public;
        const snapshot_id = curr_playlist.snapshot_id;

        // now build query
        const query = `INSERT INTO playlists (name, owner, playlist_id, snapshot_id, public) VALUES ('${name}', '${uid}', '${playlist_id}', '${snapshot_id}', ${public}) RETURNING *;`;
        db.one(query)
          .then((data) => {
            // playlist has been inserted. now to add songs from this specific playlist
            // console.log("adding songs from:", playlist_id);
            addSongsFromPlaylist(playlist_id, accessToken, uid);
            return;
          })
          .catch((err) => {
            console.log(err.message);
            return;
          });
      }
    }
  } else {
    // more than 50 returned playlists. must access .next after 50th with new api call
    // console.log('num_playlists > 50')
    const num_next_calls = Math.ceil(num_playlists / 50); // at least 1
    var curr_response = response;

    // console.log("num_next_calls: ", num_next_calls);
    // console.log("current response:", curr_response);
    // var curr_num_playlists = num_playlists;

    for (var i = 0; i < num_next_calls; i++) {
      if (i == 0) {
        // first set of 50. do not need a 'next' call as they are in response already
        for (var j = 0; j < 50; j++) {
          const curr_playlist = response.items[j];
          if (curr_playlist == null || curr_playlist == undefined) {
            continue;
          }

          if (curr_playlist.tracks.total == 0) {
            // skip if no songs
            continue;
          }

          if (curr_playlist.images[0].url.includes("blend")) {
            // skip if blend (maybe?)
            continue;
          } else {
            var name = curr_playlist.name;
            if (name.includes("'")) {
              name = name.replace(/'/g, "''");
            }
            // console.log("adding:", name, "#:", j);
            const playlist_id = curr_playlist.id;
            const public = curr_playlist.public;
            const snapshot_id = curr_playlist.snapshot_id;

            // now build query
            const query = `INSERT INTO playlists (name, owner, playlist_id, snapshot_id, public) VALUES ('${name}', '${uid}', '${playlist_id}', '${snapshot_id}', ${public}) RETURNING *;`;
            db.one(query)
              .then((data) => {
                // playlist has been inserted. now to add songs from this specific playlist
                addSongsFromPlaylist(playlist_id, accessToken);
                return;
              })
              .catch((err) => {
                console.log(err.message);
                return;
              });
          }
        }
      } else {
        // start by doing api call to next to get remaining playlists
        // console.log('GOT TO ELSE after adding first 50 playlists');
        const options = {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        };

        if (curr_response.next == null) {
          continue;
        }

        curr_response = await axios.get(curr_response.next, options);
        // console.log("current_response now:", curr_response.data);

        var curr_num_playlists = num_playlists % 50;
        // console.log("curr_num_playlists:", curr_num_playlists);

        for (var j = 0; j < curr_num_playlists; j++) {
          //   console.log(curr_response.data.items);
          const curr_playlist = curr_response.data.items[j];
          if (curr_playlist == null || curr_playlist == undefined) {
            continue;
          }

          if (curr_playlist.tracks.total == 0) {
            // skip if no songs
            continue;
          }

          if (curr_playlist.images[0].url.includes("blend")) {
            // skip if blend (maybe?)
            continue;
          } else {
            var name = curr_playlist.name;
            if (name.includes("'")) {
              name = name.replace(/'/g, "''");
            }
            // console.log("adding from next:", name, "#:", j+50);
            const playlist_id = curr_playlist.id;
            const public = curr_playlist.public;
            const snapshot_id = curr_playlist.snapshot_id;

            // now build query
            const query = `INSERT INTO playlists (name, owner, playlist_id, snapshot_id, public) VALUES ('${name}', '${uid}', '${playlist_id}', '${snapshot_id}', ${public}) RETURNING *;`;
            db.one(query)
              .then((data) => {
                // playlist has been inserted. now to add songs from this specific playlist
                addSongsFromPlaylist(playlist_id, accessToken);
                return;
              })
              .catch((err) => {
                console.log(err.message);
                return;
              });
          }
        }
      }
      // console.log('NUMPLAYLISTS BEOFRE MINUS', num_playlists);
      num_playlists -= 50;
      // console.log('NUMPLAYLISTS AFTER MINUS', num_playlists);
    }
  }
}


async function addSongsFromPlaylist(playlistId, accessToken, uid) {
  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      options
    );
    var num_songs = response.data.total;
    // console.log(response.data);

    if (num_songs <= 100) {
      // there are 100 or less songs, so we do not need any 'next' calls
      // console.log("num_songs <= 100 for", playlistId);
      for (var i = 0; i < num_songs; i++) {
        const curr_song = response.data.items[i].track;
        if (curr_song == null) {
          continue;
        }
        var name = curr_song.name;
        if (name.includes("'")) {
          name = name.replace(/'/g, "''");
        }

        const duration = parseInt(curr_song.duration_ms, 10);
        var first_artist = curr_song.artists[0].name;
        if (first_artist.includes("'")) {
          first_artist = first_artist.replace(/'/g, "''");
        }

        const song_id = curr_song.id;
        var album_name = curr_song.album.name;
        if (album_name.includes("'")) {
          album_name = album_name.replace(/'/g, "''");
        }

        const album_release = curr_song.album.release_date;
        const added_at = response.data.items[i].added_at;
        const popularity = parseInt(curr_song.popularity, 10);
        const uri = curr_song.uri;

        const query = `INSERT INTO playlist_songs 
				         (name, owner, uri, duration, artist, song_id, album_name, album_release, added_at, popularity, playlist_id) 
					   VALUES
						 ('${name}', '${uid}', '${uri}', ${duration}, '${first_artist}', '${song_id}', '${album_name}', '${album_release}', '${added_at}', ${popularity}, '${playlistId}')
					   RETURNING *;`;
        db.one(query)
          .then((data) => {
            // console.log("Added:", data);
            return data;
          })
          .catch((err) => {
            console.log(err.message);
            return err;
          });
      }
    } else {
      // more than 100 songs in the playlist. you will need to access the 'next' of the response
      // console.log("num_songs > 100 for", playlistId);

      const num_next_calls_songs = Math.ceil(num_songs / 100); // at least 1
      var curr_response = response;
      // console.log(curr_response.data);

      // console.log("num_next_calls_songs:", num_next_calls_songs);
      var curr_num_songs = num_songs;
      // console.log("curr_num_songs:", curr_num_songs);

      for (var i = 0; i < num_next_calls_songs; i++) {
        if (i == 0) {
          // first iteration - do not need a next call, just add the first 100
          // console.log("i==0 next call for songs");
          for (var j = 0; j < 100; j++) {
            const curr_song = curr_response.data.items[j].track;
            if (curr_song == null) {
              continue;
            }
            var name = curr_song.name;
            if (name.includes("'")) {
              name = name.replace(/'/g, "''");
            }

            const duration = parseInt(curr_song.duration_ms, 10);
            var first_artist = curr_song.artists[0].name;
            if (first_artist.includes("'")) {
              first_artist = first_artist.replace(/'/g, "''");
            }

            const song_id = curr_song.id;
            var album_name = curr_song.album.name;
            if (album_name.includes("'")) {
              album_name = album_name.replace(/'/g, "''");
            }

            const album_release = curr_song.album.release_date;
            const added_at = curr_response.data.items[i].added_at;
            const popularity = parseInt(curr_song.popularity, 10);
            const uri = curr_song.uri;

            const query = `INSERT INTO playlist_songs 
                     (name, owner, uri, duration, artist, song_id, album_name, album_release, added_at, popularity, playlist_id) 
                 VALUES
                 ('${name}', '${uid}', '${uri}', ${duration}, '${first_artist}', '${song_id}', '${album_name}', '${album_release}', '${added_at}', ${popularity}, '${playlistId}')
                 RETURNING *;`;
            db.one(query)
              .then((data) => {
                return data;
              })
              .catch((err) => {
                console.log(err.message);
                return err;
              });
          }
        } else {
          // any future iterations - must do a next call for any songs over 100
          // console.log('GOT TO ELSE after adding first 100 songs');

          //   console.log("current_response:", curr_response.data);
          curr_response = await axios.get(curr_response.data.next, options);

          var curr_num_songs = num_songs % 100;
          // console.log("curr_num_songs in next:", curr_num_songs);

          for (var j = 0; j < curr_num_songs; j++) {
            const curr_song = curr_response.data.items[j].track;
            // console.log("curr_song:", curr_song);
            if (curr_song == null) {
              continue;
            }
            var name = curr_song.name;
            if (name.includes("'")) {
              name = name.replace(/'/g, "''");
            }

            const duration = parseInt(curr_song.duration_ms, 10);
            var first_artist = curr_song.artists[0].name;
            if (first_artist.includes("'")) {
              first_artist = first_artist.replace(/'/g, "''");
            }

            const song_id = curr_song.id;
            var album_name = curr_song.album.name;
            if (album_name.includes("'")) {
              album_name = album_name.replace(/'/g, "''");
            }

            const album_release = curr_song.album.release_date;
            const added_at = curr_response.data.items[i].added_at;
            const popularity = parseInt(curr_song.popularity, 10);
            const uri = curr_song.uri;

            const query = `INSERT INTO playlist_songs 
                     (name, owner, uri, duration, artist, song_id, album_name, album_release, added_at, popularity, playlist_id) 
                 VALUES
                 ('${name}', '${uid}', '${uri}', ${duration}, '${first_artist}', '${song_id}', '${album_name}', '${album_release}', '${added_at}', ${popularity}, '${playlistId}')
                 RETURNING *;`;
            db.one(query)
              .then((data) => {
                // 	console.log("Added in after i==0:", data);
                return data;
              })
              .catch((err) => {
                console.log(err.message);
                return err;
              });
          }
        }
        // console.log('NUMSONGS BEOFRE MINUS', num_songs);
        num_songs -= 100;
        // console.log('NUMSONGS AFTER MINUS', num_songs);
      }
    }
  } catch (error) {
    console.error(error);
    return error;
  }
}


function getSongs(playlistId) {
  const songs_query = `SELECT * FROM playlist_songs WHERE playlist_id = $1;`;
  return db
    .any(songs_query, [playlistId])
    .then((data) => {
      return data;
    }) // Return the data
    .catch((err) => {
      console.error(err);
      throw err; // Rethrow to handle in the caller
    });
}

function chosenSongs(selectedSongs) {

  const selectedSongsQuery = `SELECT name, artist, album_release, song_id, uri FROM playlist_songs WHERE song_id = ANY($1::varchar[]);`;

  if (selectedSongs.length === 0) {
    return Promise.resolve([]);
  }
  return db.any(selectedSongsQuery, [selectedSongs])
    .then(data => {
      console.log("Chosen Songs Query Result:", data);
      return data;
    })
    .catch(err => {
      console.error('Error in chosenSongs:', err); // Log errors
      throw err;
    });
}

function clearDraftPlaylist(req) {
  req.session.draftPlaylist = [];
  return Promise.resolve([]);
}

async function deleteSongs(snapshot_id, uris, playlist_id, access_token) {

  try {
    const response = await axios.delete(
      `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`,  // Spotify API endpoint
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,  // Authorization header with Bearer token
          'Content-Type': 'application/json'    // Set content type to JSON
        },
        data: {
          snapshot_id: snapshot_id.snapshot_id,  // Include the snapshot ID to ensure consistency
          tracks: uris         // Array of track objects to be removed
        }
      }
    );

    console.log('Tracks removed:', response.data);
  }
  catch (error) {
    console.error('Error removing tracks:', error);
  }
}

Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});
function deletePlaylist(playlistID) {
  const deleteSongsQuery = 'DELETE FROM playlist_songs WHERE playlist_id = $1;';
  const changePlaylistTitle = 'UPDATE playlists SET name = $1 WHERE playlist_id = $2;';
  const deletedName = 'deleted';

  db.batch([
    db.none(deleteSongsQuery, [playlistID]),
    db.none(changePlaylistTitle, [deletedName, playlistID])
  ])
    .then(() => {
      console.log('Songs deleted and playlist name updated successfully.');
    })
    .catch((err) => {
      console.error('Error processing deletePlaylist:', err);
    });
}

async function createPlaylist(req) {
  console.log("IM RUNNING MAKE PLAYLIST WHEN THE EXPORT BUTTON IS CLICKED YUH!");
  const playlist_name = req.session.newPlaylistName;
  const draft_playlist = req.session.draftPlaylist;

  const access_token = req.session.access_token;

  const user_id = req.session.uid;
  console.log("THIS THE USER ID: ", user_id);

  const headers = {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'

  };

  const data = {
    'name': playlist_name,
    'public': false,
    'collaborative': false,
    'description': ''
  };

  const track_uris = [];

  for (let i = 0; i < draft_playlist.length; i++) {
    let uri = draft_playlist[i].uri;
    track_uris.push(uri);
  }

  try {
    const playlist_response = await axios.post(`https://api.spotify.com/v1/users/${user_id}/playlists`, data, { headers });
    // console.log(playlist_response);

    var playlist_id = playlist_response.data.id;
    var snapshot_id = playlist_response.data.snapshot_id;
    var public = playlist_response.data.public;

    try {
      const body = {
        'uris': track_uris,
        'position': 0
      };

      const tracks_response = axios.post(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, body, { headers });
      // console.log(tracks_response);

    } catch (error) {
      console.log(error);
    }

  } catch (error) {
    console.log(error);
  }

  const playlist_query = `INSERT INTO playlists (name, owner, playlist_id, snapshot_id, public) VALUES ('${playlist_name}', '${user_id}', '${playlist_id}', '${snapshot_id}', ${public}) RETURNING *;`;

  db.one(playlist_query)
    .then((data) => {
      // playlist has been inserted. now to add songs from this specific playlist
      addSongsFromPlaylist(playlist_id, access_token, user_id);
      return;
    })
    .catch((err) => {
      console.log(err.message);
      return;
    });

}

// TODO finish function
async function setPlayerTrack(req) {
	const device_id = req.device_id;
	const access_token = req.session.access_token;

	const track_uri = getTrackURI(req.body.track_id);
	console.log('TRACK URI: ', track_uri);

	const offset = 0;

	const options = {
		headers: {
			'Authorization': `Bearer ${access_token}`,
			'Content-Type': 'application/json',
			'device_id': device_id
		}
	};

	const body = {
		'uris': track_uri,
		'position_ms': 0
	}

	try {
		await axios.put(`https://api.spotify.com/v1/me/player/play`, body, options);
		return;
	} catch (error) {
		console.log(error);
		return;
	}
};

async function getTrackURI(track_id) {
	const access_token = req.session.access_token;

	const config = {
		headers: {
		  'Authorization': `Bearer ${access_token}`,
		  'Content-Type': 'application/json'
		}
	  };

	try {
		const response = await axios.get(`https://api.spotify.com/v1/tracks/${track_id}`, config);
		const uri = response.tracks[0].uri;
		return [uri];
	} catch (error) {
		console.error(error);
	}
};

// *****************************************************
// <!-- Section 6 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log("Server is listening on port 3000");
