import React, { useState } from "react";
import { View, Text, TextInput, Button } from "react-native";
import SelectDishes from "../selects/selectdishes";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ComandaStyle = () => {
  const [inputs, setInputs] = useState([{ id: 1 }]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [showDetailsInput, setShowDetailsInput] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);

  const handleAddInput = () => {
    const newId = inputs.length + 1;
    setInputs([...inputs, { id: newId }]);
  };

  const handleRemoveInput = (idToRemove) => {
    const updatedInputs = inputs.filter((input) => input.id !== idToRemove);
    setInputs(updatedInputs);
  };

  const handleShowDetailsInput = () => {
    setShowDetailsInput(true);
  };

  const handleSaveDetails = async () => {
    setShowDetailsInput(false);
    console.log("Detalle del pedido:", additionalDetails);
    
    try {
      // Guardar los detalles adicionales en AsyncStorage
      await AsyncStorage.setItem('additionalDetails', additionalDetails);
      console.log("Detalles adicionales almacenados exitosamente");
    } catch (error) {
      console.error("Error al almacenar los detalles adicionales:", error);
    }
  };

  const handleDetailsChange = (text) => {
    setAdditionalDetails(text);
  };

  const handleDishChange = (value) => {
    setSelectedDish(value);
    console.log("Plato seleccionado:", value);
  };

  return (
    <View style={{ flexDirection: "column" }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "bold" }}>Cantidad</Text>
        <Text style={{ fontWeight: "bold" }}>Descripción</Text>
      </View>
      {inputs.map((input) => (
        <View
          key={input.id}
          style={{
            justifyContent: "space-around",
            alignItems: "center",
            marginTop: 22,
            flexDirection: "row",
            marginBottom: 40,
            gap: 32,
            paddingLeft: 20,
            paddingRight: 20,
          }}
        >
          <TextInput placeholder="Seleccionar Cantidad" />
          <SelectDishes onValueChange={handleDishChange} />
          <Button title="Quitar" onPress={() => handleRemoveInput(input.id)} />
        </View>
      ))}
      <Button title="Agregar" onPress={handleAddInput} />
      {showDetailsInput && (
        <View style={{ marginTop: 20, marginLeft: 20 }}>
          <TextInput
            placeholder="Ingrese detalles adicionales aquí"
            onChangeText={handleDetailsChange}
            value={additionalDetails}
          />
          <View style={{ marginTop: 20 }}>
            <Button title="Guardar" onPress={handleSaveDetails} />
          </View>
        </View>
      )}
      {!showDetailsInput && (
        <View style={{ marginTop: 20 }}>
          <Button
            title="Detalles adicionales"
            onPress={handleShowDetailsInput}
          />
        </View>
      )}
    </View>
  );
};

export default ComandaStyle;
