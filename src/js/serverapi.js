/* -*- js -*- */

import {debugInfo} from './debug.js';

/**
 * Base URL for server requests.
 * @const {string}
 */
var stagingURL = 'https://segla-stage.24-timmars.nu';
var productionURL = 'https://segla.24-timmars.nu';

export var URL = productionURL;

export function setProductionServer() {
    URL = productionURL;
};

export function setStagingServer() {
    URL = stagingURL;
};

export function setServerURL(url) {
    URL = url;
};

/**
 * Keep track of email and token; necessary in all API calls.
 */
var APIstate = {
    email: null,
    token: null
};

function setCredentials(email, token) {
    APIstate.email = email;
    APIstate.token = token;
};

export function getAPIVersion(responsefn) {
    $.ajax({
        url: URL + '/api_version.json',
        dataType: 'json',
        beforeSend: function(jqXHR) {
            // make sure we don't use the browser's cache
            jqXHR.setRequestHeader('If-None-Match', '');
            return true;
        },
        success: function(data) {
            responsefn(data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log('req error api_version: ' + jqXHR.status);
            responsefn(mkError(jqXHR, textStatus, errorThrown));
        }
    });
};

export function login(email, password, responsefn) {
    $.ajax({
        url: URL + '/users/sign_in.json',
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
        success: function(data) {
            var token = data.authentication_token;
            if (token) {
                APIstate.email = email;
                APIstate.token = token;
                responsefn({
                    email: email,
                    password: password,
                    token: token,
                    personId: data.person_id,
                    role: data.role
                });
            } else if (data.error) {
                responsefn({
                    errorCode: -1,
                    errorStr: data.error
                });
            } else {
                console.log('login: bad response from server');
                responsefn({
                    errorCode: -2,
                    errorStr: 'Okänt fel från servern'
                });
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            responsefn(mkError(jqXHR, textStatus, errorThrown));
        }
    });
};

function mkError(jqXHR, textStatus, errorThrown) {
    var errorStr = undefined;
    if (jqXHR.status == 0) {
        // unknown connection error
        errorStr = 'Kan inte kontakta servern';
    } else if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
        // error string sent from server
        errorStr = jqXHR.responseJSON.error;
    } else {
        errorStr = textStatus + ' ' + errorThrown;
    }
    debugInfo['reqerror'] = errorStr + ' ' + moment().format();
    console.log('mkerror ' + errorStr);
    return {
        errorCode: jqXHR.status,
        errorStr: errorStr
    };
};

export function validateToken(email, token, personId, responsefn) {
    // we get the person as a way to validate the token.  on success,
    // the response will contain the user's role.
    setCredentials(email, token);
    getJSON('/api/v1/people/' + personId, null, responsefn);
};

export function logout() {
    APIstate.email = null;
    APIstate.token = null;
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
export function getActiveTeams(personId, prevetag, responsefn) {
    getJSON('/api/v1/teams?has_person=' + personId +
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
export function getRacesPerRegatta(regattaIds, prevetags, responsefn) {
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
        requests.push(getAJAX('/api/v1/races?from_regatta=' + regattaIds[i],
                              etag, regattaIds[i]));
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
export function getTeamsPerRegatta(regattaIds, prevetags, responsefn) {
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
        requests.push(getAJAX('/api/v1/teams?from_regatta=' + regattaIds[i],
                              etag, regattaIds[i]));
    }
    // wait for all requests to finish
    $.when.apply($, requests).then(cfn,
                                   function() { responsefn(null, null); });
};

export function getNewMyLog(teamId, client, updatedAfter, responsefn) {
    var url = '/api/v1/logs?from_team=' + teamId;
    if (client) {
        url += '&not_client=' + client;
    }
    if (updatedAfter) {
        url += '&updated_after=' + updatedAfter;
    }
    getJSON(url, null, responsefn);
};

export function getNewRegattaLog(regattaId, teamId,
                                 updatedAfter, responsefn) {
    var url = '/api/v1/logs?from_regatta=' + regattaId + '&has_type=round';
    if (teamId) {
        url += '&not_team=' + teamId;
    }
    if (updatedAfter) {
        url += '&updated_after=' + updatedAfter;
    }
    getJSON(url, null, responsefn);
};

export function getFullRegattaLog(regattaId, responsefn) {
    var url = '/api/v1/logs?from_regatta=' + regattaId;
    getJSON(url, null, responsefn);
};

export function postLogEntry(data, responsefn) {
    postJSON('/api/v1/logs', data, responsefn);
};

export function patchLogEntry(logid, data, responsefn) {
    patchJSON('/api/v1/logs/' + logid, data, responsefn);
};

function getJSON(urlpath, etag, responsefn) {
    //console.log('req: ' + urlpath);
    $.ajax({
        url: URL + urlpath,
        dataType: 'json',
        beforeSend: function(jqXHR) {
            jqXHR.setRequestHeader('X-User-Email', APIstate.email);
            jqXHR.setRequestHeader('X-User-Token', APIstate.token);
            if (etag) {
                jqXHR.setRequestHeader('If-None-Match', etag);
            } else {
                // make sure we don't use the browser's cache
                jqXHR.setRequestHeader('If-None-Match', '');
            }
            return true;
        },
        success: function(data, _status, jqXHR) {
            var etag = jqXHR.getResponseHeader('ETag');
            if (jqXHR.status == 304) {
                responsefn('notmodified', etag);
            } else {
                responsefn(data, etag);
            }
        },
        error: function(jqXHR) {
            var errorstr = 'req error for ' + urlpath + ': ' + jqXHR.status;
            console.log(errorstr);
            debugInfo['getjsonerror'] = errorstr + ' ' +
                moment().format();
            responsefn(null, null);
        }
    });
};

function getAJAX(urlpath, etag, opaque) {
    //console.log('req: ' + urlpath);
    return $.ajax({
        url: URL + urlpath,
        dataType: 'json',
        beforeSend: function(jqXHR) {
            jqXHR.setRequestHeader('X-User-Email', APIstate.email);
            jqXHR.setRequestHeader('X-User-Token', APIstate.token);
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

function postJSON(urlpath, data, responsefn) {
    setJSON('POST', urlpath, data, responsefn);
};

function patchJSON(urlpath, data, responsefn) {
    setJSON('PATCH', urlpath, data, responsefn);
};

function setJSON(method, urlpath, data, responsefn) {
    $.ajax({
        url: URL + urlpath,
        method: method,
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify(data),
        beforeSend: function(jqXHR) {
            jqXHR.setRequestHeader('X-User-Email', APIstate.email);
            jqXHR.setRequestHeader('X-User-Token', APIstate.token);
            return true;
        },
        success: function(data) {
            responsefn(data);
        },
        error: function(jqXHR) {
            if (jqXHR.status == 409) {
                //console.log(method + ' ' + urlpath + 'returns 409  conflict');
                responsefn('conflict');
            } else {
                var errorstr = method + ' error for ' + urlpath + ': ' +
                    jqXHR.status;
                console.log(errorstr);
                debugInfo['setjsonerr'] = errorstr + ' ' +
                    moment().format();
                responsefn(null);
            }
        }
    });
};

/*
function delObj(urlpath, responsefn) {
    $.ajax({
        url: URL + urlpath,
        method: 'DELETE',
        beforeSend: function(jqXHR) {
            jqXHR.setRequestHeader('X-User-Email', APIstate.email);
            jqXHR.setRequestHeader('X-User-Token', APIstate.token);
            return true;
        },
        success: function() {
            responsefn(true);
        },
        error: function(jqXHR) {
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
}
*/
