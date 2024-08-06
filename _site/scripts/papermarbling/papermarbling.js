function init() {
    fitToContainer(canvas);
    canvasRatio = canvas.width / canvas.offsetWidth;
    window.onresize = function() {
        console.log("resizing");
        canvasRatio = canvas.width / canvas.offsetWidth;
    }

    canvas.addEventListener("contextmenu", clickEvent, false);
    canvas.addEventListener("mousedown", mouseDownEvent);
    canvas.addEventListener("mouseup", mouseUpEvent);
    canvas.addEventListener("mousemove", mouseMoveEvent);
}

function fitToContainer(canvas) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
}


/* ------------------ Events ---------------------- */

function clickEvent(e) {
    e.preventDefault();
    var drop = new InkDrop(e.offsetX * canvasRatio, e.offsetY * canvasRatio, 200);
    drawCanvas();
    return false;
}

function mouseDownEvent(e) {
    B.x = e.offsetX * canvasRatio;
    B.y = e.offsetY * canvasRatio;
    mouseDown = true;
}

function mouseMoveEvent(e) {
    if (mouseDown) {
        E.x = e.offsetX * canvasRatio;
        E.y = e.offsetY * canvasRatio;
        var width = E.x - B.x;
        var height = E.y - B.y;
        if ((width * width) + (height * height) >= Lsquared) {
            strokeAll();
            B.x = E.x;
            B.y = E.y;
        }
        drawCanvas();
    }
}

function mouseUpEvent(e) {
    E.x = e.offsetX * canvasRatio;
    E.y = e.offsetY * canvasRatio;
    mouseDown = false;

    strokeAll();
    drawCanvas();
}

function strokeAll() {
    for (let i = 0; i < DROP_LIST.length; i++) {
        DROP_LIST[i].stroke(B, E, L);
    }
}

function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < DROP_LIST.length; i++) {
        DROP_LIST[i].draw(ctx);
    }
}




/* ------------------ Events End ------------------- */


/* ------------------ stroke ----------------------- */
/* https://people.csail.mit.edu/jaffer/Marbling/stroke.pdf */

function stroke(P, B, E, L) {
    // everything is scaled. I make it divide into every L pixels
    // eq (15) in the paper

    strokeQ(P, B, E, L);

    // currently, I already separate input into segments of max length L
    // so this division of segment into smaller parts is unnecessary
    /*
    var I = vectorSub(E, B);
    var n = Math.ceil(Math.sqrt(I.getMagSquared()) / L);
    I.mult(1/n);
    var curr = B;
    var next = vectorAdd(B, I);
    
    for (let i = 0; i < n-1; i++) {
        strokeQ(P, curr, next, L);
        curr = next;
        next = vectorAdd(curr, I);
    }*/
}

function strokeQ(P, B, E, L) {
    // P = point, B = strokeBegin, E = strokeEnd, L = characteristic length
    // For velocity field (14) in the paper
    // overall structure
    // N-> direction of stroke begin to end
    // -> calculate force in direction of stroke
    // update by rotating the force

    var N = vectorSub(E, B);
    var lambda = Math.sqrt(N.getMagSquared());
    N.mult(1/lambda);

    var pMinusB = vectorSub(P, B);

    var xb = dot(N, pMinusB);
    var xe = dot(N, vectorSub(P, E));

    // Used to cross with P - (B + E)/ 2, but can just cross with P-B same thing
    var y = crossScalar(N, pMinusB);

    // force on rotated x as scalar in x direction
    var fxt = Fxt(xb, xe, y, lambda, L);

    // Fx only has x component
    // rotation of [[Nx -Ny] [Ny Nx]] can just be Nx*fxt, Ny*fxt
    P.add(N.x * fxt, N.y * fxt);
}

function Fxt(xb, xe, y, lambda, L) {
    // note Ut = xe - xb = lambda scalar on this x plane
    // Fx multiplies by U, but strokeQ multiplies by t
    // t becomes obsolete -> just use Ut = xe - xb
    // Fx = U/2[(1-(y^2)/rL)*exp(-r/L) + (1-y^2/sL)*exp(-s/L)]
    // Fxt = t * Fx -> lambda / 2 * []

    // note x is just point's x, y is y in rotated plane
    var y2 = y*y;

    // such similar computations
    var r = Math.sqrt(xb*xb + y2);
    var s = Math.sqrt(xe*xe + y2);
    var lhs = (1 - (y2/(r*L))) * Math.exp(0-r/L);
    var rhs = (1 - (y2/(s*L))) * Math.exp(0-s/L);
    return lambda / 2 * (lhs + rhs);
}

/* ------------------- Stroke end ------------------- */

/* ------------------- InkDrop ------------------- */
class InkDrop {
    constructor(x, y, r, color=null) {
        this.x = x;
        this.y = y;
        this.r = r;
        if (color == null) {
            this.color = getRandomColor();
        }

        this.vertices = [];
        
        var subAngle = 2*Math.PI / VERTEX_COUNT;
        for (let i = 0; i < VERTEX_COUNT; i++) {
            let angle = i * subAngle;
            let v = new Vector(Math.cos(angle), Math.sin(angle));
            v.mult(r);
            v.add(this.x, this.y);
            this.vertices[i] = v;
        }
        this.push();
        DROP_LIST.push(this);
    }

    draw() {
        ctx.fillStyle = this.color;

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < VERTEX_COUNT; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.fill();
    }

    push() {
        var start = Date.now();
        for (let i = 0; i < DROP_LIST.length; i++) {
            DROP_LIST[i].update(this.x, this.y, this.r);
        }
        console.log(Date.now() - start);
    }

    update(centerX, centerY, radius) {
        for (let i = 0; i < VERTEX_COUNT; i++) {
            updatePoint(this.vertices[i], centerX, centerY, radius);
        }
    }

    stroke(B, E, L) {
        for (let i = 0; i < VERTEX_COUNT; i++) {
            stroke(this.vertices[i], B, E, L);
        }
    }

}


/* ------------------- InkDrop End ------------------- */

/* ------------------- Vector 2D --------------------- */
class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    mult(a) {
        this.x *= a;
        this.y *= a;
    }

    add(x, y) {
        this.x += x;
        this.y += y;
    }
    getMagSquared() {
        return (this.x*this.x) + (this.y*this.y);
    }
}

function vectorAdd(v1, v2) {
    return new Vector(v1.x + v2.x, v1.y + v2.y);
}

function vectorSub(v1, v2) {
    return new Vector(v1.x - v2.x, v1.y - v2.y);
}

function dot(v1, v2) {
    return (v1.x*v2.x) + (v1.y*v2.y);
}

function crossScalar(v1, v2) {
    return (v1.x*v2.y) - (v1.y*v2.x);
}


/* ------------------- Vector 2D end ----------------- */


/* ------------------- Helper ------------------------ */
function getRandomColor() {
    var letters = "0123456789ABCDEF";
    var color = "#";
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function updatePoint(point, centerX, centerY, radius) {
    point.add(0-centerX, 0-centerY);
    var ratio = Math.sqrt(1 + (radius * radius) / point.getMagSquared());
    point.mult(ratio);
    point.x += centerX;
    point.y += centerY;
}

function randomCreate(n) {
    for (let i = 0; i < n ;i++) {
        new InkDrop(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() *
        200);
    }
    drawCanvas();
}

async function strokeRandom(n, draw=false) {
    for (let i = 0; i < n ; i++) {
        if (draw) {
            drawCanvas();
        }
        B.x = Math.random()*canvas.width;
        B.y = Math.random()*canvas.height;
        let angle = Math.random()*2*Math.PI;
        E.x = startX + Math.cos(angle) * L;
        E.y = startY + Math.sin(angle) * L;
        strokeAll();
    }
    drawCanvas();
}
/* ------------------- Helper end--------------------- */

const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d");
var canvasRatio;
const B = new Vector(0, 0);
const E = new Vector(0, 0);
const VERTEX_COUNT = 8192;
const DROP_LIST = [];
const L = 100;
const Lsquared = L*L;
var mouseDown = false;
const totalTimeWrite = document.getElementById("totalTime");
const latestTimeWrite = document.getElementById("latestTime");
const createButton = document.getElementById("createButton");
const strokeButton = document.getElementById("strokeButton");



init();


