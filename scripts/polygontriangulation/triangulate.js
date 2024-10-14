/*
Script to run to triangulate
*/

import { Point } from "./geometry.js";
import { earClip } from "./earclipping.js";
import { monotone } from "./monotone.js";

/* ---------------------- Init ----------------------------- */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// fit canvas to size
canvas.style.width = "100%";
canvas.style.height = "100%";

var text = document.getElementById("results");
var slider = document.getElementById("range");
var detailValue = slider.value;
var shape = getStar(detailValue);
var currShapeMethod = getStar;
clearAndDraw(shape);

slider.onchange = function() {
    detailValue = slider.value;
    console.log(detailValue);
    shape = currShapeMethod(detailValue);
    clearAndDraw(shape);
}
addShapeButtonEvents();
addFunctionButtonEvents();


/* ----------------------  Event Handlers ------------------ */
function addShapeButtonEvents() {
    var starButton = document.getElementById("star");
    starButton.addEventListener("click", makeShapeButtonHandler(getStar));
    var heartButton = document.getElementById("heart");
    heartButton.addEventListener("click", makeShapeButtonHandler(getHeart));
}

function addFunctionButtonEvents() {
    var earClipButton = document.getElementById("earclip");
    earClipButton.addEventListener("click", makeFunctionButtonHandler(earClip));
    var earClipButton = document.getElementById("monotone");
    earClipButton.addEventListener("click", makeFunctionButtonHandler(monotone));
}

function makeFunctionButtonHandler(method) {
    return function(e) {
        clearAndDraw(shape);

        var start = Date.now()
        var clipped = method(shape);
        var duration = Date.now() - start;

        for (let i = 0; i < clipped.length; i++) {
            drawPolygon(clipped[i]);
        }
        addResultText(clipped, duration);
    }
}

function makeShapeButtonHandler(shapeFunction) {
    return function(e) {
        shape = shapeFunction(detailValue);
        clearAndDraw(shape);
        currShapeMethod = shapeFunction
    }
}

function clearAndDraw(shape) {
    clear();
    drawPolygon(shape);
    addShapeText(shape);
}

/* ----------------------  Benchmark Shapes ---------------- */
function getStar(detail) {
    var center = new Point(canvas.width / 2, canvas.height / 2);
    var length = Math.min(canvas.width, canvas.height) / 4;
    var points = parseInt(detail) + 4;
    var outer = getPointsOnCircle(center, length, 0 - Math.PI / 2, points);
    var inner = getPointsOnCircle(center, length * .382, 0-Math.PI/2 + (Math.PI/points), points);
    var ans = [];
    for (let i = 0; i < points; i++) {
        ans.push(outer[i]);
        ans.push(inner[i]);
    }
    return ans;
}

function getHeart(detail) {
    var topPoint = new Point(canvas.width / 2, canvas.height / 4);
    var bottomPoint = new Point(canvas.width / 2, 3 * canvas.height / 4);
    var numPoints = 3 + parseInt(detail);
    var ans = [];
    var offset = new Point(canvas.width / 6, 0);

    // I got this by flipping triangle formed by middle line and radius
    // this makes perfectly tangent line to bottom point
    var innerAngle = 2 * Math.atan((bottomPoint.y - topPoint.y) / offset.x);


    var leftCenter = topPoint.subtract(offset);
    var left = getPointsOnArc(leftCenter, offset.x, -2*Math.PI + innerAngle, 0, numPoints);
    ans.push(...left);
    // prevent repeat center
    ans.pop();
    var rightCenter = topPoint.add(offset);
    var right = getPointsOnArc(rightCenter, offset.x, 0 - Math.PI, Math.PI - innerAngle, numPoints);
    ans.push(...right);
    ans.push(bottomPoint);
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

function addShapeText(shape) {
    text.innerText = `${shape.length}-gon`;
}
function addResultText(triangles, duration) {
    text.innerText += ` with ${triangles.length} triangles, taking ${duration}ms`;
}

