/* -*- js -*- */

goog.provide('tf.ui.logEntry');

goog.require('tf.serverData');
goog.require('tf.ui');

tf.ui.logEntry.onclose = undefined;

// FIXME: should not know anything about logbook. pass an entry
// instead, and a save function to be invoked.


tf.ui.logEntry.fmtInterrupt = function(interrupt) {
    var s;
    if (interrupt == undefined) {
        return '-';
    }
    switch (interrupt.type) {
    case 'done':
        s = 'Åter segling';
        break;
    case 'bridge':
        s = 'Broöppning';
        break;
    case 'anchor':
        s = 'Ankring';
        break;
    case 'engine':
        s = 'Motorgång';
        break;
    case 'visibility':
        s = 'Dålig sikt';
        break;
    case 'repair':
        s = 'Reparation';
        break;
    case 'rescue-time':
        s = 'Undsättning';
        break;
    case 'rescue-dist':
        s = 'Undsättning';
        break;
    }
    return s;
};

tf.ui.logEntry.fmtProtest = function(protest) {
    if (protest == undefined || protest.boat == -1) {
        return '-';
    } else {
        return 'Mot ' + protest.boat;
    }
};

tf.ui.logEntry.fmtSails = function(sails) {
    if (sails == undefined) {
        return '';
    }
    var s = [];
    if (sails.reef) {
        s.push('rev');
    } else if (sails.main) {
        s.push('stor');
    }
    if (sails.jib) {
        s.push('fock');
    } else if (sails.genoa) {
        s.push('genua');
    }
    if (sails.code) {
        s.push('code');
    } else if (sails.gennaker) {
        s.push('gennaker');
    } else if (sails.spinnaker) {
        s.push('spinnaker');
    }
    if (sails.other != undefined && sails.other != '') {
        s.push(sails.other);
    }
    if (s.length == 0) {
        return '-';
    } else {
        return s.join(',');
    }
};

tf.ui.logEntry.fmtOther = function(e) {
    var s = [];
    if (e.lanterns == 'on') {
        s.push('lanternor på');
    } else if (e.lanterns == 'off') {
        s.push('lanternor på');
    }
    if (e.engine == 'on') {
        s.push('motor på');
    } else if (e.engine == 'off') {
        s.push('motor av');
    }
    if (e.endofrace != undefined) {
        s.push('segling slut');
    }
    return s.join(',');
};

/**
 * options:
 *  logBook - mandatory
 *  type :: 'round' | 'endOfRace'
 *        | 'seeOtherBoats' | 'protest' | 'interrupt'
 *        | 'changeSails' | 'engine' | 'lanterns'
 *        | 'other'
 *  index  -- either type or index MUST be given
 *  point
 *  onclose
 *  time :: Moment
*/
tf.ui.logEntry.openLogEntry = function(options) {
    if (!options.logBook) {
        return;
    }
    var type;
    var title;
    var isStart = false;
    var log = options.logBook.log;

    if (options.type) {
        type = options.type;
    } else if (options.index != undefined) {
        type = log[options.index].type;
    }
    if (type == 'round') {
        isStart = true;
        var end;
        if (options.index) {
            end = options.index;
        } else {
            end = log.length;
        }
        for (var i = 0; i < end && isStart; i++) {
            if (log[i].type == 'round') {
                isStart = false;
            }
        }
    }

    // hide everything except time and comment
    $('.log-entry-form').hide();
    $('#log-entry-form-time').show();
    $('#log-entry-form-comment').show();

    var regattaId = options.logBook.race.getRegattaId();

    switch (type) {
    case 'round':
        title = 'Rundning';
        $('#log-entry-form-point').show();
        $('#log-entry-form-wind').show();
        if (isStart) {
            title = 'Start';
            tf.ui.logEntry._initBoats(regattaId);
            $('#log-entry-form-finish').hide();
            $('#log-entry-form-boats').show();
            $('#log-entry-form-sail').show();
        }
        break;
    case 'endOfRace':
        // FIXME
        title = 'Segelperiodens slut';
        tf.ui.logEntry._initGeoPosition();
        $('#log-entry-form-position').show();
        break;
    case 'seeOtherBoats':
        title = 'Siktar båtar';
        tf.ui.logEntry._initBoats(regattaId);
        $('#log-entry-form-boats').show();
        $('#log-entry-form-position').show();
        break;
    case 'protest':
        title = 'Observation regelbrott';
        tf.ui.logEntry._initGeoPosition();
        tf.ui.logEntry._initProtest(regattaId);
        $('#log-entry-form-protest').show();
        $('#log-entry-form-position').show();
        break;
    case 'interrupt':
        title = 'Avbrott';
        tf.ui.logEntry._initGeoPosition();
        $('#log-entry-form-interrupt').show();
        $('#log-entry-form-position').show();
        break;
    case 'changeSails':
        title = 'Segelskifte';
        $('#log-entry-form-sail').show();
        $('#log-entry-form-sail2').show();
        $('#log-entry-form-wind').show();
        break;
    case 'engine':
        title = 'Motor för laddning';
        $('#log-entry-form-engine').show();
        break;
    case 'lanterns':
        title = 'Lanternor';
        $('#log-entry-form-lanterns').show();
        $('#log-entry-form-position').show();
        break;
    case 'other':
        // FIXME
        title = 'Övrigt';
        break;
    }

    $('#log-entry-title-type').text(title);

    if (options.index != undefined) {
        /* open an existing log entry */
        var entry = log[options.index];

        var dt = moment(entry.time);
        $('#log-entry-timepicker').data('DateTimePicker').date(dt);
        $('#log-entry-datepicker').data('DateTimePicker').date(dt);

        if (entry.point != undefined) {
            $('#log-entry-point').val(entry.point);
        }
        if (entry.finish != undefined) {
            $('#log-entry-finish').prop('checked', entry.finish);
        }

        if (entry.wind != undefined) {
            tf.ui.logEntry._initWind(entry.wind);
        }

        if (entry.interrupt != undefined) {
            switch (entry.interrupt.type) {
            case 'done':
                $('#log-entry-interrupt-done').prop('checked', true);
                break;
            case 'bridge':
                $('#log-entry-interrupt-bridge').prop('checked', true);
                break;
            case 'anchor':
                $('#log-entry-interrupt-anchor').prop('checked', true);
                break;
            case 'engine':
                $('#log-entry-interrupt-engine').prop('checked', true);
                break;
            case 'visibility':
                $('#log-entry-interrupt-visibility').prop('checked', true);
                break;
            case 'repair':
                $('#log-entry-interrupt-repair').prop('checked', true);
                break;
            case 'rescue-time':
                $('#log-entry-interrupt-rescue-time').prop('checked', true);
                break;
            case 'rescue-dist':
                $('#log-entry-interrupt-rescue-distance').prop('checked', true);
                break;
            }
        }

        if (entry.engine != undefined) {
            switch (entry.engine) {
            case 'on':
                $('#log-entry-engine-on').prop('checked', true);
                break;
            case 'off':
                $('#log-entry-engine-off').prop('checked', true);
                break;
            }
        }

        if (entry.protest != undefined) {
            boatElement = document.getElementById('log-entry-protest-boat');
            boatElement.options[0].selected = true;
            for (var i = 1; i < boatElement.options.length; i++) {
                if (boatElement.options[i].value == entry.protest.boat) {
                    boatElement.options[i].selected = true;
                }
            }
        }

        if (entry.sails != undefined) {
            tf.ui.logEntry._initSails(entry.sails);
        }

        if (entry.boats != undefined) {
            boatsElement = document.getElementById('log-entry-boats');
            for (var i = 0; i < boatsElement.options.length; i++) {
                var val = boatsElement.options[i].value;
                if ($.inArray(val, entry.boats) != -1) {
                    boatsElement.options[i].selected = true;
                }
            }
        }
        if (entry.lanterns != undefined) {
            $('#log-entry-lanterns').prop('checked', entry.lanterns);
        }

        if (entry.endOfRace != undefined) {
            $('#log-entry-end-of-race').prop('checked', true);
        }

        if (entry.position != undefined) {
            $('#log-entry-position').val(entry.position);
        }

        if (entry.comment != undefined) {
            $('#log-entry-comment').val(entry.comment);
        } else {
            $('#log-entry-comment').val('');
        }
    } else {
        var point = options.point || '';
        $('#log-entry-point').val(point);
        var time;
        if (options.time) {
            time = options.time;
        } else {
            time = moment();
        }
        $('#log-entry-timepicker').data('DateTimePicker').date(time);
        $('#log-entry-datepicker').data('DateTimePicker').date(time);
        // reset some fields to empty
        $('#log-entry-finish').prop('checked', false);
        $('#log-entry-comment').val('');
        $('#log-entry-end-of-race').prop('checked', false);

        if (type == 'changeSails' || type == 'round') {
            var found = false;
            for (var i = log.length - 1; !found && i >= 0; i--) {
                // if we find a wind observation from some other entry, use it
                if (log[i].wind) {
                    tf.ui.logEntry._initWind(log[i].wind);
                    found = true;
                }
            }
        }
        if (type == 'changeSails') {
            var found = false;
            for (var i = log.length - 1; !found && i >= 0; i--) {
                console.log('i: ' + i + ' sails: ' + log[i].sails);
                if (log[i].sails) {
                    tf.ui.logEntry._initSails(log[i].sails);
                    found = true;
                }
            }
        }
        if (type == 'round') {
            tf.ui.logEntry._initSails({});
        }
        if (type == 'engine') {
            var found = false;
            for (var i = log.length - 1; !found && i >= 0; i--) {
                if (log[i].type == type && log[i].engine) {
                    switch (log[i].engine) {
                    case 'on':
                        $('#log-entry-engine-off').prop('checked', true);
                        break;
                    case 'off':
                        $('#log-entry-engine-on').prop('checked', true);
                        break;
                    }
                    found = true;
                }
            }
            if (!found) {
                $('#log-entry-engine-on').prop('checked', true);
            }
        }
        if (type == 'lanterns') {
            var found = false;
            for (var i = log.length - 1; !found && i >= 0; i--) {
                if (log[i].type == type && log[i].lanterns) {
                    switch (log[i].lanterns) {
                    case 'on':
                        $('#log-entry-lanterns-off').prop('checked', true);
                        break;
                    case 'off':
                        $('#log-entry-lanterns-on').prop('checked', true);
                        break;
                    }
                    found = true;
                }
            }
            if (!found) {
                $('#log-entry-lanterns-on').prop('checked', true);
            }
        }

    }

    var logEntryPage = document.getElementById('log-entry-page');
    tf.ui.logEntry.onclose = options.onclose;
    logEntryPage.logBook = options.logBook;
    logEntryPage.logEntryIndex = options.index;
    logEntryPage.logEntryType = type;
    if (isStart) {
        logEntryPage.logEntryType = 'start';
    }
    tf.ui.pushPage(function() {
        tf.ui.logEntry.closeLogEntry();
    });
    logEntryPage.showModal();
    document.activeElement.blur();
    if (options.time) {
        // if a time was given, show the time picker b/c the given time
        // was probably not correct.
        $('#log-entry-timepicker').data('DateTimePicker').show();
    }
};

tf.ui.logEntry._initGeoPosition = function() {
    /* NOTE: the HTML and this code assumes lat N and long E */
    var logEntryPage = document.getElementById('log-entry-page');
    if ($('#log-entry-position').val() == '' &&
        navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var lat = pos.coords.latitude.toFixed(4);
                var lng = pos.coords.longitude.toFixed(4);
                if (pos.coords.longitude > 0) {
                    if (pos.coords.longitude < 10) {
                        lng = '00' + lng;
                    } else if (pos.coords.longitude < 100) {
                        lng = '0' + lng;
                    }
                }
                // check that the position is still unset - we don't
                // want to overwrite the user's input
                if ($('#log-entry-position').val() == '') {
                    var s = "N " + lat + "  O " + lng;
                    $('#log-entry-position').val(s);
                }
            },
            function(error) {
                //alert('geo-error: ' + error.code);
            },
            {
                timeout: 1 * 60 * 1000,   // 1 minute
                maximumAge: 2 * 60 * 1000 // 2 minutes old is ok
            }
        );
    }
};

tf.ui.logEntry._getBoatsOptions = function(regattaId) {
    var teams = tf.serverData.getTeamsData(regattaId);
    teams.sort(function(a, b) {
        return Number(a.start_number) - Number(b.start_number);
    });
    boatsOptions = '';
    for (var i = 0; teams && i < teams.length; i++) {
        var sn = teams[i].start_number;
        var bn = teams[i].boat_name;
        var bcn = teams[i].boat_type_name;
        var bsn = teams[i].boat_sail_number;
        boatsOptions +=
            '<option value="' + sn + '">' +
            sn + ' - ' + bn + ', ' + bcn;
        if (bsn) {
            boatsOptions += ', ' + bsn;
        }
        boatsOptions += '</option>';
    }
    return boatsOptions;
};

tf.ui.logEntry._initBoats = function(regattaId) {
    boatsElement = document.getElementById('log-entry-boats');
    // populate 'boats' with list of boats from current regatta
    boatsElement.innerHTML = tf.ui.logEntry._getBoatsOptions(regattaId);
};

tf.ui.logEntry._initProtest = function(regattaId) {
    boatElement = document.getElementById('log-entry-protest-boat');
    boatElement.innerHTML =
        '<option value="-1">-- ingen båt vald --</option>' +
        '<option value="0">Okänd båt</option>' +
        tf.ui.logEntry._getBoatsOptions(regattaId);
    boatElement.options[0].selected = true;
};

tf.ui.logEntry._initSails = function(sails) {
    $('#log-entry-sail-main').prop('checked', sails.main);
    $('#log-entry-sail-reef').prop('checked', sails.reef);
    $('#log-entry-sail-jib').prop('checked', sails.jib);
    $('#log-entry-sail-genoa').prop('checked', sails.genoa);
    $('#log-entry-sail-code').prop('checked', sails.code);
    $('#log-entry-sail-gennaker').prop('checked', sails.gennaker);
    $('#log-entry-sail-spinnaker').prop('checked', sails.spinnaker);
    $('#log-entry-sail-other').val(sails.other);
};

tf.ui.logEntry._initWind = function(wind) {
    $('#log-entry-wind-dir').val(wind.dir);
    $('#log-entry-wind-speed').val(wind.speed);
};

tf.ui.logEntry.closeLogEntry = function() {
    $('#log-entry-timepicker').data('DateTimePicker').hide();
    $('#log-entry-datepicker').data('DateTimePicker').hide();
    document.getElementById('log-entry-page').close();
    if (tf.ui.logEntry.onclose != undefined) {
        tf.ui.logEntry.onclose();
        tf.ui.logEntry.onclose = undefined;
    }
};

tf.ui.logEntry.getInterrupt = function() {
    var type = $('#log-entry-form-interrupt input:checked').val();
    if (type == undefined) {
        return undefined;
    } else {
        var interrupt = {
            type: type
        };
        return interrupt;
    }
};

tf.ui.logEntry.getProtest = function() {
    var boatElement = document.getElementById('log-entry-protest-boat');
    var boat = undefined;
    for (var i = 0; i < boatElement.options.length; i++) {
        if (boatElement.options[i].selected
            && boatElement.options[i].value != -1) {
            boat = boatElement.options[i].value;
        }
    }
    if (boat == undefined) {
        return undefined;
    } else {
        var protest = {
            boat: boat
        };
        return protest;
    }
};

tf.ui.logEntry.getSails = function() {
    var main = $('#log-entry-sail-main').prop('checked');
    var reef = $('#log-entry-sail-reef').prop('checked');
    var jib = $('#log-entry-sail-jib').prop('checked');
    var genoa = $('#log-entry-sail-genoa').prop('checked');
    var code = $('#log-entry-sail-code').prop('checked');
    var gennaker = $('#log-entry-sail-gennaker').prop('checked');
    var spinnaker = $('#log-entry-sail-spinnaker').prop('checked');
    var other = $('#log-entry-sail-other').val();
    var sails = {
            main: main,
            reef: reef,
            jib: jib,
            genoa: genoa,
            code: code,
            gennaker: gennaker,
            spinnaker: spinnaker,
            other: other
    };
    return sails;
};

tf.ui.logEntry.getEndOfRace = function() {
    var endOfRace = $('#log-entry-end-of-race').prop('checked');
    if (endOfRace) {
        return true;
    } else {
        return undefined;
    }
};

tf.ui.logEntry.logEntrySave = function() {
    var logEntryPage = document.getElementById('log-entry-page');
    var type = logEntryPage.logEntryType;
    var isStart = false;
    if (type == 'start') {
        isStart = true;
        type = 'round';
    }
    var point = $('#log-entry-point').val();
    var finish = $('#log-entry-finish').prop('checked');
    var time = $('#log-entry-timepicker').data('DateTimePicker').date();
    var date = $('#log-entry-datepicker').data('DateTimePicker').date();
    var windDir = $('#log-entry-wind-dir').val();
    var windSpeed = $('#log-entry-wind-speed').val();
    var wind = {
        dir: windDir,
        speed: windSpeed
    };
    var boatsElement = document.getElementById('log-entry-boats');
    var lanterns = $('#log-entry-form-lanterns input:checked').val();
    var engine = $('#log-entry-form-engine input:checked').val();
    var comment = $('#log-entry-comment').val();
    var position = $('#log-entry-position').val();
    var boats = [];
    for (var i = 0; i < boatsElement.options.length; i++) {
        if (boatsElement.options[i].selected) {
            boats.push(boatsElement.options[i].value);
        }
    }
    var interrupt = tf.ui.logEntry.getInterrupt();
    var protest = tf.ui.logEntry.getProtest();
    var sails = tf.ui.logEntry.getSails();

    var endOfRace = tf.ui.logEntry.getEndOfRace();

    // combine the date with the time
    var t = time.toObject();
    var d = date.toObject();
    t.years = d.years;
    t.months = d.months;
    t.date = d.date;

    var logEntry = {
        type: type,
        time: moment(t),
    };

    if (comment != '') {
        logEntry.comment = comment;
    }

    switch (type) {
    case 'round':
        logEntry.point = point;
        logEntry.wind = wind;
        if (isStart) {
            logEntry.sails = sails;
        }
        logEntry.boats = boats;
        break;
    case 'endOfRace':
        logEntry.endOfRace = endOfRace;
        logEntry.position = position;
        break;
    case 'seeOtherBoats':
        logEntry.boats = boats;
        break;
    case 'protest':
        logEntry.position = position;
        logEntry.protest = protest;
        break;
    case 'interrupt':
        logEntry.position = position;
        logEntry.interrupt = interrupt;
        break;
    case 'changeSails':
        logEntry.wind = wind;
        logEntry.sails = sails;
        break;
    case 'engine':
        logEntry.engine = engine;
        break;
    case 'lanterns':
        logEntry.lanterns = lanterns;
        logEntry.position = position;
        break;
    case 'other':
        break;
    }

    // save the current logbook in the page
    logEntryPage.logBook.saveToLog(logEntry, logEntryPage.logEntryIndex);
};

tf.ui.logEntry.sailChanged = function(element) {
    var checked = element.checked;
    var radioLikeGroups =
        [['log-entry-sail-jib', 'log-entry-sail-genoa'],
         ['log-entry-sail-code', 'log-entry-sail-gennaker',
          'log-entry-sail-spinnaker']];

    var found = false;

    switch (element.id) {
    case 'log-entry-sail-main':
        if (!checked) {
            document.getElementById('log-entry-sail-reef').checked = false;
        }
        found = true;
        break;
    case 'log-entry-sail-reef':
        if (checked) {
            document.getElementById('log-entry-sail-main').checked = true;
        }
        found = true;
        break;
    }
    for (var u = 0; !found && u < radioLikeGroups.length; u++) {
        found = tf.ui.logEntry._updateRadioLikeGroup(element,
                                                     radioLikeGroups[u]);
    }
};

/*
 * A radioLikeGroup behaves like radio buttons, except that all items
 * in a group can be turned off.
 */
tf.ui.logEntry._updateRadioLikeGroup = function(element, g) {
    var found = false;
    for (var i = 0; !found && i < g.length; i++) {
        if (element.id == g[i]) {
            found = true;
            for (var j = 0; j < g.length; j++) {
                if (i != j) {
                    document.getElementById(g[j]).checked = false;
                }
            }
        }
    }
    return found;
};


tf.ui.logEntry._setPosition = function(id, pos) {
    var lat = pos.coords.latitude.toFixed(4);
    var lng = pos.coords.longitude.toFixed(4);
    if (pos.coords.longitude > 0) {
        if (pos.coords.longitude < 10) {
            lng = '00' + lng;
        } else if (pos.coords.longitude < 100) {
            lng = '0' + lng;
        }
    }
    // check that the position is still unset - we don't
    // want to overwrite the user's input
    if ($(id).val() == '') {
        var s = "N " + lat + "  O " + lng;
        $(id).val(s);
    }
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    var logEntryPage = document.getElementById('log-entry-page');

    $('#log-entry-cancel').on('click', function(event) {
        tf.ui.popPage();
        return false;
    });
    $('#log-entry-save').on('click', function(event) {
        tf.ui.logEntry.logEntrySave();
        tf.ui.popPage();
        return false;
    });

    $('#log-entry-interrupt').on('click', function(event) {
        tf.ui.logEntry.logEntryOpenInterrupt();
        return false;
    });

    $('#log-entry-protest').on('click', function(event) {
        tf.ui.logEntry.logEntryOpenProtest();
        return false;
    });

    $('.log-entry-sail').change(function(event) {
        tf.ui.logEntry.sailChanged(event.target);
    });
});
