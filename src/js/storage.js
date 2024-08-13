/* -*- js -*- */

import {defaultClientId, isCordova} from './util.js';
import {dbg, debugInfo} from './debug.js';
import {CordovaPromiseFS} from './CordovaPromiseFS.js';

/**
 * This module handles all configuration parameters, state data, and
 * cached data.
 *
 * Note that this is not an object b/c this a global property.
 *
 */

// version 1: app <= 1.0.3
var curVersion = 2;

var raceIds = {};
var raceLogs = {};
var racePlans = {};
var settings = {};
var keys = [];
var cachedRaces = null;
var cachedMyTeams = null;
var cachedTeams = null;
// this will be empty in a browser (except chrome), since it doesn't
// have file storage, and the terrains are too big to be stored in
// localStorage.  this is ok; we'll always fetch them.
var cachedTerrains = {};

var fs = null;

export function initP(doClear) {
    var i, key, raceId;

    if (doClear) {
        window.localStorage.clear();
        cachedTerrains = {};
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
        'numberOfDebugLogEntries': 50, // int() 0-1000
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
            dbg('incompatible storage found; removing all data');
            // try to keep some auth data
            var email = settings.email;
            var password = settings.password;
            var personId = settings.personId;
            var clientId = settings.clientId;

            window.localStorage.clear();
            setDefaultSettings();

            settings.email = email;
            settings.password = password;
            settings.personId = personId;
            settings.clientId = clientId;
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
    for (raceId in raceIds) {
        key = 'raceplan-' + raceId;
        try {
            var racePlan = JSON.parse(window.localStorage.getItem(key));
            racePlans[raceId] = racePlan;
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
            // terrain_id was added to race in 2.3.0.  if the stored
            // race doesn't have a terrain_id, it is old, and is deleted,
            // and will be re-fetched, with terrain_id.
            if (!cachedRaces.data[r][0]['terrain_id']) {
                delete cachedRaces.data[r];
                delete cachedRaces.etags[r];
                continue;
            }
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
        allKeys.push('raceplan-' + raceId);
    }
    var removedKeys = [];
    for (i = 0; i < window.localStorage.length; i++) {
        key = window.localStorage.key(i);
        if (allKeys.indexOf(key) == -1) {
            removedKeys.push(key);
        }
    }
    for (i = 0; i < removedKeys.length; i++) {
        //dbg('removing old stored key ' + key);
        window.localStorage.removeItem(removedKeys[i]);
    }

    /*
     * Try to get a pointer to a filesystem, this will succeed on
     * on cordova and chrome.
     */
    var fileSystem = null;
    if (isCordova) {
        fileSystem = window['cordova'].file.dataDirectory;
    };
    var cfs = CordovaPromiseFS({
        persistent: true,
        fileSystem: fileSystem
    });
    return cfs.fs
        .then(function() {
            // we have a file system!
            fs = cfs;
            debugInfo['filesystem'] = function() {
                var tids = [];
                for (var id in cachedTerrains) {
                    tids.push(id);
                }
                return [{key: 'terrain-files', val: tids.join(', ')}];
            };
            return maybeClearP(fs, doClear)
                .then(function() {
                    return fs.ensure('terrains/');
                })
                .then(function() {
                    return readTerrainsP();
                });
        })
        .catch(function() {
            // no file storage :(
            debugInfo['filesystem'] = 'no storage';
            return new Promise(function(resolve) {
                resolve(true);
            });
        });
};

function maybeClearP(fd, doClear) {
    if (doClear) {
        return fs.removeDir('terrains/');
    } else {
        return new Promise(function(resolve) {
            resolve(true);
        });
    }
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
    var raceLog = raceLogs[raceId];
    if (raceLog) {
        return raceLog.log;
    } else {
        return null;
    }
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

export function getRacePlan(raceId) {
    var racePlan = racePlans[raceId];
    if (racePlan) {
        return racePlan.plans;
    } else {
        return null;
    }
};

export function setRacePlan(raceId, plans) {
    var key = 'raceplan-' + raceId;
    var racePlan = {
        raceId: raceId,
        plans: plans
    };
    window.localStorage.setItem(key, JSON.stringify(racePlan));
    if (!(raceId in raceIds)) {
        raceIds[raceId] = true;
        window.localStorage.setItem('raceIds', JSON.stringify(raceIds));
    }
    racePlans[raceId] = racePlan;
};

// right now unclear when this function is called.  maybe automatic gc, or
// explicit cleanup of old races by the user
/*
function delRaceLog(raceId) {
    var key = 'racelog-' + raceId;
    if (raceId == settings['activeRaceId']) {
        dbg('assertion failure - cannot delete active race');
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
    if (fs) {
        fs.write('terrains/' + terrain.id, terrain)
            .then(function() {
                dbg('wrote file terrains/' + terrain.id);
            })
            .catch(function(e) {
                var estr = 'error writing terrains/' + terrain.id + ' ' + e;
                debugInfo['fserror'] = estr;
                dbg(estr);
            });
    }
};

var tmpTerrainFiles = [];

function readTerrainsP() {
    return fs.list('terrains/', 'f')
        .then(function(files) {
            tmpTerrainFiles = files;
            return readTerrainFilesP();
        })
        .catch(function(e) {
            var estr = 'error reading terrains ' + e;
            debugInfo['fserror'] = estr;
            dbg(estr);
        });
};

function readTerrainFilesP() {
    if (tmpTerrainFiles.length == 0) {
        return true;
    }
    var fname = tmpTerrainFiles.pop();
    return fs.readJSON(fname)
        .then(function(terrain) {
            cachedTerrains[terrain.id] = terrain;
            return readTerrainFilesP();
        });
};

/**
 * Removes "old" terrain files from disk.
 * Returns Promise
 * @resolve :: `retval`
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function gcTerrainsP(keepTerrainIds, retval) {
    var removeTerrainIds = [];
    for (var id in cachedTerrains) {
        // NOTE: cachedTerrains is an object and the key of an object is
        // converted to string, so we need to convert it back to an int
        // for "includes" to work
        var i = id;
        if (typeof(id) == 'string') {
            i = parseInt(id);
        }
        if (!keepTerrainIds.includes(i)) {
            removeTerrainIds.push(id);
        }
    }
    // sort the terrains to remove in ascending order
    removeTerrainIds.sort(function(a, b) { return a-b; });
    // then pop the last one; this means that we keep all the ones that
    // we need to keep + one more
    removeTerrainIds.pop();
    if (removeTerrainIds.length > 0) {
        dbg('removing terrains ' + removeTerrainIds);
    }
    return removeTerrainIdsP(removeTerrainIds, retval);
};

function removeTerrainIdsP(removeTerrainIds, retval) {
    if (removeTerrainIds.length > 0) {
        var id = removeTerrainIds.pop();
        return fs.remove('terrains/' + id)
            .then(function() {
                dbg('successfully removed terrain ' + id);
                delete cachedTerrains[id];
                return removeTerrainIdsP(removeTerrainIds, retval);
            });
    }
    return new Promise(function(resolve) {
        resolve(retval);
    });
}

function mkRace(r) {
    r.start_from = moment(r.start_from);
    r.start_to = moment(r.start_to);
    return r;
};

function mkLog(e) {
    e.time = moment(e.time);
    return e;
};
