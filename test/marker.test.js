import tape  from 'tape';
import L from 'leaflet';

import Marker from '../';

const createMap = () => {
  let container = L.DomUtil.create('div', 'map', document.body);
  let map = L.map(container).setView([22.42658, 114.1452], 11);
  return map;
};

const createMarker = (map) => {
  let center = map.getCenter();
  let labelPos = [
    center.lng + center.lng * 0.001,
    center.lat + center.lat * 0.001
  ];
  let marker = new Marker(center, {
    type: 'Feature',
    geometry: {
      type: 'Point'
    },
    properties: {
      labelPosition: labelPos,
      text: 5
    }
  }).addTo(map);
  return marker;
};

let map;

function triggerEvent (element, type, options = {}) {
  var evt = new MouseEvent(type, {
    'view': window,
    'bubbles': true,
    'cancelable': true,
    'clientX': options.clientX,
    'clientY': options.clientY,
    'which': options.which,
    'ctrlKey': true
  });
  //evt.initEvent(type, false, true);

  // for (let option in options) {
  //   evt[option] = options[option];
  // }

  element.dispatchEvent(evt);
  return evt;
}

tape('setup', (t) => {
  map = createMap();
  t.end();
});

tape('L.LabeledCircleMarker', (t) => {



  t.test('exposed', (t) => {
    t.ok(L.LabeledCircleMarker, 'L.LabeledCircleMarker is exposed');
    t.ok(L.LabeledCircleMarker, 'L.labeledCircleMarker factory is exposed');
    t.end();
  });


  t.test('basic render', (t) => {
    let center = map.getCenter();
    let labelPos = [
      center.lng + center.lng * 0.001,
      center.lat + center.lat * 0.001
    ];
    let marker = new Marker(center, {
      type: 'Feature',
      geometry: {
        type: 'Point'
      },
      properties: {
        labelPosition: labelPos
      }
    }).addTo(map);

    t.ok(marker, 'marker is present');
    t.ok(marker._map, 'marker is on the map');

    t.equals(marker.getLayers().length, 3, 'has all sublayers');

    let labelLatLng = L.latLng(labelPos.slice().reverse());

    t.ok(labelLatLng.equals(marker._marker.getLatLng()),
      'bubble position is correct');
    t.ok(marker._line.getLatLngs()[0].equals(center) &&
       marker._line.getLatLngs()[1].equals(labelLatLng),
       'line conntection is correct');

    // Check DOM
    const els = document.querySelectorAll('svg > g > *');
    t.equals(els.length, 4, 'has all DOM nodes rendered');

    map.removeLayer(marker);

    t.end();
  });


  t.test('remove', (t) => {
    let marker = createMarker(map);

    // Remove layer & check DOM
    map.removeLayer(marker);
    const els = document.querySelectorAll('svg > g > *');
    t.equals(els.length, 0, 'DOM is clean after remove');

    t.end();
  });

  t.test('toGeoJSON', (t) => {
    let marker = createMarker(map);
    t.deepEqual(marker.toGeoJSON(), {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [ 114.1452, 22.42658 ] },
      properties: {
        labelPosition: [ 114.2593452, 22.449006580000002 ],
        text: 5
      }
    }, 'geojson feature');
    var gc = marker.toGeoJSON(true);
    var f = marker.toGeoJSON();

    t.test('Geometry collection', (t) => {
      t.deepEqual(gc.properties, L.Util.extend(f.properties, {
        geometriesTypes: [ 'anchor', 'connection', 'label', 'textbox' ]
      }), 'properties copied');
      t.equal(gc.geometry.type, 'GeometryCollection', 'correct geometry type');
      t.equal(gc.geometry.geometries.length, 4, 'geometries count');
      t.deepEqual(gc.geometry.geometries[0], {
        "type": "Point",
        "coordinates": [
          114.1452,
          22.42658
        ]
      }, 'point in collection');
      t.deepEqual(gc.geometry.geometries[1], {
        "type": "LineString",
        "coordinates": [
          [
            114.1452,
            22.42658
          ],
          [
            114.2593452,
            22.449006580000002
          ]
        ]
      }, 'line string in collection');

      t.deepEqual(gc.geometry.geometries[2], {
        "type": "Point",
        "coordinates": [
          114.2593452,
          22.449006580000002
        ]
      }, 'label point in collection');
      t.end();
    });
    map.removeLayer(marker);
    t.end();
  });


  t.end();
});

tape('teardown', (t) => {
  map.remove();
  t.end();
});
