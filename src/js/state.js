/* -*- js -*- */

goog.provide('tf.state');

goog.require('tf');
goog.require('tf.plan');
goog.require('tf.serverData');
goog.require('tf.storage');

/**
 * This module handles the application state and control, such as:
 *
 *   o  selected race
 *   o  authentication logic
 *   o  plans
 *
 * Note that this is not an object b/c this a global property.
 */


//tf.defineVariable('curRace', null);
//tf.defineVariable('curLogBook', null);
tf.defineVariable(tf.state, 'curPlan', null);
tf.defineVariable(tf.state, 'numberOfPlans', null);
tf.defineVariable(tf.state, 'fontSize', null);
tf.defineVariable(tf.state, 'pollInterval', null);

/**
 * Initialize ephemeral state variables.
 */

tf.state.curRace = null;
tf.state.curRegatta = null;
tf.state.curLogBook = null;

tf.state.clientId = null;

// this is initialized at startup by analyzing the log book, if there is one
tf.state.boatState = {
    'engine': false,
    'lanterns': false
};

// this is initialized at startup by analyzing the log book, if there is one
tf.state.activeInterrupt = false;

tf.state.defaultPod = new tf.Pod(basePodSpec);

tf.state.isLoggedIn = false;

tf.state.isCordova = 'cordova' in window;

// internal timer
tf.state._timer = null;

tf.state.debugInfo = {};

tf.state.init = function() {
    // initialize local storage handler
    tf.storage.init();
    tf.state.clientId = tf.storage.getSetting('clientId');

    tf.state.numberOfPlans.set(tf.storage.getSetting('numberOfPlans'));
    tf.state.numberOfPlans.onChange(function(val) {
        tf.storage.setSettings({numberOfPlans: val});
        // if the current plan is no longer used; remove it.
        var p = tf.state.curPlan.get();
        if (p && p.name > tf.plan.numberToName(val)) {
            tf.state.curPlan.set(null);
        }
    });

    tf.state.fontSize.set(tf.storage.getSetting('fontSize'));
    tf.state.fontSize.onChange(function(val) {
        tf.storage.setSettings({fontSize: val});
    });

    tf.state.pollInterval.set(tf.storage.getSetting('pollInterval'));
    tf.state.pollInterval.onChange(function(val) {
        tf.storage.setSettings({pollInterval: val});
        tf.state.setTimer();
    });

    // initialize server data; doesn't read from the server, but will
    // read cached data from local storage.
    tf.serverData.init();
};

tf.state.hasNetwork = function() {
    return (!tf.state.isCordova ||
            navigator.connection.type != Connection.NONE);
};

tf.state.setTimer = function() {
    tf.state.clearTimer();
    var interval = tf.state.pollInterval.get();
    if (interval > 0) {
        tf.state._timer = window.setTimeout(tf.state._timeout,
                                            interval * 1000);
    }
};

tf.state.clearTimer = function() {
    if (tf.state._timer) {
        window.clearInterval(tf.state._timer);
        tf.state._timer = null;
    }
};

tf.state._timeout = function() {
    tf.state._timer = null;

    tf.state.debugInfo['poll-timer-fired'] = moment().format();
    var n = tf.state.debugInfo['poll-timer-n'];
    if (n) {
        n = n + 1;
    } else {
        n = 1;
    }
    tf.state.debugInfo['poll-timer-n'] = n;

    var cfn3 = function() {
        tf.state.setTimer();
    };

    var cfn2 = function() {
        if (tf.state.curLogBook) {
            tf.state.curLogBook.updateFromServer(cfn3);
        } else {
            cfn3();
        }
    };

    var cfn1 = function() {
        if (tf.state.curLogBook) {
            tf.state.curLogBook.sendToServer(cfn2);
        } else {
            cfn2();
        }
    };

    var cfn0 = function() {
        tf.state.serverDataUpdateDone();
        tf.ui.logBookChanged();
        if (tf.state.curRegatta) {
            tf.state.curRegatta.updateLogFromServer(cfn1);
        } else {
            cfn1();
        }
    };

    tf.serverData.update(tf.storage.getSetting('personId'), cfn0);
};

tf.state.setupLogin = function(continueFn) {
    // check if we're authenticated and possibly login
    var hasNetwork = tf.state.hasNetwork();
    var token = tf.storage.getSetting('token');
    var email = tf.storage.getSetting('email');
    if (hasNetwork && !tf.storage.getSetting('token')) {
        //console.log('has network, no stored token');
        // we haven't logged in
        tf.ui.loginPage.openPage();
        continueFn();
    } else if (hasNetwork) {
        //console.log('has network and stored token, validate it');
        // validate the token
        if (!tf.serverAPI.validateToken(email, token)) {
            //console.log('has network, invalid token');
            // token invalid, check if the password is stored
            var password = tf.storage.getSetting('password');
            if (password) {
                //console.log('has stored passwd, login');
                tf.serverAPI.login(email, password, function(response) {
                    if (response) {
                        //console.log('login ok');
                        props = {
                            token: response.token,
                            personId: response.personId
                        };
                        tf.storage.setSettings(props);
                        tf.state.onAuthenticatedOnline(continueFn);
                    } else {
                        // saved login not ok
                        tf.ui.loginPage.openPage();
                        continueFn();
                    }
                });
            } else {
                // invalid token and no stored password.  try to login
                tf.ui.loginPage.openPage();
                continueFn();
            }
        } else {
            // token is valid
            //console.log('has network, valid token');
            tf.state.onAuthenticatedOnline(continueFn);
        }
    } else if (tf.storage.getSetting('token')) {
        //console.log('no network, token');
        // we have a token but no network; continue with the data we have
        tf.state._setupContinue(continueFn);
    } else {
        //console.log('no network, no token');
        // no network, no token; not much to do
        tf.ui.alert('<p>Det finns inget nätverk.  Du måste logga in när ' +
                    'du har nätverk.</p>');
        continueFn();
    }
};

tf.state.onAuthenticatedOnline = function(continueFn) {
    tf.state.isLoggedIn = true;
    tf.state.setTimer();
    tf.state._timeout();
    // we'll first start from cached data; if things have been updated on
    // the server, we might change active race when we get the reply.
    tf.state._setupContinue(continueFn);
};

tf.state.serverDataUpdateDone = function() {
    // check if the current activeRaceId is still valid
    var curActiveRaceId = tf.storage.getSetting('activeRaceId');
    if (tf.serverData.getRaceData(curActiveRaceId) == null) {
        tf.state._setActiveRace2(null);
    }
};

tf.state._setupContinue = function(continueFn) {

    var activeRaceId = tf.storage.getSetting('activeRaceId');

    tf.state._setActiveRace2(activeRaceId, continueFn);
};

tf.state.setActiveRace = function(raceId, continueFn) {
    if (raceId == tf.storage.getSetting('activeRaceId')) {
        return;
    }
    tf.state._setActiveRace2(raceId, continueFn);
};

tf.state._setActiveRace2 = function(raceId, continueFn) {

    tf.storage.setSettings({activeRaceId: raceId});

    // we need to initialize a new Race object, and swap our
    // tf.state.cur* variables.
    // if we have data stored for this race, use that when we initialize
    // the Race object.
    // if raceId is 0, reset the tf.state.cur* variables.

    var raceData = tf.serverData.getRaceData(raceId);
    var teamData = tf.serverData.getMyTeamData(raceId);
    if (raceData && teamData) {
        // FIXME: the pod should be more dynamic; it can change on the server
        var tmpPod = tf.state.defaultPod;
        var racesData = tf.serverData.getRacesData(raceData.regatta_id);
        tf.state.curRegatta = new tf.Regatta(raceData.regatta_id,
                                             racesData, tmpPod);
        tf.state.curRace = new tf.Race(tf.state.curRegatta, raceData);
        // get the stored log from the app storage
        var raceLog = tf.storage.getRaceLog(raceId) || {};
        var log = raceLog.log || [];
        tf.state.curLogBook = new tf.LogBook(teamData, tf.state.curRace, log);

        tf.state.boatState.engine = tf.state.curLogBook.getEngine();
        tf.state.boatState.lanterns = tf.state.curLogBook.getLanterns();
        tf.state.activeInterrupt = tf.state.curLogBook.getInterrupt();
        tf.state.curLogBook.onLogUpdate(function(logBook) {
            tf.state.boatState.engine = logBook.getEngine();
            tf.state.boatState.lanterns = logBook.getLanterns();
            tf.state.activeInterrupt = logBook.getInterrupt();
        }, 90);
        tf.state.curLogBook.onLogUpdate(tf.ui.logBookChanged, 100);
        tf.state.curLogBook.onLogUpdate(function(logBook) {
            tf.storage.setRaceLog(logBook.race.getId(), logBook.getLog());
        }, 110);
        if (continueFn) {
            continueFn();
        }
    } else {
        tf.state.curRegatta = null;
        tf.state.curRace = null;
        tf.state.curLogBook = null;
        tf.state.boatState.engine = false;
        tf.state.boatState.lanterns = false;
        tf.state.activeInterrupt = false;
        if (continueFn) {
            continueFn();
        }
    }
};

tf.state.login = function(email, password, savepassword, responsefn) {
    tf.serverAPI.login(
        email, password,
        function (response) {
            if (response) {
                props = {
                    email: response.email,
                    password: response.password,
                    token: response.token,
                    personId: response.personId,
                    savePassword: savepassword
                };
                if (!savepassword) {
                    props.password = null;
                }
                tf.storage.setSettings(props);
                tf.state.onAuthenticatedOnline(function() {
                    tf.ui.logBookChanged();
                });
                responsefn(true);
            } else {
                responsefn(false);
            }
        });
};

tf.state.logout = function() {
    tf.serverAPI.logout();
    props = {
        email: null,
        password: null,
        token: null,
        personId: null,
        activeRaceId: null
    };
    tf.storage.setSettings(props);
    tf.state.isLoggedIn = false;
    tf.state.curRace = null;
    tf.state.curRegatta = null;
    tf.state.curLogBook = null;
    tf.state.curPlan.set(null);
    tf.state.boatState.engine = false;
    tf.state.boatState.lanterns = false;
    tf.state.activeInterrupt = false;
    tf.state.clearTimer();
    tf.serverData.clearCache();

    tf.ui.logBookChanged();
};

tf.state.sendLogBook = function(logBook) {
};
