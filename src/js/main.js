/* -*- js -*- */

import {curState} from './state.js';
import {isCordova} from './util.js';
import {onDocumentReady as uiOnDocumentReady,
        onDeviceReady as uiOnDeviceReady} from './ui.js';

// hmm, maybe re-write all modules to not depend on document ready,
// but instead have a document ready in this file, and call the other's
// init functions from here?

export var state = curState;

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
