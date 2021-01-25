/* -*- js -*- */

import {pushPage, popPage} from './pageui.js';

/**
 * Confirm (Cancel/Continue) dialog.
 */

// cancelFn may be 'null'
export function confirm(html, cancelLabel, continueLabel,
                        cancelFn, continueFn) {
    $('#confirm-body').html(html);
    $('#confirm-cancel').prop('value', cancelLabel);
    $('#confirm-cancel').on('click', function() {
        $('#confirm-cancel').off();
        popPage(cancelFn);
        return false;
    });
    $('#confirm-continue').prop('value', continueLabel);
    $('#confirm-continue').on('click', function() {
        // remove the dynamic 'on' handler (actually, remove _all_ handlers,
        // but we just have one)
        $('#confirm-continue').off();
        popPage(continueFn);
        return false;
    });
    pushPage(
        function() { $('#confirm-page').modal({backdrop: 'static'}); },
        function() { $('#confirm-page').modal('hide'); });
};
