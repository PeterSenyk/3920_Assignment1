require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Session
app.use(session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: true
}));

// MySQL Connection (Still vulnerable to SQL Injection)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) throw err;
    console.log("Connected to MySQL (Unsafe Version)");
});

// Home Page
app.get("/", (req, res) => {
    res.send(`
        <h1>Home</h1>
        <a href="/signup">Sign Up</a> | <a href="/login">Log In</a>
    `);
});

// Signup Page (GET)
app.get("/signup", (req, res) => {
    res.send(`
        <h1>Sign Up</h1>
        <form action="/signup" method="POST">
            <input type="text" name="username" required placeholder="Username"><br>
            <input type="password" name="password" required placeholder="Password"><br>
            <button type="submit">Sign Up</button>
        </form>
        <a href="/">Home</a>
    `);
});

// Unsafe Signup (SQL Injection Works, but Hashing is Enabled)
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `INSERT INTO users (username, password) VALUES ('${username}', '${hashedPassword}')`;

    db.query(query, (err) => {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                return res.send("Error: Username already exists. Choose another.");
            }
            throw err;
        }
        req.session.username = username;
        res.redirect("/members");
    });
});

// Login Page (GET)
app.get("/login", (req, res) => {
    res.send(`
        <h1>Log In</h1>
        <form action="/login" method="POST">
            <input type="text" name="username" required placeholder="Username"><br>
            <input type="password" name="password" required placeholder="Password"><br>
            <button type="submit">Log In</button>
        </form>
        <a href="/">Home</a>
    `);
});

// Unsafe Login (SQL Injection Works)
app.post("/login", (req, res) => {
    let { username, password } = req.body;

    // Prevent empty username errors
    if (!username || username.trim() === "") {
        return res.send("Error: Username cannot be empty.");
    }

    // SQL Injection Allowed (No Prepared Statements)
    console.log("Raw User Input:", username);
    const query = `SELECT * FROM users WHERE username = '${username}'`;
    console.log("Executing SQL Query:", query);

    db.query(query, async (err, results) => {
        if (err) {
            console.error("SQL Error:", err);
            return res.send(`SQL Error: ${err.sqlMessage}`);
        }
        console.log("Query Results:", results);
        if (results.length > 0) {
            const match = await bcrypt.compare(password, results[0].password);
            if (match) {
                req.session.username = username;
                res.send(`Logged in as ${username} <a href="/members">Go to Members Area</a>`);
            } else {
                res.send("Invalid credentials");
            }
        } else {
            res.send("Invalid credentials");
        }
    });
});

// Members Page
app.get("/members", (req, res) => {
    if (!req.session.username) return res.redirect("/");

    const images = ["public/image1.jpeg", "public/image1.jpeg", "public/image1.jpeg"];
    const randomImage = images[Math.floor(Math.random() * images.length)];

    res.send(`<h1>Welcome, ${req.session.username}</h1>
    <img src="/${randomImage}" style="width: 300px; height: 300px;"><br>
    <a href="/logout">Logout</a>`);
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// 404 Page (MUST BE LAST)
app.use((req, res) => {
    res.status(404).send("<h1>404 - Page Not Found</h1>");
});


// Start Server
app.listen(3000, () => console.log("Server running on http://localhost:3000"));
