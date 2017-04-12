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
    this._isValid = true;
    /* keep track of the first entry that is not logged */
    this.firstPlanned = -1;
    this.entries = [];
    /* keep track of how many times a leg is planned */
    this.nlegs = {};
    /* total planned distance, in 1/10 M */
    this.totalDist = 0;
    if (logbook != undefined) {
        var entry;
        var loggedPoints = logbook.getPoints();
        for (var i = 0; i < loggedPoints.length; i++) {
            entry = {};
            entry.point = loggedPoints[i].point;
            this.entries.push(entry);
        }
    }
};

tf.Plan.prototype.onPlanUpdate = function(fn) {
    this.onPlanUpdateFns.push(fn);
};

tf.Plan.prototype.attachLogBook = function(logbook) {
    this.logbook = logbook;
    var self = this;
    self._logBookChanged();
    logbook.onLogUpdate(function() {
        self._logBookChanged();
    }, 10);
};

tf.Plan.prototype.addPoint = function(point) {
    var entry = {};
    entry.point = point;
    if (this.entries.length > 0) {
        if (this.entries[this.entries.length - 1].point == point) {
            // user tried to plan same point twice; ignore
            return;
        }
        var prev = this.entries[this.entries.length - 1].point;
        var leg = tf.legName(point, prev);
        var dist = this.pod.getDistance(prev, point);
        if (dist == -1) {
            // invalid leg; ignore
            return;
        }
        entry.dist = dist;
        this.totalDist += dist * 10;
        if (!this.nlegs[leg]) {
            this.nlegs[leg] = 0;
        }
        this.nlegs[leg] = this.nlegs[leg] + 1;
        for (var i = 0; i < this.onPlanUpdateFns.length; i++) {
            this.onPlanUpdateFns[i].call(this);
        }
    }
    this.entries.push(entry);
    this._updateETA();
};

tf.Plan.prototype.getTotalDistance = function() {
    return Math.round(this.totalDist) / 10;
};

tf.Plan.prototype.isValid = function() {
    return this._isValid;
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

tf.Plan.prototype.getLegPlanned = function(pointA, pointB) {
    return this.nlegs[tf.legName(pointA, pointB)];
};

tf.Plan.prototype._logBookChanged = function() {
    var j;
    var nlegs = {};
    var match = true;
    var totalDist = 0;
    var loggedPoints = this.logbook.getPoints();

    j = 0;
    for (var i = 0;
         match && i < loggedPoints.length && j < this.entries.length;
         i++) {
        if (loggedPoints[i].point == this.entries[j].point) {
            j++;
        } else {
            match = false;
        }
    }
    // treat rest of entries as planned legs
    if (i == 0 && this.entries.length > 0) {
        // nothing in logbook but planned entries; entire plan is valid
        j = 1;
    }
    this.firstPlanned = j;
    for (; j > 0 && j < this.entries.length; j++) {
        var leg = tf.legName(this.entries[j - 1].point, this.entries[j].point);
        var dist = this.entries[j].dist;

        totalDist += dist * 10;
        if (!nlegs[leg]) {
            nlegs[leg] = 1;
        } else {
            nlegs[leg] = nlegs[leg] + 1;
        }
    }
    this.totalDist = totalDist;
    this.nlegs = nlegs;
    if (!match) {
        // the plan doesn't match the log book; entire plan is invalid
        this.firstPlanned = -1;
        this._isValid = false;
        return;
    }
    this._isValid = true;

    this._updateETA();
};

/**
 * Calculate planned ETA for each point.
 * We can only have an ETA if we know the time of the last logged point;
 * i.e., if there is at least one logged point; i.e., if the race has
 * started.  An alternative could be to calculate ETA after first legal
 * start time in the race in this case.
 */
tf.Plan.prototype._updateETA = function() {
    var j;
    var dist = 0;
    for (j = 0; j < this.entries.length; j++) {
        this.entries[j].eta = undefined;
    }
    var loggedPoints = this.logbook.getPoints();
    if (loggedPoints.length > 0) {
        var time = loggedPoints[loggedPoints.length - 1].time;
        var offset;
        var planSpeed = this.getPlannedSpeed();
        for (j = this.firstPlanned; j > 0 && j < this.entries.length; j++) {
            dist += this.entries[j].dist;
            offset = 60 * dist / planSpeed;
            // clone the moment time
            this.entries[j].eta = moment(time).add(offset, 'minutes');
        }
    }
};
