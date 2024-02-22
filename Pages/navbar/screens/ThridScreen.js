import React from "react";
import { View, SafeAreaView, TextInput } from "react-native";
import ComandaSearch from "../../../Components/aditionals/ComandaSearch";

const ThirdScreen = () => {
  return (
    <SafeAreaView>
      <View>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <TextInput
            style={{
              height: 40,
              borderWidth: 1,
              borderColor: "gray",
              borderRadius: 8,
              paddingHorizontal: 12,
              marginBottom: 16,
            }}
            placeholder="Buscar..."
          />
        </View>
        <View style={{ padding:20 }}>
          <ComandaSearch/>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ThirdScreen;
