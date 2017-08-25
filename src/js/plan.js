/* -*- js -*- */

goog.provide('tf.Plan');

goog.require('tf');
goog.require('tf.Pod');


/**
 * A Plan is a representation of an intended list of legs
 * to sail.
 *
 * A plan has an ordered list of entries, where each entry
 * has a point (and maybe in the future additional properties,
 * like latest planned time etc.).
 *
 * A plan can be created from scratch, or from a logbook.  If it is
 * created from a logbook, all points already logged in the logbook
 * are added to the plan.
 *
 * A plan can be attached to a logbook.  When a plan is attached to a
 * logbook, the logbook's logged points are compared with the entries
 * in the plan.  If a leg in the plan is not already logged, it is
 * treated as "planned" leg, and internally added to the `nlegs`
 * dictionary.  If a logbook is updated, the plan is also updated
 * accordingly, so that the `nlegs` dictionary is always up-to-date.
 *
 *
 * @constructor
 */
tf.Plan = function(name, pod, logbook) {
    this.pod = pod;
    this.onPlanUpdateFns = [];
    this.name = name;
    /* keep track of the first entry that is not logged */
    this.firstPlanned = -1;
    this.entries = [];
    /* keep track of how many times a leg is planned */
    this.nlegs = {};
    /* total planned distance, in 1/10 M */
    this.totalDist = 0;
    this.attachLogBook(logbook);
};

tf.Plan.prototype.onPlanUpdate = function(fn) {
    this.onPlanUpdateFns.push(fn);
};

tf.Plan.prototype.attachLogBook = function(logbook) {
    this.logbook = logbook;
    if (logbook != undefined) {
        this._resetPlan();
    }
    var self = this;
    logbook.onLogUpdate(function() {
        self._logBookChanged();
    }, 10);
};

tf.Plan.prototype.addPoint = function(point) {
    if (this.entries.length == 0) {
        // first point in plan, just add it
        var entry = {point: point, dist: 0};
        this.entries.push(entry);
    } else {
        var prev = this.entries[this.entries.length - 1].point;
        var path = this.pod.getShortestPath(prev, point, 6);
        if (!path) {
            // can't find path, ignore
            return;
        }
        // start from 1; the first point in the path is
        // always the starting point
        for (var i = 1; i < path.points.length; i++) {
            var cur = path.points[i];
            var entry = {point: cur,
                         dist: this.pod.getDistance(prev, cur)};
            this.entries.push(entry);
            prev = cur;
        }
    }
    this._updateState();
};

tf.Plan.prototype.isPointPlanned = function(point) {
    for (var i = 0; i < this.entries.length; i++) {
        if (this.entries[i].point == point) {
            return true;
        }
    }
    return false;
};

tf.Plan.prototype.getLastPoint = function() {
    if (this.entries.length > 0) {
        return this.entries[this.entries.length - 1].point;
    } else {
        return null;
    }
};

tf.Plan.prototype.delPoint = function(point) {
    if (this.entries.length == 0) {
        return false;
    }
    if (this.entries[this.entries.length-1].point == point) {
        // remove last point
        this.entries.pop();
        this._updateState();
        return true;
    }
    for (var i = this.entries.length-2; i > 1; i--) {
        if (this.entries[i].point == point) {
            var prev = this.entries[i-1].point;
            var next =  this.entries[i+1].point;
            var path = this.pod.getShortestPath(prev, next, 6);
            if (!path) {
                return false;
            }
            // keep the tail
            var tail = this.entries.splice(i+1);
            // remove point
            this.entries.pop();
            // add the new paths

            // start from 1; the first point is always the starting point
            for (var i = 1; i < path.points.length; i++) {
                var cur = path.points[i];
                var entry = {point: cur,
                             dist: this.pod.getDistance(prev, cur)};
                this.entries.push(entry);
                prev = cur;
            }
            // add the tail
            Array.prototype.push.apply(this.entries, tail);

            this._updateState();
            return true;
        }
    }

};

tf.Plan.prototype.delTail = function(point) {
    if (this.entries.length == 0) {
        return false;
    }
    for (var i = this.entries.length-2; i > 0; i--) {
        if (this.entries[i].point == point) {
            this.entries.splice(i+1, this.entries.length - i + 1);
            this._updateState();
            return;
        }
    }
};

tf.Plan.prototype.delAllPoints = function() {
    this._resetPlan();
    this._updateState(true);
};

tf.Plan.prototype.rePlan = function(oldPoint, newPoint) {
    // find the point to start re-plan from; we cannot re-plan the first
    // point so we start from 1.
    for (var i = 1; i < this.entries.length; i++) {
        if (this.entries[i].point == oldPoint) {
            var prev = this.entries[i-1].point;
            var next = null;
            if (i+1 < this.entries.length) {
                next =  this.entries[i+1].point;
            }
            var path1 = this.pod.getShortestPath(prev, newPoint, 6);
            var path2 = null;
            if (!path1) {
                return false;
            }
            if (next) {
                path2 = this.pod.getShortestPath(newPoint, next, 6);
                if (!path2) {
                    return false;
                }
            }
            // keep the tail
            var tail = this.entries.splice(i+1);
            // remove oldPoint
            this.entries.pop();
            // add the new paths

            // start from 1; the first point is always the starting point
            for (var i = 1; i < path1.points.length; i++) {
                var cur = path1.points[i];
                var entry = {point: cur,
                             dist: this.pod.getDistance(prev, cur)};
                this.entries.push(entry);
                prev = cur;
            }
            if (next) {
                for (var i = 1; i < path2.points.length; i++) {
                var cur = path2.points[i];
                    var entry = {point: cur,
                                 dist: this.pod.getDistance(prev, cur)};
                    this.entries.push(entry);
                    prev = cur;
                }
            }
            // add the tail
            Array.prototype.push.apply(this.entries, tail);

            this._updateState();
            return true;
        }
    }
    return false;
};

tf.Plan.prototype.getPlannedDistance = function() {
    return Math.round(this.totalDist) / 10;
};

tf.Plan.prototype.getPlannedSpeed = function() {
    var dist = this.totalDist / 10;
    var start = this.logbook.getStartTime();
    var raceLengthMinutes = this.logbook.race.getRaceLengthHours() * 60;
    var raceLeftMinutes = raceLengthMinutes - this.logbook.getTotalTime();

    return dist * 60 / raceLeftMinutes;
};

tf.Plan.prototype.getETA = function(point) {
    var r = [];
    for (i = 0; i < this.entries.length; i++) {
        var e = this.entries[i];
        if (e.point == point && e.eta) {
            r.push(e.eta.format('HH:mm D MMM'));
        }
    }
    return r;
};

tf.Plan.prototype.isLegPlanned = function(pointA, pointB) {
    return this.nlegs[tf.legName(pointA, pointB)];
};

tf.Plan.prototype._resetPlan = function() {
    var entry;
    this.nlegs = {};
    this.firstPlanned = -1;
    this.entries = [];
    this.totalDist = 0;
    if (this.logbook != undefined) {
        var loggedPoints = this.logbook.getPoints();
        for (var i = 0; i < loggedPoints.length; i++) {
            entry = {};
            entry.point = loggedPoints[i].point;
            this.entries.push(entry);
        }
    }
};

tf.Plan.prototype._logBookChanged = function() {
    var j;
    var loggedPoints = this.logbook.getPoints();

    // if the logbook has more entries than the plan, we'll just
    // reset the plan to match the logbook.
    if (loggedPoints.length > this.entries.length) {
        this._resetPlan();
        return;
    }
    // check if all logged points are also part of the plan;
    // the normal case is that a new point that was planned is now logged.
    for (var i = 0;
         i < loggedPoints.length && i < this.entries.length;
         i++) {
        if (loggedPoints[i].point == this.entries[i].point) {
            this.entries[i].dist = undefined;
        } else {
            // the plan doesn't match the log book, reset the plan.
            // OR possibly slice in the best path from the end of
            // logged entries to the plan start.
            this._resetPlan();
            return;
        }
    }
    this.firstPlanned = j;
    // treat rest of entries as planned legs
    for (; i < this.entries.length; i++) {
        if (i > 0 && !this.entries[i].dist) {
            var prev = this.entries[i-1].point;
            var cur = this.entries[i].point;
            this.entries[i].dist = this.pod.getDistance(prev, cur);
        }
    }

    this._updateState(false);
};

/**
 * Calculate planned ETA for each point, totalDist, and legs.
 * We can only have an ETA if we know the time of the last logged point;
 * i.e., if there is at least one logged point; i.e., if the race has
 * started.  An alternative could be to calculate ETA after first legal
 * start time in the race in this case.
 */
tf.Plan.prototype._updateState = function(informSubscribers) {
    var nlegs = {};
    var totalDist = 0;
    var j;
    for (j = 0; j < this.entries.length; j++) {
        this.entries[j].eta = undefined;
        var dist = this.entries[j].dist;
        if (dist != undefined) {
            totalDist += dist * 10;
            if (j > 0) {
                var leg = tf.legName(this.entries[j - 1].point,
                                     this.entries[j].point);
                if (!nlegs[leg]) {
                    nlegs[leg] = 1;
                } else {
                    nlegs[leg] = nlegs[leg] + 1;
                }
            }
        }
    }
    this.totalDist = totalDist;
    this.nlegs = nlegs;
    var loggedPoints = this.logbook.getPoints();
    if (loggedPoints.length > 0) {
        var time = loggedPoints[loggedPoints.length - 1].time;
        var offset;
        var planSpeed = this.getPlannedSpeed();
        for (j = this.firstPlanned; j >= 0 && j < this.entries.length; j++) {
            dist += this.entries[j].dist;
            offset = 60 * dist / planSpeed;
            // clone the moment time
            this.entries[j].eta = moment(time).add(offset, 'minutes');
        }
    }

    if (informSubscribers != false) {
        for (var i = 0; i < this.onPlanUpdateFns.length; i++) {
            this.onPlanUpdateFns[i].call(this);
        }
    }
};
