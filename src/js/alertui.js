/* -*- js -*- */

import {pushPage, popPage} from './pageui.js';

/**
 * HTML-based alert function.  Does not use window.alert().
 */

export function alert(html, continueFn) {
    $('#alert-body').html(html);
    $('#alert-ok').on('click', function() {
        // remove the dynamic 'on' handler (actually, remove _all_ handlers,
        // but we just have one)
        $('#alert-ok').off();
        popPage(continueFn);
        return false;
    });
    pushPage(function() { $('#alert-page').modal({backdrop: 'static'}); },
             function() { $('#alert-page').modal('hide'); });
};

export function alertUpgrade(text) {
    alert(
        '<p>Den här versionen av appen är inte kompatibel med servern. ' +
            'Du behöver uppgradera appen.</p>' +
            '<p>' + text + '</p>');
};
