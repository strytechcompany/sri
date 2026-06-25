import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useStock } from '../../context/StockContext';

const GOLD = '#D4AF37';
const DARK_BROWN = '#4B2E05';
const HEADER_BG = '#3D2200';
const BG = '#F8F4E8';

const CATEGORIES = ['Necklace', 'Bangle', 'Ring', 'Earring', 'Chain', 'Bracelet', 'Pendant', 'Coin'];
const PURITIES = ['18K (750)', '22K (916)', '24K (999)'];

function ChipGroup({ label, options, selected, onSelect }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, selected === opt && styles.chipSelected]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, selected === opt && styles.chipTextSelected]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#B09878"
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export default function AddStockScreen({ navigation, route }) {
  const { createStock, updateStock } = useStock();
  const editItem = route.params?.editItem ?? null;
  const isEdit = !!editItem;

  const insets = useSafeAreaInsets();
  const topPadding = insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44);

  const [saving, setSaving] = useState(false);

  // ─── Form State ───────────────────────────────────────────────────────────
  const [category, setCategory] = useState(editItem?.category ?? '');
  const [designName, setDesignName] = useState(editItem?.designName ?? '');
  const [itemName, setItemName] = useState(editItem?.itemName ?? '');
  const [supplierName, setSupplierName] = useState(editItem?.supplierName ?? '');
  const [grossWeight, setGrossWeight] = useState(editItem?.grossWeight?.toString() ?? '');
  const [netWeight, setNetWeight] = useState(editItem?.netWeight?.toString() ?? '');
  const [purity, setPurity] = useState(editItem?.purity ?? '');
  const [buyingTouch, setBuyingTouch] = useState(editItem?.buyingTouch?.toString() ?? '');
  const [quantity, setQuantity] = useState(editItem?.quantity?.toString() ?? '1');
  const [notes, setNotes] = useState(editItem?.notes ?? '');
  const [barcode, setBarcode] = useState(editItem?.barcode ?? '');
  const [printing, setPrinting] = useState(false);

  // ─── Gross Weight → auto-sync Net Weight ──────────────────────────────────
  const handleGrossWeightChange = (text) => {
    setGrossWeight(text);
    setNetWeight(text); // Net weight = Gross weight
  };

  // ─── Generate Barcode ─────────────────────────────────────────────────────
  const generateBarcode = () => {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    setBarcode(`SVJ${ts}${rand}`);
  };

  // ─── Print Barcode Label ───────────────────────────────────────────────────────────
  const printBarcode = async () => {
    if (!barcode) {
      Alert.alert('No Barcode', 'Please generate a barcode first.');
      return;
    }
    setPrinting(true);

    // Safety timeout: release spinner if print dialog never resolves
    const timeout = setTimeout(() => setPrinting(false), 30000);

    try {
      // Build SVG barcode stripes inline - no external fonts/network needed
      const buildBarcodeSvg = (code) => {
        const bars = [];
        const totalBars = code.length * 2 + 10;
        const barW = Math.max(1, Math.floor(160 / totalBars));
        let x = 0;
        bars.push(`<rect x="${x}" y="0" width="${barW}" height="22" fill="#000"/>`); x += barW;
        bars.push(`<rect x="${x}" y="0" width="${barW}" height="22" fill="#fff"/>`); x += barW;
        bars.push(`<rect x="${x}" y="0" width="${barW}" height="22" fill="#000"/>`); x += barW;
        bars.push(`<rect x="${x}" y="0" width="${barW}" height="22" fill="#fff"/>`); x += barW;
        for (let i = 0; i < code.length; i++) {
          const n = code.charCodeAt(i);
          for (let b = 0; b < 2; b++) {
            const fill = ((n >> (1 - b)) & 1) ? '#000' : '#fff';
            bars.push(`<rect x="${x}" y="0" width="${barW}" height="22" fill="${fill}"/>`);
            x += barW;
          }
        }
        bars.push(`<rect x="${x}" y="0" width="${barW}" height="22" fill="#000"/>`); x += barW;
        bars.push(`<rect x="${x}" y="0" width="${barW}" height="22" fill="#fff"/>`); x += barW;
        bars.push(`<rect x="${x}" y="0" width="${barW}" height="22" fill="#000"/>`); x += barW;
        const totalW = x + barW;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="22">${bars.join('')}</svg>`;
      };

      const svgContent = buildBarcodeSvg(barcode);
      const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;

      const labelHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: 50mm 28mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 50mm; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    .label { width: 50mm; padding: 2mm 1.5mm 1.5mm; display: flex; flex-direction: column; align-items: center; }
    .shop { font-size: 6pt; font-weight: 900; color: #4B2E05; letter-spacing: 0.5pt; text-transform: uppercase; border-bottom: 0.5pt solid #D4AF37; padding-bottom: 1.5pt; margin-bottom: 2pt; text-align: center; width: 100%; }
    .meta { font-size: 5pt; color: #555; font-weight: 700; margin-bottom: 3pt; text-align: center; }
    .barcode-img { width: 44mm; height: auto; display: block; }
    .num { font-size: 5.5pt; letter-spacing: 1pt; color: #222; font-family: 'Courier New', monospace; font-weight: 700; margin-top: 2pt; text-align: center; }
  </style>
</head>
<body>
  <div class="label">
    <div class="shop">SRI VAISHNAVI JEWELLERS</div>
    <div class="meta">${category || '-'} &bull; ${purity || '-'} &bull; ${grossWeight || '0'}g</div>
    <img class="barcode-img" src="${svgDataUri}" />
    <div class="num">${barcode}</div>
  </div>
</body>
</html>`;

      // Generate PDF file (avoids expo-print singleton lock from Print.printAsync)
      const { uri } = await Print.printToFileAsync({ html: labelHtml, base64: false });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Not Supported', 'Sharing/printing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Print Barcode Label',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      if (!err.message?.includes('cancel')) {
        Alert.alert('Print Failed', 'Could not generate the barcode label.');
      }
    } finally {
      clearTimeout(timeout);
      setPrinting(false);
    }
  };

  // ─── Validate & Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!designName.trim()) return Alert.alert('Validation', 'Design Name is required.');
    if (!category) return Alert.alert('Validation', 'Please select a Category.');
    if (!purity) return Alert.alert('Validation', 'Please select a Purity.');
    if (!grossWeight || isNaN(parseFloat(grossWeight)))
      return Alert.alert('Validation', 'Enter a valid Gross Weight.');
    if (!netWeight || isNaN(parseFloat(netWeight)))
      return Alert.alert('Validation', 'Enter a valid Net Weight.');
    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) < 1)
      return Alert.alert('Validation', 'Quantity must be at least 1.');

    setSaving(true);
    try {
      const payload = {
        designName: designName.trim(),
        itemName: itemName.trim(),
        supplierName: supplierName.trim(),
        category,
        purity,
        grossWeight: parseFloat(grossWeight),
        netWeight: parseFloat(netWeight),
        buyingTouch: parseFloat(buyingTouch) || 0,
        quantity: parseInt(quantity),
        notes: notes.trim(),
      };

      let result;
      if (isEdit) {
        result = await updateStock(editItem._id, payload);
      } else {
        result = await createStock(payload);
      }

      if (result.success) {
        Alert.alert('Success', isEdit ? 'Stock updated!' : 'Stock item added!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Something went wrong.');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />

      {/* ─── Header ─── */}
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={GOLD} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Stock Item' : 'Add New Stock'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Form ─── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Item Number (read-only if edit) */}
          {isEdit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Item Number</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText}>{editItem.itemNumber}</Text>
                <MaterialCommunityIcons name="shield-check" size={16} color={GOLD} />
              </View>
            </View>
          )}

          {!isEdit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Item Number</Text>
              <View style={styles.readonlyField}>
                <MaterialCommunityIcons name="auto-fix" size={16} color={GOLD} style={{ marginRight: 8 }} />
                <Text style={styles.readonlyText}>Auto-generated on save (SVJ-XXXXX)</Text>
              </View>
            </View>
          )}

          {/* Category */}
          <ChipGroup
            label="Category *"
            options={CATEGORIES}
            selected={category}
            onSelect={setCategory}
          />

          {/* Design Name */}
          <FormField
            label="Design Name *"
            value={designName}
            onChangeText={setDesignName}
            placeholder="e.g. THALI 01"
          />

          {/* Item Name */}
          <FormField
            label="Item Name"
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. THALI 01 (Printed on barcode)"
          />

          {/* Supplier Name */}
          <FormField
            label="Supplier Name"
            value={supplierName}
            onChangeText={setSupplierName}
            placeholder="e.g. Kumar Jewels"
          />

          {/* Weights Row — Net Weight auto-mirrors Gross Weight */}
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.fieldLabel}>Gross Weight (g) *</Text>
              <TextInput
                style={styles.input}
                value={grossWeight}
                onChangeText={handleGrossWeightChange}
                placeholder="0.000"
                placeholderTextColor="#B09878"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.fieldLabel}>Net Weight (g)</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText} numberOfLines={1}>
                  {netWeight || '0.000'}
                </Text>
                <MaterialCommunityIcons name="link" size={14} color={GOLD} />
              </View>
              <Text style={styles.autoNote}>Same as Gross Weight</Text>
            </View>
          </View>

          {/* Purity */}
          <ChipGroup
            label="Purity *"
            options={PURITIES}
            selected={purity}
            onSelect={setPurity}
          />

          {/* Buying Touch & Quantity Row */}
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.fieldLabel}>Buying Touch %</Text>
              <TextInput
                style={styles.input}
                value={buyingTouch}
                onChangeText={setBuyingTouch}
                placeholder="0.00"
                placeholderTextColor="#B09878"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.fieldLabel}>Quantity *</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                placeholderTextColor="#B09878"
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Barcode Section */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Barcode</Text>
            <TouchableOpacity
              style={styles.barcodeBtn}
              onPress={generateBarcode}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="barcode" size={20} color={HEADER_BG} />
              <Text style={styles.barcodeBtnText}>Generate Barcode</Text>
            </TouchableOpacity>

            {barcode ? (
              <>
                <View style={styles.barcodePreview}>
                  <MaterialCommunityIcons name="barcode-scan" size={20} color={GOLD} />
                  <Text style={styles.barcodeValue} numberOfLines={1}>{barcode}</Text>
                </View>

                {/* Print Button */}
                <TouchableOpacity
                  style={[styles.printBtn, printing && styles.saveBtnDisabled]}
                  onPress={printBarcode}
                  activeOpacity={0.85}
                  disabled={printing}
                >
                  {printing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="printer" size={18} color="#FFFFFF" />
                      <Text style={styles.printBtnText}>Print Barcode Label</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          {/* Notes */}
          <FormField
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional details..."
            multiline
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={HEADER_BG} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={isEdit ? 'content-save-edit' : 'content-save'}
                  size={20}
                  color={HEADER_BG}
                />
                <Text style={styles.saveBtnText}>
                  {isEdit ? 'Update Stock Item' : 'Save Stock Item'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: HEADER_BG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: {
    flex: 1,
    color: GOLD,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: DARK_BROWN,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: DARK_BROWN,
    borderWidth: 1.5,
    borderColor: '#E5D8C0',
    fontWeight: '500',
  },
  inputMultiline: {
    height: 100,
    paddingTop: 12,
  },
  readonlyField: {
    backgroundColor: '#F0E8D0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5D8C0',
  },
  readonlyText: {
    fontSize: 13,
    color: DARK_BROWN,
    fontWeight: '600',
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5D8C0',
  },
  chipSelected: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK_BROWN,
  },
  chipTextSelected: {
    color: HEADER_BG,
    fontWeight: '700',
  },
  rowFields: {
    flexDirection: 'row',
  },
  barcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    gap: 8,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  barcodeBtnText: {
    color: HEADER_BG,
    fontWeight: '700',
    fontSize: 14,
  },
  barcodePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HEADER_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    gap: 10,
  },
  barcodeValue: {
    color: GOLD,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    gap: 10,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: HEADER_BG,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  autoNote: {
    fontSize: 10,
    color: '#A08850',
    fontWeight: '600',
    marginTop: 5,
    fontStyle: 'italic',
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C6E49',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    marginTop: 10,
    gap: 8,
    shadowColor: '#2C6E49',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  printBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
