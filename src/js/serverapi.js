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
 * userId :: integer()
 * prevetag :: null || opaque()
 * responsefn :: (teams :: 'notmodified' | [teamData :: json()],
 *                etags :: opaque)
 * On error, `teams` = `etags` = null.
 *
 * Return the teams in the active races that `userId` is registered for.
 * A race becomes inactive when the results are final.
 */
tf.serverAPI.getActiveTeams = function(userId, prevetag, responsefn) {
    // 1. Find the person that corresponds to the registered user.
    // 2. Find the active teams for this person.
    var cfn = function(data, _etag) {
        if (data[0].id) {
            peopleId = data[0].id;
            tf.serverAPI.getJSON('/api/v1/teams?has_person=' + peopleId +
                                 '&is_active=true',
                                 prevetag,
                                 responsefn);
        } else {
            responsefn(null, null);
        }
    };
    tf.serverAPI.getJSON('/api/v1/people?has_user=' + userId, null, cfn);
};

/**
 * teamIds :: [teamId :: integer()]
 * prevetags :: null || opaque()
 * responsefn :: (races :: hash(teamId -> 'notmodified' | [raceData :: json()]),
 *                etags :: opaque)
 * On error, `races` = `etags` = null.
 */
tf.serverAPI.getRaces = function(teamIds, prevetags, responsefn) {
    // 3. For each active team, find the races it participates in.
    var cfn = function() {
        var responses = [].slice.call(arguments);
        var races = {};
        var etags = {};
        // FIXME: temp hack - it seems arguments is not an Array of
        // 3-Arrays if there is just one reply - in that case it is just
        // a 3-Array directly.
        if (typeof responses[1] == 'string') {
            var teamId = responses[2].tfOpaque;
            var etag = responses[2].getResponseHeader('ETag');
            if (responses[1] == 'notmodified') {
                races[teamId] = responses[1];
            } else {
                races[teamId] = responses[0];
            }
            etags[teamId] = etag;
        } else {
            for (var i = 0; i < responses.length; i++) {
                // each response is a list of 3 items [data, status, jqXHR]
                // each data is a list of zero or one races
                var teamId = responses[i][2].tfOpaque;
                var etag = responses[i][2].getResponseHeader('ETag');
                if (responses[i][1] == 'notmodified') {
                    races[teamId] = responses[i][1];
                } else {
                    races[teamId] = responses[i][0];
                }
                etags[teamId] = etag;
            }
        }
        responsefn(races, etags);
    };
    var requests = [];
    for (var i = 0; i < teamIds.length; i++) {
        teamId = teamIds[i];
        var etag = prevetags[teamId];
        requests.push(tf.serverAPI.getAJAX('/api/v1/races?has_team=' + teamId,
                                           etag,
                                           teamId));
    }
    // wait for all requests to finish
    $.when.apply($, requests).then(cfn,
                                   function() { responsefn(null, null); });
};

/**
 * regattaIds :: [regattaId :: integer()]
 * prevetags :: null || opaque()
 * responsefn :: (teams :: hash(regattaId -> 'notmodified'
*                                            | [teamData :: json()],
 *                etags :: opaque())
 * On error, teams = etags = null.
 */
tf.serverAPI.getTeamsPerRegatta = function(regattaIds, prevetags, responsefn) {
    var cfn = function() {
        var responses = [].slice.call(arguments);
        var teams = {};
        var etags = {};
        if (typeof responses[1] == 'string') {
            var regattaId = responses[2].tfOpaque;
            var etag = responses[2].getResponseHeader('ETag');
            if (responses[1] == 'notmodified') {
                teams[regattaId] = responses[1];
            } else {
                teams[regattaId] = responses[0];
            }
            etags[regattaId] = etag;
        } else {
            for (var i = 0; i < responses.length; i++) {
                // each response is a list of 3 items [data, status, jqXHR]
                // each data is a list of zero or more teams
                var regattaId = responses[i][2].tfOpaque;
                var etag = responses[i][2].getResponseHeader('ETag');
                if (responses[i][1] == 'notmodified') {
                    teams[regattaId] = responses[i][1];
                } else {
                    teams[regattaId] = responses[i][0];
                }
                etags[regattaId] = etag;
            }
        }
        responsefn(teams, etags);
    };
    var requests = [];
    for (var i = 0; i < regattaIds.length; i++) {
        var etag = prevetags[regattaIds[i]];
        requests.push(tf.serverAPI.getAJAX('/api/v1/teams?from_regatta=' +
                                           regattaIds[i],
                                           etag,
                                           regattaIds[i]));
    }
    // wait for all requests to finish
    $.when.apply($, requests).then(cfn,
                                   function() { responsefn(null, null); });
};

/**
 * regattaIds :: [regattaId :: integer()]
 * prevetags :: null || opaque()
 * responsefn :: (races :: hash(regattaId -> 'notmodified'
*                                            | [raceData :: json()],
 *                etags :: opaque())
 * On error, races = etags = null.
 */
tf.serverAPI.getRacesPerRegatta =
    function(regattaIds, prevetags, responsefn) {
    var cfn = function() {
        var responses = [].slice.call(arguments);
        var races = {};
        var etags = {};
        if (typeof responses[1] == 'string') {
            var regattaId = responses[2].tfOpaque;
            var etag = responses[2].getResponseHeader('ETag');
            if (responses[1] == 'notmodified') {
                races[regattaId] = responses[1];
            } else {
                races[regattaId] = responses[0];
            }
            etags[regattaId] = etag;
        } else {
            for (var i = 0; i < responses.length; i++) {
                // each response is a list of 3 items [data, status, jqXHR]
                // each data is a list of zero or more races
                var regattaId = responses[i][2].tfOpaque;
                var etag = responses[i][2].getResponseHeader('ETag');
                if (responses[i][1] == 'notmodified') {
                    races[regattaId] = responses[i][1];
                } else {
                    races[regattaId] = responses[i][0];
                }
                etags[regattaId] = etag;
            }
        }
        responsefn(races, etags);
    };
    var requests = [];
    for (var i = 0; i < regattaIds.length; i++) {
        var etag = prevetags[regattaIds[i]];
        requests.push(tf.serverAPI.getAJAX('/api/v1/races?from_regatta=' +
                                           regattaIds[i],
                                           etag,
                                           regattaIds[i]));
    }
    // wait for all requests to finish
    $.when.apply($, requests).then(cfn,
                                   function() { responsefn(null, null); });
};

/**
 * Return the log for a given team in a call to `responsefn`.
 */
tf.serverAPI.getLog = function(teamId, etag, responsefn) {
    tf.serverAPI.getJSON('/api/v1/teams' + teamId + '/log_entries',
                         etag, responsefn);
};

tf.serverAPI.putLogEntry = function(teamId, logid, logEntry, responsefn) {
    tf.serverAPI.putJSON('/api/v1/teams/' + teamId + '/log_entries/' + logid,
                         responsefn);
};

tf.serverAPI.getJSON = function(urlpath, etag, responsefn) {
    $.ajax({
        url: tf.serverAPI.URL + urlpath,
        dataType: 'json',
        beforeSend: function(jqXHR, settings) {
            jqXHR.setRequestHeader('X-User-Email', tf.serverAPI.state.email);
            jqXHR.setRequestHeader('X-User-Token', tf.serverAPI.state.token);
            if (etag) {
                jqXHR.setRequestHeader('If-None-Match', etag);
            }
            return true;
        },
        success: function(data, status, jqXHR) {
            var etag = jqXHR.getResponseHeader('ETag');
            if (status == 'notmodified') {
                responsefn(status, etag);
            } else {
                responsefn(data, etag);
            }
        },
        error: function(jqXHR, status, errorThrown) {
            console.log('req error for ' + urlpath + ': ' + jqXHR.status);
            responsefn(null, null);
        }
    });
};

tf.serverAPI.getAJAX = function(urlpath, etag, opaque) {
    return $.ajax({
        url: tf.serverAPI.URL + urlpath,
        dataType: 'json',
        beforeSend: function(jqXHR, settings) {
            jqXHR.setRequestHeader('X-User-Email', tf.serverAPI.state.email);
            jqXHR.setRequestHeader('X-User-Token', tf.serverAPI.state.token);
            if (etag) {
                jqXHR.setRequestHeader('If-None-Match', etag);
            }
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
