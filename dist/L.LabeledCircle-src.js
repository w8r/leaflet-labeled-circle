(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/**
 * Leaflet SVG circle marker with detachable and draggable label and text
 *
 * @author Alexander Milevski <info@w8r.name>
 * @license MIT
 * @preserve
 */
module.exports = require('./src/marker');

},{"./src/marker":9}],2:[function(require,module,exports){
require('./src/SVG');
require('./src/SVG.VML');
require('./src/Canvas');
require('./src/Path.Transform');
require('./src/Path.Drag');

module.exports = L.Path.Drag;

},{"./src/Canvas":3,"./src/Path.Drag":4,"./src/Path.Transform":5,"./src/SVG":7,"./src/SVG.VML":6}],3:[function(require,module,exports){
L.Util.trueFn = function() {
  return true;
};

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
   *
   * @param  {L.Path}         layer
   * @param  {Array.<Number>} matrix
   */
  transformPath: function(layer, matrix) {
    var copy = this._containerCopy;
    var ctx = this._ctx;
    var m = L.Browser.retina ? 2 : 1;
    var bounds = this._bounds;
    var size = bounds.getSize();
    var pos = bounds.min;

    if (!copy) {
      copy = this._containerCopy = document.createElement('canvas');
      document.body.appendChild(copy);

      copy.width = m * size.x;
      copy.height = m * size.y;

      layer._removed = true;
      this._redraw();

      copy.getContext('2d').translate(m * bounds.min.x, m * bounds.min.y);
      copy.getContext('2d').drawImage(this._container, 0, 0);
      this._initPath(layer);
      layer._containsPoint_ = layer._containsPoint;
      layer._containsPoint = L.Util.trueFn;
    }

    ctx.save();
    ctx.clearRect(pos.x, pos.y, size.x * m, size.y * m);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
    ctx.save();

    ctx.drawImage(this._containerCopy, 0, 0, size.x, size.y);
    ctx.transform.apply(ctx, matrix);

    var layers = this._layers;
    this._layers = {};

    this._initPath(layer);
    layer._updatePath();

    this._layers = layers;
    ctx.restore();
  }

});

},{}],4:[function(require,module,exports){
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
      .on(document, L.Draggable.MOVE[eventType], this._onDrag,    this)
      .on(document, L.Draggable.END[eventType],  this._onDragEnd, this);

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

    var x = containerPoint.x;
    var y = containerPoint.y;

    var dx = x - this._startPoint.x;
    var dy = y - this._startPoint.y;

    if (!this._path._dragMoved && (dx || dy)) {
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


    L.DomEvent
      .off(document, 'mousemove touchmove', this._onDrag, this)
      .off(document, 'mouseup touchend',    this._onDragEnd, this);

    this._restoreCoordGetters();

    // consistency
    if (moved) {
      this._path.fire('dragend', {
        distance: Math.sqrt(
          L.LineUtil._sqDist(this._dragStartPoint, containerPoint)
        )
      });

      // hack for skipping the click in canvas-rendered layers
      var contains = this._path._containsPoint;
      this._path._containsPoint = L.Util.falseFn;
      L.Util.requestAnimFrame(function() {
        L.DomEvent._skipped({ type: 'click' });
        this._path._containsPoint = contains;
      }, this);
    }

    this._matrix          = null;
    this._startPoint      = null;
    this._dragStartPoint  = null;
    this._path._dragMoved = false;

    if (this._mapDraggingWasEnabled) {
      if (moved) L.DomEvent._fakeStop({ type: 'click' });
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
(function (global){
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;

var Circle = module.exports = L.CircleMarker.extend({

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

    L.CircleMarker.prototype.initialize.call(this, latlng, options);
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
    L.CircleMarker.prototype.bringToFront.call(this);
    this._groupTextToPath();
  },

  /**
   * @override
   */
  bringToBack: function bringToBack() {
    L.CircleMarker.prototype.bringToBack.call(this);
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
    L.CircleMarker.prototype._updatePath.call(this);
    this._updateTextPosition();
  },

  /**
   * @override
   */
  _transform: function _transform(matrix) {
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
  onAdd: function onAdd(map) {
    L.CircleMarker.prototype.onAdd.call(this, map);
    this._initText();
    this._updateTextPosition();
    this.setStyle();
    return this;
  },

  /**
   * Create and insert text
   */
  _initText: function _initText() {
    this._textElement = L.SVG.create('text');
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
      var textPosition = this._point.subtract(L.point(bbox.width, -bbox.height + this.options.shiftY).divideBy(2));

      textElement.setAttribute('x', textPosition.x);
      textElement.setAttribute('y', textPosition.y);
      this._groupTextToPath();
    }
  },

  /**
   * Set text style
   */
  setStyle: function setStyle(style) {
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
  onRemove: function onRemove(map) {
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],9:[function(require,module,exports){
(function (global){
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;
var Circle = require('./circle');
require('leaflet-path-drag');

var LabeledMarker = L.FeatureGroup.extend({

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
      return feature.properties.labelPosition ? L.latLng(feature.properties.labelPosition.slice().reverse()) : latlng;
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
    L.Util.setOptions(this, options);

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
    L.LayerGroup.prototype.initialize.call(this, [this._anchor, this._line, this._marker]);
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
    var feature = L.GeoJSON.getFeature(this, {
      type: 'Point',
      coordinates: L.GeoJSON.latLngToCoords(this._anchor.getLatLng())
    });
    feature.properties[this.options.labelPositionKey] = L.GeoJSON.latLngToCoords(this._marker.getLatLng());
    feature.properties.text = this._marker.getText();
    return geometryCollection ? L.LabeledCircleMarker.toGeometryCollection(feature, this.options.labelPositionKey) : feature;
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

    this._marker = new Circle(text, pos, L.Util.extend({
      interactive: this.options.interactive
    }, LabeledMarker.prototype.options.markerOptions, opts.markerOptions)).on('drag', this._onMarkerDrag, this).on('dragstart', this._onMarkerDragStart, this).on('dragend', this._onMarkerDragEnd, this);

    this._anchor = new L.CircleMarker(this._latlng, L.Util.extend({}, LabeledMarker.prototype.options.anchorOptions, opts.anchorOptions));

    this._line = new L.Polyline([this._latlng, this._marker.getLatLng()], L.Util.extend({}, LabeledMarker.prototype.options.lineOptions, opts.lineOptions));
  },

  /**
   * Store shift to be precise while dragging
   * @param  {Event} evt
   */
  _onMarkerDragStart: function _onMarkerDragStart(evt) {
    this._initialDistance = L.DomEvent.getMousePosition(evt).subtract(this._map.latLngToContainerPoint(this._marker.getLatLng()));
    this.fire('label:' + evt.type, evt);
    //L.Util.requestAnimFrame(this._marker.bringToFront, this._marker);
  },

  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag: function _onMarkerDrag(evt) {
    var latlng = this._map.containerPointToLatLng(L.DomEvent.getMousePosition(evt)._subtract(this._initialDistance));
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
    properties: L.Util.extend({}, feature.properties, {
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

module.exports = L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./circle":8,"leaflet-path-drag":2}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvQ2FudmFzLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9QYXRoLkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuVk1MLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuanMiLCJzcmMvY2lyY2xlLmpzIiwic3JjL21hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUE7Ozs7Ozs7QUFPQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxjQUFSLENBQWpCOzs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogTGVhZmxldCBTVkcgY2lyY2xlIG1hcmtlciB3aXRoIGRldGFjaGFibGUgYW5kIGRyYWdnYWJsZSBsYWJlbCBhbmQgdGV4dFxuICpcbiAqIEBhdXRob3IgQWxleGFuZGVyIE1pbGV2c2tpIDxpbmZvQHc4ci5uYW1lPlxuICogQGxpY2Vuc2UgTUlUXG4gKiBAcHJlc2VydmVcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9tYXJrZXInKTtcbiIsInJlcXVpcmUoJy4vc3JjL1NWRycpO1xucmVxdWlyZSgnLi9zcmMvU1ZHLlZNTCcpO1xucmVxdWlyZSgnLi9zcmMvQ2FudmFzJyk7XG5yZXF1aXJlKCcuL3NyYy9QYXRoLlRyYW5zZm9ybScpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5EcmFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5QYXRoLkRyYWc7XG4iLCJMLlV0aWwudHJ1ZUZuID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuTC5DYW52YXMuaW5jbHVkZSh7XG5cbiAgLyoqXG4gICAqIERvIG5vdGhpbmdcbiAgICogQHBhcmFtICB7TC5QYXRofSBsYXllclxuICAgKi9cbiAgX3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBpZiAoIXRoaXMuX2NvbnRhaW5lckNvcHkpIHJldHVybjtcblxuICAgIGRlbGV0ZSB0aGlzLl9jb250YWluZXJDb3B5O1xuXG4gICAgaWYgKGxheWVyLl9jb250YWluc1BvaW50Xykge1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnQgPSBsYXllci5fY29udGFpbnNQb2ludF87XG4gICAgICBkZWxldGUgbGF5ZXIuX2NvbnRhaW5zUG9pbnRfO1xuXG4gICAgICB0aGlzLl9yZXF1ZXN0UmVkcmF3KGxheWVyKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQWxnb3JpdGhtIG91dGxpbmU6XG4gICAqXG4gICAqIDEuIHByZS10cmFuc2Zvcm0gLSBjbGVhciB0aGUgcGF0aCBvdXQgb2YgdGhlIGNhbnZhcywgY29weSBjYW52YXMgc3RhdGVcbiAgICogMi4gYXQgZXZlcnkgZnJhbWU6XG4gICAqICAgIDIuMS4gc2F2ZVxuICAgKiAgICAyLjIuIHJlZHJhdyB0aGUgY2FudmFzIGZyb20gc2F2ZWQgb25lXG4gICAqICAgIDIuMy4gdHJhbnNmb3JtXG4gICAqICAgIDIuNC4gZHJhdyBwYXRoXG4gICAqICAgIDIuNS4gcmVzdG9yZVxuICAgKlxuICAgKiBAcGFyYW0gIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcbiAgICogQHBhcmFtICB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuICAgKi9cbiAgdHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuICAgIHZhciBjb3B5ID0gdGhpcy5fY29udGFpbmVyQ29weTtcbiAgICB2YXIgY3R4ID0gdGhpcy5fY3R4O1xuICAgIHZhciBtID0gTC5Ccm93c2VyLnJldGluYSA/IDIgOiAxO1xuICAgIHZhciBib3VuZHMgPSB0aGlzLl9ib3VuZHM7XG4gICAgdmFyIHNpemUgPSBib3VuZHMuZ2V0U2l6ZSgpO1xuICAgIHZhciBwb3MgPSBib3VuZHMubWluO1xuXG4gICAgaWYgKCFjb3B5KSB7XG4gICAgICBjb3B5ID0gdGhpcy5fY29udGFpbmVyQ29weSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjb3B5KTtcblxuICAgICAgY29weS53aWR0aCA9IG0gKiBzaXplLng7XG4gICAgICBjb3B5LmhlaWdodCA9IG0gKiBzaXplLnk7XG5cbiAgICAgIGxheWVyLl9yZW1vdmVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3JlZHJhdygpO1xuXG4gICAgICBjb3B5LmdldENvbnRleHQoJzJkJykudHJhbnNsYXRlKG0gKiBib3VuZHMubWluLngsIG0gKiBib3VuZHMubWluLnkpO1xuICAgICAgY29weS5nZXRDb250ZXh0KCcyZCcpLmRyYXdJbWFnZSh0aGlzLl9jb250YWluZXIsIDAsIDApO1xuICAgICAgdGhpcy5faW5pdFBhdGgobGF5ZXIpO1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnRfID0gbGF5ZXIuX2NvbnRhaW5zUG9pbnQ7XG4gICAgICBsYXllci5fY29udGFpbnNQb2ludCA9IEwuVXRpbC50cnVlRm47XG4gICAgfVxuXG4gICAgY3R4LnNhdmUoKTtcbiAgICBjdHguY2xlYXJSZWN0KHBvcy54LCBwb3MueSwgc2l6ZS54ICogbSwgc2l6ZS55ICogbSk7XG4gICAgY3R4LnNldFRyYW5zZm9ybSgxLCAwLCAwLCAxLCAwLCAwKTtcbiAgICBjdHgucmVzdG9yZSgpO1xuICAgIGN0eC5zYXZlKCk7XG5cbiAgICBjdHguZHJhd0ltYWdlKHRoaXMuX2NvbnRhaW5lckNvcHksIDAsIDAsIHNpemUueCwgc2l6ZS55KTtcbiAgICBjdHgudHJhbnNmb3JtLmFwcGx5KGN0eCwgbWF0cml4KTtcblxuICAgIHZhciBsYXllcnMgPSB0aGlzLl9sYXllcnM7XG4gICAgdGhpcy5fbGF5ZXJzID0ge307XG5cbiAgICB0aGlzLl9pbml0UGF0aChsYXllcik7XG4gICAgbGF5ZXIuX3VwZGF0ZVBhdGgoKTtcblxuICAgIHRoaXMuX2xheWVycyA9IGxheWVycztcbiAgICBjdHgucmVzdG9yZSgpO1xuICB9XG5cbn0pO1xuIiwiLyoqXG4gKiBEcmFnIGhhbmRsZXJcbiAqIEBjbGFzcyBMLlBhdGguRHJhZ1xuICogQGV4dGVuZHMge0wuSGFuZGxlcn1cbiAqL1xuTC5IYW5kbGVyLlBhdGhEcmFnID0gTC5IYW5kbGVyLmV4dGVuZCggLyoqIEBsZW5kcyAgTC5QYXRoLkRyYWcucHJvdG90eXBlICovIHtcblxuICBzdGF0aWNzOiB7XG4gICAgRFJBR0dJTkdfQ0xTOiAnbGVhZmxldC1wYXRoLWRyYWdnYWJsZScsXG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5QYXRofSBwYXRoXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ocGF0aCkge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUGF0aH1cbiAgICAgKi9cbiAgICB0aGlzLl9wYXRoID0gcGF0aDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheS48TnVtYmVyPn1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXRyaXggPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSBmYWxzZTtcblxuICB9LFxuXG4gIC8qKlxuICAgKiBFbmFibGUgZHJhZ2dpbmdcbiAgICovXG4gIGFkZEhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoLm9uKCdtb3VzZWRvd24nLCB0aGlzLl9vbkRyYWdTdGFydCwgdGhpcyk7XG5cbiAgICB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID0gdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA/XG4gICAgICAgICh0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lICsgJyAnICsgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUykgOlxuICAgICAgICAgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUztcblxuICAgIGlmICh0aGlzLl9wYXRoLl9wYXRoKSB7XG4gICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aC5fcGF0aCwgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBEaXNhYmxlIGRyYWdnaW5nXG4gICAqL1xuICByZW1vdmVIb29rczogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGF0aC5vZmYoJ21vdXNlZG93bicsIHRoaXMuX29uRHJhZ1N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgPSB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lXG4gICAgICAucmVwbGFjZShuZXcgUmVnRXhwKCdcXFxccysnICsgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyksICcnKTtcbiAgICBpZiAodGhpcy5fcGF0aC5fcGF0aCkge1xuICAgICAgTC5Eb21VdGlsLnJlbW92ZUNsYXNzKHRoaXMuX3BhdGguX3BhdGgsIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICovXG4gIG1vdmVkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcGF0aC5fZHJhZ01vdmVkO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTdGFydCBkcmFnXG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnU3RhcnQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBldmVudFR5cGUgPSBldnQub3JpZ2luYWxFdmVudC5fc2ltdWxhdGVkID8gJ3RvdWNoc3RhcnQnIDogZXZ0Lm9yaWdpbmFsRXZlbnQudHlwZTtcblxuICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgPSBldnQuY29udGFpbmVyUG9pbnQuY2xvbmUoKTtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IGV2dC5jb250YWluZXJQb2ludC5jbG9uZSgpO1xuICAgIHRoaXMuX21hdHJpeCA9IFsxLCAwLCAwLCAxLCAwLCAwXTtcbiAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0Lm9yaWdpbmFsRXZlbnQpO1xuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGguX3JlbmRlcmVyLl9jb250YWluZXIsICdsZWFmbGV0LWludGVyYWN0aXZlJyk7XG4gICAgTC5Eb21FdmVudFxuICAgICAgLm9uKGRvY3VtZW50LCBMLkRyYWdnYWJsZS5NT1ZFW2V2ZW50VHlwZV0sIHRoaXMuX29uRHJhZywgICAgdGhpcylcbiAgICAgIC5vbihkb2N1bWVudCwgTC5EcmFnZ2FibGUuRU5EW2V2ZW50VHlwZV0sICB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5lbmFibGVkKCkpIHtcbiAgICAgIC8vIEkgZ3Vlc3MgaXQncyByZXF1aXJlZCBiZWNhdXNlIG1vdXNkb3duIGdldHMgc2ltdWxhdGVkIHdpdGggYSBkZWxheVxuICAgICAgLy90aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZS5fb25VcChldnQpO1xuXG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICAgICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fcG9wdXApIHsgLy8gdGhhdCBtaWdodCBiZSBhIGNhc2Ugb24gdG91Y2ggZGV2aWNlcyBhcyB3ZWxsXG4gICAgICB0aGlzLl9wYXRoLl9wb3B1cC5fY2xvc2UoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZXBsYWNlQ29vcmRHZXR0ZXJzKGV2dCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERyYWdnaW5nXG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnOiBmdW5jdGlvbihldnQpIHtcbiAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0KTtcblxuICAgIHZhciBmaXJzdCA9IChldnQudG91Y2hlcyAmJiBldnQudG91Y2hlcy5sZW5ndGggPj0gMSA/IGV2dC50b3VjaGVzWzBdIDogZXZ0KTtcbiAgICB2YXIgY29udGFpbmVyUG9pbnQgPSB0aGlzLl9wYXRoLl9tYXAubW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQoZmlyc3QpO1xuXG4gICAgdmFyIHggPSBjb250YWluZXJQb2ludC54O1xuICAgIHZhciB5ID0gY29udGFpbmVyUG9pbnQueTtcblxuICAgIHZhciBkeCA9IHggLSB0aGlzLl9zdGFydFBvaW50Lng7XG4gICAgdmFyIGR5ID0geSAtIHRoaXMuX3N0YXJ0UG9pbnQueTtcblxuICAgIGlmICghdGhpcy5fcGF0aC5fZHJhZ01vdmVkICYmIChkeCB8fCBkeSkpIHtcbiAgICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IHRydWU7XG4gICAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWdzdGFydCcsIGV2dCk7XG4gICAgICAvLyB3ZSBkb24ndCB3YW50IHRoYXQgdG8gaGFwcGVuIG9uIGNsaWNrXG4gICAgICB0aGlzLl9wYXRoLmJyaW5nVG9Gcm9udCgpO1xuICAgIH1cblxuICAgIHRoaXMuX21hdHJpeFs0XSArPSBkeDtcbiAgICB0aGlzLl9tYXRyaXhbNV0gKz0gZHk7XG5cbiAgICB0aGlzLl9zdGFydFBvaW50LnggPSB4O1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQueSA9IHk7XG5cbiAgICB0aGlzLl9wYXRoLmZpcmUoJ3ByZWRyYWcnLCBldnQpO1xuICAgIHRoaXMuX3BhdGguX3RyYW5zZm9ybSh0aGlzLl9tYXRyaXgpO1xuICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZycsIGV2dCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERyYWdnaW5nIHN0b3BwZWQsIGFwcGx5XG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnRW5kOiBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgY29udGFpbmVyUG9pbnQgPSB0aGlzLl9wYXRoLl9tYXAubW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQoZXZ0KTtcbiAgICB2YXIgbW92ZWQgPSB0aGlzLm1vdmVkKCk7XG5cbiAgICAvLyBhcHBseSBtYXRyaXhcbiAgICBpZiAobW92ZWQpIHtcbiAgICAgIHRoaXMuX3RyYW5zZm9ybVBvaW50cyh0aGlzLl9tYXRyaXgpO1xuICAgICAgdGhpcy5fcGF0aC5fdXBkYXRlUGF0aCgpO1xuICAgICAgdGhpcy5fcGF0aC5fcHJvamVjdCgpO1xuICAgICAgdGhpcy5fcGF0aC5fdHJhbnNmb3JtKG51bGwpO1xuXG4gICAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0KTtcbiAgICB9XG5cblxuICAgIEwuRG9tRXZlbnRcbiAgICAgIC5vZmYoZG9jdW1lbnQsICdtb3VzZW1vdmUgdG91Y2htb3ZlJywgdGhpcy5fb25EcmFnLCB0aGlzKVxuICAgICAgLm9mZihkb2N1bWVudCwgJ21vdXNldXAgdG91Y2hlbmQnLCAgICB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcmVzdG9yZUNvb3JkR2V0dGVycygpO1xuXG4gICAgLy8gY29uc2lzdGVuY3lcbiAgICBpZiAobW92ZWQpIHtcbiAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZ2VuZCcsIHtcbiAgICAgICAgZGlzdGFuY2U6IE1hdGguc3FydChcbiAgICAgICAgICBMLkxpbmVVdGlsLl9zcURpc3QodGhpcy5fZHJhZ1N0YXJ0UG9pbnQsIGNvbnRhaW5lclBvaW50KVxuICAgICAgICApXG4gICAgICB9KTtcblxuICAgICAgLy8gaGFjayBmb3Igc2tpcHBpbmcgdGhlIGNsaWNrIGluIGNhbnZhcy1yZW5kZXJlZCBsYXllcnNcbiAgICAgIHZhciBjb250YWlucyA9IHRoaXMuX3BhdGguX2NvbnRhaW5zUG9pbnQ7XG4gICAgICB0aGlzLl9wYXRoLl9jb250YWluc1BvaW50ID0gTC5VdGlsLmZhbHNlRm47XG4gICAgICBMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShmdW5jdGlvbigpIHtcbiAgICAgICAgTC5Eb21FdmVudC5fc2tpcHBlZCh7IHR5cGU6ICdjbGljaycgfSk7XG4gICAgICAgIHRoaXMuX3BhdGguX2NvbnRhaW5zUG9pbnQgPSBjb250YWlucztcbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuX21hdHJpeCAgICAgICAgICA9IG51bGw7XG4gICAgdGhpcy5fc3RhcnRQb2ludCAgICAgID0gbnVsbDtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCAgPSBudWxsO1xuICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCkge1xuICAgICAgaWYgKG1vdmVkKSBMLkRvbUV2ZW50Ll9mYWtlU3RvcCh7IHR5cGU6ICdjbGljaycgfSk7XG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFwcGxpZXMgdHJhbnNmb3JtYXRpb24sIGRvZXMgaXQgaW4gb25lIHN3ZWVwIGZvciBwZXJmb3JtYW5jZSxcbiAgICogc28gZG9uJ3QgYmUgc3VycHJpc2VkIGFib3V0IHRoZSBjb2RlIHJlcGV0aXRpb24uXG4gICAqXG4gICAqIFsgeCBdICAgWyBhICBiICB0eCBdIFsgeCBdICAgWyBhICogeCArIGIgKiB5ICsgdHggXVxuICAgKiBbIHkgXSA9IFsgYyAgZCAgdHkgXSBbIHkgXSA9IFsgYyAqIHggKyBkICogeSArIHR5IF1cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICBfdHJhbnNmb3JtUG9pbnRzOiBmdW5jdGlvbihtYXRyaXgsIGRlc3QpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGg7XG4gICAgdmFyIGksIGxlbiwgbGF0bG5nO1xuXG4gICAgdmFyIHB4ID0gTC5wb2ludChtYXRyaXhbNF0sIG1hdHJpeFs1XSk7XG5cbiAgICB2YXIgY3JzID0gcGF0aC5fbWFwLm9wdGlvbnMuY3JzO1xuICAgIHZhciB0cmFuc2Zvcm1hdGlvbiA9IGNycy50cmFuc2Zvcm1hdGlvbjtcbiAgICB2YXIgc2NhbGUgPSBjcnMuc2NhbGUocGF0aC5fbWFwLmdldFpvb20oKSk7XG4gICAgdmFyIHByb2plY3Rpb24gPSBjcnMucHJvamVjdGlvbjtcblxuICAgIHZhciBkaWZmID0gdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHgsIHNjYWxlKVxuICAgICAgLnN1YnRyYWN0KHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKEwucG9pbnQoMCwgMCksIHNjYWxlKSk7XG4gICAgdmFyIGFwcGx5VHJhbnNmb3JtID0gIWRlc3Q7XG5cbiAgICBwYXRoLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoKTtcblxuICAgIC8vIGNvbnNvbGUudGltZSgndHJhbnNmb3JtJyk7XG4gICAgLy8gYWxsIHNoaWZ0cyBhcmUgaW4tcGxhY2VcbiAgICBpZiAocGF0aC5fcG9pbnQpIHsgLy8gTC5DaXJjbGVcbiAgICAgIGRlc3QgPSBwcm9qZWN0aW9uLnVucHJvamVjdChcbiAgICAgICAgcHJvamVjdGlvbi5wcm9qZWN0KHBhdGguX2xhdGxuZykuX2FkZChkaWZmKSk7XG4gICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgcGF0aC5fbGF0bG5nID0gZGVzdDtcbiAgICAgICAgcGF0aC5fcG9pbnQuX2FkZChweCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwYXRoLl9yaW5ncyB8fCBwYXRoLl9wYXJ0cykgeyAvLyBldmVyeXRoaW5nIGVsc2VcbiAgICAgIHZhciByaW5ncyAgID0gcGF0aC5fcmluZ3MgfHwgcGF0aC5fcGFydHM7XG4gICAgICB2YXIgbGF0bG5ncyA9IHBhdGguX2xhdGxuZ3M7XG4gICAgICBkZXN0ID0gZGVzdCB8fCBsYXRsbmdzO1xuICAgICAgaWYgKCFMLlV0aWwuaXNBcnJheShsYXRsbmdzWzBdKSkgeyAvLyBwb2x5bGluZVxuICAgICAgICBsYXRsbmdzID0gW2xhdGxuZ3NdO1xuICAgICAgICBkZXN0ICAgID0gW2Rlc3RdO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMCwgbGVuID0gcmluZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZGVzdFtpXSA9IGRlc3RbaV0gfHwgW107XG4gICAgICAgIGZvciAodmFyIGogPSAwLCBqaiA9IHJpbmdzW2ldLmxlbmd0aDsgaiA8IGpqOyBqKyspIHtcbiAgICAgICAgICBsYXRsbmcgICAgID0gbGF0bG5nc1tpXVtqXTtcbiAgICAgICAgICBkZXN0W2ldW2pdID0gcHJvamVjdGlvblxuICAgICAgICAgICAgLnVucHJvamVjdChwcm9qZWN0aW9uLnByb2plY3QobGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIHBhdGguX2JvdW5kcy5leHRlbmQobGF0bG5nc1tpXVtqXSk7XG4gICAgICAgICAgICByaW5nc1tpXVtqXS5fYWRkKHB4KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlc3Q7XG4gICAgLy8gY29uc29sZS50aW1lRW5kKCd0cmFuc2Zvcm0nKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIElmIHlvdSB3YW50IHRvIHJlYWQgdGhlIGxhdGxuZ3MgZHVyaW5nIHRoZSBkcmFnIC0geW91ciByaWdodCxcbiAgICogYnV0IHRoZXkgaGF2ZSB0byBiZSB0cmFuc2Zvcm1lZFxuICAgKi9cbiAgX3JlcGxhY2VDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZykgeyAvLyBDaXJjbGUsIENpcmNsZU1hcmtlclxuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdfID0gdGhpcy5fcGF0aC5nZXRMYXRMbmc7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZyA9IEwuVXRpbC5iaW5kKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuZHJhZ2dpbmcuX21hdHJpeCwge30pO1xuICAgICAgfSwgdGhpcy5fcGF0aCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ3MpIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nc18gPSB0aGlzLl9wYXRoLmdldExhdExuZ3M7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ3MgPSBMLlV0aWwuYmluZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZHJhZ2dpbmcuX3RyYW5zZm9ybVBvaW50cyh0aGlzLmRyYWdnaW5nLl9tYXRyaXgsIFtdKTtcbiAgICAgIH0sIHRoaXMuX3BhdGgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgYmFjayB0aGUgZ2V0dGVyc1xuICAgKi9cbiAgX3Jlc3RvcmVDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nID0gdGhpcy5fcGF0aC5nZXRMYXRMbmdfO1xuICAgICAgZGVsZXRlIHRoaXMuX3BhdGguZ2V0TGF0TG5nXztcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nc18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5ncyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5nc187XG4gICAgICBkZWxldGUgdGhpcy5fcGF0aC5nZXRMYXRMbmdzXztcbiAgICB9XG4gIH1cblxufSk7XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBhdGh9IGxheWVyXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlID0gZnVuY3Rpb24obGF5ZXIpIHtcbiAgbGF5ZXIuZHJhZ2dpbmcgPSBuZXcgTC5IYW5kbGVyLlBhdGhEcmFnKGxheWVyKTtcbiAgcmV0dXJuIGxheWVyO1xufTtcblxuXG4vKipcbiAqIEFsc28gZXhwb3NlIGFzIGEgbWV0aG9kXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuUGF0aC5wcm90b3R5cGUubWFrZURyYWdnYWJsZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUodGhpcyk7XG59O1xuXG5cbkwuUGF0aC5hZGRJbml0SG9vayhmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcbiAgICAvLyBlbnN1cmUgaW50ZXJhY3RpdmVcbiAgICB0aGlzLm9wdGlvbnMuaW50ZXJhY3RpdmUgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIEwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlKHRoaXMpO1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgIHRoaXMuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICB9XG59KTtcbiIsIi8qKlxuICogTGVhZmxldCB2ZWN0b3IgZmVhdHVyZXMgZHJhZyBmdW5jdGlvbmFsaXR5XG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBwcmVzZXJ2ZVxuICovXG5cbi8qKlxuICogTWF0cml4IHRyYW5zZm9ybSBwYXRoIGZvciBTVkcvVk1MXG4gKiBSZW5kZXJlci1pbmRlcGVuZGVudFxuICovXG5MLlBhdGguaW5jbHVkZSh7XG5cblx0LyoqXG5cdCAqIEFwcGxpZXMgbWF0cml4IHRyYW5zZm9ybWF0aW9uIHRvIFNWR1xuXHQgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+P30gbWF0cml4XG5cdCAqL1xuXHRfdHJhbnNmb3JtOiBmdW5jdGlvbihtYXRyaXgpIHtcblx0XHRpZiAodGhpcy5fcmVuZGVyZXIpIHtcblx0XHRcdGlmIChtYXRyaXgpIHtcblx0XHRcdFx0dGhpcy5fcmVuZGVyZXIudHJhbnNmb3JtUGF0aCh0aGlzLCBtYXRyaXgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gcmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHRcdFx0XHR0aGlzLl9yZW5kZXJlci5fcmVzZXRUcmFuc2Zvcm1QYXRoKHRoaXMpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoZSBmZWF0dXJlIHdhcyBkcmFnZ2VkLCB0aGF0J2xsIHN1cHJlc3MgdGhlIGNsaWNrIGV2ZW50XG5cdCAqIG9uIG1vdXNldXAuIFRoYXQgZml4ZXMgcG9wdXBzIGZvciBleGFtcGxlXG5cdCAqXG5cdCAqIEBwYXJhbSAge01vdXNlRXZlbnR9IGVcblx0ICovXG5cdF9vbk1vdXNlQ2xpY2s6IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoKHRoaXMuZHJhZ2dpbmcgJiYgdGhpcy5kcmFnZ2luZy5tb3ZlZCgpKSB8fFxuXHRcdFx0KHRoaXMuX21hcC5kcmFnZ2luZyAmJiB0aGlzLl9tYXAuZHJhZ2dpbmcubW92ZWQoKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9maXJlTW91c2VFdmVudChlKTtcblx0fVxuXG59KTtcbiIsIkwuU1ZHLmluY2x1ZGUoIUwuQnJvd3Nlci52bWwgPyB7fSA6IHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRpZiAobGF5ZXIuX3NrZXcpIHtcblx0XHRcdC8vIHN1cGVyIGltcG9ydGFudCEgd29ya2Fyb3VuZCBmb3IgYSAnanVtcGluZycgZ2xpdGNoOlxuXHRcdFx0Ly8gZGlzYWJsZSB0cmFuc2Zvcm0gYmVmb3JlIHJlbW92aW5nIGl0XG5cdFx0XHRsYXllci5fc2tldy5vbiA9IGZhbHNlO1xuXHRcdFx0bGF5ZXIuX3BhdGgucmVtb3ZlQ2hpbGQobGF5ZXIuX3NrZXcpO1xuXHRcdFx0bGF5ZXIuX3NrZXcgPSBudWxsO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gVk1MXG5cdCAqIEBwYXJhbSB7TC5QYXRofSAgICAgICAgIGxheWVyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuXHQgKi9cblx0dHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuXHRcdHZhciBza2V3ID0gbGF5ZXIuX3NrZXc7XG5cblx0XHRpZiAoIXNrZXcpIHtcblx0XHRcdHNrZXcgPSBMLlNWRy5jcmVhdGUoJ3NrZXcnKTtcblx0XHRcdGxheWVyLl9wYXRoLmFwcGVuZENoaWxkKHNrZXcpO1xuXHRcdFx0c2tldy5zdHlsZS5iZWhhdmlvciA9ICd1cmwoI2RlZmF1bHQjVk1MKSc7XG5cdFx0XHRsYXllci5fc2tldyA9IHNrZXc7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIHNrZXcvdHJhbnNsYXRlIHNlcGFyYXRlbHksIGNhdXNlIGl0J3MgYnJva2VuXG5cdFx0dmFyIG10ID0gbWF0cml4WzBdLnRvRml4ZWQoOCkgKyAnICcgKyBtYXRyaXhbMV0udG9GaXhlZCg4KSArICcgJyArXG5cdFx0XHRtYXRyaXhbMl0udG9GaXhlZCg4KSArICcgJyArIG1hdHJpeFszXS50b0ZpeGVkKDgpICsgJyAwIDAnO1xuXHRcdHZhciBvZmZzZXQgPSBNYXRoLmZsb29yKG1hdHJpeFs0XSkudG9GaXhlZCgpICsgJywgJyArXG5cdFx0XHRNYXRoLmZsb29yKG1hdHJpeFs1XSkudG9GaXhlZCgpICsgJyc7XG5cblx0XHR2YXIgcyA9IHRoaXMuX3BhdGguc3R5bGU7XG5cdFx0dmFyIGwgPSBwYXJzZUZsb2F0KHMubGVmdCk7XG5cdFx0dmFyIHQgPSBwYXJzZUZsb2F0KHMudG9wKTtcblx0XHR2YXIgdyA9IHBhcnNlRmxvYXQocy53aWR0aCk7XG5cdFx0dmFyIGggPSBwYXJzZUZsb2F0KHMuaGVpZ2h0KTtcblxuXHRcdGlmIChpc05hTihsKSkgICAgICAgbCA9IDA7XG5cdFx0aWYgKGlzTmFOKHQpKSAgICAgICB0ID0gMDtcblx0XHRpZiAoaXNOYU4odykgfHwgIXcpIHcgPSAxO1xuXHRcdGlmIChpc05hTihoKSB8fCAhaCkgaCA9IDE7XG5cblx0XHR2YXIgb3JpZ2luID0gKC1sIC8gdyAtIDAuNSkudG9GaXhlZCg4KSArICcgJyArICgtdCAvIGggLSAwLjUpLnRvRml4ZWQoOCk7XG5cblx0XHRza2V3Lm9uID0gJ2YnO1xuXHRcdHNrZXcubWF0cml4ID0gbXQ7XG5cdFx0c2tldy5vcmlnaW4gPSBvcmlnaW47XG5cdFx0c2tldy5vZmZzZXQgPSBvZmZzZXQ7XG5cdFx0c2tldy5vbiA9IHRydWU7XG5cdH1cblxufSk7XG4iLCJMLlNWRy5pbmNsdWRlKHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRsYXllci5fcGF0aC5zZXRBdHRyaWJ1dGVOUyhudWxsLCAndHJhbnNmb3JtJywgJycpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBTVkdcblx0ICogQHBhcmFtIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG5cdCAqL1xuXHR0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG5cdFx0bGF5ZXIuX3BhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgJ3RyYW5zZm9ybScsXG5cdFx0XHQnbWF0cml4KCcgKyBtYXRyaXguam9pbignICcpICsgJyknKTtcblx0fVxuXG59KTtcbiIsInZhciBMID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ0wnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ0wnXSA6IG51bGwpO1xuXG52YXIgQ2lyY2xlID0gbW9kdWxlLmV4cG9ydHMgPSBMLkNpcmNsZU1hcmtlci5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICB0ZXh0U3R5bGU6IHtcbiAgICAgIGNvbG9yOiAnI2ZmZicsXG4gICAgICBmb250U2l6ZTogMTIsXG4gICAgICBmb250V2VpZ2h0OiAzMDBcbiAgICB9LFxuICAgIHNoaWZ0WTogNyxcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY2xhc3MgTGFiZWxlZENpcmNsZVxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQGV4dGVuZHMge0wuQ2lyY2xlTWFya2VyfVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgdGV4dFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gbGF0bG5nXG4gICAqIEBwYXJhbSAge09iamVjdD19ICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbih0ZXh0LCBsYXRsbmcsIG9wdGlvbnMpIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHQgICAgICAgID0gdGV4dDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdUZXh0RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0RWxlbWVudCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VGV4dE5vZGV9XG4gICAgICovXG4gICAgdGhpcy5fdGV4dE5vZGUgICAgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdHxOdWxsfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHRMYXllciAgID0gbnVsbDtcblxuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkQ2lyY2xlfVxuICAgKi9cbiAgc2V0VGV4dDogZnVuY3Rpb24odGV4dCkge1xuICAgIHRoaXMuX3RleHQgPSB0ZXh0O1xuICAgIGlmICh0aGlzLl90ZXh0Tm9kZSkge1xuICAgICAgdGhpcy5fdGV4dEVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5fdGV4dE5vZGUpO1xuICAgIH1cbiAgICB0aGlzLl90ZXh0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3RleHRFbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuX3RleHROb2RlKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICovXG4gIGdldFRleHQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fdGV4dDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBBbHNvIGJyaW5nIHRleHQgdG8gZnJvbnRcbiAgICogQG92ZXJyaWRlXG4gICAqL1xuICBicmluZ1RvRnJvbnQ6IGZ1bmN0aW9uKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5icmluZ1RvRnJvbnQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIGJyaW5nVG9CYWNrOiBmdW5jdGlvbigpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuYnJpbmdUb0JhY2suY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgdGV4dCBpbiB0aGUgcmlnaHQgcG9zaXRpb24gaW4gdGhlIGRvbVxuICAgKi9cbiAgX2dyb3VwVGV4dFRvUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhdGggICAgICAgID0gdGhpcy5fcGF0aDtcbiAgICB2YXIgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICB2YXIgbmV4dCAgICAgICAgPSBwYXRoLm5leHRTaWJsaW5nO1xuICAgIHZhciBwYXJlbnQgICAgICA9IHBhdGgucGFyZW50Tm9kZTtcblxuXG4gICAgaWYgKHRleHRFbGVtZW50ICYmIHBhcmVudCkge1xuICAgICAgaWYgKG5leHQgJiYgbmV4dCAhPT0gdGV4dEVsZW1lbnQpIHtcbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZSh0ZXh0RWxlbWVudCwgbmV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodGV4dEVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQb3NpdGlvbiB0aGUgdGV4dCBpbiBjb250YWluZXJcbiAgICovXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbigpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuX3VwZGF0ZVBhdGguY2FsbCh0aGlzKTtcbiAgICB0aGlzLl91cGRhdGVUZXh0UG9zaXRpb24oKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIF90cmFuc2Zvcm06IGZ1bmN0aW9uKG1hdHJpeCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5fdHJhbnNmb3JtLmNhbGwodGhpcywgbWF0cml4KTtcblxuICAgIC8vIHdyYXAgdGV4dEVsZW1lbnQgd2l0aCBhIGZha2UgbGF5ZXIgZm9yIHJlbmRlcmVyXG4gICAgLy8gdG8gYmUgYWJsZSB0byB0cmFuc2Zvcm0gaXRcbiAgICB0aGlzLl90ZXh0TGF5ZXIgPSB0aGlzLl90ZXh0TGF5ZXIgfHwgeyBfcGF0aDogdGhpcy5fdGV4dEVsZW1lbnQgfTtcbiAgICBpZiAobWF0cml4KSB7XG4gICAgICB0aGlzLl9yZW5kZXJlci50cmFuc2Zvcm1QYXRoKHRoaXMuX3RleHRMYXllciwgbWF0cml4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVuZGVyZXIuX3Jlc2V0VHJhbnNmb3JtUGF0aCh0aGlzLl90ZXh0TGF5ZXIpO1xuICAgICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gICAgICB0aGlzLl90ZXh0TGF5ZXIgPSBudWxsO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge0xhYmVsZWRDaXJjbGV9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcbiAgICB0aGlzLl9pbml0VGV4dCgpO1xuICAgIHRoaXMuX3VwZGF0ZVRleHRQb3NpdGlvbigpO1xuICAgIHRoaXMuc2V0U3R5bGUoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW5kIGluc2VydCB0ZXh0XG4gICAqL1xuICBfaW5pdFRleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3RleHRFbGVtZW50ID0gTC5TVkcuY3JlYXRlKCd0ZXh0Jyk7XG4gICAgdGhpcy5zZXRUZXh0KHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9yb290R3JvdXAuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dEVsZW1lbnQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZSBwb3NpdGlvbiBmb3IgdGV4dFxuICAgKi9cbiAgX3VwZGF0ZVRleHRQb3NpdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRleHRFbGVtZW50ID0gdGhpcy5fdGV4dEVsZW1lbnQ7XG4gICAgaWYgKHRleHRFbGVtZW50KSB7XG4gICAgICB2YXIgYmJveCA9IHRleHRFbGVtZW50LmdldEJCb3goKTtcbiAgICAgIHZhciB0ZXh0UG9zaXRpb24gPSB0aGlzLl9wb2ludC5zdWJ0cmFjdChcbiAgICAgICAgTC5wb2ludChiYm94LndpZHRoLCAtYmJveC5oZWlnaHQgKyB0aGlzLm9wdGlvbnMuc2hpZnRZKS5kaXZpZGVCeSgyKSk7XG5cbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneCcsIHRleHRQb3NpdGlvbi54KTtcbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneScsIHRleHRQb3NpdGlvbi55KTtcbiAgICAgIHRoaXMuX2dyb3VwVGV4dFRvUGF0aCgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTZXQgdGV4dCBzdHlsZVxuICAgKi9cbiAgc2V0U3R5bGU6IGZ1bmN0aW9uKHN0eWxlKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLnNldFN0eWxlLmNhbGwodGhpcywgc3R5bGUpO1xuICAgIGlmICh0aGlzLl90ZXh0RWxlbWVudCkge1xuICAgICAgdmFyIHN0eWxlcyA9IHRoaXMub3B0aW9ucy50ZXh0U3R5bGU7XG4gICAgICBmb3IgKHZhciBwcm9wIGluIHN0eWxlcykge1xuICAgICAgICBpZiAoc3R5bGVzLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgdmFyIHN0eWxlUHJvcCA9IHByb3A7XG4gICAgICAgICAgaWYgKHByb3AgPT09ICdjb2xvcicpIHtcbiAgICAgICAgICAgIHN0eWxlUHJvcCA9ICdzdHJva2UnO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl90ZXh0RWxlbWVudC5zdHlsZVtzdHlsZVByb3BdID0gc3R5bGVzW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0ZXh0XG4gICAqL1xuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgaWYgKHRoaXMuX3RleHRFbGVtZW50KSB7XG4gICAgICBpZiAodGhpcy5fdGV4dEVsZW1lbnQucGFyZW50Tm9kZSkge1xuICAgICAgICB0aGlzLl90ZXh0RWxlbWVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3RleHRFbGVtZW50KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RleHRFbGVtZW50ID0gbnVsbDtcbiAgICAgIHRoaXMuX3RleHROb2RlID0gbnVsbDtcbiAgICAgIHRoaXMuX3RleHRMYXllciA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gIH1cblxufSk7XG5cblxuTC5UZXh0Q2lyY2xlID0gQ2lyY2xlO1xuTC50ZXh0Q2lyY2xlID0gZnVuY3Rpb24gKHRleHQsIGxhdGxuZywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IENpcmNsZSh0ZXh0LCBsYXRsbmcsIG9wdGlvbnMpO1xufTtcbiIsInZhciBMID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ0wnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ0wnXSA6IG51bGwpO1xudmFyIENpcmNsZSA9IHJlcXVpcmUoJy4vY2lyY2xlJyk7XG5yZXF1aXJlKCdsZWFmbGV0LXBhdGgtZHJhZycpO1xuXG52YXIgTGFiZWxlZE1hcmtlciA9IEwuRmVhdHVyZUdyb3VwLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtICB7TGFiZWxlZE1hcmtlcn0gbWFya2VyXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgZmVhdHVyZVxuICAgICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICAgKi9cbiAgICBnZXRMYWJlbFRleHQ6IGZ1bmN0aW9uKG1hcmtlciwgZmVhdHVyZSkge1xuICAgICAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy50ZXh0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHBhcmFtICB7TC5MYXRMbmd9ICAgICAgbGF0bG5nXG4gICAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAgICovXG4gICAgZ2V0TGFiZWxQb3NpdGlvbjogZnVuY3Rpb24obWFya2VyLCBmZWF0dXJlLCBsYXRsbmcpIHtcbiAgICAgIHJldHVybiBmZWF0dXJlLnByb3BlcnRpZXMubGFiZWxQb3NpdGlvbiA/XG4gICAgICAgIEwubGF0TG5nKGZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uLnNsaWNlKCkucmV2ZXJzZSgpKSA6XG4gICAgICAgIGxhdGxuZztcbiAgICB9LFxuXG4gICAgbGFiZWxQb3NpdGlvbktleTogJ2xhYmVsUG9zaXRpb24nLFxuXG4gICAgbWFya2VyT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGZpbGxPcGFjaXR5OiAwLjc1LFxuICAgICAgZHJhZ2dhYmxlOiB0cnVlLFxuICAgICAgcmFkaXVzOiAxNVxuICAgIH0sXG5cbiAgICBhbmNob3JPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyMwMGYnLFxuICAgICAgcmFkaXVzOiAzXG4gICAgfSxcblxuICAgIGxpbmVPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyNmMDAnLFxuICAgICAgZGFzaEFycmF5OiBbMiwgNl0sXG4gICAgICBsaW5lQ2FwOiAnc3F1YXJlJyxcbiAgICAgIHdlaWdodDogMlxuICAgIH1cblxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjbGFzcyBMYWJlbGVkTWFya2VyXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7TC5GZWF0dXJlR3JvdXB9XG4gICAqXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBsYXRsbmdcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIGZlYXR1cmVcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB0aGlzLmZlYXR1cmUgPSBmZWF0dXJlIHx8IHtcbiAgICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgJ3R5cGUnOiAnUG9pbnQnXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ31cbiAgICAgKi9cbiAgICB0aGlzLl9sYXRsbmcgPSBsYXRsbmc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDaXJjbGVMYWJlbH1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXJrZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5DaXJjbGVNYXJrZXJ9XG4gICAgICovXG4gICAgdGhpcy5fYW5jaG9yID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9seWxpbmV9XG4gICAgICovXG4gICAgdGhpcy5fbGluZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2luaXRpYWxEaXN0YW5jZSA9IG51bGw7XG5cbiAgICB0aGlzLl9jcmVhdGVMYXllcnMoKTtcbiAgICBMLkxheWVyR3JvdXAucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLFxuICAgICAgW3RoaXMuX2FuY2hvciwgdGhpcy5fbGluZSwgdGhpcy5fbWFya2VyXSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICBnZXRMYWJlbFBvc2l0aW9uOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFya2VyLmdldExhdExuZygpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgZ2V0TGF0TG5nOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbGF0bG5nO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICB0b0dlb0pTT046IGZ1bmN0aW9uKGdlb21ldHJ5Q29sbGVjdGlvbikge1xuICAgIHZhciBmZWF0dXJlID0gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xuICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgIGNvb3JkaW5hdGVzOiBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5fYW5jaG9yLmdldExhdExuZygpKVxuICAgIH0pO1xuICAgIGZlYXR1cmUucHJvcGVydGllc1t0aGlzLm9wdGlvbnMubGFiZWxQb3NpdGlvbktleV0gPVxuICAgICAgTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKSk7XG4gICAgZmVhdHVyZS5wcm9wZXJ0aWVzLnRleHQgPSB0aGlzLl9tYXJrZXIuZ2V0VGV4dCgpO1xuICAgIHJldHVybiBnZW9tZXRyeUNvbGxlY3Rpb24gP1xuICAgICAgTC5MYWJlbGVkQ2lyY2xlTWFya2VyXG4gICAgICAgIC50b0dlb21ldHJ5Q29sbGVjdGlvbihmZWF0dXJlLCB0aGlzLm9wdGlvbnMubGFiZWxQb3NpdGlvbktleSkgOiBmZWF0dXJlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge0xhYmVsZWRNYXJrZXJ9XG4gICAqL1xuICBzZXRUZXh0OiBmdW5jdGlvbih0ZXh0KSB7XG4gICAgdGhpcy5fbWFya2VyLnNldFRleHQodGV4dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbmNob3IsIGxpbmUgYW5kIGxhYmVsXG4gICAqL1xuICBfY3JlYXRlTGF5ZXJzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgb3B0cyA9IHRoaXMub3B0aW9ucztcbiAgICB2YXIgcG9zICA9IG9wdHMuZ2V0TGFiZWxQb3NpdGlvbih0aGlzLCB0aGlzLmZlYXR1cmUsIHRoaXMuX2xhdGxuZyk7XG4gICAgdmFyIHRleHQgPSBvcHRzLmdldExhYmVsVGV4dCh0aGlzLCB0aGlzLmZlYXR1cmUpO1xuXG4gICAgaWYgKCdkcmFnZ2FibGUnIGluIG9wdHMpIHtcbiAgICAgIG9wdHMubWFya2VyT3B0aW9ucy5kcmFnZ2FibGUgPSBvcHRzLmRyYWdnYWJsZTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXJrZXIgPSBuZXcgQ2lyY2xlKHRleHQsIHBvcyxcbiAgICAgIEwuVXRpbC5leHRlbmQoe1xuICAgICAgICBpbnRlcmFjdGl2ZTogdGhpcy5vcHRpb25zLmludGVyYWN0aXZlXG4gICAgICB9LFxuICAgICAgICBMYWJlbGVkTWFya2VyLnByb3RvdHlwZS5vcHRpb25zLm1hcmtlck9wdGlvbnMsXG4gICAgICAgIG9wdHMubWFya2VyT3B0aW9ucylcbiAgICApLm9uKCdkcmFnJywgICAgICB0aGlzLl9vbk1hcmtlckRyYWcsICAgICAgdGhpcylcbiAgICAgLm9uKCdkcmFnc3RhcnQnLCB0aGlzLl9vbk1hcmtlckRyYWdTdGFydCwgdGhpcylcbiAgICAgLm9uKCdkcmFnZW5kJywgICB0aGlzLl9vbk1hcmtlckRyYWdFbmQsICAgdGhpcyk7XG5cbiAgICB0aGlzLl9hbmNob3IgPSBuZXcgTC5DaXJjbGVNYXJrZXIodGhpcy5fbGF0bG5nLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSwgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5hbmNob3JPcHRpb25zLFxuICAgICAgICBvcHRzLmFuY2hvck9wdGlvbnMpKTtcblxuICAgIHRoaXMuX2xpbmUgPSBuZXcgTC5Qb2x5bGluZShbdGhpcy5fbGF0bG5nLCB0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCldLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSwgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5saW5lT3B0aW9ucyxcbiAgICAgICAgb3B0cy5saW5lT3B0aW9ucykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFN0b3JlIHNoaWZ0IHRvIGJlIHByZWNpc2Ugd2hpbGUgZHJhZ2dpbmdcbiAgICogQHBhcmFtICB7RXZlbnR9IGV2dFxuICAgKi9cbiAgX29uTWFya2VyRHJhZ1N0YXJ0OiBmdW5jdGlvbihldnQpIHtcbiAgICB0aGlzLl9pbml0aWFsRGlzdGFuY2UgPSBMLkRvbUV2ZW50LmdldE1vdXNlUG9zaXRpb24oZXZ0KVxuICAgICAgLnN1YnRyYWN0KHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKSkpO1xuICAgIHRoaXMuZmlyZSgnbGFiZWw6JyArIGV2dC50eXBlLCBldnQpO1xuICAgIC8vTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUodGhpcy5fbWFya2VyLmJyaW5nVG9Gcm9udCwgdGhpcy5fbWFya2VyKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBMaW5lIGRyYWdnaW5nXG4gICAqIEBwYXJhbSAge0RyYWdFdmVudH0gZXZ0XG4gICAqL1xuICBfb25NYXJrZXJEcmFnOiBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgbGF0bG5nID0gdGhpcy5fbWFwLmNvbnRhaW5lclBvaW50VG9MYXRMbmcoXG4gICAgICBMLkRvbUV2ZW50LmdldE1vdXNlUG9zaXRpb24oZXZ0KS5fc3VidHJhY3QodGhpcy5faW5pdGlhbERpc3RhbmNlKSk7XG4gICAgdGhpcy5fbGluZS5zZXRMYXRMbmdzKFtsYXRsbmcsIHRoaXMuX2xhdGxuZ10pO1xuICAgIHRoaXMuZmlyZSgnbGFiZWw6JyArIGV2dC50eXBlLCBldnQpO1xuICB9LFxuXG5cbiAgX29uTWFya2VyRHJhZ0VuZDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdGhpcy5fbGluZS5zZXRMYXRMbmdzKFt0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCksIHRoaXMuX2xhdGxuZ10pO1xuICAgIHRoaXMuZmlyZSgnbGFiZWw6JyArIGV2dC50eXBlLCBldnQpO1xuICB9LFxuXG5cbiAgZW5hYmxlRHJhZ2dpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fbWFya2VyLmRyYWdnaW5nKSB0aGlzLl9tYXJrZXIuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICBkaXNhYmxlRHJhZ2dpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fbWFya2VyLmRyYWdnaW5nKSB0aGlzLl9tYXJrZXIuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbn0pO1xuXG5cbi8qKlxuICogQHBhcmFtICB7T2JqZWN0fSBmZWF0dXJlXG4gKiBAcGFyYW0gIHtTdHJpbmc9fSBrZXlcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gdG9HZW9tZXRyeUNvbGxlY3Rpb24oZmVhdHVyZSwga2V5KSB7XG4gIGtleSA9IGtleSB8fCAnbGFiZWxQb3NpdGlvbic7XG4gIHZhciBhbmNob3JQb3MgPSBmZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzLnNsaWNlKCk7XG4gIHZhciBsYWJlbFBvcyAgPSBmZWF0dXJlLnByb3BlcnRpZXNba2V5XTtcblxuICBpZiAoIWxhYmVsUG9zKSB0aHJvdyBuZXcgRXJyb3IoJ05vIGxhYmVsIHBvc2l0aW9uIHNldCcpO1xuXG4gIGxhYmVsUG9zID0gbGFiZWxQb3Muc2xpY2UoKTtcbiAgdmFyIGdlb21ldHJpZXMgPSBbe1xuICAgIHR5cGU6ICdQb2ludCcsXG4gICAgY29vcmRpbmF0ZXM6IGFuY2hvclBvc1xuICB9LCB7XG4gICAgdHlwZTogJ0xpbmVTdHJpbmcnLFxuICAgIGNvb3JkaW5hdGVzOiBbXG4gICAgICBhbmNob3JQb3Muc2xpY2UoKSxcbiAgICAgIGxhYmVsUG9zXG4gICAgXVxuICB9LCB7XG4gICAgdHlwZTogJ1BvaW50JyxcbiAgICBjb29yZGluYXRlczogbGFiZWxQb3Muc2xpY2UoKVxuICB9LCB7XG4gICAgdHlwZTogJ1BvaW50JyxcbiAgICBjb29yZGluYXRlczogbGFiZWxQb3Muc2xpY2UoKVxuICB9XTtcblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICBwcm9wZXJ0aWVzOiBMLlV0aWwuZXh0ZW5kKHt9LCBmZWF0dXJlLnByb3BlcnRpZXMsIHtcbiAgICAgIGdlb21ldHJpZXNUeXBlczogWydhbmNob3InLCAnY29ubmVjdGlvbicsICdsYWJlbCcsICd0ZXh0Ym94J11cbiAgICB9KSxcbiAgICBiYm94OiBmZWF0dXJlLmJib3gsXG4gICAgZ2VvbWV0cnk6IHtcbiAgICAgIHR5cGU6ICdHZW9tZXRyeUNvbGxlY3Rpb24nLFxuICAgICAgZ2VvbWV0cmllczogZ2VvbWV0cmllc1xuICAgIH1cbiAgfTtcbn1cblxuTGFiZWxlZE1hcmtlci50b0dlb21ldHJ5Q29sbGVjdGlvbiA9IHRvR2VvbWV0cnlDb2xsZWN0aW9uO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuTGFiZWxlZENpcmNsZU1hcmtlciA9IExhYmVsZWRNYXJrZXI7XG5MLmxhYmVsZWRDaXJjbGVNYXJrZXIgPSBmdW5jdGlvbihsYXRsbmcsIGZlYXR1cmUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMYWJlbGVkTWFya2VyKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucyk7XG59O1xuIl19
