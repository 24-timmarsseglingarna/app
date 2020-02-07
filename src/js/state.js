/* -*- js -*- */

import {tfAppVsn} from '../../deps/vsn.js';
import {Pod} from './pod.js';
import {Regatta} from './regatta.js';
import {Race} from './race.js';
import {LogBook} from './logbook.js';
import {defineVariable, numberToName, isCordova} from './util.js';
import {initP as initStorageP,
        getSetting, setSettings, getRaceLog, setRaceLog} from './storage.js';
import {loginP as serverAPILoginP, logout as serverAPILogout,
        setStagingServer, setProductionServer,
        getAPIVersionP, validateTokenP} from './serverapi';
import {initP as initServerDataP, updateServerDataP,
        getMyRaces, getRaceData, getMyTeamData, getRacesData, getPod,
        clearCache as clearServerDataCache} from './serverdata.js';
import {debugInfo} from './debug.js';
import {basePodSpec} from '../../build/pod.js';

export var curState = {};

/**
 * This module handles the application state and control, such as:
 *
 *   o  selected race
 *   o  authentication logic
 *   o  plans
 *
 * Note that this is not an object b/c this a global property.
 */


// mode :: 'race'
//       | 'showRegatta'  // experimental
//       | 'logbook'      // NYI
defineVariable(curState, 'mode', null);
defineVariable(curState, 'showRegattaId', null); // if mode == 'showRegatta'
defineVariable(curState, 'planMode', false); // if mode == 'race'

defineVariable(curState, 'curRegatta', null);
defineVariable(curState, 'curRace', null);
defineVariable(curState, 'curLogBook', null);
defineVariable(curState, 'curPlan', null);
defineVariable(curState, 'numberOfPlans', null);
defineVariable(curState, 'clientId', null);
defineVariable(curState, 'fontSize', null);
defineVariable(curState, 'pollInterval', null);
defineVariable(curState, 'sendLogToServer', null);
defineVariable(curState, 'immediateSendToServer', null);
defineVariable(curState, 'serverId', null);
defineVariable(curState, 'loggedInPersonId', null);

/**
 * Initialize ephemeral state variables.
 */

curState.isServerCompatible = null;

// this is initialized at startup by analyzing the log book, if there is one
curState.boatState = {
    'engine': false,
    'lanterns': false
};

// this is initialized at startup by analyzing the log book, if there is one
curState.activeInterrupt = false;

curState.defaultPod = new Pod(basePodSpec);

var platform = null;

// internal timer
var timer = null;

debugInfo['timer'] = function() {
    var val = false;
    if (timer != null) {
        val = true;
    }
    return [{key: 'timer', val: val}];
};

// must be called after device ready since it accesses local files
export function initP() {
    // initialize local storage handler
    return initStorageP(false)
        .then(function() {
            init();
            // initialize server data; doesn't read from the server, but will
            // read cached data from local storage.
            return initServerDataP(curState.clientId);
        });
};

function init() {
    if (isCordova) {
        platform = device.platform;
    } else {
        platform = 'web';
    }
    curState.numberOfPlans.set(getSetting('numberOfPlans'));
    curState.numberOfPlans.onChange(function(val) {
        setSettings({numberOfPlans: val});
        // if the current plan is no longer used; remove it.
        var p = curState.curPlan.get();
        if (p && p.name > numberToName(val)) {
            curState.curPlan.set(null);
        }
    });

    curState.clientId.set(getSetting('clientId'));
    curState.clientId.onChange(function(val) {
        setSettings({clientId: val});
    });

    curState.fontSize.set(getSetting('fontSize'));
    curState.fontSize.onChange(function(val) {
        setSettings({fontSize: val});
    });

    curState.pollInterval.set(getSetting('pollInterval'));
    curState.pollInterval.onChange(function(val) {
        setSettings({pollInterval: val});
        forceTimeout();
    });

    curState.sendLogToServer.set(getSetting('sendLogToServer'));
    curState.sendLogToServer.onChange(function(val) {
        setSettings({sendLogToServer: val});
    });

    curState.immediateSendToServer.set(
        getSetting('immediateSendToServer'));
    curState.immediateSendToServer.onChange(function(val) {
        setSettings({immediateSendToServer: val});
    });

    var serverId = getSetting('serverId');
    curState.serverId.set(serverId);
    curState.serverId.onChange(function(val) {
        if (val == 2) {
            setStagingServer();
        } else {
            setProductionServer();
        }
        setSettings({serverId: val});
        logout();
    });
    if (serverId == 2) {
        setStagingServer();
    } else {
        setProductionServer();
    }

    document.addEventListener('resume', onResume, false);
};

function hasNetwork() {
    return (!isCordova ||
            navigator.connection.type != Connection.NONE);
};

function onResume() {
    forceTimeout();
};

function setTimer() {
    clearTimer();
    var interval = curState.pollInterval.get();
    if (interval > 0) {
        timer = window.setTimeout(timeout,
                                  interval * 1000);
    }
};

function clearTimer() {
    if (timer) {
        window.clearTimeout(timer);
        timer = null;
    }
};

function forceTimeout() {
    clearTimer();
    timeout();
};

function timeout() {
    timer = null;

    debugInfo['poll-timer-fired'] = moment().format();
    var n = debugInfo['poll-timer-n'];
    if (n) {
        n = n + 1;
    } else {
        n = 1;
    }
    debugInfo['poll-timer-n'] = n;

    updateServerDataP(getSetting('personId'))
        .then(function() {
            console.log('updated from server 1');
            serverDataUpdateDone();
            var curRegatta = curState.curRegatta.get();
            if (curRegatta) {
                var curLogBook = curState.curLogBook.get();
                return curRegatta.updateLogFromServerP(curLogBook);
            } else {
                return true;
            }
        })
        .then(function() {
            var curLogBook = curState.curLogBook.get();
            if (curLogBook && curState.sendLogToServer.get()) {
                return curLogBook.sendToServerP();
            }
        })
        .then(function() {
            var curLogBook = curState.curLogBook.get();
            if (curLogBook) {
                return curLogBook.updateFromServerP();
            }
        })
        .then(function() {
            setTimer();
        })
        .catch(function(x) {
            // reset timer also on error
            console.log('log sync error: ' + x);
            console.log(x.stack);
            setTimer();
        });
};

/**
 * We expect the server to return the following json structure:
 *  {
 *     "api_version": "<major>.<minor>.<patch>",
 *     "app_info": {
 *         "require_upgrade": [ {
 *             "platform": "*" | "iOS" | "Android" | "web",
 *             "app_version": <regexp>,
 *             "upgrade_text": <string>, // optional text that will be shown
 *                                       // to the user if os/app-version
 *                                       // matches
 *         } ]
 *  }
 *
 * Returns Promise
 * @resolve :: true | null
 * @reject :: errorStr :: string()
 */
export function checkServerCompatibleP() {
    if (curState.isServerCompatible == true) {
        return new Promise(function(resolve) {
            resolve(true);
        });
    } else {
        return getAPIVersionP()
            .then(function(data) {
                // check for platform / upgrade match
                if (data.app_info && data.app_info.require_upgrade) {
                    var r = data.app_info.require_upgrade;
                    for (var i = 0; i < r.length; i++) {
                        if (r[i].platform == '*' ||
                            r[i].platform == platform) {
                            var re = new RegExp(r[i].app_version);
                            if (re.test(tfAppVsn)) {
                                curState.isServerCompatible = false;
                                throw r[i].upgrade_text;
                            }
                        }
                    }
                }
                if (data.api_version) {
                    var x = data.api_version.split('.');
                    var major = parseInt(x[0]) || 0;
                    if (major == 1) {
                        curState.isServerCompatible = true;
                        return true;
                    } else {
                        // new major version on server
                        curState.isServerCompatible = false;
                        throw '';
                    }
                } else if (data.errorCode == 0) {
                    // connection error, keep going
                    curState.isServerCompatible = null;
                    return null;
                } else if (data.errorStr) {
                    // some other error, treat as non-compatible
                    curState.isServerCompatible = false;
                    throw data.errorStr;
                } else {
                    curState.isServerCompatible = false;
                    throw '';
                }
            });
    }
};

/**
 * Returns Promise
 * @resolve :: true
 * @reject :: false | 'nonetwork' | string()
 */
export function setupLoginP() {
    if (hasNetwork() && curState.isServerCompatible == null) {
        return checkServerCompatibleP()
            .then(function() {
                return setupLogin2();
            });
    } else {
        return new Promise(function(resolve) {
            resolve(setupLogin2());
        });
    }
};

function setupLogin2() {
    // check if we're authenticated and possibly login
    var hasNet = hasNetwork();
    var token = getSetting('token');
    var email = getSetting('email');
    var personId = getSetting('personId');
    if (hasNet && !token) {
        //console.log('has network, no stored token');
        // we haven't logged in
        throw false;
    } else if (hasNet) {
        //console.log('has network and stored token, validate it');
        // validate the token
        return validateTokenP(email, token, personId)
            .then(function(data) {
                // token is valid
                console.log('valid token! role:' + data.role);
                var props = {
                    role: data.role
                };
                setSettings(props);
                onAuthenticatedOnline(personId);
                return true;
            })
            .catch(function() {
                //console.log('has network, invalid token');
                // token invalid, check if the password is stored
                var password = getSetting('password');
                if (password) {
                    //console.log('has stored passwd, login');
                    return serverAPILoginP(email, password)
                        .then(function(response) {
                            //console.log('login ok');
                            var props = {
                                token: response.token,
                                personId: response.personId,
                                role: response.role
                            };
                            setSettings(props);
                            onAuthenticatedOnline(props.personId);
                            return true;
                        })
                        .catch(function() {
                            //console.log('apilogin failed ' + err.errorStr);
                            throw false;
                        });
                } else {
                    // invalid token and no stored password.  try to login
                    throw false;
                }
            });
    } else if (getSetting('token')) {
        //console.log('no network, token');
        // we have a token but no network; continue with the data we have
        return true;
    } else {
        //console.log('no network, no token');
        // no network, no token; not much to do
        throw 'nonetwork';
    }
};

function onAuthenticatedOnline(personId) {
    curState.loggedInPersonId.set(personId);
};

export function setupContinue() {
    var activeRaceId = getSetting('activeRaceId');
    forceTimeout();
    setActiveRace2(activeRaceId);
};

function serverDataUpdateDone() {
    var curActiveRaceId = getSetting('activeRaceId');
    var races = getMyRaces();

    if (races.length == 1 && races[0].raceData.id != curActiveRaceId) {
        // the user is registered for a single race,
        // make it active
        console.log('make race active: ' + races[0].raceData.id);
        activateRace(races[0].raceData.id);
    } else if (getRaceData(curActiveRaceId) == null) {
        // current activeRaceId is not valid
        setActiveRace2(null);
    }
};

export function activateRace(raceId) {
    if (raceId == getSetting('activeRaceId')) {
        return;
    }
    var r = setActiveRace2(raceId);
    // force an update of serverdata when a new race is activated
    forceTimeout();
    return r;
};

function setActiveRace2(raceId) {

    setSettings({activeRaceId: raceId});

    // we need to initialize a new Race object, and swap our
    // curState.cur* variables.
    // if we have data stored for this race, use that when we initialize
    // the Race object.
    // if raceId is 0, reset the curState.cur* variables.

    var raceData = getRaceData(raceId);
    var teamData = getMyTeamData(raceId);
    var pod;
    if (raceData) {
        pod = getPod(raceData.terrain_id);
    }
    if (raceData && teamData && pod) {
        var racesData = getRacesData(raceData.regatta_id);
        var curRegatta = new Regatta(raceData.regatta_id,
                                     raceData.regatta_name,
                                     racesData, pod);
        var curRace = new Race(curRegatta, raceData);
        // get the stored log from the app storage
        var raceLog = getRaceLog(raceId) || {};
        var log = raceLog.log || [];
        var curLogBook = new LogBook(teamData, curRace, log, false);

        curState.boatState.engine = curLogBook.getEngine();
        curState.boatState.lanterns = curLogBook.getLanterns();
        curState.activeInterrupt = curLogBook.getInterrupt();
        curLogBook.onLogUpdate(function(logBook) {
            curState.boatState.engine = logBook.getEngine();
            curState.boatState.lanterns = logBook.getLanterns();
            curState.activeInterrupt = logBook.getInterrupt();
        }, 90);
        curLogBook.onLogUpdate(function(logBook) {
            setRaceLog(logBook.race.getId(), logBook.getLog());
        }, 110);
        curLogBook.onLogUpdate(function(logBook, reason) {
            // communicate with server if the logBook has changed,
            // but not if the update was triggered by server communication!
            if (reason != 'syncError' && reason != 'syncDone' &&
                curState.immediateSendToServer.get()) {
                forceTimeout();
            }
        }, 120);
        curState.curRegatta.set(curRegatta);
        curState.curRace.set(curRace);
        curState.curLogBook.set(curLogBook);
        return true;
    } else {
        if (curState.mode.get() != 'showRegatta') {
            // FIXME: tmp code
            curState.curRegatta.set(null);
        }
        curState.curRace.set(null);
        curState.curLogBook.set(null);
        curState.boatState.engine = false;
        curState.boatState.lanterns = false;
        curState.activeInterrupt = false;
        return false;
    }
};

/**
 * Returns Promise
 * @resolve :: true
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function loginP(email, password, savepassword) {
    return serverAPILoginP(email, password)
        .then(function(response) {
            var props = {
                email: response.email,
                password: response.password,
                token: response.token,
                personId: response.personId,
                savePassword: savepassword
            };
            if (!savepassword) {
                props.password = null;
            }
            setSettings(props);
            onAuthenticatedOnline(props.personId);
            setupContinue();
            return true;
        });
};

export function logout() {
    serverAPILogout();
    var props = {
        email: null,
        password: null,
        token: null,
        personId: null,
        activeRaceId: null
    };
    setSettings(props);
    curState.loggedInPersonId.set(null);
    curState.curRace.set(null);
    curState.curRegatta.set(null);
    curState.curLogBook.set(null);
    curState.curPlan.set(null);
    curState.boatState.engine = false;
    curState.boatState.lanterns = false;
    curState.activeInterrupt = false;
    clearTimer();
    clearServerDataCache();
};

export function reset(keepauth, doLoginFn) {
    var email = getSetting('email');
    var password = getSetting('password');
    var token = getSetting('token');
    var personId = getSetting('personId');
    var clientId = getSetting('clientId');
    logout();
    initStorageP(true)
        .then(function() {
            if (keepauth) {
                var props = {
                    email: email,
                    password: password,
                    token: token,
                    personId: personId,
                    clientId: clientId
                };
            }
            setSettings(props, true);

            curState.numberOfPlans.set(getSetting('numberOfPlans'));
            curState.clientId.set(getSetting('clientId'));
            curState.fontSize.set(getSetting('fontSize'));
            curState.pollInterval.set(getSetting('pollInterval'));
            curState.sendLogToServer.set(getSetting('sendLogToServer'));
            curState.immediateSendToServer.set(
                getSetting('immediateSendToServer'));
            curState.serverId.set(getSetting('serverId'));

            return setupLoginP()
                .catch(function(reason) {
                    if (reason == false) {
                        doLoginFn();
                    }
                });
        });
};
