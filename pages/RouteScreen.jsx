// RouteScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// Use named imports
const { MapView, Camera, ShapeSource, LineLayer, PointAnnotation } = Mapbox;

// --- IMPORTANT ---
const MAPBOX_TOKEN = 'pk.eyJ1IjoidmlrcmFtNzYiLCJhIjoiY20zd3BydDZhMTM0cTJqcjBmZW96Y2liMiJ9.scf_t3IAqpcmZDxbpXJC2Q';

// Initialize Mapbox with error handling
try {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
} catch (error) {
  console.warn('Mapbox initialization warning:', error);
}

// Cache for coordinates to avoid re-geocoding
const coordinatesCache = new Map();

const RouteScreen = ({ route, navigation }) => {
  const { from, to } = route.params;

  const [routes, setRoutes] = useState({
    driving: null,
    walking: null,
    cycling: null,
  });
  const [selectedProfile, setSelectedProfile] = useState('driving');
  const [isLoading, setIsLoading] = useState(true);
  const [coordinates, setCoordinates] = useState({
    start: null,
    end: null
  });

  // Optimized geocoding with cache
  const geocodeAddress = useCallback(async (address) => {
    // Check cache first
    const cacheKey = address.toLowerCase().trim();
    if (coordinatesCache.has(cacheKey)) {
      return coordinatesCache.get(cacheKey);
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        address
      )}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place,poi`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const json = await res.json();
      
      if (json.features && json.features.length > 0) {
        const coords = json.features[0].center;
        // Cache the result
        coordinatesCache.set(cacheKey, coords);
        return coords;
      }
      return null;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Geocode error:', err);
      }
      return null;
    }
  }, []);

  // Optimized route fetching with parallel requests
  const fetchRoute = useCallback(async (originCoords, destCoords, profile) => {
    const [lon1, lat1] = originCoords;
    const [lon2, lat2] = destCoords;

    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${lon1},${lat1};${lon2},${lat2}?geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=simplified`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const json = await res.json();
      
      if (json.routes && json.routes.length > 0) {
        return {
          geometry: json.routes[0].geometry,
          duration: json.routes[0].duration,
          distance: json.routes[0].distance,
        };
      }
      return null;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(`Error fetching ${profile} route:`, err);
      }
      return null;
    }
  }, []);

  // Optimized main effect
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const getAllRoutes = async () => {
      setIsLoading(true);

      try {
        // 1. Convert addresses to coordinates (parallel)
        const [fromCoords, toCoords] = await Promise.all([
          geocodeAddress(from),
          geocodeAddress(to)
        ]);

        if (!isMounted) return;

        if (!fromCoords || !toCoords) {
          Alert.alert('Error', 'Could not find coordinates for one or both locations.');
          setIsLoading(false);
          return;
        }

        // Store coordinates immediately for instant marker display
        setCoordinates({
          start: fromCoords,
          end: toCoords
        });

        // 2. Fetch routes for all profiles in parallel with timeout
        const routePromises = [
          fetchRoute(fromCoords, toCoords, 'driving-traffic'),
          fetchRoute(fromCoords, toCoords, 'walking'),
          fetchRoute(fromCoords, toCoords, 'cycling'),
        ];

        // Set a timeout for all route requests
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve({ timeout: true }), 15000)
        );

        const results = await Promise.race([
          Promise.all(routePromises),
          timeoutPromise
        ]);

        if (!isMounted) return;

        if (results.timeout) {
          // Partial results - use whatever we have
          const partialResults = await Promise.all(routePromises.map(p => 
            p.catch(() => null)
          ));
          
          setRoutes({
            driving: partialResults[0],
            walking: partialResults[1],
            cycling: partialResults[2],
          });
        } else {
          setRoutes({
            driving: results[0],
            walking: results[1],
            cycling: results[2],
          });
        }

      } catch (error) {
        console.error('Error fetching routes:', error);
        if (isMounted && !abortController.signal.aborted) {
          Alert.alert('Error', 'Failed to fetch routes. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    getAllRoutes();
  
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [from, to, geocodeAddress, fetchRoute]);

  const handleStartNavigation = () => {
    const routeData = routes[selectedProfile];
    
    if (!routeData) {
      Alert.alert('Error', 'Route data not available');
      return;
    }

    // Navigate to NavigationScreen
    navigation.navigate('NavigationScreen', {
      routeData,
      coordinates,
      selectedProfile,
    });
  };

  // Memoized helper functions
  const formatDuration = useCallback((seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return '1 min';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }, []);

  const formatDistance = useCallback((meters) => {
    if (!meters) return 'N/A';
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  }, []);

  // Optimized route rendering
  const renderRoute = useCallback(() => {
    const routeData = routes[selectedProfile];
    if (!routeData) return null;

    return (
      <ShapeSource 
        id={`routeSource-${selectedProfile}`} 
        shape={routeData.geometry}
      >
        <LineLayer 
          id={`routeLine-${selectedProfile}`} 
          style={{ 
            lineColor: selectedProfile === 'driving' ? '#4ecdc4' : 
                      selectedProfile === 'walking' ? '#ff6b6b' : '#48dbfb',
            lineWidth: 5,
            lineOpacity: 0.9
          }} 
        />
      </ShapeSource>
    );
  }, [routes, selectedProfile]);

  // Optimized markers - show immediately when coordinates are available
  const renderMarkers = useCallback(() => {
    if (!coordinates.start || !coordinates.end) return null;

    return (
      <>
        {/* Start Position - Blue Pin */}
        <PointAnnotation
          id="startPoint"
          coordinate={coordinates.start}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={styles.marker}>
            <MaterialIcons name="location-pin" size={32} color="#4a90e2" />
          </View>
        </PointAnnotation>

        {/* End Position - Red Pin */}
        <PointAnnotation
          id="endPoint"
          coordinate={coordinates.end}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={styles.marker}>
            <MaterialIcons name="location-pin" size={32} color="#ff4444" />
          </View>
        </PointAnnotation>
      </>
    );
  }, [coordinates]);

  const renderRouteInfo = useCallback(() => {
    const routeData = routes[selectedProfile];
    
    if (!routeData) {
      return (
        <View style={styles.routeInfoContainer}>
          <Text style={[styles.infoText, styles.infoTextDisabled]}>
            Calculating route...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.routeInfoContainer}>
        <Text style={styles.infoText}>
          🕒 {formatDuration(routeData.duration)}
        </Text>
        <Text style={styles.infoText}>
          📏 {formatDistance(routeData.distance)}
        </Text>
      </View>
    );
  }, [routes, selectedProfile, formatDuration, formatDistance]);

  const getCameraCenter = useCallback(() => {
    if (coordinates.start && coordinates.end) {
      // Calculate midpoint between start and end
      const [lon1, lat1] = coordinates.start;
      const [lon2, lat2] = coordinates.end;
      return [(lon1 + lon2) / 2, (lat1 + lat2) / 2];
    }
    return coordinates.start || [-74.006, 40.7128];
  }, [coordinates]);

  // Show markers immediately while routes load
  const showMarkers = coordinates.start && coordinates.end;

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          zoomLevel={12}
          centerCoordinate={getCameraCenter()}
          animationMode={'flyTo'}
          animationDuration={1000}
        />
        {renderRoute()}
        {showMarkers && renderMarkers()}
      </MapView>

      {/* Show basic info immediately while loading */}
      {showMarkers && (
        <View style={styles.panel}>
          <View style={styles.locationPreview}>
            <Text style={styles.locationText} numberOfLines={1}>
              📍 {from}
            </Text>
            <Text style={styles.locationText} numberOfLines={1}>
              🎯 {to}
            </Text>
          </View>

          <View style={styles.profileSelector}>
            {[
              { key: 'driving', icon: 'directions-car', label: 'Drive' },
              { key: 'walking', icon: 'directions-walk', label: 'Walk' },
              { key: 'cycling', icon: 'directions-bike', label: 'Bike' }
            ].map(({ key, icon, label }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.profileButton,
                  selectedProfile === key && styles.profileButtonSelected,
                  (!routes[key] && isLoading) && styles.profileButtonLoading,
                ]}
                onPress={() => setSelectedProfile(key)}
                disabled={isLoading && !routes[key]}
              >
                <MaterialIcons
                  name={icon}
                  color={
                    selectedProfile === key ? '#fff' : 
                    (isLoading && !routes[key]) ? '#ccc' : '#4ecdc4'
                  }
                  size={22}
                />
                <Text style={[
                  styles.profileLabel,
                  selectedProfile === key && styles.profileLabelSelected
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.infoBox}>
            {renderRouteInfo()}
          </View>

          <TouchableOpacity 
            style={[
              styles.startButton,
              (!routes[selectedProfile] && styles.startButtonDisabled)
            ]}
            disabled={!routes[selectedProfile]}
            onPress={handleStartNavigation}
          >
            <Text style={styles.startButtonText}>
              {routes[selectedProfile] ? 'Start Navigation' : 'Calculating Route...'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4ecdc4" />
          <Text style={styles.loadingText}>Finding best routes...</Text>
        </View>
      )}
    </View>
  );
};

export default RouteScreen;

// --- Styles ---
const styles = StyleSheet.create({
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#f9fafc'
  },
  container: { 
    flex: 1, 
    backgroundColor: '#f9fafc' 
  },
  map: { 
    flex: 1 
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  panel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  locationPreview: {
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  profileSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#4ecdc4',
    backgroundColor: 'white',
  },
  profileButtonSelected: {
    backgroundColor: '#4ecdc4',
    borderColor: '#4ecdc4',
  },
  profileButtonLoading: {
    borderColor: '#e0e0e0',
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ecdc4',
    marginLeft: 6,
  },
  profileLabelSelected: {
    color: 'white',
  },
  infoBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  routeInfoContainer: {
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  infoTextDisabled: {
    color: '#999',
    fontStyle: 'italic',
  },
  startButton: {
    backgroundColor: '#4ecdc4',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 2,
  },
  startButtonDisabled: {
    backgroundColor: '#ccc',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});