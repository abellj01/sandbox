const API_KEY = '3zXkAvqscgURkDBx93akJeowLMnJiBrh';

let wfsServiceUrl = 'https://osdatahubapi.os.uk/OSFeaturesAPI/wfs/v1',
    tileServiceUrl = 'https://osdatahubapi.os.uk/OSMapsAPI/wmts/v1';

// Create a map style object using the OS Maps API WMTS service.
let params = {
    key: API_KEY,
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

let queryString = Object.keys(params).map(function (key) {
    return key + '=' + params[key];
}).join('&');

let style = {
    'version': 8,
    'sources': {
        'raster-tiles': {
            'type': 'raster',
            'tiles': [tileServiceUrl + '?' + queryString],
            'tileSize': 256,
            'maxzoom': 20
        }
    },
    'layers': [{
        'id': 'os-maps-wmts',
        'type': 'raster',
        'source': 'raster-tiles'
    }]
};



function getNewFeatures(loadedFeatureArray, movedFeatureArray) {
    let totalFeaturesIDs = loadedFeatureArray.map(x => x.properties.OBJECTID);
    let newFeaturesArray = movedFeatureArray.filter(feature => !totalFeaturesIDs.includes(feature.properties.OBJECTID));
    return newFeaturesArray;
}
let responsibleAuthorities = [
    {
        "Name": "Birmingham",
        "center": [-1.898575, 52.489471]
    },
    {
        "Name": "Surrey",
        "center": [-0.580217, 51.236944]
    },
    {
        "Name": "Hampshire",
        "center": [-1.309977, 51.062196]
    },  
    {
        "Name": "Essex",
        "center": [0.473472, 51.733467]
    },
    {
        "Name": "Hertfordshire",
        "center": [-0.207689, 51.805412]
    },
    {
        "Name": "Kent",
        "center": [0.522306, 51.271499]
    },
    {
        "Name": "Lancashire",
        "center": [-2.705225, 53.757385]
    },
    {
        "Name": "Sheffield",
        "center": [-1.4765833, 53.381783]
    },

    {
        "Name": "Brent",
        "center": [-0.276161, 51.555659]
    },
    {
        "Name": "Cumbria",
        "center": [-2.761999, 54.653181]
    }
]

function addPolygonToMap(id, features, fillColor) {
    map.addLayer({
        "id": id,
        "type": "fill",
        "source": {
            "type": "geojson",
            "data": {
                "type": "FeatureCollection",
                "features": features
            }
        },
        "layout": {},
        "paint": {
            "fill-color": fillColor,
            "fill-opacity": 0.8
        }
    });
}

function createAreaOptions(responsibleAuthorities) {
    for (let i = 0; i < responsibleAuthorities.length; i++) {
        let newOption = document.createElement("option");
        let newContent = document.createTextNode([i + 1] + '. ' + responsibleAuthorities[i].Name);
        newOption.appendChild(newContent);
        let selectDiv = document.getElementById("area-select");
        selectDiv.appendChild(newOption)
    }
}

function flyToArea(responsibleAuthorities) {
    document.getElementById("area-select").addEventListener('change', async function () {
        for (let i = 0; i < responsibleAuthorities.length; i++) {
            if (document.getElementById("area-select").value.replace([i + 1] + '. ', '') == responsibleAuthorities[i].Name) {
                map.flyTo({
                    center: responsibleAuthorities[i].center,
                    essential: true
                });
            }
        }
    });
}

function updateLayer(features) {
    return {
        "type": "FeatureCollection",
        "features": features
    }
}

function convertLineStringCoords(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i].geometry.coordinates = arr[i].geometry.coordinates[0];
    }
    return arr
}

function addStreetsLayer(features) {
    map.addSource('streets', {
        'type': 'geojson',
        'data': {
            'type': 'FeatureCollection',
            'features': features
        }
    });

    map.addLayer({
        'id': 'streets',
        'type': 'line',
        'source': 'streets',
        'paint': {
            'line-width': 5,
            'line-color': "#FFD700"
        }
    });
}

function addClosestSchool(closestFeature) {
    if (!map.getLayer('closest-school')) {
        addPolygonToMap('closest-school', closestFeature, "#D2691E")
    }
    else {
        let closestData = updateLayer(closestFeature);
        map.getSource('closest-school').setData(closestData)
    }
}

function addRouteToMap(routeData) {
    if (!map.getLayer('route')) {
        map.addSource('route', {
            'type': 'geojson',
            'data': routeData
        });
        map.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#888',
                'line-width': 3

            }
        });
    }
    else {
        map.getSource('route').setData(routeData)
    }
}

function addIconToMap(icon) {
    if (!map.getLayer('icon')) {
        map.addSource('icon', {
            'type': 'geojson',
            'data': icon
        });

        map.addLayer({
            'id': 'icon',
            'source': 'icon',
            'type': 'symbol',
            'layout': {
                'icon-image': 'drone',
                'icon-size': 0.5,
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            }
        });
    }
    else {
        map.getSource('icon').setData(icon);
    }
}

function createRouteData(hospitalCenter, closestSchoolPoint) {
    return {
        'type': 'Feature',
        'properties': {},
        'geometry': {
            'type': 'LineString',
            'coordinates': [
                hospitalCenter,
                closestSchoolPoint
            ]
        }
    }
}

function createIcon(hospitalCenter) {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'Point',
                    'coordinates': hospitalCenter
                }
            }
        ]
    };
}

function drawPath(path, steps, minDistance, routeData) {
    // Draw an path between the `origin` & `destination` of the two points
    for (let i = 0; i < minDistance; i += minDistance / steps) {
        let segment = turf.along(routeData, i, { units: 'miles' });
        path.push(segment.geometry.coordinates);
    }
    return path;
}

function getClosestSchool(schools, hospitalCenter, minDistance, closestSchool, closestFeature, closestSchoolPoint) {
    for (let i = 0; i < schools.length; i++) {
        let schoolCenter = turf.centroid(schools[i]).geometry.coordinates;
        let distance = turf.distance(hospitalCenter, schoolCenter, { units: 'miles' })
        if (distance < minDistance) {
            minDistance = distance;
            closestSchool = schools[i].properties.DistinctiveName1;
            closestFeature = [schools[i]];
            closestSchoolPoint = schoolCenter;
        }
    }
    return [minDistance, closestSchool, closestFeature, closestSchoolPoint]
}

function addInformation(e, closestSchool, minDistance) {
    document.getElementById("hospital-name").innerHTML = "<b>" + e.features[0].properties.DistinctiveName1 + "</b>"
    document.getElementById("closest-school").innerHTML =
        'Nearest School: ' + closestSchool
        + '<br>Distance From Hospital: ' + minDistance.toFixed(2) + " miles";
}

function createPopup(map, popup, id) {
    if (id == "streets") {
        map.on('click', 'streets', function (e) {
            popup
                .setLngLat(e.lngLat)
                .setHTML(e.features[0].properties.ResponsibleAuthority)
                .addTo(map);
        });
    }
    else if (id == "schools") {
        map.on('click', 'schools', function (e) {
            popup
                .setLngLat(e.lngLat)
                .setHTML(e.features[0].properties.DistinctiveName1)
                .addTo(map);
        });
    }
}

//Create laoding message whilst features load.
let modal = document.getElementById("load-modal");

function updateModalDisplay(modal, modalDisplay){
    modal.style.display = modalDisplay;
}


/**
 * Get features from the WFS.
 */
async function getFeatures(bounds, propertyName, literal, typeName) {
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
    xml += '<ogc:PropertyName>' + propertyName + '</ogc:PropertyName>';
    xml += '<ogc:Literal>' + literal + '</ogc:Literal>';
    xml += '</ogc:PropertyIsEqualTo>';
    xml += '</ogc:And>';
    xml += '</ogc:Filter>';

    // Define (WFS) parameters object.
    let startIndex = 0;
    let featureLength = 0;
    let totalFeatures = [];

    do {
        var params = {
            key: API_KEY,
            service: 'WFS',
            request: 'GetFeature',
            version: '2.0.0',
            typeNames: typeName,
            outputFormat: 'GEOJSON',
            srsName: 'urn:ogc:def:crs:EPSG::4326',
            filter: xml,
            startIndex: startIndex.toString(),
            count: 100
        };

        let featureUrl = getUrl(params);
        let response = await fetch(featureUrl);
        let json = await response.json();
        let featureArray = json.features;
        featureLength = featureArray.length;

        totalFeatures.push(featureArray);
        startIndex += featureLength;
    }
    while (featureLength >= 100)
    return [].concat(...totalFeatures);

}

/**
 * Return URL with encoded parameters.
 * @param {object} params - The parameters object to be encoded.
 */
function getUrl(params) {
    var encodedParameters = Object.keys(params)
        .map(paramName => paramName + '=' + encodeURI(params[paramName]))
        .join('&');

    return wfsServiceUrl + '?' + encodedParameters;
}
