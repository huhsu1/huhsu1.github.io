/*
Script to run to triangulate
*/

import { Point } from "./geometry.js";
import { earClip } from "./earclipping.js";

/* ---------------------- Init ----------------------------- */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// fit canvas to size
canvas.style.width = "100%";
canvas.style.height = "100%";


var shape = getStar();
drawPolygon(shape);

addShapeButtonEvents();
addFunctionButtonEvents();

/* ----------------------  Event Handlers ------------------ */
function addShapeButtonEvents() {
    var starButton = document.getElementById("star");
    starButton.addEventListener("click", makeShapeButtonHandler(getStar));
}

function addFunctionButtonEvents() {
    var earClipButton = document.getElementById("earclip");
    earClipButton.addEventListener("click", makeFunctionButtonHandler(earClip));
}

function makeFunctionButtonHandler(method) {
    return function(e) {
        var clipped = method(shape);
        for (let i = 0; i < clipped.length; i++) {
            drawPolygon(clipped[i]);
        }
    }
}

function makeShapeButtonHandler(shapeFunction) {
    return function(e) {
        shape = shapeFunction();
        clear();
        drawPolygon(shape);
    }
}

/* ----------------------  Triangulation Code -------------- */




/* ----------------------  Benchmark Shapes ---------------- */
function getStar() {
    var center = new Point(canvas.width / 2, canvas.height / 2);
    var length = Math.min(canvas.width, canvas.height) / 4;
    var outer = getPointsOnCircle(center, length, 0 - Math.PI / 2, 5);
    var inner = getPointsOnCircle(center, length * .382, 0-(3*Math.PI/10), 5);
    var ans = [];
    for (let i = 0; i < 5; i++) {
        ans.push(outer[i]);
        ans.push(inner[i]);
    }
    return ans;
}

function getPointsOnCircle(center, length, startAngle, numPoints) {
    var ans = getPointsOnArc(center, length, startAngle, startAngle + 2*Math.PI, numPoints + 1);
    // I'll sub last point since duplicate
    ans.pop();
    return ans;
} 

function getPointsOnArc(center, length, startAngle, endAngle, numPoints) {
    // angles should be in radians
    var ans = [];
    var angleDif = (endAngle - startAngle) / (numPoints - 1);
    for (var i = 0; i < numPoints; i++) {
        var angle = startAngle + i*(angleDif);
        ans.push(center.add(new Point(length * Math.cos(angle), length * Math.sin(angle))));
    }
    return ans;
}

/* -------------------------- Draw Util ------------------- */
function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function drawPolygon(vertices) {
    ctx.beginPath();
    ctx.strokeStyle = "black";
    var start = vertices[0];
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    var last = vertices[vertices.length - 1];
    if (start.x != last.x || start.y != last.y) {
        ctx.lineTo(start.x, start.y);
    }
    ctx.stroke();
}


