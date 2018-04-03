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
            var personId = data.person_id;
            if (token) {
                tf.serverAPI.state.email = email;
                tf.serverAPI.state.token = token;
                responsefn({
                    email: email,
                    password: password,
                    token: token,
                    personId: personId
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
 * personId :: integer()
 * prevetag :: null || opaque()
 * responsefn :: (teams :: 'notmodified' | [teamData :: json()],
 *                etags :: opaque)
 * On error, `teams` = `etags` = null.
 *
 * Return the teams in the active races that `personId` is registered for.
 * A race becomes inactive when the results are final.
 */
tf.serverAPI.getActiveTeams = function(personId, prevetag, responsefn) {
    tf.serverAPI.getJSON('/api/v1/teams?has_person=' + personId +
                         '&is_active=true', prevetag, responsefn);
};

/**
 * regattaIds :: [regattaId :: integer()]
 * prevetags :: null || opaque()
 * responsefn :: (races :: hash(regattaId -> 'notmodified'
 *                                           | [raceData :: json()],
 *                etags :: opaque())
 * On error, races = etags = null.
 */
tf.serverAPI.getRacesPerRegatta =
    function(regattaIds, prevetags, responsefn) {
    var cfn = function() {
        var responses = [].slice.call(arguments);
        var races = {};
        var etags = {};
        // NOTE:  It seems arguments is not an Array of
        // 3-Arrays if there is just one reply - in that case it is just
        // a 3-Array directly.
        if (typeof responses[1] == 'string') {
            responses = [responses];
        }
        for (var i = 0; i < responses.length; i++) {
            // each response is a list of 3 items [data, status, jqXHR]
            // each data is a list of zero or more races
            var regattaId = responses[i][2].tfOpaque;
            var etag = responses[i][2].getResponseHeader('ETag');
            if (responses[i][2].status == 304) {
                races[regattaId] = 'notmodified';
            } else {
                races[regattaId] = responses[i][0];
            }
            etags[regattaId] = etag;
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
 * regattaIds :: [regattaId :: integer()]
 * prevetags :: null || opaque()
 * responsefn :: (teams :: hash(regattaId -> 'notmodified'
 *                                           | [teamData :: json()],
 *                etags :: opaque())
 * On error, teams = etags = null.
 */
tf.serverAPI.getTeamsPerRegatta = function(regattaIds, prevetags, responsefn) {
    var cfn = function() {
        var responses = [].slice.call(arguments);
        var teams = {};
        var etags = {};
        // FIXME: temp hack - it seems arguments is not an Array of
        // 3-Arrays if there is just one reply - in that case it is just
        // a 3-Array directly.
        if (typeof responses[1] == 'string') {
            responses = [responses];
        }
        for (var i = 0; i < responses.length; i++) {
            // each response is a list of 3 items [data, status, jqXHR]
            // each data is a list of zero or more teams
            var regattaId = responses[i][2].tfOpaque;
            var etag = responses[i][2].getResponseHeader('ETag');
            if (responses[i][2].status == 304) {
                teams[regattaId] = 'notmodified';
            } else {
                teams[regattaId] = responses[i][0];
            }
            etags[regattaId] = etag;
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

tf.serverAPI.getNewMyLog = function(teamId, client, updatedAfter, responsefn) {
    var url = '/api/v1/logs?from_team=' + teamId +
        '&not_client=' + client;
    if (updatedAfter) {
        url += '&updated_after=' + updatedAfter;
    }
    tf.serverAPI.getJSON(url, null, responsefn);
};

tf.serverAPI.getNewRegattaLog = function(regattaId, teamId,
                                         updatedAfter, responsefn) {
    var url = '/api/v1/logs?from_regatta=' + regattaId + '&has_type=round';
    if (teamId) {
        url += '&not_team=' + teamId;
    }
    if (updatedAfter) {
        url += '&updated_after=' + updatedAfter;
    }
    tf.serverAPI.getJSON(url, null, responsefn);
};

tf.serverAPI.postLogEntry = function(data, responsefn) {
    tf.serverAPI.postJSON('/api/v1/logs', data, responsefn);
};

tf.serverAPI.patchLogEntry = function(logid, data, responsefn) {
    tf.serverAPI.patchJSON('/api/v1/logs/' + logid, data, responsefn);
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
            } else {
                // make sure we don't use the browser's cache
                jqXHR.setRequestHeader('If-None-Match', '');
            }
            return true;
        },
        success: function(data, status, jqXHR) {
            var etag = jqXHR.getResponseHeader('ETag');
            if (jqXHR.status == 304) {
                responsefn('notmodified', etag);
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
            } else {
                // make sure we don't use the browser's cache
                jqXHR.setRequestHeader('If-None-Match', '');
            }
            if (opaque) {
                jqXHR.tfOpaque = opaque;
            }
            return true;
        }
    });
};

tf.serverAPI.postJSON = function(urlpath, data, responsefn) {
    tf.serverAPI._setJSON('POST', urlpath, data, responsefn);
};

tf.serverAPI.patchJSON = function(urlpath, data, responsefn) {
    tf.serverAPI._setJSON('PATCH', urlpath, data, responsefn);
};

tf.serverAPI._setJSON = function(method, urlpath, data, responsefn) {
    $.ajax({
        url: tf.serverAPI.URL + urlpath,
        method: method,
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify(data),
        beforeSend: function(jqXHR, settings) {
            jqXHR.setRequestHeader('X-User-Email', tf.serverAPI.state.email);
            jqXHR.setRequestHeader('X-User-Token', tf.serverAPI.state.token);
            return true;
        },
        success: function(data, status, jqXHR) {
            console.log(method + ' returns ' + data);
            tf.dbg = data;
            responsefn(data);
        },
        error: function(jqXHR, status, errorThrown) {
            console.log(method + ' error ' + status);
            if (jqXHR.status == 409) {
                responsefn('conflict');
            } else {
                console.log(method + ' error for ' + urlpath + ': ' +
                            jqXHR.status);
                responsefn(null);
            }
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
