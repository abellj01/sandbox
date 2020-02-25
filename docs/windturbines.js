var apiKey = '5FXQAScgfjcwQVpvIUHJncvfOjS7hKGf';

var serviceUrl = 'https://osdatahubapi.os.uk/OSMapsAPI/wmts/v1';

// Define (WMTS) parameters object.
var wmtsParams = {
  key: apiKey,
  service: 'WMTS',
  request: 'GetTile',
  version: '2.0.0',
  height: 256,
  width: 256,
  outputFormat: 'image/png',
  style: 'default',
  layer: 'Light_3857',
  tileMatrixSet: 'EPSG:3857',
  tileMatrix: '{z}',
  tileRow: '{y}',
  tileCol: '{x}'
};

// Construct query string parameters from object.
var queryString = Object.keys(wmtsParams).map(function(key) {
  return key + '=' + wmtsParams[key];
}).join('&');

// Create a map style object using the OS Maps API WMTS.
var style = {
  'version': 8,
  'sources': {
    'raster-tiles': {
      'type': 'raster',
      'tiles': [serviceUrl + '?' + queryString],
      'tileSize': 256,
      'maxzoom': 20
    }
  },
  'layers': [{
    'id': 'os-maps-wmts',
    'type': 'raster',
    'source': 'raster-tiles'
  }]
}

// Initialize the map object.
var map = new mapboxgl.Map({
  container: 'map',
  minZoom: 7,
  maxZoom: 20,
  style: style,
  center: [-0.11348, 53.7492],
  zoom: 11
});

map.dragRotate.disable(); // Disable map rotation using right click + drag.
map.touchZoomRotate.disableRotation(); // Disable map rotation using touch rotation gesture.

// Add navigation control (excluding compass button) to the map.
map.addControl(new mapboxgl.NavigationControl({
  showCompass: false
}));

// Add attribution control to the map.
map.addControl(new mapboxgl.AttributionControl({
  customAttribution: '&copy; Crown copyright and database rights ' + new Date().getFullYear() + ' Ordnance Survey.'
}));

// Add event which waits for the map to be loaded.
map.on('load', function() {
  // Add an empty GeoJSON style layer for the Airport features.
  map.addLayer({
    "id": "woodland",
    "type": "fill",
    "source": {
      "type": "geojson",
      "data": {
        "type": "FeatureCollection",
        "features": []
      }
    },
    "layout": {},
    "paint": {
      "fill-color": "#0c0",
      "fill-opacity": 0.8
    }
  });



  // Get the visible map bounds (BBOX).
  var bounds = map.getBounds();

  getFeatures(bounds);

  // Add event which will be triggered when the map has finshed moving (pan + zoom).
  // Implements a simple strategy to only request data when the map viewport invalidates
  // certain bounds.
  map.on('moveend', function() {
    var bounds1 = new mapboxgl.LngLatBounds(bounds.getSouthWest(), bounds.getNorthEast()),
      bounds2 = map.getBounds();

    if (JSON.stringify(bounds) !== JSON.stringify(bounds1.extend(bounds2))) {
      bounds = bounds2;
      getFeatures(bounds);
    }
  });

  

  // Change the cursor to a pointer when the mouse is over the 'airports' layer.
  map.on('mouseenter', 'woodland', function() {
    map.getCanvas().style.cursor = 'pointer';
  });

  // Change the cursor back to a pointer when it leaves the 'airports' layer.
  map.on('mouseleave', 'woodland', function() {
    map.getCanvas().style.cursor = '';
  });

  map.on('click', 'windTurbine', function(e) {
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(e.features[0].properties.DescriptiveTerm)
      .addTo(map);
  });

  // Change the cursor to a pointer when the mouse is over the 'airports' layer.
  map.on('mouseenter', 'windTurbine', function() {
    map.getCanvas().style.cursor = 'pointer';
  });

  // Change the cursor back to a pointer when it leaves the 'airports' layer.
  map.on('mouseleave', 'windTurbine', function() {
    map.getCanvas().style.cursor = '';
  });




});

/**
 * Get features from the WFS.
 */
function getFeatures(bounds) {
  // Convert the bounds to a formatted string.
  var sw = bounds.getSouthWest().lng + ',' + bounds.getSouthWest().lat,
    ne = bounds.getNorthEast().lng + ',' + bounds.getNorthEast().lat;

  var coords = sw + ' ' + ne;

  // Create an OGC XML filter parameter value which will select the Airport
  // features (site function) intersecting the BBOX coordinates.
  var xml = '<ogc:Filter>';
  xml += '<ogc:And>';
  xml += '<ogc:BBOX>';
  xml += '<ogc:PropertyName>SHAPE</ogc:PropertyName>';
  xml += '<gml:Box srsName="urn:ogc:def:crs:EPSG::4326">';
  xml += '<gml:coordinates>' + coords + '</gml:coordinates>';
  xml += '</gml:Box>';
  xml += '</ogc:BBOX>';
  xml += '<ogc:PropertyIsEqualTo>';
  xml += '<ogc:PropertyName>DescriptiveTerm</ogc:PropertyName>';
  xml += '<ogc:Literal>Wind Turbine</ogc:Literal>';
  xml += '</ogc:PropertyIsEqualTo>';
  xml += '</ogc:And>';
  xml += '</ogc:Filter>';

  let regex = /IsEqualTo/g

  let woodXml = xml.replace(regex, 'IsGreaterThanOrEqualTo').replace("DescriptiveTerm", "SHAPE_Area").replace("Wind Turbine", "200000")
  
  // Define (WFS) parameters object.
  var wfsParams = {
    key: apiKey,
    service: 'WFS',
    request: 'GetFeature',
    version: '2.0.0',
    typeNames: 'Topography_TopographicArea',
    outputFormat: 'GEOJSON',
    srsName: 'urn:ogc:def:crs:EPSG::4326',
    filter: xml
  };


  let woodlandParams = {
    key: apiKey,
    service: 'WFS',
    request: 'GetFeature',
    version: '2.0.0',
    typeNames: 'Zoomstack_Woodland',
    outputFormat: 'GEOJSON',
    srsName: 'urn:ogc:def:crs:EPSG::4326',
    filter: woodXml 
  };
  // Use fetch() method to request GeoJSON data from the OS Features API.
  // If successful - set the GeoJSON data for the 'airports' layer and re-render
  // the map.
  fetch(getUrl(wfsParams))
    .then(response => response.json())
    .then((data) => {
      // {Turf.js} Rewind polygons to follow the right-hand rule, i.e. exterior
      // rings are counterclockwise and inner rings [holes] are clockwise; plus
      // ensure the geometry has no self-intersections.
      var result = turf.unkinkPolygon(turf.rewind(data));
      console.log(data.features)
      data.features.forEach(function(feature) {
        new mapboxgl.Marker()
            .setLngLat(feature.geometry.coordinates[0][0])
            .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML('<p>' + feature.properties.DescriptiveTerm + '<p>'))
            .addTo(map)
      })
    });

    fetch(getUrl(woodlandParams))
    .then(response => response.json())
    .then((data) => {
      // {Turf.js} Rewind polygons to follow the right-hand rule, i.e. exterior
      // rings are counterclockwise and inner rings [holes] are clockwise; plus
      // ensure the geometry has no self-intersections.
      var result = turf.unkinkPolygon(turf.rewind(data));
      map.getSource('woodland').setData(result);
      
      // data.features.forEach(function(feature){ 
      //   new mapboxgl.Marker({color: "#F00"}).setLngLat(turf.center(turf.polygon(feature.geometry.coordinates)).geometry.coordinates).addTo(map)
      // })
      let woodFeatures = data.features
      for (let i=0; i<woodFeatures.length; i++){
        let woodFeature = woodFeatures[i].geometry.coordinates
        let woodlandPopupId = woodFeatures[i].properties.OBJECTID
        let woodlandPopup = new mapboxgl.Popup({ offset: 25 }).setText(
          "ID: " + woodlandPopupId
          );
        new mapboxgl.Marker({color: "#F00"})
        .setLngLat(turf.centroid(turf.polygon(woodFeature)).geometry.coordinates)
        .setPopup(woodlandPopup)
        .addTo(map)
      }
      
    });


    
}

/**
 * Return URL with encoded parameters.
 * @param {object} params - The parameters object to be encoded.
 */
function getUrl(params) {
  var encodedParameters = Object.keys(params)
    .map(paramName => paramName + '=' + encodeURI(params[paramName]))
    .join('&');

  return 'https://osdatahubapi.os.uk/OSFeaturesAPI/wfs/v1?' + encodedParameters;
}
