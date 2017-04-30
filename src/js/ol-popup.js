/**
 * OpenLayers 3-4 Popup Overlay.
 * Based on the ol3-popup code by Matt Walker,
 * https://github.com/walkermatt/ol3-popup.
 * Adapted to OpenLayers 4 by Martin Björklund (just removed
 * unnecessary / broken options)
 * LICENSE: MIT (c) Matt Walker.
 *
 * See [the examples](./examples) for usage. Styling can be done via CSS.
 * @constructor
 * @extends {ol.Overlay}
 */
ol.Overlay.Popup = function(opt_options) {

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
    ol.Overlay.Popup.enableTouchScroll_(this.content);

    ol.Overlay.call(this, {
        element: this.container,
        stopEvent: true
    });

};

ol.inherits(ol.Overlay.Popup, ol.Overlay);

/**
 * Show the popup.
 * @param {ol.Coordinate} coord Where to anchor the popup.
 * @param {String} html String of HTML to display within the popup.
 */
ol.Overlay.Popup.prototype.show = function(coord, html) {
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
ol.Overlay.Popup.isTouchDevice_ = function() {
    try {
        document.createEvent("TouchEvent");
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
ol.Overlay.Popup.enableTouchScroll_ = function(elm) {
    if(ol.Overlay.Popup.isTouchDevice_()){
        var scrollStartPos = 0;
        elm.addEventListener("touchstart", function(event) {
            scrollStartPos = this.scrollTop + event.touches[0].pageY;
        }, false);
        elm.addEventListener("touchmove", function(event) {
            this.scrollTop = scrollStartPos - event.touches[0].pageY;
        }, false);
    }
};

/**
 * Hide the popup.
 */
ol.Overlay.Popup.prototype.hide = function() {
    this.container.style.display = 'none';
    return this;
};
