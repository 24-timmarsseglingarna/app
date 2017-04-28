/* -*- js -*- */

goog.provide('tf.ui.activateRace');

goog.require('tf.ui');
goog.require('tf.ui.alert');

tf.ui.activateRace.openPage = function() {

    // fill the list of races in which the user participates
    tf.ui.activateRace._populateRaces();

    var page = document.getElementById('activate-race-page');
    page.showModal();
    tf.ui.pushPage(function() {
        page.close();
    });
    document.activeElement.blur();
};

tf.ui.activateRace._populateRaces = function() {
    var racesData = tf.serverData.getRacesData();
    var curActiveRaceId = tf.storage.getSetting('activeRaceId');
    $('#activate-race-races').empty();
    if (racesData.length == 0) {
        $('#activate-race-races').
            append(new Option('-- inga seglingar funna --', '-1'));
    } else {
        $('#activate-race-races').
            append(new Option('-- ingen segling vald --', '-1'));
        for (var i = 0; i < racesData.length; i++) {
            var isActive = (racesData[i].id == curActiveRaceId);
            $('#activate-race-races').
                append(new Option(racesData[i].name, racesData[i].id,
                                  false, isActive));
        }
    }
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    var page = document.getElementById('activate-race-page');

    $('#activate-race-races').on('change', function() {
        // a race is selected, store this fact in settings
        var raceId = $(this).val();
        if (raceId > 0) {
            tf.state.setActiveRace(raceId);
        } else {
            tf.state.setActiveRace(null);
        }
    });
});

