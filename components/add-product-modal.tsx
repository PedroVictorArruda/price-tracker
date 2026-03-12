"use client";

import { useState } from "react";

interface PreviewData {
  title: string;
  image: string;
  price: number;
  marketplace: string;
}

export function AddProductModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [interval, setScrapeInterval] = useState("24h");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUrlPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedUrl = e.clipboardData.getData("text");
    if (!pastedUrl) return;

    setLoading(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pastedUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch (error) {
      console.error("Error fetching preview", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, interval, ...preview }),
      });
      if (res.ok) {
        onClose();
        setPreview(null);
        setUrl("");
      }
    } catch (error) {
      console.error("Error saving product", error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl text-gray-800">
        <h2 className="text-xl font-bold mb-4">Adicionar Produto</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">URL do Produto</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handleUrlPaste}
            placeholder="Cole a URL do produto aqui..."
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {loading && <div className="text-sm text-gray-500 mb-4">Carregando preview...</div>}

        {preview && (
          <div className="mb-4 p-4 border rounded-md flex gap-4 bg-gray-50">
            {preview.image && (
              <img src={preview.image} alt={preview.title} className="w-16 h-16 object-cover rounded" />
            )}
            <div className="flex-1">
              <h3 className="text-sm font-semibold line-clamp-2">{preview.title}</h3>
              <p className="text-sm text-gray-600">{preview.marketplace}</p>
              <p className="font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.price)}
              </p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Intervalo de Atualização</label>
          <select
            value={interval}
            onChange={(e) => setScrapeInterval(e.target.value)}
            className="w-full border rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">1 hora</option>
            <option value="6h">6 horas</option>
            <option value="12h">12 horas</option>
            <option value="24h">24 horas</option>
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!preview || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
