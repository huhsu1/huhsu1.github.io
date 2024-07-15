const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
ctx.font = "15px Verdana";

const squareSize = 20;
const sideSize = 3;
const mineRatio = .1;
const xTileLetterOffset = 2;
const yTileLetterOffset = 14;
const xFloorLetterOffset = 7;
const yFloorLetterOffset = 17;


const height = Math.floor(canvas.height / squareSize);
const width = Math.floor(canvas.width / squareSize);

class Game {
    #height;
    #width;
    #revealedBoard;
    #answerBoard;

    #mineCount;
    #unRevealedTiles;

    #gameState;

    constructor(height, width) {
        this.#gameState = "running";
        // init board
        this.#height = height;
        this.#width = width;

        this.#revealedBoard = new Array(this.#height);
        this.#answerBoard = new Array(this.#height);
        for (let i = 0; i < this.#height; i++) {
            this.#revealedBoard[i] = new Array(this.#width);
            this.#answerBoard[i] = new Array(this.#width);
            for (let j = 0; j < this.#width; j++) {
                this.#revealedBoard[i][j] = false;
                this.#answerBoard[i][j] = 0;
            }
        }

        // init mines
        this.#unRevealedTiles = this.#height * this.#width;
        this.#mineCount = Math.floor(this.#unRevealedTiles * mineRatio);
        for (let i = 0; i < this.#mineCount; i++) {
            var randomTile = Math.floor(Math.random() * this.#unRevealedTiles);
            var y = Math.floor(randomTile / this.#width);
            var x = randomTile % this.#width;
            while (this.#answerBoard[y][x] == "mine") {
                randomTile = Math.floor(Math.random() * this.#unRevealedTiles);
                y = Math.floor(randomTile / this.#width);
                x = randomTile % this.#width;
            }
            this.#answerBoard[y][x] = "mine";

            var surrounding = this.#getSurroundingTiles(y, x);
            for (let j = 0; j < surrounding.length; j++) {
                var yi = surrounding[j][0];
                var xi = surrounding[j][1];
                if (this.#answerBoard[yi][xi] != "mine") {
                    this.#answerBoard[yi][xi]++;
                }
            }
        }
    }

    click(y, x) {
        if (this.#gameState != "running") {
            return;
        }
        if (this.#revealedBoard[y][x] == true) {
            return;
        }
        if (this.#revealedBoard[y][x] == "flag") {
            return;
        }

        // reveal board
        this.#revealedBoard[y][x] = true;
        this.#unRevealedTiles--;
        if (this.#answerBoard[y][x] == "mine") {
            this.#gameState = "lose";
            return;
        }

        // if 0 no surrounding. auto click surrounding
        if (this.#answerBoard[y][x] == 0) {
            var surrounding = this.#getSurroundingTiles(y, x);
            for (let j = 0; j < surrounding.length; j++) {
                this.click(surrounding[j][0], surrounding[j][1]);
            }
        }

        if (this.#unRevealedTiles == this.#mineCount) {
            this.#gameState = "win";
        }
    }

    flag(y, x) {
        if (this.#gameState != "running") {
            return;
        }
        if (this.#revealedBoard[y][x] == true) {
            return;
        }
        if (this.#revealedBoard[y][x] == "flag") {
            this.#revealedBoard[y][x] = false;
        } else {
            this.#revealedBoard[y][x] = "flag";
        }
    }

    get(y, x) {
        if (this.#gameState == "running") {
            if (this.#revealedBoard[y][x] == false) {
                return "tile";
            } else if (this.#revealedBoard[y][x] == "flag") {
                return "flag";
            } else {
                return this.#answerBoard[y][x];
            }
        } else if (this.#gameState == "lose") {
            if (this.#answerBoard[y][x] == "mine") {
                if (this.#revealedBoard[y][x] == false) {
                    return "mine";
                } else {
                    return "losemine";
                }
            }
            if (this.#revealedBoard[y][x] == false) {
                return "tile";
            } else if (this.#revealedBoard[y][x] == "flag") {
                return "flag";
            } else {
                return this.#answerBoard[y][x];
            }
        }
    }

    isWin() {
        return this.#gameState == "win";
    }

    #getSurroundingTiles(y, x) {
        var ans = new Array(0);
        for (let yi = y-1; yi <= y+1; yi++) {
            if (yi < 0 || yi >= this.#height) {
                continue;
            }
            for (let xi = x-1; xi <= x+1; xi++) {
                if (xi < 0 || xi >= this.#width) {
                    continue;
                }
                ans.push([yi, xi]);
            }
        }
        return ans;
    }
}


//>rendering
const tileDark = "dimgrey";
const tileLight = "gainsboro";
const colors = { 1:"darkturquoise", 2:"forestgreen", 3:"red", 4:"indigo", 5:"lightcoral", 6:"hotpink",
7:"darkkhaki", 8:"brown", "F":"orange", "M":"black" };

function drawBoard(game) {
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            var item = game.get(y, x);
            drawSquare(y, x, item);
        }
    }
}
function drawSquare(y, x, item) {
    switch (item) {
        case "tile":
            drawTile(y, x);
            break;
        case "flag":
            drawTile(y, x);
            writeTileLetter(y, x, "F");
            break;
        case 0:
            drawFloor(y, x);
            break;
        case "mine":
            drawTile(y, x);
            writeTileLetter(y, x, "M");
            break;
        case "losemine":
            drawFloor(y, x);
            writeFloorLetter(y, x, "M");
            break;
        default:
            drawFloor(y, x);
            writeFloorLetter(y, x, item);
    }
}

function writeTileLetter(y, x, letter) {
    ctx.fillStyle = colors[letter];
    ctx.fillText(letter, x * squareSize + xTileLetterOffset, y * squareSize +
    yTileLetterOffset);
}

function writeFloorLetter(y, x, letter) {
    ctx.fillStyle = colors[letter];
    ctx.fillText(letter, x * squareSize + xFloorLetterOffset, y * squareSize +
    yFloorLetterOffset);
}

function drawTile(y, x) {
    ctx.fillStyle = tileDark;
    ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
    ctx.fillStyle = tileLight;
    ctx.fillRect(x * squareSize, y * squareSize, squareSize - sideSize, squareSize -
    sideSize);
}

function drawFloor(y, x) {
    ctx.fillStyle = tileDark;
    ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
    ctx.fillStyle = tileLight;
    ctx.fillRect(x * squareSize + sideSize, y * squareSize + sideSize, squareSize - sideSize, squareSize -
    sideSize);
}

function writeWin() {
    ctx.fillStyle = "yellow";
    ctx.font = "160px Verdana";
    ctx.fillText("WIN", 20, 250);
}
//<rendering
//>eventHandler
function clickHandler(e, game) {
    var y = Math.floor(e.offsetY / squareSize);
    var x = Math.floor(e.offsetX / squareSize);
    console.log(y, x);
    game.click(y, x);
    drawBoard(game);
    if (game.isWin()) {
        writeWin();
    }
}
function rightClickHandler(e, game) {
    e.preventDefault();
    var y = Math.floor(e.offsetY / squareSize);
    var x = Math.floor(e.offsetX / squareSize);
    console.log(y, x);
    game.flag(y, x);
    drawBoard(game);
    if (game.isWin()) {
        writeWin();
    }
    return false;
}
//<

//>main
var gameInstance = new Game(height, width);
canvas.addEventListener('click', function(event) {clickHandler(event, gameInstance)});
canvas.addEventListener('contextmenu', function(event) {rightClickHandler(event,
gameInstance)}, false);

drawBoard(gameInstance);
//<main

