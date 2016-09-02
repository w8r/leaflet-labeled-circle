(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).LabeledCircleMarker = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var LabeledMarker = require('../..');

var map = global.map = new L.Map('map', {}).setView([22.42658, 114.1952], 10);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: '&copy; ' + '<a href="http://osm.org/copyright">OSM</a> contributors'
}).addTo(map);

var pos1 = [114.1952, 22.42658];
var marker1 = global.marker1 = new LabeledMarker(pos1.slice().reverse(), {
  "type": "Feature",
  "properties": {
    "text": "yolo",
    "labelPosition": [114.29819682617189, 22.477347822506356]
  },
  "geometry": {
    "type": "Point",
    "coordinates": pos1
  }
}, {
  markerOptions: { color: '#050' }
}).addTo(map);

var pos2 = [114.14657592773438, 22.33927931468312];
var marker2 = global.marker2 = new LabeledMarker(pos2.slice().reverse(), {
  "type": "Feature",
  "properties": {
    "text": 12,
    "labelPosition": [113.89719584960939, 22.413885141186906]
  },
  "geometry": {
    "type": "Point",
    "coordinates": pos2
  }
}).addTo(map);

var pos3 = [114.12872314453125, 22.395157990290755];
var marker3 = global.marker3 = new LabeledMarker(pos3.slice().reverse(), {
  "type": "Feature",
  "properties": {
    "text": 1,
    "labelPosition": [114.39295390625001, 22.314825463263595]
  },
  "geometry": {
    "type": "Point",
    "coordinates": [114.12872314453125, 22.395157990290755]
  }
}, {
  markerOptions: {
    color: '#007'
  }
}).addTo(map);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../..":2}],2:[function(require,module,exports){
'use strict';

module.exports = require('./src/marker');

},{"./src/marker":8}],3:[function(require,module,exports){
require('./src/Path.Transform');
require('./src/Path.Drag');
require('./src/MultiPoly.Drag');

module.exports = L.Path.Drag;

},{"./src/MultiPoly.Drag":4,"./src/Path.Drag":5,"./src/Path.Transform":6}],4:[function(require,module,exports){
(function() {

  // listen and propagate dragstart on sub-layers
  L.FeatureGroup.EVENTS += ' dragstart';

  function wrapMethod(klasses, methodName, method) {
    for (var i = 0, len = klasses.length; i < len; i++) {
      var klass = klasses[i];
      klass.prototype['_' + methodName] = klass.prototype[methodName];
      klass.prototype[methodName] = method;
    }
  }

  /**
   * @param {L.Polygon|L.Polyline} layer
   * @return {L.MultiPolygon|L.MultiPolyline}
   */
  function addLayer(layer) {
    if (this.hasLayer(layer)) {
      return this;
    }
    layer
      .on('drag', this._onDrag, this)
      .on('dragend', this._onDragEnd, this);
    return this._addLayer.call(this, layer);
  }

  /**
   * @param  {L.Polygon|L.Polyline} layer
   * @return {L.MultiPolygon|L.MultiPolyline}
   */
  function removeLayer(layer) {
    if (!this.hasLayer(layer)) {
      return this;
    }
    layer
      .off('drag', this._onDrag, this)
      .off('dragend', this._onDragEnd, this);
    return this._removeLayer.call(this, layer);
  }

  // duck-type methods to listen to the drag events
  wrapMethod([L.MultiPolygon, L.MultiPolyline], 'addLayer', addLayer);
  wrapMethod([L.MultiPolygon, L.MultiPolyline], 'removeLayer', removeLayer);

  var dragMethods = {
    _onDrag: function(evt) {
      var layer = evt.target;
      this.eachLayer(function(otherLayer) {
        if (otherLayer !== layer) {
          otherLayer._applyTransform(layer.dragging._matrix);
        }
      });

      this._propagateEvent(evt);
    },

    _onDragEnd: function(evt) {
      var layer = evt.target;

      this.eachLayer(function(otherLayer) {
        if (otherLayer !== layer) {
          otherLayer._resetTransform();
          otherLayer.dragging._transformPoints(layer.dragging._matrix);
        }
      });

      this._propagateEvent(evt);
    }
  };

  L.MultiPolygon.include(dragMethods);
  L.MultiPolyline.include(dragMethods);

})();

},{}],5:[function(require,module,exports){
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
    DRAGGABLE_CLS: 'leaflet-path-draggable'
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
    this._dragInProgress = false;

    /**
     * @type {Boolean}
     */
    this._dragMoved = false;

  },


  /**
   * Enable dragging
   */
  addHooks: function() {
    var className = L.Handler.PathDrag.DRAGGABLE_CLS;
    var path      = this._path._path;

    this._path.on('mousedown', this._onDragStart, this);
    this._path.options.className =
      (this._path.options.className || '') + ' ' + className;

    if (!L.Path.CANVAS && path) {
      L.DomUtil.addClass(path, className);
    }
  },


  /**
   * Disable dragging
   */
  removeHooks: function() {
    var className = L.Handler.PathDrag.DRAGGABLE_CLS;
    var path      = this._path._path;

    this._path.off('mousedown', this._onDragStart, this);
    this._path.options.className =
      (this._path.options.className || '').replace(className, '');

    if (!L.Path.CANVAS && path) {
      L.DomUtil.removeClass(path, className);
    }
    this._dragMoved = false;
  },


  /**
   * @return {Boolean}
   */
  moved: function() {
    return this._dragMoved;
  },


  /**
   * If dragging currently in progress.
   *
   * @return {Boolean}
   */
  inProgress: function() {
    return this._dragInProgress;
  },


  /**
   * Start drag
   * @param  {L.MouseEvent} evt
   */
  _onDragStart: function(evt) {
    this._dragInProgress = true;
    this._startPoint = evt.containerPoint.clone();
    this._dragStartPoint = evt.containerPoint.clone();
    this._matrix = [1, 0, 0, 1, 0, 0];

    if(this._path._point) {
      this._point = this._path._point.clone();
    }

    this._path._map
      .on('mousemove', this._onDrag, this)
      .on('mouseup', this._onDragEnd, this)
    this._dragMoved = false;
  },


  /**
   * Dragging
   * @param  {L.MouseEvent} evt
   */
  _onDrag: function(evt) {
    var x = evt.containerPoint.x;
    var y = evt.containerPoint.y;

    var matrix     = this._matrix;
    var path       = this._path;
    var startPoint = this._startPoint;

    var dx = x - startPoint.x;
    var dy = y - startPoint.y;

    if (!this._dragMoved && (dx || dy)) {
      this._dragMoved = true;
      path.fire('dragstart');

      if (path._popup) {
        path._popup._close();
        path.off('click', path._openPopup, path);
      }
    }

    matrix[4] += dx;
    matrix[5] += dy;

    startPoint.x = x;
    startPoint.y = y;

    path._applyTransform(matrix);

    if (path._point) { // L.Circle, L.CircleMarker
      path._point.x = this._point.x + matrix[4];
      path._point.y = this._point.y + matrix[5];
    }

    path.fire('drag');
    L.DomEvent.stop(evt.originalEvent);
  },


  /**
   * Dragging stopped, apply
   * @param  {L.MouseEvent} evt
   */
  _onDragEnd: function(evt) {
    L.DomEvent.stop(evt);
    L.DomEvent._fakeStop({ type: 'click' });

    this._dragInProgress = false;
    // undo container transform
    this._path._resetTransform();
    // apply matrix
    this._transformPoints(this._matrix);

    this._path._map
      .off('mousemove', this._onDrag, this)
      .off('mouseup', this._onDragEnd, this);

    // consistency
    this._path.fire('dragend', {
      distance: Math.sqrt(
        L.LineUtil._sqDist(this._dragStartPoint, evt.containerPoint)
      )
    });

    if (this._path._popup) {
      L.Util.requestAnimFrame(function() {
        this._path.on('click', this._path._openPopup, this._path);
      }, this);
    }

    this._matrix = null;
    this._startPoint = null;
    this._point = null;
    this._dragStartPoint = null;
  },


  /**
   * Transforms point according to the provided transformation matrix.
   *
   *  @param {Array.<Number>} matrix
   *  @param {L.LatLng} point
   */
  _transformPoint: function(point, matrix) {
    var path = this._path;

    var px = L.point(matrix[4], matrix[5]);

    var crs = path._map.options.crs;
    var transformation = crs.transformation;
    var scale = crs.scale(path._map.getZoom());
    var projection = crs.projection;

    var diff = transformation.untransform(px, scale)
      .subtract(transformation.untransform(L.point(0, 0), scale));

    return projection.unproject(projection.project(point)._add(diff));
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

    // console.time('transform');

    // all shifts are in-place
    if (path._point) { // L.Circle
      path._latlng = projection.unproject(
        projection.project(path._latlng)._add(diff));
      path._point = this._point._add(px);
    } else if (path._originalPoints) { // everything else
      for (i = 0, len = path._originalPoints.length; i < len; i++) {
        latlng = path._latlngs[i];
        path._latlngs[i] = projection
          .unproject(projection.project(latlng)._add(diff));
        path._originalPoints[i]._add(px);
      }
    }

    // holes operations
    if (path._holes) {
      for (i = 0, len = path._holes.length; i < len; i++) {
        for (var j = 0, len2 = path._holes[i].length; j < len2; j++) {
          latlng = path._holes[i][j];
          path._holes[i][j] = projection
            .unproject(projection.project(latlng)._add(diff));
          path._holePoints[i][j]._add(px);
        }
      }
    }

    // console.timeEnd('transform');

    path._updatePath();
  }

});


// Init hook instead of replacing the `initEvents`
L.Path.addInitHook(function() {
  if (this.options.draggable) {
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

/*
 * Return transformed points in case if dragging is enabled and in progress,
 * otherwise - call original method.
 *
 * For L.Circle and L.Polyline
 */

// don't like this? me neither, but I like it even less
// when the original methods are not exposed
L.Circle.prototype._getLatLng = L.Circle.prototype.getLatLng;
L.Circle.prototype.getLatLng = function() {
  if (this.dragging && this.dragging.inProgress()) {
    return this.dragging._transformPoint(this._latlng, this.dragging._matrix);
  } else {
    return this._getLatLng();
  }
};


L.Polyline.prototype._getLatLngs = L.Polyline.prototype.getLatLngs;
L.Polyline.prototype.getLatLngs = function() {
  if (this.dragging && this.dragging.inProgress()) {
    var matrix = this.dragging._matrix;
    var points = this._getLatLngs();
    for (var i = 0, len = points.length; i < len; i++) {
      points[i] = this.dragging._transformPoint(points[i], matrix);
    }
    return points;
  } else {
    return this._getLatLngs();
  }
};

},{}],6:[function(require,module,exports){
/**
 * Matrix transform path for SVG/VML
 * TODO: adapt to Leaflet 0.8 upon release
 */

"use strict";

if (L.Browser.svg) { // SVG transformation

  L.Path.include({

    /**
     * Reset transform matrix
     */
    _resetTransform: function() {
      this._container.setAttributeNS(null, 'transform', '');
    },

    /**
     * Applies matrix transformation to SVG
     * @param {Array.<Number>} matrix
     */
    _applyTransform: function(matrix) {
      this._container.setAttributeNS(null, "transform",
        'matrix(' + matrix.join(' ') + ')');
    }

  });

} else { // VML transform routines

  L.Path.include({

    /**
     * Reset transform matrix
     */
    _resetTransform: function() {
      if (this._skew) {
        // super important! workaround for a 'jumping' glitch:
        // disable transform before removing it
        this._skew.on = false;
        this._container.removeChild(this._skew);
        this._skew = null;
      }
    },

    /**
     * Applies matrix transformation to VML
     * @param {Array.<Number>} matrix
     */
    _applyTransform: function(matrix) {
      var skew = this._skew;

      if (!skew) {
        skew = this._createElement('skew');
        this._container.appendChild(skew);
        skew.style.behavior = 'url(#default#VML)';
        this._skew = skew;
      }

      // handle skew/translate separately, cause it's broken
      var mt = matrix[0].toFixed(8) + " " + matrix[1].toFixed(8) + " " +
        matrix[2].toFixed(8) + " " + matrix[3].toFixed(8) + " 0 0";
      var offset = Math.floor(matrix[4]).toFixed() + ", " +
        Math.floor(matrix[5]).toFixed() + "";

      var s = this._container.style;
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
}

// Renderer-independent
L.Path.include({

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

},{}],7:[function(require,module,exports){
'use strict';

module.exports = L.CircleMarker.extend({

  options: {
    textStyle: {
      color: '#fff',
      fontSize: 12
    },
    shiftY: 6
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
    this._text = text;
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
   * Create text node in container
   */
  _initPath: function _initPath() {
    L.CircleMarker.prototype._initPath.call(this);
    this._textElement = this._createElement('text');
    this.setText(this._text);
    this._container.appendChild(this._textElement);
  },

  /**
   * Position the text in container
   */
  _updatePath: function _updatePath() {
    L.CircleMarker.prototype._updatePath.call(this);

    this._updateTextPosition();
  },

  /**
   * @param  {L.Map} map
   * @return {LabeledCircle}
   */
  onAdd: function onAdd(map) {
    L.CircleMarker.prototype.onAdd.call(this, map);
    this._updateTextPosition();
    return this;
  },

  /**
   * Calculate position for text
   */
  _updateTextPosition: function _updateTextPosition() {
    var textElement = this._textElement;
    var bbox = textElement.getBBox();
    var textPosition = this._point.subtract(L.point(bbox.width, -bbox.height + this.options.shiftY).divideBy(2));

    textElement.setAttribute('x', textPosition.x);
    textElement.setAttribute('y', textPosition.y);
  },

  /**
   * Set text style
   */
  _updateStyle: function _updateStyle() {
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

},{}],8:[function(require,module,exports){
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
      fillOpacity: 0.8,
      draggable: true,
      radius: 15
    },

    anchorOptions: {
      color: '#00f',
      radius: 3
    },

    lineOptions: {
      color: '#f00',
      dashArray: [5, 15],
      lineCap: 'square'
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

    this._marker = new Circle(text, pos, L.Util.extend({}, LabeledMarker.prototype.options.markerOptions, opts.markerOptions)).on('drag', this._onMarkerDrag, this);

    this._anchor = new L.CircleMarker(this._latlng, L.Util.extend({}, LabeledMarker.prototype.options.anchorOptions, opts.anchorOptions));

    this._line = new L.Polyline([this._latlng, this._marker.getLatLng()], L.Util.extend({}, LabeledMarker.prototype.options.lineOptions, opts.lineOptions));
  },

  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag: function _onMarkerDrag(evt) {
    this._line.setLatLngs([evt.target.getLatLng(), this._latlng]);
  }

});

module.exports = L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./circle":7,"leaflet-path-drag":3}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZW1vL2pzL2luZGV4LmpzIiwiaW5kZXguanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL011bHRpUG9seS5EcmFnLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9QYXRoLkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguVHJhbnNmb3JtLmpzIiwic3JjL2NpcmNsZS5qcyIsInNyYy9tYXJrZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7QUNBQSxJQUFJLGdCQUFnQixRQUFRLE9BQVIsQ0FBcEI7O0FBRUEsSUFBSSxNQUFNLE9BQU8sR0FBUCxHQUFhLElBQUksRUFBRSxHQUFOLENBQVUsS0FBVixFQUFpQixFQUFqQixFQUFxQixPQUFyQixDQUE2QixDQUFDLFFBQUQsRUFBVyxRQUFYLENBQTdCLEVBQW1ELEVBQW5ELENBQXZCOztBQUVBLEVBQUUsU0FBRixDQUFZLHlDQUFaLEVBQXVEO0FBQ3JELGVBQWEsWUFDWDtBQUZtRCxDQUF2RCxFQUdHLEtBSEgsQ0FHUyxHQUhUOztBQUtBLElBQUksT0FBTyxDQUFFLFFBQUYsRUFBWSxRQUFaLENBQVg7QUFDQSxJQUFJLFVBQVUsT0FBTyxPQUFQLEdBQWlCLElBQUksYUFBSixDQUFrQixLQUFLLEtBQUwsR0FBYSxPQUFiLEVBQWxCLEVBQTBDO0FBQ3ZFLFVBQVEsU0FEK0Q7QUFFdkUsZ0JBQWM7QUFDWixZQUFRLE1BREk7QUFFWixxQkFBaUIsQ0FDZixrQkFEZSxFQUVmLGtCQUZlO0FBRkwsR0FGeUQ7QUFTdkUsY0FBWTtBQUNWLFlBQVEsT0FERTtBQUVWLG1CQUFlO0FBRkw7QUFUMkQsQ0FBMUMsRUFhNUI7QUFDRCxpQkFBZSxFQUFFLE9BQU8sTUFBVDtBQURkLENBYjRCLEVBZTVCLEtBZjRCLENBZXRCLEdBZnNCLENBQS9COztBQWlCQSxJQUFJLE9BQU8sQ0FBRSxrQkFBRixFQUFzQixpQkFBdEIsQ0FBWDtBQUNBLElBQUksVUFBVSxPQUFPLE9BQVAsR0FBaUIsSUFBSSxhQUFKLENBQWtCLEtBQUssS0FBTCxHQUFhLE9BQWIsRUFBbEIsRUFBMEM7QUFDdkUsVUFBUSxTQUQrRDtBQUV2RSxnQkFBYztBQUNaLFlBQVEsRUFESTtBQUVaLHFCQUFpQixDQUNmLGtCQURlLEVBRWYsa0JBRmU7QUFGTCxHQUZ5RDtBQVN2RSxjQUFZO0FBQ1YsWUFBUSxPQURFO0FBRVYsbUJBQWU7QUFGTDtBQVQyRCxDQUExQyxFQWE1QixLQWI0QixDQWF0QixHQWJzQixDQUEvQjs7QUFlQSxJQUFJLE9BQU8sQ0FBQyxrQkFBRCxFQUFxQixrQkFBckIsQ0FBWDtBQUNBLElBQUksVUFBVSxPQUFPLE9BQVAsR0FBaUIsSUFBSSxhQUFKLENBQWtCLEtBQUssS0FBTCxHQUFhLE9BQWIsRUFBbEIsRUFBMEM7QUFDdkUsVUFBUSxTQUQrRDtBQUV2RSxnQkFBYztBQUNaLFlBQVEsQ0FESTtBQUVaLHFCQUFpQixDQUNmLGtCQURlLEVBRWYsa0JBRmU7QUFGTCxHQUZ5RDtBQVN2RSxjQUFZO0FBQ1YsWUFBUSxPQURFO0FBRVYsbUJBQWUsQ0FDYixrQkFEYSxFQUViLGtCQUZhO0FBRkw7QUFUMkQsQ0FBMUMsRUFnQjVCO0FBQ0QsaUJBQWU7QUFDYixXQUFPO0FBRE07QUFEZCxDQWhCNEIsRUFvQjVCLEtBcEI0QixDQW9CdEIsR0FwQnNCLENBQS9COzs7Ozs7O0FDNUNBLE9BQU8sT0FBUCxHQUFpQixRQUFRLGNBQVIsQ0FBakI7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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InNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBMYWJlbGVkTWFya2VyID0gcmVxdWlyZSgnLi4vLi4nKTtcblxudmFyIG1hcCA9IGdsb2JhbC5tYXAgPSBuZXcgTC5NYXAoJ21hcCcsIHt9KS5zZXRWaWV3KFsyMi40MjY1OCwgMTE0LjE5NTJdLCAxMCk7XG5cbkwudGlsZUxheWVyKCdodHRwOi8ve3N9LnRpbGUub3NtLm9yZy97en0ve3h9L3t5fS5wbmcnLCB7XG4gIGF0dHJpYnV0aW9uOiAnJmNvcHk7ICcgK1xuICAgICc8YSBocmVmPVwiaHR0cDovL29zbS5vcmcvY29weXJpZ2h0XCI+T1NNPC9hPiBjb250cmlidXRvcnMnXG59KS5hZGRUbyhtYXApO1xuXG52YXIgcG9zMSA9IFsgMTE0LjE5NTIsIDIyLjQyNjU4XTtcbnZhciBtYXJrZXIxID0gZ2xvYmFsLm1hcmtlcjEgPSBuZXcgTGFiZWxlZE1hcmtlcihwb3MxLnNsaWNlKCkucmV2ZXJzZSgpLCB7XG4gIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAgICBcInRleHRcIjogXCJ5b2xvXCIsXG4gICAgXCJsYWJlbFBvc2l0aW9uXCI6IFtcbiAgICAgIDExNC4yOTgxOTY4MjYxNzE4OSxcbiAgICAgIDIyLjQ3NzM0NzgyMjUwNjM1NlxuICAgIF1cbiAgfSxcbiAgXCJnZW9tZXRyeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAgICBcImNvb3JkaW5hdGVzXCI6IHBvczFcbiAgfVxufSwge1xuICBtYXJrZXJPcHRpb25zOiB7IGNvbG9yOiAnIzA1MCcgfVxufSkuYWRkVG8obWFwKTtcblxudmFyIHBvczIgPSBbIDExNC4xNDY1NzU5Mjc3MzQzOCwgMjIuMzM5Mjc5MzE0NjgzMTJdO1xudmFyIG1hcmtlcjIgPSBnbG9iYWwubWFya2VyMiA9IG5ldyBMYWJlbGVkTWFya2VyKHBvczIuc2xpY2UoKS5yZXZlcnNlKCksIHtcbiAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICBcInByb3BlcnRpZXNcIjoge1xuICAgIFwidGV4dFwiOiAxMixcbiAgICBcImxhYmVsUG9zaXRpb25cIjogW1xuICAgICAgMTEzLjg5NzE5NTg0OTYwOTM5LFxuICAgICAgMjIuNDEzODg1MTQxMTg2OTA2XG4gICAgXVxuICB9LFxuICBcImdlb21ldHJ5XCI6IHtcbiAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICAgIFwiY29vcmRpbmF0ZXNcIjogcG9zMlxuICB9XG59KS5hZGRUbyhtYXApO1xuXG52YXIgcG9zMyA9IFsxMTQuMTI4NzIzMTQ0NTMxMjUsIDIyLjM5NTE1Nzk5MDI5MDc1NV07XG52YXIgbWFya2VyMyA9IGdsb2JhbC5tYXJrZXIzID0gbmV3IExhYmVsZWRNYXJrZXIocG9zMy5zbGljZSgpLnJldmVyc2UoKSwge1xuICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gIFwicHJvcGVydGllc1wiOiB7XG4gICAgXCJ0ZXh0XCI6IDEsXG4gICAgXCJsYWJlbFBvc2l0aW9uXCI6IFtcbiAgICAgIDExNC4zOTI5NTM5MDYyNTAwMSxcbiAgICAgIDIyLjMxNDgyNTQ2MzI2MzU5NVxuICAgIF1cbiAgfSxcbiAgXCJnZW9tZXRyeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAgICBcImNvb3JkaW5hdGVzXCI6IFtcbiAgICAgIDExNC4xMjg3MjMxNDQ1MzEyNSxcbiAgICAgIDIyLjM5NTE1Nzk5MDI5MDc1NVxuICAgIF1cbiAgfVxufSwge1xuICBtYXJrZXJPcHRpb25zOiB7XG4gICAgY29sb3I6ICcjMDA3J1xuICB9XG59KS5hZGRUbyhtYXApO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9tYXJrZXInKTtcbiIsInJlcXVpcmUoJy4vc3JjL1BhdGguVHJhbnNmb3JtJyk7XG5yZXF1aXJlKCcuL3NyYy9QYXRoLkRyYWcnKTtcbnJlcXVpcmUoJy4vc3JjL011bHRpUG9seS5EcmFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5QYXRoLkRyYWc7XG4iLCIoZnVuY3Rpb24oKSB7XG5cbiAgLy8gbGlzdGVuIGFuZCBwcm9wYWdhdGUgZHJhZ3N0YXJ0IG9uIHN1Yi1sYXllcnNcbiAgTC5GZWF0dXJlR3JvdXAuRVZFTlRTICs9ICcgZHJhZ3N0YXJ0JztcblxuICBmdW5jdGlvbiB3cmFwTWV0aG9kKGtsYXNzZXMsIG1ldGhvZE5hbWUsIG1ldGhvZCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBrbGFzc2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIga2xhc3MgPSBrbGFzc2VzW2ldO1xuICAgICAga2xhc3MucHJvdG90eXBlWydfJyArIG1ldGhvZE5hbWVdID0ga2xhc3MucHJvdG90eXBlW21ldGhvZE5hbWVdO1xuICAgICAga2xhc3MucHJvdG90eXBlW21ldGhvZE5hbWVdID0gbWV0aG9kO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0wuUG9seWdvbnxMLlBvbHlsaW5lfSBsYXllclxuICAgKiBAcmV0dXJuIHtMLk11bHRpUG9seWdvbnxMLk11bHRpUG9seWxpbmV9XG4gICAqL1xuICBmdW5jdGlvbiBhZGRMYXllcihsYXllcikge1xuICAgIGlmICh0aGlzLmhhc0xheWVyKGxheWVyKSkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGxheWVyXG4gICAgICAub24oJ2RyYWcnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG4gICAgICAub24oJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzLl9hZGRMYXllci5jYWxsKHRoaXMsIGxheWVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBvbHlnb258TC5Qb2x5bGluZX0gbGF5ZXJcbiAgICogQHJldHVybiB7TC5NdWx0aVBvbHlnb258TC5NdWx0aVBvbHlsaW5lfVxuICAgKi9cbiAgZnVuY3Rpb24gcmVtb3ZlTGF5ZXIobGF5ZXIpIHtcbiAgICBpZiAoIXRoaXMuaGFzTGF5ZXIobGF5ZXIpKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgbGF5ZXJcbiAgICAgIC5vZmYoJ2RyYWcnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG4gICAgICAub2ZmKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcy5fcmVtb3ZlTGF5ZXIuY2FsbCh0aGlzLCBsYXllcik7XG4gIH1cblxuICAvLyBkdWNrLXR5cGUgbWV0aG9kcyB0byBsaXN0ZW4gdG8gdGhlIGRyYWcgZXZlbnRzXG4gIHdyYXBNZXRob2QoW0wuTXVsdGlQb2x5Z29uLCBMLk11bHRpUG9seWxpbmVdLCAnYWRkTGF5ZXInLCBhZGRMYXllcik7XG4gIHdyYXBNZXRob2QoW0wuTXVsdGlQb2x5Z29uLCBMLk11bHRpUG9seWxpbmVdLCAncmVtb3ZlTGF5ZXInLCByZW1vdmVMYXllcik7XG5cbiAgdmFyIGRyYWdNZXRob2RzID0ge1xuICAgIF9vbkRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgdmFyIGxheWVyID0gZXZ0LnRhcmdldDtcbiAgICAgIHRoaXMuZWFjaExheWVyKGZ1bmN0aW9uKG90aGVyTGF5ZXIpIHtcbiAgICAgICAgaWYgKG90aGVyTGF5ZXIgIT09IGxheWVyKSB7XG4gICAgICAgICAgb3RoZXJMYXllci5fYXBwbHlUcmFuc2Zvcm0obGF5ZXIuZHJhZ2dpbmcuX21hdHJpeCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9wcm9wYWdhdGVFdmVudChldnQpO1xuICAgIH0sXG5cbiAgICBfb25EcmFnRW5kOiBmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciBsYXllciA9IGV2dC50YXJnZXQ7XG5cbiAgICAgIHRoaXMuZWFjaExheWVyKGZ1bmN0aW9uKG90aGVyTGF5ZXIpIHtcbiAgICAgICAgaWYgKG90aGVyTGF5ZXIgIT09IGxheWVyKSB7XG4gICAgICAgICAgb3RoZXJMYXllci5fcmVzZXRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICBvdGhlckxheWVyLmRyYWdnaW5nLl90cmFuc2Zvcm1Qb2ludHMobGF5ZXIuZHJhZ2dpbmcuX21hdHJpeCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9wcm9wYWdhdGVFdmVudChldnQpO1xuICAgIH1cbiAgfTtcblxuICBMLk11bHRpUG9seWdvbi5pbmNsdWRlKGRyYWdNZXRob2RzKTtcbiAgTC5NdWx0aVBvbHlsaW5lLmluY2x1ZGUoZHJhZ01ldGhvZHMpO1xuXG59KSgpO1xuIiwiLyoqXG4gKiBMZWFmbGV0IHZlY3RvciBmZWF0dXJlcyBkcmFnIGZ1bmN0aW9uYWxpdHlcbiAqIEBwcmVzZXJ2ZVxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIERyYWcgaGFuZGxlclxuICogQGNsYXNzIEwuUGF0aC5EcmFnXG4gKiBAZXh0ZW5kcyB7TC5IYW5kbGVyfVxuICovXG5MLkhhbmRsZXIuUGF0aERyYWcgPSBMLkhhbmRsZXIuZXh0ZW5kKCAvKiogQGxlbmRzICBMLlBhdGguRHJhZy5wcm90b3R5cGUgKi8ge1xuXG4gIHN0YXRpY3M6IHtcbiAgICBEUkFHR0FCTEVfQ0xTOiAnbGVhZmxldC1wYXRoLWRyYWdnYWJsZSdcbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtICB7TC5QYXRofSBwYXRoXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ocGF0aCkge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUGF0aH1cbiAgICAgKi9cbiAgICB0aGlzLl9wYXRoID0gcGF0aDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheS48TnVtYmVyPn1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXRyaXggPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9kcmFnSW5Qcm9ncmVzcyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5fZHJhZ01vdmVkID0gZmFsc2U7XG5cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBFbmFibGUgZHJhZ2dpbmdcbiAgICovXG4gIGFkZEhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgY2xhc3NOYW1lID0gTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHQUJMRV9DTFM7XG4gICAgdmFyIHBhdGggICAgICA9IHRoaXMuX3BhdGguX3BhdGg7XG5cbiAgICB0aGlzLl9wYXRoLm9uKCdtb3VzZWRvd24nLCB0aGlzLl9vbkRyYWdTdGFydCwgdGhpcyk7XG4gICAgdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA9XG4gICAgICAodGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSB8fCAnJykgKyAnICcgKyBjbGFzc05hbWU7XG5cbiAgICBpZiAoIUwuUGF0aC5DQU5WQVMgJiYgcGF0aCkge1xuICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHBhdGgsIGNsYXNzTmFtZSk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIERpc2FibGUgZHJhZ2dpbmdcbiAgICovXG4gIHJlbW92ZUhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgY2xhc3NOYW1lID0gTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHQUJMRV9DTFM7XG4gICAgdmFyIHBhdGggICAgICA9IHRoaXMuX3BhdGguX3BhdGg7XG5cbiAgICB0aGlzLl9wYXRoLm9mZignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuICAgIHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgPVxuICAgICAgKHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgfHwgJycpLnJlcGxhY2UoY2xhc3NOYW1lLCAnJyk7XG5cbiAgICBpZiAoIUwuUGF0aC5DQU5WQVMgJiYgcGF0aCkge1xuICAgICAgTC5Eb21VdGlsLnJlbW92ZUNsYXNzKHBhdGgsIGNsYXNzTmFtZSk7XG4gICAgfVxuICAgIHRoaXMuX2RyYWdNb3ZlZCA9IGZhbHNlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBtb3ZlZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2RyYWdNb3ZlZDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBJZiBkcmFnZ2luZyBjdXJyZW50bHkgaW4gcHJvZ3Jlc3MuXG4gICAqXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBpblByb2dyZXNzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZHJhZ0luUHJvZ3Jlc3M7XG4gIH0sXG5cblxuICAvKipcbiAgICogU3RhcnQgZHJhZ1xuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZ1N0YXJ0OiBmdW5jdGlvbihldnQpIHtcbiAgICB0aGlzLl9kcmFnSW5Qcm9ncmVzcyA9IHRydWU7XG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IGV2dC5jb250YWluZXJQb2ludC5jbG9uZSgpO1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gZXZ0LmNvbnRhaW5lclBvaW50LmNsb25lKCk7XG4gICAgdGhpcy5fbWF0cml4ID0gWzEsIDAsIDAsIDEsIDAsIDBdO1xuXG4gICAgaWYodGhpcy5fcGF0aC5fcG9pbnQpIHtcbiAgICAgIHRoaXMuX3BvaW50ID0gdGhpcy5fcGF0aC5fcG9pbnQuY2xvbmUoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9wYXRoLl9tYXBcbiAgICAgIC5vbignbW91c2Vtb3ZlJywgdGhpcy5fb25EcmFnLCB0aGlzKVxuICAgICAgLm9uKCdtb3VzZXVwJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKVxuICAgIHRoaXMuX2RyYWdNb3ZlZCA9IGZhbHNlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIERyYWdnaW5nXG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnOiBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgeCA9IGV2dC5jb250YWluZXJQb2ludC54O1xuICAgIHZhciB5ID0gZXZ0LmNvbnRhaW5lclBvaW50Lnk7XG5cbiAgICB2YXIgbWF0cml4ICAgICA9IHRoaXMuX21hdHJpeDtcbiAgICB2YXIgcGF0aCAgICAgICA9IHRoaXMuX3BhdGg7XG4gICAgdmFyIHN0YXJ0UG9pbnQgPSB0aGlzLl9zdGFydFBvaW50O1xuXG4gICAgdmFyIGR4ID0geCAtIHN0YXJ0UG9pbnQueDtcbiAgICB2YXIgZHkgPSB5IC0gc3RhcnRQb2ludC55O1xuXG4gICAgaWYgKCF0aGlzLl9kcmFnTW92ZWQgJiYgKGR4IHx8IGR5KSkge1xuICAgICAgdGhpcy5fZHJhZ01vdmVkID0gdHJ1ZTtcbiAgICAgIHBhdGguZmlyZSgnZHJhZ3N0YXJ0Jyk7XG5cbiAgICAgIGlmIChwYXRoLl9wb3B1cCkge1xuICAgICAgICBwYXRoLl9wb3B1cC5fY2xvc2UoKTtcbiAgICAgICAgcGF0aC5vZmYoJ2NsaWNrJywgcGF0aC5fb3BlblBvcHVwLCBwYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBtYXRyaXhbNF0gKz0gZHg7XG4gICAgbWF0cml4WzVdICs9IGR5O1xuXG4gICAgc3RhcnRQb2ludC54ID0geDtcbiAgICBzdGFydFBvaW50LnkgPSB5O1xuXG4gICAgcGF0aC5fYXBwbHlUcmFuc2Zvcm0obWF0cml4KTtcblxuICAgIGlmIChwYXRoLl9wb2ludCkgeyAvLyBMLkNpcmNsZSwgTC5DaXJjbGVNYXJrZXJcbiAgICAgIHBhdGguX3BvaW50LnggPSB0aGlzLl9wb2ludC54ICsgbWF0cml4WzRdO1xuICAgICAgcGF0aC5fcG9pbnQueSA9IHRoaXMuX3BvaW50LnkgKyBtYXRyaXhbNV07XG4gICAgfVxuXG4gICAgcGF0aC5maXJlKCdkcmFnJyk7XG4gICAgTC5Eb21FdmVudC5zdG9wKGV2dC5vcmlnaW5hbEV2ZW50KTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBEcmFnZ2luZyBzdG9wcGVkLCBhcHBseVxuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgTC5Eb21FdmVudC5zdG9wKGV2dCk7XG4gICAgTC5Eb21FdmVudC5fZmFrZVN0b3AoeyB0eXBlOiAnY2xpY2snIH0pO1xuXG4gICAgdGhpcy5fZHJhZ0luUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICAvLyB1bmRvIGNvbnRhaW5lciB0cmFuc2Zvcm1cbiAgICB0aGlzLl9wYXRoLl9yZXNldFRyYW5zZm9ybSgpO1xuICAgIC8vIGFwcGx5IG1hdHJpeFxuICAgIHRoaXMuX3RyYW5zZm9ybVBvaW50cyh0aGlzLl9tYXRyaXgpO1xuXG4gICAgdGhpcy5fcGF0aC5fbWFwXG4gICAgICAub2ZmKCdtb3VzZW1vdmUnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG4gICAgICAub2ZmKCdtb3VzZXVwJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgIC8vIGNvbnNpc3RlbmN5XG4gICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnZW5kJywge1xuICAgICAgZGlzdGFuY2U6IE1hdGguc3FydChcbiAgICAgICAgTC5MaW5lVXRpbC5fc3FEaXN0KHRoaXMuX2RyYWdTdGFydFBvaW50LCBldnQuY29udGFpbmVyUG9pbnQpXG4gICAgICApXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fcG9wdXApIHtcbiAgICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLl9wYXRoLm9uKCdjbGljaycsIHRoaXMuX3BhdGguX29wZW5Qb3B1cCwgdGhpcy5fcGF0aCk7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXRyaXggPSBudWxsO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgPSBudWxsO1xuICAgIHRoaXMuX3BvaW50ID0gbnVsbDtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IG51bGw7XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtcyBwb2ludCBhY2NvcmRpbmcgdG8gdGhlIHByb3ZpZGVkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICpcbiAgICogIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuICAgKiAgQHBhcmFtIHtMLkxhdExuZ30gcG9pbnRcbiAgICovXG4gIF90cmFuc2Zvcm1Qb2ludDogZnVuY3Rpb24ocG9pbnQsIG1hdHJpeCkge1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aDtcblxuICAgIHZhciBweCA9IEwucG9pbnQobWF0cml4WzRdLCBtYXRyaXhbNV0pO1xuXG4gICAgdmFyIGNycyA9IHBhdGguX21hcC5vcHRpb25zLmNycztcbiAgICB2YXIgdHJhbnNmb3JtYXRpb24gPSBjcnMudHJhbnNmb3JtYXRpb247XG4gICAgdmFyIHNjYWxlID0gY3JzLnNjYWxlKHBhdGguX21hcC5nZXRab29tKCkpO1xuICAgIHZhciBwcm9qZWN0aW9uID0gY3JzLnByb2plY3Rpb247XG5cbiAgICB2YXIgZGlmZiA9IHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB4LCBzY2FsZSlcbiAgICAgIC5zdWJ0cmFjdCh0cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShMLnBvaW50KDAsIDApLCBzY2FsZSkpO1xuXG4gICAgcmV0dXJuIHByb2plY3Rpb24udW5wcm9qZWN0KHByb2plY3Rpb24ucHJvamVjdChwb2ludCkuX2FkZChkaWZmKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQXBwbGllcyB0cmFuc2Zvcm1hdGlvbiwgZG9lcyBpdCBpbiBvbmUgc3dlZXAgZm9yIHBlcmZvcm1hbmNlLFxuICAgKiBzbyBkb24ndCBiZSBzdXJwcmlzZWQgYWJvdXQgdGhlIGNvZGUgcmVwZXRpdGlvbi5cbiAgICpcbiAgICogWyB4IF0gICBbIGEgIGIgIHR4IF0gWyB4IF0gICBbIGEgKiB4ICsgYiAqIHkgKyB0eCBdXG4gICAqIFsgeSBdID0gWyBjICBkICB0eSBdIFsgeSBdID0gWyBjICogeCArIGQgKiB5ICsgdHkgXVxuICAgKlxuICAgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcbiAgICovXG4gIF90cmFuc2Zvcm1Qb2ludHM6IGZ1bmN0aW9uKG1hdHJpeCkge1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aDtcbiAgICB2YXIgaSwgbGVuLCBsYXRsbmc7XG5cbiAgICB2YXIgcHggPSBMLnBvaW50KG1hdHJpeFs0XSwgbWF0cml4WzVdKTtcblxuICAgIHZhciBjcnMgPSBwYXRoLl9tYXAub3B0aW9ucy5jcnM7XG4gICAgdmFyIHRyYW5zZm9ybWF0aW9uID0gY3JzLnRyYW5zZm9ybWF0aW9uO1xuICAgIHZhciBzY2FsZSA9IGNycy5zY2FsZShwYXRoLl9tYXAuZ2V0Wm9vbSgpKTtcbiAgICB2YXIgcHJvamVjdGlvbiA9IGNycy5wcm9qZWN0aW9uO1xuXG4gICAgdmFyIGRpZmYgPSB0cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShweCwgc2NhbGUpXG4gICAgICAuc3VidHJhY3QodHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0oTC5wb2ludCgwLCAwKSwgc2NhbGUpKTtcblxuICAgIC8vIGNvbnNvbGUudGltZSgndHJhbnNmb3JtJyk7XG5cbiAgICAvLyBhbGwgc2hpZnRzIGFyZSBpbi1wbGFjZVxuICAgIGlmIChwYXRoLl9wb2ludCkgeyAvLyBMLkNpcmNsZVxuICAgICAgcGF0aC5fbGF0bG5nID0gcHJvamVjdGlvbi51bnByb2plY3QoXG4gICAgICAgIHByb2plY3Rpb24ucHJvamVjdChwYXRoLl9sYXRsbmcpLl9hZGQoZGlmZikpO1xuICAgICAgcGF0aC5fcG9pbnQgPSB0aGlzLl9wb2ludC5fYWRkKHB4KTtcbiAgICB9IGVsc2UgaWYgKHBhdGguX29yaWdpbmFsUG9pbnRzKSB7IC8vIGV2ZXJ5dGhpbmcgZWxzZVxuICAgICAgZm9yIChpID0gMCwgbGVuID0gcGF0aC5fb3JpZ2luYWxQb2ludHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgbGF0bG5nID0gcGF0aC5fbGF0bG5nc1tpXTtcbiAgICAgICAgcGF0aC5fbGF0bG5nc1tpXSA9IHByb2plY3Rpb25cbiAgICAgICAgICAudW5wcm9qZWN0KHByb2plY3Rpb24ucHJvamVjdChsYXRsbmcpLl9hZGQoZGlmZikpO1xuICAgICAgICBwYXRoLl9vcmlnaW5hbFBvaW50c1tpXS5fYWRkKHB4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBob2xlcyBvcGVyYXRpb25zXG4gICAgaWYgKHBhdGguX2hvbGVzKSB7XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSBwYXRoLl9ob2xlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBmb3IgKHZhciBqID0gMCwgbGVuMiA9IHBhdGguX2hvbGVzW2ldLmxlbmd0aDsgaiA8IGxlbjI7IGorKykge1xuICAgICAgICAgIGxhdGxuZyA9IHBhdGguX2hvbGVzW2ldW2pdO1xuICAgICAgICAgIHBhdGguX2hvbGVzW2ldW2pdID0gcHJvamVjdGlvblxuICAgICAgICAgICAgLnVucHJvamVjdChwcm9qZWN0aW9uLnByb2plY3QobGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgICAgICBwYXRoLl9ob2xlUG9pbnRzW2ldW2pdLl9hZGQocHgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29uc29sZS50aW1lRW5kKCd0cmFuc2Zvcm0nKTtcblxuICAgIHBhdGguX3VwZGF0ZVBhdGgoKTtcbiAgfVxuXG59KTtcblxuXG4vLyBJbml0IGhvb2sgaW5zdGVhZCBvZiByZXBsYWNpbmcgdGhlIGBpbml0RXZlbnRzYFxuTC5QYXRoLmFkZEluaXRIb29rKGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5vcHRpb25zLmRyYWdnYWJsZSkge1xuICAgIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgICB0aGlzLmRyYWdnaW5nLmVuYWJsZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRyYWdnaW5nID0gbmV3IEwuSGFuZGxlci5QYXRoRHJhZyh0aGlzKTtcbiAgICAgIHRoaXMuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICB0aGlzLmRyYWdnaW5nLmRpc2FibGUoKTtcbiAgfVxufSk7XG5cbi8qXG4gKiBSZXR1cm4gdHJhbnNmb3JtZWQgcG9pbnRzIGluIGNhc2UgaWYgZHJhZ2dpbmcgaXMgZW5hYmxlZCBhbmQgaW4gcHJvZ3Jlc3MsXG4gKiBvdGhlcndpc2UgLSBjYWxsIG9yaWdpbmFsIG1ldGhvZC5cbiAqXG4gKiBGb3IgTC5DaXJjbGUgYW5kIEwuUG9seWxpbmVcbiAqL1xuXG4vLyBkb24ndCBsaWtlIHRoaXM/IG1lIG5laXRoZXIsIGJ1dCBJIGxpa2UgaXQgZXZlbiBsZXNzXG4vLyB3aGVuIHRoZSBvcmlnaW5hbCBtZXRob2RzIGFyZSBub3QgZXhwb3NlZFxuTC5DaXJjbGUucHJvdG90eXBlLl9nZXRMYXRMbmcgPSBMLkNpcmNsZS5wcm90b3R5cGUuZ2V0TGF0TG5nO1xuTC5DaXJjbGUucHJvdG90eXBlLmdldExhdExuZyA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5kcmFnZ2luZyAmJiB0aGlzLmRyYWdnaW5nLmluUHJvZ3Jlc3MoKSkge1xuICAgIHJldHVybiB0aGlzLmRyYWdnaW5nLl90cmFuc2Zvcm1Qb2ludCh0aGlzLl9sYXRsbmcsIHRoaXMuZHJhZ2dpbmcuX21hdHJpeCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldExhdExuZygpO1xuICB9XG59O1xuXG5cbkwuUG9seWxpbmUucHJvdG90eXBlLl9nZXRMYXRMbmdzID0gTC5Qb2x5bGluZS5wcm90b3R5cGUuZ2V0TGF0TG5ncztcbkwuUG9seWxpbmUucHJvdG90eXBlLmdldExhdExuZ3MgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuZHJhZ2dpbmcgJiYgdGhpcy5kcmFnZ2luZy5pblByb2dyZXNzKCkpIHtcbiAgICB2YXIgbWF0cml4ID0gdGhpcy5kcmFnZ2luZy5fbWF0cml4O1xuICAgIHZhciBwb2ludHMgPSB0aGlzLl9nZXRMYXRMbmdzKCk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHBvaW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgcG9pbnRzW2ldID0gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnQocG9pbnRzW2ldLCBtYXRyaXgpO1xuICAgIH1cbiAgICByZXR1cm4gcG9pbnRzO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0aGlzLl9nZXRMYXRMbmdzKCk7XG4gIH1cbn07XG4iLCIvKipcbiAqIE1hdHJpeCB0cmFuc2Zvcm0gcGF0aCBmb3IgU1ZHL1ZNTFxuICogVE9ETzogYWRhcHQgdG8gTGVhZmxldCAwLjggdXBvbiByZWxlYXNlXG4gKi9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbmlmIChMLkJyb3dzZXIuc3ZnKSB7IC8vIFNWRyB0cmFuc2Zvcm1hdGlvblxuXG4gIEwuUGF0aC5pbmNsdWRlKHtcblxuICAgIC8qKlxuICAgICAqIFJlc2V0IHRyYW5zZm9ybSBtYXRyaXhcbiAgICAgKi9cbiAgICBfcmVzZXRUcmFuc2Zvcm06IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fY29udGFpbmVyLnNldEF0dHJpYnV0ZU5TKG51bGwsICd0cmFuc2Zvcm0nLCAnJyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFwcGxpZXMgbWF0cml4IHRyYW5zZm9ybWF0aW9uIHRvIFNWR1xuICAgICAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuICAgICAqL1xuICAgIF9hcHBseVRyYW5zZm9ybTogZnVuY3Rpb24obWF0cml4KSB7XG4gICAgICB0aGlzLl9jb250YWluZXIuc2V0QXR0cmlidXRlTlMobnVsbCwgXCJ0cmFuc2Zvcm1cIixcbiAgICAgICAgJ21hdHJpeCgnICsgbWF0cml4LmpvaW4oJyAnKSArICcpJyk7XG4gICAgfVxuXG4gIH0pO1xuXG59IGVsc2UgeyAvLyBWTUwgdHJhbnNmb3JtIHJvdXRpbmVzXG5cbiAgTC5QYXRoLmluY2x1ZGUoe1xuXG4gICAgLyoqXG4gICAgICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuICAgICAqL1xuICAgIF9yZXNldFRyYW5zZm9ybTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5fc2tldykge1xuICAgICAgICAvLyBzdXBlciBpbXBvcnRhbnQhIHdvcmthcm91bmQgZm9yIGEgJ2p1bXBpbmcnIGdsaXRjaDpcbiAgICAgICAgLy8gZGlzYWJsZSB0cmFuc2Zvcm0gYmVmb3JlIHJlbW92aW5nIGl0XG4gICAgICAgIHRoaXMuX3NrZXcub24gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fY29udGFpbmVyLnJlbW92ZUNoaWxkKHRoaXMuX3NrZXcpO1xuICAgICAgICB0aGlzLl9za2V3ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gVk1MXG4gICAgICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAgICovXG4gICAgX2FwcGx5VHJhbnNmb3JtOiBmdW5jdGlvbihtYXRyaXgpIHtcbiAgICAgIHZhciBza2V3ID0gdGhpcy5fc2tldztcblxuICAgICAgaWYgKCFza2V3KSB7XG4gICAgICAgIHNrZXcgPSB0aGlzLl9jcmVhdGVFbGVtZW50KCdza2V3Jyk7XG4gICAgICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZChza2V3KTtcbiAgICAgICAgc2tldy5zdHlsZS5iZWhhdmlvciA9ICd1cmwoI2RlZmF1bHQjVk1MKSc7XG4gICAgICAgIHRoaXMuX3NrZXcgPSBza2V3O1xuICAgICAgfVxuXG4gICAgICAvLyBoYW5kbGUgc2tldy90cmFuc2xhdGUgc2VwYXJhdGVseSwgY2F1c2UgaXQncyBicm9rZW5cbiAgICAgIHZhciBtdCA9IG1hdHJpeFswXS50b0ZpeGVkKDgpICsgXCIgXCIgKyBtYXRyaXhbMV0udG9GaXhlZCg4KSArIFwiIFwiICtcbiAgICAgICAgbWF0cml4WzJdLnRvRml4ZWQoOCkgKyBcIiBcIiArIG1hdHJpeFszXS50b0ZpeGVkKDgpICsgXCIgMCAwXCI7XG4gICAgICB2YXIgb2Zmc2V0ID0gTWF0aC5mbG9vcihtYXRyaXhbNF0pLnRvRml4ZWQoKSArIFwiLCBcIiArXG4gICAgICAgIE1hdGguZmxvb3IobWF0cml4WzVdKS50b0ZpeGVkKCkgKyBcIlwiO1xuXG4gICAgICB2YXIgcyA9IHRoaXMuX2NvbnRhaW5lci5zdHlsZTtcbiAgICAgIHZhciBsID0gcGFyc2VGbG9hdChzLmxlZnQpO1xuICAgICAgdmFyIHQgPSBwYXJzZUZsb2F0KHMudG9wKTtcbiAgICAgIHZhciB3ID0gcGFyc2VGbG9hdChzLndpZHRoKTtcbiAgICAgIHZhciBoID0gcGFyc2VGbG9hdChzLmhlaWdodCk7XG5cbiAgICAgIGlmIChpc05hTihsKSkgbCA9IDA7XG4gICAgICBpZiAoaXNOYU4odCkpIHQgPSAwO1xuICAgICAgaWYgKGlzTmFOKHcpIHx8ICF3KSB3ID0gMTtcbiAgICAgIGlmIChpc05hTihoKSB8fCAhaCkgaCA9IDE7XG5cbiAgICAgIHZhciBvcmlnaW4gPSAoLWwgLyB3IC0gMC41KS50b0ZpeGVkKDgpICsgXCIgXCIgKyAoLXQgLyBoIC0gMC41KS50b0ZpeGVkKDgpO1xuXG4gICAgICBza2V3Lm9uID0gXCJmXCI7XG4gICAgICBza2V3Lm1hdHJpeCA9IG10O1xuICAgICAgc2tldy5vcmlnaW4gPSBvcmlnaW47XG4gICAgICBza2V3Lm9mZnNldCA9IG9mZnNldDtcbiAgICAgIHNrZXcub24gPSB0cnVlO1xuICAgIH1cblxuICB9KTtcbn1cblxuLy8gUmVuZGVyZXItaW5kZXBlbmRlbnRcbkwuUGF0aC5pbmNsdWRlKHtcblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIGZlYXR1cmUgd2FzIGRyYWdnZWQsIHRoYXQnbGwgc3VwcmVzcyB0aGUgY2xpY2sgZXZlbnRcbiAgICogb24gbW91c2V1cC4gVGhhdCBmaXhlcyBwb3B1cHMgZm9yIGV4YW1wbGVcbiAgICpcbiAgICogQHBhcmFtICB7TW91c2VFdmVudH0gZVxuICAgKi9cbiAgX29uTW91c2VDbGljazogZnVuY3Rpb24oZSkge1xuICAgIGlmICgodGhpcy5kcmFnZ2luZyAmJiB0aGlzLmRyYWdnaW5nLm1vdmVkKCkpIHx8XG4gICAgICAodGhpcy5fbWFwLmRyYWdnaW5nICYmIHRoaXMuX21hcC5kcmFnZ2luZy5tb3ZlZCgpKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2ZpcmVNb3VzZUV2ZW50KGUpO1xuICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gTC5DaXJjbGVNYXJrZXIuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgdGV4dFN0eWxlOiB7XG4gICAgICBjb2xvcjogJyNmZmYnLFxuICAgICAgZm9udFNpemU6IDEyXG4gICAgfSxcbiAgICBzaGlmdFk6IDYsXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNsYXNzIExhYmVsZWRDaXJjbGVcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtMLkNpcmNsZU1hcmtlcn1cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIHRleHRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGxhdGxuZ1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24odGV4dCwgbGF0bG5nLCBvcHRpb25zKSB7XG4gICAgdGhpcy5fdGV4dCA9IHRleHQ7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge0xhYmVsZWRDaXJjbGV9XG4gICAqL1xuICBzZXRUZXh0OiBmdW5jdGlvbih0ZXh0KSB7XG4gICAgdGhpcy5fdGV4dCA9IHRleHQ7XG4gICAgaWYgKHRoaXMuX3RleHROb2RlKSB7XG4gICAgICB0aGlzLl90ZXh0RWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLl90ZXh0Tm9kZSk7XG4gICAgfVxuICAgIHRoaXMuX3RleHROb2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGhpcy5fdGV4dCk7XG4gICAgdGhpcy5fdGV4dEVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dE5vZGUpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlIHRleHQgbm9kZSBpbiBjb250YWluZXJcbiAgICovXG4gIF9pbml0UGF0aDogZnVuY3Rpb24oKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLl9pbml0UGF0aC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX3RleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlRWxlbWVudCgndGV4dCcpO1xuICAgIHRoaXMuc2V0VGV4dCh0aGlzLl90ZXh0KTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dEVsZW1lbnQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIHRoZSB0ZXh0IGluIGNvbnRhaW5lclxuICAgKi9cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5fdXBkYXRlUGF0aC5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkQ2lyY2xlfVxuICAgKi9cbiAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5vbkFkZC5jYWxsKHRoaXMsIG1hcCk7XG4gICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ2FsY3VsYXRlIHBvc2l0aW9uIGZvciB0ZXh0XG4gICAqL1xuICBfdXBkYXRlVGV4dFBvc2l0aW9uOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICB2YXIgYmJveCA9IHRleHRFbGVtZW50LmdldEJCb3goKTtcbiAgICB2YXIgdGV4dFBvc2l0aW9uID0gdGhpcy5fcG9pbnQuc3VidHJhY3QoXG4gICAgICBMLnBvaW50KGJib3gud2lkdGgsIC1iYm94LmhlaWdodCArIHRoaXMub3B0aW9ucy5zaGlmdFkpLmRpdmlkZUJ5KDIpKTtcblxuICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneCcsIHRleHRQb3NpdGlvbi54KTtcbiAgICB0ZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3knLCB0ZXh0UG9zaXRpb24ueSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2V0IHRleHQgc3R5bGVcbiAgICovXG4gIF91cGRhdGVTdHlsZTogZnVuY3Rpb24oKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLl91cGRhdGVTdHlsZS5jYWxsKHRoaXMpO1xuXG4gICAgdmFyIHN0eWxlcyA9IHRoaXMub3B0aW9ucy50ZXh0U3R5bGU7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBzdHlsZXMpIHtcbiAgICAgIGlmIChzdHlsZXMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgdmFyIHN0eWxlUHJvcCA9IHByb3A7XG4gICAgICAgIGlmIChwcm9wID09PSAnY29sb3InKSB7XG4gICAgICAgICAgc3R5bGVQcm9wID0gJ3N0cm9rZSc7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdGV4dEVsZW1lbnQuc3R5bGVbc3R5bGVQcm9wXSA9IHN0eWxlc1twcm9wXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuIiwidmFyIEwgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snTCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnTCddIDogbnVsbCk7XG52YXIgQ2lyY2xlID0gcmVxdWlyZSgnLi9jaXJjbGUnKTtcbnJlcXVpcmUoJ2xlYWZsZXQtcGF0aC1kcmFnJyk7XG5cbnZhciBMYWJlbGVkTWFya2VyID0gTC5GZWF0dXJlR3JvdXAuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHJldHVybiB7U3RyaW5nfVxuICAgICAqL1xuICAgIGdldExhYmVsVGV4dDogZnVuY3Rpb24obWFya2VyLCBmZWF0dXJlKSB7XG4gICAgICByZXR1cm4gZmVhdHVyZS5wcm9wZXJ0aWVzLnRleHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSAge0xhYmVsZWRNYXJrZXJ9IG1hcmtlclxuICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgIGZlYXR1cmVcbiAgICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gICAgICBsYXRsbmdcbiAgICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICAgKi9cbiAgICBnZXRMYWJlbFBvc2l0aW9uOiBmdW5jdGlvbihtYXJrZXIsIGZlYXR1cmUsIGxhdGxuZykge1xuICAgICAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uID9cbiAgICAgICAgTC5sYXRMbmcoZmVhdHVyZS5wcm9wZXJ0aWVzLmxhYmVsUG9zaXRpb24uc2xpY2UoKS5yZXZlcnNlKCkpIDpcbiAgICAgICAgbGF0bG5nO1xuICAgIH0sXG5cbiAgICBsYWJlbFBvc2l0aW9uS2V5OiAnbGFiZWxQb3NpdGlvbicsXG5cbiAgICBtYXJrZXJPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyNmMDAnLFxuICAgICAgZmlsbE9wYWNpdHk6IDAuOCxcbiAgICAgIGRyYWdnYWJsZTogdHJ1ZSxcbiAgICAgIHJhZGl1czogMTVcbiAgICB9LFxuXG4gICAgYW5jaG9yT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjMDBmJyxcbiAgICAgIHJhZGl1czogM1xuICAgIH0sXG5cbiAgICBsaW5lT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGRhc2hBcnJheTogWzUsIDE1XSxcbiAgICAgIGxpbmVDYXA6ICdzcXVhcmUnXG4gICAgfVxuXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNsYXNzIExhYmVsZWRNYXJrZXJcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtMLkZlYXR1cmVHcm91cH1cbiAgICpcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGxhdGxuZ1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgZmVhdHVyZVxuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24obGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKSB7XG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHRoaXMuZmVhdHVyZSA9IGZlYXR1cmUgfHwge1xuICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxuICAgICAgcHJvcGVydGllczoge30sXG4gICAgICBnZW9tZXRyeToge1xuICAgICAgICAndHlwZSc6ICdQb2ludCdcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nfVxuICAgICAqL1xuICAgIHRoaXMuX2xhdGxuZyA9IGxhdGxuZztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0NpcmNsZUxhYmVsfVxuICAgICAqL1xuICAgIHRoaXMuX21hcmtlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkNpcmNsZU1hcmtlcn1cbiAgICAgKi9cbiAgICB0aGlzLl9hbmNob3IgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2x5bGluZX1cbiAgICAgKi9cbiAgICB0aGlzLl9saW5lID0gbnVsbDtcblxuICAgIHRoaXMuX2NyZWF0ZUxheWVycygpO1xuICAgIEwuTGF5ZXJHcm91cC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsXG4gICAgICBbdGhpcy5fYW5jaG9yLCB0aGlzLl9saW5lLCB0aGlzLl9tYXJrZXJdKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIGdldExhYmVsUG9zaXRpb246IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICBnZXRMYXRMbmc6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9sYXRsbmc7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2VyaWFsaXplXG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIHRvR2VvSlNPTjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZlYXR1cmUgPSBMLkdlb0pTT04uZ2V0RmVhdHVyZSh0aGlzLCB7XG4gICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgY29vcmRpbmF0ZXM6IEwuR2VvSlNPTi5sYXRMbmdUb0Nvb3Jkcyh0aGlzLl9hbmNob3IuZ2V0TGF0TG5nKCkpXG4gICAgfSk7XG4gICAgZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMub3B0aW9ucy5sYWJlbFBvc2l0aW9uS2V5XSA9XG4gICAgICBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5fbWFya2VyLmdldExhdExuZygpKTtcbiAgICByZXR1cm4gZmVhdHVyZTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkTWFya2VyfVxuICAgKi9cbiAgc2V0VGV4dDogZnVuY3Rpb24odGV4dCkge1xuICAgIHRoaXMuX21hcmtlci5zZXRUZXh0KHRleHQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW5jaG9yLCBsaW5lIGFuZCBsYWJlbFxuICAgKi9cbiAgX2NyZWF0ZUxheWVyczogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9wdHMgPSB0aGlzLm9wdGlvbnM7XG4gICAgdmFyIHBvcyAgPSBvcHRzLmdldExhYmVsUG9zaXRpb24odGhpcywgdGhpcy5mZWF0dXJlLCB0aGlzLl9sYXRsbmcpO1xuICAgIHZhciB0ZXh0ID0gb3B0cy5nZXRMYWJlbFRleHQodGhpcywgdGhpcy5mZWF0dXJlKTtcblxuICAgIHRoaXMuX21hcmtlciA9IG5ldyBDaXJjbGUodGV4dCwgcG9zLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSxcbiAgICAgICAgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5tYXJrZXJPcHRpb25zLFxuICAgICAgICBvcHRzLm1hcmtlck9wdGlvbnMpXG4gICAgKS5vbignZHJhZycsIHRoaXMuX29uTWFya2VyRHJhZywgdGhpcyk7XG5cbiAgICB0aGlzLl9hbmNob3IgPSBuZXcgTC5DaXJjbGVNYXJrZXIodGhpcy5fbGF0bG5nLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSwgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5hbmNob3JPcHRpb25zLFxuICAgICAgICBvcHRzLmFuY2hvck9wdGlvbnMpKTtcblxuICAgIHRoaXMuX2xpbmUgPSBuZXcgTC5Qb2x5bGluZShbdGhpcy5fbGF0bG5nLCB0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCldLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSwgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5saW5lT3B0aW9ucyxcbiAgICAgICAgb3B0cy5saW5lT3B0aW9ucykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIExpbmUgZHJhZ2dpbmdcbiAgICogQHBhcmFtICB7RHJhZ0V2ZW50fSBldnRcbiAgICovXG4gIF9vbk1hcmtlckRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHRoaXMuX2xpbmUuc2V0TGF0TG5ncyhbZXZ0LnRhcmdldC5nZXRMYXRMbmcoKSwgdGhpcy5fbGF0bG5nXSk7XG4gIH1cblxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5MYWJlbGVkQ2lyY2xlTWFya2VyID0gTGFiZWxlZE1hcmtlcjtcbkwubGFiZWxlZENpcmNsZU1hcmtlciA9IGZ1bmN0aW9uKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IExhYmVsZWRNYXJrZXIobGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKTtcbn07XG4iXX0=
