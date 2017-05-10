/* -*- js -*- */

goog.provide('tf.ui.logEntry');

goog.require('tf.serverData');
goog.require('tf.ui');

tf.ui.logEntry.onclose = undefined;

// FIXME: should not know anything about logbook. pass an entry
// instead, and a save function to be invoked.


tf.ui.logEntry.fmtInterrupt = function(interrupt, compact=false) {
    var s;
    if (compact) {
        return tf.ui.logEntry._fmtInterruptCompact(interrupt);
    }
    switch (interrupt.type) {
    case 'none':
        s = 'Inget avbrott';
        break;
    case 'bridge':
        s = 'Motorgång i väntan på broöppning';
        break;
    case 'anchor':
        s = 'Ankring för att undvika fara';
        break;
    case 'engine':
        s = 'Motorgång för att undvika fara';
        break;
    case 'visibility':
        s = 'Dålig sikt';
        break;
    case 'repair':
        s = 'Reparation akut skada';
        break;
    case 'rescue-time':
        s = 'Undsättning nödställd - tidstillägg';
        break;
    case 'rescue-dist':
        s = 'Undsättning nödställd - distanstillägg';
        break;
    }
    if (interrupt.comment != undefined && interrupt.comment != '') {
        s += '<br/>' + interrupt.comment;
    }
    return s;
};

tf.ui.logEntry._fmtInterruptCompact = function(interrupt) {
    var s;
    switch (interrupt.type) {
    case 'none':
        s = '-';
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

tf.ui.logEntry.fmtProtest = function(protest, compact=false) {
    if (protest.boat == -1 && compact) {
        return '-';
    } else if (protest.boat == -1) {
        return 'Ingen protest';
    } else {
        return 'Mot ' + protest.boat;
    }
};

tf.ui.logEntry.fmtSails = function(sails, compact=false) {
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
        s.push('code0');
    } else if (sails.gennaker) {
        s.push('gennaker');
    } else if (sails.spinnaker) {
        s.push('spinnaker');
    }
    if (sails.other != undefined && sails.other != '') {
        s.push(sails.other);
    }
    if (s.length == 0 && compact) {
        return '-';
    } else if (s.length == 0) {
        return 'Inga segel';
    } else {
        return s.join(',');
    }
};

tf.ui.logEntry.fmtOther = function(e, compact=false) {
    var s = [];
    if (e.lanterns) {
        s.push('lanternor');
    }
    if (e.engine) {
        s.push('motor');
    }
    if (e.endofrace != undefined) {
        s.push('segling slut');
    }
    return s.join(',');
};

/**
 * options:
 *  logBook - mandatory
 *  index
 *  point
 *  onclose
 *  time :: Moment
*/
tf.ui.logEntry.openLogEntry = function(options) {
    boatsElement = document.getElementById('log-entry-boats');
    // populate 'boats' with list of boats from current regatta
    var teams = tf.serverData.getTeamsData(options.logBook.race.getRegattaId());
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
    boatsElement.innerHTML = boatsOptions;
    boatElement = document.getElementById('log-entry-protest-boat');
    boatElement.innerHTML =
        '<option value="-1">-- ingen båt vald --</option>' +
        boatsOptions;
    if (options.index != undefined) {
        /* open an existing log entry */
        var entry = options.logBook.log[options.index];

        var dt = moment(entry.time);
        $('#log-entry-timepicker').data('DateTimePicker').date(dt);
        $('#log-entry-datepicker').data('DateTimePicker').date(dt);

        $('#log-entry-point').val(entry.point);
        $('#log-entry-finish').prop('checked', entry.finish);

        $('#log-entry-wind-dir').val(entry.wind.dir);
        $('#log-entry-wind-speed').val(entry.wind.speed);

        switch (entry.interrupt.type) {
        case 'none':
            $('#log-entry-interrupt-none').prop('checked', true);
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
            $('#log-entry-interrupt-rescue-dist').prop('checked', true);
            break;
        }
        $('#log-entry-interrupt-comment').val(entry.interrupt.comment);
        $('#log-entry-interrupt-position').val(entry.interrupt.position);

        boatElement.options[0].selected = true;
        for (var i = 1; i < boatElement.options.length; i++) {
            if (boatElement.options[i].value == entry.protest.boat) {
                boatElement.options[i].selected = true;
            }
        }
        $('#log-entry-protest-position').val(entry.protest.position);
        $('#log-entry-protest-comment').val(entry.protest.comment);

        $('#log-entry-sail-main').prop('checked', entry.sails.main);
        $('#log-entry-sail-reef').prop('checked', entry.sails.reef);
        $('#log-entry-sail-jib').prop('checked', entry.sails.jib);
        $('#log-entry-sail-genoa').prop('checked', entry.sails.genoa);
        $('#log-entry-sail-code').prop('checked', entry.sails.code);
        $('#log-entry-sail-gennaker').prop('checked', entry.sails.gennaker);
        $('#log-entry-sail-spinnaker').prop('checked', entry.sails.spinnaker);
        $('#log-entry-sail-other').val(entry.sails.other);

        for (var i = 0; i < boatsElement.options.length; i++) {
            if ($.inArray(boatsElement.options[i].value, entry.boats) != -1) {
                boatsElement.options[i].selected = true;
            }
        }
        $('#log-entry-lanterns').prop('checked', entry.lanterns);
        $('#log-entry-engine').prop('checked', entry.engine);

        if (entry.endOfRace != undefined) {
            $('#log-entry-end-of-race').prop('checked', true);
            $('#log-entry-end-of-race-position')
                .val(entry.endOfRace.position);
            $('#log-entry-end-of-race-pos').collapse('show');
        } else {
            $('#log-entry-end-of-race-position').val('');
            $('#log-entry-end-of-race').prop('checked', false);
            $('#log-entry-end-of-race-pos').collapse('hide');
        }

        $('#log-entry-comment').val(entry.comment);
    } else {
        var point = options.point || '';
        document.getElementById('log-entry-point').value = point;
        var time;
        if (options.time) {
            time = options.time;
        } else {
            time = moment();
        }
        $('#log-entry-timepicker').data('DateTimePicker').date(time);
        $('#log-entry-datepicker').data('DateTimePicker').date(time);
        // reset some fields to empty, but do *not* reset
        // sails and wind (high probability of being same as last time)
        $('#log-entry-finish').prop('checked', false);
        $('#log-entry-comment').val('');
        $('#log-entry-interrupt-none').prop('checked', true);
        $('#log-entry-interrupt-comment').val('');
        $('#log-entry-interrupt-position').val('');
        boatElement.options[0].selected = true;
        $('#log-entry-protest-position').val('');
        $('#log-entry-protest-comment').val('');
        $('#log-entry-end-of-race').prop('checked', false);
        $('#log-entry-end-of-race-position').val('');
        $('#log-entry-end-of-race-pos').collapse('hide');
    }
    var interrupt = tf.ui.logEntry.getInterrupt();
    $('#log-entry-interrupt').html(tf.ui.logEntry.fmtInterrupt(interrupt));
    var protest = tf.ui.logEntry.getProtest();
    $('#log-entry-protest').html(tf.ui.logEntry.fmtProtest(protest));
    var sails = tf.ui.logEntry.getSails();
    $('#log-entry-sails').html(tf.ui.logEntry.fmtSails(sails));

    var logEntryPage = document.getElementById('log-entry-page');

    tf.ui.logEntry.onclose = options.onclose;

    logEntryPage.logBook = options.logBook;
    logEntryPage.logEntryIndex = options.index;
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

tf.ui.logEntry.logEntryOpenInterrupt = function() {
    /* NOTE: the HTML and this code assumes lat N and long E */
    var logEntryPage = document.getElementById('log-entry-page');
    if ($('#log-entry-interrupt-position').val() == '' &&
        navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                    tf.ui.logEntry._setPosition(
                        '#log-entry-interrupt-position', pos);
            },
            function(error) {
                //alert('geo-error: ' + error.code);
            });
    }
    logEntryPage.logEntryOpenId = 'log-entry-item-interrupt';
    tf.ui.logEntry.logEntryOpenItem();
};

tf.ui.logEntry.logEntryOpenProtest = function() {
    /* NOTE: the HTML and this code assumes lat N and long E */
    var logEntryPage = document.getElementById('log-entry-page');
    if ($('#log-entry-protest-position').val() == '' &&
        navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                    tf.ui.logEntry._setPosition(
                        '#log-entry-protest-position', pos);
            },
            function(error) {
                //alert('geo-error: ' + error.code);
            });
    }
    logEntryPage.logEntryOpenId = 'log-entry-item-protest';
    tf.ui.logEntry.logEntryOpenItem();
};

tf.ui.logEntry.logEntryOpenItem = function() {
    var logEntryPage = document.getElementById('log-entry-page');
    var modalPage = document.getElementById(logEntryPage.logEntryOpenId);
    tf.ui.pushPage(function() {
        tf.ui.logEntry.closeLogEntryItem();
    });
    modalPage.showModal();
    document.activeElement.blur();
};

tf.ui.logEntry.logEntryItemSave = function() {
    // update interrupt, protest, and sails
    var interrupt = tf.ui.logEntry.getInterrupt();
    $('#log-entry-interrupt').html(tf.ui.logEntry.fmtInterrupt(interrupt));
    var protest = tf.ui.logEntry.getProtest();
    $('#log-entry-protest').html(tf.ui.logEntry.fmtProtest(protest));
    var sails = tf.ui.logEntry.getSails();
    $('#log-entry-sails').html(tf.ui.logEntry.fmtSails(sails));
};

tf.ui.logEntry.closeLogEntryItem = function() {
    var logEntryPage = document.getElementById('log-entry-page');
    var modalPage = document.getElementById(logEntryPage.logEntryOpenId);
    modalPage.close();
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
    var type = $('#log-entry-interrupt-form input:checked').val();
    var comment = $('#log-entry-interrupt-comment').val();
    var position = $('#log-entry-interrupt-position').val();
    var interrupt = {
        type: type,
        comment: comment,
        position: position
    };
    return interrupt;
};

tf.ui.logEntry.getProtest = function() {
    var boatElement = document.getElementById('log-entry-protest-boat');
    var boat = undefined;
    for (var i = 0; i < boatElement.options.length; i++) {
        if (boatElement.options[i].selected) {
            boat = boatElement.options[i].value;
        }
    }
    var position = $('#log-entry-protest-position').val();
    var comment = $('#log-entry-protest-comment').val();
    var protest = {
        boat: boat,
        position: position,
        comment: comment
    };
    return protest;
};

tf.ui.logEntry.getSails = function() {
    var main = document.getElementById('log-entry-sail-main').checked;
    var reef = document.getElementById('log-entry-sail-reef').checked;
    var jib = document.getElementById('log-entry-sail-jib').checked;
    var genoa = document.getElementById('log-entry-sail-genoa').checked;
    var code = document.getElementById('log-entry-sail-code').checked;
    var gennaker = document.getElementById('log-entry-sail-gennaker').checked;
    var spinnaker = document.getElementById('log-entry-sail-spinnaker').checked;
    var other = document.getElementById('log-entry-sail-other').value;
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
        var position = $('#log-entry-end-of-race-position').val();
        return {
            position: position
        };
    } else {
        return undefined;
    }
};

tf.ui.logEntry.logEntrySave = function() {
    var point = document.getElementById('log-entry-point').value;
    var finish = document.getElementById('log-entry-finish').checked;
    var time = $('#log-entry-timepicker').data('DateTimePicker').date();
    var date = $('#log-entry-datepicker').data('DateTimePicker').date();
    var windDir = document.getElementById('log-entry-wind-dir').value;
    var windSpeed = document.getElementById('log-entry-wind-speed').value;
    var boatsElement = document.getElementById('log-entry-boats');
    var lanterns = document.getElementById('log-entry-lanterns').checked;
    var engine = document.getElementById('log-entry-engine').checked;
    var comment = document.getElementById('log-entry-comment').value;
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
        point: point,
        finish: finish,
        time: moment(t),
        wind: {
            dir: windDir,
            speed: windSpeed
        },
        interrupt: interrupt,
        protest: protest,
        sails: sails,
        boats: boats,
        lanterns: lanterns,
        engine: engine,
        endOfRace: endOfRace,
        comment: comment
    };
    // save the current logbook in the page
    var logEntryPage = document.getElementById('log-entry-page');
    logEntryPage.logBook.saveToLog(logEntry, logEntryPage.logEntryIndex);
};

tf.ui.logEntry.sailChanged = function(element) {
    var checked = element.checked;
    // radioLikeGroups behave like radio buttons, except that all
    // items in a group can be turned off.
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
        g = radioLikeGroups[u];
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
    }
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

    $('#log-entry-sails').on('click', function(event) {
        logEntryPage.logEntryOpenId = 'log-entry-item-sails';
        tf.ui.logEntry.logEntryOpenItem();
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

    $('.log-entry-item-done').on('click', function(event) {
        tf.ui.logEntry.logEntryItemSave();
        tf.ui.popPage();
        return false;
    });
    $('.log-entry-sail').change(function(event) {
        tf.ui.logEntry.sailChanged(event.target);
    });
    $('#log-entry-end-of-race-pos').on('show.bs.collapse', function() {
        if ($('#log-entry-end-of-race-position').val() == '' &&
            navigator && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    tf.ui.logEntry._setPosition(
                        '#log-entry-end-of-race-position', pos);
                },
                function(error) {
                    //alert('geo-error: ' + error.code);
                });

        }
    });
});
