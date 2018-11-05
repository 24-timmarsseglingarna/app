/* -*- js -*- */

import {pushPage, popPage} from './pageui.js';

/**
 * Confirm (Cancel/Continue) dialog.
 */

export function confirm(html, cancelLabel, continueLabel, continueFn) {
    $('#confirm-body').html(html);
    $('#confirm-cancel').prop('value', cancelLabel);
    $('#confirm-continue').prop('value', continueLabel);
    $('#confirm-continue').on('click', function() {
        popPage(continueFn);
        return false;
    });
    pushPage(
        function() { $('#confirm-page').modal({backdrop: 'static'}); },
        function() { $('#confirm-page').modal('hide'); });
};

$(document).ready(function() {
    $('#confirm-cancel').on('click', function() {
        popPage();
        return false;
    });
});
