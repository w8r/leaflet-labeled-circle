import tape  from 'tape';
import L from 'leaflet';
import Hand from 'prosthetic-hand';

import Marker from '../';

let link = document.createElement('link');
link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.0-rc.3/leaflet.css';
link.rel = 'stylesheet';
document.head.appendChild(link);

const createMap = () => {
  let container = L.DomUtil.create('div', 'map', document.body);
  container.style.width =
  container.style.height = '600px';
  let map = L.map(container).setView([22.42658, 114.1452], 11);
  return map;
};

const createMarker = (map, options = {}) => {
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
  }, options).addTo(map);
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
        labelPosition: [ 114.259345, 22.449007 ],
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
        "coordinates": [ [ 114.1452, 22.42658 ], [ 114.259345, 22.449007 ] ]
      }, 'line string in collection');

      t.deepEqual(gc.geometry.geometries[2], {
        "type": "Point",
        "coordinates": [ 114.259345, 22.449007 ]
      }, 'label point in collection');
      t.end();
    });
    map.removeLayer(marker);
    t.end();
  });


  t.test('Dragging', (t) => {

    t.test('Interaction', (t) => {
      let marker = createMarker(map);
      let center = map.getCenter();

      t.plan(7);
      const h = new Hand({
        onStop: () => {
          let c = map.getCenter();
          t.ok(center.equals(map.getCenter()), 'map center did not change');
        }
      });
      const mouse = h.growFinger('mouse');

      const labelPos = marker.toGeoJSON().properties.labelPosition;
      marker
        .once('label:dragstart', (evt) => t.pass('label drag start emitted'))
        .once('label:drag', (evt) => t.pass('label drag emitted'))
        .once('label:dragend', (evt) => {
          t.pass('label dragend emitted');
          let pos = marker.toGeoJSON().properties.labelPosition;
          t.notDeepEqual(pos, labelPos, 'label position changed');
          t.ok(marker.getLatLng()
            .equals(marker._line.getLatLngs()[1]), 'endpoint 1');
          t.ok(marker._marker.getLatLng()
            .equals(marker._line.getLatLngs()[0]), 'endpoint 2');
        });

      mouse.moveTo(470, 280, 0)
        .wait(3000)
        .down().moveBy(100, 0, 1000).up().wait(500);
    });

    t.test('Non-draggable', (t) => {
      let marker = createMarker(map, { draggable: false });
      let center = map.getCenter();

      t.plan(1);
      const h = new Hand({
        onStop: () => {
          let c = map.getCenter();
          t.notOk(center.equals(map.getCenter()), 'map center did not change');
        }
      });
      const mouse = h.growFinger('mouse');

      const labelPos = marker.toGeoJSON().properties.labelPosition;
      marker
        .once('label:dragstart', (evt) => t.fail('label drag start emitted'))
        .once('label:drag', (evt) => t.fail('label drag emitted'))
        .once('label:dragend', (evt) => t.fail('label dragend emitted'));

      mouse.moveTo(470, 280, 0)
        .wait(500)
        .down().moveBy(100, 0, 1000).up().wait(500);
    });

    t.end();

  });


  t.end();
});

tape('teardown', (t) => {
  map.remove();
  t.end();
});
