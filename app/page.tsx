"use client";

import React, { useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Trophy, ArrowRight, ListOrdered } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 新規作成ボタンの処理
  const handleCreateNew = () => {
    // 8文字のランダムなIDを生成してエディタへ遷移
    const newId = crypto.randomUUID().slice(0, 8);
    router.push(`/editor?id=${newId}`);
  };

  // ファイル読み込みボタンの処理
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        // JSONの形式が正しいかチェック
        JSON.parse(result); 
        
        // ローカルストレージにデータをセットして、新しいIDでエディタを開く
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
        
        {/* ロゴ・タイトル領域 */}
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

        {/* アクションボタン領域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 新規作成カード */}
          <button 
            onClick={handleCreateNew}
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

          {/* ファイル読込カード */}
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
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              onChange={handleImportData} 
              className="hidden" 
            />
          </button>
        </div>

        {/* 機能紹介のフッター部分 */}
        <div className="mt-12 pt-8 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Trophy size={20} className="text-amber-500" />
            <span className="text-[11px] font-medium">複数競技を一元管理</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <ListOrdered size={20} className="text-emerald-500" />
            <span className="text-[11px] font-medium">ドラッグ＆ドロップ操作</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <ArrowRight size={20} className="text-blue-500" />
            <span className="text-[11px] font-medium">Excelへ簡単コピー</span>
          </div>
        </div>

      </div>
    </div>
  );
}
