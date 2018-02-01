/* -*- js -*- */

goog.provide('tf.ui.loginPage');

goog.require('tf.serverAPI');
goog.require('tf.ui');

tf.ui.loginPage.openPage = function() {
    $('#login-error-btn').hide();
    $('#login-submit').val('Login');
    $('#login-email').val(tf.storage.getSetting('email'));
    $('#login-password').val(tf.storage.getSetting('password'));
    $('#login-save-password').prop('checked',
                                   tf.storage.getSetting('savePassword'));

    tf.ui.pushPage(function() { $('#login-page').modal({backdrop: 'static'}); },
                   function() { $('#login-page').modal('hide'); });
    document.activeElement.blur();
};

tf.ui.loginPage.loginResponseFn = function(response) {
    $('#login-submit').val('Login');
    if (response) {
        props = {
            email: response.email,
            password: response.password,
            token: response.token,
            userId: response.userId,
            savePassword: $('#login-save-password').prop('checked')
        };
        if (!props.savePassword) {
            props.password = null;
        }
        //console.log('set: ' + JSON.stringify(props));
        tf.storage.setSettings(props);
        tf.state.loggedIn();
        tf.ui.popPage();
    } else {
        $('#login-error-btn').val('Inloggningen misslyckades');
        $('#login-error-btn').show();
    }
};

tf.ui.loginPage._submit = function() {
    $('#login-submit').val('Loggar in...');
    tf.serverAPI.login($('#login-email').val(),
                       $('#login-password').val(),
                       tf.ui.loginPage.loginResponseFn);
};

$(document).ready(function() {
    url = tf.serverAPI.URL;
    if (tf.state.isCordova) {
        $('#login-register').on('click', function() {
            SafariViewController.isAvailable(function(available) {
                if (available) {
                    SafariViewController.show({
                        url: url,
                        hidden: false,
                        animated: false
                        //barColor: "#0000ff", // default is white (iOS 10 only)
                        //tintColor: "#ffffff" // default is ios blue
                    });
                } else {
                    window.open(url);
                }
            });
        });
    } else {
        $('#login-register').attr('href', url);
    }

    $("#login-password").on('keyup', function (e) {
        // Try to be smart; if enter is pressed in password field,
        // and we have both email and password, then login.
        // For some reason, it seems 'submit' is not fired when
        // 'Go' is clicked in password field on Android.
        if (e.keyCode == 13) {
            if ($('#login-email').val() != '' &&
                $('#login-password').val() != '') {
                tf.ui.loginPage._submit();
            }
        }
    });

    $('#login-error-btn').on('click', function() {
        $('#login-error-btn').hide();
    });

    $('#login-submit').on('click', function() {
        tf.ui.loginPage._submit();
        return false;
    });
});

