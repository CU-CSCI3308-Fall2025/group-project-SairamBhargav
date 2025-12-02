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
const axios = require("axios"); // To make HTTP requests from our server. We'll learn more about it in Part C.

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
  host: "db", // the database server
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

// Authentication Middleware
const auth = (req, res, next) => {
  if (!req.session.username) {
    return res.redirect("/login");
  }
  next();
};

app.use(express.static(path.join(__dirname, "public")));

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// TODO - Include your API routes here
//this is so to direct the user to the login page or discovery page depending on whether they are logged in
app.get("/welcome", (req, res) => {
  res.json({ status: "success", message: "Welcome!" });
});

app.get("/", (req, res) => {
  if (req.session.user) {
    res.redirect("/discover");
  } else {
    res.redirect("/login");
  }
});
//register page
app.get("/register", (req, res) => {
  res.render("pages/register", { title: "Register" });
});
app.post("/register", async (req, res) => {
  const { username, password, firstName, lastName, email, dateOfBirth } =
    req.body;

  try {
    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Minimum password length, must be 8 characters mimimum
    if (password.length < 8) {
      return res.render("pages/register", {
        message: "Registration failed. Password must be at least 8 characters.",
        error: true,
      });
    }

    // insert user into database
    await db.none(
      `INSERT INTO users (username, password, firstName, lastName, email, dateOfBirth)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [username, hashedPassword, firstName, lastName, email, dateOfBirth]
    );

    res.render("pages/register", {
      message: "User registered successfully!",
      success: true,
    });
  } catch (err) {
    console.error(err);
    res.render("pages/register", {
      message: "Registration failed. Username or email may already exist.",
      error: true,
    });
  }
});

//login
app.get("/login", (req, res) => {
  res.render("pages/login");
});

// Handle login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db.oneOrNone("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (!user) {
      return res.render("pages/login", {
        message: "User not found",
        error: true,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.render("pages/login", {
        message: "Incorrect password",
        error: true,
      });
    }

    req.session.username = user.username;

    res.redirect("/discover");
  } catch (err) {
    console.error(err);
    res.render("pages/login", { message: "An error occurred", error: true });
  }
});

// Discover page - shows movies from TMDB
app.get("/discover", auth, async (req, res) => {
  try {
    // Fetch popular movies from TMDB
    const response = await axios.get(
      `https://api.themoviedb.org/3/discover/movie`,
      {
        params: {
          api_key: process.env.TMDB_API_KEY,
          sort_by: "popularity.desc",
          language: "en-US",
          page: 1,
          include_adult: false,
        },
      }
    );

    const movies = response.data.results.map((movie) => ({
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      posterPath: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      releaseDate: movie.release_date,
      rating: movie.vote_average,
    }));

    res.render("pages/discover", {
      movies: movies,
      username: req.session.username,
    });
  } catch (err) {
    console.error("Error fetching movies:", err.message);
    res.render("pages/discover", {
      movies: [],
      error: "Failed to load movies",
    });
  }
});
// Authentication Required
app.use(auth);

// --- PROFILE ROUTE ---
app.get("/profile", async (req, res) => {
  const username = req.session.username; // or however you store the logged-in user

  if (!username) {
    // Not logged in
    return res.redirect("/login");
  }

  try {
    // --- Get total liked movies ---
    const totalLiked = await db.query(
      "SELECT COUNT(*) FROM liked_movies WHERE username = $1",
      [username]
    );

    // --- Get most liked genre ---
    const topGenre = await db.query(
      `
      SELECT genre FROM liked_movies
      WHERE username = $1
      GROUP BY genre
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `,
      [username]
    );

    // --- Get most liked actor ---
    const topActor = await db.query(
      `
      SELECT actor FROM liked_movies
      WHERE username = $1
      GROUP BY actor
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `,
      [username]
    );

    // --- Get most liked actress ---
    const topActress = await db.query(
      `
      SELECT actress FROM liked_movies
      WHERE username = $1
      GROUP BY actress
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `,
      [username]
    );

    // --- Render the profile page ---
    res.render("pages/profile", {
      user: { username },
      stats: {
        totalLiked: totalLiked.rows[0]?.count || 0,
        topGenre: topGenre.rows[0]?.genre || "N/A",
        topActor: topActor.rows[0]?.actor || "N/A",
        topActress: topActress.rows[0]?.actress || "N/A",
      },
    });
  } catch (err) {
    console.error(err);
    res.render("pages/profile", {
      user: { username },
      stats: {
        totalLiked: 0,
        topGenre: "N/A",
        topActor: "N/A",
        topActress: "N/A",
      },
      message: "Error loading profile data",
      error: true,
    });
  }
});

// Swipe feature route
app.get("/swipe", async (req, res) => {
  try {
    // Fetch a random movie from TMDB
    const randomPage = Math.floor(Math.random() * 500) + 1;

    const response = await fetch(
      `https://api.themoviedb.org/3/movie/popular?api_key=98d9665b319075a5eaf64410976293ab&page=${randomPage}`
    );

    const data = await response.json();

    // Pick a random movie from the results
    const randomIndex = Math.floor(Math.random() * data.results.length);
    const movieData = data.results[randomIndex];

    // Format the movie data
    const movie = {
      id: movieData.id,
      title: movieData.title,
      overview: movieData.overview || "No overview available.",
      posterPath: movieData.poster_path
        ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}`
        : null,
      rating: movieData.vote_average
        ? movieData.vote_average.toFixed(1)
        : "N/A",
      releaseDate: movieData.release_date || "Unknown",
    };

    // Render the swipe template with the movie data
    res.render("pages/swipe", {
      username: req.session.username || req.user?.username,
      movie: movie,
    });
  } catch (error) {
    console.error("Error fetching random movie:", error);
    res.render("pages/swipe", {
      username: req.session.username || req.user?.username,
      error: "Failed to load movie. Please try again.",
      movie: null,
    });
  }
});

app.post("/movies/like/:id", auth, async (req, res) => {
  const username = req.session.username;
  const movieId = parseInt(req.params.id, 10); // make sure it's an integer

  try {
    await db.none(
      `
      INSERT INTO swipes (username, movie_id, action)
      VALUES ($1, $2, 'like')
      ON CONFLICT (username, movie_id)
      DO UPDATE SET action = EXCLUDED.action
      `,
      [username, movieId]
    );

    res.redirect("/swipe");
  } catch (err) {
    console.error("Error saving like swipe:", err.message, err);
    res.status(500).send("Failed to save swipe");
  }
});

app.post("/movies/dislike/:id", auth, async (req, res) => {
  const username = req.session.username;
  const movieId = parseInt(req.params.id, 10);

  try {
    await db.none(
      `
      INSERT INTO swipes (username, movie_id, action)
      VALUES ($1, $2, 'dislike')
      ON CONFLICT (username, movie_id)
      DO UPDATE SET action = EXCLUDED.action
      `,
      [username, movieId]
    );

    res.redirect("/swipe");
  } catch (err) {
    console.error("Error saving dislike swipe:", err.message, err);
    res.status(500).send("Failed to save swipe");
  }
});

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// movie recommendation:
app.post("/api/recommendations/generate", auth, async (req, res) => {
  const username = req.session.username;

  try {
    // 1. get liked movies
    const liked = await db.any(
      `
      SELECT movie_id FROM swipes 
      WHERE username = $1 AND action = 'like'
      `,
      [username]
    );

    console.log("[Reco] user =", username, "liked count =", liked.length);

    if (liked.length < 5) {
      return res.status(400).json({
        error: "Not enough liked movies to generate recommendations",
      });
    }

    // 2. build JSON for Gemini from TMDB details
    const likedMoviesDetailed = await Promise.all(
      liked.map(async (m) => {
        const response = await axios.get(
          `https://api.themoviedb.org/3/movie/${m.movie_id}`,
          { params: { api_key: process.env.TMDB_API_KEY } }
        );
        const data = response.data;

        return {
          id: data.id,
          title: data.title,
          overview: data.overview,
          genres: (data.genres || []).map((g) => g.name),
          rating: data.vote_average,
          popularity: data.popularity,
        };
      })
    );

    const prompt = `
      You are a movie recommendation engine.
      Analyze this list of movies the user liked:
      ${JSON.stringify(likedMoviesDetailed)}

      Recommend 10 movies the user would enjoy.
      Only return JSON in this exact format, with nothing else:

      {
        "recommended": [123, 456, 789]
      }
    `;

    // 3. call Gemini
    const geminiResponse = await model.generateContent(prompt);

    let text;
    try {
      text = geminiResponse.response.text();
      console.log("[Reco] raw Gemini text =", text);
    } catch (e) {
      console.error("[Reco] error getting response.text()", e);
      return res
        .status(500)
        .json({ error: "Bad response from recommendation model." });
    }

    // 4. Extract JSON from the text

    // Default: assume the whole text is JSON
    let jsonStr = text.trim();

    // Case 1: wrapped in ```json ... ``` or ``` ... ```
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      // Case 2: find first {...} block
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        jsonStr = braceMatch[0].trim();
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[Reco] JSON.parse failed", parseErr, "jsonStr =", jsonStr);
      return res.status(500).json({
        error:
          "Failed to parse recommendation model output. Please try again later.",
      });
    }

    const recommendedIds = parsed.recommended;

    if (!Array.isArray(recommendedIds) || recommendedIds.length === 0) {
      console.error("[Reco] recommendedIds invalid:", recommendedIds);
      return res.status(500).json({
        error: "Recommendation model did not return any movie IDs.",
      });
    }

    console.log("[Reco] recommendedIds =", recommendedIds);

    // 5. Fetch TMDB details for recommended movies
    const recommendedMovies = await Promise.all(
      recommendedIds.map(async (id) => {
        const details = await axios.get(
          `https://api.themoviedb.org/3/movie/${id}`,
          { params: { api_key: process.env.TMDB_API_KEY } }
        );
        return details.data;
      })
    );

    // 6. Success
    res.json({
      status: "success",
      recommendations: recommendedMovies,
    });
  } catch (err) {
    console.error("Error generating recommendations:", err);
    res.status(500).json({ error: "Failed to generate recommendations." });
  }
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log("Server is listening on port 3000");
