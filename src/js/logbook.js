/* -*- js -*- */

import {uuid, legName} from './util.js';
import {getTeamLogP, postLogEntryP, patchLogEntryP} from './serverdata.js';
import {dbg, debugInfo} from './debug.js';

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
export function LogBook(teamData, race, log, readOnly) {
    this.onLogUpdateFns = [];
    this.teamData = teamData,
    this.log = log || [];
    this.race = race;
    this.readOnly = readOnly;
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
    /* (net) distance added by administrator */
    this.adminDist = 0;
    /* keep track of how many times points are rounded (max 2 allowed) */
    this.npoints = {};
    /* keep track of how many times legs are sailed (max 2 allowed) */
    this.nlegs = {};
    /* keep track of points logged (in order) */
    this.points = [];
    this.state = 'init'; // 'init' | 'started'
                         // | 'finished' | 'finished-early' | 'dns' | 'dnf'
    this.admin_state = 'ok'; // 'ok' | 'dsq'
    this.signed = false; // | 'signed' | 'signed-sync'

    this.lastServerUpdate = null;
    this.isUpdatedFromServer = false;
    this._updateLog('init');
};

LogBook.prototype.getLog = function() {
    return this.log;
};

LogBook.prototype.getLogEntry = function(id) {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id == id || this.log[i].oldid == id) {
            return this.log[i];
        }
    }
    return null;
};

LogBook.prototype.getNextLogEntry = function(id) {
    for (var i = 0; (i + 1) < this.log.length; i++) {
        if (this.log[i].id == id || this.log[i].oldid == id) {
            return this.log[i + 1];
        }
    }
    return null;
};

LogBook.prototype.getLastLogEntry = function() {
    for (var i = this.log.length - 1; i >= 0; i--) {
        if (!(this.log[i].deleted == true)) {
            return this.log[i];
        }
    }
    return null;
};
LogBook.prototype.getRace = function() {
    return this.race;
};

LogBook.prototype.hasConflict = function() {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].state == 'conflict') {
            return true;
        }
    }
    return false;
};

LogBook.prototype.saveToLog = function(logEntry, id) {
    if (id != undefined) {
        // update of an existing entry, find it
        var index = undefined;
        for (var i = 0; i < this.log.length; i++) {
            if (this.log[i].id == id || this.log[i].oldid == id) {
                index = i;
            }
        }
        logEntry.id = this.log[index].id;
        if (this.log[index].gen) {
            // copy server-provided data to the new entry
            logEntry.gen = this.log[index].gen;
            logEntry.user = this.log[index].user;
            logEntry.client = this.log[index].client;
        }
        // delete the old entry; the new entry might have different time
        this._delLogEntryByIndex(index);
    } else {
        logEntry.id = uuid();
    }
    logEntry.state = 'dirty';
    logEntry.deleted = false;

    this._addLogEntry(logEntry);
    this._updateLog('save');
};

LogBook.prototype.sign = function() {
    if (this.state == 'finished' ||
        this.state == 'finished-early' ||
        this.state == 'dns' ||
        this.state == 'dnf') {
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

LogBook.prototype._addLogEntry = function(logEntry) {
    if (logEntry.type == 'sign') {
        // alwyas put 'sign' at the end
        this.log.push(logEntry);
    } else {
        var low = 0;
        var high = this.log.length;
        while (low < high) {
            var mid = (low + high) >>> 1;
            if (!this.log[mid].time.isAfter(logEntry.time)) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        this.log.splice(low, 0, logEntry);
    }
};

LogBook.prototype._delLogEntryByIndex = function(index) {
    this.log.splice(index, 1);
};

LogBook.prototype._delLogEntryById = function(id) {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id == id || this.log[i].oldid == id) {
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
LogBook.prototype._updateLog = function(reason) {
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
    var realStartTime;
    var finishTime;
    var earlyFinish = false;
    var npoints = {};
    var nlegs = {};
    var points = [];
    var curDist;
    var pod = this.race.getPod();
    var retired = false;
    var i, e;
    var dsq = false;
    var adminDist = 0;
    var adminTime = 0;
    var start_i = -1;

    // find startpoint - the first log entry that has a point.
    // we currently allow _any_ point (including points not marked as
    // start points in the PoD.  If/when the PoD has correct info about
    // start points, we can validate it here.
    for (i = 0; i < this.log.length && !startPoint; i++) {
        e = this.log[i];
        if (e.deleted) continue;
        if (e.point) {
            var p = pod.getPoint(e.point);
            if (p) {
                start_i = i;
                startPoint = e.point;
                startTime = e.time;
                realStartTime = e.time;
                points.push({point: e.point, time: e.time});
                prev = e;
            }
        }
    }

    if (startTime) {
        var startTimes = this.race.getStartTimes();
        if (startTime.isAfter(startTimes.start_to)) {
            // too late start; count start_to as starttime (RR 6.3)
            startTime = startTimes.start_to;
        } else if (startTime.isBefore(startTimes.start_from)) {
            // too early start; add penalty, count start_from as starttime
            earlyStartTime = startTimes.start_from.diff(startTime, 'minutes');
            startTime = startTimes.start_from;
        }
    }

    // note that the first start point does not count as a round in the
    // code below

    for (i = 0; i < this.log.length; i++) {
        if (i == start_i) continue;
        e = this.log[i];
        if (e.deleted) continue;

        e._legStatus = null;
        e._invalidLeg = null;
        e._interruptStatus = null;
        if (e.point) {
            points.push({point: e.point, time: e.time, finish: e.finish});
            if (!npoints[e.point]) {
                npoints[e.point] = 0;
            }
            // unless this was the finish, count the point as rounded
            if (!e.finish) {
                npoints[e.point] = npoints[e.point] + 1;
            } else {
                finishTime = e.time;
            }
            var leg = legName(e.point, prev.point);
            if (!nlegs[leg]) {
                nlegs[leg] = 1;
            } else {
                nlegs[leg] = nlegs[leg] + 1;
            }
            curDist = pod.getDistance(prev.point, e.point);
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
                compensationTime += curCompensationTime;
                compensationDistTime += curCompensationDistTime;
            }
            sailedTime += e.time.diff(prev.time, 'minutes');
            prev = e;
            // reset compensation counters
            curCompensationTime = 0;
            curCompensationDistTime = 0;
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
                } else if (f.interrupt) {
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
            this.signed = 'signed';
            if (e.state == 'sync') {
                this.signed = 'signed-sync';
            }
        } else if (e.type == 'adminDSQ') {
            dsq = true;
        } else if (e.type == 'adminDist') {
            adminDist += e.admin_dist;
        } else if (e.type == 'adminTime') {
            adminTime += e.admin_time;
        }
    }

    if (finishTime) {
        var extraTime = compensationTime + adminTime;
        var raceLength =
            this.race.getRaceLengthHours() * 60 + extraTime;
        // FIXME: verify that it is correct to not add extra time here
        var raceMinLength =
            this.race.getMinimumRaceLengthHours() * 60;
        // moment's add function mutates the original object; thus copy first
        var raceFinishTime = moment(startTime).add(raceLength, 'minutes');
        var minFinishTime = moment(startTime).add(raceMinLength, 'minutes');
        if (finishTime.isAfter(raceFinishTime)) {
            lateFinishTime = finishTime.diff(raceFinishTime, 'minutes');
        }
        if (finishTime.isBefore(minFinishTime)) {
            // too short race, does not count
            earlyFinish = true;
        }
    }

    this.state = 'init';
    if (startTime) {
        this.state = 'started';
    }
    if (finishTime) {
        this.state = 'finished';
    }
    if (earlyFinish) {
        this.state = 'finished-early';
    }
    if (retired && startTime) {
        this.state = 'dnf';
    }
    else if (retired) {
        this.state = 'dns';
    }
    this.admin_state = 'ok';
    if (dsq) {
        this.admin_state = 'dsq';
    }

    this.sailedDist = Math.round(sailedDist) / 10;
    this.sailedTime = sailedTime;
    this.startTime = startTime;
    this.realStartTime = realStartTime;
    this.finishTime = finishTime;
    this.earlyStartTime = earlyStartTime;
    this.lateFinishTime = lateFinishTime;
    this.compensationTime = compensationTime;
    this.compensationDistTime = compensationDistTime;
    this.adminDist = adminDist;
    this.adminTime = adminTime;
    this.npoints = npoints;
    this.nlegs = nlegs;
    this.points = points;
    for (i = 0; i < this.onLogUpdateFns.length; i++) {
        this.onLogUpdateFns[i].fn(this, reason);
    }
};

LogBook.prototype.onLogUpdate = function(fn, prio) {
    for (var i = 0; i < this.onLogUpdateFns.length; i++) {
        if (this.onLogUpdateFns[i].fn == fn) {
            dbg('duplicate log update function' + fn);
            return;
        }
    }
    this.onLogUpdateFns.push({fn: fn, prio: prio});
    this.onLogUpdateFns.sort(function(a, b) { return a.prio - b.prio; });
};

/**
 * Get number of times a point has been rounded (logged).
 *
 * @param {string} point - the name of a point
 * @return {?number}
 */
LogBook.prototype.getPointRounds = function(point) {
    return this.npoints[point];
};

LogBook.prototype.getPoints = function() {
    return this.points;
};

LogBook.prototype.getLastPoint = function() {
    if (this.points.length > 0) {
        return this.points[this.points.length - 1].point;
    } else {
        return null;
    }
};

LogBook.prototype.getLastPointAndTime = function() {
    if (this.points.length > 0) {
        return this.points[this.points.length - 1];
    } else {
        return null;
    }
};

LogBook.prototype.getStartPoint = function() {
    return this.teamData.start_point;
};

LogBook.prototype.getFinishPoint = function() {
    if (this.race.getCommonFinish()) {
        return this.race.getCommonFinish();
    } else {
        return this.teamData.start_point;
    }
};

LogBook.prototype.isReadOnly = function() {
    if (this.readOnly || this.signed != false) {
        return true;
    }
    return false;
};

/**
 * Get number of times a leg has been sailed (logged).
 *
 * @param {string} pointA - the name of a point
 * @param {string} pointB - the name of a point
 * @return {?number}
 */
LogBook.prototype.getLegSailed = function(pointA, pointB) {
    return this.nlegs[legName(pointA, pointB)];
};

LogBook.prototype.getStartTime = function() {
    return this.startTime;
};

LogBook.prototype.getRealStartTime = function() {
    return this.realStartTime;
};

LogBook.prototype.hasFinished = function() {
    if (this.state == 'finished' ||
        this.state == 'finished-early' ||
        this.state == 'dns' ||
        this.state == 'dnf') {
        return true;
    }
    return false;
};

// includes any compensation time due to rescue interrupts
LogBook.prototype.getRaceLeftMinutes = function() {
    var raceMinutes = this.getRaceLengthMinutes() +
        this.compensationTime + this.adminTime;
    if (this.startTime == null) {
        return raceMinutes;
    } else {
        var now = moment();
        var racedMinutes = now.diff(this.startTime, 'minutes');
        return raceMinutes - racedMinutes;
    }
};

// includes any compensation time due to rescue interrupts
LogBook.prototype.getRaceLengthMinutes = function() {
    return this.race.getRaceLengthHours() * 60;
};

LogBook.prototype.getSailedDistance = function() {
    return this.sailedDist;
};

LogBook.prototype.getNetDistance = function() {
    // Net distance is sailed distance / sxk-handicap
    return this.sailedDist / this.teamData.sxk_handicap;
};

// gross
LogBook.prototype.getEarlyStartDistance = function() {
    // we can't calculate this properly until the race has finished
    if (this.finishTime) {
        return (2 * this.getSailedDistance() * this.earlyStartTime) /
            this.getRaceLengthMinutes();
    } else {
        return 0;
    }
};
LogBook.prototype.getEarlyStartTime = function() {
    return this.earlyStartTime;
};

// gross
LogBook.prototype.getLateFinishDistance = function() {
    // we can't calculate this properly until the race has finished
    if (this.finishTime) {
        return (2 * this.getSailedDistance() * this.lateFinishTime) /
            this.getRaceLengthMinutes();
    } else {
        return 0;
    }
};
LogBook.prototype.getLateFinishTime = function() {
    return this.lateFinishTime;
};

// gross
LogBook.prototype.getCompensationDistance = function() {
    // we can't calculate this properly until the race has finished
    if (this.finishTime) {
        return (this.getAverageSpeed() * this.compensationDistTime) / 60;
    } else {
        return 0;
    }
};

// gross
LogBook.prototype.getApprovedDistance = function() {
    if (this.state == 'finished-early' || this.state == 'dns'
        || this.state == 'dnf' || this.admin_state == 'dsq') {
        return 0;
    }
    return this.getSailedDistance() + this.getCompensationDistance() -
        (this.getEarlyStartDistance() + this.getLateFinishDistance());

};

// net
LogBook.prototype.getAdminDistance = function() {
    return this.adminDist;
};

// net
LogBook.prototype.getPlaqueDistance = function() {
    if (this.state == 'finished-early' || this.state == 'dns'
        || this.state == 'dnf' || this.admin_state == 'dsq') {
        return 0;
    }
    return ((this.getApprovedDistance() / this.teamData.sxk_handicap) -
            this.getAdminDistance());
};

LogBook.prototype.getAverageSpeed = function() {
    var speed = 0;
    var time = this.sailedTime - this.compensationTime;
    if (time > 0) {
        speed = this.sailedDist * 60 / time;
    }
    return speed;
};

LogBook.prototype.getSailedTime = function() {
    return this.sailedTime;
};

LogBook.prototype.getEngine = function(beforeId) {
    var res = false;
    for (var i = 0; i < this.log.length && this.log[i].id != beforeId; i++) {
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

LogBook.prototype.getLanterns = function(beforeId) {
    var res = false;
    for (var i = 0; i < this.log.length && this.log[i].id != beforeId; i++) {
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

LogBook.prototype.getInterrupt = function(beforeId) {
    var res = false;
    for (var i = 0; i < this.log.length && this.log[i].id != beforeId; i++) {
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

LogBook.prototype.getPrevRound = function(beforeId) {
    var res = null;
    for (var i = 0; i < this.log.length && this.log[i].id != beforeId; i++) {
        var e = this.log[i];
        if (e.deleted) continue;
        if (e.type == 'round') {
            res = e;
        }
    }
    return res;
};

LogBook.prototype.deleteLogEntry = function(id) {
    var index = undefined;
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id == id  || this.log[i].oldid == id) {
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

LogBook.prototype.deleteAllLogEntries = function() {
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

LogBook.prototype.updateFromServerP = function() {
    var logBook = this;
    var lastUpdate = null;
    if (this.lastServerUpdate) {
        lastUpdate = this.lastServerUpdate.toISOString();
    }
    return getTeamLogP(this.teamData.id, lastUpdate)
        .then(function(log) {
            logBook.isUpdatedFromServer = true;
            return logBook.addLogFromServer(log);
        });
};

// returns false if the logentry already exists
LogBook.prototype.addLogEntryFromServer = function(logEntry) {
    for (var i = 0; i < this.log.length; i++) {
        if (this.log[i].id == logEntry.id) {
            if (this.log[i].updated_at &&
                this.log[i].updated_at.isSame(logEntry.updated_at)) {
                return false;
            }
            continue;
        }
    }
    this.addLogFromServer([logEntry]);
    return true;
};


LogBook.prototype.addLogFromServer = function(log) {
    var del = [];
    var add = [];
    var i;
    for (i = 0; i < log.length; i++) {
        var new_ = log[i];
        if (this.lastServerUpdate == null ||
            new_.updated_at.isAfter(this.lastServerUpdate)) {
            this.lastServerUpdate = new_.updated_at;
        }
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
                    dbg('both modified log entry w/ id ' + new_.id);
                    dbg(JSON.stringify(old));
                    dbg(JSON.stringify(new_));
                }
                new_.state = 'conflict';
                del.push(old.id);
                add.push(new_);
                break;
            case 'syncing':
                dbg('assertion failure - we should not call ' +
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
    for (i = 0; i < del.length; i++) {
        this._delLogEntryById(del[i]);
        updated = true;
    }
    // now add all that should be added
    for (i = 0; i < add.length; i++) {
        this._addLogEntry(add[i]);
        updated = true;
    }
    if (updated) {
        this._updateLog('syncDone');
    }
};

LogBook.prototype.sendToServerP = function(updated) {
    var logBook = this;
    dbg('send to server!');
    for (var i = 0; i < this.log.length; i++) {
        var e = this.log[i];
        if (e.state == 'dirty' && !e.gen) {
            // new log entry
            e.state = 'syncing';
            dbg('posting ' + e.id + ' ' + e.type);
            return postLogEntryP(this.teamData.id, e)
                .then(function(res) {
                    // update ok; store id and generation id
                    e.oldid = e.id; // remember old (generated uuid) id
                                    // so that we can find it if we have
                                    // references to it
                    e.id = res.id;
                    e.gen = res.gen;
                    e.state = 'sync';
                    // continue
                    return logBook.sendToServerP(true);
                })
                .catch(function(err) {
                    // error; wait and try later
                    debugInfo['posterr'] = err;
                    dbg('post error: ' + err);
                    dbg(err.stack);
                    e.state = 'dirty';
                    if (updated) {
                        logBook._updateLog('syncError');
                    }
                    // return from the call chain
                    return false;
                });
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
            dbg('patching ' + e.id + ' ' + e.type);
            return patchLogEntryP(e.id, data)
                .then(function(res) {
                    if (res == 'conflict') {
                        // someone modified this entry before us; ignore
                        // and handle this in 'updateFromServer' later.
                        e.state = 'conflict';
                    } else if (e.state == 'dirty') {
                        // update ok, but modified again locally;
                        // we continue, and will then send the new
                        // entry again.  update the generation id though,
                        // so that the server accepts the new entry.
                        e.gen = res.gen;
                    } else {
                        // update ok; store new generation id
                        e.gen = res.gen;
                        e.state = 'sync';
                    }
                    // continue
                    return logBook.sendToServerP(true);
                })
                .catch(function(err) {
                    // error; wait and try later
                    debugInfo['patcherr'] = err;
                    dbg('patch error: ' + err);
                    dbg(err.stack);
                    e.state = 'dirty';
                    if (updated) {
                        logBook._updateLog('syncError');
                    }
                    // return from the call chain
                    return false;
                });
        }
    }
    // no more log entries to send
    if (updated) {
        this._updateLog('syncDone');
    }
    return new Promise(function(resolve) {
        resolve(true);
    });
};
