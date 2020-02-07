/* -*- js -*- */

import {defaultClientId, isCordova} from './util.js';
import {debugInfo} from './debug.js';

/**
 * This module handles all configuration parameters, state data, and
 * cached data.
 *
 * Note that this is not an object b/c this a global property.
 */

// version 1: app <= 1.0.3
var curVersion = 2;

var raceIds = {};
var raceLogs = {};
var settings = {};
var keys = [];
var cachedRaces = null;
var cachedMyTeams = null;
var cachedTeams = null;
// this will be empty in a browser, since it doesn't have file
// storage, and the terrains are too big to be stored in localStorage.
// this is ok; we'll always fetch them.
var cachedTerrains = {};

export function initP(doClear) {
    var i, key, raceId;

    if (doClear) {
        window.localStorage.clear();
    };

    debugInfo['storage'] = function() {
        var keys = [];
        for (var i = 0; i < window.localStorage.length; i++) {
            keys.push(window.localStorage.key(i));
        }
        return [{key: 'storagekeys', val: keys.join(', ')}];
    };

    keys = [
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
        settings = JSON.parse(window.localStorage.getItem('settings'));
    } catch (err) {
        debugInfo['bad-settings'] = window.localStorage.getItem('settings');
        settings = null;
    }
    var defaultSettings = {
        /*
         * Meta data
         */
        'version': curVersion, // integer()

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
        'role': null, // 'user' | 'assistant' | 'officer' | 'admin'

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
        settings = defaultSettings;
        settings.clientId = defaultClientId();
        setSettings({});
    };
    if (!settings) {
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
        if (settings.version != curVersion) {
            // we do this during development only
            console.log('incompatible storage found; removing all data');
            window.localStorage.clear();
            setDefaultSettings();
        } else {
            for (key in settings) {
                if (!(key in defaultSettings)) {
                    delete settings[key];
                }
            }
            for (key in defaultSettings) {
                if (!(key in settings)) {
                    settings[key] = defaultSettings[key];
                }
            }
            // handle the case that we don't have a client id
            // we shouldn't end up here except during development
            if (settings['clientId'] == null) {
                settings.clientId = defaultClientId();
            }
            // organizer is changed to officer
            if (settings['role'] == 'organizer') {
                settings['role'] == 'officer';
            }
            setSettings({});
        }
    }

    /*
     * Initialize races from local storage.
     */
    try {
        raceIds = JSON.parse(window.localStorage.getItem('raceIds')) || {};
    } catch (err) {
        // don't use the error
    }
    for (raceId in raceIds) {
        key = 'racelog-' + raceId;
        try {
            var raceLog = JSON.parse(window.localStorage.getItem(key));
            raceLog.log = raceLog.log.map(mkLog);
            raceLogs[raceId] = raceLog;
        } catch (err) {
            // bad data, remove from storage
            window.localStorage.removeItem(key);
        }
    }

    /*
     * Initialize cached data from local storage.
     */
    try {
        cachedRaces =
            JSON.parse(window.localStorage.getItem('cachedRaces'));
        for (var r in cachedRaces.data) {
            cachedRaces.data[r] =
                cachedRaces.data[r].map(mkRace);
        }
    } catch (err) {
        // don't use the error
    }
    try {
        cachedMyTeams =
            JSON.parse(window.localStorage.getItem('cachedMyTeams'));
    } catch (err) {
        // don't use the error
    }
    try {
        cachedTeams =
            JSON.parse(window.localStorage.getItem('cachedTeams'));
    } catch (err) {
        // don't use the error
    }

    /*
     * Remove any old stored key; from an older version of the code.
     */
    var allKeys = keys;
    for (raceId in raceIds) {
        allKeys.push('racelog-' + raceId);
    }
    var removedKeys = [];
    for (i = 0; i < window.localStorage.length; i++) {
        key = window.localStorage.key(i);
        if (allKeys.indexOf(key) == -1) {
            removedKeys.push(key);
        }
    }
    for (i = 0; i < removedKeys.length; i++) {
        //console.log('removing old stored key ' + key);
        window.localStorage.removeItem(removedKeys[i]);
    }

    if (isCordova) {
        // read terrains from file storage
    }

    // in preparation for async file storage api we return a promise
    return new Promise(function(resolve) {
        resolve(true);
    });
};

export function getSetting(key) {
    return settings[key];
};

export function setSettings(props) {
    for (var key in props) {
        settings[key] = props[key];
    }
    window.localStorage.setItem('settings', JSON.stringify(settings));
};

/*
 * A raceLog is an object with the following keys:
 *   'raceId'   // integer()
 *   'log'      // LogBook().log
 */

export function getRaceLog(raceId) {
    return raceLogs[raceId];
};

export function setRaceLog(raceId, log) {
    var key = 'racelog-' + raceId;
    var raceLog = {
        raceId: raceId,
        log: log
    };
    window.localStorage.setItem(key, JSON.stringify(raceLog));
    if (!(raceId in raceIds)) {
        raceIds[raceId] = true;
        window.localStorage.setItem('raceIds', JSON.stringify(raceIds));
    }
    raceLogs[raceId] = raceLog;
};

// right now unclear when this function is called.  maybe automatic gc, or
// explicit cleanup of old races by the user
/*
function delRaceLog(raceId) {
    var key = 'racelog-' + raceId;
    if (raceId == settings['activeRaceId']) {
        console.log('assertion failure - cannot delete active race');
        return false;
    }
    window.localStorage.removeItem(key);
    if (raceId in raceIds) {
        delete raceIds[raceId];
        window.localStorage.setItem('raceIds', JSON.stringify(raceIds));
    }
    delete raceLogs[raceId];
};
*/

export function getCachedRaces() {
    return cachedRaces;
};
export function setCachedRaces(races) {
    cachedRaces = races;
    window.localStorage.setItem('cachedRaces', JSON.stringify(races));
};

export function getCachedMyTeams() {
    return cachedMyTeams;
};
export function setCachedMyTeams(teams) {
    cachedMyTeams = teams;
    window.localStorage.setItem('cachedMyTeams', JSON.stringify(teams));
};

export function getCachedTeams() {
    return cachedTeams;
};
export function setCachedTeams(teams) {
    cachedTeams = teams;
    window.localStorage.setItem('cachedTeams', JSON.stringify(teams));
};

export function getCachedTerrain(terrainId) {
    return cachedTerrains[terrainId];
};

export function setCachedTerrain(terrain) {
    cachedTerrains[terrain.id] = terrain;
};


function mkRace(r) {
    r.start_from = moment(r.start_from);
    r.start_to = moment(r.start_to);
    return r;
};

function mkLog(e) {
    e.time = moment(e.time);
    return e;
};
