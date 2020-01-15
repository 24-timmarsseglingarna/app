/* -*- js -*- */

import {getCachedMyTeams, getCachedTeams, getCachedRaces,
        setCachedMyTeams, setCachedTeams, setCachedRaces} from './storage.js';
import * as serverAPI from './serverapi';

var myTeams;
var myTeamsETag;
var myRegattaIds;
var races;
var racesETags;
var teams;
var teamsETags;
var clientId;
var terrains;

/**
 * Note that this is not an object b/c this a global property.
 */
export function init(clientIdV) {
    var m;
    // My teams in the races I am participating in.
    m = getCachedMyTeams() || {data: [], etags: null};
    myTeams = m.data;
    myTeamsETag = m.etag;
    // The regatta ids in the regattas I am participating in.
    myRegattaIds = getRegattaIds(myTeams);
    // All races in the regattas I am participating in.
    m = getCachedRaces() || {data: {}, etags: {}};
    races = m.data;
    racesETags = m.etags;
    //
    terrains = {};
    // All teams in the regattas I am participating in.
    m = getCachedTeams() || {data: {}, etags: {}};
    teams = m.data;
    teamsETags = m.etags;
    clientId = clientIdV;
};

export function clearCache() {
    myTeams = [];
    myTeamsETag = null;
    myRegattaIds = [];
};

export function getNewRegattaLog(regattaId, teamId,
                                 lastUpdate, responsefn) {
    serverAPI.getNewRegattaLog(
        regattaId, teamId, lastUpdate,
        function(data) {
            if (data) {
                var log = data.map(mkLogSummaryData);
                responsefn(log);
            } else {
                responsefn(null);
            }
        });
};

export function getRegattaLogs(regattaId, responsefn) {
    serverAPI.getFullRegattaLog(
        regattaId,
        function(data) {
            if (data) {
                var log = data.map(mkLogData);
                responsefn(log);
            } else {
                responsefn(null);
            }
        });
};

export function getRegattaTeams(regattaId, responsefn) {
    serverAPI.getTeamsPerRegatta(
        [regattaId],
        [null],
        function(r) {
            var teams = null;
            if (r) {
                teams = r[regattaId].map(mkTeamData);
            }
            responsefn(teams);
        });
};

export function getRegattaTeamsP(regattaId) {
    return serverAPI.getTeamsPerRegatta(
        [regattaId],
        [null])
        .then(function(r) {
            teams[regattaId] = r.teams[regattaId].map(mkTeamData);
            return teams[regattaId];
        });
};

export function getRegattaRaces(regattaId, responsefn) {
    serverAPI.getRacesPerRegatta(
        [regattaId],
        [null],
        function(r) {
            var races = null;
            if (r) {
                races = r[regattaId].map(mkRaceData);
            }
            responsefn(races);
        });
};

export function getRaceP(raceId) {
    return serverAPI.getRace(raceId, null)
        .then(function(r) {
            var race = mkRaceData(r);
            races[race.regatta_id] = race;
            return race;
        });
};

export function getTerrainP(terrainId) {
    return serverAPI.getTerrain(terrainId)
        .then(function(data) {
            terrains[terrainId] = data;
            return data;
        });
};

export function getTeam(teamId, responsefn) {
    serverAPI.getTeam(
        teamId,
        null,
        function(r) {
            var team = null;
            if (r) {
                team = mkTeamData(r);
            }
            responsefn(team);
        });
};

export function getTeamP(teamId) {
    return serverAPI.getTeam(teamId, null)
        .then(function(r) {
            var teamData = mkTeamData(r);
            myTeams = [teamData];
            return teamData;
        });
};

export function getTeamLog(teamId, lastUpdate, responsefn) {
    var client;
    if (lastUpdate) {
        client = clientId.get();
    }
    serverAPI.getTeamLog(
        teamId, client, lastUpdate,
        function(data) {
            if (data) {
                var log = data.map(mkLogData);
                responsefn(log);
            } else {
                responsefn(null);
            }
        });
};

export function getTeamLogP(teamId, lastUpdate) {
    return serverAPI.getTeamLog(
        teamId, null, lastUpdate)
        .then(function(data) {
            return data.map(mkLogData);
        });
};

export function postLogEntry(teamId, data, responsefn) {
    serverAPI.postLogEntry(
        mkServerLogData(data, teamId),
        function(res) {
            if (res && res.id) {
                responsefn(res.id, res.gen);
            } else {
                responsefn(null, null);
            }
        });
};

export function patchLogEntry(logId, data, responsefn) {
    serverAPI.patchLogEntry(
        logId,
        mkServerLogData(data),
        function(res) {
            if (res == 'conflict') {
                responsefn('conflict');
            } else if (res && res.gen) {
                responsefn(res.gen);
            } else {
                // error
                responsefn(null);
            }
        });
};

function getRegattaIds(myTeams) {
    var rIds = [];
    for (var i = 0; i < myTeams.length; i++) {
        var regattaId = myTeams[i].regatta_id;
        if (rIds.indexOf(regattaId) == -1) {
            rIds.push(regattaId);
        }
    }
    return rIds;
};

export function updateServerDataP(personId) {
    return serverAPI.getActiveTeamsP(
        personId, myTeamsETag)
        .then(function(response) {
            var newMyTeamsETag = response.etag;
            var newMyTeams = null;
            var srvTeams = response.data;
            if (!response.modified) {
                newMyTeams = myTeams;
            } else {
                newMyTeams = srvTeams.map(mkTeamData);
                if (newMyTeams) {
                    myTeams = newMyTeams;
                    myTeamsETag = newMyTeamsETag;
                    setCachedMyTeams({data: newMyTeams,
                                      etag: newMyTeamsETag});
                }
            }
            if (newMyTeams != null) {
                var rIds = getRegattaIds(newMyTeams);
                myRegattaIds = rIds;
            }
            return serverAPI.getRacesPerRegatta(
                myRegattaIds,
                racesETags);
        })
        .then(function(result) {
            var r = result.races;
            var newRacesETags = result.etags;
            var newRaces = null;
            if (result.races) {
                newRaces = {};
                for (var regattaId in r) {
                    if (r[regattaId] == 'notmodified') {
                        newRaces[regattaId] =
                            races[regattaId];
                    } else {
                        newRaces[regattaId] =
                            r[regattaId].map(
                                mkRaceData);
                    }
                }
            }
            if (newRaces) {
                races = newRaces;
                racesETags = newRacesETags;
                setCachedRaces({
                    data: races,
                    etags: racesETags});
            }
            return updateTeams();
        });
};

// HERE: fetch pod

function updateTeams(continueFn) {
    return serverAPI.getTeamsPerRegatta(
        myRegattaIds,
        teamsETags,
        function(r, newTeamsETags) {
            var newTeams = null;
            if (r) {
                newTeams = {};
                for (var regattaId in r) {
                    if (r[regattaId] == 'notmodified') {
                        newTeams[regattaId] = teams[regattaId];
                    } else {
                        newTeams[regattaId] =
                            r[regattaId].map(
                                mkTeamData);
                    }
                }
            }
            if (newTeams) {
                teams = newTeams;
                teamsETags = newTeamsETags;
                setCachedTeams({
                    data: teams,
                    etags: teamsETags});
            }
            if (continueFn) {
                continueFn();
            }
        });
};

/**
 * Return: Race data for the active races the logged in user
 * participates in.
 */
export function getMyRaces() {
    var r = [];
    for (var i = 0; i < myTeams.length; i++) {
        var t = myTeams[i];
        var rs = races[t.regatta_id];
        for (var j = 0; j < rs.length; j++) {
            if (rs[j].id == t.race_id) {
                r.push({raceData: rs[j],
                        teamData: t});
            }
        }
    }
    return r;
};

/**
 * Return: Race data for all races in the given regatta.
 */
export function getRacesData(regattaId) {
    return races[regattaId] || [];
};

/**
 * Return: Race data for the given race.
 */
export function getRaceData(raceId) {
    for (var regattaId in races) {
        var rs = races[regattaId];
        for (var i = 0; i < rs.length; i++) {
            if (rs[i].id == raceId) {
                return rs[i];
            }
        }
    }
    return null;
};

/**
 * Return: Team data for the team that the logged in user belong to
 * in the given race.
 */
export function getMyTeamData(raceId) {
    for (var i = 0; i < myTeams.length; i++) {
        if (myTeams[i].race_id == raceId) {
            return myTeams[i];
        }
    }
    return null;
};

/**
 * Return: Team data for all teams in the given regatta.
 */
export function getTeamsData(regattaId) {
    return teams[regattaId];
};

/**
 * Return: Team data for the given team in the given regatta.
 */
export function getTeamData(regattaId, teamId) {
    var ts = teams[regattaId];
    for (var i = 0; i < ts.length; i++) {
        if (ts[i].id == teamId) {
            return ts[i];
        }
    }
};


/**
 * Data Conversion Functions
 *
 * These functions map from the server representation to the internal
 * representation.  In most cases the internal representation is just a
 * subset of the server representation.
 */

function mkTeamData(s) {
    var r = {
        id:                 s.id,                 // int
        start_number:       s.start_number,       // int
        start_point:        s.start_point,        // int
        race_id:            s.race_id,            // int
        regatta_id:         s.regatta_id,         // int
        boat_name:          s.boat_name,          // string
        boat_type_name:     s.boat_type_name,     // string
        boat_sail_number:   s.boat_sail_number,   // string
        skipper_id:         s.skipper_id,         // int (person.id)
        skipper_first_name: s.skipper_first_name, // string
        skipper_last_name:  s.skipper_last_name,  // string
        sxk_handicap:       s.sxk || 2            // float
    };
    return r;
};

function mkRaceData(s) {
    var r = {
        id:             s.id,                  // int
        organizer_name: s.organizer_name,      // string
        regatta_name:   s.regatta_name,        // string
        regatta_id:     s.regatta_id,          // int
        terrain_id:     s.terrain_id,          // int
        start_from:     moment(s.start_from),  // date and time
        start_to:       moment(s.start_to),    // date and time
        common_finish:  s.common_finish,       // null | int (point)
        period:         s.period,              // int (12,24,48,...)
        min_period:     s.minimal,             // int (11,23,43,...)
        description:    s.description          // string
    };
    return r;
};

function mkLogData(s) {
    var r = {
        id:               s.id,                // int
        class:            s.type,              // 'TeamLog' | 'AdminLog'
        type:             s.log_type,          // string
        team_id:          s.team_id,           // int
        time:             moment(s.time),      // date and time
        gen:              s.gen,               // int
        user:             s.user_name,         // string
        client:           s.client,            // string
        deleted:          s.deleted,           // boolean
        updated_at:       moment(s.updated_at) // date and time
    };
    if (s.point) {
        r.point = s.point;                     // int
    }
    parseJSONLogData(r, s.data);
    return r;
};

function mkLogSummaryData(s) {
    var r = {
        id:               s.id,                // int
        team_id:          s.team_id,           // int
        time:             moment(s.time),      // date and time
        point:            s.point,             // int
        deleted:          s.deleted,           // boolean
        updated_at:       moment(s.updated_at) // date and time
    };
    return r;
};

/**
 * Convert internal log data to data sent to the server.
 */
function mkServerLogData(r, teamId) {
    // never include the log id in the payload
    // 'user_id' and 'updated_at' are filled in by the server
    var s = {
        // always add our client identifier to entries modified by us
        client: clientId.get(),
    };
    if (teamId) { // not set on patch
        s.team_id = teamId;
    }

    if (r.type) {
        s.log_type = r.type;
    }
    if (r.class) {
        s.type = r.class;
    }
    if (r.time) {
        s.time = r.time.toISOString();
    }
    if (r.deleted) {
        s.deleted = r.deleted;
    }
    if (r.gen) {
        s.gen = r.gen;
    }

    var data = {};
    if (r.comment) {
        data.comment = r.comment;
    }

    switch (r.type) {
    case 'round':
        s.point = r.point;
        data.wind = r.wind;
        if (r.sails) {
            data.sails = r.sails;
        }
        if (r.finish) {
            data.finish = r.finish;
        }
        data.teams = r.teams;
        break;
    case 'endOfRace':
        data.position = r.position;
        break;
    case 'seeOtherTeams':
        data.teams = r.teams;
        break;
    case 'seeOtherBoats': // OBSOLETE
        data.boats = r.boats;
        break;
    case 'protest':
        data.position = r.position;
        data.protest = r.protest;
        break;
    case 'interrupt':
        data.position = r.position;
        data.interrupt = r.interrupt;
        break;
    case 'changeSails':
        data.wind = r.wind;
        data.sails = r.sails;
        break;
    case 'engine':
        data.engine = r.engine;
        break;
    case 'lanterns':
        data.position = r.position;
        data.lanterns = r.lanterns;
        break;
    case 'retire':
        data.position = r.position;
        break;
    case 'sign':
        break;
    case 'other':
        break;
    // AdminLog follows
    case 'adminNote':
        break;
    case 'adminDSQ':
        break;
    case 'adminDist':
        data.admin_dist = r.admin_dist;
        break;
    case 'adminTime':
        data.admin_time = r.admin_time;
        break;
    }
    s.data = JSON.stringify(data);
    return s;
};

function parseJSONLogData(r, dataStr) {
    try {
        var data = JSON.parse(dataStr);
        // simply copy everything from the data field to the log entry
        for (var k in data) {
            r[k] = data[k];
        }
    } catch (err) {
        // don't use the error
    }

};
