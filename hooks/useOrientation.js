import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

export const useOrientation = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const isLandscape = dimensions.width > dimensions.height;
  const isTablet = Math.min(dimensions.width, dimensions.height) >= 600;

  return {
    width: dimensions.width,
    height: dimensions.height,
    isLandscape,
    isPortrait: !isLandscape,
    isTablet,
  };
};

