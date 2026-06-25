import React, { createContext, useContext, useState, useCallback } from 'react';
import { stockAPI, inventoryAPI } from '../services/api';

const StockContext = createContext();

export const StockProvider = ({ children }) => {
  // --- SHOWROOM STOCK STATE ---
  const [stocks, setStocks] = useState([]);
  const [summary, setSummary] = useState({ totalDesigns: 0, totalQuantity: 0, totalNetWeight: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // --- RECEIVED INVENTORY STATE ---
  const [receivedInventory, setReceivedInventory] = useState([]);
  const [receivedSummary, setReceivedSummary] = useState({ totalEntries: 0, totalWeight: 0, totalPurity: 0, totalAmount: 0 });
  const [receivedPagination, setReceivedPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [receivedFilter, setReceivedFilter] = useState('All');

  // --- GLOBAL STATE ---
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ─── Fetch Showroom Stocks ────────────────────────────────────────────────────────
  const fetchStocks = useCallback(async (params = {}, reset = true) => {
    try {
      if (reset) setLoading(true);
      setError(null);

      const queryParams = {
        search: params.search ?? searchQuery,
        category: params.category ?? selectedCategory,
        page: reset ? 1 : pagination.page + 1,
        limit: 50,
      };

      const res = await stockAPI.getAll(queryParams);
      if (res.data.success) {
        if (reset) {
          setStocks(res.data.data);
        } else {
          setStocks((prev) => {
            const merged = [...prev];
            res.data.data.forEach((newGroup) => {
              const existing = merged.find((g) => g.designName.toUpperCase() === newGroup.designName.toUpperCase());
              if (existing) {
                existing.records = [...existing.records, ...newGroup.records];
                existing.totalQty += newGroup.totalQty;
                existing.totalNetWeight += newGroup.totalNetWeight;
              } else {
                merged.push(newGroup);
              }
            });
            return merged;
          });
        }
        setPagination(res.data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load stock');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedCategory, pagination.page]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await stockAPI.getSummary();
      if (res.data.success) setSummary(res.data.data);
    } catch (err) {
      console.error('fetchSummary error:', err.message);
    }
  }, []);

  // ─── Fetch Received Inventory ───────────────────────────────────────────────────
  const fetchReceivedInventory = useCallback(async (params = {}, reset = true) => {
    try {
      if (reset) setLoading(true);
      setError(null);

      const queryParams = {
        filter: params.filter ?? receivedFilter,
        page: reset ? 1 : receivedPagination.page + 1,
        limit: 50,
      };

      const res = await inventoryAPI.getReceived(queryParams);
      if (res.data.success) {
        if (reset) {
          setReceivedInventory(res.data.data);
        } else {
          setReceivedInventory(prev => [...prev, ...res.data.data]);
        }
        setReceivedPagination(res.data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load received inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [receivedFilter, receivedPagination.page]);

  const fetchReceivedSummary = useCallback(async () => {
    try {
      const res = await inventoryAPI.getReceivedSummary();
      if (res.data.success) setReceivedSummary(res.data.data);
    } catch (err) {
      console.error('fetchReceivedSummary error:', err.message);
    }
  }, []);

  // ─── Refresh ───────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchStocks({ search: searchQuery, category: selectedCategory }, true),
      fetchSummary(),
      fetchReceivedInventory({ filter: receivedFilter }, true),
      fetchReceivedSummary()
    ]);
  }, [fetchStocks, fetchSummary, fetchReceivedInventory, fetchReceivedSummary, searchQuery, selectedCategory, receivedFilter]);

  // ─── Crud for Showroom ────────────────────────────────────────────────────────
  const createStock = useCallback(async (data) => {
    const res = await stockAPI.create(data);
    if (res.data.success) onRefresh();
    return res.data;
  }, [onRefresh]);

  const updateStock = useCallback(async (id, data) => {
    const res = await stockAPI.update(id, data);
    if (res.data.success) onRefresh();
    return res.data;
  }, [onRefresh]);

  const deleteStock = useCallback(async (id) => {
    const res = await stockAPI.remove(id);
    if (res.data.success) onRefresh();
    return res.data;
  }, [onRefresh]);

  const getStockById = useCallback(async (id) => {
    const res = await stockAPI.getById(id);
    return res.data;
  }, []);

  const loadMoreStocks = useCallback(() => {
    if (pagination.page < pagination.pages && !loading) fetchStocks({}, false);
  }, [pagination, loading, fetchStocks]);

  const loadMoreReceived = useCallback(() => {
    if (receivedPagination.page < receivedPagination.pages && !loading) fetchReceivedInventory({}, false);
  }, [receivedPagination, loading, fetchReceivedInventory]);

  return (
    <StockContext.Provider
      value={{
        stocks, summary, pagination, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory,
        fetchStocks, fetchSummary, loadMoreStocks, createStock, updateStock, deleteStock, getStockById,
        
        receivedInventory, receivedSummary, receivedPagination, receivedFilter, setReceivedFilter,
        fetchReceivedInventory, fetchReceivedSummary, loadMoreReceived,

        loading, refreshing, error, onRefresh,
      }}
    >
      {children}
    </StockContext.Provider>
  );
};

export const useStock = () => useContext(StockContext);
