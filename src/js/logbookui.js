/* -*- js -*- */

goog.provide('tf.ui.logBook');

goog.require('tf.ui');
goog.require('tf.ui.alert');
goog.require('tf.ui.logEntry');

tf.ui.logBook.openLogBook = function(options) {
    var logBook = options.logBook;
    var boatName = logBook.boatName;
    var startNo = logBook.startNo;
    var log = logBook.log;
    var pod = logBook.race.getPod();
    var distance;
    var prev;
    var distTD;
    var head = '<thead><tr>' +
        '<th></th>' +
        '<th>Tid</th>' +
        '<th>Punkt</th>' +
        '<th>Distans</th>' +
        '<th>Vind</th>' +
        '<th>Avbrott</th>' +
        '<th>Protest</th>' +
        '<th>Segel</th>' +
        '<th>Siktade båtar</th>' +
        '<th>Övrigt</th>' +
        '<th>Kommentar</th>' +
        '</tr></thead>';
    var rows = '';

    // no header and no arrow in the popup
    var popover_template = "<div class='popover log-book-edit-popover'" +
        " role='tooltip'>" +
        "<div class='popover-content'></div></div>";

    for (var i = 0; i < log.length; i++) {
        var e = log[i];
        distance = '';
        distTD = '<td>';
        if (e.point && prev) {
            distance = pod.getDistance(prev.point, e.point);
            if (distance == -1) {
                distance = 0;
            }
            if (e._legStatus) {
                distTD = '<td class="log-book-invalid-dist text-danger">';
            }
            prev = e;
        } else if (e.point) {
            prev = e;
        }
        intTD = '<td>';
        if (e._interruptStatus) {
            intTD = '<td class="log-book-invalid-interrupt text-danger">';
        }
        var edit_button_html = "<div class='row log-book-edit-buttons'" +
            " data-index='" + i + "'>" +
            "<button class='btn btn-default' id='log-book-btn-edit'>" +
            'Ändra</button>' +
            "<button class='btn btn-default' id='log-book-btn-add'>" +
            'Infoga</button>' +
            "<button class='btn btn-warning' id='log-book-btn-del'>" +
            'Radera</button>' +
            '</div>';

        rows += '<tr>' +
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
            '><span class="icon-pencil"></span></a></td>' +
            '<td>' + e.time.format('HH:mm DD MMM')
                       .replace(/\s/g, '&nbsp;') + '</td>' +
            '<td>' + e.point + '</td>' +
            distTD + distance + '</td>' +
            '<td>' + e.wind.dir + ' ' + e.wind.speed + '</td>' +
            intTD + tf.ui.logEntry.fmtInterrupt(e.interrupt, true) + '</td>' +
            '<td>' + tf.ui.logEntry.fmtProtest(e.protest, true) + '</td>' +
            '<td>' + tf.ui.logEntry.fmtSails(e.sails, true) + '</td>' +
            '<td>' + e.boats.join(',') + '</td>' +
            '<td>' + tf.ui.logEntry.fmtOther(e, true) + '</td>' +
            '<td>' + e.comment + '</td>' +
            '</tr>';
    }
    if (log.length > 0) {
        rows += '<tr>' +
            '<td><a tabindex="0" class="log-book-add-entry"' +
            ' role="button"' +
            ' onclick="tf.ui.logBook.addEntryClick();"' +
            '><span class="icon-plus"></span></a></td>' +
            '</tr>';
    }
    var dist = logBook.getSailedDistance();
    var speed = logBook.getAverageSpeed();

    $('#log-book-boat').text(boatName);
    $('#log-book-startno').text(startNo);
    $('#log-book-distance').text(dist.toFixed(1) + ' M');
    $('#log-book-speed').text(speed.toFixed(1) + ' kn');
    $('#log-book-entries').html(head + '<tbody>' + rows + '</tbody>');
    $('.log-book-edit').popover();
    $('.log-book-invalid-dist').on('click', function(event) {
        tf.ui.logBook.logBookInvalidDistClick(event.currentTarget);
    });
    $('.log-book-invalid-interrupt').on('click', function(event) {
        tf.ui.logBook.logBookInvalidInterruptClick(event.currentTarget);
    });
    var logBookPage = document.getElementById('log-book-page');
    // save the current logBook in the page
    logBookPage.logBook = logBook;
    if (!logBookPage.open) {
        logBookPage.showModal();
        tf.ui.pushPage(function() {
            tf.ui.logBook.closeLogBook();
        });
    }
    document.activeElement.blur();
};

tf.ui.logBook.addEntryClick = function(col) {
    tf.ui.logBook.openLogEntry({});
}

tf.ui.logBook.deleteAllClick = function(col) {
    tf.ui.confirm('<p>Är du säker att du vill radera hela loggboken?.' +
                  '</p>',
                  'Nej',
                  'Ja',
                  function() {
                      var logBookPage =
                          document.getElementById('log-book-page');
                      var logBook = logBookPage.logBook;
                      logBook.deleteAllLogEntries();
                      tf.ui.logBook.openLogBook({logBook: logBookPage.logBook});
                  });
};

tf.ui.logBook.logBookInvalidDistClick = function(col) {
    var logBookPage = document.getElementById('log-book-page');
    var text = '';
    logBook = logBookPage.logBook;
    e = logBook.log[col.parentElement.rowIndex - 1];
    switch (e._legStatus) {
    case 'invalid-round':
        text = 'Punkt ' + e.point +
            ' har rundats mer än två gånger. ' +
            'Sträckan räknas därför inte (se 7.3, 13.1.3 i RR-2006)';
        break;
    case 'invalid-leg':
        text = 'Sträckan ' + e._invalidLeg +
            ' har seglats mer än två gånger. ' +
            'Sträckan räknas därför inte (se 7.5, 13.1.2 i RR-2006)';
        break;
    case 'no-leg':
        text = 'Mellan ' + e.point + ' och ' + e._invalidLeg +
            ' finns ingen giltig sträcka.';
        break;
    }
    tf.ui.alert('<p>' + text + '</p>');
};

tf.ui.logBook.logBookInvalidInterruptClick = function(col) {
    var logBookPage = document.getElementById('log-book-page');
    logBook = logBookPage.logBook;
    e = logBook.log[col.parentElement.rowIndex - 1];
    var text = '';
    switch (e._interruptStatus) {
    case 'no-done':
        text = 'Du verkar ha glömt att logga att seglingen har ' +
            'återupptagits.';
        break;
    }
    tf.ui.alert('<p>' + text + '</p>');
};

tf.ui.logBook.openLogEntry = function(options) {
    var logBookPage = document.getElementById('log-book-page');
    options.logBook = logBookPage.logBook;
    options.onclose = function() {
        // refresh the log book
        tf.ui.logBook.openLogBook({logBook: logBookPage.logBook});
    };
    tf.ui.logEntry.openLogEntry(options);
};

tf.ui.logBook.closeLogBook = function() {
    document.getElementById('log-book-page').close();
};


/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('#log-book-cancel').on('click', function() {
        tf.ui.popPage();
        return false;
    });
    $('#log-book-send').on('click', function() {
        var logBookPage = document.getElementById('log-book-page');
        var logBook = logBookPage.logBook;
        if (logBook.isSentToServer) {
            tf.ui.alert('<p>Loggboken har redan skickats in.</p');
        } else if (!logBook.hasFinished()) {
            tf.ui.alert('<p>Loggboken kan inte skickas in förrän du ' +
                        'loggat en punkt som "Målgång".</p>');
        } else {
            tf.ui.confirm('<p>Du kan inte göra fler ändringar av loggboken ' +
                          'när du har skickat in den.</p>' +
                          '<p>Är du säker att du vill skicka in loggboken?.' +
                          '</p>',
                          'Nej',
                          'Ja',
                          function() {
                              var logBookPage =
                                  document.getElementById('log-book-page');
                              var logBook = logBookPage.logBook;
                              tf.ui.alert('<p>Denna funktion är inte ' +
                                          'implementerad ännu!</p>' +
                                          '<p>Loggboken ' +
                                          'måste rapporteras in på det gamla ' +
                                          'sättet.</p>');
                              /*
                              // start spinner
                              logBook.sendToServer(function(res) {
                                  if (res) {
                                      // stop spinner
                                  } else {
                                      // stop spinner, alert a warning
                                  }
                              });
                              */
                          });
        }
        return false;
    });
    $('#log-book-delete-all').on('click', function() {
        tf.ui.confirm('<p>Är du säker att du vill radera hela loggboken?.' +
                      '</p>',
                      'Nej',
                      'Ja',
                      function() {
                          var logBookPage =
                              document.getElementById('log-book-page');
                          var logBook = logBookPage.logBook;
                          logBook.deleteAllLogEntries();
                          tf.ui.logBook.openLogBook({
                              logBook: logBookPage.logBook});
                      });
        return false;
    });
    $(document).on('click', '#log-book-btn-edit', function(event) {
        var idx = $(event.currentTarget.parentElement).attr('data-index');
        $('.log-book-edit').popover('hide');
        tf.ui.logBook.openLogEntry({index: idx});
    });
    $(document).on('click', '#log-book-btn-add', function(event) {
        var idx = Number($(event.currentTarget.parentElement)
                         .attr('data-index'));
        var logBookPage = document.getElementById('log-book-page');
        var logBook = logBookPage.logBook;
        var cur = logBook.log[idx];
        var addSeconds;
        if (idx + 1 < logBook.log.length) {
            var next = logBook.log[idx + 1];
            addSeconds = next.time.diff(cur.time) / 2000;
        } else {
            addSeconds = 3600;
        }
        var new_ = moment(cur.time).add(addSeconds, 'seconds');
        $('.log-book-edit').popover('hide');
        tf.ui.logBook.openLogEntry({time: new_});
    });
    $(document).on('click', '#log-book-btn-del', function(event) {
        // delete the log entry
        var idx = $(event.currentTarget.parentElement).attr('data-index');
        var logBookPage = document.getElementById('log-book-page');
        logBookPage.logBook.deleteLogEntry(idx);
        // re-open the log book
        $('.log-book-edit').popover('hide');
        tf.ui.logBook.openLogBook({logBook: logBookPage.logBook});
    });
});

