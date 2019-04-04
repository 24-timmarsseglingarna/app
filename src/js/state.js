/* -*- js -*- */

import {tfAppVsn} from '../../deps/vsn.js';
import {Pod} from './pod.js';
import {Regatta} from './regatta.js';
import {Race} from './race.js';
import {LogBook} from './logbook.js';
import {defineVariable, numberToName, isCordova} from './util.js';
import {init as initStorage,
        getSetting, setSettings, getRaceLog, setRaceLog} from './storage.js';
import {login as serverAPILogin, logout as serverAPILogout,
        setStagingServer, setProductionServer,
        getAPIVersion, validateToken} from './serverapi';
import {init as initServerData, updateServerData,
        getMyRaces, getRaceData, getMyTeamData, getRacesData,
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
export function init() {
    // initialize local storage handler
    initStorage(false);

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

    // initialize server data; doesn't read from the server, but will
    // read cached data from local storage.
    initServerData(curState.clientId);
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

    /*
    updateServerData(getSetting('personId'))
        .then(function() {
            var curLogBook = curState.curLogBook.get();
            if (curLogBook && curState.sendLogToServer.get()) {
                return curLogBook.sendToServer();
            }
        })
        .then(function() {
            var curLogBook = curState.curLogBook.get();
            if (curLogBook) {
                return curLogBook.updateFromServer();
            }
        })
        .then(function() {
            setTimer();
        })
        .catch(function() {
            // reset timer also on error
            setTimer();
        });
    */


    var cfn3 = function() {
        setTimer();
    };

    var cfn2 = function() {
        var curLogBook = curState.curLogBook.get();
        if (curLogBook) {
            curLogBook.updateFromServer(cfn3);
        } else {
            cfn3();
        }
    };

    var cfn1 = function() {
        var curLogBook = curState.curLogBook.get();
        if (curLogBook && curState.sendLogToServer.get()) {
            curLogBook.sendToServer(cfn2);
        } else {
            cfn2();
        }
    };

    var cfn0 = function() {
        serverDataUpdateDone();
        var curRegatta = curState.curRegatta.get();
        if (curRegatta) {
            curRegatta.updateLogFromServer(cfn1, curState.curLogBook.get());
        } else {
            cfn1();
        }
    };

    updateServerData(getSetting('personId'), cfn0);
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
 * This function calls responseFn(true | { errorStr: <string> })
 */
export function checkServerCompatible() {
    if (curState.isServerCompatible == true) {
        return new Promise(function(resolve) {
            resolve(true);
        });
    } else {
        return getAPIVersion()
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
                                throw { errorStr: r[i].upgrade_text };
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
                        throw { errorStr: '' };
                    }
                } else if (data.errorCode == 0) {
                    // connection error, keep going
                    curState.isServerCompatible = null;
                    return null;
                } else if (data.errorStr) {
                    // some other error, treat as non-compatible
                    curState.isServerCompatible = false;
                    throw data;
                } else {
                    curState.isServerCompatible = false;
                    throw { errorStr: '' };
                }
            });
    }
};

/*
 * responseFn is called with:
 *    true - if we're successfully logged in with the stored credentials
 *    false - if we need to log in
 *    'nonetwork' - if there is no network
 *    <errorstring>
 */

/*
 * continueFn is always called, regardless of result, after
 *              all communication is done.
 *            it *may* be called with a parameter 'result', which
 *              in that case is an object: { errorStr: <string> }
 * doLoginFn is called if the saved values for email/token/password
 *           were not valid.  it is supposed to display a login page
 */
export function setupLogin() {
    if (hasNetwork() && curState.isServerCompatible == null) {
        return checkServerCompatible()
            .then(setupLogin2);
    } else {
        return new Promise(function(resolve) {
            resolve(setupLogin2());
        });
    }
};

function setupLogin2() {
    // check if we're authenticated and possibly login
    var hasNetworkP = hasNetwork();
    var token = getSetting('token');
    var email = getSetting('email');
    var personId = getSetting('personId');
    if (hasNetworkP && !token) {
        //console.log('has network, no stored token');
        // we haven't logged in
        throw false;
    } else if (hasNetworkP) {
        //console.log('has network and stored token, validate it');
        // validate the token
        return validateToken(email, token, personId)
            .then(function(response) {
                // token is valid
                //console.log('valid token!');
                var props = {
                    role: response.role
                };
                setSettings(props);
                onAuthenticatedOnline(personId);
                return true;
            })
            .catch(function() {
                console.log('has network, invalid token');
                // token invalid, check if the password is stored
                var password = getSetting('password');
                if (password) {
                    //console.log('has stored passwd, login');
                    return serverAPILogin(
                        email, password,
                        function(response) {
                            if (response.token) {
                                //console.log('login ok');
                                var props = {
                                    token: response.token,
                                    personId: response.personId,
                                    role: response.role
                                };
                                setSettings(props);
                                onAuthenticatedOnline(props.personId);
                                return true;
                            } else {
                                // saved login not ok
                                throw false;
                            }
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

// FIXME: rename and move from state.js
// this function is called from ui.js
export function setupContinue(continueFn) {
    var activeRaceId = getSetting('activeRaceId');
    forceTimeout();
    setActiveRace2(activeRaceId, continueFn);
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
    setActiveRace2(raceId, function() {
        // force an update of serverdata when a new race is activated
        forceTimeout();
    });
};

function setActiveRace2(raceId, continueFn) {

    setSettings({activeRaceId: raceId});

    // we need to initialize a new Race object, and swap our
    // curState.cur* variables.
    // if we have data stored for this race, use that when we initialize
    // the Race object.
    // if raceId is 0, reset the curState.cur* variables.

    var raceData = getRaceData(raceId);
    var teamData = getMyTeamData(raceId);
    if (raceData && teamData) {
        // FIXME: the pod should be more dynamic; it can change on the server
        var tmpPod = curState.defaultPod;
        var racesData = getRacesData(raceData.regatta_id);
        var curRegatta = new Regatta(raceData.regatta_id,
                                     raceData.regatta_name,
                                     racesData, tmpPod);
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
        if (continueFn) {
            continueFn();
        }
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
        if (continueFn) {
            continueFn();
        }
    }
};

export function login(email, password, savepassword, responsefn) {
    serverAPILogin(
        email, password,
        function(response) {
            if (response.token) {
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
                responsefn(true);
            } else {
                responsefn(response);
            }
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
    initStorage(true);
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
    curState.immediateSendToServer.set(getSetting('immediateSendToServer'));
    curState.serverId.set(getSetting('serverId'));

    setupLogin(function(response) {
        if (response == false) {
            doLoginFn();
        }
    });
};
