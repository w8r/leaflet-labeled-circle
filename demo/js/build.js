(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).LabeledCircleMarker = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

//require('../../');

var map = global.map = new L.Map('map', {}).setView([22.42658, 114.1952], 10);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: '&copy; ' + '<a href="http://osm.org/copyright">OSM</a> contributors'
}).addTo(map);

var pos1 = [114.1952, 22.42658];
var marker1 = global.marker1 = new L.LabeledCircleMarker(pos1.slice().reverse(), {
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
  markerOptions: { color: '#050' },
  interactive: true
}).addTo(map);

var pos2 = [114.14657592773438, 22.33927931468312];
var marker2 = global.marker2 = new L.LabeledCircleMarker(pos2.slice().reverse(), {
  "type": "Feature",
  "properties": {
    "text": 12,
    "labelPosition": [113.89719584960939, 22.413885141186906]
  },
  "geometry": {
    "type": "Point",
    "coordinates": pos2
  }
}, {
  interactive: true
}).addTo(map);

var pos3 = [114.12872314453125, 22.395157990290755];
var marker3 = global.marker3 = new L.LabeledCircleMarker(pos3.slice().reverse(), {
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

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZW1vL2pzL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0FDQUE7O0FBRUEsSUFBSSxNQUFNLE9BQU8sR0FBUCxHQUFhLElBQUksRUFBRSxHQUFOLENBQVUsS0FBVixFQUFpQixFQUFqQixFQUFxQixPQUFyQixDQUE2QixDQUFDLFFBQUQsRUFBVyxRQUFYLENBQTdCLEVBQW1ELEVBQW5ELENBQXZCOztBQUdBLEVBQUUsU0FBRixDQUFZLHlDQUFaLEVBQXVEO0FBQ3JELGVBQWEsWUFDWDtBQUZtRCxDQUF2RCxFQUdHLEtBSEgsQ0FHUyxHQUhUOztBQUtBLElBQUksT0FBTyxDQUFFLFFBQUYsRUFBWSxRQUFaLENBQVg7QUFDQSxJQUFJLFVBQVUsT0FBTyxPQUFQLEdBQWlCLElBQUksRUFBRSxtQkFBTixDQUEwQixLQUFLLEtBQUwsR0FBYSxPQUFiLEVBQTFCLEVBQWtEO0FBQy9FLFVBQVEsU0FEdUU7QUFFL0UsZ0JBQWM7QUFDWixZQUFRLE1BREk7QUFFWixxQkFBaUIsQ0FDZixrQkFEZSxFQUVmLGtCQUZlO0FBRkwsR0FGaUU7QUFTL0UsY0FBWTtBQUNWLFlBQVEsT0FERTtBQUVWLG1CQUFlO0FBRkw7QUFUbUUsQ0FBbEQsRUFhNUI7QUFDRCxpQkFBZSxFQUFFLE9BQU8sTUFBVCxFQURkO0FBRUQsZUFBYTtBQUZaLENBYjRCLEVBZ0I1QixLQWhCNEIsQ0FnQnRCLEdBaEJzQixDQUEvQjs7QUFrQkEsSUFBSSxPQUFPLENBQUUsa0JBQUYsRUFBc0IsaUJBQXRCLENBQVg7QUFDQSxJQUFJLFVBQVUsT0FBTyxPQUFQLEdBQWlCLElBQUksRUFBRSxtQkFBTixDQUEwQixLQUFLLEtBQUwsR0FBYSxPQUFiLEVBQTFCLEVBQWtEO0FBQy9FLFVBQVEsU0FEdUU7QUFFL0UsZ0JBQWM7QUFDWixZQUFRLEVBREk7QUFFWixxQkFBaUIsQ0FDZixrQkFEZSxFQUVmLGtCQUZlO0FBRkwsR0FGaUU7QUFTL0UsY0FBWTtBQUNWLFlBQVEsT0FERTtBQUVWLG1CQUFlO0FBRkw7QUFUbUUsQ0FBbEQsRUFhNUI7QUFDRCxlQUFhO0FBRFosQ0FiNEIsRUFlNUIsS0FmNEIsQ0FldEIsR0Fmc0IsQ0FBL0I7O0FBaUJBLElBQUksT0FBTyxDQUFDLGtCQUFELEVBQXFCLGtCQUFyQixDQUFYO0FBQ0EsSUFBSSxVQUFVLE9BQU8sT0FBUCxHQUFpQixJQUFJLEVBQUUsbUJBQU4sQ0FBMEIsS0FBSyxLQUFMLEdBQWEsT0FBYixFQUExQixFQUFrRDtBQUMvRSxVQUFRLFNBRHVFO0FBRS9FLGdCQUFjO0FBQ1osWUFBUSxDQURJO0FBRVoscUJBQWlCLENBQ2Ysa0JBRGUsRUFFZixrQkFGZTtBQUZMLEdBRmlFO0FBUy9FLGNBQVk7QUFDVixZQUFRLE9BREU7QUFFVixtQkFBZSxDQUNiLGtCQURhLEVBRWIsa0JBRmE7QUFGTDtBQVRtRSxDQUFsRCxFQWdCNUI7QUFDRCxpQkFBZTtBQUNiLFdBQU87QUFETTtBQURkLENBaEI0QixFQW9CNUIsS0FwQjRCLENBb0J0QixHQXBCc0IsQ0FBL0IiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy9yZXF1aXJlKCcuLi8uLi8nKTtcblxudmFyIG1hcCA9IGdsb2JhbC5tYXAgPSBuZXcgTC5NYXAoJ21hcCcsIHt9KS5zZXRWaWV3KFsyMi40MjY1OCwgMTE0LjE5NTJdLCAxMCk7XG5cblxuTC50aWxlTGF5ZXIoJ2h0dHA6Ly97c30udGlsZS5vc20ub3JnL3t6fS97eH0ve3l9LnBuZycsIHtcbiAgYXR0cmlidXRpb246ICcmY29weTsgJyArXG4gICAgJzxhIGhyZWY9XCJodHRwOi8vb3NtLm9yZy9jb3B5cmlnaHRcIj5PU008L2E+IGNvbnRyaWJ1dG9ycydcbn0pLmFkZFRvKG1hcCk7XG5cbnZhciBwb3MxID0gWyAxMTQuMTk1MiwgMjIuNDI2NThdO1xudmFyIG1hcmtlcjEgPSBnbG9iYWwubWFya2VyMSA9IG5ldyBMLkxhYmVsZWRDaXJjbGVNYXJrZXIocG9zMS5zbGljZSgpLnJldmVyc2UoKSwge1xuICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gIFwicHJvcGVydGllc1wiOiB7XG4gICAgXCJ0ZXh0XCI6IFwieW9sb1wiLFxuICAgIFwibGFiZWxQb3NpdGlvblwiOiBbXG4gICAgICAxMTQuMjk4MTk2ODI2MTcxODksXG4gICAgICAyMi40NzczNDc4MjI1MDYzNTZcbiAgICBdXG4gIH0sXG4gIFwiZ2VvbWV0cnlcIjoge1xuICAgIFwidHlwZVwiOiBcIlBvaW50XCIsXG4gICAgXCJjb29yZGluYXRlc1wiOiBwb3MxXG4gIH1cbn0sIHtcbiAgbWFya2VyT3B0aW9uczogeyBjb2xvcjogJyMwNTAnIH0sXG4gIGludGVyYWN0aXZlOiB0cnVlXG59KS5hZGRUbyhtYXApO1xuXG52YXIgcG9zMiA9IFsgMTE0LjE0NjU3NTkyNzczNDM4LCAyMi4zMzkyNzkzMTQ2ODMxMl07XG52YXIgbWFya2VyMiA9IGdsb2JhbC5tYXJrZXIyID0gbmV3IEwuTGFiZWxlZENpcmNsZU1hcmtlcihwb3MyLnNsaWNlKCkucmV2ZXJzZSgpLCB7XG4gIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAgICBcInRleHRcIjogMTIsXG4gICAgXCJsYWJlbFBvc2l0aW9uXCI6IFtcbiAgICAgIDExMy44OTcxOTU4NDk2MDkzOSxcbiAgICAgIDIyLjQxMzg4NTE0MTE4NjkwNlxuICAgIF1cbiAgfSxcbiAgXCJnZW9tZXRyeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAgICBcImNvb3JkaW5hdGVzXCI6IHBvczJcbiAgfVxufSwge1xuICBpbnRlcmFjdGl2ZTogdHJ1ZVxufSkuYWRkVG8obWFwKTtcblxudmFyIHBvczMgPSBbMTE0LjEyODcyMzE0NDUzMTI1LCAyMi4zOTUxNTc5OTAyOTA3NTVdO1xudmFyIG1hcmtlcjMgPSBnbG9iYWwubWFya2VyMyA9IG5ldyBMLkxhYmVsZWRDaXJjbGVNYXJrZXIocG9zMy5zbGljZSgpLnJldmVyc2UoKSwge1xuICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gIFwicHJvcGVydGllc1wiOiB7XG4gICAgXCJ0ZXh0XCI6IDEsXG4gICAgXCJsYWJlbFBvc2l0aW9uXCI6IFtcbiAgICAgIDExNC4zOTI5NTM5MDYyNTAwMSxcbiAgICAgIDIyLjMxNDgyNTQ2MzI2MzU5NVxuICAgIF1cbiAgfSxcbiAgXCJnZW9tZXRyeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAgICBcImNvb3JkaW5hdGVzXCI6IFtcbiAgICAgIDExNC4xMjg3MjMxNDQ1MzEyNSxcbiAgICAgIDIyLjM5NTE1Nzk5MDI5MDc1NVxuICAgIF1cbiAgfVxufSwge1xuICBtYXJrZXJPcHRpb25zOiB7XG4gICAgY29sb3I6ICcjMDA3J1xuICB9XG59KS5hZGRUbyhtYXApO1xuIl19
