import React, { useState, useEffect } from "react";
import RNPickerSelect from "react-native-picker-select";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DISHES_API } from "../../apiConfig"; 

const SelectDishes = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDish, setSelectedDish] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedPlates, setSelectedPlates] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(DISHES_API);
        const data = await response.json();
        const groupedCategories = {};
        data.forEach(plato => {
          if (!groupedCategories[plato.categoria]) {
            groupedCategories[plato.categoria] = [];
          }
          groupedCategories[plato.categoria].push(plato);
        });
        const formattedCategories = Object.keys(groupedCategories).map(categoria => ({
          label: categoria,
          value: categoria,
          platos: groupedCategories[categoria].map(plato => ({ label: plato.nombre, value: plato._id }))
        }));
        setCategories(formattedCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, []);

  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
    setSelectedDish(null);
  };

  const handleDishChange = (value) => {
    if (value !== selectedDish) {
      console.log("Plato seleccionado _id:", value);
      const updatedPlates = [...selectedPlates, value];
      setSelectedDish(value);
      setSelectedPlates(updatedPlates);
      storePlates(updatedPlates);
    }
  };

  const storePlates = async (plates) => {
    try {
      await AsyncStorage.setItem('selectedPlates', JSON.stringify(plates));
      const platoseleccionado = await AsyncStorage.getItem("selectedPlates");
      console.log('plato seleccionado test',platoseleccionado);
    } catch (error) {
      console.error('Error storing plates:', error);
    }
  };

  const retrievePlates = async () => {
    try {
      const platesString = await AsyncStorage.getItem('selectedPlates');
      if (platesString !== null) {
        return JSON.parse(platesString);
      }
    } catch (error) {
      console.error('Error retrieving plates:', error);
    }
    return [];
  };
  
  useEffect(() => {
    const getSelectedPlates = async () => {
      const plates = await retrievePlates();
      setSelectedPlates(plates);
    };
    getSelectedPlates();
  }, []);

  return (
    <View style={{ flex:1, width:'100%', gap:8 }}>
      {!selectedCategory && (
        <RNPickerSelect
          placeholder={{ label: "categoría", value: null }}
          items={categories.map(category => ({ label: category.label, value: category.value }))}
          onValueChange={handleCategoryChange}
          value={selectedCategory}
        />
      )}
      {selectedCategory && (
        <RNPickerSelect
          placeholder={{ label: "plato", value: null }}
          items={categories.find(category => category.value === selectedCategory).platos}
          onValueChange={handleDishChange}
          value={selectedDish}
        />
      )}
    </View>
  );
};

export default SelectDishes;
