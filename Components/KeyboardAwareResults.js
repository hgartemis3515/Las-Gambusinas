import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';

/**
 * Buscador/filtros fijos. La lista usa maxHeight numérico (no flex:1)
 * para no colapsar a 0 cuando abre el teclado en un Modal.
 */
export default function KeyboardAwareResults({
  search,
  filters,
  children,
  listRef,
  listMaxHeight = 320,
  onScroll,
  onContentSizeChange,
  onLayout,
  contentContainerStyle,
}) {
  return (
    <View style={styles.wrap}>
      {search ? <View style={styles.chrome}>{search}</View> : null}
      {filters ? <View style={styles.chrome}>{filters}</View> : null}
      <ScrollView
        ref={listRef}
        style={[styles.list, { maxHeight: listMaxHeight }]}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 0, flexShrink: 0 },
  chrome: { flexGrow: 0, flexShrink: 0 },
  list: { flexGrow: 0 },
});
