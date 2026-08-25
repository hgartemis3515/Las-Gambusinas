import { useEffect, useState } from 'react';
import { Keyboard, Platform, Dimensions } from 'react-native';

const MIN_LIST = 160;
const CHROME_DEFAULT = 270;

function windowH() {
  return Dimensions.get('window').height;
}

/** Inset del teclado, nunca más grande que lo que dejaría MIN_LIST px para la lista. */
export default function useKeyboardInset({ mode = 'modal', chrome = CHROME_DEFAULT } = {}) {
  const [inset, setInset] = useState(0);
  const [winH, setWinH] = useState(windowH);

  useEffect(() => {
    const onDim = ({ window }) => setWinH(window.height);
    const dimSub = Dimensions.addEventListener('change', onDim);

    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      const h = windowH();
      setWinH(h);
      const kbH = e?.endCoordinates?.height ?? 0;
      const maxInset = Math.max(0, h - chrome - MIN_LIST);
      let next = Math.min(kbH, h * 0.5, maxInset);

      // Android pantalla: adjustResize ya encogió la ventana
      if (mode === 'screen' && Platform.OS === 'android') next = 0;

      setInset(next);
    };

    const onHide = () => {
      setInset(0);
      setWinH(windowH());
    };

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      dimSub?.remove?.();
      subShow.remove();
      subHide.remove();
    };
  }, [mode, chrome]);

  const listMaxHeight = Math.max(MIN_LIST, Math.min(500, winH - inset - chrome));

  return { inset, visible: inset > 0, windowHeight: winH, listMaxHeight };
}
