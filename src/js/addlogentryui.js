/* -*- js -*- */

import {pushPage, popPage} from './pageui.js';
import {openLogEntry} from './logentryui.js';

export function openPage(options) {

    /* Modify the text depending on current state */
    if (options.logbook.getPrevRound(options.beforeId) == null) {
        $('#tf-log-round').text('Start');
    } else {
        $('#tf-log-round').text('Rundning');
    }
    if (!options.logbook.getLanterns(options.beforeId)) {
        $('#tf-log-lanterns').text('Tänder lanternor');
    } else {
        $('#tf-log-lanterns').text('Släcker lanternor');
    }
    if (!options.logbook.getEngine(options.beforeId)) {
        $('#tf-log-engine').text('Startar motor för laddning');
    } else {
        $('#tf-log-engine').text('Stänger av motor för laddning');
    }
    if (!options.logbook.getInterrupt(options.beforeId)) {
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
                logBook: page.tfOptions.logbook,
                time: page.tfOptions.time,
                onclose: page.tfOptions.onclose,
                type: $(event.target).data('type') // html5 data-type attribute
            });
        });
        return false;
    });
});
