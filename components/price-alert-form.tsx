"use client";

import { useState } from "react";

export function PriceAlertForm({ productId, currentPrice }: { productId: string; currentPrice?: number }) {
  const [targetPrice, setTargetPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      // POST request to save price alert
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, targetPrice: parseFloat(targetPrice) })
      });

      if (res.ok) {
        setSuccess(true);
        setTargetPrice("");
      }
    } catch (error) {
      console.error("Failed to save alert", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm">
      <h3 className="text-lg font-semibold mb-2">Criar Alerta de Preço</h3>
      <p className="text-sm text-gray-500 mb-4">Seja notificado quando o preço atingir seu objetivo.</p>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preço Alvo</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
            <input 
              type="number" 
              step="0.01"
              required
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder={currentPrice ? currentPrice.toFixed(2) : "0.00"}
              className="w-full pl-9 pr-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={saving || !targetPrice}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium mt-2"
        >
          {saving ? "Salvando..." : "Salvar Alerta"}
        </button>

        {success && (
          <div className="text-sm text-green-600 text-center mt-2">Alerta criado com sucesso!</div>
        )}
      </form>
    </div>
  );
}
