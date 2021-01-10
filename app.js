//EXPRESS
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// FOLDER ZA CSS, JS I DRUGE FAJLOVE
app.use(express.static("public"));

// NEO4J
var neo4j=require('neo4j-driver');
var driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'Ss1998!!!')
  )
var session = driver.session();

//FLASH PORUKE
app.use(require('express-session')({ secret: "Passport do pobede", resave: false, saveUninitialized: false }));
var flash = require('connect-flash'); // za prikaz flash poruka niste ulogovani itd(kad se uradi i logovanje)
app.use(flash());
//  FLASH poruke vidljive svim metodama
app.use((req, res, next) => {
  res.locals.message = req.flash("success");
  res.locals.error = req.flash("error");
  next();

});

// ZA DELETE I PUT METODE
var methodOverride = require('method-override'); // za delete i put http metode
app.use(methodOverride("_method"));

var validator = require('validator');
var bcrypt = require('bcryptjs');

// PASSPORT LOGIN

// PASSPORT VERZIJA
var passport = require('passport');
var localStrategy = require('passport-local');
app.use(passport.initialize());
app.use(passport.session());
// PASSPORT SERIJALIZACIJA I DESERIJALIZACIJA USERA
passport.serializeUser(function (user, done) {
  return done(null, user);
});
passport.deserializeUser(function (user, done) {
  if (user != null)
    return done(null, user);
});
passport.use('autoprevozniklocal', new localStrategy({ usernameField: 'email' }, async function (username, password, done) {
  const rs = await client.execute("SELECT * FROM rbus.\"Autoprevoznik\" WHERE email=\'" + username + "\'");
  for (var i = 0; i < rs.rows.length; i++) {
    if (rs.rows[i].email != username) {
      return done(null, false, { message: 'Incorrect username.' });
    }
    const t = await bcrypt.compare(password, rs.rows[i].password);
    if (!t) return done(null, false, { message: 'Incorrect password' });
    return done(null, rs.rows[i]);
  }
  return done(null, false, { message: 'Incorrect username.' });
}));
passport.use('korisniklocal', new localStrategy({ usernameField: 'email' }, async function (username, password, done) {
  const rs = await client.execute("SELECT * FROM rbus.\"Korisnik\" WHERE email=\'" + username + "\'");
  for (var i = 0; i < rs.rows.length; i++) {
    if (rs.rows[i].email != username) {
      return done(null, false, { message: 'Incorrect username.' });
    }
    const t = await bcrypt.compare(password, rs.rows[i].password);
    if (!t) return done(null, false, { message: 'Incorrect password' });
    return done(null, rs.rows[i]);
  }
  return done(null, false, { message: 'Incorrect username.' });
}));
/*
//LOGIN

app.get("/login", function (req, res) {
  if (req.user != undefined) {
    req.flash("error", "Vec ste ulogovani");
    res.redirect("/");
  }
  else res.render('login.ejs', { user: req.user });
});
app.post('/login', passport.authenticate(["autoprevozniklocal", "korisniklocal"], { successRedirect: "/", failureRedirect: "/login" }), (req, res) => { });

app.get('/logout', (req, res) => { req.logout(); req.flash("success", "Uspesna odjava"); res.redirect('/') });

app.get("/register", (req, res) => {
  if (req.user != undefined) {
    req.flash("error", "Vec ste ulogovani");
    res.redirect("/");
  }
  res.render("registration.ejs", { user: req.user });
});

app.post("/register", async function (req, res) {
  if (req.user != undefined) {
    req.flash("error", "Vec ste ulogovani");
    res.redirect("/");
  }
  var postojiemail = await client.execute("SELECT * FROM rbus.\"Korisnik\" WHERE email=\'" + req.body.email + "\'");
  if (postojiemail.rows.length > 0)
    postojiemail = await client.execute("SELECT * FROM rbus.\"Autoprevoznik\" WHERE email=\'" + req.body.email + "\'");
  var postojiusername = await client.execute("SELECT * FROM rbus.\"Autoprevoznik\" WHERE email=\'" + req.body.username + "\'");
  if (postojiusername.rows.length > 0)
    postojiusername = await client.execute("SELECT * FROM rbus.\"Korisnik\" WHERE email=\'" + req.body.username + "\'");
  if (!validator.isEmail(req.body.email) || postojiemail.rows.length > 0) {

    req.flash("error", "Email nije validan!");
    res.redirect("/register");
  }
  else {

    if (postojiusername.rows.length > 0) {
      req.flash("error", "Vec postoji korisnik sa tim username-om, izaberite drugi!");
      res.redirect("/register");
    }
    else {
      var pattern = /^06\d{7,8}$/;
      if (pattern.test(req.body.telefon) == false) {
        req.flash("error", "Pogresan format telefona!");
        res.redirect("/register");
      }
      else {
        if (req.body.tip == 'korisnik') {
          await client.execute(`INSERT INTO rbus.\"Korisnik\" (id,username,password,name,phone,email) VALUES (uuid(),\'${req.body.username}\',\'${await bcrypt.hash(req.body.password, 8)}\',\'${req.body.name}\',\'${req.body.telefon}\',\'${req.body.email}\')`);
        }
        else {
          await client.execute(`INSERT INTO rbus.\"Autoprevoznik\" (\"AutoprevoznikID\",username,password,email,naziv,telefon) VALUES (uuid(),\'${req.body.username}\',\'${await bcrypt.hash(req.body.password, 8)}\',\'${req.body.email}\',\'${req.body.name}\',\'${req.body.telefon}\')`);

        }
        req.flash("success", "Uspesna registracija, sada se mozete ulogovati!");
        res.redirect("/");
      }
    }
  }
});
*/
app.get("/", function (req, res) {
  res.render("home.ejs", { user: req.user });
});
// STARTOVANJE SERVERA
app.listen(3000, async function () {
    console.log("Listening on port 3000");
    session.run('CREATE (n {age: $myIntParam})', {
        myIntParam: neo4j.int('9223372036854775807')
      })
  });
  // GASENJE APP

process.stdin.resume();//so the program will not close instantly

async function exitHandler(options, exitCode) {
  if (exitCode || exitCode === 0) {
    console.log("Goodbye");
  }
  await driver.close();
  process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
