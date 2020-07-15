// Initialize the map object.
let map = new mapboxgl.Map({
    container: 'map',
    minZoom: 9,
    maxZoom: 15,
    style: style,
    center: [-1.898575, 52.489471],
    zoom: 13
});

function createMap(map) {
    map.dragRotate.disable(); // Disable map rotation using right click + drag.
    map.touchZoomRotate.disableRotation(); // Disable map rotation using touch rotation gesture.

    // Add navigation control (excluding compass button) to the map.
    map.addControl(new mapboxgl.NavigationControl({
        showCompass: false
    }));

    map.loadImage('drone.png', function (error, image) {
        if (error) throw error;
        if (!map.hasImage('drone')) map.addImage('drone', image);
    });

    //Change cursor when mouse enters or leaves layer
    function formatCursor(map, event, id) {
        if (event == "mouseenter") {
            map.on(event, id, function () {
                map.getCanvas().style.cursor = 'pointer';
            });
        }
        else if (event == 'mouseleave') {
            map.on(event, id, function () {
                map.getCanvas().style.cursor = '';
            });
        }
    }

    formatCursor(map, 'mouseenter', 'streets');
    formatCursor(map, 'mouseleave', 'streets');

    formatCursor(map, 'mouseenter', 'hospitals');
    formatCursor(map, 'mouseleave', 'hospitals');

    formatCursor(map, 'mouseenter', 'schools');
    formatCursor(map, 'mouseleave', 'schools');
}

// Add event whicxh waits for the map to be loaded.
map.on('load', async function () {
    // Get the visible map bounds (BBOX).
    var bounds = map.getBounds();

    createAreaOptions(responsibleAuthorities);
    flyToArea(responsibleAuthorities);

    let uniqueStreets = await getFeatures(bounds, 'ResponsibleAuthority', 'Birmingham', 'Highways_Street');
    convertLineStringCoords(uniqueStreets);
    addStreetsLayer(uniqueStreets);

    let uniqueHospitals = await getFeatures(bounds, 'SiteFunction', 'Hospital', 'Sites_FunctionalSite');
    addPolygonToMap("hospitals", uniqueHospitals, "#FF1493")

    let uniqueSchools = await getFeatures(bounds, 'SiteFunction', 'Secondary Education', 'Sites_FunctionalSite');
    addPolygonToMap("schools", uniqueSchools, "#20B2AA")

    updateModalDisplay(modal, 'none');
    // Add event which will be triggered when the map has finshed moving (pan + zoom).
    // Implements a simple strategy to only request data when the map viewport invalidates
    // certain bounds.
    map.on('moveend', async function () {
        updateModalDisplay(modal, 'block');
        bounds2 = map.getBounds();
        bounds = bounds2;

        let mapMovedStreets = await getFeatures(bounds2, 'ResponsibleAuthority', 'Birmingham', 'Highways_Street');
        convertLineStringCoords(mapMovedStreets);
        uniqueStreets = uniqueStreets.concat(getNewFeatures(uniqueStreets, mapMovedStreets));

        //adds street features when the map flies to new area
        //removes the numbering to get the value of the area
        let areaString = document.getElementById("area-select").value.split('')
        let areaValue = areaString.slice(areaString.indexOf(" ") + 1, areaString.length).join('')
        let newAreaStreets = await getFeatures(bounds2, 'ResponsibleAuthority', areaValue, 'Highways_Street');
        convertLineStringCoords(newAreaStreets);
        uniqueStreets = uniqueStreets.concat(getNewFeatures(uniqueStreets, newAreaStreets))

        let totalStreets = updateLayer(uniqueStreets);
        map.getSource('streets').setData(totalStreets);

        let mapMovedHospitals = await getFeatures(bounds2, 'SiteFunction', 'Hospital', 'Sites_FunctionalSite');
        uniqueHospitals = uniqueHospitals.concat(getNewFeatures(uniqueHospitals, mapMovedHospitals));

        let totalHospitals = updateLayer(uniqueHospitals);
        map.getSource('hospitals').setData(totalHospitals);

        let mapMovedSchools = await getFeatures(bounds2, 'SiteFunction', 'Secondary Education', 'Sites_FunctionalSite');
        uniqueSchools = uniqueSchools.concat(getNewFeatures(uniqueSchools, mapMovedSchools));

        let totalSchools = updateLayer(uniqueSchools);
        map.getSource('schools').setData(totalSchools);
        updateModalDisplay(modal, 'none');
    });

    //Get the source data from school features to use when calculating the nearest school to a hospital
    let schoolSource = map.getSource('schools')

    // When a click event occurs on a feature in the layer, open a popup at
    // the location of the click, with description HTML from its properties.
    let popup = new mapboxgl.Popup({ className: 'popup', offset: 5 });
    createPopup(map, popup, 'schools');
    createPopup(map, popup, 'streets')

    // When a click event occurs on a feature in the 'hospitalss' layer, open a popup at
    // the location of the click, with description HTML from its properties.
    map.on('click', 'hospitals', function (e) {
        let schools = schoolSource._data.features;
        let hospitalCenter = turf.centroid(e.features[0]).geometry.coordinates;

        //Distance from most southwestern and most northeastern points of England is approx. 425 miles.
        //As hospitals as secondary schools do exist in England, this number will be a good starting point,
        //as the minimum distance between a hospital and school will be less than this.
        //Distance is measures in miles
        let results = getClosestSchool(schools, hospitalCenter, 425, '', '', '');
        minDistance = results[0];
        closestSchool = results[1];
        closestFeature = results[2];
        closestSchoolPoint = results[3];

        addInformation(e, closestSchool, minDistance);
        //Closest school changes colour onclick
        addClosestSchool(closestFeature);
        //Adds the route
        let routeData = createRouteData(hospitalCenter, closestSchoolPoint);
        addRouteToMap(routeData);

        let icon = createIcon(hospitalCenter)
        addIconToMap(icon);

        let path = [];
        // Number of steps to use in the path and animation, more steps means
        // a smoother path and animation, but too many steps will result in a
        // low frame rate
        let steps = 250;
        path = drawPath(path, steps, minDistance, routeData)

        // Update the route with calculated path coordinates
        routeData.geometry.coordinates = path;

        // Used to increment the value of the point measurement against the route.
        let counter = 0;

        function animate() {
            icon.features[0].geometry.coordinates =
                routeData.geometry.coordinates[counter];

            // Update the source with this new data.
            map.getSource('icon').setData(icon);

            // Request the next frame of animation so long the end has not been reached.
            if (counter < steps) {
                requestAnimationFrame(animate);
            }
            counter++;
        }
        animate();
    });
});
 

createMap(map);