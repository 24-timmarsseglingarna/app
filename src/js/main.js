/* -*- js -*- */

import {init as initState, curState} from './state.js';
import {isCordova} from './util.js';
import {initMapUI} from './ui.js';
import {basePodSpec} from '../../build/pod.js';
import {Plan} from './plan.js';
import {Pod} from './pod.js';
import {initLogbookMode} from './logbook.js';
import {initLogbookUI} from './logbookui.js';

export var state = curState; // for debugging; access as tf.state

$(document).ready(function() {
    if (isCordova) {
        document.addEventListener('deviceready', onDeviceReady, false);
    } else {
        onDeviceReady();
    }
});

function onDeviceReady() {
    initState();

    if (!isCordova) {
        // This is the web version.  We can assume we have network.
        // Parse query parameters
        var query = window.location.search.slice(1);
        var params = {};
        var i;
        if (query) {
            var arr = query.split('&');
            for (i = 0; i < arr.length; i++) {
                var a = arr[i].split('=');
                var val = typeof(a[1])==='undefined' ? true : a[1];
                params[a[0]] = val;
            }
        }
        if (params['logbook']) {
            // Provide UI to fill in logbook for the given team.
            // Designed to be a link in Giona.
            curState.mode.set('logbook');
            var url = params['url'];
            var email = params['email'];
            var token = params['token'];
            var raceId = params['race'];
            var personId = params['person'];
            var teamId = params['team'];
            initLogbookMode(url, email, token, raceId, personId);
        } else if (params['plan']) {
            // Experimental feature - show a given plan
            var plan = params['plan'];
            var points = plan.split(',');
            var planX = new Plan('Plan X', new Pod(basePodSpec),
                                 undefined);
            for (i = 0; i < points.length; i++) {
                planX.addPoint(points[i]);
            }
            curState.curPlan.set(planX);
        } else if (params['regatta']) {
            // Experimental feature - show all logs in a given regatta
            var regattaId = params['regatta'];
            curState.mode.set('showRegatta');
            curState.showRegattaId.set(regattaId);
        }
    }

    var mode = curState.mode.get();
    if (mode == 'race' || mode == 'showRegatta') {
        initMapUI();
    } else if (mode == 'logbook') {
        initLogbookUI();
    }

    if (isCordova) {
        navigator.splashscreen.hide();
    }
};
