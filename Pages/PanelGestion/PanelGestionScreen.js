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
    const styles = useMemo(() => buildStyles(theme), [theme]);

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
        const accentPendiente = theme.colors.warning;
        const mutedIcon = theme.colors.text.light;
        return (
            <View
                style={[
                    styles.card,
                    { borderColor: pendiente ? accentPendiente : theme.colors.border },
                ]}
            >
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons
                        name="food"
                        size={20}
                        color={pendiente ? accentPendiente : mutedIcon}
                    />
                    <Text style={styles.cardTitle}>
                        {item.platoNombre || 'Plato'} {item.cantidad > 1 ? `×${item.cantidad}` : ''}
                    </Text>
                    <Text style={[styles.badge, { color: pendiente ? accentPendiente : mutedIcon }]}>
                        #{item.numeroColaActual ?? '-'} · {item.cocineroAlias || 'cocinero'}
                    </Text>
                </View>
                <Text style={styles.cardSub}>
                    Solicitante: {item.solicitadoPor?.nombre || '-'} ({item.solicitadoPor?.rol || '-'})
                </Text>
                {item.motivo ? (
                    <Text style={styles.cardSub}>Motivo: {item.motivo}</Text>
                ) : null}
                <Text style={styles.cardSub}>
                    Estado: <Text style={styles.cardEstado}>{item.estado}</Text>
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
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Panel</Text>
                    <Text style={styles.subtitle}>
                        Solicitudes y gestión {connected ? '· en vivo' : '· sincronizando…'}
                    </Text>
                </View>
                <View
                    style={[
                        styles.liveDot,
                        { backgroundColor: connected ? theme.colors.secondary : theme.colors.warning },
                    ]}
                />
            </View>

            {bannerNueva ? (
                <View style={styles.banner}>
                    <MaterialCommunityIcons name="bell-ring" size={18} color="#1a1a1a" />
                    <Text style={styles.bannerText} numberOfLines={2}>{bannerNueva}</Text>
                </View>
            ) : null}

            <View style={styles.resumenRow}>
                <View style={[styles.resumenCard, { borderColor: theme.colors.warning }]}>
                    <Text style={[styles.resumenNum, { color: theme.colors.warning }]}>{resumen.pendientes}</Text>
                    <Text style={styles.resumenLabel}>Pendientes</Text>
                </View>
                <View style={[styles.resumenCard, { borderColor: theme.colors.secondary }]}>
                    <Text style={[styles.resumenNum, { color: theme.colors.secondary }]}>{resumen.aprobadas}</Text>
                    <Text style={styles.resumenLabel}>Aprobadas</Text>
                </View>
                <View style={[styles.resumenCard, { borderColor: theme.colors.primary }]}>
                    <Text style={[styles.resumenNum, { color: theme.colors.primary }]}>{resumen.rechazadas}</Text>
                    <Text style={styles.resumenLabel}>Rechazadas</Text>
                </View>
            </View>

            <FlatList
                data={solicitudes}
                keyExtractor={(i) => String(i._id)}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={() => fetchSolicitudes(false)}
                        tintColor={theme.colors.primary}
                        colors={[theme.colors.primary]}
                        progressBackgroundColor={theme.colors.surface}
                    />
                }
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {loading
                            ? 'Cargando...'
                            : 'No hay solicitudes. Las de supervisores aparecerán aquí automáticamente.'}
                    </Text>
                }
            />
        </SafeAreaView>
    );
};

const buildStyles = (theme) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.md,
            paddingTop: 10,
            paddingBottom: theme.spacing.sm,
        },
        title: {
            fontSize: 22,
            fontWeight: 'bold',
            color: theme.colors.text.primary,
        },
        subtitle: {
            fontSize: 12,
            marginTop: 2,
            color: theme.colors.text.secondary,
        },
        liveDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            marginLeft: theme.spacing.sm,
        },
        banner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.sm,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.warning,
        },
        bannerText: {
            flex: 1,
            color: '#1a1a1a',
            fontWeight: '600',
            fontSize: 13,
        },
        resumenRow: {
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.sm,
        },
        resumenCard: {
            flex: 1,
            borderWidth: 1,
            borderRadius: theme.borderRadius.sm,
            paddingVertical: 10,
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            ...theme.shadows.small,
        },
        resumenNum: { fontSize: 18, fontWeight: 'bold' },
        resumenLabel: {
            fontSize: 10,
            marginTop: 2,
            color: theme.colors.text.secondary,
        },
        list: {
            padding: theme.spacing.md,
            gap: 12,
            paddingBottom: 24,
        },
        card: {
            borderRadius: theme.borderRadius.md,
            padding: 14,
            borderWidth: 1,
            gap: 4,
            backgroundColor: theme.colors.surface,
            ...theme.shadows.small,
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        cardTitle: {
            flex: 1,
            fontSize: 15,
            fontWeight: 'bold',
            color: theme.colors.text.primary,
        },
        badge: { fontSize: 12, fontWeight: 'bold' },
        cardSub: {
            fontSize: 12,
            color: theme.colors.text.secondary,
        },
        cardEstado: {
            fontWeight: 'bold',
            color: theme.colors.text.primary,
        },
        actions: {
            flexDirection: 'row',
            gap: 10,
            marginTop: theme.spacing.sm,
        },
        btn: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: theme.borderRadius.sm,
            alignItems: 'center',
        },
        btnAprobar: { backgroundColor: theme.colors.secondary },
        btnRechazar: { backgroundColor: theme.colors.primary },
        btnText: {
            color: theme.colors.text.white,
            fontWeight: 'bold',
        },
        empty: {
            textAlign: 'center',
            marginTop: 40,
            fontSize: 14,
            paddingHorizontal: 24,
            color: theme.colors.text.secondary,
        },
    });

export default PanelGestionScreen;
