import React, { useState, useEffect } from "react";
import RNPickerSelect from "react-native-picker-select";
import { View } from "react-native";

const SelectDishes = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDish, setSelectedDish] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('http://192.168.1.10:8000/api/platos');
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
    if (value !== selectedDish) { // Agregar validación para evitar ejecución duplicada
      setSelectedDish(value);
      console.log("Plato seleccionado:", value);
    }
  };

  return (
    <View style={{ flex:1, width:'100%', gap:8 }}>
      <RNPickerSelect
        placeholder={{ label: "Seleccionar categoría", value: null }}
        items={categories.map(category => ({ label: category.label, value: category.value }))}
        onValueChange={handleCategoryChange}
        value={selectedCategory}
      />
      {selectedCategory && (
        <RNPickerSelect
          placeholder={{ label: "Seleccionar plato", value: null }}
          items={categories.find(category => category.value === selectedCategory).platos}
          onValueChange={handleDishChange}
          value={selectedDish}
        />
      )}
    </View>
  );
};


export default SelectDishes;
