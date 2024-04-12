import React from "react";
import { View, SafeAreaView, TextInput } from "react-native";
import ComandaSearch from "../../../Components/aditionals/ComandaSearch";

const ThirdScreen = () => {
  return (
    <SafeAreaView>
      <View>
        <View style={{ padding:20 }}>
          <ComandaSearch/>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ThirdScreen;
