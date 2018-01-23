/* -*- js -*- */

goog.provide('tf.ui.logBook');

goog.require('tf.ui');
goog.require('tf.ui.alert');
goog.require('tf.ui.logEntry');

tf.ui.logBook.openLogBook = function(options) {
    tf.ui.logBook.refreshLogBook(options);
    tf.ui.pushPage(
        function() { $('#log-book-page').modal({backdrop: 'static'}); },
        function() { $('#log-book-page').modal('hide'); });
    document.activeElement.blur();
}

tf.ui.logBook.refreshLogBook = function(options) {
    var logBook = options.logBook;
    var boatName = logBook.boatName;
    var startNo = logBook.startNo;
    var log = logBook.getLog();
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
        "<div class='popover-body'></div></div>";

    for (var i = 0; i < log.length; i++) {
        var e = log[i];
        if (e.deleted) continue;
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
        var intTD = '<td>';
        if (e._interruptStatus) {
            intTD = '<td class="log-book-invalid-interrupt text-danger">';
        }
        var edit_button_html = "<div class='row log-book-edit-buttons'" +
            " data-logid='" + e.id + "'>" +
            "<button class='btn btn-secondary' id='log-book-btn-edit'>" +
            'Ändra</button>' +
            "<button class='btn btn-secondary' id='log-book-btn-add'>" +
            'Infoga</button>' +
            "<button class='btn btn-warning' id='log-book-btn-del'>" +
            'Radera</button>' +
            '</div>';

        var point = e.point || '';
        var wind = '';
        if (e.wind) {
            wind = e.wind.dir + ' ' + e.wind.speed;
        }
        var boats = '';
        if (e.boats != undefined) {
            boats = e.boats.join(',');
        }
        var comment = e.comment || '';

        rows += '<tr data-logid="' + e.id + '">' +
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
            '<td>' + point + '</td>' +
            distTD + distance + '</td>' +
            '<td>' + wind + '</td>' +
            intTD + tf.ui.logEntry.fmtInterrupt(e.interrupt) + '</td>' +
            '<td>' + tf.ui.logEntry.fmtProtest(e.protest) + '</td>' +
            '<td>' + tf.ui.logEntry.fmtSails(e.sails) + '</td>' +
            '<td>' + boats + '</td>' +
            '<td>' + tf.ui.logEntry.fmtOther(e) + '</td>' +
            '<td>' + comment + '</td>' +
            '</tr>';
    }
    rows += '<tr>' +
        '<td><a tabindex="0" class="log-book-add-entry"' +
        ' role="button"' +
        ' onclick="tf.ui.logBook.addEntryClick();"' +
        '><span class="icon-plus"></span></a></td>' +
        '</tr>';

    var dist = logBook.getSailedDistance();
    var sxkdist = logBook.getSXKDistance();
    var speed = logBook.getAverageSpeed();

    $('#log-book-boat').text(boatName);
    $('#log-book-startno').text(startNo);
    $('#log-book-distance').text(dist.toFixed(1) + ' M');
    $('#log-book-sxk-distance').text(sxkdist.toFixed(1) + ' M');
    $('#log-book-speed').text(speed.toFixed(1) + ' kn');
    $('#log-book-entries').html(head + '<tbody>' + rows + '</tbody>');
    $('.log-book-edit').popover();
    $('.log-book-invalid-dist').on('click', function(event) {
        tf.ui.logBook.logBookInvalidDistClick(event.currentTarget);
    });
    $('.log-book-invalid-interrupt').on('click', function(event) {
        tf.ui.logBook.logBookInvalidInterruptClick(event.currentTarget);
    });
    var logBookPage = $('#log-book-page')[0];
    // save the current logBook in the page
    logBookPage.logBook = logBook;
};

tf.ui.logBook.addEntryClick = function(col) {
    var logBookPage = $('#log-book-page')[0];
    tf.ui.addLogEntry.openPage({
        onclose: function() {
            tf.ui.logBook.refreshLogBook({logBook: logBookPage.logBook});
        }
    });
};

tf.ui.logBook.deleteAllClick = function(col) {
    tf.ui.confirm('<p>Är du säker att du vill radera hela loggboken?.' +
                  '</p>',
                  'Nej',
                  'Ja',
                  function() {
                      var logBookPage = $('#log-book-page')[0];
                      var logBook = logBookPage.logBook;
                      logBook.deleteAllLogEntries();
                      tf.ui.logBook.refresgLogBook({
                          logBook: logBookPage.logBook
                      });
                  });
};

tf.ui.logBook.logBookInvalidDistClick = function(col) {
    var logBookPage = $('#log-book-page')[0];
    var text = '';
    var logBook = logBookPage.logBook;
    var e = logBook.getLogEntry(col.parentElement.dataset.logid);
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
        text = 'Mellan ' + e._invalidLeg + ' och ' + e.point +
            ' finns ingen giltig sträcka.';
        break;
    }
    tf.ui.alert('<p>' + text + '</p>');
};

tf.ui.logBook.logBookInvalidInterruptClick = function(col) {
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
    tf.ui.alert('<p>' + text + '</p>');
};

tf.ui.logBook.openLogEntry = function(options) {
    var logBookPage = $('#log-book-page')[0];
    options.logBook = logBookPage.logBook;
    options.onclose = function() {
        tf.ui.logBook.refreshLogBook({logBook: logBookPage.logBook});
    };
    tf.ui.logEntry.openLogEntry(options);
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('[data-toggle="popover"]').popover();
    $('#log-book-cancel').on('click', function() {
        tf.ui.popPage();
        return false;
    });
    $('#log-book-send').on('click', function() {
        var logBookPage = $('#log-book-page')[0];
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
                              var logBookPage = $('#log-book-page')[0];
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
                          var logBookPage = $('#log-book-page')[0];
                          var logBook = logBookPage.logBook;
                          logBook.deleteAllLogEntries();
                          tf.ui.logBook.refreshLogBook({
                              logBook: logBookPage.logBook});
                      });
        return false;
    });
    $(document).on('click', '#log-book-btn-edit', function(event) {
        var id = $(event.currentTarget.parentElement).data('logid');
        $('.log-book-edit').popover('hide');
        tf.ui.logBook.openLogEntry({id: id});
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
        tf.ui.addLogEntry.openPage({
            time: new_,
            onclose: function() {
                tf.ui.logBook.refreshLogBook({logBook: logBookPage.logBook});
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
        tf.ui.logBook.refreshLogBook({logBook: logBookPage.logBook});
    });
});

