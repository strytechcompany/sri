// BillPreviewPlaceholderScreen.js
// This screen acts as a redirect — it immediately navigates to the real
// BillPreviewScreen (registered as "BillPreviewPlaceholder" in AppNavigator).
// TransactionManagementScreen already navigates here with { transactionId, type }.
// BillPreviewScreen accepts exactly those params, so we just pass them through.
import { useEffect } from 'react';

export default function BillPreviewPlaceholderScreen({ navigation, route }) {
  const { transactionId, type } = route.params || {};

  useEffect(() => {
    // Replace this screen with the real bill preview immediately
    navigation.replace('BillPreview', { transactionId, type });
  }, []);

  return null;
}
