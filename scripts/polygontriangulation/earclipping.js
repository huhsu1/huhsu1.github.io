/*
Triangulation using Ear Clipping method
*/

import { Point, crossProduct } from "./geometry.js";

function earClip(vertices) {
    /*
    Expects vertices to be list of points
    */
    // Vertices are vertices of polygon in order
    // cross product positive -> convex
    // check if points in triangle
    // triple equality for reference equality
    if (vertices.length < 3) {
        console.log("Not valid");
        return null;
    }
    // shallow copy just to not mess with original input for reusability
    vertices = [...vertices];
    var triangles = [];
    var index = 0;
    while (vertices.length > 3) {
        var n = vertices.length;
        if (isEar(index, vertices)) {
            triangles.push([  vertices[(index - 1 + n) % n],
                                vertices[index],
                                vertices[(index + 1) % n]
                            ]);
            vertices.splice(index, 1);
        } else {
            index++;
        }
        index %= n;
    }
    triangles.push(vertices);
    return triangles;
}

function isEar(index, vertices) {
    // returns true if the given vertex is ear
    var n = vertices.length;
    var curr = vertices[index];
    var prev = vertices[(index - 1 + n) % n];
    var next = vertices[(index + 1) % n];
    // requires angle to be convex to be an ear
    if (crossProduct(prev, curr, next) > 0) {
        // If any point in the triangle, return false;
        for (var i = 0; i < n; i++) {
            if (Math.abs(i - index) > 1) {
                if (pointInTriangle(vertices[i], prev, curr, next)) {
                    return false;
                }
            }
        }
        return true;
    }
    return false;
}

function pointInTriangle(target, prev, curr, next) {
    var c0 = crossProduct(prev, curr, target);
    var c1 = crossProduct(curr, next, target);
    var c2 = crossProduct(next, prev, target);

    return ((c0 >= 0 && c1 >= 0 && c2 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0));
}

export { earClip }

