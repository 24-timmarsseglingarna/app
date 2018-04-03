/* -*- js -*- */

goog.provide('tf.Regatta');

goog.require('tf');
goog.require('tf.LogBook');

/**
 * Regatta data
 */


/**
 * @constructor
 */
tf.Regatta = function(id, racesData, pod) {
    this.id = id;
    this.racesData = racesData;
    this.pod = pod;
    this.plans = {};
    this.first_start = null;
    this.last_finish = null;
    for (var i = 0; i < racesData.length; i++) {
        if (this.first_start == null ||
            racesData[i].start_from.isBefore(this.first_start)) {
            this.first_start = racesData[i].start_from;
        }
        var finish = moment(racesData[i].start_to);
        finish.add(racesData[i].period, 'hours');
        if (this.last_finish == null ||
            finish.isAfter(this.last_finish)) {
            this.last_finish = finish;
        }
    }
    this.timer = null;
    this.races = {};
    this.teams = {};
    this.last_log_update = null;
};

tf.Regatta.prototype.getId = function() {
    return this.id;
};

tf.Regatta.prototype.getPod = function() {
    return this.pod;
};

tf.Regatta.prototype.setActive = function(active) {
    if (!active) {
        window.clearInterval(this.timer);
    } else {
        if (this.isOngoing()) {
            this._timeout();
            this.times = window.setInterval(function(r) { t._timeout(); },
                                            60000, this);
        }
    }
};

tf.Regatta.prototype.updateLogFromServer = function(continueFn) {
    var regatta = this;
    var lastUpdate = null;
    if (this.last_log_update) {
        lastUpdate = this.last_log_update.toISOString();
    }
    var teamId = null;
    if (tf.state.curLogBook) {
        teamId = tf.state.curLogBook.teamData.id;
    }
    tf.serverData.getNewRegattaLog(
        this.id, teamId, lastUpdate,
        function(log) {
            for (var i = 0; i < log.length; i++) {
                id = log[i].id;
                var teamId = log[i].team_id;
                if (!regatta.teams[teamId]) {
                    var teamData =
                        tf.serverData.getTeamData(regatta.id, teamId);
                    var race = regatta.races[teamData.race_id];
                    if (!race) {
                        var raceData =
                            tf.serverData.getRaceData(teamData.race_id);
                        race = new tf.Race(regatta, raceData);
                        regatta.races[teamData.race_id] = race;
                    }
                    regatta.teams[teamId] = new tf.LogBook(teamData, race);
                }
                // FIXME: add proper API function to LogBook.js
                regatta.teams[teamId]._addLogFromServer([log[i]]);
                if (regatta.last_log_update == null ||
                    log[i].updated_at.isAfter(regatta.last_log_update)) {
                    regatta.last_log_update = log[i].updated_at;
                }
            }
            continueFn();
        });
};


tf.Regatta.prototype._timeout = function() {
};

tf.Regatta.prototype.isOngoing = function() {
    // treat as ongoing up to 24 hours after last finish, in order to
    // handle late finish, but also to handle late entries
    // FIXME: > first_start and isActive
    var maxTime = moment(this.last_finish).add(24, 'hours')
    return moment().isBetween(this.first_start, maxTime);
};

/*
 * Returns: [ { 'sxkdist': <SXK distance logged>
 *              'logbook': <LogBook> } ]
 */
tf.Regatta.prototype.getLeaderBoard = function() {
    var res = [];
    if (tf.state.curLogBook) {
        res.push({ sxkdist: tf.state.curLogBook.getSXKDistance(),
                   logbook: tf.state.curLogBook });
    }
    for (teamId in this.teams) {
        var logbook = this.teams[teamId];
        res.push({ sxkdist: logbook.getSXKDistance(),
                   logbook: logbook });
    }
    res.sort(function(a, b) { return b.sxkdist - a.sxkdist; });
    return res;
};
