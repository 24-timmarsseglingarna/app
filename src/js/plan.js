/* -*- js -*- */

import {legName} from './util.js';

// TODO: save plans to localstoreage

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
export function Plan(name, pod, logbook) {
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

Plan.prototype.onPlanUpdate = function(fn) {
    this.onPlanUpdateFns.push(fn);
};

Plan.prototype.attachLogBook = function(logbook) {
    this.logbook = logbook;
    if (logbook != undefined) {
        this._resetPlan(false);
        var self = this;
        logbook.onLogUpdate(function() {
            self._logBookChanged();
        }, 10);
    }
};

Plan.prototype.addPoint = function(point) {
    var prevLength = this.entries.length;
    if (this.entries.length == 0) {
        // first point in plan, just add it
        this.entries.push({point: point, dist: 0});
    } else {
        var prev = this.entries[this.entries.length - 1].point;
        var path;
        var d = this.pod.getDistance(prev, point);
        if (d != -1) {
            // there is a direct leg between the points, use it.
            // getShortestPath might actually return a short path involving
            // more points, since some legs are 0-distances.
            path = {dist: d, points: [prev, point]};
        } else {
            path = this.pod.getShortestPath(prev, point, 6);
        }
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
    if (this.firstPlanned == -1) {
        this.firstPlanned = prevLength;
    }
    this._updateState();
};

Plan.prototype.isPointPlanned = function(point) {
    for (var i = 0; i < this.entries.length; i++) {
        if (this.entries[i].point == point) {
            return true;
        }
    }
    return false;
};

Plan.prototype.getLastPoint = function() {
    if (this.entries.length > 0) {
        return this.entries[this.entries.length - 1].point;
    } else {
        return null;
    }
};

Plan.prototype.delPoint = function(point) {
    if (this.entries.length == 0) {
        return false;
    }
    if (this.entries[this.entries.length - 1].point == point) {
        // remove last point
        this.entries.pop();
        this._updateState();
        return true;
    }
    for (var i = this.entries.length - 2; i > 1; i--) {
        if (this.entries[i].point == point) {
            var prev = this.entries[i - 1].point;
            var next = this.entries[i + 1].point;
            var path = this.pod.getShortestPath(prev, next, 6);
            if (!path) {
                return false;
            }
            // keep the tail
            var tail = this.entries.splice(i + 1);
            // remove point
            this.entries.pop();
            // add the new paths

            // start from 1; the first point is always the starting point
            for (var j = 1; j < path.points.length; j++) {
                var cur = path.points[j];
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

Plan.prototype.delTail = function(point) {
    if (this.entries.length == 0) {
        return false;
    }
    for (var i = this.entries.length - 2; i > 0; i--) {
        if (this.entries[i].point == point) {
            this.entries.splice(i + 1, this.entries.length - i + 1);
            this._updateState();
            return;
        }
    }
};

Plan.prototype.delAllPoints = function() {
    this._resetPlan(false);
    this._updateState(true);
};

Plan.prototype.rePlan = function(oldPoint, newPoint) {
    // find the point to start re-plan from; we cannot re-plan the first
    // point so we start from 1.
    for (var i = 1; i < this.entries.length; i++) {
        if (this.entries[i].point == oldPoint) {
            var prev = this.entries[i - 1].point;
            var next = null;
            if (i + 1 < this.entries.length) {
                next = this.entries[i + 1].point;
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
            var tail = this.entries.splice(i + 1);
            // remove oldPoint
            this.entries.pop();
            // add the new paths

            // start from 1; the first point is always the starting point
            var cur, entry;
            for (var j = 1; j < path1.points.length; j++) {
                cur = path1.points[j];
                entry = {point: cur,
                         dist: this.pod.getDistance(prev, cur)};
                this.entries.push(entry);
                prev = cur;
            }
            if (next) {
                for (var k = 1; k < path2.points.length; k++) {
                    cur = path2.points[k];
                    entry = {point: cur,
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

Plan.prototype.getPlannedDistance = function() {
    return Math.round(this.totalDist) / 10;
};

/**
 * Return the speed necessary to sail to finish in time.
 */
Plan.prototype.getPlannedSpeed = function() {
    if (this.logbook == undefined || this.firstPlanned < 1) {
        return -1;
    }
    var lastPlannedPoint = this.entries[this.entries.length - 1].point;
    if (this.logbook.getFinishPoint() != lastPlannedPoint) {
        return -1;
    }
    var dist = this.totalDist / 10;
    var raceLengthMinutes = this.logbook.race.getRaceLengthHours() * 60;
    var raceLeftMinutes = raceLengthMinutes - this.logbook.getSailedTime();
    var startTime = this.logbook.getRealStartTime();
    if (startTime) {
        var startTimes = this.logbook.race.getStartTimes();
        if (startTime.isAfter(startTimes.start_to)) {
            // too late start
            raceLeftMinutes -= startTime.diff(startTimes.start_to, 'minutes');
        } else if (startTime.isBefore(startTimes.start_from)) {
            // too early start
            raceLeftMinutes -= startTimes.start_from.diff(startTime, 'minutes');
        }
    }
    return dist * 60 / raceLeftMinutes;
};

Plan.prototype.getTimes = function(point) {
    var r = [];
    for (var i = 0; i < this.entries.length; i++) {
        var e = this.entries[i];
        if (e.point == point) {
            r.push({eta: e.eta, rta: e.rta});
        }
    }
    return r;
};

Plan.prototype.isLegPlanned = function(pointA, pointB) {
    return this.nlegs[legName(pointA, pointB)];
};

Plan.prototype._resetPlan = function(nomatch) {
    var entry, i;
    this.nlegs = {};
    this.firstPlanned = -1;
    this.entries = [];
    this.totalDist = 0;
    if (this.logbook != undefined) {
        var loggedPoints = this.logbook.getPoints();
        for (i = 0; i < loggedPoints.length; i++) {
            entry = {};
            entry.point = loggedPoints[i].point;
            this.entries.push(entry);
        }
    }
    if (nomatch) {
        for (i = 0; i < this.onPlanUpdateFns.length; i++) {
            this.onPlanUpdateFns[i](this, 'nomatch');
        }
    }
};

Plan.prototype._logBookChanged = function() {
    var i;
    var loggedPoints = this.logbook.getPoints();

    // if the logbook has more entries than the plan, we'll just
    // reset the plan to match the logbook.
    if (loggedPoints.length > this.entries.length) {
        this._resetPlan(false);
        return;
    }
    // check if all logged points are also part of the plan;
    // the normal case is that a new point that was planned is now logged.
    for (i = 0; i < loggedPoints.length && i < this.entries.length; i++) {
        if (loggedPoints[i].point == this.entries[i].point) {
            this.entries[i].dist = undefined;
        } else {
            // the plan doesn't match the log book, reset the plan.
            // OR possibly slice in the best path from the end of
            // logged entries to the plan start.
            this._resetPlan(true);
            return;
        }
    }
    this.firstPlanned = i;
    // treat rest of entries as planned legs
    for (; i < this.entries.length; i++) {
        if (i > 0 && !this.entries[i].dist) {
            var prev = this.entries[i - 1].point;
            var cur = this.entries[i].point;
            this.entries[i].dist = this.pod.getDistance(prev, cur);
        }
    }

    this._updateState(false);
};

/**
 * Calculate ETA (based on current average speed) and RTA (Required
 * Time of Arrival, based on required speed) for each point,
 * totalDist, and legs.  We can only have an ETA if we know the time
 * of the last logged point; i.e., if there is at least one logged
 * point; i.e., if the race has started.  An alternative could be to
 * calculate ETA after first legal start time in the race in this
 * case.
 */
Plan.prototype._updateState = function(informSubscribers) {
    var nlegs = {};
    var totalDist = 0;
    var j;
    for (j = 0; j < this.entries.length; j++) {
        this.entries[j].eta = undefined;
        this.entries[j].rta = undefined;
        var dist = this.entries[j].dist;
        if (dist != undefined) {
            totalDist += dist * 10;
            if (j > 0) {
                var leg = legName(this.entries[j - 1].point,
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
    var loggedPoints = this.logbook ? this.logbook.getPoints() : [];
    if (loggedPoints.length > 0) {
        var time = loggedPoints[loggedPoints.length - 1].time;
        var offset;
        var planSpeed = this.getPlannedSpeed();
        var avgSpeed = this.logbook.getAverageSpeed();
        var planDist = 0;
        for (j = this.firstPlanned; j >= 0 && j < this.entries.length; j++) {
            if (avgSpeed > 0) {
                planDist += this.entries[j].dist;
                offset = 60 * planDist / avgSpeed;
                // clone the moment time
                this.entries[j].eta = moment(time).add(offset, 'minutes');
            }
            if (planSpeed > 0) {
                offset = 60 * planDist / planSpeed;
                // clone the moment time
                this.entries[j].rta = moment(time).add(offset, 'minutes');
            }
        }
    }

    if (informSubscribers != false) {
        for (var i = 0; i < this.onPlanUpdateFns.length; i++) {
            this.onPlanUpdateFns[i](this, 'update');
        }
    }
};
