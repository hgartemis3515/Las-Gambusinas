import React, { useState, useEffect } from "react";
import RNPickerSelect from "react-native-picker-select";
import { View } from "react-native";

const SelectDishes = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDish, setSelectedDish] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    // Función para obtener las categorías y platos desde el API
    const fetchCategories = async () => {
      try {
        const response = await fetch('http://192.168.1.10:8000/api/categorias');
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    // Llamada a la función para obtener las categorías cuando el componente se monta
    fetchCategories();
  }, []);

  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
    setSelectedDish(null);
  };

  const handleDishChange = (value) => {
    setSelectedDish(value);
    console.log("Plato seleccionado:", value); 
  };

  return (
    <View style={{ flex:1, width:'100%', gap:8 }}>
      <RNPickerSelect
        placeholder={{ label: "Seleccionar categoría", value: null }}
        items={categories.map(category => ({ label: category.categorias[0].nombre, value: category._id }))}
        onValueChange={handleCategoryChange}
        value={selectedCategory}
      />
      {selectedCategory && (
        <RNPickerSelect
          placeholder={{ label: "Seleccionar plato", value: null }}
          items={categories.find(category => category._id === selectedCategory).categorias[0].platos.map(dish => ({ label: dish.nombre, value: dish._id }))}
          onValueChange={handleDishChange}
          value={selectedDish}
        />
      )}
    </View>
  );
};


export default SelectDishes;
