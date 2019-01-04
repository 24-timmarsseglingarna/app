/* -*- js -*- */

import {init as initState, curState} from './state.js';
import {isCordova} from './util.js';
import {initMapUI} from './ui.js';
import {basePodSpec} from '../../build/pod.js';
import {Plan} from './plan.js';
import {Pod} from './pod.js';

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
            var teamid = params['teamId'];
            var personId = params['personId'];
            var token = params['token'];
            var email = params['email'];
            // TODO: set up server communication; no login window
            // get log from server
            // display log window
            // Q: slightly tweak layout to fit this (non-app) purpose better
            //    e.g., chnage '+' to button?  send to server with special
            //    button?  make it clear that they must sign!
        } else if (params['plan']) {
            // Experimental and undocumented feature - show a given plan
            var plan = params['plan'];
            var points = plan.split(',');
            var planX = new Plan('Plan X', new Pod(basePodSpec),
                                 undefined);
            for (i = 0; i < points.length; i++) {
                planX.addPoint(points[i]);
            }
            curState.curPlan.set(planX);
        } else if (params['regatta']) {
            // Experimental and undocumented feature - show all logs in
            // a given regatta
            var regattaId = params['regatta'];
            curState.mode.set('showRegatta');
            curState.showRegattaId.set(regattaId);
        }
    }

    var mode = curState.mode.get();
    if (mode == 'race' || mode == 'showRegatta') {
        initMapUI();
    }

    if (isCordova) {
        navigator.splashscreen.hide();
    }
};
