    const API_KEY = 'bQCDYqF6VUg0uqFeakUA2bXZ3Mtrmwbk';

    let serviceUrl = 'https://api.os.uk/maps/raster/v1/zxy';

    async function fetchStation(stationNumber) {
        let stationParams = {
            key: API_KEY,
            service: 'WFS',
            request: 'GetFeature',
            version: '2.0.0',
            typeNames: 'Zoomstack_RailwayStations',
            outputFormat: 'GEOJSON',
            srsName: 'urn:ogc:def:crs:EPSG::4326',
            count: 1,
            startIndex: stationNumber.toString()
        };

        let url = getUrl(stationParams);
        let response = await fetch(url);
        let json = await response.json();
        let station = json.features[0];
        
        return station;
    }

    function randomStations(){
        let randomNums = [];
        while(randomNums.length < 20){
            let num = Math.floor(Math.random() * 3451);
            if (randomNums.indexOf(num) === -1){
                randomNums.push(num)
            }
        }
        return randomNums;
    }


    async function generatesStations() {
        let numbers = randomStations();
        let stationList = [];
        for(let i=0; i<numbers.length; i++){
            const STATION = await fetchStation(numbers[i]);
            stationList.push(STATION);
    }

        return stationList;
    } 


    document.body.onload = addElement;

    async function addElement() {
        const STATION_LIST = await generatesStations();
        populatesDropDown(STATION_LIST);
        addDropdownListener(STATION_LIST);
        flyto(STATION_LIST[0].geometry.coordinates);
    }

    function flyto(coords) {
        map.flyTo({
                    center: coords,
                    zoom: 14,
                    essential: true
                    })
    
        drawAll(coords)
    }

    function addDropdownListener(stationList) {
        //Click on an option in the nav bar, and the map will fly to the location of that station.
        document.getElementById("station-select").addEventListener('change',  function () {
            let coords;
            for (let i = 0; i < stationList.length; i++) {
                if (document.getElementById("station-select").value == stationList[i].properties.Name) {
                    coords = stationList[i].geometry.coordinates;
                    flyto(coords);
                    break;
                }
            }

        });
    }

    function populatesDropDown(stationList) {
        for (let i = 0; i < stationList.length; i++) {
            let newOption = document.createElement("option");
            let newContent = document.createTextNode(stationList[i].properties.Name);
            newOption.appendChild(newContent);
            let selectDiv = document.getElementById("station-select");
            selectDiv.appendChild(newOption);
        }
    }

    let style = {
        'version': 8,
        'sources': {
            'raster-tiles': {
                'type': 'raster',
                'tiles': [`${serviceUrl}/Road_3857/{z}/{x}/{y}.png?key=${API_KEY}`],
                'tileSize': 256,
                'maxzoom': 20
            }
        },
        'layers': [{
            'id': 'os-maps-zxy',
            'type': 'raster',
            'source': 'raster-tiles'
        }]
    };

    // Initialize the map object.
    let map = new mapboxgl.Map({
        container: 'map',
        maxZoom: 17,
        style: style,
        center: [-0.104951, 51.520623],
        zoom: 14
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

    // Add geolocation control to the map.
    map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true
    }), 'bottom-right');

    // Create an empty GeoJSON FeatureCollection.
    let geojson = {
        "type": "FeatureCollection",
        "features": []
    };

    // Add event which waits for the map to be loaded.
    map.on('load', function () {
        // Add an empty GeoJSON style layer for the 1km circle polygon (buffered
        // centroid) features.
        map.addLayer({
            "id": "circle",
            "type": "fill",
            "source": {
                "type": "geojson",
                "data": geojson
            },
            "layout": {},
            "paint": {
                "fill-color": "#f80",
                "fill-opacity": 0.5
            }
        });

        // Add an empty GeoJSON style layer for the localBuildings features.
        map.addLayer({
            "id": "localBuildings",
            "type": "fill",
            "source": {
                "type": "geojson",
                "data": geojson
            },
            "layout": {},

        });
    });

    function drawAll(center) {

        const CIRCLE_RADIUS = 0.5
        // {Turf.js} Takes the centre point coordinates and calculates a circular polygon
        // of the given a radius in kilometers; and steps for precision.
        let circle = turf.circle(center, CIRCLE_RADIUS, {
            steps: 24,
            units: 'kilometers'
        });
        
        // Set the GeoJSON data for the 'circle' layer and re-render the map.
        map.getSource('circle').setData(circle);


        //flip circle coordinates from [x, y] to [y, x]
        let flippedCircle = turf.flip(circle)
        // Get the flipped geometry coordinates and return a new space-delimited string.
        let coords = flippedCircle.geometry.coordinates[0].join(' ');
    

        // Create an OGC XML filter parameter value which will select the localBuildings
        // features intersecting the circle polygon coordinates.
        let xml = '<ogc:Filter>';
        xml += '<ogc:Intersects>';
        xml += '<ogc:PropertyName>SHAPE</ogc:PropertyName>';
        xml += '<gml:Polygon srsName="urn:ogc:def:crs:EPSG::4326">';
        xml += '<gml:outerBoundaryIs>';
        xml += '<gml:LinearRing>';
        xml += '<gml:coordinates>' + coords + '</gml:coordinates>';
        xml += '</gml:LinearRing>';
        xml += '</gml:outerBoundaryIs>';
        xml += '</gml:Polygon>';
        xml += '</ogc:Intersects>';
        xml += '</ogc:Filter>';

        // Define parameters object.
        let wfsParams = {
            key: API_KEY,
            service: 'WFS',
            request: 'GetFeature',
            version: '2.0.0',
            typeNames: 'Zoomstack_LocalBuildings',
            outputFormat: 'GEOJSON',
            srsName: 'urn:ogc:def:crs:EPSG::4326',
            filter: xml,
            count: 100,
            startIndex: 0
        };

        let resultsRemain = true;

        geojson.features.length = 0;

        map.getSource('localBuildings').setData(geojson);
        document.getElementById('feature-count').innerHTML = '';
        document.getElementById('area').innerHTML = '';
        // Use fetch() method to request GeoJSON data from the OS Features API.
        //
        // If successful - set the GeoJSON data for the 'localBuildings' layer and re-render
        // the map.
        //
        // Calls will be made until the number of features returned is less than the
        // requested count, at which point it can be assumed that all features for
        // the query have been returned, and there is no need to request further pages.
        function fetchWhile(resultsRemain) {
            if (resultsRemain) {
                fetch(getUrl(wfsParams))
                    .then(response => response.json())
                    .then((data) => {
                        wfsParams.startIndex += wfsParams.count;

                        geojson.features.push.apply(geojson.features, data.features);

                        resultsRemain = data.features.length < wfsParams.count ? false : true;

                        fetchWhile(resultsRemain);
                    });
            } else {
                map.getSource('localBuildings').setData(geojson);
                document.getElementById('feature-count').innerHTML = geojson.features.length;

                // To calculate the area, rounded to 3 decimal places
                let area = 0;
                let ratio = 0;
                const CIRCLE_AREA = Math.PI * CIRCLE_RADIUS ** 2;
                let feature = geojson.features;
                for (let i = 0; i < feature.length; i++) {
                    // Area in kilometers square
                    area += (geojson.features[i].properties.SHAPE_Area) / 1000000
                }
                ratio = area / CIRCLE_AREA
                //format the area
                if (area < 0.01) {
                    document.getElementById('area').innerHTML = "< 0.01"
                }
                else document.getElementById('area').innerHTML = area.toFixed(2);

                // format the ratio
                if (ratio < 0.01) {
                    document.getElementById('ratio').innerHTML = "< 0.01"
                }
                else document.getElementById('ratio').innerHTML = ratio.toFixed(2);

                // change color based on ratios
                if (ratio >= 0.45) {
                    map.setPaintProperty("localBuildings", "fill-color", "#F00")
                }
                else if (ratio < 0.45 && ratio > 0.3) {
                    map.setPaintProperty("localBuildings", "fill-color", "#FFA500")
                }
                else if (ratio < 0.29 && ratio > 0.15) {
                    map.setPaintProperty("localBuildings", "fill-color", "#FFFF00")
                }

                else {
                    map.setPaintProperty("localBuildings", "fill-color", "#0c0")
                }
            }
        }

        fetchWhile(resultsRemain);
    }

    /**
    * Return URL with encoded parameters.
    */
    function getUrl(params) {
        let encodedParameters = Object.keys(params)
            .map(paramName => paramName + '=' + encodeURI(params[paramName]))
            .join('&');

        return 'https://api.os.uk/features/v1/wfs?' + encodedParameters;
    }

