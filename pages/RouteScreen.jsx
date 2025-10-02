import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

// Set your Mapbox public access token here
MapboxGL.setAccessToken('pk.eyJ1IjoidmlrcmFtNzYiLCJhIjoiY20zd3BydDZhMTM0cTJqcjBmZW96Y2liMiJ9.scf_t3IAqpcmZDxbpXJC2Q');

// Define the coordinates for Imphal, Manipur
const imphalCoordinates = [93.9368, 24.8170]; // [longitude, latitude]

const App = () => {
  return (
    <View style={styles.page}>
      <MapboxGL.MapView style={styles.map}>
        {/* The Camera controls the map's position and zoom level */}
        <MapboxGL.Camera
          zoomLevel={12}
          centerCoordinate={imphalCoordinates}
          animationMode={'flyTo'}
          animationDuration={2000}
        />

        {/* This adds a marker (a point annotation) on the map */}
        <MapboxGL.PointAnnotation
          id="imphalMarker"
          coordinate={imphalCoordinates}
        >
          {/* You can add a custom view inside the marker if you want */}
          <View style={styles.annotationContainer}>
            <View style={styles.annotationFill} />
          </View>
          <MapboxGL.Callout title="Imphal, Manipur" />
        </MapboxGL.PointAnnotation>

      </MapboxGL.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
    // This makes the map take up the entire screen
    ...StyleSheet.absoluteFillObject, 
  },
  // Styles for the custom marker
  annotationContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
  },
  annotationFill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4ecdc4', // A teal color
    transform: [{ scale: 0.8 }],
  },
});

export default App;