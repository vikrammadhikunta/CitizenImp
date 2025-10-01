import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Firebase imports - using lazy loading pattern
import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from '@react-native-firebase/firestore';

// Reusable Components
const ProfileInput = React.memo(({ placeholder, value, onChangeText, ...props }) => (
  <View style={styles.inputContainer}>
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor="#A9A9A9"
      value={value}
      onChangeText={onChangeText}
      {...props}
    />
  </View>
));

const PrimaryButton = React.memo(({ title, onPress, loading = false }) => (
  <Pressable style={styles.primaryButton} onPress={onPress} disabled={loading}>
    {loading ? (
      <ActivityIndicator color="#FFF" />
    ) : (
      <Text style={styles.primaryButtonText}>{title}</Text>
    )}
  </Pressable>
));

const DangerButton = React.memo(({ title, onPress, loading = false }) => (
  <Pressable style={styles.dangerButton} onPress={onPress} disabled={loading}>
    {loading ? (
      <ActivityIndicator color="#FFF" />
    ) : (
      <Text style={styles.dangerButtonText}>{title}</Text>
    )}
  </Pressable>
));

const Profile = () => {
  // State initialization
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Firebase instances - initialized only when needed
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
  const [auth, setAuth] = useState(null);
  const [firestore, setFirestore] = useState(null);
  const [uid, setUid] = useState(null);

  // Initialize Firebase only once
  useEffect(() => {
    try {
      const app = getApp();
      const authInstance = getAuth(app);
      const firestoreInstance = getFirestore(app);
      const currentUid = authInstance.currentUser?.uid;
      
      setAuth(authInstance);
      setFirestore(firestoreInstance);
      setUid(currentUid);
      setFirebaseInitialized(true);
    } catch (error) {
      console.error('Firebase initialization error:', error);
      setIsLoading(false);
    }
  }, []);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!uid || !firestore) return;
    
    try {
      const userRef = doc(firestore, 'users', uid);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setVehicleNumber(data.vehicleNumber || '');
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
      Alert.alert('Error', 'Could not fetch your profile data.');
    } finally {
      setIsLoading(false);
    }
  }, [uid, firestore]);

  useEffect(() => {
    if (firebaseInitialized && uid) {
      fetchProfile();
    } else if (firebaseInitialized && !uid) {
      setIsLoading(false);
    }
  }, [firebaseInitialized, uid, fetchProfile]);

  const handleSave = async () => {
    if (!uid || !firestore) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'users', uid), {
        firstName,
        lastName,
        vehicleNumber,
      });
      Alert.alert('Success', 'Your profile has been updated!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Sign out failed.');
    }
  };

  // Show loading indicator only when absolutely necessary
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0A7AF9" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>Keep your information up to date</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.row}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>First Name</Text>
              <ProfileInput
                placeholder="Vikram"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Last Name</Text>
              <ProfileInput
                placeholder="Madhikunta"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Vehicle Number</Text>
            <ProfileInput
              placeholder="AB12CD3456"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <PrimaryButton title="Save Changes" onPress={handleSave} loading={isSaving} />
          <DangerButton title="Sign Out" onPress={handleSignOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default React.memo(Profile);

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  scrollContainer: {
    padding: 24,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E1E1E',
  },
  subtitle: {
    fontSize: 16,
    color: '#777',
    marginTop: 4,
  },
  formContainer: {
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputWrapper: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  input: {
    height: 50,
    fontSize: 16,
    color: '#333',
    paddingHorizontal: 16,
  },
  buttonGroup: {
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: '#0A7AF9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#0A7AF9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  dangerButton: {
    backgroundColor: '#E63946',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    elevation: 3,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  dangerButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});