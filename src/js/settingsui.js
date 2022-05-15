/* -*- js -*- */

import {curState, logout, reset as resetState} from './state.js';
import {defaultClientId} from './util.js';
import {pushPage, popPage} from './pageui.js';
import {openPage as openLoginPage} from './loginui.js';
import {alert} from './alertui.js';
import {getSetting} from './storage.js';
import {debugInfo, debugLog} from './debug.js';

export function openPage() {
    if (curState.loggedInPersonId.get()) {
        $('#settings-login-block').hide();
        $('#settings-logout-block').show();
        $('#settings-logout-text').text('Du är inloggad som ' +
                                        getSetting('email'));
    } else {
        $('#settings-login-block').show();
        $('#settings-logout-block').hide();
    }
    $('#settings-plans').removeClass('is-invalid');
    $('#settings-plans').val(curState.numberOfPlans.get());
    $('#settings-logs').removeClass('is-invalid');
    $('#settings-logs').val(curState.numberOfDebugLogEntries.get());
    $('#settings-client-id').val(curState.clientId.get());
    $('#settings-poll-interval').removeClass('is-invalid');
    $('#settings-poll-interval').val(curState.pollInterval.get());
    $('#settings-tracker-interval').removeClass('is-invalid');
    $('#settings-tracker-interval').val(curState.trackerInterval.get());
    $('#settings-tracker-distance').removeClass('is-invalid');
    $('#settings-tracker-distance').val(curState.trackerDistance.get());
    $('#settings-tracker-enabled').prop(
        'checked', curState.trackerEnabled.get());
    $('#settings-font-size').val(curState.fontSize.get());
    $('#settings-immediate-log-send').prop(
        'checked', curState.immediateSendToServer.get());
    switch (curState.serverId.get()) {
    case 2:
        $('#settings-server-staging').prop('checked', true);
        break;
    default:
        $('#settings-server-production').prop('checked', true);
        break;
    }
    pushPage(
        function() { $('#settings-page').modal({backdrop: 'static'}); },
        function() { $('#settings-page').modal('hide'); });
    document.activeElement.blur();
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('#settings-login-btn').on('click', function() {
        popPage(function() {
            openLoginPage();
        });
        return false;
    });

    $('#settings-logout-btn').on('click', function() {
        logout();
        popPage(function() {
            // after logout, go to login page
            openLoginPage();
        });
        return false;
    });

    $('#settings-clear-state-btn').on('click', function() {
        popPage();
        resetState(true, openLoginPage);
        return false;
    });

    $('#settings-show-debug-btn').on('click', function() {
        var html = '<ul class="list-group">';
        for (var key in debugInfo) {
            var val = debugInfo[key];
            if (typeof val === 'function') {
                var keyvals = val();
                for (var i = 0; i < keyvals.length; i++) {
                    html += '<li class="list-group-item">' +
                        keyvals[i].key + ': ' + keyvals[i].val + '</li>';
                }
            } else {
                html += '<li class="list-group-item">' +
                    key + ': ' + val + '</li>';
            }
        }
        html += '</ul>';
        for (var k = 0; k < debugLog.length; k++) {
            var s = [];
            for (var j = 0; j < debugLog[k].args.length; j++) {
                s.push(debugLog[k].args[j]);
            }
            html += debugLog[k].time.format() + ' ' +
                s.join(' ') + '<br/>';
        }
        alert(html);
        return false;
    });

    $('#settings-client-id').blur(function() {
        if ($('#settings-client-id').val().trim() == '') {
            $('#settings-client-id').val(defaultClientId());
        }
    });

    $('#settings-save-btn').on('click', function() {
        if ($('#settings-plans').hasClass('is-invalid') ||
            $('#settings-poll-interval').hasClass('is-invalid') ||
            $('#settings-logs').hasClass('is-invalid')) {
            return false;
        }
        var numberOfPlans = parseInt($('#settings-plans').val());
        curState.numberOfPlans.set(numberOfPlans);
        var numberOfDebugLogEntries = parseInt($('#settings-logs').val());
        curState.numberOfDebugLogEntries.set(numberOfDebugLogEntries);
        var pollInterval = parseInt($('#settings-poll-interval').val());
        curState.pollInterval.set(pollInterval);
        var trackerInterval = parseInt($('#settings-tracker-interval').val());
        curState.trackerInterval.set(trackerInterval);
        var trackerDistance = parseInt($('#settings-tracker-distance').val());
        curState.trackerDistance.set(trackerDistance);
        curState.trackerEnabled.set(
            $('#settings-tracker-enabled').prop('checked'));
        curState.clientId.set($('#settings-client-id').val().trim());
        curState.fontSize.set($('#settings-font-size').val());
        curState.immediateSendToServer.set(
            $('#settings-immediate-log-send').prop('checked'));
        var serverId = 1;
        if ($('#settings-server-staging').prop('checked')) {
            serverId = 2;
        }
        curState.serverId.set(serverId);

        popPage();
        return false;
    });

    $('#settings-plans').blur(function() {
        var plans = parseInt($('#settings-plans').val());
        if (plans >= 1 && plans <= 9) {
            $('#settings-plans').removeClass('is-invalid');
            //curState.numberOfPlans.set(plans);
        } else {
            $('#settings-plans').addClass('is-invalid');
        }
    });

    $('#settings-poll-interval').blur(function() {
        var pollInterval = parseInt($('#settings-poll-interval').val());
        if (pollInterval >= 0 && pollInterval <= 3600) {
            $('#settings-poll-interval').removeClass('is-invalid');
            //curState.pollInterval.set(pollInterval);
        } else {
            $('#settings-poll-interval').addClass('is-invalid');
        }
    });

    $('#settings-logs').blur(function() {
        var logs = parseInt($('#settings-logs').val());
        if (logs >= 0 && logs <= 1000) {
            $('#settings-logs').removeClass('is-invalid');
        } else {
            $('#settings-logs').addClass('is-invalid');
        }
    });

    $('#settings-tracker-interval').blur(function() {
        var trackerInterval = parseInt($('#settings-tracker-interval').val());
        if (trackerInterval >= 0 && trackerInterval <= 3600) {
            $('#settings-tracker-interval').removeClass('is-invalid');
        } else {
            $('#settings-tracker-interval').addClass('is-invalid');
        }
    });

    $('#settings-tracker-distance').blur(function() {
        var trackerDistance = parseInt($('#settings-tracker-distance').val());
        if (trackerDistance >= 0 && trackerDistance <= 3704) {
            $('#settings-tracker-distance').removeClass('is-invalid');
        } else {
            $('#settings-tracker-distance').addClass('is-invalid');
        }
    });

});
