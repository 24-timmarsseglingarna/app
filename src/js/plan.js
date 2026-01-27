/* -*- js -*- */

import moment from 'moment';
import {legName} from './util.js';

function Entry(point, dist = undefined) {
    this.point = point;
    this.dist = dist;
    // Estimated Time of Arrival - calculated property based on average speed and this.plannedSpeed
    // If no average speed exists, eta is undefined.
    this.eta = undefined;
    // Required Time of Arrival - calculated property based on this.rs
    this.rta = undefined;
    // Planned speed - user-configured property
    this.plannedSpeed = undefined;
    // Required speed - calculated property
    // If plannedSpeed is set, rs is equal to plannedSpeed
    this.rs = undefined;
};

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
export function Plan(name, pod, logbook, entries = [], period, startTime) {
    this.pod = pod;
    this.onPlanUpdateFns = [];
    this.name = name;
    /* keep track of the first entry that is not logged */
    this.firstPlanned = -1;
    this.entries = entries; // [ Entry() ]
    this.period = period;
    this.startTime = startTime;
    /* keep track of how many times a leg is planned */
    this.nlegs = {};
    /* total planned distance, in 1/10 M */
    this.totalDist = 0;
    this.attachLogBook(logbook);
    this.avgSpeed = undefined;
    this.reqSpeed = undefined;
    this._updateState(false);
};

Plan.prototype.onPlanUpdate = function(fn) {
    this.onPlanUpdateFns.push(fn);
};

Plan.prototype.attachLogBook = function(logbook) {
    if (this.logbook == logbook) {
        return;
    }
    this.logbook = logbook;
    if (logbook != undefined) {
        this.pod = logbook.getRace().getPod();
        this._podChanged();
        this._logBookChanged();
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
        this.entries.push(new Entry(point, 0));
    } else {
        var prev = this.entries[this.entries.length - 1].point;
        var path;
        var d = this.pod.getDistance(prev, point);
        if (d != -1) {
            // there is a direct leg between the points, use it.
            // getShortestPath might actually return a shorter path involving
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
            var entry = new Entry(cur, this.pod.getDistance(prev, cur));
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

Plan.prototype.setPlannedSpeed = function(idx, plannedSpeed) {
    if (idx <= 0 || idx >= this.entries.length) {
        return;
    }
    if (plannedSpeed == undefined) {
        delete this.entries[idx].plannedSpeed;
    } else {
        this.entries[idx].plannedSpeed = plannedSpeed;
    }
    this._updateState(false);
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
    for (var i = this.entries.length - 2; i > 0; i--) {
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
            // remove next point from tail - it is the first element
            // it is also present in path so it will be re-added below
            tail.splice(0, 1);

            // add the new path
            // start from 1; the first point is same as `prev`
            for (var j = 1; j < path.points.length; j++) {
                var cur = path.points[j];
                var entry = new Entry(cur, this.pod.getDistance(prev, cur));
                this.entries.push(entry);
                prev = cur;
            }
            // add the tail
            this.entries = this.entries.concat(tail);
            // this.entries.push(...tail);
            // Array.prototype.push.apply(this.entries, tail);

            this._updateState();
            return true;
        }
    }
};

Plan.prototype.setPeriod = function(period) {
    this.period = period;
    this._updateState(true);
};

Plan.prototype.setStartTime = function(startTime) {
    this.startTime = startTime;
    this._updateState(true);
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
            // remove first entry in tail (if there is one)
            // it is also present in `path2` so it will be re-added below
            tail.splice(0, 1);

            // add the new paths
            // start from 1; the first point is always the starting point
            var cur, entry;
            for (var j = 1; j < path1.points.length; j++) {
                cur = path1.points[j];
                entry = new Entry(cur, this.pod.getDistance(prev, cur));
                this.entries.push(entry);
                prev = cur;
            }
            if (next) {
                for (var k = 1; k < path2.points.length; k++) {
                    cur = path2.points[k];
                    entry = new Entry(cur, this.pod.getDistance(prev, cur));
                    this.entries.push(entry);
                    prev = cur;
                }
            }
            // add the tail
            this.entries = this.entries.concat(tail);
            // this.entries.push(...tail);
            // Array.prototype.push.apply(this.entries, tail);

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
Plan.prototype.getRequiredSpeed = function() {
    if (this._getStartTime() == undefined) {
        return -1;
    }
    if (this.logbook && this.firstPlanned > 0) {
        var lastPlannedPoint = this.entries[this.entries.length - 1].point;
        if (this.logbook.getFinishPoint() != lastPlannedPoint) {
            return -1;
        }
    }
    // totalDist is in 1/10 M
    return this.totalDist * 6 / this.getRaceLeftMinutes();
};

Plan.prototype.getRaceLeftMinutes = function() {
    var raceLengthHours = this._getRaceLengthHours();
    if (raceLengthHours == undefined) {
        return undefined;
    }
    var raceLengthMinutes =  raceLengthHours * 60;
    var raceLeftMinutes = raceLengthMinutes - this._getSailedTime();
    var startTime = this._getStartTime();
    if (startTime && this.logbook) {
        var startTimes = this.logbook.race.getStartTimes();
        if (startTime.isAfter(startTimes.start_to)) {
            // too late start
            raceLeftMinutes -= startTime.diff(startTimes.start_to, 'minutes');
        } else if (startTime.isBefore(startTimes.start_from)) {
            // too early start
            raceLeftMinutes -= startTimes.start_from.diff(startTime, 'minutes');
        }
    }
    return raceLeftMinutes;
};

Plan.prototype.getPlannedRoundings = function(point) {
    var r = [];
    var dist = 0;
    var totalDist = 0;
    for (var j = this.firstPlanned; j >= 0 && j < this.entries.length; j++) {
        if (this.entries[j].dist != undefined) {
            totalDist += this.entries[j].dist;
        }
    }
    for (var i = this.firstPlanned; i >= 0 && i < this.entries.length; i++) {
        var e = this.entries[i];
        if (e.dist != undefined) {
            dist += e.dist;
        }
        if (e.point == point) {
            r.push({eta: e.eta,
                    rta: e.rta,
                    distToPoint: dist,
                    distToEnd: totalDist - dist,
                    plannedSpeed: e.plannedSpeed});
        }
    }
    return r;
};

Plan.prototype.isLegPlanned = function(pointA, pointB) {
    return this.nlegs[legName(pointA, pointB)] != undefined;
};


Plan.prototype._getRaceLengthHours = function() {
    if (this.logbook) {
        return this.logbook.race.getRaceLengthHours();
    }
    if (this.period) {
        return this.period;
    }
    return undefined;
};

Plan.prototype._getStartTime = function() {
    var r;
    if (this.logbook) {
        r = this.logbook.getRealStartTime();
        if (r) {
            return r;
        }
        if (this.logbook.getRace()) {
            r = this.logbook.getRace().getStartTimes().start_from;
            if (r) {
                return r;
            }
        }
    }
    if (this.startTime) {
        return this.startTime;
    }
    return undefined;
};

Plan.prototype._getSailedTime = function() {
    if (this.logbook) {
        return this.logbook.getSailedTime();
    } else {
        return 0;
    }
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
            entry = new Entry(loggedPoints[i].point);
            this.entries.push(entry);
        }
    }
    if (nomatch) {
        for (i = 0; i < this.onPlanUpdateFns.length; i++) {
            this.onPlanUpdateFns[i](this, 'nomatch');
        }
    }
};

Plan.prototype._podChanged = function() {
    var prev = this.entries[0];
    for (var i = 1; i < this.entries.length; i++) {
        var d = this.pod.getDistance(prev.point, this.entries[i].point);
        if (d == -1) {
            // this planned leg doesn't exist anymore; truncate the plan
            this.entries.splice(i, this.entries.length - i);
            break;
        }
        this.entries[i].dist = d;
        prev = this.entries[i];
    }
    this._updateState();
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
        this.entries[j].rs = undefined;
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
    var time = this._getStartTime();
    if (loggedPoints.length > 0) {
        time = loggedPoints[loggedPoints.length - 1].time;
    }
    if (time) {
        this.reqSpeed = this.getRequiredSpeed();
        this.avgSpeed = this.logbook? this.logbook.getAverageSpeed() : -1;
        var unhandledDist = 0;
        var handledMinutes = 0;
        for (j = this.firstPlanned; j >= 0 && j < this.entries.length; j++) {
            if (this.entries[j].plannedSpeed == undefined) {
                unhandledDist += this.entries[j].dist;
            } else {
                handledMinutes += 60 * this.entries[j].dist / this.entries[j].plannedSpeed;
            }
        }
        var minutesToEnd = this.getRaceLeftMinutes();
        var reqSpeed = undefined;
        if (minutesToEnd != undefined) {
            reqSpeed = 60 * unhandledDist / (minutesToEnd - handledMinutes);
        }
        var doEta = false;
        var doRta = false;
        if (this.avgSpeed > 0) {
            doEta = true;
        }
        if (this.reqSpeed > 0 && reqSpeed != undefined) {
            doRta = true;
        }
        var eta = moment(time);
        var rta = moment(time);
        var distMinutes;
        for (j = this.firstPlanned; j >= 0 && j < this.entries.length; j++) {
            if (doEta) {
                if (this.entries[j].plannedSpeed != undefined) {
                    distMinutes = 60 * this.entries[j].dist / this.entries[j].plannedSpeed;
                } else {
                    distMinutes = 60 * this.entries[j].dist / this.avgSpeed;
                }
                eta = moment(eta).add(distMinutes, 'minutes');
                this.entries[j].eta = eta;
            }
            if (doRta) {
                if (this.entries[j].plannedSpeed != undefined) {
                    this.entries[j].rs = this.entries[j].plannedSpeed;
                } else if (reqSpeed > 0) {
                    this.entries[j].rs = reqSpeed;
                } else {
                    // will not finish in time
                }
                if (this.entries[j].rs) {
                    distMinutes = 60 * this.entries[j].dist / this.entries[j].rs;
                    rta = moment(rta).add(distMinutes, 'minutes');
                    this.entries[j].rta = rta;
                }
            }
        }
    }

    if (informSubscribers != false) {
        this._informSubscribers();
    }
};

Plan.prototype._informSubscribers = function() {
    for (var i = 0; i < this.onPlanUpdateFns.length; i++) {
        this.onPlanUpdateFns[i](this, 'update');
    }
};
