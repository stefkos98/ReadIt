var b1 = document.getElementById("b1");
var b2 = document.getElementById("b2");
var b3 = document.getElementById("b3");

var p1 = document.getElementById("id1");
var p2 = document.getElementById("id2");
var p3 = document.getElementById("id3");

b1.addEventListener("click", function () {
    p1.style.display = "block";
    p2.style.display = "none";
    p3.style.display = "none";
});

b2.addEventListener("click", function () {
    p1.style.display = "none";
    p2.style.display = "block";
    p3.style.display = "none";
});

b3.addEventListener("click", function () {
    p1.style.display = "none";
    p2.style.display = "none";
    p3.style.display = "block";
});