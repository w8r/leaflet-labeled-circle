var L = require('leaflet');

module.exports = L.CircleMarker.extend({

  options: {
    textStyle: {
      color: '#fff',
      fontSize: 12
    },
    shiftY: 6,
  },


  /**
   * @class LabeledCircle
   * @constructor
   * @extends {L.CircleMarker}
   * @param  {String}   text
   * @param  {L.LatLng} latlng
   * @param  {Object=}  options
   */
  initialize: function(text, latlng, options) {
    this._text = text;
    L.CircleMarker.prototype.initialize.call(this, latlng, options);
  },


  /**
   * @param {String} text
   * @return {LabeledCircle}
   */
  setText: function(text) {
    this._text = text;
    if (this._textNode) {
      this._textElement.removeChild(this._textNode);
    }
    this._textNode = document.createTextNode(this._text);
    this._textElement.appendChild(this._textNode);

    return this;
  },


  /**
   * Create text node in container
   */
  _initPath: function() {
    L.CircleMarker.prototype._initPath.call(this);
    this._textElement = this._createElement('text');
    this.setText(this._text);
    this._container.appendChild(this._textElement);
  },


  /**
   * Position the text in container
   */
  _updatePath: function() {
    L.CircleMarker.prototype._updatePath.call(this);

    this._updateTextPosition();
  },


  /**
   * @param  {L.Map} map
   * @return {LabeledCircle}
   */
  onAdd: function(map) {
    L.CircleMarker.prototype.onAdd.call(this, map);
    this._updateTextPosition();
    return this;
  },


  /**
   * Calculate position for text
   */
  _updateTextPosition: function() {
    var textElement = this._textElement;
    var bbox = textElement.getBBox();
    var textPosition = this._point.subtract(
      L.point(bbox.width, -bbox.height + this.options.shiftY).divideBy(2));

    textElement.setAttribute('x', textPosition.x);
    textElement.setAttribute('y', textPosition.y);
  },


  /**
   * Set text style
   */
  _updateStyle: function() {
    L.CircleMarker.prototype._updateStyle.call(this);

    var styles = this.options.textStyle;
    for (var prop in styles) {
      if (styles.hasOwnProperty(prop)) {
        var styleProp = prop;
        if (prop === 'color') {
          styleProp = 'stroke';
        }
        this._textElement.style[styleProp] = styles[prop];
      }
    }
  }
});
