/* -*- js -*- */

import {curState, activateRace} from './state.js';
import {pushPage} from './pageui.js';
import {getSetting} from './storage.js';
import {getMyRaces, updateServerDataP} from './serverdata.js';
import {URL} from './serverapi.js';

export function openPage() {

    // fill the list of races in which the user participates
    populateRaces();
    pushPage(
        function() { $('#activate-race-page').modal({backdrop: 'static'}); },
        function() { $('#activate-race-page').modal('hide'); });
    document.activeElement.blur();
};

function populateRaces() {
    var races = getMyRaces();
    var curActiveRaceId = 0;
    var curRace = curState.curRace.get();
    if (curRace) {
        curActiveRaceId = curRace.getId();
    }
    if (races.length == 0) {
        $('#activate-race-list').hide();
        $('#activate-race-no-races').show();
        $('#activate-race-register-link').attr('href', URL);
    } else {
        $('#activate-race-list').show();
        $('#activate-race-no-races').hide();
        var s = '';
        s += '<button type="button" autocomplete="off"' +
             ' id="activate-race-button-0"' +
             ' onclick="window.tfUiActivateRaceButtonClick(0)"' +
            ' class="list-group-item list-group-item-action' +
            ' align-items-start';
        if (curActiveRaceId == 0) {
            s += ' active';
        }
        s += '">' +
            '<strong>Ingen segling aktiverad</strong>' +
            '</button>';

        // FIXME: read pod from server
        var pod = curState.defaultPod;

        for (var i = 0; i < races.length; i++) {
            var r = races[i].raceData;
            var t = races[i].teamData;
            var isActive = (r.id == curActiveRaceId);
            var p;
            s += '<button type="button" autocomplete="off"' +
                ' id="activate-race-button-' + r.id + '"' +
                ' onclick="window.tfUiActivateRaceButtonClick(' + r.id + ')"' +
                ' class="list-group-item list-group-item-action' +
                ' align-items-start';
            if (isActive) {
                s += ' active';
            }
            s += '">' +
                '<strong>' + r.regatta_name + '</strong><br/>' +
                '<span class="small">' +
                r.organizer_name + '<br/>' +
                r.period + ' timmar, ';
            if (r.description) {
                s += r.description;
            }
            if (r.common_finish) {
                s += ', gemensamt mål ' + r.common_finish;
                p = pod.getPoint(r.common_finish);
                if (p) {
                    s += ' ' + p.name;
                }
            } else {
                s += ', mål vid start';
            }
            s += '<br/>';

            s += 'Start: ' + r.start_from.format('dddd D MMMM Y [kl.] HH:mm');
            if (!r.start_from.isSame(r.start_to)) {
                s += ' - ';
                if (r.start_from.isSame(r.start_to, 'day')) {
                    s += r.start_to.format('HH:mm');
                } else {
                    s += r.start_to.format('dddd D MMMM Y [kl.] HH:mm');
                }
            }
            s += ' från ' + t.start_point;
            p = pod.getPoint(t.start_point);
            if (p) {
                s += ' ' + p.name;
            }
            s += '<br/>';
            s += t.boat_type_name + ' ' + (t.boat_sail_number || '') + ' ' +
                t.boat_name;
            s += '</span></button>';
        }
        $('#activate-race-buttons').html(s);
    }
};

window.tfUiActivateRaceButtonClick = function(raceId) {
    var id = '#activate-race-button-' + raceId;
    var btn = $(id);
    btn.parent().find('button').removeClass('active');
    btn.addClass('active');

    activateRace(raceId);
};

/**
 * Set up handlers for buttons
 */
$(document).ready(function() {
    $('#activate-update-btn').on('click', function() {
        updateServerDataP(getSetting('personId'))
            .then(function() {
                populateRaces();
            });
    });
});
