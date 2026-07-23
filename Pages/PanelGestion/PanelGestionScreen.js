/**
 * PanelGestionScreen
 *
 * Tab "Panel" — solicitudes de gestión (Solicitar Orden desde cocina).
 * Tiempo real: Socket.io + polling mientras el tab está enfocado.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    StyleSheet,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { themeLight } from '../../constants/theme';
import { apiConfig } from '../../apiConfig';

const POLL_MS = 2500;

const PanelGestionScreen = () => {
    const themeContext = useTheme();
    const theme = themeContext?.theme || themeLight;
    const socketCtx = useSocket();
    const socket = socketCtx?.socket;
    const connected = !!socketCtx?.connected;

    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bannerNueva, setBannerNueva] = useState(null);
    const [focused, setFocused] = useState(true);

    const fetchRef = useRef(null);
    const idsVistosRef = useRef(new Set());
    const bannerTimerRef = useRef(null);

    const getToken = useCallback(async () => {
        try {
            return await AsyncStorage.getItem('authToken');
        } catch (_) {
            return null;
        }
    }, []);

    const apiBase = useCallback(() => {
        if (apiConfig.isConfigured) {
            return apiConfig.getEndpoint('/solicitudes-gestion');
        }
        return `${apiConfig.baseURL || 'http://localhost:3000/api'}/solicitudes-gestion`;
    }, []);

    const mergeSolicitudes = useCallback((lista) => {
        if (!Array.isArray(lista)) return;
        setSolicitudes((prev) => {
            const map = new Map(prev.map((s) => [String(s._id), s]));
            let hayNuevaPendiente = null;
            for (const s of lista) {
                if (!s?._id) continue;
                const id = String(s._id);
                const existed = map.has(id);
                map.set(id, { ...(map.get(id) || {}), ...s });
                if (!existed && s.estado === 'pendiente' && !idsVistosRef.current.has(id)) {
                    hayNuevaPendiente = s;
                }
                idsVistosRef.current.add(id);
            }
            if (hayNuevaPendiente) {
                setBannerNueva(
                    `Nueva solicitud: ${hayNuevaPendiente.platoNombre || 'plato'} (#${hayNuevaPendiente.numeroColaActual ?? '-'} · ${hayNuevaPendiente.cocineroAlias || 'cocinero'})`
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
                bannerTimerRef.current = setTimeout(() => setBannerNueva(null), 5000);
            }
            return Array.from(map.values()).sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );
        });
    }, []);

    const fetchSolicitudes = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${apiBase()}?estado=todas`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data?.success) {
                const lista = data.solicitudes || [];
                // Primera carga: marcar ids sin banner
                if (idsVistosRef.current.size === 0) {
                    lista.forEach((s) => s?._id && idsVistosRef.current.add(String(s._id)));
                    setSolicitudes(lista);
                } else {
                    mergeSolicitudes(lista);
                }
            }
        } catch (e) {
            console.warn('[PanelGestion] error fetch', e.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [getToken, apiBase, mergeSolicitudes]);

    fetchRef.current = fetchSolicitudes;

    // Carga inicial
    useEffect(() => {
        fetchSolicitudes(false);
        return () => {
            if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        };
    }, [fetchSolicitudes]);

    // Focus: refetch + flag para polling
    useFocusEffect(
        useCallback(() => {
            setFocused(true);
            fetchRef.current?.(true);
            return () => setFocused(false);
        }, [])
    );

    // Polling mientras el Panel está enfocado (garantiza actualización aunque falle el socket)
    useEffect(() => {
        if (!focused) return undefined;
        const id = setInterval(() => {
            fetchRef.current?.(true);
        }, POLL_MS);
        return () => clearInterval(id);
    }, [focused]);

    // Socket en tiempo real
    useEffect(() => {
        if (!socket) return undefined;

        const onNueva = (payload) => {
            const s = payload?.solicitud || payload;
            console.log('[PanelGestion] socket solicitud-gestion-nueva', s?._id);
            if (s?._id) {
                mergeSolicitudes([s]);
            } else {
                fetchRef.current?.(true);
            }
        };

        const onActualizada = (payload) => {
            const s = payload?.solicitud || payload;
            console.log('[PanelGestion] socket solicitud-gestion-actualizada', s?._id, s?.estado);
            if (s?._id) {
                mergeSolicitudes([s]);
            } else {
                fetchRef.current?.(true);
            }
        };

        const onConnect = () => fetchRef.current?.(true);

        socket.on('solicitud-gestion-nueva', onNueva);
        socket.on('solicitud-gestion-actualizada', onActualizada);
        socket.on('connect', onConnect);

        return () => {
            socket.off('solicitud-gestion-nueva', onNueva);
            socket.off('solicitud-gestion-actualizada', onActualizada);
            socket.off('connect', onConnect);
        };
    }, [socket, mergeSolicitudes]);

    // Al reconectar, refrescar
    useEffect(() => {
        if (connected) fetchRef.current?.(true);
    }, [connected]);

    const resumen = useMemo(() => {
        const pendientes = solicitudes.filter((s) => s.estado === 'pendiente').length;
        const aprobadas = solicitudes.filter((s) => s.estado === 'aprobada').length;
        const rechazadas = solicitudes.filter((s) => s.estado === 'rechazada').length;
        return { pendientes, aprobadas, rechazadas };
    }, [solicitudes]);

    const resolver = useCallback(async (solicitud, aprobar) => {
        try {
            const token = await getToken();
            const endpoint = aprobar ? 'aprobar' : 'rechazar';
            const res = await fetch(`${apiBase()}/${solicitud._id}/${endpoint}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            const data = await res.json();
            if (data?.success) {
                if (data.solicitud) mergeSolicitudes([data.solicitud]);
                Alert.alert(
                    aprobar ? 'Solicitud aprobada' : 'Solicitud rechazada',
                    aprobar
                        ? 'Se habilitó finalizar ese plato en cocina.'
                        : 'Se notificó al solicitante.'
                );
                // Refresco inmediato por si el socket no llega al KDS aún
                fetchRef.current?.(true);
            } else {
                Alert.alert('Error', data?.error || 'No se pudo resolver la solicitud');
            }
        } catch (e) {
            Alert.alert('Error de conexión', e.message);
        }
    }, [getToken, apiBase, mergeSolicitudes]);

    const renderItem = ({ item }) => {
        const pendiente = item.estado === 'pendiente';
        return (
            <View style={[styles.card, { backgroundColor: theme.card || '#1f1f29', borderColor: pendiente ? '#d4af37' : '#333' }]}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="food" size={20} color={pendiente ? '#d4af37' : '#888'} />
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {item.platoNombre || 'Plato'} {item.cantidad > 1 ? `×${item.cantidad}` : ''}
                    </Text>
                    <Text style={[styles.badge, { color: pendiente ? '#d4af37' : '#888' }]}>
                        #{item.numeroColaActual ?? '-'} · {item.cocineroAlias || 'cocinero'}
                    </Text>
                </View>
                <Text style={[styles.cardSub, { color: theme.muted || '#aaa' }]}>
                    Solicitante: {item.solicitadoPor?.nombre || '-'} ({item.solicitadoPor?.rol || '-'})
                </Text>
                {item.motivo ? (
                    <Text style={[styles.cardSub, { color: theme.muted || '#aaa' }]}>Motivo: {item.motivo}</Text>
                ) : null}
                <Text style={[styles.cardSub, { color: theme.muted || '#aaa' }]}>
                    Estado: <Text style={{ fontWeight: 'bold' }}>{item.estado}</Text>
                </Text>

                {pendiente && (
                    <View style={styles.actions}>
                        <TouchableOpacity style={[styles.btn, styles.btnAprobar]} onPress={() => resolver(item, true)}>
                            <Text style={styles.btnText}>Aprobar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnRechazar]} onPress={() => resolver(item, false)}>
                            <Text style={styles.btnText}>Rechazar</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background || '#12121a' }]} edges={['top']}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.text }]}>Panel</Text>
                    <Text style={[styles.subtitle, { color: theme.muted || '#aaa' }]}>
                        Solicitudes y gestión {connected ? '· en vivo' : '· sincronizando…'}
                    </Text>
                </View>
                <View style={[styles.liveDot, { backgroundColor: connected ? '#16a34a' : '#f59e0b' }]} />
            </View>

            {bannerNueva ? (
                <View style={styles.banner}>
                    <MaterialCommunityIcons name="bell-ring" size={18} color="#1a1a1a" />
                    <Text style={styles.bannerText} numberOfLines={2}>{bannerNueva}</Text>
                </View>
            ) : null}

            <View style={styles.resumenRow}>
                <View style={[styles.resumenCard, { borderColor: '#d4af37' }]}>
                    <Text style={[styles.resumenNum, { color: '#d4af37' }]}>{resumen.pendientes}</Text>
                    <Text style={[styles.resumenLabel, { color: theme.muted || '#aaa' }]}>Pendientes</Text>
                </View>
                <View style={[styles.resumenCard, { borderColor: '#16a34a' }]}>
                    <Text style={[styles.resumenNum, { color: '#16a34a' }]}>{resumen.aprobadas}</Text>
                    <Text style={[styles.resumenLabel, { color: theme.muted || '#aaa' }]}>Aprobadas</Text>
                </View>
                <View style={[styles.resumenCard, { borderColor: '#dc2626' }]}>
                    <Text style={[styles.resumenNum, { color: '#dc2626' }]}>{resumen.rechazadas}</Text>
                    <Text style={[styles.resumenLabel, { color: theme.muted || '#aaa' }]}>Rechazadas</Text>
                </View>
            </View>

            <FlatList
                data={solicitudes}
                keyExtractor={(i) => String(i._id)}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchSolicitudes(false)} />}
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: theme.muted || '#aaa' }]}>
                        {loading
                            ? 'Cargando...'
                            : 'No hay solicitudes. Las de supervisores aparecerán aquí automáticamente.'}
                    </Text>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 8,
    },
    title: { fontSize: 22, fontWeight: 'bold' },
    subtitle: { fontSize: 12, marginTop: 2 },
    liveDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#d4af37',
    },
    bannerText: { flex: 1, color: '#1a1a1a', fontWeight: '600', fontSize: 13 },
    resumenRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    resumenCard: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    resumenNum: { fontSize: 18, fontWeight: 'bold' },
    resumenLabel: { fontSize: 10, marginTop: 2 },
    list: { padding: 16, gap: 12, paddingBottom: 24 },
    card: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 4 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: 'bold' },
    badge: { fontSize: 12, fontWeight: 'bold' },
    cardSub: { fontSize: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    btnAprobar: { backgroundColor: '#16a34a' },
    btnRechazar: { backgroundColor: '#dc2626' },
    btnText: { color: '#fff', fontWeight: 'bold' },
    empty: { textAlign: 'center', marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
});

export default PanelGestionScreen;
