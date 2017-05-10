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
    tf.serverAPI.getActiveTeams(userId, function(myTeams) {
        if (myTeams && myTeams != tf.serverData._myTeams) {
            tf.serverData._myTeams = myTeams;
            tf.storage.setCachedMyTeams(myTeams);
        }
        if (myTeams) {
            console.log('getting races from server');
            tf.serverAPI.getRaces(myTeams, function(races) {
                if (races && races != tf.serverData._races) {
                    console.log('new races');
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
                    var regattaIds = [];
                    for (var i = 0; i < races.length; i++) {
                        var regattaId = races[i].regatta_id;
                        if (regattaIds.indexOf(regattaId) == -1) {
                            regattaIds.push(regattaId);
                        }
                    }
                    if (regattaIds.length > 0) {
                        tf.serverAPI.getTeams(regattaIds, function(teams) {
                            if (teams && teams != tf.serverData._teams) {
                                tf.serverData._teams = teams;
                                tf.storage.setCachedTeams(teams);
                            }
                        });
                    }
                } else {
                    console.log('same races, ignore');
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
