# Leaflet SVG circle marker with detachable label and text

![Screenshot](https://cloud.githubusercontent.com/assets/26884/12513284/5c14608c-c11d-11e5-9465-a3dbdb62cac1.png)

## Usage

```shell
$ npm install --save leaflet-labeled-circle
```

```js
var L = require('leaflet');
var LabeledMarker = require('');

var map = L.map('map').setView(center, zoom);

var feature = {
  "type": "Feature",
  "properties": {
    "text": 122,
    "labelPosition": [
      114.29819682617189,
      22.477347822506356
    ]
  },
  "geometry": {
    "type": "Point",
    "coordinates": [ 114.1952, 22.42658]
  }
};

var marker = new LabeledMarker(
  feature.geometry.coordinates.slice().reverse(),
  feature, {
    markerOptions: { color: '#050' }
  }).addTo(map);
```

You can avoid using GeoJSON here if you want, but I see it as a good data format

### API

**Marker options**
```js
options.markerOptions : {
  // all L.CircleMarker options + following:
  textStyle: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Helvetica, Arial, sans-serif'
  },
  shiftY: 6 // to compensate vertical margin, SVG rect is not accurate
}
```

**Anchor marker options**
```js
options.anchorOptions = { /* see L.CircleMarker options */ };
```

**Dragging line options**
```js
options.lineOptions = { /* see L.Polyline options */ };
```

**Get label text**
```js
options.getLabelText = function(marker, feature) {
  // here you can use any field from GeoJSON properties you like
}
```

**Get initial label position**
```js
options.getLabelPosition = function(marker, feature, latlng) {
   // here you can get the initial position from the feature data
   // or fall back to the marker coordinates
}
```

**Serialize**
```js
marker = new LabeledMarker(latlng, feature, {
  labelPositionKey: 'labelPosition'
});
console.log(marker.toGeoJSON());
// {
//   type: 'Feature',
//   properties: {
//     ...
//     labelPosition: [lng, lat]
//   }
// }
```


### License

The MIT License (MIT)

Copyright (c) 2016 Alexander Milevski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

