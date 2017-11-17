/* -*- js -*- */

goog.provide('tf.serverData');

goog.require('tf');

/**
 * Note that this is not an object b/c this a global property.
 */
tf.serverData.init = function(url) {
    tf.serverData._url = url;
    // The races that I am participating in.
    tf.serverData._races = tf.storage.getCachedRaces();
    // My teams in the races I am participating in.
    tf.serverData._myTeams = tf.storage.getCachedMyTeams();
    // All teams in the regattas I am participating in.
    tf.serverData._teams = tf.storage.getCachedTeams();
};

tf.serverData.update = function(userId) {
    tf.serverAPI.getActiveTeams(userId, function(srvTeams) {
        var myTeams = null;
        if (srvTeams) {
            myTeams = srvTeams.map(tf.serverData.mkTeamData);
        }
        if (myTeams) {
            tf.serverData._myTeams = myTeams;
            tf.storage.setCachedMyTeams(myTeams);
        }
        if (myTeams) {
            tf.serverAPI.getRaces(myTeams, function(srvRaces) {
                var races = null;
                if (srvRaces) {
                    races = srvRaces.map(tf.serverData.mkRaceData);
                }
                if (races) {
                    tf.serverData._races = races;
                    tf.storage.setCachedRaces(races);
                    if (races.length == 1) {
                        // the user is registered for a single race,
                        // make it active
                        if (races[0].id !=
                            tf.storage._settings['activeRaceId']) {
                            tf.state.setActiveRace(races[0].id);
                        }
                    }
                    var rIds = [];
                    for (var i = 0; i < races.length; i++) {
                        var regattaId = races[i].regatta_id;
                        if (rIds.indexOf(regattaId) == -1) {
                            rIds.push(regattaId);
                        }
                    }
                    if (rIds.length > 0) {
                        tf.serverAPI.getTeamsPerRegatta(rIds, function(r) {
                            var teams  = null;
                            if (r) {
                                teams = {};
                                for (regattaId in r) {
                                    teams[regattaId] =
                                        r[regattaId].map(
                                            tf.serverData.mkTeamData);
                                }
                            }
                            if (teams) {
                                tf.serverData._teams = teams;
                                tf.storage.setCachedTeams(teams);
                            }
                        });
                    }
                }
            });
        }
    });
};

tf.serverData.getRacesData = function() {
    return tf.serverData._races;
};

tf.serverData.getRaceData = function(raceId) {
    for (var i = 0; i < tf.serverData._races.length; i++) {
        if (tf.serverData._races[i].id == raceId) {
            return tf.serverData._races[i];
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
        id:             s.id,
        organizer_name: s.organizer_name,
        regatta_name:   s.regatta_name,
        regatta_id:     s.regatta_id,
        start_from:     moment(s.start_from),
        start_to:       moment(s.start_to),
        period:         s.period,
        description:    s.description
    };
    return r;
};

tf.serverData.mkTeamData = function(s) {
    var r = {
        id:               s.id,
        start_number:     s.start_number,
        start_point:      s.start_point,
        race_id:          s.race_id,
        boat_name:        s.boat_name,
        boat_type_name:   s.boat_type_name,
        boat_sail_number: s.boat_sail_number
    };
    return r;
};
