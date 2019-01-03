/* -*- js -*- */

import {curState} from './state.js';
import {isCordova} from './util.js';
import {onDocumentReady as uiOnDocumentReady,
        onDeviceReady as uiOnDeviceReady} from './ui.js';

export var state = curState; // for debugging; access as tf.state

$(document).ready(function() {
    uiOnDocumentReady();
    if (isCordova) {
        document.addEventListener('deviceready', onDeviceReady, false);
    } else {
        onDeviceReady();
    }
});

function onDeviceReady() {
    uiOnDeviceReady();
};
