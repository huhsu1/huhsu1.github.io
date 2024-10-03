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

export { Point };
