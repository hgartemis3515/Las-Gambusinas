import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "../../config/axiosConfig";
import { apiConfig } from "../../apiConfig";
import { useTheme } from "../../context/ThemeContext";
import { themeLight } from "../../constants/theme";

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function isoDateToInput(iso) {
  if (!iso) return "";
  const s = String(iso);
  if (s.length >= 10) return s.slice(0, 10);
  return "";
}

/** Acepta respuesta PUT antigua (array de mozos) o nueva (un mozo); evita falsos errores en la app */
function normalizeMozoFromPutResponse(data, mozoId) {
  if (data == null) return null;
  let parsed = data;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.find((m) => m && String(m._id) === String(mozoId)) || null;
  }
  if (typeof parsed !== "object") return null;
  if (parsed.error && !parsed._id) return null;
  if (parsed._id || Object.prototype.hasOwnProperty.call(parsed, "name")) return parsed;
  return null;
}

async function buildCompressedProfilePhotoDataUrl(localUri) {
  const manip = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 512 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  if (!manip.base64) return null;
  return `data:image/jpeg;base64,${manip.base64}`;
}

function splitNameForForm(profile) {
  if (profile?.nombres || profile?.apellidos) {
    return {
      nombres: String(profile.nombres || "").trim(),
      apellidos: String(profile.apellidos || "").trim(),
    };
  }
  const full = String(profile?.name || "").trim();
  if (!full) return { nombres: "", apellidos: "" };
  const parts = full.split(/\s+/);
  if (parts.length === 1) return { nombres: parts[0], apellidos: "" };
  return { nombres: parts[0], apellidos: parts.slice(1).join(" ") };
}

const ProfileScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [genero, setGenero] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [contactoEmergenciaNombre, setContactoEmergenciaNombre] = useState("");
  const [contactoEmergenciaTelefono, setContactoEmergenciaTelefono] = useState("");
  /** Data URL nueva imagen pendiente de guardar, o null */
  const [fotoPendingDataUrl, setFotoPendingDataUrl] = useState(null);
  /** true si el usuario quitó la foto (guardar envía fotoUrl: '') */
  const [fotoCleared, setFotoCleared] = useState(false);

  const applyProfileToForm = useCallback((p) => {
    const { nombres: n, apellidos: a } = splitNameForForm(p || {});
    setNombres(n);
    setApellidos(a);
    const tel = p?.phoneNumber != null ? String(p.phoneNumber) : "";
    setPhoneNumber(tel);
    setEmail(String(p?.email || "").trim());
    setDireccion(String(p?.direccion || "").trim());
    setGenero(String(p?.genero || "").trim());
    setFechaNacimiento(isoDateToInput(p?.fechaNacimiento));
    setContactoEmergenciaNombre(String(p?.contactoEmergenciaNombre || "").trim());
    setContactoEmergenciaTelefono(String(p?.contactoEmergenciaTelefono || "").trim());
    setFotoPendingDataUrl(null);
    setFotoCleared(false);
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userJson, token] = await Promise.all([
        AsyncStorage.getItem("user"),
        AsyncStorage.getItem("authToken"),
      ]);
      const local = userJson ? JSON.parse(userJson) : null;
      if (!local?._id) {
        setProfile(null);
        setError("No hay sesión de usuario.");
        setLoading(false);
        return;
      }

      if (!token || !apiConfig.isConfigured) {
        const merged = { ...local, _fuente: "local" };
        setProfile(merged);
        applyProfileToForm(merged);
        setLoading(false);
        return;
      }

      const url = apiConfig.getEndpoint(`/mozos/${local._id}`);
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const merged = { ...data, _fuente: "servidor" };
      setProfile(merged);
      applyProfileToForm(merged);
    } catch (e) {
      const userJson = await AsyncStorage.getItem("user");
      const local = userJson ? JSON.parse(userJson) : null;
      if (local) {
        const merged = { ...local, _fuente: "local" };
        setProfile(merged);
        applyProfileToForm(merged);
        setError(
          e?.response?.status === 403 || e?.response?.status === 401
            ? "Sin permiso para ver el perfil completo en el servidor."
            : "No se pudo sincronizar con el servidor. Mostrando datos locales."
        );
      } else {
        setError(e?.message || "Error al cargar el perfil.");
      }
    } finally {
      setLoading(false);
    }
  }, [applyProfileToForm]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const persistSessionUser = async (updatedMozo) => {
    const userJson = await AsyncStorage.getItem("user");
    const prev = userJson ? JSON.parse(userJson) : {};
    const next = {
      ...prev,
      _id: updatedMozo._id || prev._id,
      name: updatedMozo.name || prev.name,
      rol: updatedMozo.rol != null ? updatedMozo.rol : prev.rol,
      permisos: Array.isArray(updatedMozo.permisos) ? updatedMozo.permisos : prev.permisos,
    };
    if (Object.prototype.hasOwnProperty.call(updatedMozo, "fotoUrl")) {
      next.fotoUrl = updatedMozo.fotoUrl || "";
    }
    await AsyncStorage.setItem("user", JSON.stringify(next));
  };

  const handleSave = async () => {
    const n = nombres.trim();
    const a = apellidos.trim();
    if (!n) {
      Alert.alert("Datos incompletos", "El nombre es obligatorio.");
      return;
    }
    if (!a) {
      Alert.alert("Datos incompletos", "Los apellidos son obligatorios.");
      return;
    }
    const telDigits = digitsOnly(phoneNumber);
    if (!telDigits) {
      Alert.alert("Datos incompletos", "Ingresa un número de teléfono válido.");
      return;
    }
    const token = await AsyncStorage.getItem("authToken");
    if (!token || !apiConfig.isConfigured) {
      Alert.alert(
        "Sin conexión al servidor",
        "Configura el servidor en Ajustes e inicia sesión para guardar cambios."
      );
      return;
    }
    const mozoId = profile?._id;
    if (!mozoId) {
      Alert.alert("Error", "No se identificó tu usuario.");
      return;
    }

    const body = {
      nombres: n,
      apellidos: a,
      phoneNumber: parseInt(telDigits, 10) || 0,
      email: email.trim(),
      direccion: direccion.trim(),
      genero: genero.trim(),
      fechaNacimiento: fechaNacimiento.trim() || null,
      contactoEmergenciaNombre: contactoEmergenciaNombre.trim(),
      contactoEmergenciaTelefono: digitsOnly(contactoEmergenciaTelefono),
    };
    if (fotoPendingDataUrl) {
      body.fotoUrl = fotoPendingDataUrl;
    } else if (fotoCleared) {
      body.fotoUrl = "";
    }

    const payloadRoughLen = JSON.stringify(body).length;
    const putTimeout = payloadRoughLen > 12000 ? 120000 : 25000;

    setSaving(true);
    setError(null);
    try {
      const url = apiConfig.getEndpoint(`/mozos/${mozoId}`);
      const authHeaders = { Authorization: `Bearer ${token}` };
      const { data } = await axios.put(url, body, {
        headers: authHeaders,
        timeout: putTimeout,
      });
      let updated = normalizeMozoFromPutResponse(data, mozoId);
      if (!updated) {
        const { data: fresh } = await axios.get(url, {
          headers: authHeaders,
          timeout: 15000,
        });
        updated = normalizeMozoFromPutResponse(fresh, mozoId);
      }
      if (!updated) {
        throw new Error("No se pudo leer el perfil actualizado. Vuelve a abrir esta pantalla.");
      }
      const merged = { ...updated, _fuente: "servidor" };
      setProfile(merged);
      applyProfileToForm(merged);
      await persistSessionUser(merged);
      setEditing(false);
      Alert.alert("Guardado", "Tu perfil se actualizó correctamente.");
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "No se pudo guardar. Revisa la conexión o vuelve a iniciar sesión.";
      setError(msg);
      Alert.alert("Error al guardar", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    applyProfileToForm(profile);
    setEditing(false);
    setError(null);
  };

  const pickProfilePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permiso necesario", "Activa el acceso a fotos para elegir una imagen de perfil.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const dataUrl = await buildCompressedProfilePhotoDataUrl(result.assets[0].uri);
      if (!dataUrl) {
        Alert.alert("Error", "No se pudo procesar la imagen.");
        return;
      }
      if (dataUrl.length > 900000) {
        Alert.alert("Imagen demasiado grande", "Elige una foto más pequeña o con menos detalle.");
        return;
      }
      setFotoPendingDataUrl(dataUrl);
      setFotoCleared(false);
    } catch (e) {
      Alert.alert("Error", e?.message || "No se pudo abrir la galería.");
    }
  };

  const clearProfilePhoto = () => {
    setFotoPendingDataUrl(null);
    setFotoCleared(true);
  };

  const displayFotoUri =
    fotoPendingDataUrl ||
    (!fotoCleared && profile?.fotoUrl ? String(profile.fotoUrl).trim() : "");

  const styles = useMemo(() => buildStyles(theme), [theme]);

  const readOnlyRows = profile
    ? [
        { label: "Rol", value: profile.rol || "—" },
        { label: "DNI / acceso", value: String(profile.DNI ?? profile.dni ?? "—") },
      ]
    : [];

  const canEditRemote = !!(apiConfig.isConfigured && profile?._id);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi perfil</Text>
        {!loading && profile && !editing ? (
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={styles.headerAction}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={!canEditRemote}
          >
            <MaterialCommunityIcons
              name="pencil"
              size={22}
              color={canEditRemote ? theme.colors.primary : theme.colors.text.light}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <View style={styles.banner}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={20}
                  color={theme.colors.warning}
                  style={styles.bannerIcon}
                />
                <Text style={styles.bannerText}>{error}</Text>
              </View>
            ) : null}

            {profile ? (
              <>
                {editing ? (
                  <>
                    <Text style={styles.fieldLabel}>Foto de perfil</Text>
                    <View style={styles.photoRow}>
                      <View style={styles.photoFrame}>
                        {displayFotoUri ? (
                          <Image source={{ uri: displayFotoUri }} style={styles.photoImage} />
                        ) : (
                          <MaterialCommunityIcons name="account" size={56} color={theme.colors.text.light} />
                        )}
                      </View>
                      <View style={styles.photoActions}>
                        <TouchableOpacity style={styles.photoBtn} onPress={pickProfilePhoto} activeOpacity={0.8}>
                          <MaterialCommunityIcons name="image-plus" size={20} color={theme.colors.primary} />
                          <Text style={styles.photoBtnText}>Elegir foto</Text>
                        </TouchableOpacity>
                        {displayFotoUri ? (
                          <TouchableOpacity
                            style={[styles.photoBtn, styles.photoBtnSecond]}
                            onPress={clearProfilePhoto}
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.warning} />
                            <Text style={[styles.photoBtnText, { color: theme.colors.warning }]}>Quitar foto</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.hint}>La foto se guarda en el servidor (como en el panel de usuarios).</Text>

                    <Text style={styles.fieldLabel}>Nombres</Text>
                    <TextInput
                      style={styles.input}
                      value={nombres}
                      onChangeText={setNombres}
                      placeholder="Ej. María"
                      placeholderTextColor={theme.colors.text.light}
                      autoCapitalize="words"
                    />
                    <Text style={styles.fieldLabel}>Apellidos</Text>
                    <TextInput
                      style={styles.input}
                      value={apellidos}
                      onChangeText={setApellidos}
                      placeholder="Ej. García López"
                      placeholderTextColor={theme.colors.text.light}
                      autoCapitalize="words"
                    />
                    <Text style={styles.fieldLabel}>Teléfono</Text>
                    <TextInput
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="987654321"
                      placeholderTextColor={theme.colors.text.light}
                      keyboardType="phone-pad"
                    />
                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="correo@ejemplo.com"
                      placeholderTextColor={theme.colors.text.light}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Text style={styles.fieldLabel}>Dirección</Text>
                    <TextInput
                      style={styles.input}
                      value={direccion}
                      onChangeText={setDireccion}
                      placeholder="Opcional"
                      placeholderTextColor={theme.colors.text.light}
                    />
                    <Text style={styles.fieldLabel}>Género</Text>
                    <TextInput
                      style={styles.input}
                      value={genero}
                      onChangeText={setGenero}
                      placeholder="Opcional"
                      placeholderTextColor={theme.colors.text.light}
                    />
                    <Text style={styles.fieldLabel}>Fecha de nacimiento</Text>
                    <TextInput
                      style={styles.input}
                      value={fechaNacimiento}
                      onChangeText={setFechaNacimiento}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={theme.colors.text.light}
                    />
                    <Text style={styles.fieldLabel}>Contacto de emergencia (nombre)</Text>
                    <TextInput
                      style={styles.input}
                      value={contactoEmergenciaNombre}
                      onChangeText={setContactoEmergenciaNombre}
                      placeholder="Opcional"
                      placeholderTextColor={theme.colors.text.light}
                    />
                    <Text style={styles.fieldLabel}>Contacto de emergencia (teléfono)</Text>
                    <TextInput
                      style={styles.input}
                      value={contactoEmergenciaTelefono}
                      onChangeText={setContactoEmergenciaTelefono}
                      placeholder="Opcional"
                      placeholderTextColor={theme.colors.text.light}
                      keyboardType="phone-pad"
                    />
                    <Text style={styles.hint}>
                      El DNI (contraseña de acceso) solo lo puede cambiar un administrador en el panel web.
                    </Text>
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={[styles.btnSecondary, saving && styles.btnDisabled]}
                        onPress={handleCancelEdit}
                        disabled={saving}
                      >
                        <Text style={styles.btnSecondaryText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnPrimary, styles.btnPrimarySpaced, saving && styles.btnDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator color={theme.colors.text.white} />
                        ) : (
                          <Text style={styles.btnPrimaryText}>Guardar</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.photoReadonlyWrap}>
                      <View style={styles.photoFrameLarge}>
                        {profile.fotoUrl && String(profile.fotoUrl).trim() ? (
                          <Image source={{ uri: String(profile.fotoUrl).trim() }} style={styles.photoImage} />
                        ) : (
                          <MaterialCommunityIcons name="account" size={64} color={theme.colors.primary} />
                        )}
                      </View>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Nombre completo</Text>
                      <Text style={styles.rowValue}>
                        {profile.name || `${nombres} ${apellidos}`.trim() || "—"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Teléfono</Text>
                      <Text style={styles.rowValue}>
                        {profile.phoneNumber != null ? String(profile.phoneNumber) : "—"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Email</Text>
                      <Text style={styles.rowValue}>{profile.email || "—"}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Dirección</Text>
                      <Text style={styles.rowValue}>{profile.direccion || "—"}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Fecha de nacimiento</Text>
                      <Text style={styles.rowValue}>
                        {isoDateToInput(profile.fechaNacimiento) || "—"}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Género</Text>
                      <Text style={styles.rowValue}>{profile.genero || "—"}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Emergencia</Text>
                      <Text style={styles.rowValue}>
                        {[profile.contactoEmergenciaNombre, profile.contactoEmergenciaTelefono]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Text>
                    </View>
                  </>
                )}

                {readOnlyRows.map((row) => (
                  <View key={row.label} style={styles.rowMuted}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowValueMuted}>{row.value}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const buildStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    flex1: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    headerAction: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-end" },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text.primary,
    },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 },
    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
    },
    bannerIcon: { marginRight: theme.spacing.sm, marginTop: 2 },
    bannerText: {
      flex: 1,
      color: theme.colors.text.secondary,
      fontSize: 14,
    },
    row: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.small,
    },
    rowMuted: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      opacity: 0.92,
    },
    rowLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 4,
    },
    rowValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
    },
    rowValueMuted: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.text.secondary,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text.secondary,
      marginBottom: 6,
      marginTop: theme.spacing.sm,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
      fontSize: 16,
      color: theme.colors.text.primary,
    },
    hint: {
      marginTop: theme.spacing.md,
      fontSize: 13,
      color: theme.colors.text.secondary,
      lineHeight: 18,
    },
    editActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: theme.spacing.lg,
    },
    btnPrimarySpaced: { marginLeft: 12 },
    btnPrimary: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: theme.borderRadius.md,
      minWidth: 120,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimaryText: {
      color: theme.colors.text.white,
      fontWeight: "700",
      fontSize: 16,
    },
    btnSecondary: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
    },
    btnSecondaryText: {
      color: theme.colors.text.primary,
      fontWeight: "600",
      fontSize: 16,
    },
    btnDisabled: { opacity: 0.6 },
    photoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    photoFrame: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    photoFrameLarge: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.small,
    },
    photoReadonlyWrap: {
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    photoImage: { width: "100%", height: "100%" },
    photoActions: { flex: 1, marginLeft: theme.spacing.md },
    photoBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
    },
    photoBtnSecond: { marginTop: 4 },
    photoBtnText: {
      marginLeft: 8,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  });

export default ProfileScreen;
