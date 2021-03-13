/* -*- js -*- */

import {checkServerCompatibleP, loginP} from './state.js';
import {pushPage, popPage} from './pageui.js';
import {alertUpgrade} from './alertui.js';
import {URL} from './serverapi.js';
import {isCordova} from './util.js';
import {getSetting} from './storage.js';
import {dbg} from './debug.js';

export function openPage() {
    checkServerCompatibleP()
        .then(function() {
            openPage2();
        })
        .catch(function(response) {
            alertUpgrade(response);
        });
};

function openPage2() {
    $('#login-error-btn').hide();
    $('#login-submit').val('Login');
    $('#login-email').val(getSetting('email'));
    $('#login-password').val(getSetting('password'));
    $('#login-save-password').prop('checked', getSetting('savePassword'));
    pushPage(function() { $('#login-page').modal({backdrop: 'static'}); },
             function() { $('#login-page').modal('hide'); });
    document.activeElement.blur();
};

function submit() {
    $('#login-error-btn').hide();
    $('#login-submit').val('Loggar in...');
    loginP($('#login-email').val(),
           $('#login-password').val(),
           $('#login-save-password').prop('checked'))
        .then(function() {
            $('#login-submit').val('Login');
            popPage();
        })
        .catch(function(response) {
            $('#login-submit').val('Login');
            dbg('loginPage response: ' + response.errorStr);
            $('#login-error-btn').val(response.errorStr);
            $('#login-error-btn').show();
        });
};

$(document).ready(function() {
    if (isCordova) {
        $('#login-register').on('click', function() {
            SafariViewController.isAvailable(function(available) {
                if (available) {
                    SafariViewController.show({
                        url: URL,
                        hidden: false,
                        animated: false
                        //barColor: "#0000ff", // default is white (iOS 10 only)
                        //tintColor: "#ffffff" // default is ios blue
                    });
                } else {
                    window.open(URL);
                }
            });
        });
    } else {
        $('#login-register').attr('href', URL);
    }

    $('#login-password').on('keyup', function(e) {
        // Try to be smart; if enter is pressed in password field,
        // and we have both email and password, then login.
        // For some reason, it seems 'submit' is not fired when
        // 'Go' is clicked in password field on Android.
        if (e.keyCode == 13) {
            if ($('#login-email').val() != '' &&
                $('#login-password').val() != '') {
                submit();
            }
        }
    });

    $('#login-error-btn').on('click', function() {
        $('#login-error-btn').hide();
    });

    $('#login-submit').on('click', function() {
        submit();
        return false;
    });
});

