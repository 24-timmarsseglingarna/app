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
    this.races = {}; // { raceId => Race() }
    this.teams = {}; // { teamId => LogBook() }
    this.last_log_entry_time = null;
    this.last_log_update = null;
    this.log_updated = false;
};

tf.Regatta.prototype.getId = function() {
    return this.id;
};

tf.Regatta.prototype.getPod = function() {
    return this.pod;
};

tf.Regatta.prototype.updateLogFromServer = function(continueFn) {
    var regatta = this;
    var lastLogUpdate = null;
    if (this.last_log_entry_time) {
        lastLogUpdate = this.last_log_entry_time.toISOString();
    }
    var teamId = null;
    if (tf.state.curLogBook) {
        teamId = tf.state.curLogBook.teamData.id;
    }
    tf.serverData.getNewRegattaLog(
        this.id, teamId, lastLogUpdate,
        function(log) {
            regatta.last_log_update = moment();
            for (var i = 0; log != null && i < log.length; i++) {
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
                var added = regatta.teams[teamId].addLogEntryFromServer(log[i]);
                if (added) {
                    // mark the log as being updated
                    regatta.log_updated = true;
                }
                if (regatta.last_log_entry_time == null ||
                    log[i].updated_at.isAfter(regatta.last_log_entry_time)) {
                    regatta.last_log_entry_time = log[i].updated_at;
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
    var maxTime = moment(this.last_finish).add(24, 'hours');
    return moment().isBetween(this.first_start, maxTime);
};

/*
 * Returns: [ { 'netdist': <Net distance logged>
 *              'logbook': <LogBook> } ]
 */
tf.Regatta.prototype.getLeaderBoard = function() {
    var res = [];
    if (tf.state.curLogBook) {
        res.push({ netdist: tf.state.curLogBook.getNetDistance(),
                   logbook: tf.state.curLogBook });
    }
    for (var teamId in this.teams) {
        var logbook = this.teams[teamId];
        res.push({ netdist: logbook.getNetDistance(),
                   logbook: logbook });
    }
    res.sort(function(a, b) { return b.netdist - a.netdist; });
    return res;
};

tf.Regatta.prototype.getLeaderBoardUpdatedTime = function() {
    return this.last_log_update;
};
