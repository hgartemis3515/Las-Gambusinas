import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

/**
 * Evita que un error de render cierre el proceso en release.
 * Muestra el mensaje para poder diagnosticar.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error?.message || error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error?.message || String(this.state.error);
    const stack = this.state.error?.stack || '';
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Error al abrir</Text>
        <Text style={styles.hint}>La app no se cerró. Copia este texto si sigue fallando.</Text>
        <ScrollView style={styles.scroll}>
          <Text selectable style={styles.msg}>{msg}</Text>
          {stack ? <Text selectable style={styles.stack}>{stack}</Text> : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: '#111',
    padding: 24,
    paddingTop: 56,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  hint: { color: '#F97316', fontSize: 13, marginBottom: 12 },
  scroll: { flex: 1 },
  msg: { color: '#FECACA', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  stack: { color: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' },
});
