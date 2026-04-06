import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Product } from './api';

export interface CartItem {
  productId: string;
  quantity: number;
  priceAtSale: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  /** maxStock = stock actual do produto; quantidade é limitada para não ultrapassar */
  updateCartQuantity: (productId: string, quantity: number, maxStock?: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

const CART_STORAGE_KEY = 'pos_cart';

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  /** Carrinho só em memória — recarregar a página limpa o carrinho */
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartRef = useRef<CartItem[]>(cart);
  cartRef.current = cart;

  useEffect(() => {
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
  }, []);

  const addToCart = (product: Product, quantity: number) => {
    const parsedStock = parseFloat(product.stock);
    if (quantity <= 0 || Number.isNaN(parsedStock)) {
      throw new Error('Quantidade inválida.');
    }

    const prevCart = cartRef.current;
    const existingItemIndex = prevCart.findIndex((item) => item.productId === product.id);
    const inCart = existingItemIndex > -1 ? prevCart[existingItemIndex].quantity : 0;
    const totalAfter = inCart + quantity;

    if (totalAfter > parsedStock + 1e-9) {
      throw new Error(
        `Estoque insuficiente. Disponível: ${parsedStock} ${product.unit}. Já no carrinho: ${inCart}.`,
      );
    }

    setCart((prevCartInner) => {
      const idx = prevCartInner.findIndex((item) => item.productId === product.id);
      if (idx > -1) {
        const newCart = [...prevCartInner];
        newCart[idx] = {
          ...newCart[idx],
          quantity: Number((newCart[idx].quantity + quantity).toFixed(4)),
        };
        return newCart;
      }
      return [
        ...prevCartInner,
        {
          productId: product.id,
          quantity,
          priceAtSale: parseFloat(product.price),
        },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter(item => item.productId !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number, maxStock?: number) => {
    let q = Math.max(0, quantity);
    if (maxStock !== undefined && !Number.isNaN(maxStock)) {
      q = Math.min(q, maxStock);
    }
    if (q <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => (item.productId === productId ? { ...item, quantity: q } : item)),
    );
  };

  const clearCart = () => {
    setCart([]);
    try { localStorage.removeItem(CART_STORAGE_KEY); } catch {}
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      getCartTotal
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
