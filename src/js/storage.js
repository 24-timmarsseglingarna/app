/* -*- js -*- */

goog.provide('tf.storage');

goog.require('tf');

/**
 * This module handles all configuration parameters, state data, and
 * cached data.
 *
 * Note that this is not an object b/c this a global property.
 */

tf.storage._curVersion = 1;

tf.storage.init = function() {
    tf.storage._keys = [
        'settings',      // configuration parameters and state data
        'raceIds',       // for each id, there is state data 'racelog-<id>'
        'cachedRaces',   // cached data from server
        'cachedMyTeams', // cached data from server
        'cachedTeams'    // cached data from server
    ];

    /*
     * Initialize settings from local storage.
     */
    try {
        tf.storage._settings = JSON.parse(localStorage.getItem('settings'));
    } catch (err) {
        tf.storage._settings = null;
    }
    var defaultSettings = {
        /*
         * Meta data
         */
        'version': tf.storage._curVersion, // integer()

        /*
         * Authentication data
         */
        'email': null, // string()
        'password': null, // string()
        'token': null, // string()
        'userId': null, // integer()

        /*
         * Configuration parameters
         */
        'savePassword': true, // boolean()

        /*
         * Race data
         */
        'activeRaceId': null // integer()
    };
    var setDefaultSettings = function() {
        tf.storage._settings = defaultSettings;
        tf.storage.setSettings({});
    };
    if (!tf.storage._settings) {
        setDefaultSettings();
    } else {
        /*
         * We found existing data.  Make sure the format matches
         * the current format - delete unknown keys and add new with
         * their default values.
         *
         * If we need special upgrade code in future releases it goes
         * here.
         *
         * First of all, if the stored data is not backwards compatible,
         * delete all stored data.
         */
        if (tf.storage._settings.version != tf.storage._curVersion) {
            // we do this during development only
            console.log('incompatible storage found; removing all data');
            localStorage.clear();
            setDefaultSettings();
        } else {
            for (var key in tf.storage._settings) {
                if (!(key in defaultSettings)) {
                    delete tf.storage._settings[key];
                }
            }
            for (var key in defaultSettings) {
                if (!(key in tf.storage._settings)) {
                    tf.storage._settings[key] = defaultSettings[key];
                }
            }
        }
    }

    /*
     * Initialize races from local storage.
     */
    try {
        tf.storage._raceIds = JSON.parse(localStorage.getItem('raceIds')) || {};
    } catch (err) {
        tf.storage._raceIds = {};
    }
    tf.storage._raceLogs = {};
    for (var raceId in tf.storage._raceIds) {
        var key = 'racelog-' + raceId;
        try {
            var raceLog = JSON.parse(localStorage.getItem(key));
            tf.storage._raceLogs[raceId] = raceLog;
        } catch (err) {
            // bad data, remove from storage
            localStorage.removeItem(key);
        }
    }

    /*
     * Initialize cached data from local storage.
     */
    try {
        tf.storage._cachedRaces =
            JSON.parse(localStorage.getItem('cachedRaces')) || [];
    } catch (err) {
        tf.storage._cachedRaces = [];
    }
    try {
        tf.storage._cachedMyTeams =
            JSON.parse(localStorage.getItem('cachedMyTeams')) || [];
    } catch (err) {
        tf.storage._cachedMyTeams = [];
    }
    try {
        tf.storage._cachedTeams =
            JSON.parse(localStorage.getItem('cachedTeams')) || {};
    } catch (err) {
        tf.storage._cachedTeams = {};
    }

    /*
     * Remove any old stored key; from an older version of the code.
     */
    var allKeys = tf.storage._keys;
    for (var raceId in tf.storage._raceIds) {
        allKeys.push('racelog-' + raceId);
    }
    var removedKeys = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (allKeys.indexOf(key) == -1) {
            removedKeys.push(key);
        }
    }
    for (var i = 0; i < removedKeys.length; i++) {
        //console.log('removing old stored key ' + key);
        localStorage.removeItem(removedKeys[i]);
    }
};

tf.storage.getSetting = function(key) {
    return tf.storage._settings[key];
};

tf.storage.setSettings = function(props) {
    for (var key in props) {
        tf.storage._settings[key] = props[key];
    }
    localStorage.setItem('settings', JSON.stringify(tf.storage._settings));
};

/*
 * A raceLog is an object with the following keys:
 *   'raceId'   // integer()
 *   'log'      // LogBook().log
 */

tf.storage.getRaceLog = function(raceId) {
    return tf.storage._raceLogs[raceId];
};

tf.storage.setRaceLog = function(raceId, log) {
    var key = 'racelog-' + raceId;
    var raceLog = {
        raceId: raceId,
        log: log
    };
    localStorage.setItem(key, JSON.stringify(raceLog));
    if (!(raceId in tf.storage._raceIds)) {
        tf.storage._raceIds[raceId] = true;
        localStorage.setItem('raceIds', JSON.stringify(tf.storage._raceIds));
    }
    tf.storage._raceLogs[raceId] = raceLog;
};

// right now unclear when this function is called.  maybe automatic gc, or
// explicit cleanup of old races by the user
tf.storage.delRaceLog = function(raceId) {
    var key = 'racelog-' + raceId;
    if (raceId == tf.storage._settings['activeRaceId']) {
        console.log('assertion failure - cannot delete active race');
        return false;
    }
    localStorage.removeItem(key);
    if (raceId in tf.storage._raceIds) {
        delete tf.storage._raceIds[raceId];
        localStorage.setItem('raceIds', JSON.stringify(tf.storage._raceIds));
    }
    delete tf.storage._raceLogs[raceId];
};

tf.storage.getCachedRaces = function() {
    return tf.storage._cachedRaces;
};
tf.storage.setCachedRaces = function(races) {
    tf.storage._cachedRaces = races;
    localStorage.setItem('cachedRaces', JSON.stringify(races));
};

tf.storage.getCachedMyTeams = function() {
    return tf.storage._cachedMyTeams;
};
tf.storage.setCachedMyTeams = function(teams) {
    tf.storage._cachedMyTeams = teams;
    localStorage.setItem('cachedMyTeams', JSON.stringify(teams));
};

tf.storage.getCachedTeams = function() {
    return tf.storage._cachedTeams;
};
tf.storage.setCachedTeams = function(teams) {
    tf.storage._cachedTeams = teams;
    localStorage.setItem('cachedTeams', JSON.stringify(teams));
};
