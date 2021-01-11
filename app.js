//EXPRESS
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// FOLDER ZA CSS, JS I DRUGE FAJLOVE
app.use(express.static("public"));

// NEO4J
var neo4j = require('neo4j-driver');
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

passport.use('korisniklocal', new localStrategy({ usernameField: 'email' }, async function (email, password, done) {
  const korisnik = await session.run('MATCH (k :Korisnik {email: $e}) RETURN k', { e: email });

  if (korisnik.records[0].get(0).properties.email != email) {
    return done(null, false, { message: 'Incorrect email.' });
  }
  else {
    const t = await bcrypt.compare(password, korisnik.records[0].get(0).properties.sifra);
    if (!t) return done(null, false, { message: 'Incorrect password' });
    return done(null, korisnik.records[0].get(0).properties);
  }
}));

//LOGIN
app.get("/login", function (req, res) {
  if (req.user != undefined) {
    req.flash("error", "Vec ste ulogovani");
    res.redirect("/");
  }
  else res.render('login.ejs', { user: req.user });
});
app.post('/login', passport.authenticate(["korisniklocal"], { successRedirect: "/", failureRedirect: "/login" }), (req, res) => { });

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
  var postojiemail = await session.run('MATCH (k :Korisnik {email: $e}) RETURN k', { e: req.body.email });
  var postojiusername = await session.run('MATCH (k :Korisnik {email: $e}) RETURN k', { e: req.body.username });

  if (!validator.isEmail(req.body.email) || postojiemail.length > 0) {
    req.flash("error", "Email nije validan!");
    res.redirect("/register");
  }
  else {
    if (postojiusername.length > 0) {
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
        await session.run('CREATE (k :Korisnik {ime: $ime, prezime: $prezime, username: $username, email: $e, sifra: $sifra, telefon: $telefon}) RETURN k',
          { ime: req.body.name, prezime: req.body.lastname, username: req.body.username, e: req.body.email, sifra: await bcrypt.hash(req.body.password, 8), telefon: req.body.telefon, });

        req.flash("success", "Uspesna registracija, sada se mozete ulogovati!");
        res.redirect("/");
      }
    }
  }
});

app.get("/", async function (req, res) {
  const zanrovi = await session.run('MATCH (n :Zanr) RETURN n');

  res.render("home.ejs", { user: req.user, zanrovi: zanrovi });
});

app.get("/search", async function (req, res) {

  let nazivknjige = req.query.nazivknjige;
  if (nazivknjige == "" || nazivknjige == undefined) nazivknjige = ".*";
  else nazivknjige = ".*" + nazivknjige + ".*";
  let zanr = req.query.zanr;
  if (zanr == "0" || zanr == undefined) zanr = ".*";
  let godina = req.query.godina;
  if (godina == "" || godina == undefined) godina = ".*";
  let ocena = req.query.ocena
  if (ocena == "" || ocena == undefined) ocena = 0.0;
  else ocena = parseInt(req.query.ocena);
  let imep = req.query.imep;
  if (imep == "" || imep == undefined) imep = ".*";
  let prezimep = req.query.prezimep;
  if (prezimep == "" || prezimep == undefined) prezimep = ".*";
  let drzava = req.query.drzava;
  if (drzava == "" || drzava == undefined) drzava = ".*";

  let tabela = await session.run('MATCH (p:Pisac)-[r1:NAPISAO]->(k :Knjiga)-[r2:PRIPADA_ZANRU]->(z:Zanr) WHERE k.naziv=~ $n AND k.godina=~ $g AND k.ocena>=$o AND z.naziv=~$zn AND p.ime=~$ime AND p.prezime=~$prezime AND p.drzava=~$d WITH k, p, z ORDER BY k.naziv RETURN DISTINCT k,z,p', { n: nazivknjige, g: godina, o: ocena, zn: zanr, ime: imep, prezime: prezimep, d: drzava });
  let s = "";
  let k = 1;
  res.render("rezultat.ejs", { user: req.user, tabela: tabela.records, s, k });
});

// STARTOVANJE SERVERA
app.listen(3000, async function () {
  console.log("Listening on port 3000");
  //session.run('CREATE (n {age: $myIntParam})', {
  //    myIntParam: neo4j.int('9223372036854775807')
  //  })
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
