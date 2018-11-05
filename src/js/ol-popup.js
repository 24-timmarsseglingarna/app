import {Overlay} from 'ol';

/**
 * OpenLayers 3-4-5 Popup Overlay.
 * Based on the ol3-popup code by Matt Walker,
 * https://github.com/walkermatt/ol3-popup.
 * Adapted to OpenLayers 4 by Martin Björklund (just removed
 * unnecessary / broken options)
 * Adapted to OpenLayers 5 by Martin Björklund (uses modules)
 * LICENSE: MIT (c) Matt Walker.
 *
 * See [the examples](./examples) for usage. Styling can be done via CSS.
 * @constructor
 * @extends {ol.Overlay}
 */
export var Popup = (function (Overlay) {
    function Popup() {
        this.container = document.createElement('div');
        this.container.className = 'ol-popup';

        this.closer = document.createElement('a');
        this.closer.className = 'ol-popup-closer';
        this.closer.href = '#';
        this.container.appendChild(this.closer);

        var that = this;
        this.closer.addEventListener('click', function(evt) {
            that.container.style.display = 'none';
            that.closer.blur();
            evt.preventDefault();
        }, false);

        this.content = document.createElement('div');
        this.content.className = 'ol-popup-content';
        this.container.appendChild(this.content);
        
        // Apply workaround to enable scrolling of content div on touch devices
        enableTouchScroll(this.content);

        Overlay.call(this, {
            element: this.container,
            stopEvent: true
        });
    }
    if (Overlay) Popup.__proto__ = Overlay;
    Popup.prototype = Object.create( Overlay && Overlay.prototype );
    Popup.prototype.constructor = Popup;

    return Popup;
}(Overlay));

/**
 * Show the popup.
 * @param {ol.Coordinate} coord Where to anchor the popup.
 * @param {String} html String of HTML to display within the popup.
 */
Popup.prototype.show = function(coord, html) {
    this.setPosition(coord);
    this.content.innerHTML = html;
    this.container.style.display = 'block';
    this.content.scrollTop = 0;
    return this;
};

/**
 * @private
 * @desc Determine if the current browser supports touch events. Adapted from
 * https://gist.github.com/chrismbarr/4107472
 */
function isTouchDevice() {
    try {
        document.createEvent('TouchEvent');
        return true;
    } catch(e) {
        return false;
    }
};

/**
 * @private
 * @desc Apply workaround to enable scrolling of overflowing content within an
 * element. Adapted from https://gist.github.com/chrismbarr/4107472
 */
function enableTouchScroll(elm) {
    if (isTouchDevice()) {
        var scrollStartPos = 0;
        elm.addEventListener('touchstart', function(event) {
            scrollStartPos = this.scrollTop + event.touches[0].pageY;
        }, false);
        elm.addEventListener('touchmove', function(event) {
            this.scrollTop = scrollStartPos - event.touches[0].pageY;
        }, false);
    }
};

/**
 * Hide the popup.
 */
Popup.prototype.hide = function() {
    this.container.style.display = 'none';
    return this;
};
