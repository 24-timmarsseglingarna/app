/* -*- js -*- */

goog.provide('tf.LogBook');

goog.require('tf');
goog.require('tf.Pod');

/**
 * Log Entry states, local property, not sent to server.
 *    'dirty'    - modified locally
 *    'sync'     - in sync with server
 *    'syncing'  - being sent to server, waiting for reply
 *    'conflict' - modified on both server and locally
 */

/**
 * @constructor
 */
tf.LogBook = function(teamData, race, log) {
    this.onLogUpdateFns = [];
    this.teamData = teamData,
    this.log = log || [];
    this.race = race;
    /* total logged distance, except invalid legs/points */
    this.sailedDist = 0;
    /* total time (in minutes) for sailing sailedDist (including interrupts) */
    this.sailedTime = 0;
    /* moment : min(logged start time, race.start_to) */
    this.startTime = null;
    /* moment */
    this.finishTime = null;
    /* total time (in minutes) for rescue interrupts (see RR 11.5)
       and 0-distances.  this time is added to sailing period. */
    this.compensationTime = 0;
    /* total time (in minutes) for distance additions due to interrupts.
       (see RR 11.5) */
    this.compensationDistTime = 0;
    /* early start in minutes */
    this.earlyStartTime = 0;
    /* late finish in minutes */
    this.lateFinishTime = 0;
    /* keep track of how many times points are rounded (max 2 allowed) */
    this.npoints = {};
    /* keep track of how many times legs are sailed (max 2 allowed) */
    this.nlegs = {};
    /* keep track of points logged (in order) */
    this.points = [];
    this.state = 'init'; // 'init' | 'started' | 'finished' | 'retired'
                         // | 'signed' | 'signed-sync'

    this._updateLog('init');
};

tf.LogBook.prototype.getLog = function() {
    return this.log;
};

tf.LogBook.prototype.getLogEntry = function(id) {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id == id) {
            return this.log[i];
        }
    }
    return null;
};

tf.LogBook.prototype.getNextLogEntry = function(id) {
    for (var i = 0; (i + 1) < this.log.length; i++) {
        if (this.log[i].id == id) {
            return this.log[i + 1];
        }
    }
    return null;
};

tf.LogBook.prototype.getRace = function() {
    return this.race;
};

tf.LogBook.prototype.hasConflict = function() {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].state == 'conflict') {
            return true;
        }
    }
    return false;
};

tf.LogBook.prototype.saveToLog = function(logEntry, id) {
    if (id != undefined) {
        // update of an existing entry, find it
        var index = undefined;
        for (var i = 0; i < this.log.length; i++) {
            if (this.log[i].id == id) {
                index = i;
            }
        }
        logEntry.id = id;
        if (this.log[index].gen) {
            // copy server-provided data to the new entry
            logEntry.gen = this.log[index].gen;
            logEntry.user = this.log[index].user;
            logEntry.client = this.log[index].client;
        }
        // delete the old entry; the new entry might have different time
        this._delLogEntryByIndex(index);
    } else {
        logEntry.id = tf.uuid();
    }
    logEntry.state = 'dirty';
    logEntry.deleted = false;

    this._addLogEntry(logEntry);
    this._updateLog('save');
};

tf.LogBook.prototype.sign = function() {
    if (this.state == 'finished' || this.state == 'retired') {
        var logEntry = {
            type: 'sign',
            time: moment()
        };
        this.saveToLog(logEntry, undefined);
        return true;
    } else {
        return false;
    }
};

tf.LogBook.prototype._addLogEntry = function(logEntry) {
    var low = 0;
    var high = this.log.length;
    while (low < high) {
        var mid = (low + high) >>> 1;
        if (this.log[mid].time.isBefore(logEntry.time)) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    this.log.splice(low, 0, logEntry);
};

tf.LogBook.prototype._delLogEntryByIndex = function(index) {
    this.log.splice(index, 1);
};

tf.LogBook.prototype._delLogEntryById = function(id) {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id == id) {
            this._delLogEntryByIndex(i);
            return;
        }
    }
};

/**
 * Internal book keeping function.  Keeps track of:
 *   total distance
 *   status of legs in the log
 *   time offset due to interruption for helping others
*/
tf.LogBook.prototype._updateLog = function(reason) {
    // distance is given with one decimal.  in order to work around
    // rounding errors, we multiply by 10 so that we can use round()
    // at the end.
    var sailedDist = 0; // D(netto)
    var sailedTime = 0;  // T(seglad)
    var earlyStartTime = 0;
    var lateFinishTime = 0;
    var compensationTime = 0;
    var compensationDistTime = 0;
    var curCompensationTime = 0;
    var curCompensationDistTime = 0;
    var prev; // last entry w/ rounded point
    var startPoint;
    var startTime;
    var finishTime;
    var startIdx = 0;
    var npoints = {};
    var nlegs = {};
    var points = [];
    var curDist;
    var pod = this.race.getPod();
    var retired = false;
    var signed = false;
    var signedSync = false;

    // find startpoint - the first log entry that has a point.
    // we currently allow _any_ point (including points not marked as
    // start points in the PoD.  If/when the PoD has correct info about
    // start points, we can validate it here.
    for (var i = 0; i < this.log.length && !startPoint; i++) {
        var e = this.log[i];
        if (e.deleted) continue;
        if (e.point) {
            var p = pod.getPoint(e.point);
            if (p) {
                startPoint = e.point;
                startTime = e.time;
                points.push({point: e.point, time: e.time});
                startIdx = i;
                prev = e;
            }
        }
    }

    if (startTime) {
        startTimes = this.race.getStartTimes();
        if (startTime.isAfter(startTimes.start_to)) {
            // too late start; count start_to as starttime (RR 6.3)
            startTime = startTimes.start_to;
        } else if (startTime.isBefore(startTimes.start_from)) {
            // too early start; add penalty
            earlyStartTime = startTimes.start_from.diff(startTime, 'minutes');
        }
    }

    // note that the first start point does not count as a round in the
    // code below

    // ignore any log items before the start point
    for (var i = (startIdx + 1); startPoint && i < this.log.length; i++) {
        var e = this.log[i];
        if (e.deleted) continue;

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
            if (e.finish) {
                finishTime = e.time;
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
            } else if (curDist == 0 &&
                       pod.getAddTime(prev.point, e.point) == true) {
                // zero-distance leg with time compensation;
                // add the time to offset, and ignore any interrupts
                compensationTime += e.time.diff(prev.time, 'minutes');
            } else {
                sailedDist += 10 * curDist;
                sailedTime += e.time.diff(prev.time, 'minutes');
                compensationTime += curCompensationTime;
                compensationDistTime += curCompensationDistTime;
            }
            // reset compensation counters
            curCompensationTime = 0;
            curCompensationDistTime = 0;
            prev = e;
        } else if (e.interrupt && e.interrupt.type != 'done') {
            // Find the corresponding log entry for interrupt done
            var found = false;
            for (var j = i + 1; !found && j < this.log.length; j++) {
                var f = this.log[j];
                if (f.deleted) continue;
                if (f.interrupt && f.interrupt.type == 'done') {
                    var interruptTime = f.time.diff(e.time, 'minutes');
                    if (e.interrupt.type == 'rescue-time') {
                        curCompensationTime += interruptTime;
                    } else if (e.interrupt.type == 'rescue-dist') {
                        curCompensationDistTime += interruptTime;
                    } // no compensation for other interrupts
                    found = true;
                } else if (f.point) {
                    // A rounding log entry before starting to sail again -
                    // error
                    e._interruptStatus = 'no-done';
                    found = true;
                } else {
                    // A new interrupt 'replaced' this one
                    found = true;
                }
            }
            // if we haven't found a 'done' entry there are two cases:
            //   1.  user is still in interrupt mode - ok
            //   2.  user has logged a point - error (detected above)
        } else if (e.type == 'retire') {
            retired = true;
        } else if (e.type == 'sign') {
            signed = true;
            if (e.state == 'sync') {
                signedSync = true;
            }
        }
    }

    this.state = 'init';
    if (startTime) {
        this.state = 'started';
    }
    if (finishTime) {
        this.state = 'finished';
    }
    if (retired) {
        this.state = 'retired';
    }
    if (signed) {
        this.state = 'signed';
    }
    if (signedSync) {
        this.state = 'signed-sync';
    }

//    if (!finishTime && prev) {
//        // treat last entry as finish ??
//        finishTime = prev.time;
//    }
    if (finishTime) {
        var raceLengthMin =
            this.race.getRaceLengthHours() * 60 + compensationTime;
        // moment's add function mutates the original object; thus copy first
        var realFinishTime = moment(startTime).add(raceLengthMin, 'minutes');
        if (finishTime.isAfter(realFinishTime)) {
            lateFinishTime = finishTime.diff(realFinishTime, 'minutes');
        }
    }

    this.sailedDist = Math.round(sailedDist) / 10;
    this.sailedTime = sailedTime;
    this.startTime = startTime;
    this.finishTime = finishTime;
    this.earlyStartTime = earlyStartTime;
    this.lateFinishTime = lateFinishTime;
    this.compensationTime = compensationTime;
    this.compensationDistTime = compensationDistTime;
    this.npoints = npoints;
    this.nlegs = nlegs;
    this.points = points;
    for (var i = 0; i < this.onLogUpdateFns.length; i++) {
        this.onLogUpdateFns[i].fn(this, reason);
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
    return this.teamData.start_point;
};

tf.LogBook.prototype.isReadOnly = function() {
    // FIXME: if signed || not Own || opted out then readonly
    if (this.state == 'signed' || this.state == 'signed-sync') {
        return true;
    }
    return false;
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
    return this.startTime;
};

tf.LogBook.prototype.hasFinished = function() {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].deleted) continue;
        if (this.log[i].finish) {
            return true;
        }
    }
    return false;
};

// includes any compensation time due to rescue interrupts
tf.LogBook.prototype.getRaceLeftMinutes = function() {
    var raceMinutes = this.getRaceLengthMinutes();
    if (this.startTime == null) {
        return raceMinutes;
    } else {
        var now = moment();
        var racedMinutes = now.diff(this.startTime, 'minutes');
        return raceMinutes - racedMinutes;
    }
};

// includes any compensation time due to rescue interrupts
tf.LogBook.prototype.getRaceLengthMinutes = function() {
    return this.race.getRaceLengthHours() * 60 + this.compensationTime;
};

tf.LogBook.prototype.getSailedDistance = function() {
    return this.sailedDist;
};

tf.LogBook.prototype.getNetDistance = function() {
    // Net distance is sailed distance / sxk-handicap
    return this.sailedDist / this.teamData.sxk_handicap;
};

// net time
tf.LogBook.prototype.getEarlyStartDistance = function() {
    // we can't calculate this properly until the race has finished
    if (this.finishTime) {
        return (2 * this.getNetDistance() * this.earlyStartTime) /
            this.getRaceLengthMinutes();
    } else {
        return 0;
    }
};

// net time
tf.LogBook.prototype.getLateFinishDistance = function() {
    // we can't calculate this properly until the race has finished
    if (this.finishTime) {
        return (2 * this.getNetDistance() * this.lateFinishTime) /
            this.getRaceLengthMinutes();
    } else {
        return 0;
    }
};

tf.LogBook.prototype.getCompensationDistance = function() {
    // we can't calculate this properly until the race has finished
    if (this.finishTime) {
        return (this.getAverageSpeed() * this.compensationDistTime) / 60;
    } else {
        return 0;
    }
};

tf.LogBook.prototype.getPlaqueDistance = function() {
    return this.getNetDistance() + this.getCompensationDistance() -
        (this.getEarlyStartDistance() + this.getLateFinishDistance());
};

tf.LogBook.prototype.getAverageSpeed = function() {
    var speed = 0;
    var time = this.sailedTime -
        (this.compensationTime + this.compensationDistTime);
    if (time > 0) {
        speed = this.sailedDist * 60 / time;
    }
    return speed;
};

tf.LogBook.prototype.getSailedTime = function() {
    return this.sailedTime;
};

tf.LogBook.prototype.getEngine = function() {
    var res = false;
    for (var i = 0; i < this.log.length; i++) {
        var e = this.log[i];
        if (e.deleted) continue;
        if (e.engine == 'on') {
            res = true;
        } else if (e.engine == 'off') {
            res = false;
        }
    }
    return res;
};

tf.LogBook.prototype.getLanterns = function() {
    var res = false;
    for (var i = 0; i < this.log.length; i++) {
        var e = this.log[i];
        if (e.deleted) continue;
        if (e.lanterns == 'on') {
            res = true;
        } else if (e.lanterns == 'off') {
            res = false;
        }
    }
    return res;
};

tf.LogBook.prototype.getInterrupt = function() {
    var res = false;
    for (var i = 0; i < this.log.length; i++) {
        var e = this.log[i];
        if (e.deleted) continue;
        if (e.interrupt == undefined) {
            continue;
        } else if (e.interrupt.type != 'done') {
            res = true;
        } else {
            res = false;
        }
    }
    return res;
};


tf.LogBook.prototype.deleteLogEntry = function(id) {
    var index = undefined;
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id == id) {
            index = i;
        }
    }
    if (index == undefined) {
        return;
    }
    if (this.log[index].gen) {
        // this entry exists on the server, mark it as deleted
        this.log[index].deleted = true;
        this.log[index].state = 'dirty';
    } else {
        // local entry, just delete it
        this.log.splice(index, 1);
    }
    this._updateLog('delete');
};

tf.LogBook.prototype.deleteAllLogEntries = function() {
    var newLog = [];
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id) { // exists on server, keep it
            this.log[i].deleted = true;
            this.log[i].state = 'dirty';
            newLog.push(this.log[i]);
        } // else local entry, just delete it
    }
    this.log = newLog;
    this._updateLog('delete');
};

tf.LogBook.prototype.updateFromServer = function(continueFn) {
    var logBook = this;
    var lastUpdate; // FIXME: keep track of this
    tf.serverData.getNewMyLog(this.teamData.id,
                              lastUpdate,
                              function(res) {
                                  if (res) {
                                      logBook._addLogFromServer(res);
                                  }
                                  continueFn();
                              });
};

// returns false if the logentry already exists
tf.LogBook.prototype.addLogEntryFromServer = function(logEntry) {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id == logEntry.id) {
            if (this.log[i].updated_at &&
                this.log[i].updated_at.isSame(logEntry.updated_at)) {
                return false;
            }
            continue;
        }
    }
    this._addLogFromServer([logEntry]);
    return true;
};


tf.LogBook.prototype._addLogFromServer = function(log) {
    var del = [];
    var add = [];
    for (var i = 0; i < log.length; i++) {
        var new_ = log[i];
        var old = null;
        for (var j = 0; j < this.log.length; j++) {
            if (this.log[j].id == new_.id) {
                old = this.log[j];
                break;
            }
        }
        if (old) {
            // this entry has been updated on server
            switch (old.state) {
            case 'sync':
                // not locally modified, just add it
                new_.state = 'sync';
                del.push(old.id);
                add.push(new_);
                break;
            case 'conflict':
            case 'dirty':
                // locally modified and modified on server!
                // we take the server's copy; it's as good a guess as
                // the other, and it leads to simpler logic.
                if (!(old.deleted && new_.deleted)) {
                    // unless both have deleted the entry we need to notify
                    // the user about this.
                    // FIXME: how to notify the user?
                    console.log('both modified log entry w/ id ' + new_.id);
                }
                new_.state = 'conflict';
                del.push(old.id);
                add.push(new_);
                break;
            case 'syncing':
                console.log('assertion failure - we should not call ' +
                            'updateFromServer when we have outstanding ' +
                            'log updates to server');
                break;
            }
        } else {
            // brand new entry, just add it
            new_.state = 'sync';
            add.push(new_);
        }
    }
    var updated = false;
    // now delete all that should be deleted
    for (var i = 0; i < del.length; i++) {
        this._delLogEntryById(del[i]);
        updated = true;
    }
    // now add all that should be added
    for (var i = 0; i < add.length; i++) {
        this._addLogEntry(add[i]);
        updated = true;
    }
    if (updated) {
        this._updateLog('syncDone');
    }
};

tf.LogBook.prototype.sendToServer = function(continueFn, updated) {
    var logBook = this;
    for (var i = 0; i < this.log.length; i++) {
        var e = this.log[i];
        if (e.state == 'dirty' && !e.gen) {
            // new log entry
            e.state = 'syncing';
            tf.serverData.postLogEntry(
                this.teamData.id, e,
                function(id, gen) {
                    if (id == null) {
                        // error; wait and try later
                        e.state = 'dirty';
                        if (updated) {
                            logBook._updateLog('syncError');
                        }
                        continueFn();
                        return;
                    } else {
                        // update ok; store id and generation id
                        e.id = id;
                        e.gen = gen;
                        e.state = 'sync';
                    }
                    // continue
                    logBook.sendToServer(continueFn, true);
                });
            return;
        } else if (e.state == 'dirty') {
            // modification of existing log entry
            var data;
            if (e.deleted) {
                data = {
                    deleted: true,
                    gen: e.gen
                };
            } else {
                data = e;
            }
            e.state = 'syncing';
            tf.serverData.patchLogEntry(
                e.id, data,
                function(res) {
                    if (res == null) {
                        // error; wait and try later
                        e.state = 'dirty';
                        if (updated) {
                            logBook._updateLog('syncError');
                        }
                        continueFn();
                        return;
                    } else if (res == 'conflict') {
                        // someone modified this entry before us; ignore
                        // and handle this in 'updateFromServer' later.
                        e.state = 'conflict';
                    } else if (e.state == 'dirty') {
                        // update ok, but modified again locally;
                        // we continue, and will then send the new
                        // entry again.  update the generation id though,
                        // so that the server accepts the new entry.
                        e.gen = res;
                    } else {
                        // update ok; store new generation id
                        e.gen = res;
                        e.state = 'sync';
                    }
                    // continue
                    logBook.sendToServer(continueFn, true);
                });
            return;
        }
    }
    // no more log entries to send
    if (updated) {
        this._updateLog('syncDone');
    }
    continueFn();
};
