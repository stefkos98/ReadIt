var b1 = document.getElementById("b1");
var b2 = document.getElementById("b2");
var b3 = document.getElementById("b3");
var b4 = document.getElementById("b4");
var b5 = document.getElementById("b5");
var b6 = document.getElementById("b6");
var btn1 = document.getElementById("btn1");

var btn0 = document.getElementsByClassName("btn0");

var p0 = document.getElementById("id0");
var p1 = document.getElementById("id1");
var p2 = document.getElementById("id2");
var p3 = document.getElementById("id3");
var p4 = document.getElementById("id4");
var p5 = document.getElementById("id5");
var p6 = document.getElementById("id6");

b1.addEventListener("click", function () {
    btn1.style.display = "block";
    p1.style.display = "block";
    p2.style.display = "none";
    p3.style.display = "none";
    p4.style.display = "none";
    p5.style.display = "none";
    p0.style.display = "none";
    p6.style.display = "none";
});

btn1.addEventListener("click", function () {
    btn1.style.display = "none";
    p1.style.display = "none";
    p2.style.display = "block";
    p3.style.display = "none";
    p4.style.display = "none";
    p5.style.display = "none";
    p0.style.display = "none";
    p6.style.display = "none";
});

b2.addEventListener("click", function () {
    btn1.style.display = "none";
    p1.style.display = "none";
    p2.style.display = "none";
    p3.style.display = "block";
    p4.style.display = "none";
    p5.style.display = "none";
    p0.style.display = "none";
    p6.style.display = "none";
})

b3.addEventListener("click", function () {
    btn1.style.display = "none";
    p1.style.display = "none";
    p2.style.display = "none";
    p3.style.display = "none";
    p4.style.display = "block";
    p5.style.display = "none";
    p0.style.display = "none";
    p6.style.display = "none";
})

b4.addEventListener("click", function () {
    btn1.style.display = "none";
    p1.style.display = "none";
    p2.style.display = "none";
    p3.style.display = "none";
    p4.style.display = "none";
    p5.style.display = "block";
    p0.style.display = "none";
    p6.style.display = "none";
})

b6.addEventListener("click", function () {
    btn1.style.display = "none";
    p1.style.display = "none";
    p2.style.display = "none";
    p3.style.display = "none";
    p4.style.display = "none";
    p5.style.display = "none";
    p0.style.display = "none";
    p6.style.display = "block";
})

$('#myModal1').modal('toggle')
