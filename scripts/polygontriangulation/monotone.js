
import { Point, crossProduct } from "./geometry.js";

function monotone(vertices) {
    var triangles = [];
    var sortedVertices = getTopDownVertexOrder(vertices);
    var orientation = getOrientation(vertices, sortedVertices);
    var monotones = divideIntoYMonotone(vertices, sortedVertices, orientation);
    var ans = [];
    for (let i = 0; i < monotones.length; i++) {
        ans.push(...triangulateYMonotone(monotones[i]));
    }
    return ans;
}

function triangulateYMonotone(monotone, orientation) {
    // this is set of points
    var triangles = [];
    var middle = 0;
    var n = monotone.length;
    while (n > 3) {
        let prev = monotone[(middle - 1 + n) % n];
        let next = monotone[(middle + 1) % n];
        let curr = monotone[middle];
        if (orientation < 0 != crossProduct(prev, curr, next) > 0) {
            triangles.push([prev, curr, next]);
            monotone.splice(middle, 1);
        } else {
            middle++;
        }
        n = monotone.length;
        middle %= n;
    }
    triangles.push(monotone);
    return triangles;
}

function divideIntoYMonotone(vertices, sortedVertices, orientation) {
    // merge is angle > pi such that it faces down
    // split is same but faces up
    // merge vertext -> split vertex connects to tehm
    // or connect to end of left edge
    // note that if there is an obstruction -> this would need to be a split vertex

    // active left boundary edges keep helper(e) = lowest vertex with e as an edge
    // connect split vertex with helper(left(split))
    // it's a binary search where highest start vertex < curr vertex kinda deal
    var n = vertices.length;

    var addingEdges = [];

    // keeps track of ending vertices
    var orderedKeys = [];

    var lefts = {};
    for (let i = 0; i < sortedVertices.length; i++) {
        let v = sortedVertices[i];
        let type = typeOfVertex(vertices, v, orientation);
        var index;
        switch (type) {
            case "start":
                // adds left edge to stack
                var left = (v - orientation + n) % n;
                if (orderedKeys.length == 0) {
                    orderedKeys.push(left);
                } else {
                    index = findLessThan(vertices, orderedKeys, v, orientation);
                    // add left edge at the place one after
                    orderedKeys.splice(index + 1, 0, left);
                }
                break;
            case "merge":
                // does two things, update left edge map, and check for ending edges
                // find left edge
                // connect edge
                index = findLessThan(vertices, orderedKeys, v, orientation);
                if (index in lefts) {
                    addingEdges.push([lefts[index], v]);
                }
                lefts[orderedKeys[index]] = v;

                // Ending edge sequence
                index = orderedKeys.indexOf(v);
                if (index >= 0) {
                    if (v in lefts) {
                        addingEdges.push([lefts[v], v]);
                        delete lefts[v];
                    }
                    orderedKeys.splice(index, 1);
                }
                break;
            case "regular":
                // Ending edge sequence + adding new edge
                index = orderedKeys.indexOf(v);
                if (index >= 0) {
                    if (v in lefts) {
                        addingEdges.push([lefts[v], v]);
                        delete lefts[v];
                    }
                    var next = (v - orientation + n) % n;
                    orderedKeys[index] = next;
                }
                break;
            case "split":
                // update left edge, connect to prev left edge if there is one
                index = findLessThan(vertices, orderedKeys, v, orientation);
                if (index in lefts) {
                    addingEdges.push([lefts[index], v]);
                }
                lefts[orderedKeys[index]] = v;

                // adding edge
                var next = (v - orientation + n) % n;
                orderedKeys.splice(index + 1, 0, next);
                break;
            case "end":
                // get rid of left edge
                // has to be in keys
                if (v in lefts) {
                    // check for split above end
                    if (Math.abs(lefts[v] - v) > 1) {
                        addingEdges.push([lefts[v], v]);
                    } else {
                        addingEdges.push([lefts[v], (v + orientation + n) % n]);
                    }
                    delete lefts[v];
                }
                orderedKeys.splice(orderedKeys.indexOf(v), 1);
                break;
            default:
                console.log("Shouldn't show up something with vertex type");
                return;
        }
    }
    // monotonesFromEdgesTest(vertices, addingEdges);
    return monotonesFromEdges(vertices, addingEdges);
}

function monotonesFromEdgesTest(vertices, addingEdges) {
    // process adding edges to make monotones
    // it's like open closed () problem
    if (addingEdges.length == 0) {
        return [[...vertices]];
    }
    for (let i = 0; i < addingEdges.length; i++) {
        var edge = addingEdges[i];
        if (edge[0] > edge[1]) {
            let p = edge[1];
            edge[1] = edge[0];
            edge[0] = p;
        }
    }
    addingEdges.sort((a, b) => {
        return a[0] - b[0];
    });

    var monotones = [];
    // if opens, you need to add to prev and next
    var addingEdgesIndex = 0;
    var open = false;
    var curr = 0;
    if (addingEdges[0][0] == 0) {
        monotones.push([0]);
        monotones.push([0]);
        curr++;
        open = true;
    } else {
        monotones.push([0]);
    }
    for (let i = 1; i < vertices.length; i++) {
        monotones[curr].push(i);
        if (addingEdgesIndex < addingEdges.length && 
                open && addingEdges[addingEdgesIndex][1] == i) {
            curr--;
            open = false;
            monotones[curr].push(i);
            addingEdgesIndex++;
        }
        if (addingEdgesIndex < addingEdges.length && 
                !open && addingEdges[addingEdgesIndex][0] == i) {
            curr++;
            open = true;
            monotones.splice(curr, 0, []);
            monotones[curr].push(i);
        }
    }
    console.log(monotones);
    return monotones;
}

function monotonesFromEdges(vertices, addingEdges) {
    // process adding edges to make monotones
    // it's like open closed () problem
    if (addingEdges.length == 0) {
        return [[...vertices]];
    }
    for (let i = 0; i < addingEdges.length; i++) {
        var edge = addingEdges[i];
        if (edge[0] > edge[1]) {
            let p = edge[1];
            edge[1] = edge[0];
            edge[0] = p;
        }
    }
    addingEdges.sort((a, b) => {
        return a[0] - b[0];
    });

    var monotones = [];
    // if opens, you need to add to prev and next
    var addingEdgesIndex = 0;
    var open = false;
    var curr = 0;
    if (addingEdges[0][0] == 0) {
        monotones.push([vertices[0]]);
        monotones.push([vertices[0]]);
        curr++;
        open = true;
    } else {
        monotones.push([vertices[0]]);
    }
    for (let i = 1; i < vertices.length; i++) {
        monotones[curr].push(vertices[i]);
        if (addingEdgesIndex < addingEdges.length && 
                open && addingEdges[addingEdgesIndex][1] == i) {
            curr--;
            open = false;
            monotones[curr].push(vertices[i]);
            addingEdgesIndex++;
        }
        if (addingEdgesIndex < addingEdges.length && 
                !open && addingEdges[addingEdgesIndex][0] == i) {
            curr++;
            open = true;
            monotones.splice(curr, 0, []);
            monotones[curr].push(vertices[i]);
        }
    }
    return monotones;
}

function findLessThan(vertices, orderedKeys, targetIndex, orientation) {
    // binary search by cross Product
    // cross(target, key, next) > 0 && orientation > 0 -> left edge
    // want to find right most left edge -> if left edge -> l = mid
    // if orientation < 0 -> target key prev
    var n = vertices.length;
    let target = vertices[targetIndex].x;
    let l = 0;
    let r = orderedKeys.length - 1;
    while (l < r) {
        var mid = l + Math.floor((r - l + 1) / 2);
        var curr = orderedKeys[mid];
        if (orientation > 0) {
            var next = curr + 1 % n;
        } else {
            var next = curr - 1 + n % n;
        }
        var isLeft = crossProduct(vertices[targetIndex], vertices[curr], vertices[next]) > 0;
        if (isLeft) {
            l = mid;
        } else {
            r = mid - 1;
        }
    }
    return l;
}

function getOrientation(vertices, sortedVertices) {
    // note in a simple polygon, both prev and next can't end up at same place
    // unless n = 2;
    var n = vertices.length;
    let first = sortedVertices[0];
    let prev = vertices[(first-1+n) % n];
    let next = vertices[(first+1) % n];
    if (prev.x < next.x) {
        return 1;
    } else {
        return -1;
    }
}

function typeOfVertex(vertices, v, orientation) {
    // think I add stuff in a certain order
    // keep track of how the first vertex comes? 
    // if "left" is like for example -1, split vertices are +1
    let n = vertices.length;
    let curr = vertices[v];
    let prev = vertices[(v - 1 +  n) % n];
    let next = vertices[(v + 1) % n];
    if (prev.y < curr.y) {
        if (next.y <= curr.y) {
            if (prev.x * orientation <= next.x * orientation) {
                return "merge";
            } else {
                return "end";
            }
        } else {
            return "regular";
        }
    } else {
        if (next.y < curr.y) {
            return "regular";
        } else {
            if (prev.x * orientation < next.x * orientation) {
                return "start";
            } else {
                return "split";
            }
        }
    }
}


function getTopDownVertexOrder(vertices) {
    var vertexOrder = Array.from(vertices.keys());
    vertexOrder.sort((a, b) => {
        let va = vertices[a];
        let vb = vertices[b];
        let comp = va.y - vb.y;
        if (comp != 0) {
            return comp;
        } else {
            return va.x - vb.x;
        }
    });
    return vertexOrder;
}




export { monotone };

