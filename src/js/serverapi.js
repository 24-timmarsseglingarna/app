/* -*- js -*- */

goog.provide('tf.serverAPI');

goog.require('tf');

/**
 * Base URL for server requests.
 * @const {string}
 */
tf.serverAPI.URL = 'http://giona.herokuapp.com';
tf.serverAPI.URL = 'https://giona-dev.24-timmars.nu';
tf.serverAPI.URL = 'http://192.168.0.6:3000';

/**
 * Keep track of email and token; necessary in all API calls.
 */
tf.serverAPI.state = {
    email: null,
    token: null
};

tf.serverAPI.login = function(email, password, responsefn) {
    $.ajax({
        url: tf.serverAPI.URL + '/users/sign_in.json',
        method: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({
            user: {
                email: email,
                password: password
            }
        }),
        cache: false,
        success: function(data, status, jqXHR) {
            var token = data.authentication_token;
            var userId = data.id;
            if (token) {
                tf.serverAPI.state.email = email;
                tf.serverAPI.state.token = token;
                responsefn({
                    email: email,
                    password: password,
                    token: token,
                    userId: userId
                });
            } else {
                console.log('login: no token from server');
                responsefn(null);
            }
        },
        error: function(jqXHR, status, errorThrown) {
            console.log('login error ' + jqXHR.status + ' ' + status);
            responsefn(null);
        }
    });
};

tf.serverAPI.validateToken = function(email, token) {
    // FIXME: implement when we have an API in the server
    return false;
};

tf.serverAPI.logout = function() {
    tf.serverAPI.email = null;
    tf.serverAPI.token = null;
};

/**
 * Return an object with one entry per regatta, with the regattaId
 * as key, in a call to `responsefn`.
 */
tf.serverAPI.getTeamsPerRegatta = function(regattaIds, responsefn) {
    var cfn = function() {
        var responses = [].slice.call(arguments);
        var teams = {};
        if (typeof responses[1] == 'string') {
            var regattaId = responses[2].tfOpaque;
            teams[regattaId] = responses[0];
        } else {
            for (var i = 0; i < responses.length; i++) {
                // each response is a list of 3 items [data, status, jqXHR]
                // each data is a list of zero or more teams
                var regattaId = responses[i][2].tfOpaque;
                teams[regattaId] = responses[i][0];
            }
        }
        responsefn(teams);
    };
    var requests = [];
    for (var i = 0; i < regattaIds.length; i++) {
        requests.push(tf.serverAPI.getAJAX('/api/v1/teams?from_regatta=' +
                                           regattaIds[i],
                                           regattaIds[i]));
    }
    // wait for all requests to finish
    $.when.apply($, requests).then(cfn,
                                   function() { responsefn(null); });
};

/**
 * Return the teams in the active races that `userId` is registered for,
 * in a call to `responsefn`.
 * A race becomes inactive when the results are final.
 */
tf.serverAPI.getActiveTeams = function(userId, responsefn) {
    // 1. Find the person that corresponds to the registered user.
    // 2. Find the active teams for this person.
    var cfn = function(data) {
        if (data[0].id) {
            peopleId = data[0].id;
            tf.serverAPI.getJSON('/api/v1/teams?has_person=' + peopleId +
                                 '&is_active=true',
                                 responsefn);
        } else {
            responsefn(null);
        }
    };
    tf.serverAPI.getJSON('/api/v1/people?has_user=' + userId, cfn);
};

tf.serverAPI.getRaces = function(teams, responsefn) {
    // 3. For each active team, find the races it participates in.
    var cfn = function() {
        var responses = [].slice.call(arguments);
        var races = [];
        // FIXME: temp hack - it seems arguments is not an Array of
        // 3-Arrays if there is just one reply - in that case it is just
        // a 3-Array directly.
        if (typeof responses[1] == 'string') {
            races = races.concat(responses[0]);
        } else {
            for (var i = 0; i < responses.length; i++) {
                // each response is a list of 3 items [data, status, jqXHR]
                // each data is a list of zero or one races
                races = races.concat(responses[i][0]);
            }
        }
        responsefn(races);
    };
    var requests = [];
    for (var i = 0; i < teams.length; i++) {
        teamId = teams[i].id;
        requests.push(tf.serverAPI.getAJAX('/api/v1/races?has_team=' +
                                           teamId));
    }
    // wait for all requests to finish
    $.when.apply($, requests).then(cfn,
                                   function() { responsefn(null); });
};

/**
 * Return the log for a given team in a call to `responsefn`.
 */
tf.serverAPI.getLog = function(teamId, responsefn) {
    tf.serverAPI.getJSON('/api/v1/teams' + teamId + '/log_entries', responsefn);
};

tf.serverAPI.deleteLogEntry = function(teamId, logid, responsefn) {
    tf.serverAPI.delObj('/api/v1/teams/' + teamId + '/log_entries/' + logid,
                        responsefn);
};

tf.serverAPI.putLogEntry = function(teamId, logid, logEntry, responsefn) {
    tf.serverAPI.putJSON('/api/v1/teams/' + teamId + '/log_entries/' + logid,
                         responsefn);
};

tf.serverAPI.getJSON = function(urlpath, responsefn) {
    $.ajax({
        url: tf.serverAPI.URL + urlpath,
        dataType: 'json',
        beforeSend: function(jqXHR, settings) {
            jqXHR.setRequestHeader('X-User-Email', tf.serverAPI.state.email);
            jqXHR.setRequestHeader('X-User-Token', tf.serverAPI.state.token);
            return true;
        },
        success: function(data, status, jqXHR) {
            responsefn(data);
        },
        error: function(jqXHR, status, errorThrown) {
            console.log('req error for ' + urlpath + ': ' + jqXHR.status);
            responsefn(null);
        }
    });
};

tf.serverAPI.getAJAX = function(urlpath, opaque) {
    return $.ajax({
        url: tf.serverAPI.URL + urlpath,
        dataType: 'json',
        beforeSend: function(jqXHR, settings) {
            jqXHR.setRequestHeader('X-User-Email', tf.serverAPI.state.email);
            jqXHR.setRequestHeader('X-User-Token', tf.serverAPI.state.token);
            if (opaque) {
                jqXHR.tfOpaque = opaque;
            }
            return true;
        }
    });
};

tf.serverAPI.putJSON = function(urlpath, data, responsefn) {
    $.ajax({
        url: tf.serverAPI.URL + urlpath,
        method: 'PUT',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify(data),
        beforeSend: function(jqXHR, settings) {
            jqXHR.setRequestHeader('X-User-Email', tf.serverAPI.state.email);
            jqXHR.setRequestHeader('X-User-Token', tf.serverAPI.state.token);
            return true;
        },
        success: function(data, status, jqXHR) {
            responsefn(true);
        },
        error: function(jqXHR, status, errorThrown) {
            console.log('put error for ' + urlpath + ': ' + jqXHR.status);
            responsefn(false);
        }
    });
};

tf.serverAPI.delObj = function(urlpath, responsefn) {
    $.ajax({
        url: tf.serverAPI.URL + urlpath,
        method: 'DELETE',
        beforeSend: function(jqXHR, settings) {
            jqXHR.setRequestHeader('X-User-Email', tf.serverAPI.state.email);
            jqXHR.setRequestHeader('X-User-Token', tf.serverAPI.state.token);
            return true;
        },
        success: function(data, status, jqXHR) {
            responsefn(true);
        },
        error: function(jqXHR, status, errorThrown) {
            console.log('delete error for ' + urlpath + ': ' + jqXHR.status);
            if (jqXHR.status == 404) {
                // The object doesn't exists on the server, good.
                responsefn(true);
            } else {
                // The object might not have been deleted
                responsefn(false);
            }
        }
    });
};
