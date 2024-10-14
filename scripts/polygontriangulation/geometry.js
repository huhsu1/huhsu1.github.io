/*
Geometry needed for triangulations
*/

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    subtract(other) {
        if (other instanceof Point) {
            return new Point(this.x - other.x, this.y - other.y);
        }
        return null;
    }

    add(other) {
        if (other instanceof Point) {
            return new Point(this.x + other.x, this.y + other.y);
        }
        return null;
    }

    equals(other) {
        if (other instanceof Point) {
            return this.x == other.x && this.y == other.y;
        }
        return false;
    }
}

function crossProduct(prev, curr, next) {
    // expect all three to be Points
    // cross curr to prev with curr to next
    // see that when visualized? the picture is upside down
    // This is the reason for prev being p2, and next being p1
    var p2 = prev.subtract(curr);
    var p1 = next.subtract(curr);

    return (p1.x*p2.y) - (p1.y*p2.x);
}

export { Point, crossProduct };
