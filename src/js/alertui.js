/* -*- js -*- */

import {pushPage, popPage} from './pageui.js';

/**
 * HTML-based alert function.  Does not use window.alert().
 */

export function alert(html) {
    $('#alert-body').html(html);
    pushPage(function() { $('#alert-page').modal({backdrop: 'static'}); },
             function() { $('#alert-page').modal('hide'); });
};

export function alertUpgrade(text) {
    alert(
        '<p>Den här versionen av appen är inte kompatibel med servern. ' +
            'Du behöver uppgradera appen.</p>' +
            '<p>' + text + '</p>');
};

$(document).ready(function() {
    $('#alert-ok').on('click', function() {
        popPage();
        return false;
    });
});
