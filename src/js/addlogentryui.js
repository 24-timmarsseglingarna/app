/* -*- js -*- */

import {curState} from './state.js';
import {pushPage, popPage} from './pageui.js';
import {openLogEntry} from './logentryui.js';

export function openPage(options) {

    /* Modify the text depending on current state */
    if (!curState.boatState.lanterns) {
        $('#tf-log-lanterns').text('Tänder lanternor');
    } else {
        $('#tf-log-lanterns').text('Släcker lanternor');
    }
    if (!curState.boatState.engine) {
        $('#tf-log-engine').text('Startar motor för laddning');
    } else {
        $('#tf-log-engine').text('Stänger av motor för laddning');
    }
    if (!curState.activeInterrupt) {
        $('#tf-log-interrupt').text('Tillfälligt avbrott i seglingen');
    } else {
        $('#tf-log-interrupt').text('Återupptar seglingen');
    }

    var page = $('#add-log-entry-page')[0];
    page.tfOptions = options || {};
    pushPage(
        function() { $('#add-log-entry-page').modal({backdrop: 'static'}); },
        function() { $('#add-log-entry-page').modal('hide'); });
    document.activeElement.blur();
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('.tf-log-item').on('click', function(event) {
        // remove the addLogEntry page from page stack
        var page = $('#add-log-entry-page')[0];
        popPage(function() {
            openLogEntry({
                logBook: curState.curLogBook.get(),
                time: page.tfOptions.time,
                onclose: page.tfOptions.onclose,
                type: $(event.target).data('type') // html5 data-type attribute
            });
        });
        return false;
    });
});
