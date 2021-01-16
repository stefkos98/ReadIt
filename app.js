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
  'bolt://localhost:11002',
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
  res.locals.info = req.flash("info");

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
  if (korisnik.records.length == 0 || korisnik.records[0].get(0).properties.email != email) {
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
    if (req.user.email == "sst@gmail.com") {
      const zanrovi = await session.run('MATCH (n :Zanr) RETURN n');
      var tabela = await session.run('MATCH(n:Knjiga) return n;');
      res.render("admin.ejs", { user: req.user, zanrovi: zanrovi.records, tabela: tabela.records });
    }
    else {
      let tabela1 = await session.run('MATCH (n:Korisnik)-[r1:PROCITAO]->(k :Knjiga), (p:Pisac)-[r2:NAPISAO]->(k)-[r3:PRIPADA_ZANRU]->(z:Zanr) WHERE n.email= $e WITH n, k, p, z ORDER BY k.naziv RETURN DISTINCT k,z,p', { e: req.user.email });
      let tabela2 = await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k :Knjiga), (p:Pisac)-[r2:NAPISAO]->(k)-[r3:PRIPADA_ZANRU]->(z:Zanr) WHERE n.email= $e WITH n, k, p, z ORDER BY k.naziv RETURN DISTINCT k,z,p', { e: req.user.email });
      let tabela3 = await session.run('MATCH (n:Korisnik)-[r:PRATI]->(n1:Korisnik) WHERE n.email= $e RETURN n1', { e: req.user.email });

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
      res.render("profile.ejs", { user: req.user, tabela1: tabela1.records, s1, k1, o, kom, tabela2: tabela2.records, s, k, tabela3: tabela3.records });
    }
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
  var datum = datetime.getFullYear() + "-" + mesec + "-" + dan + " " + sati + ":" + minuti;
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

//PRONALAZENJE PRIJATELJA
app.get("/find", async function (req, res) {
  if (req.user == undefined) {
    req.flash("error", "Niste ulogovani");
    res.redirect("/");
  }
  else {
    res.render("find.ejs", { user: req.user });
  }
});

// DODAVANJE PRIJATELJA
app.post("/dodaj/username/:email1", async function (req, res) {
  if (req.user.username == req.body.username) {
    req.flash("error", "Uneli ste svoj username");
    res.redirect("/find");
  }
  else {
    let prijatelj = await session.run('MATCH (n:Korisnik) WHERE n.username = $e RETURN n', { e: req.body.username });
    if (prijatelj.records[0] == undefined) {
      req.flash("error", "Ne postoji korisnik sa tim username-om");
      res.redirect("/find");
    }
    else {
      let veza = await session.run('MATCH (n1:Korisnik)-[r:PRATI]->(n2:Korisnik) WHERE n1.email = $e1 AND n2.username = $e2 RETURN r', { e1: req.params.email1, e2: req.body.username });
      if (veza.records[0] != undefined) {
        req.flash("success", "Korisnik je vec vas prijatelj");
        res.redirect("/find");
      }
      else {
        await session.run('MATCH (n1:Korisnik),(n2:Korisnik) WHERE n1.email = $e1 AND n2.username = $e2 CREATE (n1)-[r:PRATI]->(n2)', { e1: req.params.email1, e2: req.body.username });

        req.flash("success", "Uspesno ste dodali prijatelja");
        res.redirect("/find");
      }
    }
  }
});

app.post("/dodaj/email/:email1", async function (req, res) {
  if (req.user.email == req.body.email) {
    req.flash("error", "Uneli ste svoj email");
    res.redirect("/find");
  }
  else {
    let prijatelj = await session.run('MATCH (n:Korisnik) WHERE n.email = $e RETURN n', { e: req.body.email });
    if (prijatelj.records[0] == undefined) {
      req.flash("error", "Ne postoji korisnik sa tim email-om");
      res.redirect("/find");
    }
    else {
      let veza = await session.run('MATCH (n1:Korisnik)-[r:PRATI]->(n2:Korisnik) WHERE n1.email = $e1 AND n2.email = $e2 RETURN r', { e1: req.params.email1, e2: req.body.email });
      if (veza.records[0] != undefined) {
        req.flash("success", "Korisnik je vec vas prijatelj");
        res.redirect("/find");
      }
      else {
        await session.run('MATCH (n1:Korisnik),(n2:Korisnik) WHERE n1.email = $e1 AND n2.email = $e2 CREATE (n1)-[r:PRATI]->(n2)', { e1: req.params.email1, e2: req.body.email });

        req.flash("success", "Uspesno ste dodali prijatelja");
        res.redirect("/find");
      }
    }
  }
});

app.post("/dodaj/email/:email1/:email2", async function (req, res) {
  if (req.user.email == req.params.email2) {
    req.flash("error", "To ste vi");
    res.redirect("/find");
  }
  else {
    let prijatelj = await session.run('MATCH (n:Korisnik) WHERE n.email = $e RETURN n', { e: req.params.email2 });
    if (prijatelj.records[0] == undefined) {
      req.flash("error", "Ne postoji korisnik sa tim email-om");
      res.redirect("/find");
    }
    else {
      let veza = await session.run('MATCH (n1:Korisnik)-[r:PRATI]->(n2:Korisnik) WHERE n1.email = $e1 AND n2.email = $e2 RETURN r', { e1: req.params.email1, e2: req.params.email2 });
      if (veza.records[0] != undefined) {
        req.flash("success", "Korisnik je vec vas prijatelj");
        res.redirect("/find");
      }
      else {
        await session.run('MATCH (n1:Korisnik),(n2:Korisnik) WHERE n1.email = $e1 AND n2.email = $e2 CREATE (n1)-[r:PRATI]->(n2)', { e1: req.params.email1, e2: req.params.email2 });

        req.flash("success", "Uspesno ste dodali prijatelja");
        res.redirect("/find");
      }
    }
  }
});

app.get("/prikazi/imeprezime", async function (req, res) {
  if (req.user == undefined) {
    req.flash("error", "Niste ulogovani");
    res.redirect("/");
  }
  else {
    let ime = req.query.ime;
    if (ime == "" || ime == undefined)
      ime = ".*";
    else
      ime = ".*" + ime + ".*";
    let prezime = req.query.prezime;
    if (prezime == "" || prezime == undefined)
      prezime = ".*";
    else
      prezime = ".*" + prezime + ".*";

    let prijatelji = await session.run('MATCH (n:Korisnik) WHERE n.ime =~ $i AND n.prezime =~ $p WITH n ORDER BY n.ime, n.prezime, n.username RETURN n', { i: ime, p: prezime });
    res.render("resultfind.ejs", { user: req.user, prijatelji: prijatelji.records });
  }
});

// BRISANJE prijatelja
app.delete("/profile/ukloniprijatelja/:email1/:email2", async function (req, res) {
  let email1 = req.params.email1.toString();
  let email2 = req.params.email2.toString();
  await session.run('MATCH (n1:Korisnik)-[r:PRATI]->(n2:Korisnik) WHERE n1.email = $e1 AND n2.email = $e2 DELETE r', { e1: email1, e2: email2 });

  req.flash("success", "Uspesno ste uklonili korisnika iz liste prijatelja!");
  res.redirect("/profile");
});
//ADMIN

app.post("/profile/admin/zanr", async (req, res) => {
  var zanr = await session.run('MATCH (n:Zanr) WHERE n.naziv=$n1 return n', { n1: req.body.zanr });
  if (zanr.records.length > 0) {
    req.flash("error", "Uneti zanr vec postoji u bazi");
    res.redirect("/profile");
  }
  else {
    await session.run('CREATE (n:Zanr {naziv:$n1}) return n', { n1: req.body.zanr });
    req.flash("success", "Uspesno ste uneli zanr");
    res.redirect("/profile");
  }
})
app.delete("/profile/admin/:zanr", async (req, res) => {
  var zanr = await session.run('MATCH (n:Zanr) WHERE n.naziv=$n1 delete n', { n1: req.params.zanr });
  req.flash("success", "Uspesno ste obrisali zanr");
  res.redirect("/profile");
})
app.post("/profile/admin/knjiga", async (req, res) => {
  if (req.body.zanr == undefined) {
    req.flash("error", "Niste izabrali zanr");
    res.redirect("/profile");
  }
  else {
    var knjiga = await session.run('CREATE (k:Knjiga{naziv:$k1,godina:$k2,opis:$k3,brocena:0,ocena:0.0}) return k', { k1: req.body.naziv, k2: req.body.godina.toString(), k3: req.body.opis });
    for (var i = 0; i < req.body.zanr.length; i++)
      var zanr = await session.run('MATCH (a:Knjiga),(b:Zanr) WHERE a.naziv = $k1 AND b.naziv = $k2 CREATE (a)-[r:PRIPADA_ZANRU]->(b)RETURN type(r);', { k1: req.body.naziv, k2: req.body.zanr[i] });
    var pisac = req.body.autor.split(' ');
    var pisacbaza = await session.run('MATCH(n:Pisac) where n.ime=$n1 AND n.prezime=$n2 return n', { n1: pisac[0], n2: pisac[1] });
    if (pisacbaza.records.length > 0) {
      var veza = await session.run('MATCH (a:Knjiga),(b:Pisac) WHERE a.naziv = $k1 AND b.ime =$k2 AND b.prezime=$k3  CREATE (b)-[r:NAPISAO]->(a) RETURN type(r);', { k1: req.body.naziv, k2: pisac[0], k3: pisac[1] });
      req.flash("success", "Uspesno ste dodali knjigu u bazu");
      res.redirect("/profile");
    }
    else {
      req.flash("info", "Uneti autor ne postoji u bazi, unesite informacije o piscu");
      res.redirect(`/profile/admin/pisac/${pisac[0]}/${pisac[1]}/${req.body.naziv}`);
    }
  }
})
app.get(`/profile/admin/pisac/:ime/:prezime/:naziv`, async (req, res) => {
  res.render("pisac.ejs", { user: req.user, ime: req.params.ime, prezime: req.params.prezime, naziv: req.params.naziv });
})
app.post(`/profile/admin/pisac/:ime/:prezime/:naziv`, async (req, res) => {
  var pisac = await session.run('CREATE (p:Pisac {ime:$p1,prezime:$p2,grodjenja:$p3,gsmrti:$p4,biografija:$p5,drzava:$p6}) return p', { p1: req.params.ime, p2: req.params.prezime, p3: req.body.grodjenja, p4: req.body.gsmrti, p5: req.body.biografija, p6: req.body.drzava });
  var veza = await session.run('MATCH (a:Knjiga),(b:Pisac) WHERE a.naziv = $k1 AND b.ime =$k2 AND b.prezime=$k3  CREATE (b)-[r:NAPISAO]->(a) RETURN type(r);', { k1: req.params.naziv, k2: req.params.ime, k3: req.params.prezime });
  req.flash("success", "Uspesno ste kreirali pisca i povezali knjigu sa piscem");
  res.redirect("/profile")
})
app.delete("/profile/admin/knjiga/:naziv", async (req, res) => {
  var knjiga = await session.run('MATCH (n:Knjiga) WHERE n.naziv=$n1  detach delete n', { n1: req.params.naziv });
  req.flash("success", "Uspesno ste obrisali knjigu");
  res.redirect("/profile");
})
// STRANICA O JEDNOJ KNJIZI
app.get('/rezultat/:knjiga', async (req, res) => {
  var knjiga = await session.run('MATCH (p:Pisac)-[r1:NAPISAO]->(k :Knjiga)-[r2:PRIPADA_ZANRU]->(z:Zanr) where k.naziv=$k1 return k,p,z', { k1: req.params.knjiga });
  var komentari = await session.run('MATCH (k:Korisnik)-[r1:OCENIO]->(n:Knjiga) where n.naziv=$n1 WITH k,r1,n ORDER BY r1.datum return r1,k', { n1: req.params.knjiga });
  var zainteresovan, nezainteresovan, procitao;
  if (req.user != undefined) {
    zainteresovan = await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 return r1', { n1: req.user.email, n2: req.params.knjiga });
    if (zainteresovan.records.length > 0) {
      zainteresovan = "DA";
    }
    else {
      zainteresovan = null;
    }
    nezainteresovan = await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"NE"}]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 return r1', { n1: req.user.email, n2: req.params.knjiga });
    if (nezainteresovan.records.length > 0) {
      nezainteresovan = "DA";
    }
    else {
      nezainteresovan = null;
    }
    procitao = await session.run('MATCH (n:Korisnik)-[r1:PROCITAO]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 return r1', { n1: req.user.email, n2: req.params.knjiga });
    if (procitao.records.length > 0) {
      procitao = "DA";
    }
    else {
      procitao = null;
    }
  }
  else {
    nezainteresovan = zainteresovan = procitao = null;
  }
  res.render('knjigaview.ejs', { user: req.user, tabela: knjiga.records, book: req.params.knjiga, komentari: komentari.records, zainteresovan: zainteresovan, nezainteresovan: nezainteresovan, procitao: procitao });
})
// KREIRANJE VEZA IZMEDJU KNJIGA I KORISNIKA
app.post('/knjiga/:knjiga/zainteresovan', async (req, res) => {
  var zainteresovan = await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 return r1', { n1: req.user.email, n2: req.params.knjiga });
  if (zainteresovan.records.length > 0) {
    await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 delete r1;', { n1: req.user.email, n2: req.params.knjiga })
  }
  else {
    //Kreiranje zainteresovan
    await session.run('MATCH (n:Korisnik),(k:Knjiga) WHERE n.email=$n1 AND k.naziv=$n2  CREATE (n)-[r1:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k)  return r1;', { n1: req.user.email, n2: req.params.knjiga })
    // Uklanjanje nezainteresovan
    await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"NE"}]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 delete r1;', { n1: req.user.email, n2: req.params.knjiga })

  }
  req.flash("success", "Uspesno promenjena zainteresovanost");
  res.redirect("/rezultat/" + req.params.knjiga);
})
app.post('/knjiga/:knjiga/nezainteresovan', async (req, res) => {
  var zainteresovan = await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"NE"}]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 return r1', { n1: req.user.email, n2: req.params.knjiga });
  if (zainteresovan.records.length > 0) {
    await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"NE"}]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 delete r1;', { n1: req.user.email, n2: req.params.knjiga })
  }
  else {
    //Kreiranje nezainteresovan
    await session.run('MATCH (n:Korisnik),(k:Knjiga) WHERE n.email=$n1 AND k.naziv=$n2  CREATE (n)-[r1:ZAINTERESOVAN_ZA{da_ne:"NE"}]->(k)  return r1;', { n1: req.user.email, n2: req.params.knjiga })
    //Brisanje zainteresovan
    await session.run('MATCH (n:Korisnik)-[r1:ZAINTERESOVAN_ZA{da_ne:"DA"}]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 delete r1;', { n1: req.user.email, n2: req.params.knjiga })

  }
  req.flash("success", "Uspesno promenjena nezainteresovanost");
  res.redirect("/rezultat/" + req.params.knjiga);
})
app.post('/knjiga/:knjiga/procitao', async (req, res) => {
  var procitao = await session.run('MATCH (n:Korisnik)-[r1:PROCITAO]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 return r1', { n1: req.user.email, n2: req.params.knjiga });
  if (procitao.records.length > 0) {
    await session.run('MATCH (n:Korisnik)-[r1:PROCITAO]->(k :Knjiga) WHERE n.email=$n1 AND k.naziv=$n2 delete r1;', { n1: req.user.email, n2: req.params.knjiga })
  }
  else {
    await session.run('MATCH (n:Korisnik),(k:Knjiga)  WHERE n.email=$n1 AND k.naziv=$n2 CREATE (n)-[r1:PROCITAO]->(k) return r1;', { n1: req.user.email, n2: req.params.knjiga })

  }
  req.flash("success", "Uspesno promenjena veza");
  res.redirect("/rezultat/" + req.params.knjiga);
})
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
