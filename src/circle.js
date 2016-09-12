var L = require('leaflet');

var Circle = module.exports = L.CircleMarker.extend({

  options: {
    textStyle: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 300
    },
    shiftY: 7,
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
    /**
     * @type {String}
     */
    this._text        = text;

    /**
     * @type {SVGTextElement}
     */
    this._textElement = null;

    /**
     * @type {TextNode}
     */
    this._textNode    = null;

    /**
     * @type {Object|Null}
     */
    this._textLayer   = null;

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
   * @return {String}
   */
  getText: function () {
    return this._text;
  },


  /**
   * Also bring text to front
   * @override
   */
  bringToFront: function() {
    L.CircleMarker.prototype.bringToFront.call(this);
    this._groupTextToPath();
  },


  /**
   * @override
   */
  bringToBack: function() {
    L.CircleMarker.prototype.bringToBack.call(this);
    this._groupTextToPath();
  },


  /**
   * Put text in the right position in the dom
   */
  _groupTextToPath: function() {
    var path        = this._path;
    var textElement = this._textElement;
    var next        = path.nextSibling;
    var parent      = path.parentNode;


    if (textElement && parent) {
      if (next && next !== textElement) {
        parent.insertBefore(textElement, next);
      } else {
        parent.appendChild(textElement);
      }
    }
  },


  /**
   * Position the text in container
   */
  _updatePath: function() {
    L.CircleMarker.prototype._updatePath.call(this);
    this._updateTextPosition();
  },


  /**
   * @override
   */
  _transform: function(matrix) {
    L.CircleMarker.prototype._transform.call(this, matrix);

    // wrap textElement with a fake layer for renderer
    // to be able to transform it
    this._textLayer = this._textLayer || { _path: this._textElement };
    if (matrix) {
      this._renderer.transformPath(this._textLayer, matrix);
    } else {
      this._renderer._resetTransformPath(this._textLayer);
      this._updateTextPosition();
      this._textLayer = null;
    }
  },


  /**
   * @param  {L.Map} map
   * @return {LabeledCircle}
   */
  onAdd: function(map) {
    L.CircleMarker.prototype.onAdd.call(this, map);
    this._initText();
    this._updateTextPosition();
    this.setStyle();
    return this;
  },


  /**
   * Create and insert text
   */
  _initText: function() {
    this._textElement = L.SVG.create('text');
    this.setText(this._text);
    this._renderer._rootGroup.appendChild(this._textElement);
  },


  /**
   * Calculate position for text
   */
  _updateTextPosition: function() {
    var textElement = this._textElement;
    if (textElement) {
      var bbox = textElement.getBBox();
      var textPosition = this._point.subtract(
        L.point(bbox.width, -bbox.height + this.options.shiftY).divideBy(2));

      textElement.setAttribute('x', textPosition.x);
      textElement.setAttribute('y', textPosition.y);
      this._groupTextToPath();
    }
  },


  /**
   * Set text style
   */
  setStyle: function(style) {
    L.CircleMarker.prototype.setStyle.call(this, style);
    if (this._textElement) {
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
  },


  /**
   * Remove text
   */
  onRemove: function(map) {
    if (this._textElement) {
      if (this._textElement.parentNode) {
        this._textElement.parentNode.removeChild(this._textElement);
      }
      this._textElement = null;
      this._textNode = null;
      this._textLayer = null;
    }

    return L.CircleMarker.prototype.onRemove.call(this, map);
  }

});


L.TextCircle = Circle;
L.textCircle = function (text, latlng, options) {
  return new Circle(text, latlng, options);
};
