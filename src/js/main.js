/* -*- js -*- */

import {initP as initStateP, curState} from './state.js';
import {isCordova, isTouch} from './util.js';
import {initMapUI} from './ui.js';
import {Plan} from './plan.js';
import {initLogbookUI} from './logbookui.js';
import {setDebugMaxLogLen} from './debug.js';

export var state = curState; // for debugging; access as tf.state

$(document).ready(function() {
    if (isCordova) {
        document.addEventListener('deviceready', onDeviceReady, false);
    } else {
        onDeviceReady();
    }
});

function initRace() {
    curState.mode.set('race');
    initMapUI();
};

var params = {};

function onDeviceReady() {
    if (!isCordova) {
        var query = decodeURIComponent(window.location.search.slice(1));
        if (query) {
            var arr = query.split('&');
            for (var i = 0; i < arr.length; i++) {
                var a = arr[i].split('=');
                var val = typeof(a[1])==='undefined' ? true : a[1];
                params[a[0]] = val;
            }
        }
    }
    if (params['pod']) {
        curState.requestedPodId = params['pod'];
    }
    initStateP()
        .then(function() {
            init();
        })
        .catch(function() {
            init();
        });
};

function init() {
    initDebugLog();
    if (!isTouch) {
        /* Prevent ESC from making whole page blank */
        $(':input').on('keydown', function(e) {
            var isEscape = false;
            if ('key' in e) {
                isEscape = (e.key === 'Escape' || e.key === 'Esc');
            } else {
                isEscape = (e.keyCode === 27);
            }
            if (isEscape) {
                return false;
            }
        });
    }

    var raceId;
    var teamId;

    if (!isCordova) {
        // This is the web version.  We can assume we have network.
        // Parse query parameters
        if (params['map'] == 'eniro') {
            curState.mapURL = 'https://map.eniro.com/geowebcache/service/tms1.0.0/nautical/{z}/{x}/{-y}.png';
            curState.mapMaxZoom = 18;
        }

        if (params['logbook']) {
            // Provide UI to fill in logbook for the given team.
            // Designed to be a link in Giona.
            curState.mode.set('logbook');
            var url = params['url'];
            var email = params['email'];
            var token = params['token'];
            var personId = params['person'];
            raceId = params['race'];
            teamId = params['team'];
            initLogbookUI(url, email, token, raceId, personId, teamId);
        } else if (params['plan']) {
            // Experimental feature - show a given plan
            var plan = params['plan'];
            var points = plan.split(',');
            var planX = new Plan('Plan X', curState.defaultPod, undefined);
            for (var i = 0; i < points.length; i++) {
                planX.addPoint(points[i]);
            }
            curState.curPlan.set(planX);
        } else if (params['regatta']) {
            var regattaId = params['regatta'];
            curState.mode.set('showRegatta');
            curState.showRegattaId.set(regattaId);
            initMapUI();
        } else if (params['chart']) {
            curState.mode.set('showChart');
            initMapUI();
        } else {
            initRace();
        }
    } else {
        // isCordova
        initRace();
        navigator.splashscreen.hide();
    }
};

function initDebugLog() {
    setDebugMaxLogLen(curState.numberOfDebugLogEntries.get());
    curState.numberOfDebugLogEntries.onChange(function(val) {
        if (val >= 0 && val <= 1000) {
            setDebugMaxLogLen(val);
        }
    });
};
