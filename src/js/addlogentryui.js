/* -*- js -*- */

import {pushPage, popPage} from './pageui.js';
import {openLogEntry} from './logentryui.js';

export function openPage(options) {
    if (options.type == 'admin') {
        $('#tf-log-team').hide();
        $('#tf-log-admin').show();
    } else {
        $('#tf-log-admin').hide();
        $('#tf-log-team').show();
    }

    /* Modify the text depending on current state */
    if (options.logBook.getPrevRound(options.beforeId) == null) {
        $('#tf-log-round').text('Start');
        $('#tf-log-retire').text('Startar inte (DNS)');
    } else {
        $('#tf-log-round').text('Rundning');
        $('#tf-log-retire').text('Bryter seglingen (DNF)');
    }
    if (!options.logBook.getLanterns(options.beforeId)) {
        $('#tf-log-lanterns').text('Tänder lanternor');
    } else {
        $('#tf-log-lanterns').text('Släcker lanternor');
    }
    if (!options.logBook.getEngine(options.beforeId)) {
        $('#tf-log-engine').text('Startar motor för laddning');
    } else {
        $('#tf-log-engine').text('Stänger av motor för laddning');
    }
    if (!options.logBook.getInterrupt(options.beforeId)) {
        $('#tf-log-interrupt').text('Tillfälligt avbrott i seglingen');
    } else {
        $('#tf-log-interrupt').text('Återupptar seglingen');
    }

    var page = $('#add-log-entry-page')[0];
    page.tfOptions = options;
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
                logBook: page.tfOptions.logBook,
                beforeId: page.tfOptions.beforeId,
                time: page.tfOptions.time,
                onclose: page.tfOptions.onclose,
                type: $(event.target).data('type') // html5 data-type attribute
            });
            return true;
        });
        return false;
    });
});
