/* -*- js -*- */

/**
 * Handle the browser/phone back button.
 */

var pageStack = [];

/*
 * When we open a new page/modal, the code calls
 * pushPage(openfn, closefn).  The close function should close the window.
 * It MUST NOT call popPage().
 *
 * It order to go back to the previous page, the code must call
 * popPage(), e.g., when a 'cancel', 'save', or 'ok' button is clicked.
 * popPage() is set up to be the same as hitting the 'back' button.
 * In this case, the sentinel function is called to actually close the
 * open page.
 *
 * If mainPage is set to true, the new page will be the "main" page,
 * which means that if the user goes back in history after this page,
 * the previous real page in the history will be loaded by the
 * browser.
 */
export function pushPage(openfn, closefn, mainPage) {
    // close current page, if there is one
    if (pageStack.length > 0) {
        var cur = pageStack[pageStack.length - 1];
        cur.closefn();
    }
    pageStack.push({openfn: openfn,
                    closefn: closefn});
    if (mainPage) {
        history.replaceState(pageStack.length, document.title, location.href);
    } else {
        history.pushState(pageStack.length, document.title, location.href);
    }
    openfn();
};

/*
 * Note that this is an asynchronous function (on chrome), which means
 * that if you need to do more work after the page has closed (e.g.,
 * open a new page), it must be done in the continueFn.
 */
export function popPage(continueFn) {
    if (continueFn) {
        // ensure that we run both the original closefn, and the
        // continueFn when the history.back's popstate event actually
        // triggers.
        var prev = pageStack.pop();
        pageStack.push({openfn: prev.openfn,
                        closefn: function() {
                            prev.closefn();
                            continueFn();
                        }});
    }
    history.back();
};

// set pageStack length 0 as current state
history.replaceState(0, document.title, location.href);

window.addEventListener('popstate', function(event) {
    // event.state is the state of the state we're going to
    if (pageStack.length > 0) {
        if (event.state + 1 > pageStack.length) {
            // user is trying to move forward; ignore
        } else {
            var steps = pageStack.length - event.state;
            for (var i = 0; i < steps; i++) {
                var prev = pageStack.pop();
                prev.closefn();
            }
            // re-open last page
            if (pageStack.length > 0) {
                var cur = pageStack[pageStack.length - 1];
                cur.openfn();
            }
        }
    }
});
