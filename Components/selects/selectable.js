import React, { useState, useEffect } from 'react';
import { View, Button } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialIcons';

const Selectable = ({ onSelectTable }) => { // Acepta onSelectTable como una prop
  const [mesas, setMesas] = useState([]);

  useEffect(() => {
    const fetchMesas = async () => {
      try {
        const response = await fetch('http://192.168.1.10:8000/api/mesas');
        if (!response.ok) {
          throw new Error('Error al obtener las mesas');
        }
        const data = await response.json();
        const mappedMesas = data.map(mesa => ({
          id: mesa.id,
          disponible: mesa.isActive
        }));
        setMesas(mappedMesas);
      } catch (error) {
        console.error('Error al obtener las mesas:', error);
      }
    };
    fetchMesas();
  }, []);

  const ocuparMesa = async (id) => {
    try {
      const response = await fetch(`http://192.168.1.10:8000/api/mesas/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: false })
      });
      if (!response.ok) {
        throw new Error('Error al ocupar la mesa');
      }
      setMesas(mesas.map(mesa => mesa.id === id ? { ...mesa, disponible: false } : mesa));
      console.log(`Has ocupado la mesa ${id}`);
      onSelectTable(id); // Llama a la función onSelectTable con el número de la mesa seleccionada
    } catch (error) {
      console.error('Error al ocupar la mesa:', error);
    }
  };

  const desocuparMesa = async (id) => {
    try {
      const response = await fetch(`http://192.168.1.10:8000/api/mesas/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: true })
      });
      if (!response.ok) {
        throw new Error('Error al desocupar la mesa');
      }
      setMesas(mesas.map(mesa => mesa.id === id ? { ...mesa, disponible: true } : mesa));
      console.log(`Has desocupado la mesa ${id}`);
    } catch (error) {
      console.error('Error al desocupar la mesa:', error);
    }
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', padding: 10}}>
      {mesas.map(mesa => (
        <View key={mesa.id} style={{ margin:5, flexDirection: 'column', alignItems: 'center' }}>
          <Button
            title={`Mesa ${mesa.id}`}
            onPress={() => {
              if (mesa.disponible) {
                ocuparMesa(mesa.id);
              } else {
                desocuparMesa(mesa.id);
              }
            }}
            disabled={!mesa.disponible}
            color={mesa.disponible ? 'green' : 'red'}
          />
          <MaterialCommunityIcons name="table-restaurant" size={30} color={mesa.disponible ? 'green' : 'red'} />
        </View>
      ))}
    </View>
  );
};

export default Selectable;
