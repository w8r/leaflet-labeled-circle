(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).LabeledCircle = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = require('./src/marker');

},{"./src/marker":3}],2:[function(require,module,exports){
'use strict';

var L = require('leaflet');

module.exports = L.CircleMarker.extend({

  initialize: function initialize(text, latlng, options) {
    this._text = text;
    L.CircleMarker.prototype.initialize.call(this, latlng, options);
  },

  _initPath: function _initPath() {
    L.CircleMarker.prototype._initPath.call(this);
    this._textElement = this._createElement('text');
    this._textNode = document.createTextNode(this._text);
    this._textElement.appendChild(this._textNode);
    this._container.appendChild(this._textElement);
  },

  setText: function setText(text) {
    this._text = text;
    this._textElement.removeChild(this._textNode);
    this._textNode = document.createTextNode(this._text);
    this._textElement.appendChild(this._textNode);
  },

  _updatePath: function _updatePath() {
    L.CircleMarker.prototype._updatePath.call(this);

    this._textElement.setAttribute('x', this._point.x);
    this._textElement.setAttribute('y', this._point.y);
    console.log(this._textElement.textContent);
  }
});

},{"leaflet":undefined}],3:[function(require,module,exports){
'use strict';

var L = require('leaflet');
var Circle = require('./circle');

module.exports = L.FeatureGroup.extend({

  options: {

    getLabel: function getLabel(feature) {
      return feature.properties.text;
    },

    getLabelInitialPosition: function getLabelInitialPosition(feature) {
      return feature.properties.labelPosition || null;
    },

    markerOptions: {
      color: '#f00',
      fillOpacity: 0.8,
      draggable: true,
      radius: 10
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

  initialize: function initialize(latlng, feature, options) {
    L.Util.setOptions(this, options);

    /**
     * @type {Object}
     */
    this._feature = feature || { properties: {} };

    /**
     * @type {L.LatLng}
     */
    this._latlng = latlng;

    this._initLayers();

    L.LayerGroup.prototype.initialize.call(this, [this._anchor, this._line, this._marker], options);
  },
  _initLayers: function _initLayers() {
    var labelPos = latlng;
    // this._feature.properties.labelPosition.slice().reverse()

    this._marker = new Circle(options.getLabel(this._feature), labelPos, this.options.markerOptions).on('drag', this._onLabelDrag, this);

    this._anchor = new L.CircleMarker(this._latlng, this.options.anchorOptions);

    this._line = new L.Polyline([this._latlng, this._marker.getLatLng()], this.options.lineOptions);
  },
  onAdd: function onAdd(map) {
    return L.LayerGroup.prototype.onAdd.call(this, map);
  },
  _onLabelDrag: function _onLabelDrag(evt) {
    this._line.setLatLngs([evt.target.getLatLng(), this._latlng]);
  }
});

},{"./circle":2,"leaflet":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsInNyYy9jaXJjbGUuanMiLCJzcmMvbWFya2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxjQUFSLENBQWpCOzs7OztBQ0FBLElBQUksSUFBSSxRQUFRLFNBQVIsQ0FBSjs7QUFFSixPQUFPLE9BQVAsR0FBaUIsRUFBRSxZQUFGLENBQWUsTUFBZixDQUFzQjs7QUFFckMsY0FBWSxvQkFBVSxJQUFWLEVBQWdCLE1BQWhCLEVBQXdCLE9BQXhCLEVBQWlDO0FBQzNDLFNBQUssS0FBTCxHQUFhLElBQWIsQ0FEMkM7QUFFM0MsTUFBRSxZQUFGLENBQWUsU0FBZixDQUF5QixVQUF6QixDQUFvQyxJQUFwQyxDQUF5QyxJQUF6QyxFQUErQyxNQUEvQyxFQUF1RCxPQUF2RCxFQUYyQztHQUFqQzs7QUFLWixhQUFXLHFCQUFXO0FBQ3BCLE1BQUUsWUFBRixDQUFlLFNBQWYsQ0FBeUIsU0FBekIsQ0FBbUMsSUFBbkMsQ0FBd0MsSUFBeEMsRUFEb0I7QUFFcEIsU0FBSyxZQUFMLEdBQW9CLEtBQUssY0FBTCxDQUFvQixNQUFwQixDQUFwQixDQUZvQjtBQUdwQixTQUFLLFNBQUwsR0FBaUIsU0FBUyxjQUFULENBQXdCLEtBQUssS0FBTCxDQUF6QyxDQUhvQjtBQUlwQixTQUFLLFlBQUwsQ0FBa0IsV0FBbEIsQ0FBOEIsS0FBSyxTQUFMLENBQTlCLENBSm9CO0FBS3BCLFNBQUssVUFBTCxDQUFnQixXQUFoQixDQUE0QixLQUFLLFlBQUwsQ0FBNUIsQ0FMb0I7R0FBWDs7QUFRWCxXQUFTLGlCQUFTLElBQVQsRUFBZTtBQUN0QixTQUFLLEtBQUwsR0FBYSxJQUFiLENBRHNCO0FBRXRCLFNBQUssWUFBTCxDQUFrQixXQUFsQixDQUE4QixLQUFLLFNBQUwsQ0FBOUIsQ0FGc0I7QUFH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O0FBQ2hCLFNBQUssS0FBTCxDQUFXLFVBQVgsQ0FBc0IsQ0FBQyxJQUFJLE1BQUosQ0FBVyxTQUFYLEVBQUQsRUFBeUIsS0FBSyxPQUFMLENBQS9DLEVBRGdCO0dBdEVtQjtDQUF0QixDQUFqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL21hcmtlcicpO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5DaXJjbGVNYXJrZXIuZXh0ZW5kKHtcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAodGV4dCwgbGF0bG5nLCBvcHRpb25zKSB7XG4gICAgdGhpcy5fdGV4dCA9IHRleHQ7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIG9wdGlvbnMpO1xuICB9LFxuXG4gIF9pbml0UGF0aDogZnVuY3Rpb24oKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLl9pbml0UGF0aC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX3RleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlRWxlbWVudCgndGV4dCcpO1xuICAgIHRoaXMuX3RleHROb2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGhpcy5fdGV4dCk7XG4gICAgdGhpcy5fdGV4dEVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dE5vZGUpO1xuICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl90ZXh0RWxlbWVudCk7XG4gIH0sXG5cbiAgc2V0VGV4dDogZnVuY3Rpb24odGV4dCkge1xuICAgIHRoaXMuX3RleHQgPSB0ZXh0O1xuICAgIHRoaXMuX3RleHRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMuX3RleHROb2RlKTtcbiAgICB0aGlzLl90ZXh0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3RleHRFbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuX3RleHROb2RlKTtcbiAgfSxcblxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLl91cGRhdGVQYXRoLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLl90ZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3gnLCB0aGlzLl9wb2ludC54KTtcbiAgICB0aGlzLl90ZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3knLCB0aGlzLl9wb2ludC55KTtcbiAgICBjb25zb2xlLmxvZyh0aGlzLl90ZXh0RWxlbWVudC50ZXh0Q29udGVudCk7XG4gIH1cbn0pO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG52YXIgQ2lyY2xlID0gcmVxdWlyZSgnLi9jaXJjbGUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBMLkZlYXR1cmVHcm91cC5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcblxuICAgIGdldExhYmVsOiAoZmVhdHVyZSkgPT4gZmVhdHVyZS5wcm9wZXJ0aWVzLnRleHQsXG5cbiAgICBnZXRMYWJlbEluaXRpYWxQb3NpdGlvbihmZWF0dXJlKSB7XG4gICAgICByZXR1cm4gZmVhdHVyZS5wcm9wZXJ0aWVzLmxhYmVsUG9zaXRpb24gfHwgbnVsbDtcbiAgICB9LFxuXG4gICAgbWFya2VyT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGZpbGxPcGFjaXR5OiAwLjgsXG4gICAgICBkcmFnZ2FibGU6IHRydWUsXG4gICAgICByYWRpdXM6IDEwXG4gICAgfSxcblxuICAgIGFuY2hvck9wdGlvbnM6IHtcbiAgICAgIGNvbG9yOiAnIzAwZicsXG4gICAgICByYWRpdXM6IDNcbiAgICB9LFxuXG4gICAgbGluZU9wdGlvbnM6IHtcbiAgICAgIGNvbG9yOiAnI2YwMCcsXG4gICAgICBkYXNoQXJyYXk6IFs1LCAxNV0sXG4gICAgICBsaW5lQ2FwOiAnc3F1YXJlJ1xuICAgIH1cbiAgfSxcblxuICBpbml0aWFsaXplKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB0aGlzLl9mZWF0dXJlID0gZmVhdHVyZSB8fCB7IHByb3BlcnRpZXM6IHt9IH07XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5MYXRMbmd9XG4gICAgICovXG4gICAgdGhpcy5fbGF0bG5nICA9IGxhdGxuZztcblxuICAgIHRoaXMuX2luaXRMYXllcnMoKTtcblxuICAgICBMLkxheWVyR3JvdXAucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLFxuICAgICAgIFt0aGlzLl9hbmNob3IsIHRoaXMuX2xpbmUsIHRoaXMuX21hcmtlcl0sIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgX2luaXRMYXllcnMoKSB7XG4gICAgdmFyIGxhYmVsUG9zID0gbGF0bG5nO1xuICAgIC8vIHRoaXMuX2ZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uLnNsaWNlKCkucmV2ZXJzZSgpXG5cbiAgICB0aGlzLl9tYXJrZXIgPSBuZXcgQ2lyY2xlKG9wdGlvbnMuZ2V0TGFiZWwodGhpcy5fZmVhdHVyZSksIGxhYmVsUG9zLFxuICAgICAgdGhpcy5vcHRpb25zLm1hcmtlck9wdGlvbnMpXG4gICAgLm9uKCdkcmFnJywgdGhpcy5fb25MYWJlbERyYWcsIHRoaXMpO1xuXG4gICAgdGhpcy5fYW5jaG9yID0gbmV3IEwuQ2lyY2xlTWFya2VyKHRoaXMuX2xhdGxuZyxcbiAgICAgIHRoaXMub3B0aW9ucy5hbmNob3JPcHRpb25zKTtcblxuICAgIHRoaXMuX2xpbmUgPSBuZXcgTC5Qb2x5bGluZShbdGhpcy5fbGF0bG5nLCB0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCldLFxuICAgICAgdGhpcy5vcHRpb25zLmxpbmVPcHRpb25zKTtcbiAgfSxcblxuXG4gIG9uQWRkKG1hcCkge1xuICAgIHJldHVybiBMLkxheWVyR3JvdXAucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcbiAgfSxcblxuXG4gIF9vbkxhYmVsRHJhZyhldnQpIHtcbiAgICB0aGlzLl9saW5lLnNldExhdExuZ3MoW2V2dC50YXJnZXQuZ2V0TGF0TG5nKCksIHRoaXMuX2xhdGxuZ10pO1xuICB9XG5cbn0pO1xuIl19
