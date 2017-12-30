/* -*- js -*- */

goog.provide('tf.serverData');

goog.require('tf');

/**
 * Note that this is not an object b/c this a global property.
 */
tf.serverData.init = function(url) {
    tf.serverData._url = url;
    // The races that I am participating in.
    var m;
    m = tf.storage.getCachedMyRaces() || {data: [], etags: {}};
    tf.serverData._myRaces = m.data;
    tf.serverData._myRacesETags = m.etags;
    // All races in the regattas I am participating in.
    m = tf.storage.getCachedRaces() || {data: {}, etags: {}};
    tf.serverData._races = m.data;
    tf.serverData._racesETags = m.etags;
    // My teams in the races I am participating in.
    m = tf.storage.getCachedMyTeams() || {data: [], etags: null};
    tf.serverData._myTeams = m.data;
    tf.serverData._myTeamsETag = m.etag;
    // All teams in the regattas I am participating in.
    m = tf.storage.getCachedTeams() || {data: {}, etags: {}};
    tf.serverData._teams = m.data;
    tf.serverData._teamsETags = m.etags;
};

tf.serverData.update = function(userId) {
    tf.serverAPI.getActiveTeams(userId, tf.serverData._myTeamsETag,
                                function(srvTeams, myTeamsETag) {
        var myTeams = null;
        if (srvTeams == null) {
            // error, maybe network issues
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
        if (myTeams) {
            var tIds = [];
            for (var i = 0; i < myTeams.length; i++) {
                tIds.push(myTeams[i].id);
            }
            tf.serverAPI.getRaces(tIds, tf.serverData._myRacesETags,
                                  function(srvRaces, myRacesETags) {
                var myRaces = null;
                if (srvRaces == null) {
                    // error, maybe network issues
                    return;
                } else {
                    myRaces = [];
                    for (var i = 0; i < tIds.length; i++) {
                        tId = tIds[i];
                        var srvRace = srvRaces[tId];
                        if (srvRace == 'notmodified') {
                            myRaces.push(tf.serverData.getRaceFromTeam(tId));
                        } else {
                            myRaces = myRaces.concat(srvRace.map(
                                tf.serverData.mkRaceData));
                        }
                    }
                    tf.serverData._myRaces = myRaces;
                    tf.serverData._myRacesETags = myRacesETags;
                    tf.storage.setCachedMyRaces({data: myRaces,
                                                 etags: myRacesETags});
                    var rIds = [];
                    for (var i = 0; i < myRaces.length; i++) {
                        var regattaId = myRaces[i].regatta_id;
                        if (rIds.indexOf(regattaId) == -1) {
                            rIds.push(regattaId);
                        }
                    }
                    if (rIds.length > 0) {
                        tf.serverAPI.getTeamsPerRegatta(
                            rIds,
                            tf.serverData._teamsETags,
                            function(r, teamsETags) {
                                var teams = null;
                                if (r) {
                                    teams = {};
                                    for (regattaId in r) {
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
                            });
                        tf.serverAPI.getRacesPerRegatta(
                            rIds,
                            tf.serverData._racesETags,
                            function(r, racesETags) {
                                var races = null;
                                if (r) {
                                    races = {};
                                    for (regattaId in r) {
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
                                }});
                    }
                    if (myRaces.length == 1) {
                        // the user is registered for a single race,
                        // make it active
                        if (myRaces[0].id !=
                            tf.storage._settings['activeRaceId']) {
                            tf.state.setActiveRace(myRaces[0].id);
                        }
                    }
                }
            });
        }
    });
};

tf.serverData.getMyRacesData = function() {
    return tf.serverData._myRaces;
};

tf.serverData.getRacesData = function(regattaId) {
    return tf.serverData._races[regattaId];
};

tf.serverData.getMyRaceData = function(raceId) {
    for (var i = 0; i < tf.serverData._myRaces.length; i++) {
        if (tf.serverData._myRaces[i].id == raceId) {
            return tf.serverData._myRaces[i];
        }
    }
    return null;
};

tf.serverData.getMyTeamData = function(raceId) {
    for (var i = 0; i < tf.serverData._myTeams.length; i++) {
        if (tf.serverData._myTeams[i].race_id == raceId) {
            return tf.serverData._myTeams[i];
        }
    }
    return null;
};

tf.serverData.getRaceFromTeam = function(tId) {
    var raceId = null;
    for (var i = 0; i < tf.serverData._myTeams.length; i++) {
        if (tf.serverData._myTeams[i].id == tId) {
            raceId = tf.serverData._myTeams[i].race_id;
        }
    }
    for (var i = 0; i < tf.serverData._myRaces.length; i++) {
        if (tf.serverData._myRaces[i].id == raceId) {
            return tf.serverData._myRaces[i];
        }
    }
    return null;
};

tf.serverData.getTeamsData = function(regattaId) {
    return tf.serverData._teams[regattaId];
};


/**
 * Data Conversion Functions
 *
 * These functions map from the server representation to the internal
 * representation.  In most cases the internal representation is just a
 * subset of the server representation.
 */

tf.serverData.mkRaceData = function(s) {
    var r = {
        id:             s.id,                  // int
        organizer_name: s.organizer_name,      // string
        regatta_name:   s.regatta_name,        // string
        regatta_id:     s.regatta_id,          // int
        start_from:     moment(s.start_from),  // date and time
        start_to:       moment(s.start_to),    // date and time
        period:         s.period,              // int (12,24,48,...)
        description:    s.description          // string
    };
    return r;
};

tf.serverData.mkTeamData = function(s) {
    var r = {
        id:               s.id,                // int
        start_number:     s.start_number,      // int
        start_point:      s.start_point,       // int
        race_id:          s.race_id,           // int
        boat_name:        s.boat_name,         // string
        boat_type_name:   s.boat_type_name,    // string
        boat_sail_number: s.boat_sail_number,  // string
        sxk_handicap:     s.sxk || 1           // float
    };
    return r;
};

tf.serverData.mkLogData = function(s) {
    var r = {
        id:               s.id,                // int
        type:             s.log_type,          // string
        time:             moment(s.time),      // date and time
        point:            s.point,             // int
        gen:              s.gen,               // int
        user_id:          s.user_id,           // int
        client:           s.client,            // string
        deleted:          s.deleted,           // boolean
    };
    parse_json_log_data(r, s.data);
    return r;
}

tf.serverData.mkLogSummaryData = function(s) {
    var r = {
        id:               s.id,                // int
        time:             moment(s.time),      // date and time
        point:            s.point,             // int
        deleted:          s.deleted,           // boolean
        updated_at:       moment(s.updated_at) // date and time
    };
    return r;
}
