import React, { useState } from "react";
import { View, Text, TextInput, Button } from "react-native";
import SelectDishes from "../selects/selectdishes";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ComandaStyle = () => {
  const [inputs, setInputs] = useState([{ id: 1, cantidad: '' }]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [showDetailsInput, setShowDetailsInput] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);

  const handleAddInput = () => {
    const newId = inputs.length + 1;
    setInputs([...inputs, { id: newId, cantidad: '' }]);
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
      const updatedInputs = [...inputs];
      saveCantidades(updatedInputs);
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

  const handleCantidadChange = (text, id) => {
    const updatedInputs = inputs.map(input =>
      input.id === id ? { ...input, cantidad: text } : input
    );
    setInputs(updatedInputs);
    console.log("Cantidad ingresada:", text);
    // Guardar las cantidades automáticamente
    saveCantidades(updatedInputs);
  };

  const saveCantidades = async (updatedInputs) => {
    try {
      const cantidades = updatedInputs.map(input => input.cantidad);
      await AsyncStorage.setItem('cantidadesComanda', JSON.stringify(cantidades));
      console.log("Cantidades guardadas exitosamente");
    } catch (error) {
      console.error("Error al guardar las cantidades:", error);
    }
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
            gap: 60,
            paddingLeft: 30,
            paddingRight: 20,
          }}
        >
          <TextInput
            placeholder="Cantidad"
            value={input.cantidad}
            onChangeText={(text) => handleCantidadChange(text, input.id)}
            keyboardType="numeric"
          />
          <SelectDishes onValueChange={handleDishChange} />
          <Button title="X" onPress={() => handleRemoveInput(input.id)} />
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
