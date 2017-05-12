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

/**
 * Initialize ephemeral state variables.
 */

tf.state.curRace = null;
tf.state.curLogBook = null;
tf.state.curPlan = null;

tf.state.isLoggedIn = false;

tf.state.isCordova = 'cordova' in window;


tf.state.setup = function() {

    // initialize local storage handler
    tf.storage.init();

    // initialize server data; doesn't read from the server, but will
    // read cached data from local storage.
    tf.serverData.init();

    // check if we're authenticated and possibly login
    var hasNetwork = (!tf.state.isCordova ||
                      navigator.connection.type != Connection.NONE);
    var token = tf.storage.getSetting('token');
    var email = tf.storage.getSetting('email');
    if (hasNetwork && !tf.storage.getSetting('token')) {
        console.log('has network, no stored token');
        // we haven't logged in
        tf.ui.loginPage.openPage();
    } else if (hasNetwork) {
        console.log('has network and stored token, validate it');
        // validate the token
        if (!tf.serverAPI.validateToken(email, token)) {
            console.log('has network, invalid token');
            // token invalid, check if the password is stored
            var password = tf.storage.getSetting('password');
            if (password) {
                console.log('has stored passwd, login');
                tf.serverAPI.login(email, password, function(response) {
                    if (response) {
                        console.log('login ok');
                        props = {
                            token: response.token,
                            userId: response.userId
                        };
                        tf.storage.setSettings(props);
                        tf.state.onAuthenticatedOnline();
                    } else {
                        // saved login not ok
                        tf.ui.loginPage.openPage();
                    }
                });
            } else {
                // invalid token and no stored password.  try to login
                tf.ui.loginPage.openPage();
            }
        } else {
            // token is valid
            console.log('has network, valid token');
            tf.state.onAuthenticatedOnline();
        }
    } else if (tf.storage.getSetting('token')) {
        console.log('no network, token');
        // we have a token but no network; continue with the data we have
        tf.state.setupContinue();
    } else {
        console.log('no network, no token');
        // no network, no token; not much to do
    }
};

tf.state.onAuthenticatedOnline = function() {
    tf.state.isLoggedIn = true;
    // update our data from the server
    tf.serverData.update(tf.storage.getSetting('userId'));
    tf.state.setupContinue();
};

tf.state.setupContinue = function() {

    var activeRaceId = tf.storage.getSetting('activeRaceId');

    tf.state._setActiveRace2(activeRaceId);
};

tf.state.setActiveRace = function(raceId) {
    if (raceId == tf.storage.getSetting('activeRaceId')) {
        return;
    }
    tf.state._setActiveRace2(raceId);
};

tf.state._setActiveRace2 = function(raceId) {

    tf.storage.setSettings({activeRaceId: raceId});

    // we need to initialize a new Race object, and swap our
    // tf.state.cur* variables.
    // if we have data stored for this race, use that when we initialize
    // the Race object.
    // if raceId is null, reset the tf.state.cur* variables.

    var raceData = tf.serverData.getRaceData(raceId);
    var teamData = tf.serverData.getMyTeamData(raceId);
    if (raceData && teamData) {
        // FIXME: the pod should be more dynamic; it can change on the server
        var tmpPod = new tf.Pod(basePodSpec);
        tf.state.curPod = tmpPod; // FIXME, tmp debug

        tf.state.curRace = new tf.Race(null, // FIXME: do we need regatta?
                                       raceData,
                                       tmpPod);
        var raceLog = tf.storage.getRaceLog(raceId) || {};
        var log = raceLog.log || [];
        tf.state.curLogBook = new tf.LogBook(teamData.boat_name,
                                             teamData.start_number,
                                             tf.state.curRace, log);

        tf.state.curLogBook.onLogUpdate(tf.ui.logBookChanged, 100);
        tf.state.curLogBook.onLogUpdate(function(logBook) {
            tf.storage.setRaceLog(logBook.race.getId(), logBook.getLog());
        }, 110);
    } else {
        tf.state.curRace = null;
        tf.state.curLogBook = null;
    }

    tf.ui.logBookChanged();
};

tf.state.loggedIn = function() {
    tf.state.isLoggedIn = true;
    tf.state.onAuthenticatedOnline();
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
    tf.state.curPlan = null;

    tf.ui.logBookChanged();
};
