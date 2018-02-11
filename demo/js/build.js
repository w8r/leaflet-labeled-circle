(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZW1vL2pzL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0FDQUE7O0FBRUEsSUFBSSxNQUFNLE9BQU8sR0FBUCxHQUFhLElBQUksRUFBRSxHQUFOLENBQVUsS0FBVixFQUFpQixFQUFqQixFQUFxQixPQUFyQixDQUE2QixDQUFDLFFBQUQsRUFBVyxRQUFYLENBQTdCLEVBQW1ELEVBQW5ELENBQXZCOztBQUVBLEVBQUUsU0FBRixDQUFZLHlDQUFaLEVBQXVEO0FBQ3JELGVBQWEsWUFDWDtBQUZtRCxDQUF2RCxFQUdHLEtBSEgsQ0FHUyxHQUhUOztBQUtBLElBQUksT0FBTyxDQUFFLFFBQUYsRUFBWSxRQUFaLENBQVg7QUFDQSxJQUFJLFVBQVUsT0FBTyxPQUFQLEdBQWlCLElBQUksRUFBRSxtQkFBTixDQUEwQixLQUFLLEtBQUwsR0FBYSxPQUFiLEVBQTFCLEVBQWtEO0FBQy9FLFVBQVEsU0FEdUU7QUFFL0UsZ0JBQWM7QUFDWixZQUFRLE1BREk7QUFFWixxQkFBaUIsQ0FDZixrQkFEZSxFQUVmLGtCQUZlO0FBRkwsR0FGaUU7QUFTL0UsY0FBWTtBQUNWLFlBQVEsT0FERTtBQUVWLG1CQUFlO0FBRkw7QUFUbUUsQ0FBbEQsRUFhNUI7QUFDRCxpQkFBZSxFQUFFLE9BQU8sTUFBVCxFQURkO0FBRUQsZUFBYTtBQUZaLENBYjRCLEVBZ0I1QixLQWhCNEIsQ0FnQnRCLEdBaEJzQixDQUEvQjs7QUFrQkEsSUFBSSxPQUFPLENBQUUsa0JBQUYsRUFBc0IsaUJBQXRCLENBQVg7QUFDQSxJQUFJLFVBQVUsT0FBTyxPQUFQLEdBQWlCLElBQUksRUFBRSxtQkFBTixDQUEwQixLQUFLLEtBQUwsR0FBYSxPQUFiLEVBQTFCLEVBQWtEO0FBQy9FLFVBQVEsU0FEdUU7QUFFL0UsZ0JBQWM7QUFDWixZQUFRLEVBREk7QUFFWixxQkFBaUIsQ0FDZixrQkFEZSxFQUVmLGtCQUZlO0FBRkwsR0FGaUU7QUFTL0UsY0FBWTtBQUNWLFlBQVEsT0FERTtBQUVWLG1CQUFlO0FBRkw7QUFUbUUsQ0FBbEQsRUFhNUI7QUFDRCxlQUFhO0FBRFosQ0FiNEIsRUFlNUIsS0FmNEIsQ0FldEIsR0Fmc0IsQ0FBL0I7O0FBaUJBLElBQUksT0FBTyxDQUFDLGtCQUFELEVBQXFCLGtCQUFyQixDQUFYO0FBQ0EsSUFBSSxVQUFVLE9BQU8sT0FBUCxHQUFpQixJQUFJLEVBQUUsbUJBQU4sQ0FBMEIsS0FBSyxLQUFMLEdBQWEsT0FBYixFQUExQixFQUFrRDtBQUMvRSxVQUFRLFNBRHVFO0FBRS9FLGdCQUFjO0FBQ1osWUFBUSxDQURJO0FBRVoscUJBQWlCLENBQ2Ysa0JBRGUsRUFFZixrQkFGZTtBQUZMLEdBRmlFO0FBUy9FLGNBQVk7QUFDVixZQUFRLE9BREU7QUFFVixtQkFBZSxDQUNiLGtCQURhLEVBRWIsa0JBRmE7QUFGTDtBQVRtRSxDQUFsRCxFQWdCNUI7QUFDRCxpQkFBZTtBQUNiLFdBQU87QUFETTtBQURkLENBaEI0QixFQW9CNUIsS0FwQjRCLENBb0J0QixHQXBCc0IsQ0FBL0IiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfXJldHVybiBlfSkoKSIsIi8vcmVxdWlyZSgnLi4vLi4vJyk7XG5cbnZhciBtYXAgPSBnbG9iYWwubWFwID0gbmV3IEwuTWFwKCdtYXAnLCB7fSkuc2V0VmlldyhbMjIuNDI2NTgsIDExNC4xOTUyXSwgMTApO1xuXG5MLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xuICBhdHRyaWJ1dGlvbjogJyZjb3B5OyAnICtcbiAgICAnPGEgaHJlZj1cImh0dHA6Ly9vc20ub3JnL2NvcHlyaWdodFwiPk9TTTwvYT4gY29udHJpYnV0b3JzJ1xufSkuYWRkVG8obWFwKTtcblxudmFyIHBvczEgPSBbIDExNC4xOTUyLCAyMi40MjY1OF07XG52YXIgbWFya2VyMSA9IGdsb2JhbC5tYXJrZXIxID0gbmV3IEwuTGFiZWxlZENpcmNsZU1hcmtlcihwb3MxLnNsaWNlKCkucmV2ZXJzZSgpLCB7XG4gIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAgICBcInRleHRcIjogXCJ5b2xvXCIsXG4gICAgXCJsYWJlbFBvc2l0aW9uXCI6IFtcbiAgICAgIDExNC4yOTgxOTY4MjYxNzE4OSxcbiAgICAgIDIyLjQ3NzM0NzgyMjUwNjM1NlxuICAgIF1cbiAgfSxcbiAgXCJnZW9tZXRyeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiUG9pbnRcIixcbiAgICBcImNvb3JkaW5hdGVzXCI6IHBvczFcbiAgfVxufSwge1xuICBtYXJrZXJPcHRpb25zOiB7IGNvbG9yOiAnIzA1MCcgfSxcbiAgaW50ZXJhY3RpdmU6IHRydWVcbn0pLmFkZFRvKG1hcCk7XG5cbnZhciBwb3MyID0gWyAxMTQuMTQ2NTc1OTI3NzM0MzgsIDIyLjMzOTI3OTMxNDY4MzEyXTtcbnZhciBtYXJrZXIyID0gZ2xvYmFsLm1hcmtlcjIgPSBuZXcgTC5MYWJlbGVkQ2lyY2xlTWFya2VyKHBvczIuc2xpY2UoKS5yZXZlcnNlKCksIHtcbiAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICBcInByb3BlcnRpZXNcIjoge1xuICAgIFwidGV4dFwiOiAxMixcbiAgICBcImxhYmVsUG9zaXRpb25cIjogW1xuICAgICAgMTEzLjg5NzE5NTg0OTYwOTM5LFxuICAgICAgMjIuNDEzODg1MTQxMTg2OTA2XG4gICAgXVxuICB9LFxuICBcImdlb21ldHJ5XCI6IHtcbiAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICAgIFwiY29vcmRpbmF0ZXNcIjogcG9zMlxuICB9XG59LCB7XG4gIGludGVyYWN0aXZlOiB0cnVlXG59KS5hZGRUbyhtYXApO1xuXG52YXIgcG9zMyA9IFsxMTQuMTI4NzIzMTQ0NTMxMjUsIDIyLjM5NTE1Nzk5MDI5MDc1NV07XG52YXIgbWFya2VyMyA9IGdsb2JhbC5tYXJrZXIzID0gbmV3IEwuTGFiZWxlZENpcmNsZU1hcmtlcihwb3MzLnNsaWNlKCkucmV2ZXJzZSgpLCB7XG4gIFwidHlwZVwiOiBcIkZlYXR1cmVcIixcbiAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAgICBcInRleHRcIjogMSxcbiAgICBcImxhYmVsUG9zaXRpb25cIjogW1xuICAgICAgMTE0LjM5Mjk1MzkwNjI1MDAxLFxuICAgICAgMjIuMzE0ODI1NDYzMjYzNTk1XG4gICAgXVxuICB9LFxuICBcImdlb21ldHJ5XCI6IHtcbiAgICBcInR5cGVcIjogXCJQb2ludFwiLFxuICAgIFwiY29vcmRpbmF0ZXNcIjogW1xuICAgICAgMTE0LjEyODcyMzE0NDUzMTI1LFxuICAgICAgMjIuMzk1MTU3OTkwMjkwNzU1XG4gICAgXVxuICB9XG59LCB7XG4gIG1hcmtlck9wdGlvbnM6IHtcbiAgICBjb2xvcjogJyMwMDcnXG4gIH1cbn0pLmFkZFRvKG1hcCk7XG4iXX0=
