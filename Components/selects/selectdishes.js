import React, { useState, useEffect } from "react";
import { View, TextInput, FlatList, Button, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DISHES_API } from "../../apiConfig";

const SelectDishes = ({ onValueChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dishes, setDishes] = useState([]);
  const [selectedPlates, setSelectedPlates] = useState([]);
  const [selectedPlate, setSelectedPlate] = useState(null);
  const [filteredDishes, setFilteredDishes] = useState([]);

  useEffect(() => {
    const fetchDishes = async () => {
      try {
        const response = await fetch(DISHES_API);
        const data = await response.json();
        setDishes(data);
      } catch (error) {
        console.error('Error fetching dishes:', error);
      }
    };

    fetchDishes();
  }, []);

  useEffect(() => {
    const retrieveSelectedPlates = async () => {
      try {
        const selectedPlatesString = await AsyncStorage.getItem('selectedPlates');
        if (selectedPlatesString !== null) {
          const selectedPlates = JSON.parse(selectedPlatesString);
          setSelectedPlates(selectedPlates);
          onValueChange(selectedPlates.map(plate => plate._id));
        }
      } catch (error) {
        console.error('Error retrieving selected plates:', error);
      }
    };

    retrieveSelectedPlates();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 3) {
      const filtered = dishes.filter(plate =>
        plate.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDishes(filtered);
    } else {
      setFilteredDishes([]);
    }
  }, [searchTerm, dishes]);

  const handleSearch = (text) => {
    setSearchTerm(text);
    setSelectedPlate(null);
  };

  const handlePlateSelect = async (plateId) => {
    const selectedPlate = dishes.find(plate => plate._id === plateId);
    setSelectedPlate(selectedPlate);
    const updatedPlates = [...selectedPlates, selectedPlate];
    setSelectedPlates(updatedPlates);
    onValueChange(updatedPlates.map(plate => plate._id));

    try {
      await AsyncStorage.setItem('selectedPlates', JSON.stringify(updatedPlates));
    } catch (error) {
      console.error('Error storing selected plates:', error);
    }
  };

  const renderItem = ({ item }) => (
    <Button title={item.nombre} onPress={() => handlePlateSelect(item._id)} />
  );

  return (
    <View style={{maxWidth:'70%'}}>
      {selectedPlate ? null : (
        <TextInput
          placeholder="Buscar plato"
          onChangeText={handleSearch}
          value={searchTerm}
        />
      )}
      {selectedPlate ? null : (
        searchTerm.length >= 3 && (
          <FlatList
            data={filteredDishes}
            renderItem={renderItem}
            keyExtractor={item => item._id}
          />
        )
      )}
      {selectedPlate ? (
        <Text>{selectedPlate.nombre}</Text>
      ) : null}
    </View>
  );
};

export default SelectDishes;
