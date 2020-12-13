const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const middleware = require("./middleware");

const port = process.env.SERVER_PORT || 3000;

const con = mysql.createConnection({
  host: process.env.MYSQL_DB_HOST,
  user: process.env.MYSQL_DB_USER,
  password: process.env.MYSQL_DB_PASS,
  database: process.env.MYSQL_DB_NAME,
  port: process.env.MYSQL_DB_PORT,
});

con.connect((err) => {
  if (err) throw err;
  console.log("Successfully connected to DB");
});

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("The Back-End is working");
});

app.post("/register", middleware.validateUserData, (req, res) => {
  const username = req.body.username.toLowerCase();
  con.query(
    `SELECT * FROM users WHERE username = ${mysql.escape(username)}`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res
          .status(400)
          .json({ msg: "Internal server error checking username validity" });
      } else if (result.length !== 0) {
        return res.status(400).json({ msg: "This username already exists" });
      } else {
        bcrypt.hash(req.body.password, 10, (err, hash) => {
          if (err) {
            console.log(err);
            return res.status(400).json({
              msg: "Internal server error hashing user details",
            });
          } else {
            con.query(
              `INSERT INTO users (username, password) VALUES (${mysql.escape(
                username
              )}, ${mysql.escape(hash)})`,
              (err, result) => {
                if (err) {
                  console.log(err);
                  return res.status(400).json({
                    msg: "Internal server error saving user details",
                  });
                } else {
                  return res.status(201).json({
                    msg: "User has been successfully registered",
                  });
                }
              }
            );
          }
        });
      }
    }
  );
});

app.post("/login", middleware.validateUserData, (req, res) => {
  const username = req.body.username.toLowerCase();
  con.query(
    `SELECT * FROM users WHERE username = ${mysql.escape(username)}`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res
          .status(400)
          .json({ msg: "Internal server error gathering user details" });
      } else if (result.length !== 1) {
        return res.status(400).json({
          msg: "The provided details are incorrect or the user does not exist",
        });
      } else {
        bcrypt.compare(
          req.body.password,
          result[0].password,
          (bErr, bResult) => {
            if (bErr || !bResult) {
              return res.status(400).json({
                msg:
                  "The provided details are incorrect or the user does not exist",
              });
            } else if (bResult) {
              const token = jwt.sign(
                {
                  userId: result[0].id,
                  username: result[0].username,
                },
                process.env.SECRET_KEY,
                {
                  expiresIn: "7d",
                }
              );

              return res.status(200).json({
                msg: "Logged In",
                token,
                userData: {
                  userId: result[0].id,
                  username: result[0].username,
                },
              });
            }
          }
        );
      }
    }
  );
});

app.post("/beers", middleware.isLoggedIn, (req, res) => {
  con.query(
    `INSERT INTO beers (user_id, title, style, alcohol, IBU) VALUES ('${
      req.userData.userId
    }', ${mysql.escape(req.body.title)}, ${mysql.escape(
      req.body.style
    )}, ${mysql.escape(req.body.alcohol)}, ${mysql.escape(req.body.IBU)})`,
    (err, result) => {
      if (err) {
        res.status(400).json(err);
      } else {
        res
          .status(201)
          .json({ msg: "Successfully added the beer to the database!" });
      }
    }
  );
});

app.get("/beers", middleware.isLoggedIn, (req, res) => {
  con.query(
    `SELECT id, title , style, alcohol, IBU FROM beers WHERE user_id = ${req.userData.userId}`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res
          .status(400)
          .json({ msg: "Internal server error gathering beers details" });
      } else {
        return res.status(200).json(result);
      }
    }
  );
});

app.listen(port, () => console.log(`Server is running on port ${port}`));
