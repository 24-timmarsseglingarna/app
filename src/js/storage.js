/* -*- js -*- */

goog.provide('tf.storage');

goog.require('tf');

/**
 * This module handles all configuration parameters, state data, and
 * cached data.
 *
 * Note that this is not an object b/c this a global property.
 */

// version 1: app <= 1.0.3
tf.storage._curVersion = 1.1; // FIXME: devel version change to 2 at release

tf.storage.init = function() {
    tf.state.debugInfo['storage'] = function() {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        return [{key: 'storagekeys', val: keys}];
    };

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
         * Identification data
         */
        'clientId': null, // string()

        /*
         * Authentication data
         */
        'email': null, // string()
        'password': null, // string()
        'token': null, // string()
        'personId': null, // integer()

        /*
         * Configuration parameters
         */
        'savePassword': true, // boolean()
        'numberOfPlans': 3, // int() 1-9
        'fontSize': null, // null | 'small' | 'normal' | 'large' | 'x-large'
        'pollInterval': 600, // seconds; int() 0-3600
        'immediateSendToServer': true, // boolean()
        'sendLogToServer': true, // boolean()
        'serverId': 1, // 1 (production) | 2 (staging)

        /*
         * Race data
         */
        'activeRaceId': null // integer()
    };
    var setDefaultSettings = function() {
        tf.storage._settings = defaultSettings;
        tf.storage._settings.clientId = tf.state.defaultClientId();
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
            // handle the case that we don't have a client id
            // we shouldn't end up here except during development
            if (tf.storage._settings['clientId'] == null) {
                tf.storage._settings.clientId = tf.state.defaultClientId();
            }
            tf.storage.setSettings({});
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
            raceLog.log = raceLog.log.map(tf.storage._mkLog);
            tf.storage._raceLogs[raceId] = raceLog;
        } catch (err) {
            // bad data, remove from storage
            localStorage.removeItem(key);
        }
    }

    /*
     * Initialize cached data from local storage.
     */
    tf.storage._cachedRaces = null;
    try {
        tf.storage._cachedRaces =
            JSON.parse(localStorage.getItem('cachedRaces'));
        for (var r in tf.storage._cachedRaces.data) {
            tf.storage._cachedRaces.data[r] =
                tf.storage._cachedRaces.data[r].map(tf.storage._mkRace);
        }
    } catch (err) {
    }
    tf.storage._cachedMyTeams = null;
    try {
        tf.storage._cachedMyTeams =
            JSON.parse(localStorage.getItem('cachedMyTeams'));
    } catch (err) {
    }
    tf.storage._cachedTeams = null;
    try {
        tf.storage._cachedTeams =
            JSON.parse(localStorage.getItem('cachedTeams'));
    } catch (err) {
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

tf.storage._mkRace = function(r) {
    r.start_from = moment(r.start_from);
    r.start_to = moment(r.start_to);
    return r;
};

tf.storage._mkLog = function(e) {
    e.time = moment(e.time);
    return e;
};
