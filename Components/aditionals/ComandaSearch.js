import React from "react";
import { View, Text, SafeAreaView, FlatList } from "react-native";
import jsonData from "../../json/ShowDishes.json";

const ComandaSearch = () => {
  const renderItem = ({ item }) => (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "lightgray",
      }}
    >
      <Text style={{ flex: 1, textAlign: "center" }}>{item.cantidad}</Text>
      <Text style={{ flex: 1, textAlign: "center" }}>{item.dish}</Text>
    </View>
  );

  return (
    <SafeAreaView>
      <View>
        <View style={{ borderColor: "orange", borderWidth: 4, borderRadius: 30}}>
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 20, marginBottom: 20 }}>
            <Text>
              Mesa: 10 personas
            </Text>
            <Text>
              Mozo: Carlos Herrera
            </Text>
          </View>
          <View style={{ flexDirection: "column" }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: "lightgray",
                backgroundColor: "lightblue",
              }}
            >
              <Text style={{ flex: 1, textAlign: "center", fontWeight: "bold" }}>
                Cantidad
              </Text>
              <Text style={{ flex: 1, textAlign: "center", fontWeight: "bold" }}>
                Pedido
              </Text>
            </View>
            <FlatList
              data={jsonData}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
          <View style={{ marginTop:20, marginBottom: 30 }}>
            <Text style={{ textAlign:"center", fontWeight: "bold", fontSize: 20 }}>Detalles del Pedido</Text>
            <Text style={{ textAlign:"center", marginTop: 20, fontWeight: "bold" }}>Detalle del pedido 1</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ComandaSearch;
