/* -*- js -*- */

/**
 * Point type start
 * @const {number}
 */
var START_POINT = 1;

/**
 * Point type turning point
 * @const {number}
 */
var TURNING_POINT = 2;


/**
 * @constructor
 */
export function Pod(terrain) {
    /**
     * The `type` is one of START_POINT or TURNING_POINT
     * The `legs` maps a point to a distance
     * @type {{number: string,
     *         type: integer,
     *         legs: Object<string, {dist: string}>
     *         }}
     */
    this.points = {};
    this.terrain = terrain;

    this._addPoints(terrain.startPoints, START_POINT);
    this._addPoints(terrain.turningPoints, TURNING_POINT);
    this._addLegs(terrain.inshoreLegs);
    this._addLegs(terrain.offshoreLegs);
};

Pod.prototype.getTerrain = function() {
    return this.terrain;
};

Pod.prototype.getPoint = function(a) {
    return this.points[a];
};

Pod.prototype.getDistance = function(a, b) {
    var x = this.points[a];
    if (x) {
        x = x.legs[b];
        if (x) {
            return x.dist;
        }
    }
    return -1; // invalid leg
};

Pod.prototype.getAddTime = function(a, b) {
    var x = this.points[a];
    if (x) {
        x = x.legs[b];
        if (x) {
            return x.addtime;
        }
    }
    return -1; // invalid leg
};

Pod.prototype.getNeighbors = function(a) {
    var x = this.points[a];
    if (x) {
        return x.legs;
    } else {
        return null;
    }
};

/**
 * Return the shortest path between two points.  If more than `maxSteps`
 * legs are needed, return null.
 *
 * Actually, this algorithm may return a path with more than
 * `maxSteps` legs, in the case where there is a path to the goal with
 * less than `maxSteps` legs, but there is a shorter path with more
 * steps.
 */
Pod.prototype.getShortestPath = function(a, b, maxSteps) {
    var visited = {};
    var candidates = {};
    candidates[a] = {dist: 0, points: []};
    var shortestPath = null;
    var found = false;
    for (var i = 0; i < maxSteps; i++) {
        found = false;
        for (var curidx in candidates) {
            if (curidx == b) {
                continue;
            }
            var cur = candidates[curidx];
            var curNeighbors = this.getNeighbors(curidx);
            for (var nkey in curNeighbors) {
                if (!(nkey in visited)) {
                    if (nkey == b) {
                        found = true;
                    }
                    var n = curNeighbors[nkey];
                    var dist = cur.dist + n.dist;
                    var p;
                    if (nkey in candidates) { // we've been here before
                        var old = candidates[nkey];
                        if (dist < old.dist) { // shorter path
                            p = cur.points.slice(0); // copy points array
                            p.push(curidx);
                            candidates[nkey] = {dist: dist, points: p};
                        }
                    } else if (shortestPath == null ||
                               dist < shortestPath.dist) {
                        p = cur.points.slice(0); // copy points array
                        p.push(curidx);
                        candidates[nkey] = {dist: dist, points: p};
                    }
                }
            }
            delete candidates[curidx];
            visited[curidx] = true;
        }
        if (found && candidates[b] &&
            (shortestPath == null || shortestPath.dist > candidates[b].dist)) {
            shortestPath = candidates[b];
            shortestPath.points.push(b);
        }
    }
    return shortestPath;
};


Pod.prototype._addPoints = function(points, type) {
    for (var i = 0; i < points.features.length; i++) {
        var feature = points.features[i];
        var p = feature.properties;
        this.points[p.number] = {name: p.name,
                                 coords: feature.geometry.coordinates,
                                 type: type,
                                 legs: {}};
    }
};

Pod.prototype._addLegs = function(legs) {
    for (var i = 0; i < legs.features.length; i++) {
        var p = legs.features[i].properties;
        var v = {dist: p.dist};
        if (p.addtime) {
            v.addtime = true;
        }
        this.points[p.src].legs[p.dst] = v;
        this.points[p.dst].legs[p.src] = v;
    }
};
