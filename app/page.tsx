"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Trophy, ArrowRight, ListOrdered, Lock, X, Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Supabase初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const createEmptyRows = (count: number) =>
  Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    values: Array(7).fill(""),
  }));

export default function WelcomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // パスワードを設定して新規作成
  const handleCreateNew = async () => {
    setIsCreating(true);
    const newId = crypto.randomUUID().slice(0, 8);
    
    // Supabaseが設定されている場合は、パスワードを含めて初期データをクラウドに作成
    if (supabase) {
      const initialTab = { id: crypto.randomUUID(), name: "第1競技", rows: createEmptyRows(100) };
      await supabase.from("tournaments").insert({
        id: newId,
        name: "無題の大会",
        data: { 
          tabs: [initialTab], 
          activeTabId: initialTab.id, 
          minIntervalThreshold: 5,
          editPassword: password // パスワードを保存
        }
      });
    }

    // 作成した人がすぐに編集できるように、SessionStorageに一時的にパスワードを記憶
    sessionStorage.setItem(`eq_auth_${newId}`, password);
    router.push(`/editor?id=${newId}`);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        JSON.parse(result); 
        localStorage.setItem("equestrian-data-v3", result);
        const newId = crypto.randomUUID().slice(0, 8);
        router.push(`/editor?id=${newId}`);
      } catch (err) {
        alert("ファイルの読み込みに失敗しました。正しいJSONファイルを選択してください。");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 md:p-12 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <span className="text-4xl" role="img" aria-label="horse">🐴</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-800 mb-3">
            Order List Helper
          </h1>
          <p className="text-slate-500 font-medium">
            馬術大会の進行管理・出番表作成を、もっとスムーズに。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => setIsPasswordModalOpen(true)}
            className="group flex flex-col items-center justify-center gap-3 p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left w-full shadow-sm hover:shadow-md"
          >
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-800 text-lg group-hover:text-emerald-700 transition-colors">新しい大会を作成</h3>
              <p className="text-xs text-slate-500 mt-1">空の出番表から準備を始めます</p>
            </div>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="group flex flex-col items-center justify-center gap-3 p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left w-full shadow-sm hover:shadow-md"
          >
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">保存データを開く</h3>
              <p className="text-xs text-slate-500 mt-1">保存したJSONファイルを読み込みます</p>
            </div>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" />
          </button>
        </div>
      </div>

      {/* パスワード設定モーダル */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Lock size={18} className="text-emerald-600" />
                編集パスワードの設定
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              この大会を編集するためのパスワードを設定してください。URLを共有された他の人は、閲覧のみ（ビューモード）となります。
            </p>
            <input
              type="text"
              placeholder="パスワード (省略可)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-6 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <button
              onClick={handleCreateNew}
              disabled={isCreating}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isCreating ? <Loader2 className="animate-spin" size={18} /> : null}
              {isCreating ? "作成中..." : "大会を作成して開く"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}