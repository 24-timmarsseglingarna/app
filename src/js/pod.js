/* -*- js -*- */

goog.provide('tf.Pod');

goog.require('tf');


tf.pod = {};

/**
 * Point type start
 * @const {number}
 */
tf.pod.START_POINT = 1;

/**
 * Point type turning point
 * @const {number}
 */
tf.pod.TURNING_POINT = 2;


/**
 * @constructor
 */
tf.Pod = function(spec) {
    /**
     * The `type` is one of tf.pod.START_POINT or tf.pod.TURNING_POINT
     * The `legs` maps a point to a distance
     * @type {{number: tf.Point,
     *         type: integer,
     *         legs: Object<Point, {dist: string}>
     *         }}
     */
    this.points = {};
    this.version = spec.version;
    this.spec = spec;

    this._addPoints(spec.startPoints, tf.pod.START_POINT);
    this._addPoints(spec.turningPoints, tf.pod.TURNING_POINT);
    this._addLegs(spec.inshoreLegs);
    this._addLegs(spec.offshoreLegs);
};

tf.Pod.prototype.getVersion = function() {
    return this.version;
};

tf.Pod.prototype.getSpec = function() {
    return this.spec;
};

tf.Pod.prototype.getPoint = function(a) {
    return this.points[a];
};

tf.Pod.prototype.getDistance = function(a, b) {
    var x = this.points[a];
    if (x) {
        x = x.legs[b];
        if (x) {
            return Number(x.dist);
        }
    }
    return -1; // invalid leg
};

tf.Pod.prototype._addPoints = function(points, type) {
    for (var i = 0; i < points.features.length; i++) {
        var p = points.features[i].properties;
        this.points[p.number] = {name: p.name,
                                 type: type,
                                 legs: {}};
    }
};

tf.Pod.prototype._addLegs = function(legs) {
    for (var i = 0; i < legs.features.length; i++) {
        var p = legs.features[i].properties;
        this.points[p.src].legs[p.dst] = {dist: p.dist};
        this.points[p.dst].legs[p.src] = {dist: p.dist};
    }
};
