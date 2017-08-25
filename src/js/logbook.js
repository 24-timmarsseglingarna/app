/* -*- js -*- */

goog.provide('tf.LogBook');

goog.require('tf');
goog.require('tf.Pod');


/**
 * @constructor
 */
tf.LogBook = function(boatName, startNo, startPoint, race, log) {
    this.onLogUpdateFns = [];
    this.boatName = boatName,
    this.startNo = startNo;
    this.startPoint = startPoint;
    this.log = log || [];
    for (var i = 0; i < this.log.length; i++) {
        this.log[i].time = moment(this.log[i].time);
    }
    this.race = race;
    /* total logged distance. */
    this.totalDist = 0;
    /* total time (in minutes) for sailing totalDist.  if there
       were any interrupts, that time is excluded. */
    this.totalTime = 0;
    /* total time (in minutes) for interrupts and 0-distances. */
    this.timeOffset = 0;
    /* total time (in minutes) for distance additions due to interrupts.
       (see 11.5 in RR) */
    this.distOffset = 0;
    /* keep track of how many times points are rounded (max 2 allowed) */
    this.npoints = {};
    /* keep track of how many times legs are sailed (max 2 allowed) */
    this.nlegs = {};
    /* keep track of points logged (in order) */
    this.points = [];
    this.isSentToServer = false;
    // FIXME: need to store deleted on disk
    this.deleted = [];

    this._updateLog();
};

tf.LogBook.prototype.getLog = function() {
    return this.log;
};

tf.LogBook.prototype.saveToLog = function(logEntry, index) {
    if (index != undefined) {
        // update of an existing entry, keep id and mark it as dirty
        logEntry.id = this.log[index].id;
        logEntry.state = tf.state.LOG_DIRTY;
        // delete the old entry; the new entry might have different time
        this.log.splice(index, 1);
    } else {
        logEntry.id = tf.uuid();
        logEntry.state = tf.state.LOG_DIRTY;
    }
    var low = 0;
    var high = this.log.length;

    while (low < high) {
        var mid = (low + high) >>> 1;
        if (this.log[mid].time <= logEntry.time) low = mid + 1;
        else high = mid;
    }
    this.log.splice(low, 0, logEntry);
    //console.log(JSON.stringify(this.log));
    this._updateLog();
};

/**
 * Internal book keeping function.  Keeps track of:
 *   total distance
 *   status of legs in the log
 *   time offset due to interruption for helping others
*/
tf.LogBook.prototype._updateLog = function() {
    // distance is given with one decimal.  in order to work around
    // rounding errors, we multiply by 10 so that we can use round()
    // at the end.
    var totalDist = 0;
    var totalTime = 0;
    var timeOffset = 0;
    var distOffset = 0;
    var curTimeOffset = 0;
    var curDistOffset = 0;
    var prev; // last entry w/ rounded point
    var startPoint;
    var startIdx = 0;
    var npoints = {};
    var nlegs = {};
    var points = [];
    var curDist;
    var pod = this.race.getPod();

    // find startpoint - the first log entry that has a point.
    // we currently allow _any_ point (including points not marked as
    // start points in the PoD.  If/when the PoD has correct info about
    // start points, we can validate it here.
    for (var i = 0; i < this.log.length && !startPoint; i++) {
        e = this.log[i];
        if (e.point) {
            var p = pod.getPoint(e.point);
            if (p) {
                startPoint = e.point;
                points.push({point: e.point, time: e.time});
                startIdx = i;
                prev = e;
            }
        }
    }
    // note that the first start point does not count as a round in the
    // code below

    // ignore any log items before the start point
    for (var i = (startIdx + 1); startPoint && i < this.log.length; i++) {
        e = this.log[i];
        e._legStatus = null;
        e._invalidLeg = null;
        e._interruptStatus = null;
        if (e.point) {
            points.push({point: e.point, time: e.time});
            if (!npoints[e.point]) {
                npoints[e.point] = 0;
            }
            // unless this was the finish, count the point as rounded
            if (!e.finish) {
                npoints[e.point] = npoints[e.point] + 1;
            }
            var leg = tf.legName(e.point, prev.point);
            if (!nlegs[leg]) {
                nlegs[leg] = 1;
            } else {
                nlegs[leg] = nlegs[leg] + 1;
            }
            var curDist = pod.getDistance(prev.point, e.point);
            if (npoints[e.point] > 2) {
                // invalid (7.3, 13.1.3) don't count this distance
                e._legStatus = 'invalid-round';
            } else if (nlegs[leg] > 2) {
                // invalid (7.5, 13.1.2) don't count this distance
                e._legStatus = 'invalid-leg';
                e._invalidLeg = leg;
            } else if (curDist == -1) {
                // this is not a correct leg; simply don't count it
                e._legStatus = 'no-leg';
                e._invalidLeg = prev.point;
            } else if (curDist == 0) {
                // zero-distance leg; add the time to offset, and
                // ignore any interrupts
                timeOffset += e.time.diff(prev.time, 'minutes');
            } else {
                totalDist += 10 * curDist;
                totalTime += e.time.diff(prev.time, 'minutes') - curTimeOffset;
                timeOffset += curTimeOffset;
                distOffset += curDistOffset;
            }
            // reset offsets
            curTimeOffset = 0;
            curDistOffset = 0;
            prev = e;
        } else if (e.interrupt.type != 'none' && e.interrupt.type != 'done') {
            // Find the corresponding log entry for interrupt done
            var found = false;
            for (var j = i+1; !found && j < this.log.length; j++) {
                var f = this.log[j];
                if (f.interrupt.type == 'done') {
                    var interrupttime = f.time.diff(e.time, 'minutes');
                    if (e.interrupt.type == 'rescue-dist') {
                        curDistOffset += interrupttime;
                    } else {
                        curTimeOffset += interrupttime;
                    }
                    found = true;
                } else if (f.point) {
                    // A rounding log entry before starting to sail again -
                    // error
                    e._interruptStatus = 'no-done'
                    found = true;
                } else if (f.interrupt.type != 'none') {
                    // A new interrupt 'replaced' this one
                    found = true;
                }
            }
            // if we haven't found a 'done' entry there are two cases:
            //   1.  user is still in interrupt mode - ok
            //   2.  user has logged a point - error (detected above)
        }
    }
    this.totalDist = Math.round(totalDist) / 10;
    this.totalTime = totalTime;
    this.timeOffset = timeOffset;
    this.distOffset = distOffset;
    this.npoints = npoints;
    this.nlegs = nlegs;
    this.points = points;
    for (var i = 0; i < this.onLogUpdateFns.length; i++) {
        this.onLogUpdateFns[i].fn(this);
    }
};

tf.LogBook.prototype.onLogUpdate = function(fn, prio) {
    this.onLogUpdateFns.push({fn: fn, prio: prio});
    this.onLogUpdateFns.sort(function(a, b) { return a.prio - b.prio });
};

/**
 * Get number of times a point has been rounded (logged).
 *
 * @param {tf.Point} point - the name of a point
 * @return {?number}
 */
tf.LogBook.prototype.getPointRounds = function(point) {
    return this.npoints[point];
};

tf.LogBook.prototype.getPoints = function() {
    return this.points;
};

tf.LogBook.prototype.getLastPoint = function() {
    if (this.points.length > 0) {
        return this.points[this.points.length - 1].point;
    } else {
        return null;
    }
};

tf.LogBook.prototype.getStartPoint = function() {
    return this.startPoint;
};

/**
 * Get number of times a leg has been sailed (logged).
 *
 * @param {tf.Point} pointA - the name of a point
 * @param {tf.Point} pointB - the name of a point
 * @return {?number}
 */
tf.LogBook.prototype.getLegSailed = function(pointA, pointB) {
    return this.nlegs[tf.legName(pointA, pointB)];
};

tf.LogBook.prototype.getStartTime = function() {
    // time of the first logged point
    for (var i = 0; i < this.log.length; i++) {
        e = this.log[i];
        if (e.point) {
            return e.time;
        }
    }
    return null;
};

tf.LogBook.prototype.hasFinished = function() {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].finish) {
            return true;
        }
    }
    return false;
};

tf.LogBook.prototype.getRaceLeftMinutes = function() {
    var start = this.getStartTime();
    var raceLengthMinutes = this.race.getRaceLengthHours() * 60;
    if (start == null) {
        return raceLengthMinutes;
    } else {
        var timeoffset = this.getTimeOffset();
        var now = moment();
        var racedMinutes = now.diff(start, 'minutes') - timeoffset;
        return raceLengthMinutes - racedMinutes;
    }
};

tf.LogBook.prototype.getTotalDistance = function() {
    return this.totalDist;
};

tf.LogBook.prototype.getSailedDistance = function() {
    // sailed distance is total dist + (speed * distOffset)
    var speed = this.getAverageSpeed();
    return this.totalDist + (speed * this.distOffset / 60);
};

tf.LogBook.prototype.getAverageSpeed = function() {
    var speed = 0;
    if (this.totalTime > 0) {
        speed = this.totalDist * 60 / this.totalTime;
    }
    return speed;
};

tf.LogBook.prototype.getTotalTime = function() {
    return this.totalTime;
};

tf.LogBook.prototype.getTimeOffset = function() {
    return this.timeOffset;
};

tf.LogBook.prototype.getDistOffset = function() {
    return this.distOffset;
};

tf.LogBook.prototype.deleteLogEntry = function(index) {
    this.deleted.push(this.log[index].id);
    this.log.splice(index, 1);
    this._updateLog();
};

tf.LogBook.prototype.deleteAllLogEntries = function() {
    for (var i = 0; i < this.log.length; i++) {
        this.deleted.push(this.log[i].id);
    }
    this.log = [];
    this._updateLog();
}
