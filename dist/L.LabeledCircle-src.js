(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).LabeledCircleMarker = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
    if (!this._containerCopy) {
      return;
    }

    delete this._containerCopy;

    if (layer._containsPoint_) {
      layer._containsPoint = layer._containsPoint_;
      delete layer._containsPoint_;

      this._requestRedraw(layer);
      this._draw(true);
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
   * @param  {L.Path} layer
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
 * Leaflet vector features drag functionality
 * @preserve
 */

"use strict";

/**
 * Drag handler
 * @class L.Path.Drag
 * @extends {L.Handler}
 */
L.Handler.PathDrag = L.Handler.extend( /** @lends  L.Path.Drag.prototype */ {

  statics: {
    DRAGGING_CLS: 'leaflet-path-draggable'
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
      .on(document, L.Draggable.MOVE[eventType], this._onDrag, this)
      .on(document, L.Draggable.END[eventType], this._onDragEnd, this);

    if (this._path._map.dragging.enabled()) {
      // I guess it's required because mousdown gets simulated with a delay
      this._path._map.dragging._draggable._onUp();

      this._path._map.dragging.disable();
      this._mapDraggingWasEnabled = true;
    }
    this._path._dragMoved = false;

    if (this._path._popup) { // that might be a case on touch devices as well
      this._path._popup._close();
    }
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
    var eventType = evt.type;
    var containerPoint = this._path._map.mouseEventToContainerPoint(evt);

    // apply matrix
    if (this.moved()) {
      this._transformPoints(this._matrix);
      this._path._project();
      this._path._transform(null);
    }

    L.DomEvent
      .off(document, 'mousemove touchmove', this._onDrag, this)
      .off(document, 'mouseup touchend', this._onDragEnd, this);

    // consistency
    this._path.fire('dragend', {
      distance: Math.sqrt(
        L.LineUtil._sqDist(this._dragStartPoint, containerPoint)
      )
    });

    this._matrix = null;
    this._startPoint = null;
    this._dragStartPoint = null;

    if (this._mapDraggingWasEnabled) {
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
  _transformPoints: function(matrix) {
    var path = this._path;
    var i, len, latlng;

    var px = L.point(matrix[4], matrix[5]);

    var crs = path._map.options.crs;
    var transformation = crs.transformation;
    var scale = crs.scale(path._map.getZoom());
    var projection = crs.projection;

    var diff = transformation.untransform(px, scale)
      .subtract(transformation.untransform(L.point(0, 0), scale));

    path._bounds = new L.LatLngBounds();

    // console.time('transform');
    // all shifts are in-place
    if (path._point) { // L.Circle
      path._latlng = projection.unproject(
        projection.project(path._latlng)._add(diff));
      path._point._add(px);
    } else if (path._rings || path._parts) { // everything else
      var rings = path._rings || path._parts;
      var latlngs = path._latlngs;
      if (!L.Util.isArray(latlngs[0])) { // polyline
        latlngs = [latlngs];
      }
      for (i = 0, len = rings.length; i < len; i++) {
        for (var j = 0, jj = rings[i].length; j < jj; j++) {
          latlng = latlngs[i][j];
          latlngs[i][j] = projection
            .unproject(projection.project(latlng)._add(diff));
          path._bounds.extend(latlngs[i][j]);
          rings[i][j]._add(px);
        }
      }
    }
    // console.timeEnd('transform');

    path._updatePath();
  }

});

L.Path.addInitHook(function() {
  if (this.options.draggable) {
    // ensure interactive
    this.options.interactive = true;

    if (this.dragging) {
      this.dragging.enable();
    } else {
      this.dragging = new L.Handler.PathDrag(this);
      this.dragging.enable();
    }
  } else if (this.dragging) {
    this.dragging.disable();
  }
});

},{}],5:[function(require,module,exports){
/**
 * Matrix transform path for SVG/VML
 */

// Renderer-independent
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
		var mt = matrix[0].toFixed(8) + " " + matrix[1].toFixed(8) + " " +
			matrix[2].toFixed(8) + " " + matrix[3].toFixed(8) + " 0 0";
		var offset = Math.floor(matrix[4]).toFixed() + ", " +
			Math.floor(matrix[5]).toFixed() + "";

		var s = this._path.style;
		var l = parseFloat(s.left);
		var t = parseFloat(s.top);
		var w = parseFloat(s.width);
		var h = parseFloat(s.height);

		if (isNaN(l)) l = 0;
		if (isNaN(t)) t = 0;
		if (isNaN(w) || !w) w = 1;
		if (isNaN(h) || !h) h = 1;

		var origin = (-l / w - 0.5).toFixed(8) + " " + (-t / h - 0.5).toFixed(8);

		skew.on = "f";
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
		layer._path.setAttributeNS(null, "transform",
			'matrix(' + matrix.join(' ') + ')');
	}

});

},{}],8:[function(require,module,exports){
'use strict';

var L = require('leaflet');

module.exports = L.CircleMarker.extend({

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

},{"leaflet":undefined}],9:[function(require,module,exports){
'use strict';

var L = require('leaflet');
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
  toGeoJSON: function toGeoJSON() {
    var feature = L.GeoJSON.getFeature(this, {
      type: 'Point',
      coordinates: L.GeoJSON.latLngToCoords(this._anchor.getLatLng())
    });
    feature.properties[this.options.labelPositionKey] = L.GeoJSON.latLngToCoords(this._marker.getLatLng());
    return feature;
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

    this._marker = new Circle(text, pos, L.Util.extend({}, LabeledMarker.prototype.options.markerOptions, opts.markerOptions)).on('drag', this._onMarkerDrag, this).on('dragstart', this._onMarkerDragStart, this);

    this._anchor = new L.CircleMarker(this._latlng, L.Util.extend({}, LabeledMarker.prototype.options.anchorOptions, opts.anchorOptions));

    this._line = new L.Polyline([this._latlng, this._marker.getLatLng()], L.Util.extend({}, LabeledMarker.prototype.options.lineOptions, opts.lineOptions));
  },

  /**
   * Store shift to be precise while dragging
   * @param  {Event} evt
   */
  _onMarkerDragStart: function _onMarkerDragStart(evt) {
    this._initialDistance = L.DomEvent.getMousePosition(evt).subtract(this._map.latLngToContainerPoint(this._marker.getLatLng()));
    //L.Util.requestAnimFrame(this._marker.bringToFront, this._marker);
  },

  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag: function _onMarkerDrag(evt) {
    var latlng = this._map.containerPointToLatLng(L.DomEvent.getMousePosition(evt)._subtract(this._initialDistance));
    this._line.setLatLngs([latlng, this._latlng]);
  }

});

module.exports = L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

},{"./circle":8,"leaflet":undefined,"leaflet-path-drag":2}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvQ2FudmFzLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9QYXRoLkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuVk1MLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuanMiLCJzcmMvY2lyY2xlLmpzIiwic3JjL21hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7OztBQ09BLE9BQU8sT0FBUCxHQUFpQixRQUFRLGNBQVIsQ0FBakI7OztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QjtBQUNqQixFQUFFLG1CQUFGLEdBQXdCLFVBQVMsTUFBVCxFQUFpQixPQUFqQixFQUEwQixPQUExQixFQUFtQztBQUN6RCxTQUFPLElBQUksYUFBSixDQUFrQixNQUFsQixFQUEwQixPQUExQixFQUFtQyxPQUFuQyxDQUFQLENBRHlEO0NBQW5DIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogTGVhZmxldCBTVkcgY2lyY2xlIG1hcmtlciB3aXRoIGRldGFjaGFibGUgYW5kIGRyYWdnYWJsZSBsYWJlbCBhbmQgdGV4dFxuICpcbiAqIEBhdXRob3IgQWxleGFuZGVyIE1pbGV2c2tpIDxpbmZvQHc4ci5uYW1lPlxuICogQGxpY2Vuc2UgTUlUXG4gKiBAcHJlc2VydmVcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9tYXJrZXInKTtcbiIsInJlcXVpcmUoJy4vc3JjL1NWRycpO1xucmVxdWlyZSgnLi9zcmMvU1ZHLlZNTCcpO1xucmVxdWlyZSgnLi9zcmMvQ2FudmFzJyk7XG5yZXF1aXJlKCcuL3NyYy9QYXRoLlRyYW5zZm9ybScpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5EcmFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5QYXRoLkRyYWc7XG4iLCJMLlV0aWwudHJ1ZUZuID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuTC5DYW52YXMuaW5jbHVkZSh7XG5cbiAgLyoqXG4gICAqIERvIG5vdGhpbmdcbiAgICogQHBhcmFtICB7TC5QYXRofSBsYXllclxuICAgKi9cbiAgX3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBpZiAoIXRoaXMuX2NvbnRhaW5lckNvcHkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5fY29udGFpbmVyQ29weTtcblxuICAgIGlmIChsYXllci5fY29udGFpbnNQb2ludF8pIHtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50ID0gbGF5ZXIuX2NvbnRhaW5zUG9pbnRfO1xuICAgICAgZGVsZXRlIGxheWVyLl9jb250YWluc1BvaW50XztcblxuICAgICAgdGhpcy5fcmVxdWVzdFJlZHJhdyhsYXllcik7XG4gICAgICB0aGlzLl9kcmF3KHRydWUpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQWxnb3JpdGhtIG91dGxpbmU6XG4gICAqXG4gICAqIDEuIHByZS10cmFuc2Zvcm0gLSBjbGVhciB0aGUgcGF0aCBvdXQgb2YgdGhlIGNhbnZhcywgY29weSBjYW52YXMgc3RhdGVcbiAgICogMi4gYXQgZXZlcnkgZnJhbWU6XG4gICAqICAgIDIuMS4gc2F2ZVxuICAgKiAgICAyLjIuIHJlZHJhdyB0aGUgY2FudmFzIGZyb20gc2F2ZWQgb25lXG4gICAqICAgIDIuMy4gdHJhbnNmb3JtXG4gICAqICAgIDIuNC4gZHJhdyBwYXRoXG4gICAqICAgIDIuNS4gcmVzdG9yZVxuICAgKlxuICAgKiBAcGFyYW0gIHtMLlBhdGh9IGxheWVyXG4gICAqIEBwYXJhbSAge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcbiAgICovXG4gIHRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyLCBtYXRyaXgpIHtcbiAgICB2YXIgY29weSA9IHRoaXMuX2NvbnRhaW5lckNvcHk7XG4gICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcbiAgICB2YXIgbSA9IEwuQnJvd3Nlci5yZXRpbmEgPyAyIDogMTtcbiAgICB2YXIgYm91bmRzID0gdGhpcy5fYm91bmRzO1xuICAgIHZhciBzaXplID0gYm91bmRzLmdldFNpemUoKTtcbiAgICB2YXIgcG9zID0gYm91bmRzLm1pbjtcblxuICAgIGlmICghY29weSkge1xuICAgICAgY29weSA9IHRoaXMuX2NvbnRhaW5lckNvcHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY29weSk7XG5cbiAgICAgIGNvcHkud2lkdGggPSBtICogc2l6ZS54O1xuICAgICAgY29weS5oZWlnaHQgPSBtICogc2l6ZS55O1xuXG4gICAgICBsYXllci5fcmVtb3ZlZCA9IHRydWU7XG4gICAgICB0aGlzLl9yZWRyYXcoKTtcblxuICAgICAgY29weS5nZXRDb250ZXh0KCcyZCcpLnRyYW5zbGF0ZShtICogYm91bmRzLm1pbi54LCBtICogYm91bmRzLm1pbi55KTtcbiAgICAgIGNvcHkuZ2V0Q29udGV4dCgnMmQnKS5kcmF3SW1hZ2UodGhpcy5fY29udGFpbmVyLCAwLCAwKTtcbiAgICAgIHRoaXMuX2luaXRQYXRoKGxheWVyKTtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50XyA9IGxheWVyLl9jb250YWluc1BvaW50O1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnQgPSBMLlV0aWwudHJ1ZUZuO1xuICAgIH1cblxuICAgIGN0eC5zYXZlKCk7XG4gICAgY3R4LmNsZWFyUmVjdChwb3MueCwgcG9zLnksIHNpemUueCAqIG0sIHNpemUueSAqIG0pO1xuICAgIGN0eC5zZXRUcmFuc2Zvcm0oMSwgMCwgMCwgMSwgMCwgMCk7XG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgICBjdHguc2F2ZSgpO1xuXG4gICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9jb250YWluZXJDb3B5LCAwLCAwLCBzaXplLngsIHNpemUueSk7XG4gICAgY3R4LnRyYW5zZm9ybS5hcHBseShjdHgsIG1hdHJpeCk7XG5cbiAgICB2YXIgbGF5ZXJzID0gdGhpcy5fbGF5ZXJzO1xuICAgIHRoaXMuX2xheWVycyA9IHt9O1xuXG4gICAgdGhpcy5faW5pdFBhdGgobGF5ZXIpO1xuICAgIGxheWVyLl91cGRhdGVQYXRoKCk7XG5cbiAgICB0aGlzLl9sYXllcnMgPSBsYXllcnM7XG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgfVxuXG59KTtcbiIsIi8qKlxuICogTGVhZmxldCB2ZWN0b3IgZmVhdHVyZXMgZHJhZyBmdW5jdGlvbmFsaXR5XG4gKiBAcHJlc2VydmVcbiAqL1xuXG5cInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBEcmFnIGhhbmRsZXJcbiAqIEBjbGFzcyBMLlBhdGguRHJhZ1xuICogQGV4dGVuZHMge0wuSGFuZGxlcn1cbiAqL1xuTC5IYW5kbGVyLlBhdGhEcmFnID0gTC5IYW5kbGVyLmV4dGVuZCggLyoqIEBsZW5kcyAgTC5QYXRoLkRyYWcucHJvdG90eXBlICovIHtcblxuICBzdGF0aWNzOiB7XG4gICAgRFJBR0dJTkdfQ0xTOiAnbGVhZmxldC1wYXRoLWRyYWdnYWJsZSdcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBhdGh9IHBhdGhcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihwYXRoKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5QYXRofVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGggPSBwYXRoO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0FycmF5LjxOdW1iZXI+fVxuICAgICAqL1xuICAgIHRoaXMuX21hdHJpeCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IGZhbHNlO1xuXG4gIH0sXG5cbiAgLyoqXG4gICAqIEVuYWJsZSBkcmFnZ2luZ1xuICAgKi9cbiAgYWRkSG9va3M6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGgub24oJ21vdXNlZG93bicsIHRoaXMuX29uRHJhZ1N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgPSB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID9cbiAgICAgICAgKHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgKyAnICcgKyBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKSA6XG4gICAgICAgICBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX3BhdGgpIHtcbiAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoLl9wYXRoLCBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIERpc2FibGUgZHJhZ2dpbmdcbiAgICovXG4gIHJlbW92ZUhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoLm9mZignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA9IHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWVcbiAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoJ1xcXFxzKycgKyBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKSwgJycpO1xuICAgIGlmICh0aGlzLl9wYXRoLl9wYXRoKSB7XG4gICAgICBMLkRvbVV0aWwucmVtb3ZlQ2xhc3ModGhpcy5fcGF0aC5fcGF0aCwgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgbW92ZWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXRoLl9kcmFnTW92ZWQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFN0YXJ0IGRyYWdcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWdTdGFydDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGV2ZW50VHlwZSA9IGV2dC5vcmlnaW5hbEV2ZW50Ll9zaW11bGF0ZWQgPyAndG91Y2hzdGFydCcgOiBldnQub3JpZ2luYWxFdmVudC50eXBlO1xuXG4gICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gZmFsc2U7XG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IGV2dC5jb250YWluZXJQb2ludC5jbG9uZSgpO1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gZXZ0LmNvbnRhaW5lclBvaW50LmNsb25lKCk7XG4gICAgdGhpcy5fbWF0cml4ID0gWzEsIDAsIDAsIDEsIDAsIDBdO1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQub3JpZ2luYWxFdmVudCk7XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aC5fcmVuZGVyZXIuX2NvbnRhaW5lciwgJ2xlYWZsZXQtaW50ZXJhY3RpdmUnKTtcbiAgICBMLkRvbUV2ZW50XG4gICAgICAub24oZG9jdW1lbnQsIEwuRHJhZ2dhYmxlLk1PVkVbZXZlbnRUeXBlXSwgdGhpcy5fb25EcmFnLCB0aGlzKVxuICAgICAgLm9uKGRvY3VtZW50LCBMLkRyYWdnYWJsZS5FTkRbZXZlbnRUeXBlXSwgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgIGlmICh0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlZCgpKSB7XG4gICAgICAvLyBJIGd1ZXNzIGl0J3MgcmVxdWlyZWQgYmVjYXVzZSBtb3VzZG93biBnZXRzIHNpbXVsYXRlZCB3aXRoIGEgZGVsYXlcbiAgICAgIHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlLl9vblVwKCk7XG5cbiAgICAgIHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5kaXNhYmxlKCk7XG4gICAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLl9wYXRoLl9wb3B1cCkgeyAvLyB0aGF0IG1pZ2h0IGJlIGEgY2FzZSBvbiB0b3VjaCBkZXZpY2VzIGFzIHdlbGxcbiAgICAgIHRoaXMuX3BhdGguX3BvcHVwLl9jbG9zZSgpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogRHJhZ2dpbmdcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQpO1xuXG4gICAgdmFyIGZpcnN0ID0gKGV2dC50b3VjaGVzICYmIGV2dC50b3VjaGVzLmxlbmd0aCA+PSAxID8gZXZ0LnRvdWNoZXNbMF0gOiBldnQpO1xuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX3BhdGguX21hcC5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChmaXJzdCk7XG5cbiAgICB2YXIgeCA9IGNvbnRhaW5lclBvaW50Lng7XG4gICAgdmFyIHkgPSBjb250YWluZXJQb2ludC55O1xuXG4gICAgdmFyIGR4ID0geCAtIHRoaXMuX3N0YXJ0UG9pbnQueDtcbiAgICB2YXIgZHkgPSB5IC0gdGhpcy5fc3RhcnRQb2ludC55O1xuXG4gICAgaWYgKCF0aGlzLl9wYXRoLl9kcmFnTW92ZWQgJiYgKGR4IHx8IGR5KSkge1xuICAgICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZ3N0YXJ0JywgZXZ0KTtcbiAgICAgIC8vIHdlIGRvbid0IHdhbnQgdGhhdCB0byBoYXBwZW4gb24gY2xpY2tcbiAgICAgIHRoaXMuX3BhdGguYnJpbmdUb0Zyb250KCk7XG4gICAgfVxuXG4gICAgdGhpcy5fbWF0cml4WzRdICs9IGR4O1xuICAgIHRoaXMuX21hdHJpeFs1XSArPSBkeTtcblxuICAgIHRoaXMuX3N0YXJ0UG9pbnQueCA9IHg7XG4gICAgdGhpcy5fc3RhcnRQb2ludC55ID0geTtcblxuICAgIHRoaXMuX3BhdGguZmlyZSgncHJlZHJhZycsIGV2dCk7XG4gICAgdGhpcy5fcGF0aC5fdHJhbnNmb3JtKHRoaXMuX21hdHJpeCk7XG4gICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnJywgZXZ0KTtcbiAgfSxcblxuICAvKipcbiAgICogRHJhZ2dpbmcgc3RvcHBlZCwgYXBwbHlcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWdFbmQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBldmVudFR5cGUgPSBldnQudHlwZTtcbiAgICB2YXIgY29udGFpbmVyUG9pbnQgPSB0aGlzLl9wYXRoLl9tYXAubW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQoZXZ0KTtcblxuICAgIC8vIGFwcGx5IG1hdHJpeFxuICAgIGlmICh0aGlzLm1vdmVkKCkpIHtcbiAgICAgIHRoaXMuX3RyYW5zZm9ybVBvaW50cyh0aGlzLl9tYXRyaXgpO1xuICAgICAgdGhpcy5fcGF0aC5fcHJvamVjdCgpO1xuICAgICAgdGhpcy5fcGF0aC5fdHJhbnNmb3JtKG51bGwpO1xuICAgIH1cblxuICAgIEwuRG9tRXZlbnRcbiAgICAgIC5vZmYoZG9jdW1lbnQsICdtb3VzZW1vdmUgdG91Y2htb3ZlJywgdGhpcy5fb25EcmFnLCB0aGlzKVxuICAgICAgLm9mZihkb2N1bWVudCwgJ21vdXNldXAgdG91Y2hlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgLy8gY29uc2lzdGVuY3lcbiAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWdlbmQnLCB7XG4gICAgICBkaXN0YW5jZTogTWF0aC5zcXJ0KFxuICAgICAgICBMLkxpbmVVdGlsLl9zcURpc3QodGhpcy5fZHJhZ1N0YXJ0UG9pbnQsIGNvbnRhaW5lclBvaW50KVxuICAgICAgKVxuICAgIH0pO1xuXG4gICAgdGhpcy5fbWF0cml4ID0gbnVsbDtcbiAgICB0aGlzLl9zdGFydFBvaW50ID0gbnVsbDtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICBpZiAodGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkKSB7XG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBBcHBsaWVzIHRyYW5zZm9ybWF0aW9uLCBkb2VzIGl0IGluIG9uZSBzd2VlcCBmb3IgcGVyZm9ybWFuY2UsXG4gICAqIHNvIGRvbid0IGJlIHN1cnByaXNlZCBhYm91dCB0aGUgY29kZSByZXBldGl0aW9uLlxuICAgKlxuICAgKiBbIHggXSAgIFsgYSAgYiAgdHggXSBbIHggXSAgIFsgYSAqIHggKyBiICogeSArIHR4IF1cbiAgICogWyB5IF0gPSBbIGMgIGQgIHR5IF0gWyB5IF0gPSBbIGMgKiB4ICsgZCAqIHkgKyB0eSBdXG4gICAqXG4gICAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuICAgKi9cbiAgX3RyYW5zZm9ybVBvaW50czogZnVuY3Rpb24obWF0cml4KSB7XG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoO1xuICAgIHZhciBpLCBsZW4sIGxhdGxuZztcblxuICAgIHZhciBweCA9IEwucG9pbnQobWF0cml4WzRdLCBtYXRyaXhbNV0pO1xuXG4gICAgdmFyIGNycyA9IHBhdGguX21hcC5vcHRpb25zLmNycztcbiAgICB2YXIgdHJhbnNmb3JtYXRpb24gPSBjcnMudHJhbnNmb3JtYXRpb247XG4gICAgdmFyIHNjYWxlID0gY3JzLnNjYWxlKHBhdGguX21hcC5nZXRab29tKCkpO1xuICAgIHZhciBwcm9qZWN0aW9uID0gY3JzLnByb2plY3Rpb247XG5cbiAgICB2YXIgZGlmZiA9IHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB4LCBzY2FsZSlcbiAgICAgIC5zdWJ0cmFjdCh0cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShMLnBvaW50KDAsIDApLCBzY2FsZSkpO1xuXG4gICAgcGF0aC5fYm91bmRzID0gbmV3IEwuTGF0TG5nQm91bmRzKCk7XG5cbiAgICAvLyBjb25zb2xlLnRpbWUoJ3RyYW5zZm9ybScpO1xuICAgIC8vIGFsbCBzaGlmdHMgYXJlIGluLXBsYWNlXG4gICAgaWYgKHBhdGguX3BvaW50KSB7IC8vIEwuQ2lyY2xlXG4gICAgICBwYXRoLl9sYXRsbmcgPSBwcm9qZWN0aW9uLnVucHJvamVjdChcbiAgICAgICAgcHJvamVjdGlvbi5wcm9qZWN0KHBhdGguX2xhdGxuZykuX2FkZChkaWZmKSk7XG4gICAgICBwYXRoLl9wb2ludC5fYWRkKHB4KTtcbiAgICB9IGVsc2UgaWYgKHBhdGguX3JpbmdzIHx8IHBhdGguX3BhcnRzKSB7IC8vIGV2ZXJ5dGhpbmcgZWxzZVxuICAgICAgdmFyIHJpbmdzID0gcGF0aC5fcmluZ3MgfHwgcGF0aC5fcGFydHM7XG4gICAgICB2YXIgbGF0bG5ncyA9IHBhdGguX2xhdGxuZ3M7XG4gICAgICBpZiAoIUwuVXRpbC5pc0FycmF5KGxhdGxuZ3NbMF0pKSB7IC8vIHBvbHlsaW5lXG4gICAgICAgIGxhdGxuZ3MgPSBbbGF0bG5nc107XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSByaW5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBmb3IgKHZhciBqID0gMCwgamogPSByaW5nc1tpXS5sZW5ndGg7IGogPCBqajsgaisrKSB7XG4gICAgICAgICAgbGF0bG5nID0gbGF0bG5nc1tpXVtqXTtcbiAgICAgICAgICBsYXRsbmdzW2ldW2pdID0gcHJvamVjdGlvblxuICAgICAgICAgICAgLnVucHJvamVjdChwcm9qZWN0aW9uLnByb2plY3QobGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgICAgICBwYXRoLl9ib3VuZHMuZXh0ZW5kKGxhdGxuZ3NbaV1bal0pO1xuICAgICAgICAgIHJpbmdzW2ldW2pdLl9hZGQocHgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGNvbnNvbGUudGltZUVuZCgndHJhbnNmb3JtJyk7XG5cbiAgICBwYXRoLl91cGRhdGVQYXRoKCk7XG4gIH1cblxufSk7XG5cbkwuUGF0aC5hZGRJbml0SG9vayhmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcbiAgICAvLyBlbnN1cmUgaW50ZXJhY3RpdmVcbiAgICB0aGlzLm9wdGlvbnMuaW50ZXJhY3RpdmUgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSBuZXcgTC5IYW5kbGVyLlBhdGhEcmFnKHRoaXMpO1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgIHRoaXMuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICB9XG59KTtcbiIsIi8qKlxuICogTWF0cml4IHRyYW5zZm9ybSBwYXRoIGZvciBTVkcvVk1MXG4gKi9cblxuLy8gUmVuZGVyZXItaW5kZXBlbmRlbnRcbkwuUGF0aC5pbmNsdWRlKHtcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gU1ZHXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj4/fSBtYXRyaXhcblx0ICovXG5cdF90cmFuc2Zvcm06IGZ1bmN0aW9uKG1hdHJpeCkge1xuXHRcdGlmICh0aGlzLl9yZW5kZXJlcikge1xuXHRcdFx0aWYgKG1hdHJpeCkge1xuXHRcdFx0XHR0aGlzLl9yZW5kZXJlci50cmFuc2Zvcm1QYXRoKHRoaXMsIG1hdHJpeCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyByZXNldCB0cmFuc2Zvcm0gbWF0cml4XG5cdFx0XHRcdHRoaXMuX3JlbmRlcmVyLl9yZXNldFRyYW5zZm9ybVBhdGgodGhpcyk7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdGhlIGZlYXR1cmUgd2FzIGRyYWdnZWQsIHRoYXQnbGwgc3VwcmVzcyB0aGUgY2xpY2sgZXZlbnRcblx0ICogb24gbW91c2V1cC4gVGhhdCBmaXhlcyBwb3B1cHMgZm9yIGV4YW1wbGVcblx0ICpcblx0ICogQHBhcmFtICB7TW91c2VFdmVudH0gZVxuXHQgKi9cblx0X29uTW91c2VDbGljazogZnVuY3Rpb24oZSkge1xuXHRcdGlmICgodGhpcy5kcmFnZ2luZyAmJiB0aGlzLmRyYWdnaW5nLm1vdmVkKCkpIHx8XG5cdFx0XHQodGhpcy5fbWFwLmRyYWdnaW5nICYmIHRoaXMuX21hcC5kcmFnZ2luZy5tb3ZlZCgpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2ZpcmVNb3VzZUV2ZW50KGUpO1xuXHR9XG5cbn0pO1xuIiwiTC5TVkcuaW5jbHVkZSghTC5Ccm93c2VyLnZtbCA/IHt9IDoge1xuXG5cdC8qKlxuXHQgKiBSZXNldCB0cmFuc2Zvcm0gbWF0cml4XG5cdCAqL1xuXHRfcmVzZXRUcmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllcikge1xuXHRcdGlmIChsYXllci5fc2tldykge1xuXHRcdFx0Ly8gc3VwZXIgaW1wb3J0YW50ISB3b3JrYXJvdW5kIGZvciBhICdqdW1waW5nJyBnbGl0Y2g6XG5cdFx0XHQvLyBkaXNhYmxlIHRyYW5zZm9ybSBiZWZvcmUgcmVtb3ZpbmcgaXRcblx0XHRcdGxheWVyLl9za2V3Lm9uID0gZmFsc2U7XG5cdFx0XHRsYXllci5fcGF0aC5yZW1vdmVDaGlsZChsYXllci5fc2tldyk7XG5cdFx0XHRsYXllci5fc2tldyA9IG51bGw7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBWTUxcblx0ICogQHBhcmFtIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG5cdCAqL1xuXHR0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG5cdFx0dmFyIHNrZXcgPSBsYXllci5fc2tldztcblxuXHRcdGlmICghc2tldykge1xuXHRcdFx0c2tldyA9IEwuU1ZHLmNyZWF0ZSgnc2tldycpO1xuXHRcdFx0bGF5ZXIuX3BhdGguYXBwZW5kQ2hpbGQoc2tldyk7XG5cdFx0XHRza2V3LnN0eWxlLmJlaGF2aW9yID0gJ3VybCgjZGVmYXVsdCNWTUwpJztcblx0XHRcdGxheWVyLl9za2V3ID0gc2tldztcblx0XHR9XG5cblx0XHQvLyBoYW5kbGUgc2tldy90cmFuc2xhdGUgc2VwYXJhdGVseSwgY2F1c2UgaXQncyBicm9rZW5cblx0XHR2YXIgbXQgPSBtYXRyaXhbMF0udG9GaXhlZCg4KSArIFwiIFwiICsgbWF0cml4WzFdLnRvRml4ZWQoOCkgKyBcIiBcIiArXG5cdFx0XHRtYXRyaXhbMl0udG9GaXhlZCg4KSArIFwiIFwiICsgbWF0cml4WzNdLnRvRml4ZWQoOCkgKyBcIiAwIDBcIjtcblx0XHR2YXIgb2Zmc2V0ID0gTWF0aC5mbG9vcihtYXRyaXhbNF0pLnRvRml4ZWQoKSArIFwiLCBcIiArXG5cdFx0XHRNYXRoLmZsb29yKG1hdHJpeFs1XSkudG9GaXhlZCgpICsgXCJcIjtcblxuXHRcdHZhciBzID0gdGhpcy5fcGF0aC5zdHlsZTtcblx0XHR2YXIgbCA9IHBhcnNlRmxvYXQocy5sZWZ0KTtcblx0XHR2YXIgdCA9IHBhcnNlRmxvYXQocy50b3ApO1xuXHRcdHZhciB3ID0gcGFyc2VGbG9hdChzLndpZHRoKTtcblx0XHR2YXIgaCA9IHBhcnNlRmxvYXQocy5oZWlnaHQpO1xuXG5cdFx0aWYgKGlzTmFOKGwpKSBsID0gMDtcblx0XHRpZiAoaXNOYU4odCkpIHQgPSAwO1xuXHRcdGlmIChpc05hTih3KSB8fCAhdykgdyA9IDE7XG5cdFx0aWYgKGlzTmFOKGgpIHx8ICFoKSBoID0gMTtcblxuXHRcdHZhciBvcmlnaW4gPSAoLWwgLyB3IC0gMC41KS50b0ZpeGVkKDgpICsgXCIgXCIgKyAoLXQgLyBoIC0gMC41KS50b0ZpeGVkKDgpO1xuXG5cdFx0c2tldy5vbiA9IFwiZlwiO1xuXHRcdHNrZXcubWF0cml4ID0gbXQ7XG5cdFx0c2tldy5vcmlnaW4gPSBvcmlnaW47XG5cdFx0c2tldy5vZmZzZXQgPSBvZmZzZXQ7XG5cdFx0c2tldy5vbiA9IHRydWU7XG5cdH1cblxufSk7XG4iLCJMLlNWRy5pbmNsdWRlKHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRsYXllci5fcGF0aC5zZXRBdHRyaWJ1dGVOUyhudWxsLCAndHJhbnNmb3JtJywgJycpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBTVkdcblx0ICogQHBhcmFtIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG5cdCAqL1xuXHR0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG5cdFx0bGF5ZXIuX3BhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ0cmFuc2Zvcm1cIixcblx0XHRcdCdtYXRyaXgoJyArIG1hdHJpeC5qb2luKCcgJykgKyAnKScpO1xuXHR9XG5cbn0pO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5DaXJjbGVNYXJrZXIuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgdGV4dFN0eWxlOiB7XG4gICAgICBjb2xvcjogJyNmZmYnLFxuICAgICAgZm9udFNpemU6IDEyLFxuICAgICAgZm9udFdlaWdodDogMzAwXG4gICAgfSxcbiAgICBzaGlmdFk6IDcsXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNsYXNzIExhYmVsZWRDaXJjbGVcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtMLkNpcmNsZU1hcmtlcn1cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIHRleHRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGxhdGxuZ1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24odGV4dCwgbGF0bG5nLCBvcHRpb25zKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0ICAgICAgICA9IHRleHQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHVGV4dEVsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fdGV4dEVsZW1lbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1RleHROb2RlfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHROb2RlICAgID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3R8TnVsbH1cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0TGF5ZXIgICA9IG51bGw7XG5cbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGxhdGxuZywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7TGFiZWxlZENpcmNsZX1cbiAgICovXG4gIHNldFRleHQ6IGZ1bmN0aW9uKHRleHQpIHtcbiAgICB0aGlzLl90ZXh0ID0gdGV4dDtcbiAgICBpZiAodGhpcy5fdGV4dE5vZGUpIHtcbiAgICAgIHRoaXMuX3RleHRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMuX3RleHROb2RlKTtcbiAgICB9XG4gICAgdGhpcy5fdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0aGlzLl90ZXh0KTtcbiAgICB0aGlzLl90ZXh0RWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl90ZXh0Tm9kZSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBBbHNvIGJyaW5nIHRleHQgdG8gZnJvbnRcbiAgICogQG92ZXJyaWRlXG4gICAqL1xuICBicmluZ1RvRnJvbnQ6IGZ1bmN0aW9uKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5icmluZ1RvRnJvbnQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIGJyaW5nVG9CYWNrOiBmdW5jdGlvbigpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuYnJpbmdUb0JhY2suY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgdGV4dCBpbiB0aGUgcmlnaHQgcG9zaXRpb24gaW4gdGhlIGRvbVxuICAgKi9cbiAgX2dyb3VwVGV4dFRvUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhdGggICAgICAgID0gdGhpcy5fcGF0aDtcbiAgICB2YXIgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICB2YXIgbmV4dCAgICAgICAgPSBwYXRoLm5leHRTaWJsaW5nO1xuICAgIHZhciBwYXJlbnQgICAgICA9IHBhdGgucGFyZW50Tm9kZTtcblxuXG4gICAgaWYgKHRleHRFbGVtZW50ICYmIHBhcmVudCkge1xuICAgICAgaWYgKG5leHQgJiYgbmV4dCAhPT0gdGV4dEVsZW1lbnQpIHtcbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZSh0ZXh0RWxlbWVudCwgbmV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodGV4dEVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQb3NpdGlvbiB0aGUgdGV4dCBpbiBjb250YWluZXJcbiAgICovXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbigpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuX3VwZGF0ZVBhdGguY2FsbCh0aGlzKTtcbiAgICB0aGlzLl91cGRhdGVUZXh0UG9zaXRpb24oKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIF90cmFuc2Zvcm06IGZ1bmN0aW9uKG1hdHJpeCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5fdHJhbnNmb3JtLmNhbGwodGhpcywgbWF0cml4KTtcblxuICAgIC8vIHdyYXAgdGV4dEVsZW1lbnQgd2l0aCBhIGZha2UgbGF5ZXIgZm9yIHJlbmRlcmVyXG4gICAgLy8gdG8gYmUgYWJsZSB0byB0cmFuc2Zvcm0gaXRcbiAgICB0aGlzLl90ZXh0TGF5ZXIgPSB0aGlzLl90ZXh0TGF5ZXIgfHwgeyBfcGF0aDogdGhpcy5fdGV4dEVsZW1lbnQgfTtcbiAgICBpZiAobWF0cml4KSB7XG4gICAgICB0aGlzLl9yZW5kZXJlci50cmFuc2Zvcm1QYXRoKHRoaXMuX3RleHRMYXllciwgbWF0cml4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVuZGVyZXIuX3Jlc2V0VHJhbnNmb3JtUGF0aCh0aGlzLl90ZXh0TGF5ZXIpO1xuICAgICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gICAgICB0aGlzLl90ZXh0TGF5ZXIgPSBudWxsO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge0xhYmVsZWRDaXJjbGV9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcbiAgICB0aGlzLl9pbml0VGV4dCgpO1xuICAgIHRoaXMuX3VwZGF0ZVRleHRQb3NpdGlvbigpO1xuICAgIHRoaXMuc2V0U3R5bGUoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW5kIGluc2VydCB0ZXh0XG4gICAqL1xuICBfaW5pdFRleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3RleHRFbGVtZW50ID0gTC5TVkcuY3JlYXRlKCd0ZXh0Jyk7XG4gICAgdGhpcy5zZXRUZXh0KHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9yb290R3JvdXAuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dEVsZW1lbnQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZSBwb3NpdGlvbiBmb3IgdGV4dFxuICAgKi9cbiAgX3VwZGF0ZVRleHRQb3NpdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRleHRFbGVtZW50ID0gdGhpcy5fdGV4dEVsZW1lbnQ7XG4gICAgaWYgKHRleHRFbGVtZW50KSB7XG4gICAgICB2YXIgYmJveCA9IHRleHRFbGVtZW50LmdldEJCb3goKTtcbiAgICAgIHZhciB0ZXh0UG9zaXRpb24gPSB0aGlzLl9wb2ludC5zdWJ0cmFjdChcbiAgICAgICAgTC5wb2ludChiYm94LndpZHRoLCAtYmJveC5oZWlnaHQgKyB0aGlzLm9wdGlvbnMuc2hpZnRZKS5kaXZpZGVCeSgyKSk7XG5cbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneCcsIHRleHRQb3NpdGlvbi54KTtcbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneScsIHRleHRQb3NpdGlvbi55KTtcbiAgICAgIHRoaXMuX2dyb3VwVGV4dFRvUGF0aCgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTZXQgdGV4dCBzdHlsZVxuICAgKi9cbiAgc2V0U3R5bGU6IGZ1bmN0aW9uKHN0eWxlKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLnNldFN0eWxlLmNhbGwodGhpcywgc3R5bGUpO1xuICAgIHZhciBzdHlsZXMgPSB0aGlzLm9wdGlvbnMudGV4dFN0eWxlO1xuICAgIGZvciAodmFyIHByb3AgaW4gc3R5bGVzKSB7XG4gICAgICBpZiAoc3R5bGVzLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgIHZhciBzdHlsZVByb3AgPSBwcm9wO1xuICAgICAgICBpZiAocHJvcCA9PT0gJ2NvbG9yJykge1xuICAgICAgICAgIHN0eWxlUHJvcCA9ICdzdHJva2UnO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3RleHRFbGVtZW50LnN0eWxlW3N0eWxlUHJvcF0gPSBzdHlsZXNbcHJvcF07XG4gICAgICB9XG4gICAgfVxuICB9XG59KTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xudmFyIENpcmNsZSA9IHJlcXVpcmUoJy4vY2lyY2xlJyk7XG5yZXF1aXJlKCdsZWFmbGV0LXBhdGgtZHJhZycpO1xuXG52YXIgTGFiZWxlZE1hcmtlciA9IEwuRmVhdHVyZUdyb3VwLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtICB7TGFiZWxlZE1hcmtlcn0gbWFya2VyXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgZmVhdHVyZVxuICAgICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICAgKi9cbiAgICBnZXRMYWJlbFRleHQ6IGZ1bmN0aW9uKG1hcmtlciwgZmVhdHVyZSkge1xuICAgICAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy50ZXh0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHBhcmFtICB7TC5MYXRMbmd9ICAgICAgbGF0bG5nXG4gICAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAgICovXG4gICAgZ2V0TGFiZWxQb3NpdGlvbjogZnVuY3Rpb24obWFya2VyLCBmZWF0dXJlLCBsYXRsbmcpIHtcbiAgICAgIHJldHVybiBmZWF0dXJlLnByb3BlcnRpZXMubGFiZWxQb3NpdGlvbiA/XG4gICAgICAgIEwubGF0TG5nKGZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uLnNsaWNlKCkucmV2ZXJzZSgpKSA6XG4gICAgICAgIGxhdGxuZztcbiAgICB9LFxuXG4gICAgbGFiZWxQb3NpdGlvbktleTogJ2xhYmVsUG9zaXRpb24nLFxuXG4gICAgbWFya2VyT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGZpbGxPcGFjaXR5OiAwLjc1LFxuICAgICAgZHJhZ2dhYmxlOiB0cnVlLFxuICAgICAgcmFkaXVzOiAxNVxuICAgIH0sXG5cbiAgICBhbmNob3JPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyMwMGYnLFxuICAgICAgcmFkaXVzOiAzXG4gICAgfSxcblxuICAgIGxpbmVPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyNmMDAnLFxuICAgICAgZGFzaEFycmF5OiBbMiwgNl0sXG4gICAgICBsaW5lQ2FwOiAnc3F1YXJlJyxcbiAgICAgIHdlaWdodDogMlxuICAgIH1cblxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjbGFzcyBMYWJlbGVkTWFya2VyXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7TC5GZWF0dXJlR3JvdXB9XG4gICAqXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBsYXRsbmdcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIGZlYXR1cmVcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB0aGlzLmZlYXR1cmUgPSBmZWF0dXJlIHx8IHtcbiAgICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgJ3R5cGUnOiAnUG9pbnQnXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ31cbiAgICAgKi9cbiAgICB0aGlzLl9sYXRsbmcgPSBsYXRsbmc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDaXJjbGVMYWJlbH1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXJrZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5DaXJjbGVNYXJrZXJ9XG4gICAgICovXG4gICAgdGhpcy5fYW5jaG9yID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9seWxpbmV9XG4gICAgICovXG4gICAgdGhpcy5fbGluZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2luaXRpYWxEaXN0YW5jZSA9IG51bGw7XG5cbiAgICB0aGlzLl9jcmVhdGVMYXllcnMoKTtcbiAgICBMLkxheWVyR3JvdXAucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLFxuICAgICAgW3RoaXMuX2FuY2hvciwgdGhpcy5fbGluZSwgdGhpcy5fbWFya2VyXSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICBnZXRMYWJlbFBvc2l0aW9uOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFya2VyLmdldExhdExuZygpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgZ2V0TGF0TG5nOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbGF0bG5nO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICB0b0dlb0pTT046IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmZWF0dXJlID0gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xuICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgIGNvb3JkaW5hdGVzOiBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5fYW5jaG9yLmdldExhdExuZygpKVxuICAgIH0pO1xuICAgIGZlYXR1cmUucHJvcGVydGllc1t0aGlzLm9wdGlvbnMubGFiZWxQb3NpdGlvbktleV0gPVxuICAgICAgTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKSk7XG4gICAgcmV0dXJuIGZlYXR1cmU7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7TGFiZWxlZE1hcmtlcn1cbiAgICovXG4gIHNldFRleHQ6IGZ1bmN0aW9uKHRleHQpIHtcbiAgICB0aGlzLl9tYXJrZXIuc2V0VGV4dCh0ZXh0KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuY2hvciwgbGluZSBhbmQgbGFiZWxcbiAgICovXG4gIF9jcmVhdGVMYXllcnM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvcHRzID0gdGhpcy5vcHRpb25zO1xuICAgIHZhciBwb3MgID0gb3B0cy5nZXRMYWJlbFBvc2l0aW9uKHRoaXMsIHRoaXMuZmVhdHVyZSwgdGhpcy5fbGF0bG5nKTtcbiAgICB2YXIgdGV4dCA9IG9wdHMuZ2V0TGFiZWxUZXh0KHRoaXMsIHRoaXMuZmVhdHVyZSk7XG5cbiAgICB0aGlzLl9tYXJrZXIgPSBuZXcgQ2lyY2xlKHRleHQsIHBvcyxcbiAgICAgIEwuVXRpbC5leHRlbmQoe30sXG4gICAgICAgIExhYmVsZWRNYXJrZXIucHJvdG90eXBlLm9wdGlvbnMubWFya2VyT3B0aW9ucyxcbiAgICAgICAgb3B0cy5tYXJrZXJPcHRpb25zKVxuICAgICkub24oJ2RyYWcnLCAgICAgIHRoaXMuX29uTWFya2VyRHJhZywgICAgICB0aGlzKVxuICAgICAub24oJ2RyYWdzdGFydCcsIHRoaXMuX29uTWFya2VyRHJhZ1N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuX2FuY2hvciA9IG5ldyBMLkNpcmNsZU1hcmtlcih0aGlzLl9sYXRsbmcsXG4gICAgICBMLlV0aWwuZXh0ZW5kKHt9LCBMYWJlbGVkTWFya2VyLnByb3RvdHlwZS5vcHRpb25zLmFuY2hvck9wdGlvbnMsXG4gICAgICAgIG9wdHMuYW5jaG9yT3B0aW9ucykpO1xuXG4gICAgdGhpcy5fbGluZSA9IG5ldyBMLlBvbHlsaW5lKFt0aGlzLl9sYXRsbmcsIHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKV0sXG4gICAgICBMLlV0aWwuZXh0ZW5kKHt9LCBMYWJlbGVkTWFya2VyLnByb3RvdHlwZS5vcHRpb25zLmxpbmVPcHRpb25zLFxuICAgICAgICBvcHRzLmxpbmVPcHRpb25zKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU3RvcmUgc2hpZnQgdG8gYmUgcHJlY2lzZSB3aGlsZSBkcmFnZ2luZ1xuICAgKiBAcGFyYW0gIHtFdmVudH0gZXZ0XG4gICAqL1xuICBfb25NYXJrZXJEcmFnU3RhcnQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHRoaXMuX2luaXRpYWxEaXN0YW5jZSA9IEwuRG9tRXZlbnQuZ2V0TW91c2VQb3NpdGlvbihldnQpXG4gICAgICAuc3VidHJhY3QodGhpcy5fbWFwLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQodGhpcy5fbWFya2VyLmdldExhdExuZygpKSk7XG4gICAgLy9MLlV0aWwucmVxdWVzdEFuaW1GcmFtZSh0aGlzLl9tYXJrZXIuYnJpbmdUb0Zyb250LCB0aGlzLl9tYXJrZXIpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIExpbmUgZHJhZ2dpbmdcbiAgICogQHBhcmFtICB7RHJhZ0V2ZW50fSBldnRcbiAgICovXG4gIF9vbk1hcmtlckRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBsYXRsbmcgPSB0aGlzLl9tYXAuY29udGFpbmVyUG9pbnRUb0xhdExuZyhcbiAgICAgIEwuRG9tRXZlbnQuZ2V0TW91c2VQb3NpdGlvbihldnQpLl9zdWJ0cmFjdCh0aGlzLl9pbml0aWFsRGlzdGFuY2UpKTtcbiAgICB0aGlzLl9saW5lLnNldExhdExuZ3MoW2xhdGxuZywgdGhpcy5fbGF0bG5nXSk7XG4gIH1cblxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5MYWJlbGVkQ2lyY2xlTWFya2VyID0gTGFiZWxlZE1hcmtlcjtcbkwubGFiZWxlZENpcmNsZU1hcmtlciA9IGZ1bmN0aW9uKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IExhYmVsZWRNYXJrZXIobGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKTtcbn07XG4iXX0=
