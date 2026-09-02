/**
 * services/saleStorage.ts
 * Servicio de almacenamiento local offline y gestión de ventas de Destellos de Hada.
 * Provee persistencia en LocalStorage/memoria, cola de sincronización y utilidades de ventas.
 */
import type { CartLine, Discount } from '@/context/CartContext';

export type SaleStatus =
  | 'PENDIENTE_COMPROBANTE'
  | 'COMPROBANTE_ADJUNTO'
  | 'CONFIRMADA'
  | 'SINCRONIZADA'
  | 'ERROR';

export type CustomerData = {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
};

export type ReceiptData = {
  fileName: string;
  fileSize: string;
  fileType: string;
  previewUri?: string;
  uploadedAt: string;
};

export type Sale = {
  id: string; // ej: "D00123"
  reference: string; // ej: "VENTA-000123"
  createdAt: string;
  items: CartLine[];
  subtotal: number;
  discount: Discount;
  discountAmount: number;
  total: number;
  customer: CustomerData;
  receipt?: ReceiptData;
  status: SaleStatus;
  synced: boolean;
  syncAttempts: number;
  userId?: string;
};

export const BANK_DETAILS = {
  bankName: 'Banco de Chile',
  accountHolder: 'Destellos de Hada SpA',
  rut: '76.123.456-7',
  accountType: 'Cuenta Corriente',
  accountNumber: '123456789',
  email: 'hola@destellosdehada.cl',
};

const STORAGE_KEY = 'destellos_de_hada_sales_v1';

const INITIAL_SALES: Sale[] = [];

import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

class SaleStorageService {
  private sales: Sale[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const data = window.localStorage.getItem(STORAGE_KEY);
        if (data) {
          this.sales = JSON.parse(data);
          return;
        }
      } catch (e) {
        console.warn('Error reading from localStorage', e);
      }
    }
    this.sales = [...INITIAL_SALES];
    this.persist();
  }

  private persist() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sales));
      } catch (e) {
        console.warn('Error saving to localStorage', e);
      }
    }
  }

  public getAllSales(): Sale[] {
    return [...this.sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getPendingSales(): Sale[] {
    return this.sales.filter((s) => !s.synced);
  }

  public getSaleById(id: string): Sale | undefined {
    return this.sales.find((s) => s.id === id || s.reference === id);
  }

  public generateSaleId(): { id: string; reference: string } {
    const uuid =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const token = uuid.replace(/-/g, '').slice(0, 8).toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return {
      id: `D-${token}`,
      reference: `VENTA-${date}-${token.slice(0, 6)}`,
    };
  }

  public saveSale(sale: Sale): Sale {
    this.sales.unshift(sale);
    this.persist();

    // Auto sync attempt in background
    this.syncAllPending().catch(e => console.warn("Background sync failed:", e));

    return sale;
  }

  public async syncAllPending(): Promise<{ syncedCount: number; errors: number }> {
    const pendingSales = this.getPendingSales();
    if (pendingSales.length === 0) return { syncedCount: 0, errors: 0 };

    let syncedCount = 0;
    let errors = 0;

    for (const sale of pendingSales) {
      try {
        const saleRef = doc(db, 'ventas', sale.id);
        await setDoc(saleRef, {
          ...sale,
          synced: true,
          status: 'SINCRONIZADA',
          syncAttempts: sale.syncAttempts + 1,
          updatedAt: new Date().toISOString()
        });

        // Update local sale state to reflect successful sync
        const index = this.sales.findIndex(s => s.id === sale.id);
        if (index !== -1) {
          this.sales[index].synced = true;
          this.sales[index].status = 'SINCRONIZADA';
          this.sales[index].syncAttempts += 1;
        }
        syncedCount++;
      } catch (error) {
        console.error(`Error syncing sale ${sale.id}:`, error);

        const index = this.sales.findIndex(s => s.id === sale.id);
        if (index !== -1) {
          this.sales[index].syncAttempts += 1;
        }
        errors++;
      }
    }

    this.persist();
    return { syncedCount, errors };
  }
}

export const saleStorage = new SaleStorageService();
