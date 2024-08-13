/* -*- js -*- */

import {Race} from './race.js';
import {LogBook} from './logbook.js';
import {getNewRegattaLogP, getTeamData, getRaceData} from './serverdata.js';

/**
 * Regatta data
 */

/**
 * @constructor
 */
export function Regatta(id, name, racesData, pod, teamsData, logData) {
    this.id = id;
    this.name = name;
    this.racesData = racesData;
    this.pod = pod;
    this.plans = {};
    this.first_start = null;
    this.last_finish = null;
    var i;
    for (i = 0; i < racesData.length; i++) {
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
    for (i = 0; i < racesData.length; i++) {
        this.races[racesData[i].id] = new Race(this, racesData[i]);
    }
    if (teamsData) {
        for (i = 0; i < teamsData.length; i++) {
            var teamData = teamsData[i];
            var race = this.races[teamData.race_id];
            this.teams[teamData.id] = new LogBook(teamData, race, [], true);
        }
    }
    this.last_log_entry_time = null;
    this.last_log_update = null;
    this.log_updated = false;
    if (logData) {
        this._setLogData(logData);
    }
};

Regatta.prototype.getId = function() {
    return this.id;
};

Regatta.prototype.getName = function() {
    return this.name;
};

Regatta.prototype.getPod = function() {
    return this.pod;
};

Regatta.prototype.updateLogFromServerP = function(curLogBook) {
    var regatta = this;
    var lastLogUpdate = null;
    if (this.last_log_entry_time) {
        lastLogUpdate = this.last_log_entry_time.toISOString();
    }
    var teamId = null;
    if (curLogBook) {
        teamId = curLogBook.teamData.id;
    }
    return getNewRegattaLogP(this.id, teamId, lastLogUpdate)
        .then(function(log) {
            regatta._setLogData(log);
            return true;
        });
};

Regatta.prototype._setLogData = function(log) {
    this.last_log_update = moment();
    for (var i = 0; log != null && i < log.length; i++) {
        var teamId = log[i].team_id;
        if (!this.teams[teamId]) {
            var teamData = getTeamData(this.id, teamId);
            if (!teamData) {
                continue;
            }
            var race = this.races[teamData.race_id];
            if (!race) {
                var raceData = getRaceData(teamData.race_id);
                race = new Race(this, raceData);
                this.races[teamData.race_id] = race;
            }
            this.teams[teamId] = new LogBook(teamData, race, [], true);
        }
        var added = this.teams[teamId].addLogEntryFromServer(log[i]);
        if (added) {
            // mark the log as being updated
            this.log_updated = true;
        }
        if (this.last_log_entry_time == null ||
            log[i].updated_at.isAfter(this.last_log_entry_time)) {
            this.last_log_entry_time = log[i].updated_at;
        }
    }
};

Regatta.prototype.getTeamLogbook = function(teamId) {
    return this.teams[teamId];
};


// FIXME: not used
Regatta.prototype.isOngoing = function() {
    // treat as ongoing up to 24 hours after last finish, in order to
    // handle late finish, but also to handle late entries
    // FIXME: > first_start and isActive
    var maxTime = moment(this.last_finish).add(24, 'hours');
    return moment().isBetween(this.first_start, maxTime);
};

/*
 * Returns: [ { 'plaquedist': <Plaquette distance logged>
 *              'logbook': <LogBook> } ]
 */
Regatta.prototype.getLeaderBoard = function(curLogBook) {
    var res = [];
    if (curLogBook && !this.teams[curLogBook.teamData.id]
        && curLogBook.getLastPoint() != null) {
        // add ourselves if we have logged a point
        res.push({ plaquedist: curLogBook.getPlaqueDistance(),
                   logbook: curLogBook });
    }
    for (var teamId in this.teams) {
        var logbook = this.teams[teamId];
        if (logbook.state != 'dns') {
            res.push({ plaquedist: logbook.getPlaqueDistance(),
                       logbook: logbook });
        }
    }
    return res;
};

/*
 * Returns: [ { 'plaquedist': <Plaque distance>
 *              'logbook': <LogBook> } ]
 */
Regatta.prototype.getResult = function() {
    var res = [];
    for (var teamId in this.teams) {
        var logbook = this.teams[teamId];
        res.push({ plaquedist: logbook.getPlaqueDistance(),
                   logbook: logbook });
    }
    return res;
};

Regatta.prototype.getLeaderBoardUpdatedTime = function() {
    return this.last_log_update;
};
