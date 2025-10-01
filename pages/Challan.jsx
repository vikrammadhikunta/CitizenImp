import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, Image, StyleSheet } from "react-native";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const Challan = () => {
  const [vehicleNumber, setVehicleNumber] = useState(null);
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);

  const db = getFirestore();
  const uid = auth().currentUser?.uid;
  console.log("🔑 Current User UID:", uid);

  // Fetch vehicle number for logged-in user
  useEffect(() => {
    const fetchVehicleNumber = async () => {
      if (!uid) return;
      try {
        console.log("📡 Fetching vehicle number for UID:", uid);
        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists) {
          const vNum = userDoc.data().vehicleNumber;
          console.log("✅ Vehicle number found:", vNum);
          setVehicleNumber(vNum);
        } else {
          console.log("❌ No user document found for UID:", uid);
          setLoading(false);
        }
      } catch (e) {
        console.error("🔥 Error fetching vehicle number:", e);
        setLoading(false);
      }
    };

    fetchVehicleNumber();
  }, [uid]);

  // Fetch challans based on vehicle number
  useEffect(() => {
    if (!vehicleNumber) return;

    const fetchAllChallans = async () => {
      try {
        console.log("📡 Fetching challans for vehicle:", vehicleNumber);

        const challansRef = collection(db, "trafficViolations");
        const q = query(challansRef, where("vehicleNumber", "==", vehicleNumber));
        const snapshot = await getDocs(q);

        console.log("📊 Total documents found:", snapshot.size);

        const challanList = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
          };
        });

        setChallans(challanList);
        console.log("✅ All challans loaded:", challanList.length);
      } catch (e) {
        console.error("🔥 Error fetching all challans:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAllChallans();
  }, [vehicleNumber]);

  if (loading) {
    console.log("⏳ Still loading...");
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Vehicle Number: {vehicleNumber || "Not Found"}
      </Text>

      {challans.length > 0 ? (
        <FlatList
          data={challans}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.challanCard}>
              <Text style={styles.cardText}>
                <Text style={styles.bold}>Rules Violated:</Text>{" "}
                {item.rulesViolated?.join(", ")}
              </Text>
              <Text style={styles.cardText}>
                <Text style={styles.bold}>Date:</Text>{" "}
                {item.timestamp.toLocaleString()}
              </Text>
              {item.imageUrl && (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.image}
                  resizeMode="contain"
                />
              )}
            </View>
          )}
        />
      ) : (
        <Text style={styles.noChallansText}>No challans found for this vehicle.</Text>
      )}
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    marginTop: 50,
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  header: {
    fontWeight: "bold",
    fontSize: 20,
    marginBottom: 20,
  },
  challanCard: {
    backgroundColor: "white",
    marginVertical: 8,
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  cardText: {
    fontSize: 16,
    marginBottom: 5,
  },
  bold: {
    fontWeight: "bold",
  },
  image: {
    width: "100%",
    height: 200,
    marginTop: 10,
    borderRadius: 8,
  },
  noChallansText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: "center",
    color: "gray",
  },
});

export default Challan;
