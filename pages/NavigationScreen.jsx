// NavigationScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// Use named imports properly
const { 
  MapView, 
  Camera, 
  ShapeSource, 
  LineLayer, 
  SymbolLayer,
  LocationManager
} = Mapbox;

const MAPBOX_TOKEN = 'pk.eyJ1IjoidmlrcmFtNzYiLCJhIjoiY20zd3BydDZhMTM0cTJqcjBmZW96Y2liMiJ9.scf_t3IAqpcmZDxbpXJC2Q';

// Initialize Mapbox
try {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
} catch (error) {
  console.warn('Mapbox initialization warning:', error);
}

const { width, height } = Dimensions.get('window');

const NavigationScreen = ({ route, navigation }) => {
  const { routeData, coordinates, selectedProfile } = route.params;
  
  const [currentLocation, setCurrentLocation] = useState(coordinates.start);
  const [distanceRemaining, setDistanceRemaining] = useState(routeData.distance);
  const [timeRemaining, setTimeRemaining] = useState(routeData.duration);
  const [isNavigating, setIsNavigating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [locationPermission, setLocationPermission] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  
  const cameraRef = useRef();
  const locationSubscription = useRef(null);

  // Request location permissions
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location for navigation.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        setLocationPermission(hasPermission);
        return hasPermission;
      } catch (err) {
        console.warn('Location permission error:', err);
        setLocationPermission(false);
        return false;
      }
    }
    // iOS handles permissions through Info.plist
    setLocationPermission(true);
    return true;
  };

  // Calculate distance between two coordinates in meters
  const calculateDistance = (coord1, coord2) => {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Find the closest point on the route and calculate progress
  const updateNavigationProgress = (userCoords) => {
    if (!routeData.geometry || !routeData.geometry.coordinates) return;

    const routeCoords = routeData.geometry.coordinates;
    
    // Find nearest point on route
    let nearestDistance = Infinity;
    let nearestIndex = 0;

    routeCoords.forEach((coord, index) => {
      const distance = calculateDistance(userCoords, coord);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    // Update progress based on route completion
    const newProgress = Math.min(nearestIndex / (routeCoords.length - 1), 1);
    setProgress(newProgress);

    // Calculate remaining distance along the route
    let remainingRouteDistance = 0;
    for (let i = nearestIndex; i < routeCoords.length - 1; i++) {
      remainingRouteDistance += calculateDistance(routeCoords[i], routeCoords[i + 1]);
    }

    // Calculate remaining time based on profile
    let averageSpeed = 5; // km/h default for walking
    if (selectedProfile === 'driving') averageSpeed = 50;
    if (selectedProfile === 'cycling') averageSpeed = 15;

    const remainingTime = (remainingRouteDistance / 1000) / averageSpeed * 3600; // in seconds

    setDistanceRemaining(remainingRouteDistance);
    setTimeRemaining(remainingTime);

    // Check if arrived (within 25 meters of destination)
    const distanceToDestination = calculateDistance(userCoords, coordinates.end);
    if (distanceToDestination < 25 && isNavigating) {
      setIsNavigating(false);
      Alert.alert('Arrived!', 'You have reached your destination');
    }
  };

  // Fallback simulation for when real location is not available
  const startSimulatedNavigation = useCallback(() => {
    if (!isNavigating || !routeData.geometry) return;

    const routeCoordinates = routeData.geometry.coordinates;
    const totalDistance = routeData.distance;
    let currentProgress = 0;
    let currentIndex = 0;

    const simulateStep = () => {
      if (currentProgress >= 1 || !isNavigating) {
        setIsNavigating(false);
        Alert.alert('Arrived!', 'You have reached your destination');
        return;
      }

      currentProgress += 0.002;
      setProgress(currentProgress);

      const targetIndex = Math.floor(currentProgress * (routeCoordinates.length - 1));
      
      if (targetIndex > currentIndex && targetIndex < routeCoordinates.length) {
        currentIndex = targetIndex;
        const newLocation = routeCoordinates[targetIndex];
        
        setCurrentLocation(newLocation);
        setUserLocation(newLocation);
        
        const remainingDistance = totalDistance * (1 - currentProgress);
        const remainingTime = routeData.duration * (1 - currentProgress);
        
        setDistanceRemaining(remainingDistance);
        setTimeRemaining(remainingTime);

        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: newLocation,
            animationDuration: 1000,
          });
        }
      }

      if (isNavigating) {
        setTimeout(simulateStep, 100);
      }
    };

    simulateStep();
  }, [isNavigating, routeData]);

  // Start real-time location tracking with proper error handling
  const startRealTimeTracking = useCallback(async () => {
    try {
      const hasPermission = await requestLocationPermission();
      
      if (!hasPermission) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permissions in settings to use navigation. Using simulation mode.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Fallback to simulation if no permission
                startSimulatedNavigation();
              }
            }
          ]
        );
        return;
      }

      // Check if LocationManager is available and has required methods
      if (!LocationManager || typeof LocationManager.start !== 'function') {
        console.warn('LocationManager not available, using simulation');
        startSimulatedNavigation();
        return;
      }

      console.log('Starting real location tracking...');

      // Start location manager
      LocationManager.start();

      // Create a simple location listener
      const onLocationUpdate = (location) => {
        if (location && location.coords) {
          const newLocation = [location.coords.longitude, location.coords.latitude];
          console.log('New location:', newLocation);
          
          setCurrentLocation(newLocation);
          setUserLocation(newLocation);
          
          // Update camera to follow user
          if (cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: newLocation,
              animationDuration: 1000,
            });
          }

          // Calculate real progress based on actual position
          updateNavigationProgress(newLocation);
        }
      };

      // Use the location manager's event system
      // Note: The exact event name might vary based on Mapbox version
      locationSubscription.current = LocationManager.addListener(
        'LocationUpdate', 
        onLocationUpdate
      );

    } catch (error) {
      console.error('Failed to start location tracking:', error);
      // Fallback to simulation
      startSimulatedNavigation();
    }
  }, [routeData, coordinates, selectedProfile]);

  // Stop location tracking
  const stopLocationTracking = () => {
    try {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      
      if (LocationManager && typeof LocationManager.stop === 'function') {
        LocationManager.stop();
      }
    } catch (error) {
      console.warn('Error stopping location manager:', error);
    }
  };

  // Start tracking when component mounts
  useEffect(() => {
    startRealTimeTracking();

    // Cleanup on unmount
    return () => {
      stopLocationTracking();
    };
  }, [startRealTimeTracking]);

  const formatDuration = (seconds) => {
    if (!seconds || seconds < 60) return '< 1 min';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDistance = (meters) => {
    if (!meters) return '0 m';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const handleStopNavigation = () => {
    setIsNavigating(false);
    Alert.alert(
      'Stop Navigation',
      'Are you sure you want to stop navigation?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setIsNavigating(true) },
        { 
          text: 'Stop', 
          style: 'destructive',
          onPress: () => {
            stopLocationTracking();
            navigation.goBack();
          }
        },
      ]
    );
  };

  const getRouteProgressLine = () => {
    if (!routeData.geometry || !currentLocation) return null;

    const currentIndex = Math.floor(progress * (routeData.geometry.coordinates.length - 1));
    
    if (currentIndex >= routeData.geometry.coordinates.length - 1) {
      return null;
    }
    
    const remainingCoordinates = routeData.geometry.coordinates.slice(currentIndex);
    
    if (remainingCoordinates.length < 2) {
      return null;
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: remainingCoordinates,
      },
    };
  };

  const getTraveledRoute = () => {
    if (!routeData.geometry || !currentLocation) return null;

    const currentIndex = Math.floor(progress * (routeData.geometry.coordinates.length - 1));
    
    if (currentIndex < 1) {
      return null;
    }
    
    const traveledCoordinates = routeData.geometry.coordinates.slice(0, currentIndex + 1);
    
    if (traveledCoordinates.length < 2) {
      return null;
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: traveledCoordinates,
      },
    };
  };

  // Get profile icon
  const getProfileIcon = () => {
    switch (selectedProfile) {
      case 'driving': return 'directions-car';
      case 'walking': return 'directions-walk';
      case 'cycling': return 'directions-bike';
      default: return 'directions';
    }
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map}>
        <Camera
          ref={cameraRef}
          zoomLevel={16}
          centerCoordinate={currentLocation}
          animationMode={'flyTo'}
          animationDuration={1000}
        />

        {/* Traveled route (already covered) */}
        {getTraveledRoute() && (
          <ShapeSource id="traveledRouteSource" shape={getTraveledRoute()}>
            <LineLayer
              id="traveledRouteLine"
              style={{
                lineColor: '#4ecdc4',
                lineWidth: 6,
                lineOpacity: 0.8,
              }}
            />
          </ShapeSource>
        )}

        {/* Remaining route */}
        {getRouteProgressLine() && (
          <ShapeSource id="remainingRouteSource" shape={getRouteProgressLine()}>
            <LineLayer
              id="remainingRouteLine"
              style={{
                lineColor: '#ff6b6b',
                lineWidth: 6,
                lineOpacity: 0.8,
                lineDasharray: [2, 2],
              }}
            />
          </ShapeSource>
        )}

        {/* Current location marker */}
        <ShapeSource
          id="currentLocationSource"
          shape={{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: currentLocation,
            },
          }}
        >
          <SymbolLayer
            id="currentLocationSymbol"
            style={{
              iconImage: 'marker-15',
              iconSize: 1.5,
              iconColor: '#4ecdc4',
              iconAllowOverlap: true,
            }}
          />
        </ShapeSource>

        {/* Destination marker */}
        <ShapeSource
          id="destinationSource"
          shape={{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: coordinates.end,
            },
          }}
        >
          <SymbolLayer
            id="destinationSymbol"
            style={{
              iconImage: 'marker-15',
              iconSize: 2,
              iconColor: '#ff4444',
              iconAllowOverlap: true,
            }}
          />
        </ShapeSource>
      </MapView>

      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleStopNavigation}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {isNavigating ? 'Navigating' : 'Arrived'}
          </Text>
          <View style={styles.profileInfo}>
            <MaterialIcons name={getProfileIcon()} size={16} color="#666" />
            <Text style={styles.headerSubtitle}>
              {selectedProfile === 'driving' ? 'Driving' : 
               selectedProfile === 'walking' ? 'Walking' : 'Cycling'}
              {!locationPermission && ' - Simulation Mode'}
            </Text>
          </View>
        </View>
      </View>

      {/* Navigation Info Panel */}
      <View style={styles.infoPanel}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialIcons name="access-time" size={20} color="#666" />
            <Text style={styles.infoValue}>{formatDuration(timeRemaining)}</Text>
            <Text style={styles.infoLabel}>Time Left</Text>
          </View>
          
          <View style={styles.infoItem}>
            <MaterialIcons name="directions" size={20} color="#666" />
            <Text style={styles.infoValue}>{formatDistance(distanceRemaining)}</Text>
            <Text style={styles.infoLabel}>Distance Left</Text>
          </View>
          
          <View style={styles.infoItem}>
            <MaterialIcons name="speed" size={20} color="#666" />
            <Text style={styles.infoValue}>{Math.round(progress * 100)}%</Text>
            <Text style={styles.infoLabel}>Progress</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View 
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` }
              ]} 
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.stopButton]}
            onPress={handleStopNavigation}
          >
            <MaterialIcons name="stop" size={20} color="#fff" />
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.recenterButton]}
            onPress={() => {
              cameraRef.current?.setCamera({
                centerCoordinate: currentLocation,
                zoomLevel: 16,
                animationDuration: 500,
              });
            }}
          >
            <MaterialIcons name="my-location" size={20} color="#fff" />
            <Text style={styles.recenterButtonText}>Recenter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Arrival Banner */}
      {!isNavigating && (
        <View style={styles.arrivalBanner}>
          <MaterialIcons name="celebration" size={24} color="#fff" />
          <Text style={styles.arrivalText}>You have arrived at your destination!</Text>
        </View>
      )}

      {/* Simulation Mode Indicator */}
      {!locationPermission && (
        <View style={styles.simulationBanner}>
          <MaterialIcons name="location-off" size={16} color="#fff" />
          <Text style={styles.simulationText}>Simulation Mode - Enable GPS for real tracking</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafc',
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  progressContainer: {
    marginVertical: 12,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ecdc4',
    borderRadius: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 0.48,
  },
  stopButton: {
    backgroundColor: '#ff6b6b',
  },
  recenterButton: {
    backgroundColor: '#4ecdc4',
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  recenterButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  arrivalBanner: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    backgroundColor: '#4ecdc4',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  arrivalText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  simulationBanner: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: '#ffa726',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  simulationText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
});

export default NavigationScreen;