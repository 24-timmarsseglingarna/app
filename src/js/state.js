/* -*- js -*- */

goog.provide('tf.state');

goog.require('tf');
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


//tf.state.defineVariable('curRace', null);
//tf.state.defineVariable('curLogBook', null);
tf.defineVariable(tf.state, 'curPlan', null);

/**
 * Initialize ephemeral state variables.
 */

tf.state.curRace = null;
tf.state.curLogBook = null;

// this is initialized at startup by analyzing the log book, if there is one
tf.state.boatState = {
    'engine': false,
    'lanterns': false
};

// this is initialized at startup by analyzing the log book, if there is one
tf.state.activeInterrupt = false;


tf.state.isLoggedIn = false;

tf.state.isCordova = 'cordova' in window;


tf.state.init = function() {
    // initialize local storage handler
    tf.storage.init();

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
    // update our data from the server
    tf.serverData.update(tf.storage.getSetting('userId'));
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
        var tmpPod = new tf.Pod(basePodSpec);
        tf.state.curRace = new tf.Race(null, // FIXME: do we need regatta?
                                       raceData,
                                       tmpPod);
        var raceLog = tf.storage.getRaceLog(raceId) || {};
        var log = raceLog.log || [];
        tf.state.curLogBook = new tf.LogBook(teamData.boat_name,
                                             teamData.start_number,
                                             teamData.start_point,
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
