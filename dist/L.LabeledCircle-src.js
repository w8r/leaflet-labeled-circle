(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _marker = _interopRequireDefault(require("./src/marker"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/**
 * Leaflet SVG circle marker with detachable and draggable label and text
 *
 * @author Alexander Milevski <info@w8r.name>
 * @license MIT
 * @preserve
 */
var _default = _marker["default"];
exports["default"] = _default;

},{"./src/marker":9}],2:[function(require,module,exports){
require('./src/SVG');
require('./src/SVG.VML');
require('./src/Canvas');
require('./src/Path.Transform');
require('./src/Path.Drag');

module.exports = L.Path.Drag;

},{"./src/Canvas":3,"./src/Path.Drag":4,"./src/Path.Transform":5,"./src/SVG":7,"./src/SVG.VML":6}],3:[function(require,module,exports){
function TRUE_FN () { return true; }

L.Canvas.include({

  /**
   * Do nothing
   * @param  {L.Path} layer
   */
  _resetTransformPath: function(layer) {
    if (!this._containerCopy) return;

    delete this._containerCopy;

    if (layer._containsPoint_) {
      layer._containsPoint = layer._containsPoint_;
      delete layer._containsPoint_;

      this._requestRedraw(layer);
    }
  },


  /**
   * Algorithm outline:
   *
   * 1. pre-transform - clear the path out of the canvas, copy canvas state
   * 2. at every frame:
   *    2.1. save
   *    2.2. redraw the canvas from saved one
   *    2.3. transform
   *    2.4. draw path
   *    2.5. restore
   * 3. Repeat
   *
   * @param  {L.Path}         layer
   * @param  {Array.<Number>} matrix
   */
  transformPath: function(layer, matrix) {
    var copy   = this._containerCopy;
    var ctx    = this._ctx, copyCtx;
    var m      = L.Browser.retina ? 2 : 1;
    var bounds = this._bounds;
    var size   = bounds.getSize();
    var pos    = bounds.min;

    if (!copy) { // get copy of all rendered layers
      copy = this._containerCopy = document.createElement('canvas');
      copyCtx = copy.getContext('2d');
      // document.body.appendChild(copy);

      copy.width  = m * size.x;
      copy.height = m * size.y;

      this._removePath(layer);
      this._redraw();

      copyCtx.translate(m * bounds.min.x, m * bounds.min.y);
      copyCtx.drawImage(this._container, 0, 0);
      this._initPath(layer);

      // avoid flickering because of the 'mouseover's
      layer._containsPoint_ = layer._containsPoint;
      layer._containsPoint  = TRUE_FN;
    }

    ctx.save();
    ctx.clearRect(pos.x, pos.y, size.x * m, size.y * m);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
    ctx.save();

    ctx.drawImage(this._containerCopy, 0, 0, size.x, size.y);
    ctx.transform.apply(ctx, matrix);

    // now draw one layer only
    this._drawing = true;
    layer._updatePath();
    this._drawing = false;

    ctx.restore();
  }

});

},{}],4:[function(require,module,exports){
var END = {
  mousedown:     'mouseup',
  touchstart:    'touchend',
  pointerdown:   'touchend',
  MSPointerDown: 'touchend'
};

var MOVE = {
  mousedown:     'mousemove',
  touchstart:    'touchmove',
  pointerdown:   'touchmove',
  MSPointerDown: 'touchmove'
};

function distance(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Drag handler
 * @class L.Path.Drag
 * @extends {L.Handler}
 */
L.Handler.PathDrag = L.Handler.extend( /** @lends  L.Path.Drag.prototype */ {

  statics: {
    DRAGGING_CLS: 'leaflet-path-draggable',
  },


  /**
   * @param  {L.Path} path
   * @constructor
   */
  initialize: function(path) {

    /**
     * @type {L.Path}
     */
    this._path = path;

    /**
     * @type {Array.<Number>}
     */
    this._matrix = null;

    /**
     * @type {L.Point}
     */
    this._startPoint = null;

    /**
     * @type {L.Point}
     */
    this._dragStartPoint = null;

    /**
     * @type {Boolean}
     */
    this._mapDraggingWasEnabled = false;

  },

  /**
   * Enable dragging
   */
  addHooks: function() {
    this._path.on('mousedown', this._onDragStart, this);

    this._path.options.className = this._path.options.className ?
        (this._path.options.className + ' ' + L.Handler.PathDrag.DRAGGING_CLS) :
         L.Handler.PathDrag.DRAGGING_CLS;

    if (this._path._path) {
      L.DomUtil.addClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    }
  },

  /**
   * Disable dragging
   */
  removeHooks: function() {
    this._path.off('mousedown', this._onDragStart, this);

    this._path.options.className = this._path.options.className
      .replace(new RegExp('\\s+' + L.Handler.PathDrag.DRAGGING_CLS), '');
    if (this._path._path) {
      L.DomUtil.removeClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    }
  },

  /**
   * @return {Boolean}
   */
  moved: function() {
    return this._path._dragMoved;
  },

  /**
   * Start drag
   * @param  {L.MouseEvent} evt
   */
  _onDragStart: function(evt) {
    var eventType = evt.originalEvent._simulated ? 'touchstart' : evt.originalEvent.type;

    this._mapDraggingWasEnabled = false;
    this._startPoint = evt.containerPoint.clone();
    this._dragStartPoint = evt.containerPoint.clone();
    this._matrix = [1, 0, 0, 1, 0, 0];
    L.DomEvent.stop(evt.originalEvent);

    L.DomUtil.addClass(this._path._renderer._container, 'leaflet-interactive');
    L.DomEvent
      .on(document, MOVE[eventType], this._onDrag,    this)
      .on(document, END[eventType],  this._onDragEnd, this);

    if (this._path._map.dragging.enabled()) {
      // I guess it's required because mousdown gets simulated with a delay
      //this._path._map.dragging._draggable._onUp(evt);

      this._path._map.dragging.disable();
      this._mapDraggingWasEnabled = true;
    }
    this._path._dragMoved = false;

    if (this._path._popup) { // that might be a case on touch devices as well
      this._path._popup._close();
    }

    this._replaceCoordGetters(evt);
  },

  /**
   * Dragging
   * @param  {L.MouseEvent} evt
   */
  _onDrag: function(evt) {
    L.DomEvent.stop(evt);

    var first = (evt.touches && evt.touches.length >= 1 ? evt.touches[0] : evt);
    var containerPoint = this._path._map.mouseEventToContainerPoint(first);

    // skip taps
    if (evt.type === 'touchmove' && !this._path._dragMoved) {
      var totalMouseDragDistance = this._dragStartPoint.distanceTo(containerPoint);
      if (totalMouseDragDistance <= this._path._map.options.tapTolerance) {
        return;
      }
    }

    var x = containerPoint.x;
    var y = containerPoint.y;

    var dx = x - this._startPoint.x;
    var dy = y - this._startPoint.y;

    // Send events only if point was moved
    if (dx || dy) {
      if (!this._path._dragMoved) {
        this._path._dragMoved = true;
        this._path.fire('dragstart', evt);
        // we don't want that to happen on click
        this._path.bringToFront();
      }

      this._matrix[4] += dx;
      this._matrix[5] += dy;

      this._startPoint.x = x;
      this._startPoint.y = y;

      this._path.fire('predrag', evt);
      this._path._transform(this._matrix);
      this._path.fire('drag', evt);
    }
  },

  /**
   * Dragging stopped, apply
   * @param  {L.MouseEvent} evt
   */
  _onDragEnd: function(evt) {
    var containerPoint = this._path._map.mouseEventToContainerPoint(evt);
    var moved = this.moved();

    // apply matrix
    if (moved) {
      this._transformPoints(this._matrix);
      this._path._updatePath();
      this._path._project();
      this._path._transform(null);

      L.DomEvent.stop(evt);
    }


    L.DomEvent.off(document, 'mousemove touchmove', this._onDrag,    this);
    L.DomEvent.off(document, 'mouseup touchend',    this._onDragEnd, this);

    this._restoreCoordGetters();

    // consistency
    if (moved) {
      this._path.fire('dragend', {
        distance: distance(this._dragStartPoint, containerPoint)
      });

      // hack for skipping the click in canvas-rendered layers
      var contains = this._path._containsPoint;
      this._path._containsPoint = L.Util.falseFn;
      L.Util.requestAnimFrame(function() {
        L.DomEvent.skipped({ type: 'click' });
        this._path._containsPoint = contains;
      }, this);
    }

    this._matrix          = null;
    this._startPoint      = null;
    this._dragStartPoint  = null;
    this._path._dragMoved = false;

    if (this._mapDraggingWasEnabled) {
      if (moved) L.DomEvent.fakeStop({ type: 'click' });
      this._path._map.dragging.enable();
    }
  },


  /**
   * Applies transformation, does it in one sweep for performance,
   * so don't be surprised about the code repetition.
   *
   * [ x ]   [ a  b  tx ] [ x ]   [ a * x + b * y + tx ]
   * [ y ] = [ c  d  ty ] [ y ] = [ c * x + d * y + ty ]
   *
   * @param {Array.<Number>} matrix
   */
  _transformPoints: function(matrix, dest) {
    var path = this._path;
    var i, len, latlng;

    var px = L.point(matrix[4], matrix[5]);

    var crs = path._map.options.crs;
    var transformation = crs.transformation;
    var scale = crs.scale(path._map.getZoom());
    var projection = crs.projection;

    var diff = transformation.untransform(px, scale)
      .subtract(transformation.untransform(L.point(0, 0), scale));
    var applyTransform = !dest;

    path._bounds = new L.LatLngBounds();

    // console.time('transform');
    // all shifts are in-place
    if (path._point) { // L.Circle
      dest = projection.unproject(
        projection.project(path._latlng)._add(diff));
      if (applyTransform) {
        path._latlng = dest;
        path._point._add(px);
      }
    } else if (path._rings || path._parts) { // everything else
      var rings   = path._rings || path._parts;
      var latlngs = path._latlngs;
      dest = dest || latlngs;
      if (!L.Util.isArray(latlngs[0])) { // polyline
        latlngs = [latlngs];
        dest    = [dest];
      }
      for (i = 0, len = rings.length; i < len; i++) {
        dest[i] = dest[i] || [];
        for (var j = 0, jj = rings[i].length; j < jj; j++) {
          latlng     = latlngs[i][j];
          dest[i][j] = projection
            .unproject(projection.project(latlng)._add(diff));
          if (applyTransform) {
            path._bounds.extend(latlngs[i][j]);
            rings[i][j]._add(px);
          }
        }
      }
    }
    return dest;
    // console.timeEnd('transform');
  },



  /**
   * If you want to read the latlngs during the drag - your right,
   * but they have to be transformed
   */
  _replaceCoordGetters: function() {
    if (this._path.getLatLng) { // Circle, CircleMarker
      this._path.getLatLng_ = this._path.getLatLng;
      this._path.getLatLng = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, {});
      }, this._path);
    } else if (this._path.getLatLngs) {
      this._path.getLatLngs_ = this._path.getLatLngs;
      this._path.getLatLngs = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, []);
      }, this._path);
    }
  },


  /**
   * Put back the getters
   */
  _restoreCoordGetters: function() {
    if (this._path.getLatLng_) {
      this._path.getLatLng = this._path.getLatLng_;
      delete this._path.getLatLng_;
    } else if (this._path.getLatLngs_) {
      this._path.getLatLngs = this._path.getLatLngs_;
      delete this._path.getLatLngs_;
    }
  }

});


/**
 * @param  {L.Path} layer
 * @return {L.Path}
 */
L.Handler.PathDrag.makeDraggable = function(layer) {
  layer.dragging = new L.Handler.PathDrag(layer);
  return layer;
};


/**
 * Also expose as a method
 * @return {L.Path}
 */
L.Path.prototype.makeDraggable = function() {
  return L.Handler.PathDrag.makeDraggable(this);
};


L.Path.addInitHook(function() {
  if (this.options.draggable) {
    // ensure interactive
    this.options.interactive = true;

    if (this.dragging) {
      this.dragging.enable();
    } else {
      L.Handler.PathDrag.makeDraggable(this);
      this.dragging.enable();
    }
  } else if (this.dragging) {
    this.dragging.disable();
  }
});

},{}],5:[function(require,module,exports){
/**
 * Leaflet vector features drag functionality
 * @author Alexander Milevski <info@w8r.name>
 * @preserve
 */

/**
 * Matrix transform path for SVG/VML
 * Renderer-independent
 */
L.Path.include({

	/**
	 * Applies matrix transformation to SVG
	 * @param {Array.<Number>?} matrix
	 */
	_transform: function(matrix) {
		if (this._renderer) {
			if (matrix) {
				this._renderer.transformPath(this, matrix);
			} else {
				// reset transform matrix
				this._renderer._resetTransformPath(this);
				this._update();
			}
		}
		return this;
	},

	/**
	 * Check if the feature was dragged, that'll supress the click event
	 * on mouseup. That fixes popups for example
	 *
	 * @param  {MouseEvent} e
	 */
	_onMouseClick: function(e) {
		if ((this.dragging && this.dragging.moved()) ||
			(this._map.dragging && this._map.dragging.moved())) {
			return;
		}

		this._fireMouseEvent(e);
	}

});

},{}],6:[function(require,module,exports){
L.SVG.include(!L.Browser.vml ? {} : {

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		if (layer._skew) {
			// super important! workaround for a 'jumping' glitch:
			// disable transform before removing it
			layer._skew.on = false;
			layer._path.removeChild(layer._skew);
			layer._skew = null;
		}
	},

	/**
	 * Applies matrix transformation to VML
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		var skew = layer._skew;

		if (!skew) {
			skew = L.SVG.create('skew');
			layer._path.appendChild(skew);
			skew.style.behavior = 'url(#default#VML)';
			layer._skew = skew;
		}

		// handle skew/translate separately, cause it's broken
		var mt = matrix[0].toFixed(8) + ' ' + matrix[1].toFixed(8) + ' ' +
			matrix[2].toFixed(8) + ' ' + matrix[3].toFixed(8) + ' 0 0';
		var offset = Math.floor(matrix[4]).toFixed() + ', ' +
			Math.floor(matrix[5]).toFixed() + '';

		var s = this._path.style;
		var l = parseFloat(s.left);
		var t = parseFloat(s.top);
		var w = parseFloat(s.width);
		var h = parseFloat(s.height);

		if (isNaN(l))       l = 0;
		if (isNaN(t))       t = 0;
		if (isNaN(w) || !w) w = 1;
		if (isNaN(h) || !h) h = 1;

		var origin = (-l / w - 0.5).toFixed(8) + ' ' + (-t / h - 0.5).toFixed(8);

		skew.on = 'f';
		skew.matrix = mt;
		skew.origin = origin;
		skew.offset = offset;
		skew.on = true;
	}

});

},{}],7:[function(require,module,exports){
L.SVG.include({

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		layer._path.setAttributeNS(null, 'transform', '');
	},

	/**
	 * Applies matrix transformation to SVG
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		layer._path.setAttributeNS(null, 'transform',
			'matrix(' + matrix.join(' ') + ')');
	}

});

},{}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.textCircle = exports.Circle = void 0;

var _leaflet = _interopRequireDefault(require("leaflet"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var Circle = _leaflet["default"].CircleMarker.extend({
  options: {
    textStyle: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 300
    },
    shiftY: 7
  },

  /**
   * @class LabeledCircle
   * @constructor
   * @extends {L.CircleMarker}
   * @param  {String}   text
   * @param  {L.LatLng} latlng
   * @param  {Object=}  options
   */
  initialize: function initialize(text, latlng, options) {
    /**
     * @type {String}
     */
    this._text = text;
    /**
     * @type {SVGTextElement}
     */

    this._textElement = null;
    /**
     * @type {TextNode}
     */

    this._textNode = null;
    /**
     * @type {Object|Null}
     */

    this._textLayer = null;

    _leaflet["default"].CircleMarker.prototype.initialize.call(this, latlng, options);
  },

  /**
   * @param {String} text
   * @return {LabeledCircle}
   */
  setText: function setText(text) {
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
  getText: function getText() {
    return this._text;
  },

  /**
   * Also bring text to front
   * @override
   */
  bringToFront: function bringToFront() {
    _leaflet["default"].CircleMarker.prototype.bringToFront.call(this);

    this._groupTextToPath();
  },

  /**
   * @override
   */
  bringToBack: function bringToBack() {
    _leaflet["default"].CircleMarker.prototype.bringToBack.call(this);

    this._groupTextToPath();
  },

  /**
   * Put text in the right position in the dom
   */
  _groupTextToPath: function _groupTextToPath() {
    var path = this._path;
    var textElement = this._textElement;
    var next = path.nextSibling;
    var parent = path.parentNode;

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
  _updatePath: function _updatePath() {
    _leaflet["default"].CircleMarker.prototype._updatePath.call(this);

    this._updateTextPosition();
  },

  /**
   * @override
   */
  _transform: function _transform(matrix) {
    _leaflet["default"].CircleMarker.prototype._transform.call(this, matrix); // wrap textElement with a fake layer for renderer
    // to be able to transform it


    this._textLayer = this._textLayer || {
      _path: this._textElement
    };

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
  onAdd: function onAdd(map) {
    _leaflet["default"].CircleMarker.prototype.onAdd.call(this, map);

    this._initText();

    this._updateTextPosition();

    this.setStyle({});
    return this;
  },

  /**
   * Create and insert text
   */
  _initText: function _initText() {
    this._textElement = _leaflet["default"].SVG.create('text');
    this.setText(this._text);

    this._renderer._rootGroup.appendChild(this._textElement);
  },

  /**
   * Calculate position for text
   */
  _updateTextPosition: function _updateTextPosition() {
    var textElement = this._textElement;

    if (textElement) {
      var bbox = textElement.getBBox();

      var textPosition = this._point.subtract(_leaflet["default"].point(bbox.width, -bbox.height + this.options.shiftY).divideBy(2));

      textElement.setAttribute('x', textPosition.x);
      textElement.setAttribute('y', textPosition.y);

      this._groupTextToPath();
    }
  },

  /**
   * Set text style
   */
  setStyle: function setStyle(style) {
    _leaflet["default"].CircleMarker.prototype.setStyle.call(this, style);

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
  onRemove: function onRemove(map) {
    if (this._textElement) {
      if (this._textElement.parentNode) {
        this._textElement.parentNode.removeChild(this._textElement);
      }

      this._textElement = null;
      this._textNode = null;
      this._textLayer = null;
    }

    return _leaflet["default"].CircleMarker.prototype.onRemove.call(this, map);
  }
});

exports.Circle = Circle;

var textCircle = function textCircle(text, latlng, options) {
  return new Circle(text, latlng, options);
};

exports.textCircle = textCircle;

},{"leaflet":"leaflet"}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _leaflet = _interopRequireDefault(require("leaflet"));

var _circle = require("./circle");

require("leaflet-path-drag");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var LabeledMarker = _leaflet["default"].FeatureGroup.extend({
  options: {
    /**
     * @param  {LabeledMarker} marker
     * @param  {Object}        feature
     * @return {String}
     */
    getLabelText: function getLabelText(marker, feature) {
      return feature.properties.text;
    },

    /**
     * @param  {LabeledMarker} marker
     * @param  {Object}        feature
     * @param  {L.LatLng}      latlng
     * @return {L.LatLng}
     */
    getLabelPosition: function getLabelPosition(marker, feature, latlng) {
      return feature.properties.labelPosition ? _leaflet["default"].latLng(feature.properties.labelPosition.slice().reverse()) : latlng;
    },
    labelPositionKey: 'labelPosition',
    markerOptions: {
      color: '#f00',
      fillOpacity: 0.75,
      draggable: true,
      radius: 15
    },
    anchorOptions: {
      color: '#00f',
      radius: 3
    },
    lineOptions: {
      color: '#f00',
      dashArray: [2, 6],
      lineCap: 'square',
      weight: 2
    }
  },

  /**
   * @class LabeledMarker
   * @constructor
   * @extends {L.FeatureGroup}
   *
   * @param  {L.LatLng} latlng
   * @param  {Object=}  feature
   * @param  {Object=}  options
   */
  initialize: function initialize(latlng, feature, options) {
    _leaflet["default"].Util.setOptions(this, options);
    /**
     * @type {Object}
     */


    this.feature = feature || {
      type: 'Feature',
      properties: {},
      geometry: {
        'type': 'Point'
      }
    };
    /**
     * @type {L.LatLng}
     */

    this._latlng = latlng;
    /**
     * @type {CircleLabel}
     */

    this._marker = null;
    /**
     * @type {L.CircleMarker}
     */

    this._anchor = null;
    /**
     * @type {L.Polyline}
     */

    this._line = null;
    /**
     * @type {L.Point}
     */

    this._initialDistance = null;

    this._createLayers();

    _leaflet["default"].LayerGroup.prototype.initialize.call(this, [this._anchor, this._line, this._marker]);
  },

  /**
   * @return {L.LatLng}
   */
  getLabelPosition: function getLabelPosition() {
    return this._marker.getLatLng();
  },

  /**
   * @return {L.LatLng}
   */
  getLatLng: function getLatLng() {
    return this._latlng;
  },

  /**
   * Serialize
   * @return {Object}
   */
  toGeoJSON: function toGeoJSON(geometryCollection) {
    var feature = _leaflet["default"].GeoJSON.getFeature(this, {
      type: 'Point',
      coordinates: _leaflet["default"].GeoJSON.latLngToCoords(this._anchor.getLatLng())
    });

    feature.properties[this.options.labelPositionKey] = _leaflet["default"].GeoJSON.latLngToCoords(this._marker.getLatLng());
    feature.properties.text = this._marker.getText();
    return geometryCollection ? _leaflet["default"].LabeledCircleMarker.toGeometryCollection(feature, this.options.labelPositionKey) : feature;
  },

  /**
   * @param {String} text
   * @return {LabeledMarker}
   */
  setText: function setText(text) {
    this._marker.setText(text);

    return this;
  },

  /**
   * Creates anchor, line and label
   */
  _createLayers: function _createLayers() {
    var opts = this.options;
    var pos = opts.getLabelPosition(this, this.feature, this._latlng);
    var text = opts.getLabelText(this, this.feature);

    if ('draggable' in opts) {
      opts.markerOptions.draggable = opts.draggable;
    }

    this._marker = new _circle.Circle(text, pos, _leaflet["default"].Util.extend({
      interactive: this.options.interactive
    }, LabeledMarker.prototype.options.markerOptions, opts.markerOptions)).on('drag', this._onMarkerDrag, this).on('dragstart', this._onMarkerDragStart, this).on('dragend', this._onMarkerDragEnd, this);
    this._anchor = new _leaflet["default"].CircleMarker(this._latlng, _leaflet["default"].Util.extend({}, LabeledMarker.prototype.options.anchorOptions, opts.anchorOptions));
    this._line = new _leaflet["default"].Polyline([this._latlng, this._marker.getLatLng()], _leaflet["default"].Util.extend({}, LabeledMarker.prototype.options.lineOptions, opts.lineOptions));
  },

  /**
   * Store shift to be precise while dragging
   * @param  {Event} evt
   */
  _onMarkerDragStart: function _onMarkerDragStart(evt) {
    this._initialDistance = _leaflet["default"].DomEvent.getMousePosition(evt).subtract(this._map.latLngToContainerPoint(this._marker.getLatLng()));
    this.fire('label:' + evt.type, evt); //L.Util.requestAnimFrame(this._marker.bringToFront, this._marker);
  },

  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag: function _onMarkerDrag(evt) {
    var latlng = this._map.containerPointToLatLng(_leaflet["default"].DomEvent.getMousePosition(evt)._subtract(this._initialDistance));

    this._line.setLatLngs([latlng, this._latlng]);

    this.fire('label:' + evt.type, evt);
  },
  _onMarkerDragEnd: function _onMarkerDragEnd(evt) {
    this._line.setLatLngs([this._marker.getLatLng(), this._latlng]);

    this.fire('label:' + evt.type, evt);
  },
  enableDragging: function enableDragging() {
    if (this._marker.dragging) this._marker.dragging.enable();
    return this;
  },
  disableDragging: function disableDragging() {
    if (this._marker.dragging) this._marker.dragging.disable();
    return this;
  }
});
/**
 * @param  {Object} feature
 * @param  {String=} key
 * @return {Object}
 */


function toGeometryCollection(feature, key) {
  key = key || 'labelPosition';
  var anchorPos = feature.geometry.coordinates.slice();
  var labelPos = feature.properties[key];
  if (!labelPos) throw new Error('No label position set');
  labelPos = labelPos.slice();
  var geometries = [{
    type: 'Point',
    coordinates: anchorPos
  }, {
    type: 'LineString',
    coordinates: [anchorPos.slice(), labelPos]
  }, {
    type: 'Point',
    coordinates: labelPos.slice()
  }, {
    type: 'Point',
    coordinates: labelPos.slice()
  }];
  return {
    type: 'Feature',
    properties: _leaflet["default"].Util.extend({}, feature.properties, {
      geometriesTypes: ['anchor', 'connection', 'label', 'textbox']
    }),
    bbox: feature.bbox,
    geometry: {
      type: 'GeometryCollection',
      geometries: geometries
    }
  };
}

LabeledMarker.toGeometryCollection = toGeometryCollection;
_leaflet["default"].LabeledCircleMarker = LabeledMarker;

_leaflet["default"].labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

var _default = LabeledMarker;
exports["default"] = _default;

},{"./circle":8,"leaflet":"leaflet","leaflet-path-drag":2}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvQ2FudmFzLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9QYXRoLkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuVk1MLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuanMiLCJzcmMvY2lyY2xlLmpzIiwic3JjL21hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7QUNPQTs7OztBQVBBOzs7Ozs7O2VBUWUsa0I7Ozs7QUNSZjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7QUNwQkE7Ozs7QUFFTyxJQUFNLE1BQU0sR0FBRyxvQkFBRSxZQUFGLENBQWUsTUFBZixDQUFzQjtBQUUxQyxFQUFBLE9BQU8sRUFBRTtBQUNQLElBQUEsU0FBUyxFQUFFO0FBQ1QsTUFBQSxLQUFLLEVBQUUsTUFERTtBQUVULE1BQUEsUUFBUSxFQUFFLEVBRkQ7QUFHVCxNQUFBLFVBQVUsRUFBRTtBQUhILEtBREo7QUFNUCxJQUFBLE1BQU0sRUFBRTtBQU5ELEdBRmlDOztBQVkxQzs7Ozs7Ozs7QUFRQSxFQUFBLFVBcEIwQyxzQkFvQi9CLElBcEIrQixFQW9CekIsTUFwQnlCLEVBb0JqQixPQXBCaUIsRUFvQlI7QUFDaEM7OztBQUdBLFNBQUssS0FBTCxHQUFvQixJQUFwQjtBQUVBOzs7O0FBR0EsU0FBSyxZQUFMLEdBQW9CLElBQXBCO0FBRUE7Ozs7QUFHQSxTQUFLLFNBQUwsR0FBb0IsSUFBcEI7QUFFQTs7OztBQUdBLFNBQUssVUFBTCxHQUFvQixJQUFwQjs7QUFFQSx3QkFBRSxZQUFGLENBQWUsU0FBZixDQUF5QixVQUF6QixDQUFvQyxJQUFwQyxDQUF5QyxJQUF6QyxFQUErQyxNQUEvQyxFQUF1RCxPQUF2RDtBQUNELEdBMUN5Qzs7QUE2QzFDOzs7O0FBSUEsRUFBQSxPQWpEMEMsbUJBaURsQyxJQWpEa0MsRUFpRDVCO0FBQ1osU0FBSyxLQUFMLEdBQWEsSUFBYjs7QUFDQSxRQUFJLEtBQUssU0FBVCxFQUFvQjtBQUNsQixXQUFLLFlBQUwsQ0FBa0IsV0FBbEIsQ0FBOEIsS0FBSyxTQUFuQztBQUNEOztBQUNELFNBQUssU0FBTCxHQUFpQixRQUFRLENBQUMsY0FBVCxDQUF3QixLQUFLLEtBQTdCLENBQWpCOztBQUNBLFNBQUssWUFBTCxDQUFrQixXQUFsQixDQUE4QixLQUFLLFNBQW5DOztBQUVBLFdBQU8sSUFBUDtBQUNELEdBMUR5Qzs7QUE2RDFDOzs7QUFHQSxFQUFBLE9BaEUwQyxxQkFnRWhDO0FBQ1IsV0FBTyxLQUFLLEtBQVo7QUFDRCxHQWxFeUM7O0FBcUUxQzs7OztBQUlBLEVBQUEsWUF6RTBDLDBCQXlFM0I7QUFDYix3QkFBRSxZQUFGLENBQWUsU0FBZixDQUF5QixZQUF6QixDQUFzQyxJQUF0QyxDQUEyQyxJQUEzQzs7QUFDQSxTQUFLLGdCQUFMO0FBQ0QsR0E1RXlDOztBQStFMUM7OztBQUdBLEVBQUEsV0FsRjBDLHlCQWtGNUI7QUFDWix3QkFBRSxZQUFGLENBQWUsU0FBZixDQUF5QixXQUF6QixDQUFxQyxJQUFyQyxDQUEwQyxJQUExQzs7QUFDQSxTQUFLLGdCQUFMO0FBQ0QsR0FyRnlDOztBQXdGMUM7OztBQUdBLEVBQUEsZ0JBM0YwQyw4QkEyRnZCO0FBQ2pCLFFBQU0sSUFBSSxHQUFVLEtBQUssS0FBekI7QUFDQSxRQUFNLFdBQVcsR0FBRyxLQUFLLFlBQXpCO0FBQ0EsUUFBTSxJQUFJLEdBQVUsSUFBSSxDQUFDLFdBQXpCO0FBQ0EsUUFBTSxNQUFNLEdBQVEsSUFBSSxDQUFDLFVBQXpCOztBQUdBLFFBQUksV0FBVyxJQUFJLE1BQW5CLEVBQTJCO0FBQ3pCLFVBQUksSUFBSSxJQUFJLElBQUksS0FBSyxXQUFyQixFQUFrQztBQUNoQyxRQUFBLE1BQU0sQ0FBQyxZQUFQLENBQW9CLFdBQXBCLEVBQWlDLElBQWpDO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsUUFBQSxNQUFNLENBQUMsV0FBUCxDQUFtQixXQUFuQjtBQUNEO0FBQ0Y7QUFDRixHQXpHeUM7O0FBNEcxQzs7O0FBR0EsRUFBQSxXQS9HMEMseUJBK0c1QjtBQUNaLHdCQUFFLFlBQUYsQ0FBZSxTQUFmLENBQXlCLFdBQXpCLENBQXFDLElBQXJDLENBQTBDLElBQTFDOztBQUNBLFNBQUssbUJBQUw7QUFDRCxHQWxIeUM7O0FBcUgxQzs7O0FBR0EsRUFBQSxVQXhIMEMsc0JBd0gvQixNQXhIK0IsRUF3SHZCO0FBQ2pCLHdCQUFFLFlBQUYsQ0FBZSxTQUFmLENBQXlCLFVBQXpCLENBQW9DLElBQXBDLENBQXlDLElBQXpDLEVBQStDLE1BQS9DLEVBRGlCLENBR2pCO0FBQ0E7OztBQUNBLFNBQUssVUFBTCxHQUFrQixLQUFLLFVBQUwsSUFBbUI7QUFBRSxNQUFBLEtBQUssRUFBRSxLQUFLO0FBQWQsS0FBckM7O0FBQ0EsUUFBSSxNQUFKLEVBQVk7QUFDVixXQUFLLFNBQUwsQ0FBZSxhQUFmLENBQTZCLEtBQUssVUFBbEMsRUFBOEMsTUFBOUM7QUFDRCxLQUZELE1BRU87QUFDTCxXQUFLLFNBQUwsQ0FBZSxtQkFBZixDQUFtQyxLQUFLLFVBQXhDOztBQUNBLFdBQUssbUJBQUw7O0FBQ0EsV0FBSyxVQUFMLEdBQWtCLElBQWxCO0FBQ0Q7QUFDRixHQXJJeUM7O0FBd0kxQzs7OztBQUlBLEVBQUEsS0E1STBDLGlCQTRJcEMsR0E1SW9DLEVBNEkvQjtBQUNULHdCQUFFLFlBQUYsQ0FBZSxTQUFmLENBQXlCLEtBQXpCLENBQStCLElBQS9CLENBQW9DLElBQXBDLEVBQTBDLEdBQTFDOztBQUNBLFNBQUssU0FBTDs7QUFDQSxTQUFLLG1CQUFMOztBQUNBLFNBQUssUUFBTCxDQUFjLEVBQWQ7QUFDQSxXQUFPLElBQVA7QUFDRCxHQWxKeUM7O0FBcUoxQzs7O0FBR0EsRUFBQSxTQXhKMEMsdUJBd0o5QjtBQUNWLFNBQUssWUFBTCxHQUFvQixvQkFBRSxHQUFGLENBQU0sTUFBTixDQUFhLE1BQWIsQ0FBcEI7QUFDQSxTQUFLLE9BQUwsQ0FBYSxLQUFLLEtBQWxCOztBQUNBLFNBQUssU0FBTCxDQUFlLFVBQWYsQ0FBMEIsV0FBMUIsQ0FBc0MsS0FBSyxZQUEzQztBQUNELEdBNUp5Qzs7QUErSjFDOzs7QUFHQSxFQUFBLG1CQWxLMEMsaUNBa0twQjtBQUNwQixRQUFNLFdBQVcsR0FBRyxLQUFLLFlBQXpCOztBQUNBLFFBQUksV0FBSixFQUFpQjtBQUNmLFVBQU0sSUFBSSxHQUFHLFdBQVcsQ0FBQyxPQUFaLEVBQWI7O0FBQ0EsVUFBTSxZQUFZLEdBQUcsS0FBSyxNQUFMLENBQVksUUFBWixDQUNuQixvQkFBRSxLQUFGLENBQVEsSUFBSSxDQUFDLEtBQWIsRUFBb0IsQ0FBQyxJQUFJLENBQUMsTUFBTixHQUFlLEtBQUssT0FBTCxDQUFhLE1BQWhELEVBQXdELFFBQXhELENBQWlFLENBQWpFLENBRG1CLENBQXJCOztBQUdBLE1BQUEsV0FBVyxDQUFDLFlBQVosQ0FBeUIsR0FBekIsRUFBOEIsWUFBWSxDQUFDLENBQTNDO0FBQ0EsTUFBQSxXQUFXLENBQUMsWUFBWixDQUF5QixHQUF6QixFQUE4QixZQUFZLENBQUMsQ0FBM0M7O0FBQ0EsV0FBSyxnQkFBTDtBQUNEO0FBQ0YsR0E3S3lDOztBQWdMMUM7OztBQUdBLEVBQUEsUUFuTDBDLG9CQW1MakMsS0FuTGlDLEVBbUwxQjtBQUNkLHdCQUFFLFlBQUYsQ0FBZSxTQUFmLENBQXlCLFFBQXpCLENBQWtDLElBQWxDLENBQXVDLElBQXZDLEVBQTZDLEtBQTdDOztBQUNBLFFBQUksS0FBSyxZQUFULEVBQXVCO0FBQ3JCLFVBQU0sTUFBTSxHQUFHLEtBQUssT0FBTCxDQUFhLFNBQTVCOztBQUNBLFdBQUssSUFBSSxJQUFULElBQWlCLE1BQWpCLEVBQXlCO0FBQ3ZCLFlBQUksTUFBTSxDQUFDLGNBQVAsQ0FBc0IsSUFBdEIsQ0FBSixFQUFpQztBQUMvQixjQUFJLFNBQVMsR0FBRyxJQUFoQjs7QUFDQSxjQUFJLElBQUksS0FBSyxPQUFiLEVBQXNCO0FBQ3BCLFlBQUEsU0FBUyxHQUFHLFFBQVo7QUFDRDs7QUFDRCxlQUFLLFlBQUwsQ0FBa0IsS0FBbEIsQ0FBd0IsU0FBeEIsSUFBcUMsTUFBTSxDQUFDLElBQUQsQ0FBM0M7QUFDRDtBQUNGO0FBQ0Y7QUFDRixHQWpNeUM7O0FBb00xQzs7O0FBR0EsRUFBQSxRQXZNMEMsb0JBdU1qQyxHQXZNaUMsRUF1TTVCO0FBQ1osUUFBSSxLQUFLLFlBQVQsRUFBdUI7QUFDckIsVUFBSSxLQUFLLFlBQUwsQ0FBa0IsVUFBdEIsRUFBa0M7QUFDaEMsYUFBSyxZQUFMLENBQWtCLFVBQWxCLENBQTZCLFdBQTdCLENBQXlDLEtBQUssWUFBOUM7QUFDRDs7QUFDRCxXQUFLLFlBQUwsR0FBb0IsSUFBcEI7QUFDQSxXQUFLLFNBQUwsR0FBaUIsSUFBakI7QUFDQSxXQUFLLFVBQUwsR0FBa0IsSUFBbEI7QUFDRDs7QUFFRCxXQUFPLG9CQUFFLFlBQUYsQ0FBZSxTQUFmLENBQXlCLFFBQXpCLENBQWtDLElBQWxDLENBQXVDLElBQXZDLEVBQTZDLEdBQTdDLENBQVA7QUFDRDtBQWxOeUMsQ0FBdEIsQ0FBZjs7OztBQXFOQSxJQUFNLFVBQVUsR0FBRyxTQUFiLFVBQWEsQ0FBQyxJQUFELEVBQU8sTUFBUCxFQUFlLE9BQWY7QUFBQSxTQUEyQixJQUFJLE1BQUosQ0FBVyxJQUFYLEVBQWlCLE1BQWpCLEVBQXlCLE9BQXpCLENBQTNCO0FBQUEsQ0FBbkI7Ozs7Ozs7Ozs7OztBQ3ZOUDs7QUFDQTs7QUFDQTs7OztBQUVBLElBQU0sYUFBYSxHQUFHLG9CQUFFLFlBQUYsQ0FBZSxNQUFmLENBQXNCO0FBRTFDLEVBQUEsT0FBTyxFQUFFO0FBRVA7Ozs7O0FBS0EsSUFBQSxZQUFZLEVBQUUsc0JBQUMsTUFBRCxFQUFTLE9BQVQ7QUFBQSxhQUFxQixPQUFPLENBQUMsVUFBUixDQUFtQixJQUF4QztBQUFBLEtBUFA7O0FBU1A7Ozs7OztBQU1BLElBQUEsZ0JBQWdCLEVBQUUsMEJBQUMsTUFBRCxFQUFTLE9BQVQsRUFBa0IsTUFBbEIsRUFBNkI7QUFDN0MsYUFBTyxPQUFPLENBQUMsVUFBUixDQUFtQixhQUFuQixHQUNMLG9CQUFFLE1BQUYsQ0FBUyxPQUFPLENBQUMsVUFBUixDQUFtQixhQUFuQixDQUFpQyxLQUFqQyxHQUF5QyxPQUF6QyxFQUFULENBREssR0FFTCxNQUZGO0FBR0QsS0FuQk07QUFxQlAsSUFBQSxnQkFBZ0IsRUFBRSxlQXJCWDtBQXVCUCxJQUFBLGFBQWEsRUFBRTtBQUNiLE1BQUEsS0FBSyxFQUFFLE1BRE07QUFFYixNQUFBLFdBQVcsRUFBRSxJQUZBO0FBR2IsTUFBQSxTQUFTLEVBQUUsSUFIRTtBQUliLE1BQUEsTUFBTSxFQUFFO0FBSkssS0F2QlI7QUE4QlAsSUFBQSxhQUFhLEVBQUU7QUFDYixNQUFBLEtBQUssRUFBRSxNQURNO0FBRWIsTUFBQSxNQUFNLEVBQUU7QUFGSyxLQTlCUjtBQW1DUCxJQUFBLFdBQVcsRUFBRTtBQUNYLE1BQUEsS0FBSyxFQUFFLE1BREk7QUFFWCxNQUFBLFNBQVMsRUFBRSxDQUFDLENBQUQsRUFBSSxDQUFKLENBRkE7QUFHWCxNQUFBLE9BQU8sRUFBRSxRQUhFO0FBSVgsTUFBQSxNQUFNLEVBQUU7QUFKRztBQW5DTixHQUZpQzs7QUE4QzFDOzs7Ozs7Ozs7QUFTQSxFQUFBLFVBdkQwQyxzQkF1RC9CLE1BdkQrQixFQXVEdkIsT0F2RHVCLEVBdURkLE9BdkRjLEVBdURMO0FBQ25DLHdCQUFFLElBQUYsQ0FBTyxVQUFQLENBQWtCLElBQWxCLEVBQXdCLE9BQXhCO0FBRUE7Ozs7O0FBR0EsU0FBSyxPQUFMLEdBQWUsT0FBTyxJQUFJO0FBQ3hCLE1BQUEsSUFBSSxFQUFFLFNBRGtCO0FBRXhCLE1BQUEsVUFBVSxFQUFFLEVBRlk7QUFHeEIsTUFBQSxRQUFRLEVBQUU7QUFDUixnQkFBUTtBQURBO0FBSGMsS0FBMUI7QUFRQTs7OztBQUdBLFNBQUssT0FBTCxHQUFlLE1BQWY7QUFHQTs7OztBQUdBLFNBQUssT0FBTCxHQUFlLElBQWY7QUFHQTs7OztBQUdBLFNBQUssT0FBTCxHQUFlLElBQWY7QUFHQTs7OztBQUdBLFNBQUssS0FBTCxHQUFhLElBQWI7QUFHQTs7OztBQUdBLFNBQUssZ0JBQUwsR0FBd0IsSUFBeEI7O0FBRUEsU0FBSyxhQUFMOztBQUNBLHdCQUFFLFVBQUYsQ0FBYSxTQUFiLENBQXVCLFVBQXZCLENBQWtDLElBQWxDLENBQXVDLElBQXZDLEVBQ0UsQ0FBQyxLQUFLLE9BQU4sRUFBZSxLQUFLLEtBQXBCLEVBQTJCLEtBQUssT0FBaEMsQ0FERjtBQUVELEdBckd5Qzs7QUF3RzFDOzs7QUFHQSxFQUFBLGdCQTNHMEMsOEJBMkd2QjtBQUNqQixXQUFPLEtBQUssT0FBTCxDQUFhLFNBQWIsRUFBUDtBQUNELEdBN0d5Qzs7QUFnSDFDOzs7QUFHQSxFQUFBLFNBbkgwQyx1QkFtSDlCO0FBQ1YsV0FBTyxLQUFLLE9BQVo7QUFDRCxHQXJIeUM7O0FBd0gxQzs7OztBQUlBLEVBQUEsU0E1SDBDLHFCQTRIaEMsa0JBNUhnQyxFQTRIWjtBQUM1QixRQUFNLE9BQU8sR0FBRyxvQkFBRSxPQUFGLENBQVUsVUFBVixDQUFxQixJQUFyQixFQUEyQjtBQUN6QyxNQUFBLElBQUksRUFBRSxPQURtQztBQUV6QyxNQUFBLFdBQVcsRUFBRSxvQkFBRSxPQUFGLENBQVUsY0FBVixDQUF5QixLQUFLLE9BQUwsQ0FBYSxTQUFiLEVBQXpCO0FBRjRCLEtBQTNCLENBQWhCOztBQUlBLElBQUEsT0FBTyxDQUFDLFVBQVIsQ0FBbUIsS0FBSyxPQUFMLENBQWEsZ0JBQWhDLElBQ0Usb0JBQUUsT0FBRixDQUFVLGNBQVYsQ0FBeUIsS0FBSyxPQUFMLENBQWEsU0FBYixFQUF6QixDQURGO0FBRUEsSUFBQSxPQUFPLENBQUMsVUFBUixDQUFtQixJQUFuQixHQUEwQixLQUFLLE9BQUwsQ0FBYSxPQUFiLEVBQTFCO0FBQ0EsV0FBTyxrQkFBa0IsR0FDdkIsb0JBQUUsbUJBQUYsQ0FDRyxvQkFESCxDQUN3QixPQUR4QixFQUNpQyxLQUFLLE9BQUwsQ0FBYSxnQkFEOUMsQ0FEdUIsR0FFMkMsT0FGcEU7QUFHRCxHQXZJeUM7O0FBMEkxQzs7OztBQUlBLEVBQUEsT0E5STBDLG1CQThJbEMsSUE5SWtDLEVBOEk1QjtBQUNaLFNBQUssT0FBTCxDQUFhLE9BQWIsQ0FBcUIsSUFBckI7O0FBQ0EsV0FBTyxJQUFQO0FBQ0QsR0FqSnlDOztBQW9KMUM7OztBQUdBLEVBQUEsYUF2SjBDLDJCQXVKMUI7QUFDZCxRQUFNLElBQUksR0FBRyxLQUFLLE9BQWxCO0FBQ0EsUUFBTSxHQUFHLEdBQUksSUFBSSxDQUFDLGdCQUFMLENBQXNCLElBQXRCLEVBQTRCLEtBQUssT0FBakMsRUFBMEMsS0FBSyxPQUEvQyxDQUFiO0FBQ0EsUUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFlBQUwsQ0FBa0IsSUFBbEIsRUFBd0IsS0FBSyxPQUE3QixDQUFiOztBQUVBLFFBQUksZUFBZSxJQUFuQixFQUF5QjtBQUN2QixNQUFBLElBQUksQ0FBQyxhQUFMLENBQW1CLFNBQW5CLEdBQStCLElBQUksQ0FBQyxTQUFwQztBQUNEOztBQUVELFNBQUssT0FBTCxHQUFlLElBQUksY0FBSixDQUFXLElBQVgsRUFBaUIsR0FBakIsRUFDYixvQkFBRSxJQUFGLENBQU8sTUFBUCxDQUFjO0FBQ1osTUFBQSxXQUFXLEVBQUUsS0FBSyxPQUFMLENBQWE7QUFEZCxLQUFkLEVBR0UsYUFBYSxDQUFDLFNBQWQsQ0FBd0IsT0FBeEIsQ0FBZ0MsYUFIbEMsRUFJRSxJQUFJLENBQUMsYUFKUCxDQURhLEVBTWIsRUFOYSxDQU1WLE1BTlUsRUFNRyxLQUFLLGFBTlIsRUFNNEIsSUFONUIsRUFPYixFQVBhLENBT1YsV0FQVSxFQU9HLEtBQUssa0JBUFIsRUFPNEIsSUFQNUIsRUFRYixFQVJhLENBUVYsU0FSVSxFQVFHLEtBQUssZ0JBUlIsRUFRNEIsSUFSNUIsQ0FBZjtBQVVBLFNBQUssT0FBTCxHQUFlLElBQUksb0JBQUUsWUFBTixDQUFtQixLQUFLLE9BQXhCLEVBQ2Isb0JBQUUsSUFBRixDQUFPLE1BQVAsQ0FBYyxFQUFkLEVBQWtCLGFBQWEsQ0FBQyxTQUFkLENBQXdCLE9BQXhCLENBQWdDLGFBQWxELEVBQ0UsSUFBSSxDQUFDLGFBRFAsQ0FEYSxDQUFmO0FBSUEsU0FBSyxLQUFMLEdBQWEsSUFBSSxvQkFBRSxRQUFOLENBQWUsQ0FBQyxLQUFLLE9BQU4sRUFBZSxLQUFLLE9BQUwsQ0FBYSxTQUFiLEVBQWYsQ0FBZixFQUNYLG9CQUFFLElBQUYsQ0FBTyxNQUFQLENBQWMsRUFBZCxFQUFrQixhQUFhLENBQUMsU0FBZCxDQUF3QixPQUF4QixDQUFnQyxXQUFsRCxFQUNFLElBQUksQ0FBQyxXQURQLENBRFcsQ0FBYjtBQUdELEdBakx5Qzs7QUFvTDFDOzs7O0FBSUEsRUFBQSxrQkF4TDBDLDhCQXdMdkIsR0F4THVCLEVBd0xsQjtBQUN0QixTQUFLLGdCQUFMLEdBQXdCLG9CQUFFLFFBQUYsQ0FBVyxnQkFBWCxDQUE0QixHQUE1QixFQUNyQixRQURxQixDQUNaLEtBQUssSUFBTCxDQUFVLHNCQUFWLENBQWlDLEtBQUssT0FBTCxDQUFhLFNBQWIsRUFBakMsQ0FEWSxDQUF4QjtBQUVBLFNBQUssSUFBTCxDQUFVLFdBQVcsR0FBRyxDQUFDLElBQXpCLEVBQStCLEdBQS9CLEVBSHNCLENBSXRCO0FBQ0QsR0E3THlDOztBQWdNMUM7Ozs7QUFJQSxFQUFBLGFBcE0wQyx5QkFvTTVCLEdBcE00QixFQW9NdkI7QUFDakIsUUFBTSxNQUFNLEdBQUcsS0FBSyxJQUFMLENBQVUsc0JBQVYsQ0FDYixvQkFBRSxRQUFGLENBQVcsZ0JBQVgsQ0FBNEIsR0FBNUIsRUFBaUMsU0FBakMsQ0FBMkMsS0FBSyxnQkFBaEQsQ0FEYSxDQUFmOztBQUVBLFNBQUssS0FBTCxDQUFXLFVBQVgsQ0FBc0IsQ0FBQyxNQUFELEVBQVMsS0FBSyxPQUFkLENBQXRCOztBQUNBLFNBQUssSUFBTCxDQUFVLFdBQVcsR0FBRyxDQUFDLElBQXpCLEVBQStCLEdBQS9CO0FBQ0QsR0F6TXlDO0FBNE0xQyxFQUFBLGdCQTVNMEMsNEJBNE16QixHQTVNeUIsRUE0TXBCO0FBQ3BCLFNBQUssS0FBTCxDQUFXLFVBQVgsQ0FBc0IsQ0FBQyxLQUFLLE9BQUwsQ0FBYSxTQUFiLEVBQUQsRUFBMkIsS0FBSyxPQUFoQyxDQUF0Qjs7QUFDQSxTQUFLLElBQUwsQ0FBVSxXQUFXLEdBQUcsQ0FBQyxJQUF6QixFQUErQixHQUEvQjtBQUNELEdBL015QztBQWtOMUMsRUFBQSxjQWxOMEMsNEJBa056QjtBQUNmLFFBQUksS0FBSyxPQUFMLENBQWEsUUFBakIsRUFBMkIsS0FBSyxPQUFMLENBQWEsUUFBYixDQUFzQixNQUF0QjtBQUMzQixXQUFPLElBQVA7QUFDRCxHQXJOeUM7QUF3TjFDLEVBQUEsZUF4TjBDLDZCQXdOeEI7QUFDaEIsUUFBSSxLQUFLLE9BQUwsQ0FBYSxRQUFqQixFQUEyQixLQUFLLE9BQUwsQ0FBYSxRQUFiLENBQXNCLE9BQXRCO0FBQzNCLFdBQU8sSUFBUDtBQUNEO0FBM055QyxDQUF0QixDQUF0QjtBQWdPQTs7Ozs7OztBQUtBLFNBQVMsb0JBQVQsQ0FBOEIsT0FBOUIsRUFBdUMsR0FBdkMsRUFBNEM7QUFDMUMsRUFBQSxHQUFHLEdBQUcsR0FBRyxJQUFJLGVBQWI7QUFDQSxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsUUFBUixDQUFpQixXQUFqQixDQUE2QixLQUE3QixFQUFsQjtBQUNBLE1BQUksUUFBUSxHQUFJLE9BQU8sQ0FBQyxVQUFSLENBQW1CLEdBQW5CLENBQWhCO0FBRUEsTUFBSSxDQUFDLFFBQUwsRUFBZSxNQUFNLElBQUksS0FBSixDQUFVLHVCQUFWLENBQU47QUFFZixFQUFBLFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBVCxFQUFYO0FBQ0EsTUFBTSxVQUFVLEdBQUcsQ0FBQztBQUNsQixJQUFBLElBQUksRUFBRSxPQURZO0FBRWxCLElBQUEsV0FBVyxFQUFFO0FBRkssR0FBRCxFQUdoQjtBQUNELElBQUEsSUFBSSxFQUFFLFlBREw7QUFFRCxJQUFBLFdBQVcsRUFBRSxDQUNYLFNBQVMsQ0FBQyxLQUFWLEVBRFcsRUFFWCxRQUZXO0FBRlosR0FIZ0IsRUFTaEI7QUFDRCxJQUFBLElBQUksRUFBRSxPQURMO0FBRUQsSUFBQSxXQUFXLEVBQUUsUUFBUSxDQUFDLEtBQVQ7QUFGWixHQVRnQixFQVloQjtBQUNELElBQUEsSUFBSSxFQUFFLE9BREw7QUFFRCxJQUFBLFdBQVcsRUFBRSxRQUFRLENBQUMsS0FBVDtBQUZaLEdBWmdCLENBQW5CO0FBaUJBLFNBQU87QUFDTCxJQUFBLElBQUksRUFBRSxTQUREO0FBRUwsSUFBQSxVQUFVLEVBQUUsb0JBQUUsSUFBRixDQUFPLE1BQVAsQ0FBYyxFQUFkLEVBQWtCLE9BQU8sQ0FBQyxVQUExQixFQUFzQztBQUNoRCxNQUFBLGVBQWUsRUFBRSxDQUFDLFFBQUQsRUFBVyxZQUFYLEVBQXlCLE9BQXpCLEVBQWtDLFNBQWxDO0FBRCtCLEtBQXRDLENBRlA7QUFLTCxJQUFBLElBQUksRUFBRSxPQUFPLENBQUMsSUFMVDtBQU1MLElBQUEsUUFBUSxFQUFFO0FBQ1IsTUFBQSxJQUFJLEVBQUUsb0JBREU7QUFFUixNQUFBLFVBQVUsRUFBRTtBQUZKO0FBTkwsR0FBUDtBQVdEOztBQUVELGFBQWEsQ0FBQyxvQkFBZCxHQUFxQyxvQkFBckM7QUFFQSxvQkFBRSxtQkFBRixHQUF3QixhQUF4Qjs7QUFDQSxvQkFBRSxtQkFBRixHQUF3QixVQUFDLE1BQUQsRUFBUyxPQUFULEVBQWtCLE9BQWxCLEVBQThCO0FBQ3BELFNBQU8sSUFBSSxhQUFKLENBQWtCLE1BQWxCLEVBQTBCLE9BQTFCLEVBQW1DLE9BQW5DLENBQVA7QUFDRCxDQUZEOztlQUllLGEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKipcbiAqIExlYWZsZXQgU1ZHIGNpcmNsZSBtYXJrZXIgd2l0aCBkZXRhY2hhYmxlIGFuZCBkcmFnZ2FibGUgbGFiZWwgYW5kIHRleHRcbiAqXG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBsaWNlbnNlIE1JVFxuICogQHByZXNlcnZlXG4gKi9cbmltcG9ydCBNYXJrZXIgZnJvbSAnLi9zcmMvbWFya2VyJztcbmV4cG9ydCBkZWZhdWx0IE1hcmtlcjtcbiIsInJlcXVpcmUoJy4vc3JjL1NWRycpO1xucmVxdWlyZSgnLi9zcmMvU1ZHLlZNTCcpO1xucmVxdWlyZSgnLi9zcmMvQ2FudmFzJyk7XG5yZXF1aXJlKCcuL3NyYy9QYXRoLlRyYW5zZm9ybScpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5EcmFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5QYXRoLkRyYWc7XG4iLCJmdW5jdGlvbiBUUlVFX0ZOICgpIHsgcmV0dXJuIHRydWU7IH1cblxuTC5DYW52YXMuaW5jbHVkZSh7XG5cbiAgLyoqXG4gICAqIERvIG5vdGhpbmdcbiAgICogQHBhcmFtICB7TC5QYXRofSBsYXllclxuICAgKi9cbiAgX3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBpZiAoIXRoaXMuX2NvbnRhaW5lckNvcHkpIHJldHVybjtcblxuICAgIGRlbGV0ZSB0aGlzLl9jb250YWluZXJDb3B5O1xuXG4gICAgaWYgKGxheWVyLl9jb250YWluc1BvaW50Xykge1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnQgPSBsYXllci5fY29udGFpbnNQb2ludF87XG4gICAgICBkZWxldGUgbGF5ZXIuX2NvbnRhaW5zUG9pbnRfO1xuXG4gICAgICB0aGlzLl9yZXF1ZXN0UmVkcmF3KGxheWVyKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQWxnb3JpdGhtIG91dGxpbmU6XG4gICAqXG4gICAqIDEuIHByZS10cmFuc2Zvcm0gLSBjbGVhciB0aGUgcGF0aCBvdXQgb2YgdGhlIGNhbnZhcywgY29weSBjYW52YXMgc3RhdGVcbiAgICogMi4gYXQgZXZlcnkgZnJhbWU6XG4gICAqICAgIDIuMS4gc2F2ZVxuICAgKiAgICAyLjIuIHJlZHJhdyB0aGUgY2FudmFzIGZyb20gc2F2ZWQgb25lXG4gICAqICAgIDIuMy4gdHJhbnNmb3JtXG4gICAqICAgIDIuNC4gZHJhdyBwYXRoXG4gICAqICAgIDIuNS4gcmVzdG9yZVxuICAgKiAzLiBSZXBlYXRcbiAgICpcbiAgICogQHBhcmFtICB7TC5QYXRofSAgICAgICAgIGxheWVyXG4gICAqIEBwYXJhbSAge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcbiAgICovXG4gIHRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyLCBtYXRyaXgpIHtcbiAgICB2YXIgY29weSAgID0gdGhpcy5fY29udGFpbmVyQ29weTtcbiAgICB2YXIgY3R4ICAgID0gdGhpcy5fY3R4LCBjb3B5Q3R4O1xuICAgIHZhciBtICAgICAgPSBMLkJyb3dzZXIucmV0aW5hID8gMiA6IDE7XG4gICAgdmFyIGJvdW5kcyA9IHRoaXMuX2JvdW5kcztcbiAgICB2YXIgc2l6ZSAgID0gYm91bmRzLmdldFNpemUoKTtcbiAgICB2YXIgcG9zICAgID0gYm91bmRzLm1pbjtcblxuICAgIGlmICghY29weSkgeyAvLyBnZXQgY29weSBvZiBhbGwgcmVuZGVyZWQgbGF5ZXJzXG4gICAgICBjb3B5ID0gdGhpcy5fY29udGFpbmVyQ29weSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgY29weUN0eCA9IGNvcHkuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgIC8vIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY29weSk7XG5cbiAgICAgIGNvcHkud2lkdGggID0gbSAqIHNpemUueDtcbiAgICAgIGNvcHkuaGVpZ2h0ID0gbSAqIHNpemUueTtcblxuICAgICAgdGhpcy5fcmVtb3ZlUGF0aChsYXllcik7XG4gICAgICB0aGlzLl9yZWRyYXcoKTtcblxuICAgICAgY29weUN0eC50cmFuc2xhdGUobSAqIGJvdW5kcy5taW4ueCwgbSAqIGJvdW5kcy5taW4ueSk7XG4gICAgICBjb3B5Q3R4LmRyYXdJbWFnZSh0aGlzLl9jb250YWluZXIsIDAsIDApO1xuICAgICAgdGhpcy5faW5pdFBhdGgobGF5ZXIpO1xuXG4gICAgICAvLyBhdm9pZCBmbGlja2VyaW5nIGJlY2F1c2Ugb2YgdGhlICdtb3VzZW92ZXInc1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnRfID0gbGF5ZXIuX2NvbnRhaW5zUG9pbnQ7XG4gICAgICBsYXllci5fY29udGFpbnNQb2ludCAgPSBUUlVFX0ZOO1xuICAgIH1cblxuICAgIGN0eC5zYXZlKCk7XG4gICAgY3R4LmNsZWFyUmVjdChwb3MueCwgcG9zLnksIHNpemUueCAqIG0sIHNpemUueSAqIG0pO1xuICAgIGN0eC5zZXRUcmFuc2Zvcm0oMSwgMCwgMCwgMSwgMCwgMCk7XG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgICBjdHguc2F2ZSgpO1xuXG4gICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9jb250YWluZXJDb3B5LCAwLCAwLCBzaXplLngsIHNpemUueSk7XG4gICAgY3R4LnRyYW5zZm9ybS5hcHBseShjdHgsIG1hdHJpeCk7XG5cbiAgICAvLyBub3cgZHJhdyBvbmUgbGF5ZXIgb25seVxuICAgIHRoaXMuX2RyYXdpbmcgPSB0cnVlO1xuICAgIGxheWVyLl91cGRhdGVQYXRoKCk7XG4gICAgdGhpcy5fZHJhd2luZyA9IGZhbHNlO1xuXG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgfVxuXG59KTtcbiIsInZhciBFTkQgPSB7XG4gIG1vdXNlZG93bjogICAgICdtb3VzZXVwJyxcbiAgdG91Y2hzdGFydDogICAgJ3RvdWNoZW5kJyxcbiAgcG9pbnRlcmRvd246ICAgJ3RvdWNoZW5kJyxcbiAgTVNQb2ludGVyRG93bjogJ3RvdWNoZW5kJ1xufTtcblxudmFyIE1PVkUgPSB7XG4gIG1vdXNlZG93bjogICAgICdtb3VzZW1vdmUnLFxuICB0b3VjaHN0YXJ0OiAgICAndG91Y2htb3ZlJyxcbiAgcG9pbnRlcmRvd246ICAgJ3RvdWNobW92ZScsXG4gIE1TUG9pbnRlckRvd246ICd0b3VjaG1vdmUnXG59O1xuXG5mdW5jdGlvbiBkaXN0YW5jZShhLCBiKSB7XG4gIHZhciBkeCA9IGEueCAtIGIueCwgZHkgPSBhLnkgLSBiLnk7XG4gIHJldHVybiBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xufVxuXG4vKipcbiAqIERyYWcgaGFuZGxlclxuICogQGNsYXNzIEwuUGF0aC5EcmFnXG4gKiBAZXh0ZW5kcyB7TC5IYW5kbGVyfVxuICovXG5MLkhhbmRsZXIuUGF0aERyYWcgPSBMLkhhbmRsZXIuZXh0ZW5kKCAvKiogQGxlbmRzICBMLlBhdGguRHJhZy5wcm90b3R5cGUgKi8ge1xuXG4gIHN0YXRpY3M6IHtcbiAgICBEUkFHR0lOR19DTFM6ICdsZWFmbGV0LXBhdGgtZHJhZ2dhYmxlJyxcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBhdGh9IHBhdGhcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihwYXRoKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5QYXRofVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGggPSBwYXRoO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0FycmF5LjxOdW1iZXI+fVxuICAgICAqL1xuICAgIHRoaXMuX21hdHJpeCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IGZhbHNlO1xuXG4gIH0sXG5cbiAgLyoqXG4gICAqIEVuYWJsZSBkcmFnZ2luZ1xuICAgKi9cbiAgYWRkSG9va3M6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGgub24oJ21vdXNlZG93bicsIHRoaXMuX29uRHJhZ1N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgPSB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID9cbiAgICAgICAgKHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgKyAnICcgKyBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKSA6XG4gICAgICAgICBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX3BhdGgpIHtcbiAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoLl9wYXRoLCBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIERpc2FibGUgZHJhZ2dpbmdcbiAgICovXG4gIHJlbW92ZUhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoLm9mZignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA9IHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWVcbiAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoJ1xcXFxzKycgKyBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKSwgJycpO1xuICAgIGlmICh0aGlzLl9wYXRoLl9wYXRoKSB7XG4gICAgICBMLkRvbVV0aWwucmVtb3ZlQ2xhc3ModGhpcy5fcGF0aC5fcGF0aCwgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgbW92ZWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXRoLl9kcmFnTW92ZWQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFN0YXJ0IGRyYWdcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWdTdGFydDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGV2ZW50VHlwZSA9IGV2dC5vcmlnaW5hbEV2ZW50Ll9zaW11bGF0ZWQgPyAndG91Y2hzdGFydCcgOiBldnQub3JpZ2luYWxFdmVudC50eXBlO1xuXG4gICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gZmFsc2U7XG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IGV2dC5jb250YWluZXJQb2ludC5jbG9uZSgpO1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gZXZ0LmNvbnRhaW5lclBvaW50LmNsb25lKCk7XG4gICAgdGhpcy5fbWF0cml4ID0gWzEsIDAsIDAsIDEsIDAsIDBdO1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQub3JpZ2luYWxFdmVudCk7XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aC5fcmVuZGVyZXIuX2NvbnRhaW5lciwgJ2xlYWZsZXQtaW50ZXJhY3RpdmUnKTtcbiAgICBMLkRvbUV2ZW50XG4gICAgICAub24oZG9jdW1lbnQsIE1PVkVbZXZlbnRUeXBlXSwgdGhpcy5fb25EcmFnLCAgICB0aGlzKVxuICAgICAgLm9uKGRvY3VtZW50LCBFTkRbZXZlbnRUeXBlXSwgIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fbWFwLmRyYWdnaW5nLmVuYWJsZWQoKSkge1xuICAgICAgLy8gSSBndWVzcyBpdCdzIHJlcXVpcmVkIGJlY2F1c2UgbW91c2Rvd24gZ2V0cyBzaW11bGF0ZWQgd2l0aCBhIGRlbGF5XG4gICAgICAvL3RoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlLl9vblVwKGV2dCk7XG5cbiAgICAgIHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5kaXNhYmxlKCk7XG4gICAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLl9wYXRoLl9wb3B1cCkgeyAvLyB0aGF0IG1pZ2h0IGJlIGEgY2FzZSBvbiB0b3VjaCBkZXZpY2VzIGFzIHdlbGxcbiAgICAgIHRoaXMuX3BhdGguX3BvcHVwLl9jbG9zZSgpO1xuICAgIH1cblxuICAgIHRoaXMuX3JlcGxhY2VDb29yZEdldHRlcnMoZXZ0KTtcbiAgfSxcblxuICAvKipcbiAgICogRHJhZ2dpbmdcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQpO1xuXG4gICAgdmFyIGZpcnN0ID0gKGV2dC50b3VjaGVzICYmIGV2dC50b3VjaGVzLmxlbmd0aCA+PSAxID8gZXZ0LnRvdWNoZXNbMF0gOiBldnQpO1xuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX3BhdGguX21hcC5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChmaXJzdCk7XG5cbiAgICAvLyBza2lwIHRhcHNcbiAgICBpZiAoZXZ0LnR5cGUgPT09ICd0b3VjaG1vdmUnICYmICF0aGlzLl9wYXRoLl9kcmFnTW92ZWQpIHtcbiAgICAgIHZhciB0b3RhbE1vdXNlRHJhZ0Rpc3RhbmNlID0gdGhpcy5fZHJhZ1N0YXJ0UG9pbnQuZGlzdGFuY2VUbyhjb250YWluZXJQb2ludCk7XG4gICAgICBpZiAodG90YWxNb3VzZURyYWdEaXN0YW5jZSA8PSB0aGlzLl9wYXRoLl9tYXAub3B0aW9ucy50YXBUb2xlcmFuY2UpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB4ID0gY29udGFpbmVyUG9pbnQueDtcbiAgICB2YXIgeSA9IGNvbnRhaW5lclBvaW50Lnk7XG5cbiAgICB2YXIgZHggPSB4IC0gdGhpcy5fc3RhcnRQb2ludC54O1xuICAgIHZhciBkeSA9IHkgLSB0aGlzLl9zdGFydFBvaW50Lnk7XG5cbiAgICAvLyBTZW5kIGV2ZW50cyBvbmx5IGlmIHBvaW50IHdhcyBtb3ZlZFxuICAgIGlmIChkeCB8fCBkeSkge1xuICAgICAgaWYgKCF0aGlzLl9wYXRoLl9kcmFnTW92ZWQpIHtcbiAgICAgICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnc3RhcnQnLCBldnQpO1xuICAgICAgICAvLyB3ZSBkb24ndCB3YW50IHRoYXQgdG8gaGFwcGVuIG9uIGNsaWNrXG4gICAgICAgIHRoaXMuX3BhdGguYnJpbmdUb0Zyb250KCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX21hdHJpeFs0XSArPSBkeDtcbiAgICAgIHRoaXMuX21hdHJpeFs1XSArPSBkeTtcblxuICAgICAgdGhpcy5fc3RhcnRQb2ludC54ID0geDtcbiAgICAgIHRoaXMuX3N0YXJ0UG9pbnQueSA9IHk7XG5cbiAgICAgIHRoaXMuX3BhdGguZmlyZSgncHJlZHJhZycsIGV2dCk7XG4gICAgICB0aGlzLl9wYXRoLl90cmFuc2Zvcm0odGhpcy5fbWF0cml4KTtcbiAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZycsIGV2dCk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBEcmFnZ2luZyBzdG9wcGVkLCBhcHBseVxuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNvbnRhaW5lclBvaW50ID0gdGhpcy5fcGF0aC5fbWFwLm1vdXNlRXZlbnRUb0NvbnRhaW5lclBvaW50KGV2dCk7XG4gICAgdmFyIG1vdmVkID0gdGhpcy5tb3ZlZCgpO1xuXG4gICAgLy8gYXBwbHkgbWF0cml4XG4gICAgaWYgKG1vdmVkKSB7XG4gICAgICB0aGlzLl90cmFuc2Zvcm1Qb2ludHModGhpcy5fbWF0cml4KTtcbiAgICAgIHRoaXMuX3BhdGguX3VwZGF0ZVBhdGgoKTtcbiAgICAgIHRoaXMuX3BhdGguX3Byb2plY3QoKTtcbiAgICAgIHRoaXMuX3BhdGguX3RyYW5zZm9ybShudWxsKTtcblxuICAgICAgTC5Eb21FdmVudC5zdG9wKGV2dCk7XG4gICAgfVxuXG5cbiAgICBMLkRvbUV2ZW50Lm9mZihkb2N1bWVudCwgJ21vdXNlbW92ZSB0b3VjaG1vdmUnLCB0aGlzLl9vbkRyYWcsICAgIHRoaXMpO1xuICAgIEwuRG9tRXZlbnQub2ZmKGRvY3VtZW50LCAnbW91c2V1cCB0b3VjaGVuZCcsICAgIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG5cbiAgICB0aGlzLl9yZXN0b3JlQ29vcmRHZXR0ZXJzKCk7XG5cbiAgICAvLyBjb25zaXN0ZW5jeVxuICAgIGlmIChtb3ZlZCkge1xuICAgICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnZW5kJywge1xuICAgICAgICBkaXN0YW5jZTogZGlzdGFuY2UodGhpcy5fZHJhZ1N0YXJ0UG9pbnQsIGNvbnRhaW5lclBvaW50KVxuICAgICAgfSk7XG5cbiAgICAgIC8vIGhhY2sgZm9yIHNraXBwaW5nIHRoZSBjbGljayBpbiBjYW52YXMtcmVuZGVyZWQgbGF5ZXJzXG4gICAgICB2YXIgY29udGFpbnMgPSB0aGlzLl9wYXRoLl9jb250YWluc1BvaW50O1xuICAgICAgdGhpcy5fcGF0aC5fY29udGFpbnNQb2ludCA9IEwuVXRpbC5mYWxzZUZuO1xuICAgICAgTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgICAgIEwuRG9tRXZlbnQuc2tpcHBlZCh7IHR5cGU6ICdjbGljaycgfSk7XG4gICAgICAgIHRoaXMuX3BhdGguX2NvbnRhaW5zUG9pbnQgPSBjb250YWlucztcbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuX21hdHJpeCAgICAgICAgICA9IG51bGw7XG4gICAgdGhpcy5fc3RhcnRQb2ludCAgICAgID0gbnVsbDtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCAgPSBudWxsO1xuICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCkge1xuICAgICAgaWYgKG1vdmVkKSBMLkRvbUV2ZW50LmZha2VTdG9wKHsgdHlwZTogJ2NsaWNrJyB9KTtcbiAgICAgIHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQXBwbGllcyB0cmFuc2Zvcm1hdGlvbiwgZG9lcyBpdCBpbiBvbmUgc3dlZXAgZm9yIHBlcmZvcm1hbmNlLFxuICAgKiBzbyBkb24ndCBiZSBzdXJwcmlzZWQgYWJvdXQgdGhlIGNvZGUgcmVwZXRpdGlvbi5cbiAgICpcbiAgICogWyB4IF0gICBbIGEgIGIgIHR4IF0gWyB4IF0gICBbIGEgKiB4ICsgYiAqIHkgKyB0eCBdXG4gICAqIFsgeSBdID0gWyBjICBkICB0eSBdIFsgeSBdID0gWyBjICogeCArIGQgKiB5ICsgdHkgXVxuICAgKlxuICAgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcbiAgICovXG4gIF90cmFuc2Zvcm1Qb2ludHM6IGZ1bmN0aW9uKG1hdHJpeCwgZGVzdCkge1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aDtcbiAgICB2YXIgaSwgbGVuLCBsYXRsbmc7XG5cbiAgICB2YXIgcHggPSBMLnBvaW50KG1hdHJpeFs0XSwgbWF0cml4WzVdKTtcblxuICAgIHZhciBjcnMgPSBwYXRoLl9tYXAub3B0aW9ucy5jcnM7XG4gICAgdmFyIHRyYW5zZm9ybWF0aW9uID0gY3JzLnRyYW5zZm9ybWF0aW9uO1xuICAgIHZhciBzY2FsZSA9IGNycy5zY2FsZShwYXRoLl9tYXAuZ2V0Wm9vbSgpKTtcbiAgICB2YXIgcHJvamVjdGlvbiA9IGNycy5wcm9qZWN0aW9uO1xuXG4gICAgdmFyIGRpZmYgPSB0cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShweCwgc2NhbGUpXG4gICAgICAuc3VidHJhY3QodHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0oTC5wb2ludCgwLCAwKSwgc2NhbGUpKTtcbiAgICB2YXIgYXBwbHlUcmFuc2Zvcm0gPSAhZGVzdDtcblxuICAgIHBhdGguX2JvdW5kcyA9IG5ldyBMLkxhdExuZ0JvdW5kcygpO1xuXG4gICAgLy8gY29uc29sZS50aW1lKCd0cmFuc2Zvcm0nKTtcbiAgICAvLyBhbGwgc2hpZnRzIGFyZSBpbi1wbGFjZVxuICAgIGlmIChwYXRoLl9wb2ludCkgeyAvLyBMLkNpcmNsZVxuICAgICAgZGVzdCA9IHByb2plY3Rpb24udW5wcm9qZWN0KFxuICAgICAgICBwcm9qZWN0aW9uLnByb2plY3QocGF0aC5fbGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgIGlmIChhcHBseVRyYW5zZm9ybSkge1xuICAgICAgICBwYXRoLl9sYXRsbmcgPSBkZXN0O1xuICAgICAgICBwYXRoLl9wb2ludC5fYWRkKHB4KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHBhdGguX3JpbmdzIHx8IHBhdGguX3BhcnRzKSB7IC8vIGV2ZXJ5dGhpbmcgZWxzZVxuICAgICAgdmFyIHJpbmdzICAgPSBwYXRoLl9yaW5ncyB8fCBwYXRoLl9wYXJ0cztcbiAgICAgIHZhciBsYXRsbmdzID0gcGF0aC5fbGF0bG5ncztcbiAgICAgIGRlc3QgPSBkZXN0IHx8IGxhdGxuZ3M7XG4gICAgICBpZiAoIUwuVXRpbC5pc0FycmF5KGxhdGxuZ3NbMF0pKSB7IC8vIHBvbHlsaW5lXG4gICAgICAgIGxhdGxuZ3MgPSBbbGF0bG5nc107XG4gICAgICAgIGRlc3QgICAgPSBbZGVzdF07XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSByaW5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBkZXN0W2ldID0gZGVzdFtpXSB8fCBbXTtcbiAgICAgICAgZm9yICh2YXIgaiA9IDAsIGpqID0gcmluZ3NbaV0ubGVuZ3RoOyBqIDwgamo7IGorKykge1xuICAgICAgICAgIGxhdGxuZyAgICAgPSBsYXRsbmdzW2ldW2pdO1xuICAgICAgICAgIGRlc3RbaV1bal0gPSBwcm9qZWN0aW9uXG4gICAgICAgICAgICAudW5wcm9qZWN0KHByb2plY3Rpb24ucHJvamVjdChsYXRsbmcpLl9hZGQoZGlmZikpO1xuICAgICAgICAgIGlmIChhcHBseVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgcGF0aC5fYm91bmRzLmV4dGVuZChsYXRsbmdzW2ldW2pdKTtcbiAgICAgICAgICAgIHJpbmdzW2ldW2pdLl9hZGQocHgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVzdDtcbiAgICAvLyBjb25zb2xlLnRpbWVFbmQoJ3RyYW5zZm9ybScpO1xuICB9LFxuXG5cblxuICAvKipcbiAgICogSWYgeW91IHdhbnQgdG8gcmVhZCB0aGUgbGF0bG5ncyBkdXJpbmcgdGhlIGRyYWcgLSB5b3VyIHJpZ2h0LFxuICAgKiBidXQgdGhleSBoYXZlIHRvIGJlIHRyYW5zZm9ybWVkXG4gICAqL1xuICBfcmVwbGFjZUNvb3JkR2V0dGVyczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nKSB7IC8vIENpcmNsZSwgQ2lyY2xlTWFya2VyXG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ18gPSB0aGlzLl9wYXRoLmdldExhdExuZztcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nID0gTC5VdGlsLmJpbmQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRyYWdnaW5nLl90cmFuc2Zvcm1Qb2ludHModGhpcy5kcmFnZ2luZy5fbWF0cml4LCB7fSk7XG4gICAgICB9LCB0aGlzLl9wYXRoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5ncykge1xuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdzXyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5ncztcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5ncyA9IEwuVXRpbC5iaW5kKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuZHJhZ2dpbmcuX21hdHJpeCwgW10pO1xuICAgICAgfSwgdGhpcy5fcGF0aCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFB1dCBiYWNrIHRoZSBnZXR0ZXJzXG4gICAqL1xuICBfcmVzdG9yZUNvb3JkR2V0dGVyczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nXykge1xuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmcgPSB0aGlzLl9wYXRoLmdldExhdExuZ187XG4gICAgICBkZWxldGUgdGhpcy5fcGF0aC5nZXRMYXRMbmdfO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGF0aC5nZXRMYXRMbmdzXykge1xuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdzID0gdGhpcy5fcGF0aC5nZXRMYXRMbmdzXztcbiAgICAgIGRlbGV0ZSB0aGlzLl9wYXRoLmdldExhdExuZ3NfO1xuICAgIH1cbiAgfVxuXG59KTtcblxuXG4vKipcbiAqIEBwYXJhbSAge0wuUGF0aH0gbGF5ZXJcbiAqIEByZXR1cm4ge0wuUGF0aH1cbiAqL1xuTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUgPSBmdW5jdGlvbihsYXllcikge1xuICBsYXllci5kcmFnZ2luZyA9IG5ldyBMLkhhbmRsZXIuUGF0aERyYWcobGF5ZXIpO1xuICByZXR1cm4gbGF5ZXI7XG59O1xuXG5cbi8qKlxuICogQWxzbyBleHBvc2UgYXMgYSBtZXRob2RcbiAqIEByZXR1cm4ge0wuUGF0aH1cbiAqL1xuTC5QYXRoLnByb3RvdHlwZS5tYWtlRHJhZ2dhYmxlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBMLkhhbmRsZXIuUGF0aERyYWcubWFrZURyYWdnYWJsZSh0aGlzKTtcbn07XG5cblxuTC5QYXRoLmFkZEluaXRIb29rKGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5vcHRpb25zLmRyYWdnYWJsZSkge1xuICAgIC8vIGVuc3VyZSBpbnRlcmFjdGl2ZVxuICAgIHRoaXMub3B0aW9ucy5pbnRlcmFjdGl2ZSA9IHRydWU7XG5cbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUodGhpcyk7XG4gICAgICB0aGlzLmRyYWdnaW5nLmVuYWJsZSgpO1xuICAgIH1cbiAgfSBlbHNlIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgdGhpcy5kcmFnZ2luZy5kaXNhYmxlKCk7XG4gIH1cbn0pO1xuIiwiLyoqXG4gKiBMZWFmbGV0IHZlY3RvciBmZWF0dXJlcyBkcmFnIGZ1bmN0aW9uYWxpdHlcbiAqIEBhdXRob3IgQWxleGFuZGVyIE1pbGV2c2tpIDxpbmZvQHc4ci5uYW1lPlxuICogQHByZXNlcnZlXG4gKi9cblxuLyoqXG4gKiBNYXRyaXggdHJhbnNmb3JtIHBhdGggZm9yIFNWRy9WTUxcbiAqIFJlbmRlcmVyLWluZGVwZW5kZW50XG4gKi9cbkwuUGF0aC5pbmNsdWRlKHtcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gU1ZHXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj4/fSBtYXRyaXhcblx0ICovXG5cdF90cmFuc2Zvcm06IGZ1bmN0aW9uKG1hdHJpeCkge1xuXHRcdGlmICh0aGlzLl9yZW5kZXJlcikge1xuXHRcdFx0aWYgKG1hdHJpeCkge1xuXHRcdFx0XHR0aGlzLl9yZW5kZXJlci50cmFuc2Zvcm1QYXRoKHRoaXMsIG1hdHJpeCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyByZXNldCB0cmFuc2Zvcm0gbWF0cml4XG5cdFx0XHRcdHRoaXMuX3JlbmRlcmVyLl9yZXNldFRyYW5zZm9ybVBhdGgodGhpcyk7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdGhlIGZlYXR1cmUgd2FzIGRyYWdnZWQsIHRoYXQnbGwgc3VwcmVzcyB0aGUgY2xpY2sgZXZlbnRcblx0ICogb24gbW91c2V1cC4gVGhhdCBmaXhlcyBwb3B1cHMgZm9yIGV4YW1wbGVcblx0ICpcblx0ICogQHBhcmFtICB7TW91c2VFdmVudH0gZVxuXHQgKi9cblx0X29uTW91c2VDbGljazogZnVuY3Rpb24oZSkge1xuXHRcdGlmICgodGhpcy5kcmFnZ2luZyAmJiB0aGlzLmRyYWdnaW5nLm1vdmVkKCkpIHx8XG5cdFx0XHQodGhpcy5fbWFwLmRyYWdnaW5nICYmIHRoaXMuX21hcC5kcmFnZ2luZy5tb3ZlZCgpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2ZpcmVNb3VzZUV2ZW50KGUpO1xuXHR9XG5cbn0pO1xuIiwiTC5TVkcuaW5jbHVkZSghTC5Ccm93c2VyLnZtbCA/IHt9IDoge1xuXG5cdC8qKlxuXHQgKiBSZXNldCB0cmFuc2Zvcm0gbWF0cml4XG5cdCAqL1xuXHRfcmVzZXRUcmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllcikge1xuXHRcdGlmIChsYXllci5fc2tldykge1xuXHRcdFx0Ly8gc3VwZXIgaW1wb3J0YW50ISB3b3JrYXJvdW5kIGZvciBhICdqdW1waW5nJyBnbGl0Y2g6XG5cdFx0XHQvLyBkaXNhYmxlIHRyYW5zZm9ybSBiZWZvcmUgcmVtb3ZpbmcgaXRcblx0XHRcdGxheWVyLl9za2V3Lm9uID0gZmFsc2U7XG5cdFx0XHRsYXllci5fcGF0aC5yZW1vdmVDaGlsZChsYXllci5fc2tldyk7XG5cdFx0XHRsYXllci5fc2tldyA9IG51bGw7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBWTUxcblx0ICogQHBhcmFtIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG5cdCAqL1xuXHR0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG5cdFx0dmFyIHNrZXcgPSBsYXllci5fc2tldztcblxuXHRcdGlmICghc2tldykge1xuXHRcdFx0c2tldyA9IEwuU1ZHLmNyZWF0ZSgnc2tldycpO1xuXHRcdFx0bGF5ZXIuX3BhdGguYXBwZW5kQ2hpbGQoc2tldyk7XG5cdFx0XHRza2V3LnN0eWxlLmJlaGF2aW9yID0gJ3VybCgjZGVmYXVsdCNWTUwpJztcblx0XHRcdGxheWVyLl9za2V3ID0gc2tldztcblx0XHR9XG5cblx0XHQvLyBoYW5kbGUgc2tldy90cmFuc2xhdGUgc2VwYXJhdGVseSwgY2F1c2UgaXQncyBicm9rZW5cblx0XHR2YXIgbXQgPSBtYXRyaXhbMF0udG9GaXhlZCg4KSArICcgJyArIG1hdHJpeFsxXS50b0ZpeGVkKDgpICsgJyAnICtcblx0XHRcdG1hdHJpeFsyXS50b0ZpeGVkKDgpICsgJyAnICsgbWF0cml4WzNdLnRvRml4ZWQoOCkgKyAnIDAgMCc7XG5cdFx0dmFyIG9mZnNldCA9IE1hdGguZmxvb3IobWF0cml4WzRdKS50b0ZpeGVkKCkgKyAnLCAnICtcblx0XHRcdE1hdGguZmxvb3IobWF0cml4WzVdKS50b0ZpeGVkKCkgKyAnJztcblxuXHRcdHZhciBzID0gdGhpcy5fcGF0aC5zdHlsZTtcblx0XHR2YXIgbCA9IHBhcnNlRmxvYXQocy5sZWZ0KTtcblx0XHR2YXIgdCA9IHBhcnNlRmxvYXQocy50b3ApO1xuXHRcdHZhciB3ID0gcGFyc2VGbG9hdChzLndpZHRoKTtcblx0XHR2YXIgaCA9IHBhcnNlRmxvYXQocy5oZWlnaHQpO1xuXG5cdFx0aWYgKGlzTmFOKGwpKSAgICAgICBsID0gMDtcblx0XHRpZiAoaXNOYU4odCkpICAgICAgIHQgPSAwO1xuXHRcdGlmIChpc05hTih3KSB8fCAhdykgdyA9IDE7XG5cdFx0aWYgKGlzTmFOKGgpIHx8ICFoKSBoID0gMTtcblxuXHRcdHZhciBvcmlnaW4gPSAoLWwgLyB3IC0gMC41KS50b0ZpeGVkKDgpICsgJyAnICsgKC10IC8gaCAtIDAuNSkudG9GaXhlZCg4KTtcblxuXHRcdHNrZXcub24gPSAnZic7XG5cdFx0c2tldy5tYXRyaXggPSBtdDtcblx0XHRza2V3Lm9yaWdpbiA9IG9yaWdpbjtcblx0XHRza2V3Lm9mZnNldCA9IG9mZnNldDtcblx0XHRza2V3Lm9uID0gdHJ1ZTtcblx0fVxuXG59KTtcbiIsIkwuU1ZHLmluY2x1ZGUoe1xuXG5cdC8qKlxuXHQgKiBSZXNldCB0cmFuc2Zvcm0gbWF0cml4XG5cdCAqL1xuXHRfcmVzZXRUcmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllcikge1xuXHRcdGxheWVyLl9wYXRoLnNldEF0dHJpYnV0ZU5TKG51bGwsICd0cmFuc2Zvcm0nLCAnJyk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFwcGxpZXMgbWF0cml4IHRyYW5zZm9ybWF0aW9uIHRvIFNWR1xuXHQgKiBAcGFyYW0ge0wuUGF0aH0gICAgICAgICBsYXllclxuXHQgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcblx0ICovXG5cdHRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyLCBtYXRyaXgpIHtcblx0XHRsYXllci5fcGF0aC5zZXRBdHRyaWJ1dGVOUyhudWxsLCAndHJhbnNmb3JtJyxcblx0XHRcdCdtYXRyaXgoJyArIG1hdHJpeC5qb2luKCcgJykgKyAnKScpO1xuXHR9XG5cbn0pO1xuIiwiaW1wb3J0IEwgZnJvbSAnbGVhZmxldCc7XG5cbmV4cG9ydCBjb25zdCBDaXJjbGUgPSBMLkNpcmNsZU1hcmtlci5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICB0ZXh0U3R5bGU6IHtcbiAgICAgIGNvbG9yOiAnI2ZmZicsXG4gICAgICBmb250U2l6ZTogMTIsXG4gICAgICBmb250V2VpZ2h0OiAzMDBcbiAgICB9LFxuICAgIHNoaWZ0WTogNyxcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY2xhc3MgTGFiZWxlZENpcmNsZVxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQGV4dGVuZHMge0wuQ2lyY2xlTWFya2VyfVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgdGV4dFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gbGF0bG5nXG4gICAqIEBwYXJhbSAge09iamVjdD19ICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplKHRleHQsIGxhdGxuZywgb3B0aW9ucykge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fdGV4dCAgICAgICAgPSB0ZXh0O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NWR1RleHRFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX3RleHRFbGVtZW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtUZXh0Tm9kZX1cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0Tm9kZSAgICA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0fE51bGx9XG4gICAgICovXG4gICAgdGhpcy5fdGV4dExheWVyICAgPSBudWxsO1xuXG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge0xhYmVsZWRDaXJjbGV9XG4gICAqL1xuICBzZXRUZXh0KHRleHQpIHtcbiAgICB0aGlzLl90ZXh0ID0gdGV4dDtcbiAgICBpZiAodGhpcy5fdGV4dE5vZGUpIHtcbiAgICAgIHRoaXMuX3RleHRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMuX3RleHROb2RlKTtcbiAgICB9XG4gICAgdGhpcy5fdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0aGlzLl90ZXh0KTtcbiAgICB0aGlzLl90ZXh0RWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl90ZXh0Tm9kZSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAqL1xuICBnZXRUZXh0KCkge1xuICAgIHJldHVybiB0aGlzLl90ZXh0O1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFsc28gYnJpbmcgdGV4dCB0byBmcm9udFxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIGJyaW5nVG9Gcm9udCgpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuYnJpbmdUb0Zyb250LmNhbGwodGhpcyk7XG4gICAgdGhpcy5fZ3JvdXBUZXh0VG9QYXRoKCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQG92ZXJyaWRlXG4gICAqL1xuICBicmluZ1RvQmFjaygpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuYnJpbmdUb0JhY2suY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgdGV4dCBpbiB0aGUgcmlnaHQgcG9zaXRpb24gaW4gdGhlIGRvbVxuICAgKi9cbiAgX2dyb3VwVGV4dFRvUGF0aCgpIHtcbiAgICBjb25zdCBwYXRoICAgICAgICA9IHRoaXMuX3BhdGg7XG4gICAgY29uc3QgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICBjb25zdCBuZXh0ICAgICAgICA9IHBhdGgubmV4dFNpYmxpbmc7XG4gICAgY29uc3QgcGFyZW50ICAgICAgPSBwYXRoLnBhcmVudE5vZGU7XG5cblxuICAgIGlmICh0ZXh0RWxlbWVudCAmJiBwYXJlbnQpIHtcbiAgICAgIGlmIChuZXh0ICYmIG5leHQgIT09IHRleHRFbGVtZW50KSB7XG4gICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUodGV4dEVsZW1lbnQsIG5leHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFyZW50LmFwcGVuZENoaWxkKHRleHRFbGVtZW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogUG9zaXRpb24gdGhlIHRleHQgaW4gY29udGFpbmVyXG4gICAqL1xuICBfdXBkYXRlUGF0aCgpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuX3VwZGF0ZVBhdGguY2FsbCh0aGlzKTtcbiAgICB0aGlzLl91cGRhdGVUZXh0UG9zaXRpb24oKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIF90cmFuc2Zvcm0obWF0cml4KSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLl90cmFuc2Zvcm0uY2FsbCh0aGlzLCBtYXRyaXgpO1xuXG4gICAgLy8gd3JhcCB0ZXh0RWxlbWVudCB3aXRoIGEgZmFrZSBsYXllciBmb3IgcmVuZGVyZXJcbiAgICAvLyB0byBiZSBhYmxlIHRvIHRyYW5zZm9ybSBpdFxuICAgIHRoaXMuX3RleHRMYXllciA9IHRoaXMuX3RleHRMYXllciB8fCB7IF9wYXRoOiB0aGlzLl90ZXh0RWxlbWVudCB9O1xuICAgIGlmIChtYXRyaXgpIHtcbiAgICAgIHRoaXMuX3JlbmRlcmVyLnRyYW5zZm9ybVBhdGgodGhpcy5fdGV4dExheWVyLCBtYXRyaXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9yZW5kZXJlci5fcmVzZXRUcmFuc2Zvcm1QYXRoKHRoaXMuX3RleHRMYXllcik7XG4gICAgICB0aGlzLl91cGRhdGVUZXh0UG9zaXRpb24oKTtcbiAgICAgIHRoaXMuX3RleHRMYXllciA9IG51bGw7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7TGFiZWxlZENpcmNsZX1cbiAgICovXG4gIG9uQWRkKG1hcCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5vbkFkZC5jYWxsKHRoaXMsIG1hcCk7XG4gICAgdGhpcy5faW5pdFRleHQoKTtcbiAgICB0aGlzLl91cGRhdGVUZXh0UG9zaXRpb24oKTtcbiAgICB0aGlzLnNldFN0eWxlKHt9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW5kIGluc2VydCB0ZXh0XG4gICAqL1xuICBfaW5pdFRleHQoKSB7XG4gICAgdGhpcy5fdGV4dEVsZW1lbnQgPSBMLlNWRy5jcmVhdGUoJ3RleHQnKTtcbiAgICB0aGlzLnNldFRleHQodGhpcy5fdGV4dCk7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3Jvb3RHcm91cC5hcHBlbmRDaGlsZCh0aGlzLl90ZXh0RWxlbWVudCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ2FsY3VsYXRlIHBvc2l0aW9uIGZvciB0ZXh0XG4gICAqL1xuICBfdXBkYXRlVGV4dFBvc2l0aW9uKCkge1xuICAgIGNvbnN0IHRleHRFbGVtZW50ID0gdGhpcy5fdGV4dEVsZW1lbnQ7XG4gICAgaWYgKHRleHRFbGVtZW50KSB7XG4gICAgICBjb25zdCBiYm94ID0gdGV4dEVsZW1lbnQuZ2V0QkJveCgpO1xuICAgICAgY29uc3QgdGV4dFBvc2l0aW9uID0gdGhpcy5fcG9pbnQuc3VidHJhY3QoXG4gICAgICAgIEwucG9pbnQoYmJveC53aWR0aCwgLWJib3guaGVpZ2h0ICsgdGhpcy5vcHRpb25zLnNoaWZ0WSkuZGl2aWRlQnkoMikpO1xuXG4gICAgICB0ZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3gnLCB0ZXh0UG9zaXRpb24ueCk7XG4gICAgICB0ZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3knLCB0ZXh0UG9zaXRpb24ueSk7XG4gICAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU2V0IHRleHQgc3R5bGVcbiAgICovXG4gIHNldFN0eWxlKHN0eWxlKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLnNldFN0eWxlLmNhbGwodGhpcywgc3R5bGUpO1xuICAgIGlmICh0aGlzLl90ZXh0RWxlbWVudCkge1xuICAgICAgY29uc3Qgc3R5bGVzID0gdGhpcy5vcHRpb25zLnRleHRTdHlsZTtcbiAgICAgIGZvciAobGV0IHByb3AgaW4gc3R5bGVzKSB7XG4gICAgICAgIGlmIChzdHlsZXMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICBsZXQgc3R5bGVQcm9wID0gcHJvcDtcbiAgICAgICAgICBpZiAocHJvcCA9PT0gJ2NvbG9yJykge1xuICAgICAgICAgICAgc3R5bGVQcm9wID0gJ3N0cm9rZSc7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX3RleHRFbGVtZW50LnN0eWxlW3N0eWxlUHJvcF0gPSBzdHlsZXNbcHJvcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVtb3ZlIHRleHRcbiAgICovXG4gIG9uUmVtb3ZlKG1hcCkge1xuICAgIGlmICh0aGlzLl90ZXh0RWxlbWVudCkge1xuICAgICAgaWYgKHRoaXMuX3RleHRFbGVtZW50LnBhcmVudE5vZGUpIHtcbiAgICAgICAgdGhpcy5fdGV4dEVsZW1lbnQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl90ZXh0RWxlbWVudCk7XG4gICAgICB9XG4gICAgICB0aGlzLl90ZXh0RWxlbWVudCA9IG51bGw7XG4gICAgICB0aGlzLl90ZXh0Tm9kZSA9IG51bGw7XG4gICAgICB0aGlzLl90ZXh0TGF5ZXIgPSBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUub25SZW1vdmUuY2FsbCh0aGlzLCBtYXApO1xuICB9XG5cbn0pO1xuZXhwb3J0IGNvbnN0IHRleHRDaXJjbGUgPSAodGV4dCwgbGF0bG5nLCBvcHRpb25zKSA9PiBuZXcgQ2lyY2xlKHRleHQsIGxhdGxuZywgb3B0aW9ucyk7XG4iLCJpbXBvcnQgTCBmcm9tICdsZWFmbGV0JztcbmltcG9ydCB7IENpcmNsZSB9IGZyb20gJy4vY2lyY2xlJztcbmltcG9ydCAnbGVhZmxldC1wYXRoLWRyYWcnO1xuXG5jb25zdCBMYWJlbGVkTWFya2VyID0gTC5GZWF0dXJlR3JvdXAuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHJldHVybiB7U3RyaW5nfVxuICAgICAqL1xuICAgIGdldExhYmVsVGV4dDogKG1hcmtlciwgZmVhdHVyZSkgPT4gZmVhdHVyZS5wcm9wZXJ0aWVzLnRleHQsXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHBhcmFtICB7TC5MYXRMbmd9ICAgICAgbGF0bG5nXG4gICAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAgICovXG4gICAgZ2V0TGFiZWxQb3NpdGlvbjogKG1hcmtlciwgZmVhdHVyZSwgbGF0bG5nKSA9PiB7XG4gICAgICByZXR1cm4gZmVhdHVyZS5wcm9wZXJ0aWVzLmxhYmVsUG9zaXRpb24gP1xuICAgICAgICBMLmxhdExuZyhmZWF0dXJlLnByb3BlcnRpZXMubGFiZWxQb3NpdGlvbi5zbGljZSgpLnJldmVyc2UoKSkgOlxuICAgICAgICBsYXRsbmc7XG4gICAgfSxcblxuICAgIGxhYmVsUG9zaXRpb25LZXk6ICdsYWJlbFBvc2l0aW9uJyxcblxuICAgIG1hcmtlck9wdGlvbnM6IHtcbiAgICAgIGNvbG9yOiAnI2YwMCcsXG4gICAgICBmaWxsT3BhY2l0eTogMC43NSxcbiAgICAgIGRyYWdnYWJsZTogdHJ1ZSxcbiAgICAgIHJhZGl1czogMTVcbiAgICB9LFxuXG4gICAgYW5jaG9yT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjMDBmJyxcbiAgICAgIHJhZGl1czogM1xuICAgIH0sXG5cbiAgICBsaW5lT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGRhc2hBcnJheTogWzIsIDZdLFxuICAgICAgbGluZUNhcDogJ3NxdWFyZScsXG4gICAgICB3ZWlnaHQ6IDJcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQGNsYXNzIExhYmVsZWRNYXJrZXJcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtMLkZlYXR1cmVHcm91cH1cbiAgICpcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGxhdGxuZ1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgZmVhdHVyZVxuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZShsYXRsbmcsIGZlYXR1cmUsIG9wdGlvbnMpIHtcbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgdGhpcy5mZWF0dXJlID0gZmVhdHVyZSB8fCB7XG4gICAgICB0eXBlOiAnRmVhdHVyZScsXG4gICAgICBwcm9wZXJ0aWVzOiB7fSxcbiAgICAgIGdlb21ldHJ5OiB7XG4gICAgICAgICd0eXBlJzogJ1BvaW50J1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5MYXRMbmd9XG4gICAgICovXG4gICAgdGhpcy5fbGF0bG5nID0gbGF0bG5nO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Q2lyY2xlTGFiZWx9XG4gICAgICovXG4gICAgdGhpcy5fbWFya2VyID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuQ2lyY2xlTWFya2VyfVxuICAgICAqL1xuICAgIHRoaXMuX2FuY2hvciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvbHlsaW5lfVxuICAgICAqL1xuICAgIHRoaXMuX2xpbmUgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9pbml0aWFsRGlzdGFuY2UgPSBudWxsO1xuXG4gICAgdGhpcy5fY3JlYXRlTGF5ZXJzKCk7XG4gICAgTC5MYXllckdyb3VwLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcyxcbiAgICAgIFt0aGlzLl9hbmNob3IsIHRoaXMuX2xpbmUsIHRoaXMuX21hcmtlcl0pO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgZ2V0TGFiZWxQb3NpdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFya2VyLmdldExhdExuZygpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgZ2V0TGF0TG5nKCkge1xuICAgIHJldHVybiB0aGlzLl9sYXRsbmc7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2VyaWFsaXplXG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIHRvR2VvSlNPTihnZW9tZXRyeUNvbGxlY3Rpb24pIHtcbiAgICBjb25zdCBmZWF0dXJlID0gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xuICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgIGNvb3JkaW5hdGVzOiBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5fYW5jaG9yLmdldExhdExuZygpKVxuICAgIH0pO1xuICAgIGZlYXR1cmUucHJvcGVydGllc1t0aGlzLm9wdGlvbnMubGFiZWxQb3NpdGlvbktleV0gPVxuICAgICAgTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKSk7XG4gICAgZmVhdHVyZS5wcm9wZXJ0aWVzLnRleHQgPSB0aGlzLl9tYXJrZXIuZ2V0VGV4dCgpO1xuICAgIHJldHVybiBnZW9tZXRyeUNvbGxlY3Rpb24gP1xuICAgICAgTC5MYWJlbGVkQ2lyY2xlTWFya2VyXG4gICAgICAgIC50b0dlb21ldHJ5Q29sbGVjdGlvbihmZWF0dXJlLCB0aGlzLm9wdGlvbnMubGFiZWxQb3NpdGlvbktleSkgOiBmZWF0dXJlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge0xhYmVsZWRNYXJrZXJ9XG4gICAqL1xuICBzZXRUZXh0KHRleHQpIHtcbiAgICB0aGlzLl9tYXJrZXIuc2V0VGV4dCh0ZXh0KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuY2hvciwgbGluZSBhbmQgbGFiZWxcbiAgICovXG4gIF9jcmVhdGVMYXllcnMoKSB7XG4gICAgY29uc3Qgb3B0cyA9IHRoaXMub3B0aW9ucztcbiAgICBjb25zdCBwb3MgID0gb3B0cy5nZXRMYWJlbFBvc2l0aW9uKHRoaXMsIHRoaXMuZmVhdHVyZSwgdGhpcy5fbGF0bG5nKTtcbiAgICBjb25zdCB0ZXh0ID0gb3B0cy5nZXRMYWJlbFRleHQodGhpcywgdGhpcy5mZWF0dXJlKTtcblxuICAgIGlmICgnZHJhZ2dhYmxlJyBpbiBvcHRzKSB7XG4gICAgICBvcHRzLm1hcmtlck9wdGlvbnMuZHJhZ2dhYmxlID0gb3B0cy5kcmFnZ2FibGU7XG4gICAgfVxuXG4gICAgdGhpcy5fbWFya2VyID0gbmV3IENpcmNsZSh0ZXh0LCBwb3MsXG4gICAgICBMLlV0aWwuZXh0ZW5kKHtcbiAgICAgICAgaW50ZXJhY3RpdmU6IHRoaXMub3B0aW9ucy5pbnRlcmFjdGl2ZVxuICAgICAgfSxcbiAgICAgICAgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5tYXJrZXJPcHRpb25zLFxuICAgICAgICBvcHRzLm1hcmtlck9wdGlvbnMpXG4gICAgKS5vbignZHJhZycsICAgICAgdGhpcy5fb25NYXJrZXJEcmFnLCAgICAgIHRoaXMpXG4gICAgIC5vbignZHJhZ3N0YXJ0JywgdGhpcy5fb25NYXJrZXJEcmFnU3RhcnQsIHRoaXMpXG4gICAgIC5vbignZHJhZ2VuZCcsICAgdGhpcy5fb25NYXJrZXJEcmFnRW5kLCAgIHRoaXMpO1xuXG4gICAgdGhpcy5fYW5jaG9yID0gbmV3IEwuQ2lyY2xlTWFya2VyKHRoaXMuX2xhdGxuZyxcbiAgICAgIEwuVXRpbC5leHRlbmQoe30sIExhYmVsZWRNYXJrZXIucHJvdG90eXBlLm9wdGlvbnMuYW5jaG9yT3B0aW9ucyxcbiAgICAgICAgb3B0cy5hbmNob3JPcHRpb25zKSk7XG5cbiAgICB0aGlzLl9saW5lID0gbmV3IEwuUG9seWxpbmUoW3RoaXMuX2xhdGxuZywgdGhpcy5fbWFya2VyLmdldExhdExuZygpXSxcbiAgICAgIEwuVXRpbC5leHRlbmQoe30sIExhYmVsZWRNYXJrZXIucHJvdG90eXBlLm9wdGlvbnMubGluZU9wdGlvbnMsXG4gICAgICAgIG9wdHMubGluZU9wdGlvbnMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTdG9yZSBzaGlmdCB0byBiZSBwcmVjaXNlIHdoaWxlIGRyYWdnaW5nXG4gICAqIEBwYXJhbSAge0V2ZW50fSBldnRcbiAgICovXG4gIF9vbk1hcmtlckRyYWdTdGFydChldnQpIHtcbiAgICB0aGlzLl9pbml0aWFsRGlzdGFuY2UgPSBMLkRvbUV2ZW50LmdldE1vdXNlUG9zaXRpb24oZXZ0KVxuICAgICAgLnN1YnRyYWN0KHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKSkpO1xuICAgIHRoaXMuZmlyZSgnbGFiZWw6JyArIGV2dC50eXBlLCBldnQpO1xuICAgIC8vTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUodGhpcy5fbWFya2VyLmJyaW5nVG9Gcm9udCwgdGhpcy5fbWFya2VyKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBMaW5lIGRyYWdnaW5nXG4gICAqIEBwYXJhbSAge0RyYWdFdmVudH0gZXZ0XG4gICAqL1xuICBfb25NYXJrZXJEcmFnKGV2dCkge1xuICAgIGNvbnN0IGxhdGxuZyA9IHRoaXMuX21hcC5jb250YWluZXJQb2ludFRvTGF0TG5nKFxuICAgICAgTC5Eb21FdmVudC5nZXRNb3VzZVBvc2l0aW9uKGV2dCkuX3N1YnRyYWN0KHRoaXMuX2luaXRpYWxEaXN0YW5jZSkpO1xuICAgIHRoaXMuX2xpbmUuc2V0TGF0TG5ncyhbbGF0bG5nLCB0aGlzLl9sYXRsbmddKTtcbiAgICB0aGlzLmZpcmUoJ2xhYmVsOicgKyBldnQudHlwZSwgZXZ0KTtcbiAgfSxcblxuXG4gIF9vbk1hcmtlckRyYWdFbmQoZXZ0KSB7XG4gICAgdGhpcy5fbGluZS5zZXRMYXRMbmdzKFt0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCksIHRoaXMuX2xhdGxuZ10pO1xuICAgIHRoaXMuZmlyZSgnbGFiZWw6JyArIGV2dC50eXBlLCBldnQpO1xuICB9LFxuXG5cbiAgZW5hYmxlRHJhZ2dpbmcoKSB7XG4gICAgaWYgKHRoaXMuX21hcmtlci5kcmFnZ2luZykgdGhpcy5fbWFya2VyLmRyYWdnaW5nLmVuYWJsZSgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgZGlzYWJsZURyYWdnaW5nKCkge1xuICAgIGlmICh0aGlzLl9tYXJrZXIuZHJhZ2dpbmcpIHRoaXMuX21hcmtlci5kcmFnZ2luZy5kaXNhYmxlKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxufSk7XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtPYmplY3R9IGZlYXR1cmVcbiAqIEBwYXJhbSAge1N0cmluZz19IGtleVxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5mdW5jdGlvbiB0b0dlb21ldHJ5Q29sbGVjdGlvbihmZWF0dXJlLCBrZXkpIHtcbiAga2V5ID0ga2V5IHx8ICdsYWJlbFBvc2l0aW9uJztcbiAgY29uc3QgYW5jaG9yUG9zID0gZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcy5zbGljZSgpO1xuICBsZXQgbGFiZWxQb3MgID0gZmVhdHVyZS5wcm9wZXJ0aWVzW2tleV07XG5cbiAgaWYgKCFsYWJlbFBvcykgdGhyb3cgbmV3IEVycm9yKCdObyBsYWJlbCBwb3NpdGlvbiBzZXQnKTtcblxuICBsYWJlbFBvcyA9IGxhYmVsUG9zLnNsaWNlKCk7XG4gIGNvbnN0IGdlb21ldHJpZXMgPSBbe1xuICAgIHR5cGU6ICdQb2ludCcsXG4gICAgY29vcmRpbmF0ZXM6IGFuY2hvclBvc1xuICB9LCB7XG4gICAgdHlwZTogJ0xpbmVTdHJpbmcnLFxuICAgIGNvb3JkaW5hdGVzOiBbXG4gICAgICBhbmNob3JQb3Muc2xpY2UoKSxcbiAgICAgIGxhYmVsUG9zXG4gICAgXVxuICB9LCB7XG4gICAgdHlwZTogJ1BvaW50JyxcbiAgICBjb29yZGluYXRlczogbGFiZWxQb3Muc2xpY2UoKVxuICB9LCB7XG4gICAgdHlwZTogJ1BvaW50JyxcbiAgICBjb29yZGluYXRlczogbGFiZWxQb3Muc2xpY2UoKVxuICB9XTtcblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICBwcm9wZXJ0aWVzOiBMLlV0aWwuZXh0ZW5kKHt9LCBmZWF0dXJlLnByb3BlcnRpZXMsIHtcbiAgICAgIGdlb21ldHJpZXNUeXBlczogWydhbmNob3InLCAnY29ubmVjdGlvbicsICdsYWJlbCcsICd0ZXh0Ym94J11cbiAgICB9KSxcbiAgICBiYm94OiBmZWF0dXJlLmJib3gsXG4gICAgZ2VvbWV0cnk6IHtcbiAgICAgIHR5cGU6ICdHZW9tZXRyeUNvbGxlY3Rpb24nLFxuICAgICAgZ2VvbWV0cmllczogZ2VvbWV0cmllc1xuICAgIH1cbiAgfTtcbn1cblxuTGFiZWxlZE1hcmtlci50b0dlb21ldHJ5Q29sbGVjdGlvbiA9IHRvR2VvbWV0cnlDb2xsZWN0aW9uO1xuXG5MLkxhYmVsZWRDaXJjbGVNYXJrZXIgPSBMYWJlbGVkTWFya2VyO1xuTC5sYWJlbGVkQ2lyY2xlTWFya2VyID0gKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykgPT4ge1xuICByZXR1cm4gbmV3IExhYmVsZWRNYXJrZXIobGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IExhYmVsZWRNYXJrZXI7XG4iXX0=
