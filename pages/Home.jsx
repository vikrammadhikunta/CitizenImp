import React, { useEffect, useState, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';   // ✅ FIX: import useNavigation


const MAPBOX_TOKEN =
  'pk.eyJ1IjoidmlrcmFtNzYiLCJhIjoiY20zd3BydDZhMTM0cTJqcjBmZW96Y2liMiJ9.scf_t3IAqpcmZDxbpXJC2Q';

const Home = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const navigation = useNavigation();   // ✅ FIX: now we can use navigation

  // Request FOREGROUND location permission
  const requestLocationPermission = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message:
            'This app needs access to your location to detect your starting point.',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Foreground location permission granted.');
        return true;
      } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permission Required',
          'Location permission has been permanently denied. Please enable it in the app settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return false;
    } catch (err) {
      console.warn('Permission error:', err);
      return false;
    }
  };

  // Request BACKGROUND location permission
  const requestBackgroundLocationPermission = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const hasForegroundPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      if (!hasForegroundPermission) {
        Alert.alert(
          'Permission Error',
          'Please grant foreground location permission first before enabling background location.'
        );
        return false;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'Background Location Permission',
          message:
            'This app needs background location access to provide live navigation even when the app is in the background.',
          buttonPositive: 'Allow All The Time',
          buttonNegative: 'Keep Only While Using',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Background location permission granted.');
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Background permission error:', err);
      return false;
    }
  };

  // Detect current location
  const detectCurrentLocation = useCallback(async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    setIsDetectingLocation(true);
    Geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log('Current position:', latitude, longitude);

        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`;
        try {
          const res = await fetch(url);
          const json = await res.json();
          if (json.features && json.features.length > 0) {
            console.log('Detected location:', json.features[0]);
            setFrom(json.features[0].place_name);
          }
        } catch (err) {
          console.error('Reverse geocode error:', err);
          Alert.alert('Error', 'Could not fetch location name.');
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        console.error('Location error:', error.code, error.message);
        Alert.alert('Location Error', 'Could not get your current location.');
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  // Auto-detect on mount
  useEffect(() => {
    detectCurrentLocation();
  }, [detectCurrentLocation]);

  // Autocomplete suggestions for "to"
  useEffect(() => {
    if (to.length < 2) {
      setSuggestions([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsFetchingSuggestions(true);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        to
      )}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;
      try {
        const res = await fetch(url);
        const json = await res.json();
        setSuggestions(json.features || []);
      } catch (err) {
        console.error('Autocomplete error:', err);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [to]);

  const handleSelectSuggestion = (place) => {
    setTo(place.place_name);
    setSuggestions([]);
  };

  // Find Route
  const handleFindRoute = async () => {
    if (!from || !to) {
      Alert.alert(
        'Missing Information',
        'Please provide both a starting point and a destination.'
      );
      return;
    }

    console.log(`➡️ Finding route from ${from} to ${to}`);
    const hasBackgroundPermission =
      await requestBackgroundLocationPermission();

    navigation.navigate('RoutePage', {
      from,
      to,
      backgroundTracking: hasBackgroundPermission,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Plan Your Trip</Text>
      <Text style={styles.subHeader}>Enter your route details below</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>From</Text>
        <View style={styles.inputWithButton}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={isDetectingLocation ? 'Detecting...' : 'Current Location'}
            placeholderTextColor="#888"
            value={from}
            onChangeText={setFrom}
          />
          <TouchableOpacity
            style={styles.locationButton}
            onPress={detectCurrentLocation}
            disabled={isDetectingLocation}
          >
            {isDetectingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="my-location" color="#000" size={24} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>To</Text>
        <View>
          <TextInput
            style={styles.input}
            placeholder="Enter destination"
            placeholderTextColor="#888"
            value={to}
            onChangeText={setTo}
          />
          {isFetchingSuggestions && (
            <ActivityIndicator style={styles.suggestionLoader} />
          )}
        </View>

        {suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            style={styles.suggestionList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(item)}
              >
                <Text>{item.place_name}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}
        onPress={handleFindRoute}
      >
        <Text style={styles.buttonText}>Find Route & Navigate</Text>
      </Pressable>
    </View>
  );
};

export default Home;

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafc',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 6,
  },
  subHeader: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationButton: {
    marginLeft: 8,
    padding: 12,
    height: 50,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4ecdc4',
    borderRadius: 12,
  },
  suggestionList: {
    maxHeight: 200,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 12,
    marginTop: -8,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  suggestionLoader: {
    position: 'absolute',
    right: 15,
    top: 13,
  },
  button: {
    backgroundColor: '#4ecdc4',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
