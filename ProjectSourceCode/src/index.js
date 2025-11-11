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

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log("Server is listening on port 3000");
