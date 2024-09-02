/* -*- js -*- */

import {getCachedMyTeams, getCachedTeams,
        getCachedRaces, getCachedTerrain,
        setCachedMyTeams, setCachedTeams,
        setCachedRaces, setCachedTerrain,
        gcTerrainsP} from './storage.js';
import * as serverAPI from './serverapi';
import {Pod} from './pod.js';
import {dbg} from './debug.js';

var myTeams = [];
var myTeamsETag = null;
var myRegattaIds = [];
var races = {};
var racesETags = {};
var teams = {};
var teamsETags = {};
var clientId;
var pods = {};


/**
 * Note that this is not an object b/c this a global property.
 */
export function initP(clientIdV, defaultPod) {
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
    // All teams in the regattas I am participating in.
    m = getCachedTeams() || {data: {}, etags: {}};
    teams = m.data;
    teamsETags = m.etags;
    clientId = clientIdV;
    // All pods for the regattas I am participating in.
    pods[defaultPod.getTerrain().id] = defaultPod;
    return initCachedPodsP();
};

export function clearCache() {
    myTeams = [];
    myTeamsETag = null;
    myRegattaIds = [];
};

/**
 * Fetch all 'round' logentries from all teams except `teamId` in `regattaId`.
 * Returns Promise
 * @resolve :: [ logSummaryData() ]
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getNewRegattaLogP(regattaId, teamId, lastUpdate) {
    return serverAPI.getNewRegattaLogP(regattaId, teamId, lastUpdate)
        .then(function(data) {
            if (data) {
                return data.map(mkLogSummaryData);
            } else {
                return [];
            }
        });
};

/**
 * Fetch all logentries from all teams in `regattaId`.
 * Returns Promise
 * @resolve :: [ logData() ]
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getRegattaLogsP(regattaId) {
    return serverAPI.getFullRegattaLogP(regattaId)
        .then(function(data) {
            if (data) {
                return data.map(mkLogData);
            } else {
                return [];
            }
        });
};

/**
 * Fetch team data for all teams in `regattaId`.
 * Returns Promise
 * @resolve :: teamData()
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getRegattaTeamsP(regattaId) {
    return serverAPI.getTeamsPerRegattaP([regattaId], [null])
        .then(function(r) {
            teams[regattaId] = r.teams[regattaId].map(mkTeamData);
            return teams[regattaId];
        });
};

/**
 * Fetch race data for all races in `regattaId`.
 * Returns Promise
 * @resolve :: [raceData()]
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getRegattaRacesP(regattaId) {
    return serverAPI.getRacesPerRegattaP([regattaId], [null])
        .then(function(r) {
            dbg('racesPer: ' + JSON.stringify(r));
            var lraces = null;
            if (r.races) {
                lraces = r.races[regattaId].map(mkRaceData);
                races[regattaId] = lraces;
            }
            return lraces;
        });
};

/**
 * Fetch race data for the given race `raceId`.
 * Returns Promise
 * @resolve :: raceData()
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getRaceP(raceId) {
    return serverAPI.getRaceP(raceId, null)
        .then(function(response) {
            var race = mkRaceData(response.data);
            races[race.regatta_id] = race;
            return race;
        });
};

/**
 * Fetch a Pod for the given terrain `terrainId`.
 * Returns Promise
 * @resolve :: Pod()
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getPodP(terrainId, allowNull=false) {
    var pod = getPod(terrainId);
    if (pod) {
        return new Promise(function(resolve) {
            resolve(pod);
        });
    }
    return serverAPI.getTerrainP(terrainId)
        .then(function(data) {
            setCachedTerrain(data);
            pods[terrainId] = new Pod(data);
            return pods[terrainId];
        })
        .catch(function(error) {
            if (allowNull) {
                return null;
            } else {
                throw error;
            }
        });
};

function getAllPodsP(terrainIds, idx, retval) {
    if (idx >= terrainIds.length) {
        return new Promise(function(resolve) {
            resolve(retval);
        });
    }
    return getPodP(terrainIds[idx], true)
        .then(function() {
            return getAllPodsP(terrainIds, idx + 1, retval);
        });
};

function initCachedPodsP() {
    var terrainIds = [];
    for (var id in races) {
        if (!terrainIds.includes(races[id][0].terrain_id)) {
            terrainIds.push(races[id][0].terrain_id);
        }
    }
    return getAllPodsP(terrainIds, 0, true);
};

/**
 * Returns locally stored Pod for the given terrain, if it exists.
 */
export function getPod(terrainId) {
    if (pods[terrainId]) {
        return pods[terrainId];
    } else {
        var t = getCachedTerrain(terrainId);
        if (t) {
            pods[terrainId] = new Pod(t);
            return pods[terrainId];
        } else {
            return undefined;
        }
    }
};

/**
 * Fetch team data for the given team `teamId`.
 * Returns Promise
 * @resolve :: teamData()
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getTeamP(teamId) {
    return serverAPI.getTeamP(teamId, null)
        .then(function(response) {
            return mkTeamData(response.data);
        });
};

/**
 * Returns Promise
 * @resolve :: [ logData() ]
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getTeamLogP(teamId, lastUpdate) {
    var client;
    if (lastUpdate) {
        client = clientId.get();
    }
    return serverAPI.getTeamLogP(teamId, client, lastUpdate)
        .then(function(data) {
            return data.map(mkLogData);
        });
};

export function postLogEntryP(teamId, data) {
    return serverAPI.postLogEntryP(mkServerLogData(data, teamId));
};

export function patchLogEntryP(logId, data) {
    return serverAPI.patchLogEntryP(logId, mkServerLogData(data))
        .then(function(x) {
            dbg('patch ok ' + x);
            return x;
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
    return serverAPI.getActiveTeamsP(personId, myTeamsETag)
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
            return myRegattaIds;
        })
        .then(function() {
            return serverAPI.getRacesPerRegattaP(myRegattaIds, racesETags);
        })
        .then(function(racesResult) {
            // ensure we have the pods before we handle the races result
            var r = racesResult.races;
            var terrainIds = [];
            for (var regattaId in r) {
                var t;
                if (r[regattaId] == 'notmodified') {
                    t = races[regattaId][0].terrain_id;
                } else {
                    t = r[regattaId][0].terrain_id;
                }
                if (t && !(terrainIds.includes(t))) {
                    terrainIds.push(t);
                }
            }
            return getAllPodsP(terrainIds, 0, {r: racesResult, t: terrainIds});
        })
        .then(function(data) {
            return gcTerrainsP(data.t, data.r);
        })
        .then(function(racesResult) {
            var r = racesResult.races;
            var newRacesETags = racesResult.etags;
            var newRaces = null;
            if (r) {
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
            return serverAPI.getTeamsPerRegattaP(myRegattaIds, teamsETags);
        })
        .then(function(teamsResult) {
            var r = teamsResult.teams;
            var newTeamsETags = teamsResult.etags;
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
            return true;
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
        for (var j = 0; rs && j < rs.length; j++) {
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
        for (var i = 0; rs && i < rs.length; i++) {
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
        type:             s.log_type,          // string
        deleted:          s.deleted,           // boolean
        updated_at:       moment(s.updated_at) // date and time
    };
    if (s.point) {
        r.point = s.point;                     // int
    }
    var x = {};
    parseJSONLogData(x, s.data);
    if (x.finish) {
        r.finish = x.finish;
    }
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
        data.position = r.position;
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
