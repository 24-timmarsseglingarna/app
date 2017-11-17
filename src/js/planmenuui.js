/* -*- js -*- */

goog.provide('tf.ui.planMenu');

goog.require('tf.ui');

tf.ui.planMenu.openPage = function() {

    // mark the active plan
    $('.tf-plan-item').removeClass('active');
    $('#tf-plan-plan').removeClass('disabled');
    var activeId;
    if (!tf.state.curPlan) {
        $('#tf-plan-plan').addClass('disabled');
        activeId = '#tf-plan-item-none';
    } else {
        activeId = '#tf-plan-item-' + tf.state.curPlan.name;
    }
    $(activeId).addClass('active');

    var page = $('#plan-menu-page')[0];
    page.showModal();
    tf.ui.pushPage(function() {
        page.close();
    });
    document.activeElement.blur();
};

//FIXME: HERE: om man har en plan aktiv, men loggar en sträcka utanför planen,
//deaktivera planen och kanske tom radera den.


/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    $('.tf-plan-item').on('click', function(event) {
        var name = $(event.target).data('name') // html5 data-name attribute
        if (name == 'none') {
            $('#tf-plan-plan').addClass('disabled');
            tf.state.set('curPlan', null);
        } else {
            $('#tf-plan-plan').removeClass('disabled');
            tf.state.curPlan = tf.state.curRace.getPlan(name);
            if (!tf.state.curPlan.logbook) {
                tf.state.curPlan.attachLogBook(tf.state.curLogBook);
                tf.state.curPlan.onPlanUpdate(tf.ui.logBookChanged);
            }
        }
        $('.tf-plan-item').removeClass('active');
        if (!tf.state.curPlan) {
            activeId = '#tf-plan-item-none';
            $('#tf-nav-plan-name').html("");
        } else {
            activeId = '#tf-plan-item-' + tf.state.curPlan.name;
            $('#tf-nav-plan-name').html(tf.state.curPlan.name);
        }
        $(activeId).addClass('active');

        tf.ui.planModeActivate();
        return false;
    });

    $('#tf-plan-normal').on('click', function(event) {
        tf.ui.planModeActivate(false);
        tf.ui.popPage();
        return false;
    });

    $('#tf-plan-plan').on('click', function(event) {
        if (!tf.state.curPlan) {
            return false;
        }
        tf.ui.planModeActivate(true);
        tf.ui.popPage();
        return false;
    });

});
