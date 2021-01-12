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

// KORISNIKOV PROFIL
app.get("/profile", async function (req, res) {
  if (req.user == undefined) {
    req.flash("error", "Niste ulogovani");
    res.redirect("/");
  }
  else {
    let tabela1 = await session.run('MATCH (n:Korisnik)-[r1:PROCITAO]->(k :Knjiga), (p:Pisac)-[r2:NAPISAO]->(k)-[r3:PRIPADA_ZANRU]->(z:Zanr) WHERE n.email= $e WITH n, k, p, z ORDER BY k.naziv RETURN DISTINCT k,z,p', { e: req.user.email });
    let tabela2 = await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k :Knjiga), (p:Pisac)-[r2:NAPISAO]->(k)-[r3:PRIPADA_ZANRU]->(z:Zanr) WHERE n.email= $e WITH n, k, p, z ORDER BY k.naziv RETURN DISTINCT k,z,p', { e: req.user.email });

    let o = [];
    let kom = [];
    for (var i = 0; i < tabela1.records.length; i++) {
      let naziv = tabela1.records[i].get(0).properties.naziv
      let t1 = await session.run('MATCH (n:Korisnik)-[r1:OCENIO]->(k :Knjiga) WHERE k.naziv= $naz AND n.email= $e RETURN r1', { naz: naziv, e: req.user.email });
      if (t1.records[0] != undefined) {
        o.push(t1.records[0].get(0).properties.ocena);
        kom.push(t1.records[0].get(0).properties.komentar);
      }
      else {
        o.push(undefined);
        kom.push(undefined);
      }
    }
    let s1 = "";
    let s = "";
    let k = 1;
    let k1 = 1;
    res.render("profile.ejs", { user: req.user, tabela1: tabela1.records, s1, k1, o, kom, tabela2: tabela2.records, s, k });
  }
});

app.put("/profile/oceni/:email", async function (req, res) {
  let email = req.params.email.toString();
  let words = req.body.skriven.split(" ");
  let naziv = words[3].toString();
  for (let i = 4; i < words.length; i++) {
    naziv = naziv + " " + words[i];
  }
  naziv = naziv.toString();
  let godina = words[0].toString();
  let stara_ocena = parseInt(words[1]);
  let brocena = parseInt(words[2]);
  let ocena = parseInt(req.body.ocena);
  let komentar = req.body.komentar.toString();
  var datetime = new Date();
  var dan = datetime.getDate();
  if (dan < 10) dan = "0" + dan;
  var mesec = datetime.getMonth() + 1;
  if (mesec < 10) mesec = "0" + mesec;
  var sati = datetime.getHours();
  if (sati < 10) sati = "0" + sati;
  var minuti = datetime.getMinutes();
  if (minuti < 10) minuti = "0" + minuti;
  var datum = dan + "." + mesec + "." + datetime.getFullYear() + ". " + sati + ":" + minuti;

  await session.run('MATCH (k:Knjiga), (n:Korisnik) WHERE k.naziv= $n AND k.godina=$g AND n.email= $e  CREATE (n)-[r:OCENIO{ocena:$o,komentar:$kom,datum:$dat}]->(k)',
    { n: naziv, g: godina, e: email, o: ocena, kom: komentar, dat: datum });

  let nova_ocena = (stara_ocena * brocena + ocena) / (brocena + 1);
  await session.run('MATCH (k:Knjiga) WHERE k.naziv= $n AND k.godina=$g SET k.ocena= $o', { n: naziv, g: godina, o: nova_ocena });

  await session.run('MATCH (k:Knjiga) WHERE k.naziv= $n AND k.godina=$g SET k.brocena=k.brocena+1', { n: naziv, g: godina });

  req.flash("success", "Uspesno ste uneli ocenu!");
  res.redirect("/profile");
});

app.delete("/profile/obrisiocenu/:email/:naziv/:godina/:brocena/:pocena/:ocena/:komentar", async function (req, res) {
  let email = req.params.email.toString();
  let naziv = req.params.naziv.toString();
  let godina = req.params.godina.toString();
  let brocena = parseInt(req.params.brocena);
  let pocena = parseInt(req.params.pocena);
  let ocena = parseInt(req.params.ocena);
  let komentar = req.params.komentar.toString();

  await session.run('MATCH (n:Korisnik)-[r:OCENIO]->(k:Knjiga) WHERE k.naziv =$naziv AND k.godina=$g AND n.email = $e DELETE r',
    { naziv: naziv, g: godina, e: email });

  let nova_ocena = (pocena * brocena - ocena);
  if (brocena > 1) nova_ocena = (pocena * brocena - ocena) / (brocena - 1);

  await session.run('MATCH (k:Knjiga) WHERE k.naziv= $n AND k.godina=$g SET k.ocena= $o', { n: naziv, g: godina, o: nova_ocena });

  await session.run('MATCH (k:Knjiga) WHERE k.naziv= $n AND k.godina=$g SET k.brocena=k.brocena-1', { n: naziv, g: godina });

  req.flash("success", "Uspesno ste obrisali ocenu!");
  res.redirect("/profile");
});

app.delete("/profile/izbaci/:email/:naziv/:godina", async function (req, res) {
  let email = req.params.email.toString();
  let naziv = req.params.naziv.toString();
  let godina = req.params.godina.toString();

  await session.run('MATCH (n:Korisnik)-[r:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k:Knjiga) WHERE k.naziv =$naziv AND k.godina=$g AND n.email = $e DELETE r',
    { naziv: naziv, g: godina, e: email });

  req.flash("success", "Uspesno ste izbacili knjigu iz liste zelja!");
  res.redirect("/profile");
});

app.put("/profile/procitanoizlistezelja/:email/:naziv/:godina", async function (req, res) {
  let email = req.params.email.toString();
  let naziv = req.params.naziv.toString();
  let godina = req.params.godina.toString();

  await session.run('MATCH (n:Korisnik)-[r:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k:Knjiga) WHERE k.naziv=$naziv AND k.godina=$g AND n.email = $e DELETE r',
    { naziv: naziv, g: godina, e: email });

  await session.run('MATCH (n:Korisnik),(k:Knjiga) WHERE k.naziv =$naziv AND k.godina=$g AND n.email = $e CREATE (n)-[r:PROCITAO]->(k)',
    { naziv: naziv, g: godina, e: email });

  req.flash("success", "Uspesno ste oznacili knjigu kao procitanu!");
  res.redirect("/profile");
});

//PROMENA PODATAKA O KORISNIKU
app.put("/profile/edit/:email", async function (req, res) {
  var email = req.params.email.toString();
  var novasifra;
  const t = await bcrypt.compare(req.body.sifra, req.user.sifra);
  if (!t) {
    req.flash("error", "Uneli ste pogresnu sifru. Podaci nisu promenjeni!");
    res.redirect("/profile");
  }
  else {
    if (req.body.sifra2 != "") {
      novasifra = await bcrypt.hash(req.body.sifra2, 8);
    }
    else {
      novasifra = req.user.sifra;
    }

    await session.run('MATCH (n:Korisnik) WHERE n.email = $e SET n.ime=$i', { e: email, i: req.body.ime.toString() });
    await session.run('MATCH (n:Korisnik) WHERE n.email = $e SET n.prezime=$i', { e: email, i: req.body.prezime.toString() });
    await session.run('MATCH (n:Korisnik) WHERE n.email = $e SET n.sifra=$i', { e: email, i: novasifra.toString() });
    await session.run('MATCH (n:Korisnik) WHERE n.email = $e SET n.telefon=$i', { e: email, i: req.body.telefon.toString() });

    var user = await session.run('MATCH (n:Korisnik) WHERE n.email = $e RETURN n', { e: email });
    req.login(user.records[0].get(0).properties, function (err) {
      if (err) return next(err);
    });
    req.flash("success", "Uspesno ste izmenili podatke!");
    res.redirect("/profile");
  }

});

// BRISANJE KORISNIKOVOG PROFILA
app.delete("/profile/:email", async function (req, res) {
  let email = req.params.email.toString();
  await session.run('MATCH (n:Korisnik) WHERE n.email = $e DELETE n', { e: email });

  req.logout();
  req.flash("success", "Uspesno ste obrisali nalog ")
  res.redirect("/");
});

// STARTOVANJE SERVERA
app.listen(3000, async function () {
  console.log("Listening on port 3000");
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
