export { fetchData, createMarkers, formatCursor, addMapFeatures }

//fetches json data from json files
async function fetchData(data) {
    let fetchedData = await fetch(data);
    let json = await fetchedData.json();
    let features = json.features;
    return features
}

//Creates Partner Hub Markers, loading them on the map
function createMarkers(fetchedData, map, imageName, id, file) {
    map.loadImage(
        file,
        function (error, image) {
            if (error) throw error;
            if (!map.getImage) {
                map.addImage(imageName, image);
            }
            if (!map.getLayer(id)) {
                map.addLayer({
                    'id': id,
                    'type': 'symbol',
                    'source': {
                        'type': 'geojson',
                        'data': {
                            'type': 'FeatureCollection',
                            'features': fetchedData
                        }
                    },
                    'layout': {
                        'icon-image': imageName,
                        'icon-size': 1,
                        'icon-allow-overlap': true
                    }
                });
            }
        }
    );
}

//function that formats the cursor when hovering over a marker
function formatCursor(cursor, map) {
    event.preventDefault();
    map.getCanvas().style.cursor = cursor;
    event.stopPropagation();
}

function countiesCursor(map, event, id, cursor) {
    map.on(event, id, function () {
        formatCursor(cursor, map)
    });
};

// adds popup when mouse hovers over marker
function addPopup(map, marker, popup) {
    map.on('click', marker, function (e) {
        e.preventDefault();
        formatCursor('pointer', map);
        popup
            .setLngLat(e.features[0].geometry.coordinates)
            .setHTML(e.features[0].properties["Company Name"])
            .addTo(map);
        e.stopPropagation(); ``
    });
}

//toggle the checkbox to show/hide markers
function toggleInput(id, map) {
    document.getElementById(id).addEventListener('change', function (e) {
        map.setLayoutProperty(
            id,
            'visibility',
            e.target.checked ? 'visible' : 'none'
        );
    });
};

function countUniqueCounties(data) {
    let object = {}

    for (let i = 0; i < data.length; i++) {
        if (object[data[i]["County"]] > 0) {
            object[data[i]["County"]]++
        }
        else {
            object[data[i]["County"]] = 1
        }
    }
    return object;
}

//LARGE_VALUE is anything greater than the MEDIUM_VALUE
const RECIPIENT_COLORS = {
    "SMALL_VALUE": 1,
    "SMALL_COLOR": "#b2d6b2",
    "MEDIUM_VALUE": 3,
    "MEDIUM_COLOR": "#64ae64",
    "LARGE_COLOR": "#228b22"
}

const MEMBER_COLORS = {
    "SMALL_VALUE": 3,
    "SMALL_COLOR": "#d0a6a6",
    "MEDIUM_VALUE": 10,
    "MEDIUM_COLOR": "#ad6464",
    "LARGE_COLOR": "#8b2222"
}

const COMMUNITY_COLORS = {
    "SMALL_VALUE": 3,
    "SMALL_COLOR": "#a6a6d0",
    "MEDIUM_VALUE": 10,
    "MEDIUM_COLOR": "#6464ad",
    "LARGE_COLOR": "#22228b"
}

/**
 * 
 * @param {*Object[]} countyPolygons 
 * @param {*Object} dataCount 
 * @param {*Object} dataColors 
 */
function calculateCountyColors(countyPolygons, dataCount, dataColors) {
    let allCounties = _.map(_.uniqBy(countyPolygons, 'properties.NAME'));
    let countyColors = [];
    let color = "#FFF";

    for (let county in allCounties) {
        let countyName = allCounties[county].properties["NAME"];
        let dataInCounty = dataCount[countyName];
        if (!dataInCounty) {
            color = "#FFF";
        }
        else if (dataInCounty > 0 && dataInCounty <= dataColors["SMALL_VALUE"]) {
            color = dataColors["SMALL_COLOR"];
        }
        else if (dataInCounty > dataColors["SMALL_VALUE"] && dataInCounty <= dataColors["MEDIUM_VALUE"]) {
            color = dataColors["MEDIUM_COLOR"];
        }
        else {
            color = dataColors["LARGE_COLOR"];
        }
        countyColors.push(countyName, color);
    }
    //default value
    countyColors.push("#000");
    return countyColors;
}


function addCountiesOutline(map, id, countyPolygons, lineWidth) {
    map.addLayer({
        'id': id,
        'type': 'line',
        'source': {
            'type': 'geojson',
            'data': {
                "type": "FeatureCollection",
                "features": countyPolygons
            }
        },
        'paint': {
            'line-color': '#000',
            'line-width': lineWidth
        }
    });
}

function addChoroplethLayer(map, id, expression, countyPolygons) {
    map.addLayer({
        "id": id,
        "type": "fill",
        "source": {
            "type": "geojson",
            "data": {
                "type": "FeatureCollection",
                "features": countyPolygons
            }
        },
        "layout": {},
        "paint": {
            "fill-color": expression,
            "fill-opacity": 0.8
        }
    });
}

//thickens outline when county is clicked
function selectCounty(e, map) {
    let currentCounty = e.features

    if (!map.getLayer('current-county')) {
        addCountiesOutline(map, 'current-county', currentCounty, 7);
    }
    else {
        let currentCountyData = {
            "type": "FeatureCollection",
            "features": currentCounty
        }
        map.getSource('current-county').setData(currentCountyData)
    }
}

//returns information about the county, and number of startups supported at the bottom of the information box
function addInformation(map, dataCount, layerId, data) {
    map.on('click', layerId, function (e) {
        let dataTotal = dataCount[e.features[0].properties["NAME"]]
        //make recipientsTotal return a value, else it will return 'undefined'
        if (!dataTotal) {
            dataTotal = 0;
        }
        document.getElementById('onclick-information').innerHTML = "<div>County: " + e.features[0].properties["NAME"]
            + "</div><div>" + data + ": " + dataTotal + "</div>";

        selectCounty(e, map)
    });
}

function toggleLegend(currentLegend, inactiveLegend1, inactiveLegend2) {
    document.getElementById(currentLegend).style.display = 'block';
    document.getElementById(inactiveLegend1).style.display = 'none';
    document.getElementById(inactiveLegend2).style.display = 'none';
}

function toggleLayers(map, currentLayer, currentLegend, inactiveLayer1, inactiveLegend1, inactiveLayer2, inactiveLegend2) {
    document.getElementById(currentLayer).addEventListener('click', function () {
        map.setLayoutProperty(currentLayer, 'visibility', 'visible');
        map.setLayoutProperty(inactiveLayer1, 'visibility', 'none');
        map.setLayoutProperty(inactiveLayer2, 'visibility', 'none');
        map.setLayoutProperty('counties-outline', 'visibility', 'visible');

        toggleLegend(currentLegend, inactiveLegend1, inactiveLegend2);
    });
}

function toggleOptions(options, show, hide){
    document.getElementById('toggle').addEventListener('click', function () {
        let list = document.getElementById(options)
        let showButton = document.getElementById(show)
        let hideButton = document.getElementById(hide)

        if(list.style.display === 'block'){
            list.style.display = 'none'
            showButton.style.display = 'block'
            hideButton.style.display = 'none'
        } 
        else {
            list.style.display = "block";
            showButton.style.display = 'none'
            hideButton.style.display = 'block'
        }
    });
}


function addMapFeatures(map, popup) {
    map.dragRotate.disable(); // Disable map rotation using right click + drag.
    map.touchZoomRotate.disableRotation(); // Disable map rotation using touch rotation gesture.

    // Add navigation control (excluding compass button) to the map.
    map.addControl(new mapboxgl.NavigationControl({
        showCompass: false
    }));



    map.on('load', async function () {
        let partnerHubs = await fetchData('partner_hubs.json');
        let sponsors = await fetchData('sponsors.json');
        let stakeholders = await fetchData('stakeholders.json');
        //Fetches the polygons of all the UK counties. 
        let countyPolygons = await fetchData('counties.json');
        let startupsSupported = await fetchData('startups_supported.json');

        // expression gives the colours for the map based on its value
        let expression = ['match', ['get', 'NAME']];
        let startupsSupportedCount = countUniqueCounties(startupsSupported);
        let startupsSupportedCountyColors = (calculateCountyColors(countyPolygons, startupsSupportedCount, RECIPIENT_COLORS));
        const STARTUPS_SUPPORTED_EXPRESSION = expression.concat(startupsSupportedCountyColors);
        addChoroplethLayer(map, 'startups-supported', STARTUPS_SUPPORTED_EXPRESSION, countyPolygons);

        let hubMembers = await fetchData('hub_members.json');
        let hubMembersCount = countUniqueCounties(hubMembers);
        let hubMembersCountyColors = (calculateCountyColors(countyPolygons, hubMembersCount, MEMBER_COLORS));
        const MEMBER_EXPRESSION = expression.concat(hubMembersCountyColors);
        addChoroplethLayer(map, 'hub-members', MEMBER_EXPRESSION, countyPolygons);
        map.setLayoutProperty('hub-members', 'visibility', 'none');

        let networkConnections = await fetchData('network_connections.json');
        let networkConnectionsCount = countUniqueCounties(networkConnections);
        let networkCountyColors = (calculateCountyColors(countyPolygons, networkConnectionsCount, COMMUNITY_COLORS));
        const NETWORK_EXPRESSION = expression.concat(networkCountyColors);
        addChoroplethLayer(map, 'network-connections', NETWORK_EXPRESSION, countyPolygons);
        map.setLayoutProperty('network-connections', 'visibility', 'none');

        addCountiesOutline(map, 'counties-outline', countyPolygons, 1);
        addInformation(map, startupsSupportedCount, 'startups-supported', 'Startups Supported');
        addInformation(map, hubMembersCount, 'hub-members', 'Hub Members');
        addInformation(map, networkConnectionsCount, 'network-connections', 'Network Connections');

        createMarkers(partnerHubs, map, 'partner-hub-markers', 'partner-hub-markers', 'partner_hubs_marker.png')
        createMarkers(sponsors, map, 'sponsor-markers', 'sponsor-markers', 'sponsors_marker.png')
        createMarkers(stakeholders, map, 'stakeholder-markers', 'stakeholder-markers', 'stakeholders_marker.png')

        toggleInput('partner-hub-markers', map);
        toggleInput('sponsor-markers', map)
        toggleInput('stakeholder-markers', map);

        countiesCursor(map, 'mouseenter', 'startups-supported', 'pointer');
        countiesCursor(map, 'mouseleave', 'startups-supported', '');
        
        toggleOptions('options', 'show', 'hide')
        
    });

    toggleLayers(map, 'startups-supported', 'startups-supported-legend', 'hub-members',
        'hub-members-legend', 'network-connections', 'network-connections-legend');
    toggleLayers(map, 'hub-members', 'hub-members-legend', 'startups-supported', 'startups-supported-legend',
        'network-connections', 'network-connections-legend');
    toggleLayers(map, 'network-connections', 'network-connections-legend',
        'hub-members', 'hub-members-legend', 'startups-supported', 'startups-supported-legend');

    countiesCursor(map, 'mouseenter', 'hub-members', 'pointer');
    countiesCursor(map, 'mouseleave', 'hub-members', '');
    countiesCursor(map, 'mouseenter', 'network-connections', 'pointer');
    countiesCursor(map, 'mouseleave', 'network-connections', '');

    addPopup(map, 'partner-hub-markers', popup)
    addPopup(map, 'sponsor-markers', popup)
    addPopup(map, 'stakeholder-markers', popup)
}
