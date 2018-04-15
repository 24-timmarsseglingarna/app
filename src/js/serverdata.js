/* -*- js -*- */

goog.provide('tf.serverData');

goog.require('tf');

/**
 * Note that this is not an object b/c this a global property.
 */
tf.serverData.init = function(url) {
    tf.serverData._url = url;
    var m;
    // My teams in the races I am participating in.
    m = tf.storage.getCachedMyTeams() || {data: [], etags: null};
    tf.serverData._myTeams = m.data;
    tf.serverData._myTeamsETag = m.etag;
    // The regatta ids in the regattas I am participating in.
    tf.serverData._myRegattaIds =
        tf.serverData._getRegattaIds(tf.serverData._myTeams);
    // All races in the regattas I am participating in.
    m = tf.storage.getCachedRaces() || {data: {}, etags: {}};
    tf.serverData._races = m.data;
    tf.serverData._racesETags = m.etags;
    // All teams in the regattas I am participating in.
    m = tf.storage.getCachedTeams() || {data: {}, etags: {}};
    tf.serverData._teams = m.data;
    tf.serverData._teamsETags = m.etags;

};

tf.serverData.clearCache = function() {
    tf.serverData._myTeams = [];
    tf.serverData._myTeamsETag = null;
    tf.serverData._myRegattaIds = [];
};

tf.serverData.getNewRegattaLog = function(regattaId, teamId,
                                          lastUpdate, responsefn) {
    tf.serverAPI.getNewRegattaLog(
        regattaId, teamId, lastUpdate,
        function(data, _etag) {
            if (data) {
                var log = data.map(tf.serverData.mkLogSummaryData);
                responsefn(log);
            } else {
                responsefn(null);
            }
        });
};

tf.serverData.getNewMyLog = function(teamId, lastUpdate, responsefn) {
    tf.serverAPI.getNewMyLog(
        teamId, tf.state.clientId.get(), lastUpdate,
        function(data, _etag) {
            if (data) {
                var log = data.map(tf.serverData.mkLogData);
                responsefn(log);
            } else {
                responsefn(null);
            }
        });
};

tf.serverData.postLogEntry = function(teamId, data, responsefn) {
    tf.serverAPI.postLogEntry(
        tf.serverData.mkServerLogData(data, teamId),
        function(res) {
            if (res && res.id) {
                responsefn(res.id, res.gen);
            } else {
                responsefn(null, null);
            }
        });
};

tf.serverData.patchLogEntry = function(logId, data, responsefn) {
    tf.serverAPI.patchLogEntry(
        logId,
        tf.serverData.mkServerLogData(data),
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

tf.serverData._getRegattaIds = function(myTeams) {
    var rIds = [];
    for (var i = 0; i < myTeams.length; i++) {
        var regattaId = myTeams[i].regatta_id;
        if (rIds.indexOf(regattaId) == -1) {
            rIds.push(regattaId);
        }
    }
    return rIds;
};

tf.serverData.update = function(personId, continueFn) {
    tf.serverAPI.getActiveTeams(personId, tf.serverData._myTeamsETag,
    function(srvTeams, myTeamsETag) {
        var myTeams = null;
        if (srvTeams == null) {
            // error, maybe network issues
            continueFn();
            return;
        } else if (srvTeams == 'notmodified') {
            myTeams = tf.serverData._myTeams;
        } else {
            myTeams = srvTeams.map(tf.serverData.mkTeamData);
            if (myTeams) {
                tf.serverData._myTeams = myTeams;
                tf.serverData._myTeamsETag = myTeamsETag;
                tf.storage.setCachedMyTeams({data: myTeams,
                                             etag: myTeamsETag});
            }
        }
        if (myTeams != null) {
            var rIds = tf.serverData._getRegattaIds(myTeams);
            tf.serverData._myRegattaIds = rIds;
            tf.serverAPI.getRacesPerRegatta(
                rIds,
                tf.serverData._racesETags,
                function(r, racesETags) {
                    var races = null;
                    if (r) {
                        races = {};
                        for (var regattaId in r) {
                            if (r[regattaId] == 'notmodified') {
                                races[regattaId] =
                                    tf.serverData._races[regattaId];
                            } else {
                                races[regattaId] =
                                    r[regattaId].map(
                                        tf.serverData.mkRaceData);
                            }
                        }
                    }
                    if (races) {
                        tf.serverData._races = races;
                        tf.serverData._racesETags = racesETags;
                        tf.storage.setCachedRaces({
                            data: races,
                            etags: racesETags});
                    }
                    if (myTeams.length == 1) {
                        // the user is registered for a single race,
                        // make it active
                        tf.state.setActiveRace(myTeams[0].race_id);
                    }
                    tf.serverData.updateTeams(continueFn);
                }
            );
        }
    });
};

tf.serverData.updateTeams = function(continueFn) {
    tf.serverAPI.getTeamsPerRegatta(
        tf.serverData._myRegattaIds,
        tf.serverData._teamsETags,
        function(r, teamsETags) {
            var teams = null;
            if (r) {
                teams = {};
                for (var regattaId in r) {
                    if (r[regattaId] == 'notmodified') {
                        teams[regattaId] =
                            tf.serverData._teams[regattaId];
                    } else {
                        teams[regattaId] =
                            r[regattaId].map(
                                tf.serverData.mkTeamData);
                    }
                }
            }
            if (teams) {
                tf.serverData._teams = teams;
                tf.serverData._teamsETags = teamsETags;
                tf.storage.setCachedTeams({
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
tf.serverData.getMyRaces = function() {
    var r = [];
    for (var i = 0; i < tf.serverData._myTeams.length; i++) {
        var team = tf.serverData._myTeams[i];
        var races = tf.serverData._races[team.regatta_id];
        for (var j = 0; j < races.length; j++) {
            if (races[j].id == team.race_id) {
                r.push({raceData: races[j],
                        teamData: team});
            }
        }
    }
    return r;
};

/**
 * Return: Race data for all races in the given regatta.
 */
tf.serverData.getRacesData = function(regattaId) {
    return tf.serverData._races[regattaId];
};

/**
 * Return: Race data for the given race.
 */
tf.serverData.getRaceData = function(raceId) {
    for (var regattaId in tf.serverData._races) {
        var races = tf.serverData._races[regattaId];
        for (var i = 0; i < races.length; i++) {
            if (races[i].id == raceId) {
                return races[i];
            }
        }
    }
    return null;
};

/**
 * Return: Team data for the team that the logged in user belong to
 * in the given race.
 */
tf.serverData.getMyTeamData = function(raceId) {
    for (var i = 0; i < tf.serverData._myTeams.length; i++) {
        if (tf.serverData._myTeams[i].race_id == raceId) {
            return tf.serverData._myTeams[i];
        }
    }
    return null;
};

/**
 * Return: Team data for all teams in the given regatta.
 */
tf.serverData.getTeamsData = function(regattaId) {
    return tf.serverData._teams[regattaId];
};

/**
 * Return: Team data for the given team in the given regatta.
 */
tf.serverData.getTeamData = function(regattaId, teamId) {
    var teams = tf.serverData._teams[regattaId];
    for (var i = 0; i < teams.length; i++) {
        if (teams[i].id == teamId) {
            return teams[i];
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

tf.serverData.mkTeamData = function(s) {
    var r = {
        id:               s.id,                // int
        start_number:     s.start_number,      // int
        start_point:      s.start_point,       // int
        race_id:          s.race_id,           // int
        regatta_id:       s.regatta_id,        // int
        boat_name:        s.boat_name,         // string
        boat_type_name:   s.boat_type_name,    // string
        boat_sail_number: s.boat_sail_number,  // string
        sxk_handicap:     s.sxk || 2           // float
    };
    return r;
};

tf.serverData.mkRaceData = function(s) {
    var r = {
        id:             s.id,                  // int
        organizer_name: s.organizer_name,      // string
        regatta_name:   s.regatta_name,        // string
        regatta_id:     s.regatta_id,          // int
        start_from:     moment(s.start_from),  // date and time
        start_to:       moment(s.start_to),    // date and time
        common_finish:  s.common_finish,       // null | int (point)
        period:         s.period,              // int (12,24,48,...)
        // FIXME: read from server
        min_period:     s.period - 3,          // int (11,23,43,...)
        description:    s.description          // string
    };
    return r;
};

tf.serverData.mkLogData = function(s) {
    var r = {
        id:               s.id,                // int
        type:             s.log_type,          // string
        time:             moment(s.time),      // date and time
        gen:              s.gen,               // int
        // FIXME: should be user_name; use it to show to user if an entry
        // has been modified on server by someone else
        user:             s.user_id,           // int
        client:           s.client,            // string
        deleted:          s.deleted,           // boolean
    };
    if (s.point) {
        r.point = s.point;                     // int
    }
    tf.serverData.parseJSONLogData(r, s.data);
    return r;
};

tf.serverData.mkLogSummaryData = function(s) {
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
tf.serverData.mkServerLogData = function(r, teamId) {
    // never include the log id in the payload
    // 'user_id' and 'updated_at' are filled in by the server
    var s = {
        // always add our client identifier to entries modified by us
        client: tf.state.clientId.get(),
    };
    if (teamId) { // not set on patch
        s.team_id = teamId;
    }

    if (r.type) {
        s.log_type = r.type;
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
        data.boats = r.boats;
        break;
    case 'endOfRace':
        data.position = r.position;
        break;
    case 'seeOtherBoats':
        data.boats = r.boats;
        break;
    case 'protest':
        data.position = r.position;
        data.protest = r.protest;
        break;
    case 'interrupt':
        // FIXME: patch log_type to interrupt_start vs interrupt_end?
        // Useful if the server is going to be able to calculate proper
        // SXK distance.  rescue-time / rescue-dist is also needed.
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
    case 'other':
        break;
    }
    s.data = JSON.stringify(data);
    return s;
};

tf.serverData.parseJSONLogData = function(r, dataStr) {
    try {
        data = JSON.parse(dataStr);
        // simply copy everything from the data field to the log entry
        for (var k in data) {
            r[k] = data[k];
        }
    } catch (err) {
    }

};
