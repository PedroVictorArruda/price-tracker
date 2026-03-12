"use client";

import { useState } from "react";

export function ProductSettings({ product }: { product: any }) {
  const [interval, setScrapeInterval] = useState(product?.interval || "24h");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    // call api to update
  };

  const handleDelete = async () => {
    // call api to delete
  };

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Configurações do Produto</h3>
      
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Intervalo de Monitoramento</label>
          <select 
            value={interval}
            onChange={(e) => setScrapeInterval(e.target.value)}
            className="w-full border p-2 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">1 hora</option>
            <option value="6h">6 horas</option>
            <option value="12h">12 horas</option>
            <option value="24h">24 horas</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Status do Monitoramento</label>
          <button 
            onClick={() => setIsActive(!isActive)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'translate-x-6' : 'translate-x-0'}`}></span>
          </button>
        </div>

        <div className="pt-4 border-t mt-2">
          {showDeleteConfirm ? (
            <div className="bg-red-50 p-4 rounded-md border border-red-200">
              <p className="text-red-800 text-sm font-medium mb-3">Tem certeza? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2">
                <button onClick={handleDelete} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700">Sim, excluir</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="bg-white border text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 font-medium text-sm hover:underline"
            >
              Excluir produto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
