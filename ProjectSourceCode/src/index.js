const express = require("express");
const app = express();
const handlebars = require("express-handlebars");
const Handlebars = require("handlebars");
const path = require("path");
const pgp = require("pg-promise")();
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const axios = require("axios");

// ---------- HANDLEBARS HELPER ----------
Handlebars.registerHelper("eq", (a, b) => a === b);

// ---------- DB CONFIG ----------
const db = pgp(
  process.env.DATABASE_URL || {
    host: process.env.POSTGRES_HOST || "db",
    port: 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  }
);

db.connect()
  .then((obj) => {
    console.log("Database connection successful");
    obj.done();
  })
  .catch((error) => console.log("ERROR:", error.message || error));

// ---------- VIEW ENGINE ----------
const hbs = handlebars.create({
  extname: "hbs",
  layoutsDir: __dirname + "/views/layouts",
  partialsDir: __dirname + "/views/partials",
});

app.engine("hbs", hbs.engine);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// ---------- MIDDLEWARE ----------
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(express.static(path.join(__dirname, "public")));

// Protect routes middleware
const auth = (req, res, next) => {
  if (!req.session.username) return res.redirect("/login");
  next();
};

// ---------- ROUTES ----------

// Landing redirect
app.get("/", (req, res) =>
  req.session.username ? res.redirect("/discover") : res.redirect("/login")
);

// ---------- REGISTER ----------
app.get("/register", (req, res) => {
  res.render("pages/register");
});

app.post("/register", async (req, res) => {
  const {
    username,
    password,
    firstName,
    lastName,
    email,
    dateOfBirth,
    favorite_genre,
    favorite_actor,
    favorite_actress,
  } = req.body;

  try {
    if (password.length < 8) {
      return res.render("pages/register", {
        message: "Password must be at least 8 characters.",
        error: true,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.none(
      `INSERT INTO users
        (username, password, firstName, lastName, email, dateOfBirth, favorite_genre, favorite_actor, favorite_actress)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        username,
        hashedPassword,
        firstName,
        lastName,
        email,
        dateOfBirth,
        favorite_genre || null,
        favorite_actor || null,
        favorite_actress || null,
      ]
    );

    return res.redirect("/login");
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.render("pages/register", {
      message: "Registration failed. Username or email may already exist.",
      error: true,
    });
  }
});

// ---------- LOGIN ----------
app.get("/login", (req, res) => res.render("pages/login"));

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db.oneOrNone("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    if (!user)
      return res.render("pages/login", { message: "User not found", error: true });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.render("pages/login", {
        message: "Incorrect password",
        error: true,
      });

    req.session.username = user.username;
    res.redirect("/discover");
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.render("pages/login", { message: "An error occurred", error: true });
  }
});

// ---------- DISCOVER ----------
app.get("/discover", auth, async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.themoviedb.org/3/discover/movie",
      {
        params: {
          api_key: process.env.TMDB_API_KEY,
          sort_by: "popularity.desc",
          language: "en-US",
          include_adult: false,
        },
      }
    );

    res.render("pages/discover", {
      movies: response.data.results,
      username: req.session.username,
    });
  } catch (err) {
    console.error("DISCOVER ERROR:", err.message);
    res.render("pages/discover", { movies: [], error: "Failed to load movies" });
  }
});

// ---------- PROFILE ----------
app.get("/profile", auth, async (req, res) => {
  const username = req.session.username;

  try {
    const user = await db.one(
      `SELECT username, favorite_genre, favorite_actor, favorite_actress
       FROM users WHERE username = $1`,
      [username]
    );

    const { count } = await db.one(
      `SELECT COUNT(*) AS count FROM swipes WHERE username = $1 AND action = 'like'`,
      [username]
    );

    res.render("pages/profile", {
      user,
      stats: { totalLiked: Number(count) },
    });
  } catch (err) {
    console.error("PROFILE ERROR:", err);
    res.render("pages/profile", {
      user: { username },
      stats: { totalLiked: 0 },
      message: "Error loading profile",
      error: true,
    });
  }
});

// ---------- EDIT FAVORITES ----------
app.post("/profile/favorites", auth, async (req, res) => {
  const username = req.session.username;
  const { favorite_genre, favorite_actor, favorite_actress } = req.body;

  try {
    await db.none(
      `UPDATE users
       SET favorite_genre = $1,
           favorite_actor = $2,
           favorite_actress = $3
       WHERE username = $4`,
      [favorite_genre, favorite_actor, favorite_actress, username]
    );
    res.redirect("/profile");
  } catch (err) {
    console.error("UPDATE FAVORITES ERROR:", err);
    res.redirect("/profile");
  }
});

// ---------- LOGOUT ----------
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
