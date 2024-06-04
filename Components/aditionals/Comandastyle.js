import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button } from "react-native";
import SelectDishes from "../selects/selectdishes";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ComandaStyle = ({ cleanComanda, setCleanComanda }) => {
  const [inputs, setInputs] = useState([{ id: 1, cantidad: '' }]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [showDetailsInput, setShowDetailsInput] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  
  useEffect(() => {
    if (cleanComanda) {
      setInputs([{ id: 1, cantidad: '' }]);
      setCleanComanda(false);
    }
  }, [cleanComanda]);

  const handleAddInput = () => {
    const newId = inputs.length + 1;
    setInputs([...inputs, { id: newId, cantidad: '' }]);
    console.log(newId);
  };

  const handleRemoveInput = async (idToRemove) => {
    try {
      let newId = idToRemove - 1; 

      const updatedInputs = inputs.filter((input) => input.id !== idToRemove);
      setInputs(updatedInputs);
      const deleteselectplates = await AsyncStorage.getItem('selectedPlates');
      const deletecantidades = await AsyncStorage.getItem('cantidadesComanda');
  
      let platos = JSON.parse(deleteselectplates);
      let cantidades = JSON.parse(deletecantidades);
  
      platos.splice(newId,1);
      cantidades.splice(newId,1);
  
      await AsyncStorage.setItem('selectedPlates', JSON.stringify(platos));
      await AsyncStorage.setItem('cantidadesComanda', JSON.stringify(cantidades));
  
      console.log('Plato eliminado:', deleteselectplates);
      console.log('Cantidad eliminada:', deletecantidades);
    } catch (error) {
      console.error('Error al eliminar el plato y la cantidad:', error);
    }
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
          justifyContent: "space-between",
          marginRight: "30%",
          marginLeft: "5%",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "bold"}}>Cantidad</Text>
        <Text style={{ fontWeight: "bold", paddingRight: "19%" }}>Descripción</Text>
      </View>
      {inputs.map((input) => (
        <View
          key={input.id}
          style={{
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 22,
            flexDirection: "row",
            marginBottom: 30,
            paddingLeft: "6%",
            paddingRight: "4%",
          }}
        >
          <TextInput
            placeholder="Cantidad"
            value={input.cantidad}
            onChangeText={(text) => handleCantidadChange(text, input.id)}
            keyboardType="numeric"
            style={{ flex: 1, maxWidth: "20%"}}
          />
          <SelectDishes onValueChange={handleDishChange} style={{ flex: 1 }}/>
          <Button title="X" onPress={() => handleRemoveInput(input.id)} style={{ flex: 1 }}/>
        </View>
      ))}
      <View style={{ maxWidth: "60%", justifyContent:"center", alignSelf: "center"  }}>
        <Button title="Agregar" onPress={handleAddInput} />
      </View>
      {showDetailsInput && (
        <View style={{ marginTop: 20 }}>
          <TextInput
            placeholder="Ingrese detalles adicionales aquí"
            onChangeText={handleDetailsChange}
            value={additionalDetails}
            style={{ textAlign: "center" }}
            multiline={true}
            numberOfLines={5}
          />
          <View style={{ marginTop: 20,  maxWidth: "60%", justifyContent:"center", alignSelf: "center"  }}>
            <Button title="Guardar" onPress={handleSaveDetails} />
          </View>
        </View>
      )}
      {!showDetailsInput && (
        <View style={{ marginTop: 20, maxWidth: "60%", justifyContent:"center", alignSelf: "center"  }}>
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