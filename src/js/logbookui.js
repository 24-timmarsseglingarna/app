/* -*- js -*- */

import {alert} from './alertui.js';
import {confirm} from './confirmui.js';
import {curState, setupLogin} from './state.js';
import {pushPage, popPage} from './pageui.js';
import {fmtInterrupt, fmtProtest, fmtSails, fmtOther,
        openLogEntry} from './logentryui.js';
import {openPage as openAddLogEntryPage} from './addlogentryui.js';
import {openPage as openLoginPage} from './loginui.js';

export function openLogBook(options) {
    refreshLogBook(options);
    pushPage(
        function() { $('#log-book-page').modal({backdrop: 'static'}); },
        function() { $('#log-book-page').modal('hide'); },
        options.mainPage);
    document.activeElement.blur();
};

function refreshLogBook(options) {
    var logBook = options.logBook;
    var isReadOnly = logBook.isReadOnly();
    var boatName = logBook.teamData.boat_name;
    var startNo = logBook.teamData.start_number;
    var sxk = logBook.teamData.sxk_handicap;
    var log = logBook.getLog();
    var pod = logBook.race.getPod();
    var prev;
    var rows = '';

    if (logBook.standaloneUI) {
        $('#log-book-cancel').hide();
        $('#log-book-help').show();
    } else {
        $('#log-book-cancel').show();
        $('#log-book-help').hide();
    }
    if (logBook.hasConflict()) {
        $('#log-book-conflict').show();
    } else {
        $('#log-book-conflict').hide();
    }
    if (logBook.signed == 'signed') {
        $('#log-book-signed').show();
    } else {
        $('#log-book-signed').hide();
    }
    if (logBook.signed == 'signed-sync') {
        $('#log-book-signed-sync').show();
    } else {
        $('#log-book-signed-sync').hide();
    }
    $('#log-book-early-elem').hide();
    $('#log-book-late-elem').hide();
    $('#log-book-comp-elem').hide();
    $('#log-book-approved-elem').hide();

    // no header and no arrow in the popup
    var popover_template = '<div class=\'popover log-book-edit-popover\'' +
        ' role=\'tooltip\'>' +
        '<div class=\'popover-body\'></div></div>';

    for (var i = 0; i < log.length; i++) {
        var e = log[i];
        if (e.deleted) continue;
        var distance = '';
        var distTD = '<td>';
        var distPost = '';
        if (e.point && prev) {
            distance = pod.getDistance(prev.point, e.point);
            if (distance == -1) {
                distance = 0;
            }
            if (e._legStatus) {
                distTD = '<td class="log-book-invalid-dist text-danger">';
                distPost = '<span class="pl-1 icon-exclamation-circle"></span>';
                distance = 0;
            }
            prev = e;
        } else if (e.point) {
            prev = e;
        }
        var intTD = '<td>';
        var intPost = '';
        if (e._interruptStatus) {
            intTD = '<td class="log-book-invalid-interrupt text-danger">';
            intPost = '<span class="pl-1 icon-exclamation-circle"></span>';
        }
        var edit_button_html = '<div class=\'row log-book-edit-buttons\'' +
            ' data-logid=\'' + e.id + '\'>' +
            '<button class=\'btn btn-secondary\' id=\'log-book-btn-edit\'>' +
            'Ändra</button>' +
            '<button class=\'btn btn-secondary\' id=\'log-book-btn-add\'>' +
            'Infoga</button>' +
            '<button class=\'btn btn-warning\' id=\'log-book-btn-del\'>' +
            'Radera</button>' +
            '</div>';

        var point = e.point || '';
        var pointName = '';
        if (e.point) {
            var p = pod.getPoint(point);
            if (p) {
                pointName = p.name;
            }
        }

        var wind = '';
        if (e.wind) {
            wind = e.wind.dir + '&nbsp;' + e.wind.speed;
        }
        var boats = '';
        if (e.boats != undefined) {
            boats = e.boats.join(',');
            // FIXME: test with boat names
        }
        var comment = e.comment || '';

        var conflict = '';
        if (e.state == 'conflict') {
            conflict = '<span class="text-danger' +
                ' icon-exclamation-circle"></span>';
        }

        rows += '<tr data-logid="' + e.id + '">';
        if (isReadOnly) {
            rows += '<td></td>';
        } else {
            rows +=
                '<td><a tabindex="0" class="log-book-edit"' +
                ' role="button"' +
                ' data-toggle="popover"' +
                ' data-animation="false"' +
                ' data-trigger="click"' + // FIXME: with "focus", outside clicks
                                          // removes the popup, but the buttons
                                          // don't work :(
                ' data-container="#log-book-entries"' +
                ' data-placement="top"' +
                ' data-viewport="#log-book-entries"' +
                ' data-html="true"' +
                ' data-content="' + edit_button_html + '"' +
                ' data-template="' + popover_template + '"' +
                '><span class="icon-pencil">' + conflict + '</span></a></td>';
        }
        rows +=
            '<td>' + e.time.format(
                'HH:mm DD MMM').replace(/\s/g, '&nbsp;') + '</td>' +
            '<td><span class="badge badge-pill badge-secondary">' +
            point + '</span></td>' +
            '<td class="d-none d-sm-table-cell">' + pointName + '</td>' +
            distTD + distance + distPost + '</td>' +
            '<td>' + wind + '</td>' +
            intTD + fmtInterrupt(e.interrupt) +
            intPost + '</td>' +
            '<td>' + fmtProtest(e.protest) + '</td>' +
            '<td>' + fmtSails(e.sails) + '</td>' +
            '<td>' + boats + '</td>' +
            '<td>' + fmtOther(e) + '</td>' +
            '<td>' + comment + '</td>' +
            '</tr>';
    }
    if (!isReadOnly) {
        rows += '<tr>' +
            '<td><a tabindex="0" class="log-book-add-entry"' +
            ' role="button"' +
            ' onclick="tfUiLogBookAddEntryClick();"' +
            '><span class="icon-plus tf-x-large"></span></a></td>' +
            '</tr>';
    }
    var dist = logBook.getSailedDistance();
    var netdist = logBook.getNetDistance();
    var earlydist = logBook.getEarlyStartDistance();
    var earlytime = logBook.getEarlyStartTime();
    var latedist = logBook.getLateFinishDistance();
    var latetime = logBook.getLateFinishTime();
    var compdist = logBook.getCompensationDistance();
    var approveddist = logBook.getApprovedDistance();
    var plaquedist = logBook.getPlaqueDistance();
    var speed = logBook.getAverageSpeed();

    if (earlydist > 0) {
        $('#log-book-early-elem').show();
        $('#log-book-approved-elem').show();
    }
    if (latedist > 0) {
        $('#log-book-late-elem').show();
        $('#log-book-approved-elem').show();
    }
    if (compdist > 0) {
        $('#log-book-comp-elem').show();
        $('#log-book-approved-elem').show();
    }

    if (curState.loggedInPersonId.get() == logBook.teamData.skipper_id) {
        $('#log-book-sign').show();
    } else {
        $('#log-book-sign').hide();
    }
    $('#log-book-sign').removeClass('disabled');
    if (!(logBook.state == 'finished' ||
          logBook.state == 'finished-early' ||
          logBook.state == 'retired') ||
        logBook.hasConflict()) {
        $('#log-book-sign').addClass('disabled');
    }
    $('#log-book-delete-all').show();
    if (isReadOnly) {
        $('#log-book-delete-all').hide();
        $('#log-book-sign').hide();
    }
    $('#log-book-send').hide();
    if (logBook.signed == 'signed') {
        $('#log-book-send').show();
    }

    $('#log-book-plaque-reason').hide();
    if (logBook.state == 'finished-early') {
        $('#log-book-plaque-reason').show();
        $('#log-book-plaque-reason').html('(för kort segling)');
    } else if (logBook.state == 'retired') {
        $('#log-book-plaque-reason').show();
        $('#log-book-plaque-reason').html('(seglingen bruten)');
    }

    $('#log-book-boat').text(boatName);
    $('#log-book-startno').text(startNo);
    $('#log-book-sxk').text(sxk);
    // header
    $('#log-book-sailed-dist').text(dist.toFixed(1) + ' M');
    $('#log-book-net-dist').text(netdist.toFixed(1) + ' M');
    // footer
    $('#log-book-sailed-dist2').text(dist.toFixed(1) + ' M');
    $('#log-book-early-dist').text('-' + earlydist.toFixed(1) + ' M' +
                                  ' (' + earlytime + ' min)');
    $('#log-book-late-dist').text('-' + latedist.toFixed(1) + ' M' +
                                  ' (' + latetime + ' min)');
    $('#log-book-comp-dist').text(compdist.toFixed(1) + ' M');
    $('#log-book-approved-dist').text(approveddist.toFixed(1) + ' M');
    $('#log-book-plaque-dist').text(plaquedist.toFixed(1) + ' M');
    $('#log-book-speed').text(speed.toFixed(1) + ' kn');
    $('#log-book-entries').html(rows);
    $('.log-book-edit').popover();
    $('.log-book-invalid-dist').on('click', function(event) {
        logBookInvalidDistClick(event.currentTarget);
    });
    $('.log-book-invalid-interrupt').on('click', function(event) {
        logBookInvalidInterruptClick(event.currentTarget);
    });
    var logBookPage = $('#log-book-page')[0];
    // save the current logBook in the page
    logBookPage.logBook = logBook;
};

window.tfUiLogBookAddEntryClick = function() {
    var logBookPage = $('#log-book-page')[0];
    var e = logBookPage.logBook.getLastLogEntry();
    var time = null;
    if (e) {
        time = e.time;
    }

    openAddLogEntryPage({
        onclose: function() {
            refreshLogBook({logBook: logBookPage.logBook});
        },
        time: time
    });
};

function logBookInvalidDistClick(col) {
    var logBookPage = $('#log-book-page')[0];
    var text = '';
    var logBook = logBookPage.logBook;
    var e = logBook.getLogEntry(col.parentElement.dataset.logid);
    switch (e._legStatus) {
    case 'invalid-round':
        text = 'Punkt ' + e.point +
            ' har rundats mer än två gånger. ' +
            'Sträckan räknas därför inte (se 7.3, 13.1.3 i RR-2018)';
        break;
    case 'invalid-leg':
        text = 'Sträckan ' + e._invalidLeg +
            ' har seglats mer än två gånger. ' +
            'Sträckan räknas därför inte (se 7.5, 13.1.2 i RR-2018)';
        break;
    case 'no-leg':
        text = 'Mellan ' + e._invalidLeg + ' och ' + e.point +
            ' finns ingen giltig sträcka.';
        break;
    }
    alert('<p>' + text + '</p>');
};

function logBookInvalidInterruptClick(col) {
    var logBookPage = $('#log-book-page')[0];
    var logBook = logBookPage.logBook;
    var e = logBook.getLogEntry(col.parentElement.dataset.logid);
    var text = '';
    switch (e._interruptStatus) {
    case 'no-done':
        text = 'Du verkar ha glömt att logga att seglingen har ' +
            'återupptagits.';
        break;
    }
    alert('<p>' + text + '</p>');
};

function openLogEntryFromPage(options) {
    var logBookPage = $('#log-book-page')[0];
    options.logBook = logBookPage.logBook;
    options.onclose = function() {
        refreshLogBook({logBook: logBookPage.logBook});
    };
    openLogEntry(options);
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('[data-toggle="popover"]').popover();
    $('#log-book-cancel').on('click', function() {
        popPage();
        return false;
    });

    $('#log-book-delete-all').on('click', function() {
        confirm('<p>Är du säker att du vill radera hela loggboken?' +
                '</p>',
                'Nej',
                'Ja',
                function() {
                    var logBookPage = $('#log-book-page')[0];
                    var logBook = logBookPage.logBook;
                    logBook.deleteAllLogEntries();
                    refreshLogBook({
                        logBook: logBookPage.logBook});
                });
        return false;
    });
    $('#log-book-sign').on('click', function() {
        var logBookPage = $('#log-book-page')[0];
        var logBook = logBookPage.logBook;
        if (!(logBook.state == 'finished' ||
              logBook.state == 'finished-early' ||
              logBook.state == 'retired')) {
            alert('<p>För att kunna signera loggboken måste du ha' +
                  ' loggat målgång på den sista rundningen, eller loggat att' +
                  ' du har brutit seglingen.</p>');
        } else if (logBook.hasConflict()) {
            alert('<p>Loggboken har ändringar gjorda av någon annan.' +
                  ' Dessa måste lösas genom att klicka på pennan' +
                  ' vid den markerade raden och välja Ändra.</p>');
        } else {
            confirm('<p>Kontrollera noggrant att loggboken är korrekt' +
                    ' ifylld.</p>' +
                    '<p>När loggboken är signerad går det inte att' +
                    ' göra fler ändringar.</p>' +
                    '<p>Är du säker på att du vill signera' +
                    ' loggboken?</p>',
                    'Avbryt',
                    'Signera',
                    function() {
                        logBook.sign();
                        logBook.sendToServer(function() {
                            refreshLogBook({
                                logBook: logBookPage.logBook
                            });
                        });
                    });
        }
    });
    $('#log-book-send').on('click', function() {
        var logBookPage = $('#log-book-page')[0];
        var logBook = logBookPage.logBook;
        logBook.sendToServer(function() {
            refreshLogBook({
                logBook: logBook
            });
        });
    });
    $(document).on('click', '#log-book-btn-edit', function(event) {
        var id = $(event.currentTarget.parentElement).data('logid');
        $('.log-book-edit').popover('hide');
        openLogEntryFromPage({id: id});
    });
    $(document).on('click', '#log-book-btn-add', function(event) {
        var id = $(event.currentTarget.parentElement).data('logid');
        var logBookPage = $('#log-book-page')[0];
        var logBook = logBookPage.logBook;
        var cur = logBook.getLogEntry(id);
        var next = logBook.getNextLogEntry(id);
        var addSeconds;
        if (next) {
            addSeconds = next.time.diff(cur.time) / 2000;
        } else {
            addSeconds = 3600;
        }
        var new_ = moment(cur.time).add(addSeconds, 'seconds');
        $('.log-book-edit').popover('hide');
        openAddLogEntryPage({
            time: new_,
            onclose: function() {
                refreshLogBook({logBook: logBookPage.logBook});
            }
        });
    });
    $(document).on('click', '#log-book-btn-del', function(event) {
        // delete the log entry
        var id = $(event.currentTarget.parentElement).data('logid');
        var logBookPage = $('#log-book-page')[0];
        logBookPage.logBook.deleteLogEntry(id);
        // re-open the log book
        $('.log-book-edit').popover('hide');
        refreshLogBook({logBook: logBookPage.logBook});
    });
});

// initialize a complete UI for filling in the logbook
export function initLogbookUI() {
    curState.curLogBook.onChange(function(curLogBook) {
        // FIXME: on a fresh login, the logbook is created with an empty log
        // array.  we will display that empty log, and we're not updated
        // if the log array is modified.
        console.log('logbook changed; open it!');
        curLogBook.standaloneUI = true;
        openLogBook({
            mainPage: true,
            logBook: curLogBook
        });
    });
    // FIXME: init.setupLogin() does too much work; it assumes the app
    // specifically it reads all teams and races etc.  in this case we'd like
    // to read just enough data for the selected team - not for the person,
    // since we want admins to be able to add the logbook for participants.
    setupLogin(function() {}, openLoginPage);
    // FIXME: slightly tweak layout to fit this (non-app) purpose better
    // e.g., change '+' to button?  send to server with special button?

    /* BUGS:
       o localStorage.clear(), reload, login -> shows empty logbook;
         do a reload and the real logbook is shown.
     */

};
