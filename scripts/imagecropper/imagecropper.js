//>init
const BOX_LINE_WIDTH = 2;
const BOX_COLOR = "cyan";
const BOX_EDGE_PADDING = 10;

var mouse = {
    x:0,
    y:0
}

const DRAG_MODE_CORNER = 0;
const DRAG_MODE_TRANSLATE = 1;
const DRAG_MODE_WIDTH = 2;
const DRAG_MODE_HEIGHT = 3;

const BOX_LOCATION_OUTSIDE = 0;
const BOX_LOCATION_INSIDE = 1;
const BOX_LOCATION_UPPER_WALL = 2;
const BOX_LOCATION_LEFT_WALL = 3;
const BOX_LOCATION_RIGHT_WALL = 4;
const BOX_LOCATION_BOTTOM_WALL = 5;
const BOX_LOCATION_UPPER_LEFT_CORNER = 6;
const BOX_LOCATION_UPPER_RIGHT_CORNER = 7;
const BOX_LOCATION_BOTTOM_LEFT_CORNER = 8;
const BOX_LOCATION_BOTTOM_RIGHT_CORNER = 9;

var STARTED = false;

var cropBoxData = {
    left:5,
    right:100,
    up:5,
    down:100,
    dragMode: DRAG_MODE_CORNER, // "resize", "translate", "create"
    // will have to add which way to resize as a var
    // resizing by corner just special case of create

    // where in box translation clicks
    originalLeft:0,
    originalRight:0,
    originalUp:0,
    originalDown:0,
    fixedX:0,
    fixedY:0,

    // combine into where on box
    whereOnBox:function(x, y) {
        if (x < this.left - BOX_EDGE_PADDING || x > this.right + BOX_EDGE_PADDING || y < this.up -
            BOX_EDGE_PADDING || y > this.down + BOX_EDGE_PADDING) {
            return BOX_LOCATION_OUTSIDE;
        }
        
        if (x <= this.left + BOX_EDGE_PADDING) { // near left wall
            if (y <= this.up + BOX_EDGE_PADDING) {
                return BOX_LOCATION_UPPER_LEFT_CORNER;
            }
            if (y >= this.down - BOX_EDGE_PADDING) {
                return BOX_LOCATION_BOTTOM_LEFT_CORNER;
            }
            return BOX_LOCATION_LEFT_WALL;
        }
        if (x >= this.right - BOX_EDGE_PADDING) { // near right wall
            if (y <= this.up + BOX_EDGE_PADDING) {
                return BOX_LOCATION_UPPER_RIGHT_CORNER;
            }
            if (y >= this.down - BOX_EDGE_PADDING) {
                return BOX_LOCATION_BOTTOM_RIGHT_CORNER;
            }
            return BOX_LOCATION_RIGHT_WALL;
        }
        if (y <= this.up + BOX_EDGE_PADDING) {
            return BOX_LOCATION_UPPER_WALL;
        }
        if (y >= this.down - BOX_EDGE_PADDING) {
            return BOX_LOCATION_BOTTOM_WALL;
        }
        return BOX_LOCATION_INSIDE;
    },
}

// get canvas, and make it adjust to window size
var canvas = document.getElementById("canvas");
var canvasOriginalWidth = canvas.width;
fitToContainer(canvas);
var canvasRatio = canvas.width / canvas.offsetWidth;
var ctx = canvas.getContext("2d");

// modal
var modal = document.getElementById("modal");
var container = document.getElementById("container");

var download = document.getElementById("download");
var crop = document.getElementById("crop");
var link = document.createElement("a");
var cancel = document.getElementById("cancel");
link.download = "cropped.png";
//<init


//>Image Input
/*
Input local file into canvas
https://stackoverflow.com/questions/10906734/how-to-upload-image-into-html5-canvas
*/
var imageLoader = document.getElementById("imageLoader");
imageLoader.addEventListener('change', handleImage, false);
var image = new Image();

function handleImage(e) {
    var reader = new FileReader();
    reader.onload = function(event) {
        image.onload = function() {
            addEventListeners();
            drawImage();
        }
        image.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}
//<Img Input


//>Event Listeners
// Handles resizing window to prevent box offsets
window.onresize = function() { 
    console.log("resizing");
    canvasRatio = canvas.width / canvas.offsetWidth;
}

function addEventListeners() {
    if (!STARTED) {
        // image cropper events for computer
        window.addEventListener("mousemove", onMouseMove, false);

        canvas.addEventListener("mousedown", onMouseDown, false);
        window.addEventListener("mouseup", onMouseUp, false);

        canvas.addEventListener("mouseover", onMouseOver, false);
        canvas.addEventListener("mouseout", onMouseOut, false);

        // image cropper events for phone
        window.addEventListener("touchstart", onTouchStart, false);
        window.addEventListener("touchend", onTouchEnd, false);
        window.addEventListener("touchmove", onTouchMove, false);

        // overlay events
        crop.addEventListener("click", openOverlay);

        modal.addEventListener("click", function(e) {
            if (e.target != modal && e.target != container) {
                return;
            }
            modal.classList.add("hidden");
        });
        download.addEventListener("click", function(e) {
            link.click();
        });
        cancel.addEventListener("click", function() {
            modal.classList.add("hidden");
        });
        STARTED = true;
    }
}
//<Event Listeners


//>Events
function onTouchStart(e) {
    for (let i = 0; i < e.touches.length; i++) {
        var item = e.touches[i];
        if (item.target.id == "canvas") {
            var offsetX = item.clientX - canvas.getBoundingClientRect().left;
            var offsetY = item.clientY - canvas.getBoundingClientRect().top;
            console.log(offsetX, offsetY);
            onMouseDown({ offsetX:offsetX, offsetY:offsetY });
        }
    }
}
function onTouchEnd(e) {
    mouse.isMouseDragged = false;
}
function onTouchMove(e) {
    onMouseMove(e.touches[0]);
}

function openOverlay() {
    console.log("pressed");
    drawPreview();
    modal.classList.remove("hidden");
    link.href = preview.toDataURL();
}



function onMouseMove(e) {
    mouse.x = (e.clientX - canvas.getBoundingClientRect().left) * canvasRatio;
    mouse.y = (e.clientY - canvas.getBoundingClientRect().top) * canvasRatio;

    switch (cropBoxData.whereOnBox(mouse.x, mouse.y)) {
        case BOX_LOCATION_OUTSIDE:
            canvas.style.cursor = "crosshair";
            break;
        case BOX_LOCATION_INSIDE:
            canvas.style.cursor = "move";
            break;
        case BOX_LOCATION_UPPER_WALL:
        case BOX_LOCATION_BOTTOM_WALL:
            canvas.style.cursor = "n-resize";
            break;
        case BOX_LOCATION_LEFT_WALL:
        case BOX_LOCATION_RIGHT_WALL:
            canvas.style.cursor = "e-resize";
            break;
        case BOX_LOCATION_UPPER_LEFT_CORNER:
        case BOX_LOCATION_BOTTOM_RIGHT_CORNER:
            canvas.style.cursor = "nwse-resize";
            break;
        case BOX_LOCATION_UPPER_RIGHT_CORNER:
        case BOX_LOCATION_BOTTOM_LEFT_CORNER:
            canvas.style.cursor = "nesw-resize";
            break;
        default:
            console.log("something went wrong with location logic");
    }

    if (!mouse.isMouseOver) {
        if (mouse.isMouseDragged) {
            mouse.x = Math.max(mouse.x, 0);
            mouse.x = Math.min(mouse.x, canvas.width-1);
            mouse.y = Math.max(mouse.y, 0);
            mouse.y = Math.min(mouse.y, canvas.height-1);
        }
    }
    changeBox();
    render();
}

function onMouseDown(e) {
    var x = e.offsetX * canvasRatio;
    var y = e.offsetY * canvasRatio;
    mouse.isMouseDragged = true;

    switch (cropBoxData.whereOnBox(x, y)) {
        case BOX_LOCATION_OUTSIDE: // create new
            cropBoxData.dragMode = DRAG_MODE_CORNER;
            cropBoxData.fixedX = x;
            cropBoxData.fixedY = y;
            break;
        case BOX_LOCATION_INSIDE: // translate
            cropBoxData.dragMode = DRAG_MODE_TRANSLATE;
            cropBoxData.originalLeft = cropBoxData.left;
            cropBoxData.originalRight = cropBoxData.right;
            cropBoxData.originalUp = cropBoxData.up;
            cropBoxData.originalDown = cropBoxData.down;
            cropBoxData.fixedX = x;
            cropBoxData.fixedY = y;
            break;
        case BOX_LOCATION_UPPER_WALL:
            cropBoxData.dragMode = DRAG_MODE_HEIGHT;
            cropBoxData.fixedY = cropBoxData.down;
            break;
        case BOX_LOCATION_BOTTOM_WALL:
            cropBoxData.dragMode = DRAG_MODE_HEIGHT;
            cropBoxData.fixedY = cropBoxData.up;
            break;
        case BOX_LOCATION_LEFT_WALL:
            cropBoxData.dragMode = DRAG_MODE_WIDTH;
            cropBoxData.fixedX = cropBoxData.right;
            break;
        case BOX_LOCATION_RIGHT_WALL:
            cropBoxData.dragMode = DRAG_MODE_WIDTH;
            cropBoxData.fixedX = cropBoxData.left;
            break;
        case BOX_LOCATION_UPPER_LEFT_CORNER:
            cropBoxData.dragMode = DRAG_MODE_CORNER;
            cropBoxData.fixedX = cropBoxData.right;
            cropBoxData.fixedY = cropBoxData.down;
            break;
        case BOX_LOCATION_BOTTOM_RIGHT_CORNER:
            cropBoxData.dragMode = DRAG_MODE_CORNER;
            cropBoxData.fixedX = cropBoxData.left;
            cropBoxData.fixedY = cropBoxData.up;
            break;
        case BOX_LOCATION_UPPER_RIGHT_CORNER:
            cropBoxData.dragMode = DRAG_MODE_CORNER;
            cropBoxData.fixedX = cropBoxData.left;
            cropBoxData.fixedY = cropBoxData.down;
            break;
        case BOX_LOCATION_BOTTOM_LEFT_CORNER:
            cropBoxData.dragMode = DRAG_MODE_CORNER;
            cropBoxData.fixedX = cropBoxData.right;
            cropBoxData.fixedY = cropBoxData.up;
            break;
        default:
            console.log("something went wrong with location logic");
    }

}

function onMouseUp(e) {
    if (mouse.isMouseDragged) {
        mouse.isMouseDragged = false;
    }
}

function onMouseOut(e) {
    mouse.isMouseOver = false;
}

function onMouseOver (e) {
    mouse.isMouseOver = true;
}

//<Events


//>Crop Box Logic
function changeBox() {
    if (mouse.isMouseDragged == true) {
        if (cropBoxData.dragMode == DRAG_MODE_CORNER) {
            if (mouse.x < cropBoxData.fixedX) {
                cropBoxData.right = cropBoxData.fixedX;
                cropBoxData.left = mouse.x;
            } else {
                cropBoxData.left = cropBoxData.fixedX;
                cropBoxData.right = mouse.x;
            }
            if (mouse.y < cropBoxData.fixedY) {
                cropBoxData.up = mouse.y;
                cropBoxData.down = cropBoxData.fixedY;
            } else {
                cropBoxData.down = mouse.y;
                cropBoxData.up = cropBoxData.fixedY;
            }
        } else if (cropBoxData.dragMode == DRAG_MODE_TRANSLATE) {
            var xMove = mouse.x - cropBoxData.fixedX;
            xMove = Math.max(0 - cropBoxData.originalLeft, xMove);
            xMove = Math.min(canvas.width - cropBoxData.originalRight, xMove);

            var yMove = mouse.y - cropBoxData.fixedY;
            yMove = Math.max(0 - cropBoxData.originalUp, yMove);
            yMove = Math.min(canvas.height - cropBoxData.originalDown, yMove);

            cropBoxData.left = cropBoxData.originalLeft + xMove;
            cropBoxData.right = cropBoxData.originalRight + xMove;

            cropBoxData.up = cropBoxData.originalUp + yMove;
            cropBoxData.down = cropBoxData.originalDown + yMove;
        } else if (cropBoxData.dragMode == DRAG_MODE_WIDTH) {
            if (mouse.x < cropBoxData.fixedX) {
                cropBoxData.right = cropBoxData.fixedX;
                cropBoxData.left = mouse.x;
            } else {
                cropBoxData.left = cropBoxData.fixedX;
                cropBoxData.right = mouse.x;
            }
        } else if (cropBoxData.dragMode == DRAG_MODE_HEIGHT) {
            if (mouse.y < cropBoxData.fixedY) {
                cropBoxData.up = mouse.y;
                cropBoxData.down = cropBoxData.fixedY;
            } else {
                cropBoxData.down = mouse.y;
                cropBoxData.up = cropBoxData.fixedY;
            }
        } else {
            console.log("something went wrong with drag mode logic");
        }
    }
}
//<Crop Box


//>Render
function drawBox() {
    console.log("drawing box");
    ctx.beginPath();
    ctx.lineWidth = BOX_LINE_WIDTH;
    ctx.strokeStyle = BOX_COLOR;
    ctx.rect(cropBoxData.left, cropBoxData.up, (cropBoxData.right -
    cropBoxData.left),
    (cropBoxData.down - cropBoxData.up));
    ctx.stroke();
}
function drawImage() {
    var hRatio = canvas.width / image.width;
    var vRatio = canvas.height / image.height;
    var ratio  = Math.min(hRatio, vRatio);
    var centerShift_x = (canvas.width - image.width*ratio) / 2;
    var centerShift_y = (canvas.height - image.height*ratio) / 2;
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.drawImage(image, 0,0, image.width, image.height,
                      centerShift_x,centerShift_y,image.width*ratio, image.height*ratio);
}
function render() {
    drawImage();
    drawBox();
}

function drawPreview() {
    preview.width = cropBoxData.right - cropBoxData.left - 2 * BOX_LINE_WIDTH;
    preview.height = cropBoxData.down - cropBoxData.up - 2 * BOX_LINE_WIDTH;

    var previewCtx = preview.getContext("2d");

    previewCtx.drawImage(canvas, cropBoxData.left + BOX_LINE_WIDTH, cropBoxData.up +
    BOX_LINE_WIDTH, preview.width, preview.height,
    0, 0, preview.width, preview.height);
    var widthvh = Math.round(preview.width / preview.height * 100);
    var heightvw = Math.round(preview.height / preview.width * 100);
    preview.style.width = `min(100%, ${widthvh}%)`;
    preview.style.height = `min(100%, ${heightvw}%)`;
}
//<Render


function fitToContainer(canvas) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
}


