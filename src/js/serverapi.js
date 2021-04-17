/* -*- js -*- */

import {dbg, debugInfo} from './debug.js';

/**
 * Base URL for server requests.
 * @const {string}
 */
var stagingURL = 'https://segla-stage.24-timmars.nu';
var productionURL = 'https://segla.24-timmars.nu';
//var devURL = 'http://192.168.0.6:3000';

var stagingS3URL = 'https://gionastage.s3.amazonaws.com';
var productionS3URL = 'https://gionaprod.s3.amazonaws.com';
//var devS3URL = 'http://gionadev.s3.amazonaws.com';

export var URL = productionURL;
export var S3URL = productionS3URL;

/*
function setDevServer() {
    URL = devURL;
    S3URL = devS3URL;
    return;
};
*/

//setDevServer();

export function setProductionServer() {
    URL = productionURL;
    S3URL = productionS3URL;
//    setDevServer();
};

export function setStagingServer() {
    URL = stagingURL;
    S3URL = stagingS3URL;
//    setDevServer();
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

/**
 * Returns Promise
 * @resolve :: object()
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getAPIVersionP() {
    var url = URL + '/api_version.json';
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: url,
            dataType: 'json',
            beforeSend: function(jqXHR) {
                // make sure we don't use the browser's cache
                jqXHR.setRequestHeader('If-None-Match', '');
            },
            success: function(data) {
                resolve(data);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                reject(mkError(jqXHR, url, textStatus, errorThrown));
            }
        });
    });
};

/**
 * Returns Promise
 * @resolve :: { email :: string(),
 *               password :: string(),
 *               token :: string(),
 *               personId :: integer(),
 *               role :: string() }
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function loginP(email, password) {
    var url = URL + '/users/sign_in.json';
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: url,
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
                    resolve({
                        email: email,
                        password: password,
                        token: token,
                        personId: data.person_id,
                        role: data.role
                    });
                } else if (data.error) {
                    reject({
                        errorCode: -1,
                        errorStr: data.error
                    });
                } else {
                    dbg('login: bad response from server');
                    reject({
                        errorCode: -2,
                        errorStr: 'Okänt fel från servern'
                    });
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                reject(mkError(jqXHR, url, textStatus, errorThrown));
            }
        });
    });
};

function mkError(jqXHR, url, textStatus, errorThrown) {
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
    dbg('mkerror ' + errorStr);
    return {
        url: url,
        errorCode: jqXHR.status,
        errorStr: errorStr
    };
};

/**
 * Returns Promise
 * @resolve :: { role :: string() }
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function validateTokenP(email, token, personId) {
    // we get the person as a way to validate the token.  on success,
    // the response will contain the user's role.
    setCredentials(email, token);
    return getJSONP('/api/v1/people/' + personId, null)
        .then(function(result) {
            return result.data;
        });
};

export function logout() {
    APIstate.email = null;
    APIstate.token = null;
};

/**
 * personId :: integer()
 * prevetag :: null || opaque()

 * Get the teams in the active races that `personId` is registered for.
 * A race becomes inactive when the results are final.
 *
 * Returns Promise
 * @resolve :: { data :: [teamData :: json()],
 *               modified :: boolean(),
 *               etag :: opaque }
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getActiveTeamsP(personId, prevetag) {
    return getJSONP('/api/v1/teams?has_person=' + personId +
                    '&is_active=true', prevetag);
};

/**
 * teamId :: integer()
 * prevetag :: null || opaque()
 *
 * Get the teams in the active races that `personId` is registered for.
 * A race becomes inactive when the results are final.
 *
 * Returns Promise
 * @resolve :: { data :: json(),
 *               modified :: boolean(),
 *               etag :: opaque }
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getTeamP(teamId, prevetag) {
    return getJSONP('/api/v1/teams/' + teamId, prevetag);
};

/**
 * Returns Promise
 * @resolve :: { data :: json(),
 *               modified :: boolean(),
 *               etag :: opaque }
 * @reject :: { errorCode :: integer(), errorStr :: string() }
*/
export function getRaceP(raceId, prevetag) {
    return getJSONP('/api/v1/races/' + raceId, prevetag);
};

/**
 * Returns Promise
 * @resolve :: json()
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getTerrainP(terrainId) {
    return getS3JSONP('/terrain-' + terrainId + '.json.gz');
};

/**
 * regattaIds :: [regattaId :: integer()]
 * prevetags :: null || opaque()
 * responsefn :: (races :: hash(regattaId -> 'notmodified'
 *                                           | [raceData :: json()],
 *                etags :: opaque())
 * On error, races = etags = null.
 */
export function getRacesPerRegattaP(regattaIds, prevetags) {
    var requests = [];
    for (var i = 0; i < regattaIds.length; i++) {
        var etag = prevetags[regattaIds[i]];
        requests.push(getAJAX('/api/v1/races?from_regatta=' + regattaIds[i],
                              etag, regattaIds[i]));
    }
    // wait for all requests to finish
    return $.when.apply($, requests)
        .then(function() {
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
            return {races: races, etags: etags};
        });
};

/**
 * regattaIds :: [regattaId :: integer()]
 * prevetags :: null || opaque()
 * responsefn :: (teams :: hash(regattaId -> 'notmodified'
 *                                           | [teamData :: json()],
 *                etags :: opaque())
 * On error, teams = etags = null.
 */
export function getTeamsPerRegattaP(regattaIds, prevetags) {
    var requests = [];
    for (var i = 0; i < regattaIds.length; i++) {
        var etag = prevetags[regattaIds[i]];
        requests.push(getAJAX('/api/v1/teams?from_regatta=' + regattaIds[i],
                              etag, regattaIds[i]));
    }
    // wait for all requests to finish
    return $.when.apply($, requests)
        .then(function() {
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
            return {teams: teams, etags: etags};
        });
};

/**
 * Returns Promise
 * @resolve :: data :: any()
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getTeamLogP(teamId, client, updatedAfter) {
    var url = '/api/v1/logs?from_team=' + teamId;
    if (client) {
        url += '&not_client=' + client;
    }
    if (updatedAfter) {
        url += '&updated_after=' + updatedAfter;
    }
    return getJSONP(url, null)
        .then(function(result) {
            return result.data;
        });
};

export function getNewRegattaLogP(regattaId, teamId, updatedAfter) {
    var url = '/api/v1/logs?from_regatta=' + regattaId + '&has_type=round';
    if (teamId) {
        url += '&not_team=' + teamId;
    }
    if (updatedAfter) {
        url += '&updated_after=' + updatedAfter;
    }
    return getJSONP(url, null)
        .then(function(result) {
            return result.data;
        });
};

/**
 * Returns Promise
 * @resolve :: data :: any()
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
export function getFullRegattaLogP(regattaId) {
    var url = '/api/v1/logs?from_regatta=' + regattaId;
    return getJSONP(url, null)
        .then(function(result) {
            return result.data;
        });
};

export function postLogEntryP(data) {
    return postJSONP('/api/v1/logs', data);
};

export function patchLogEntryP(logid, data) {
    return patchJSONP('/api/v1/logs/' + logid, data);
};

/**
 * Returns Promise
 * @resolve :: { etag :: string(), modified :: boolean(), data :: any() }
 * @reject :: { errorCode :: integer(), errorStr :: string() }
 */
function getJSONP(urlpath, etag) {
    var url = URL + urlpath;
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: url,
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
                //dbg(urlpath + ' -> ' + JSON.stringify(data));
                resolve({
                    etag: jqXHR.getResponseHeader('ETag'),
                    modified: (jqXHR.status != 304),
                    data: data
                });
            },
            error: function(jqXHR, textStatus, errorThrown) {
                var errorstr = 'req error for ' + urlpath + ': ' +jqXHR.status;
                dbg(errorstr);
                debugInfo['getjsonerror'] = errorstr + ' ' +
                    moment().format();
                reject(mkError(jqXHR, url, textStatus, errorThrown));
            }
        });
    });
};


function getAJAX(urlpath, etag, opaque) {
    //dbg('req: ' + urlpath);
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

function getS3JSONP(urlpath) {
    var url = S3URL + urlpath;
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: url,
            dataType: 'json',
            success: function(data) {
                //dbg(urlpath + ' -> (data)');
                resolve(data);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                var errorstr = 'req error for ' + urlpath + ': ' +jqXHR.status;
                dbg(errorstr);
                debugInfo['gets3error'] = errorstr + ' ' +
                    moment().format();
                reject(mkError(jqXHR, url, textStatus, errorThrown));
            }
        });
    });
};

function postJSONP(urlpath, data) {
    return setJSONP('POST', urlpath, data);
};

function patchJSONP(urlpath, data) {
    return setJSONP('PATCH', urlpath, data);
};

function setJSONP(method, urlpath, data) {
    var url = URL + urlpath;
    return new Promise(function(resolve, reject) {
        //dbg(urlpath + ' <- ' + JSON.stringify(data));
        $.ajax({
            url: url,
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
                if (data) {
                    resolve(data);
                } else {
                    reject(data);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                if (jqXHR.status == 409) {
                    //dbg(method+' '+urlpath+'returns 409 conflict');
                    resolve('conflict');
                } else {
                    var errorstr = method + ' error for ' + urlpath + ': ' +
                        jqXHR.status;
                    dbg(errorstr);
                    debugInfo['setjsonerr'] = errorstr + ' ' +
                        moment().format();
                    reject(mkError(jqXHR, url, textStatus, errorThrown));
                }
            }
        });
    });
};
