/* -*- js -*- */

goog.provide('tf.state');

goog.require('tf');
goog.require('tf.serverData');
goog.require('tf.storage');
goog.require('tf.plan');

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

    // initialize server data; doesn't read from the server, but will
    // read cached data from local storage.
    tf.serverData.init();
};

tf.state.setupLogin = function(continuationfn) {
    // check if we're authenticated and possibly login
    var hasNetwork = (!tf.state.isCordova ||
                      navigator.connection.type != Connection.NONE);
    var token = tf.storage.getSetting('token');
    var email = tf.storage.getSetting('email');
    if (hasNetwork && !tf.storage.getSetting('token')) {
        //console.log('has network, no stored token');
        // we haven't logged in
        tf.ui.loginPage.openPage();
        continuationfn();
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
                            userId: response.userId
                        };
                        tf.storage.setSettings(props);
                        tf.state.onAuthenticatedOnline(continuationfn);
                    } else {
                        // saved login not ok
                        tf.ui.loginPage.openPage();
                        continuationfn();
                    }
                });
            } else {
                // invalid token and no stored password.  try to login
                tf.ui.loginPage.openPage();
                continuationfn();
            }
        } else {
            // token is valid
            //console.log('has network, valid token');
            tf.state.onAuthenticatedOnline(continuationfn);
        }
    } else if (tf.storage.getSetting('token')) {
        //console.log('no network, token');
        // we have a token but no network; continue with the data we have
        tf.state._setupContinue(continuationfn);
    } else {
        //console.log('no network, no token');
        // no network, no token; not much to do
        tf.ui.alert('<p>Det finns inget nätverk.  Du måste logga in när ' +
                    'du har nätverk.</p>');
        continuationfn();
    }
};

tf.state.onAuthenticatedOnline = function(continuationfn) {
    tf.state.isLoggedIn = true;
    // asynchronously update our data from the server
    tf.serverData.update(tf.storage.getSetting('userId'));
    // we'll first start from cached data; if things have been updated on
    // the server, we might change active race when we get the reply.
    tf.state._setupContinue(continuationfn);
};

tf.state._setupContinue = function(continuationfn) {

    var activeRaceId = tf.storage.getSetting('activeRaceId');

    tf.state._setActiveRace2(activeRaceId, continuationfn);
};

tf.state.setActiveRace = function(raceId, continuationfn) {
    if (raceId == tf.storage.getSetting('activeRaceId')) {
        return;
    }
    tf.state._setActiveRace2(raceId, continuationfn);
};

tf.state._setActiveRace2 = function(raceId, continuationfn) {

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
        tf.state.curRace = new tf.Race(teamData.id, tf.state.curRegatta,
                                       raceData);
        // get the stored log from the app storage
        var raceLog = tf.storage.getRaceLog(raceId) || {};
        var log = raceLog.log || [];
        tf.state.curLogBook = new tf.LogBook(teamData.boat_name,
                                             teamData.start_number,
                                             teamData.start_point,
                                             teamData.sxk_handicap,
                                             tf.state.curRace, log);

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
        if (continuationfn) {
            continuationfn();
        }
    } else {
        tf.state.curRace = null;
        tf.state.curLogBook = null;
        tf.state.boatState.engine = false;
        tf.state.boatState.lanterns = false;
        tf.state.activeInterrupt = false;
        if (continuationfn) {
            continuationfn();
        }
    }
};

tf.state.loggedIn = function() {
    tf.state.onAuthenticatedOnline(function() {
        tf.ui.logBookChanged();
    });
};

tf.state.logout = function() {
    tf.serverAPI.logout();
    props = {
        email: null,
        password: null,
        token: null,
        userId: null
    };
    tf.storage.setSettings(props);
    tf.state.isLoggedIn = false;
    tf.state.curRace = null;
    tf.state.curLogBook = null;
    tf.state.curPlan.set(null);

    tf.ui.logBookChanged();
};

tf.state.sendLogBook = function(logBook) {
};
