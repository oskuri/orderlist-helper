"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Plus, Download, Upload, Trash2, GripVertical, ListOrdered, Copy, Check, 
  ArrowUpToLine, Eraser, ChevronLeft, ChevronRight, AlertTriangle, Info, Search, 
  ExternalLink, X, Clock, FileSpreadsheet, SlidersHorizontal, CheckCircle2,
  Share2, Cloud, CloudOff, RefreshCw, Lock, Unlock
} from "lucide-react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ――― 定数・型定義 ―――
const COLUMNS = [
  { name: "OP", width: "w-12" },
  { name: "出番", width: "w-16" },
  { name: "選手名", width: "w-48" },
  { name: "会員番号", width: "w-24" },
  { name: "馬名", width: "w-48" },
  { name: "登録番号", width: "w-24" },
  { name: "所属", width: "w-72" },
];

const COLOR_PALETTE = [
  "bg-sky-100 border-sky-300 text-sky-900", "bg-rose-100 border-rose-300 text-rose-900",
  "bg-amber-100 border-amber-300 text-amber-900", "bg-indigo-100 border-indigo-300 text-indigo-900",
  "bg-emerald-100 border-emerald-300 text-emerald-900", "bg-orange-100 border-orange-300 text-orange-900",
  "bg-purple-100 border-purple-300 text-purple-900", "bg-lime-100 border-lime-300 text-lime-900",
];

type RowData = { id: string; values: string[] };
type TabData = { id: string; name: string; rows: RowData[] };
type SearchResult = { tabId: string; tabName: string; rowIndex: number; row: RowData };
type IntervalWarning = { riderWarning?: { minGap: number; targetName: string }; horseWarning?: { minGap: number; targetName: string }; };
type HoveredMatch = { type: "rider" | "horse"; name: string; } | null;

const createEmptyRows = (count: number): RowData[] =>
  Array.from({ length: count }, () => ({ id: crypto.randomUUID(), values: Array(7).fill("") }));

const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="font-bold text-emerald-600 bg-emerald-100 px-0.5 rounded">{part}</span>
        ) : part
      )}
    </>
  );
};

// ――― タブコンポーネント ―――
const SortableTab = ({ tab, isActive, isEditable, onSelect, onUpdateName, onDelete }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isEditable ? attributes : {})}
      {...(isEditable ? listeners : {})}
      onClick={() => onSelect(tab.id)}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg transition-all ${isEditable ? 'cursor-grab' : 'cursor-pointer'} ${
        isActive ? "bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)] border-t-2 border-emerald-500 relative z-10" : "bg-slate-200 hover:bg-slate-300 text-slate-500"
      }`}
    >
      <input
        type="text"
        value={tab.name}
        onChange={(e) => onUpdateName(tab.id, e.target.value)}
        readOnly={!isEditable}
        className={`bg-transparent outline-none font-semibold w-20 text-xs sm:text-sm ${
          isActive ? "text-emerald-900" : "text-slate-600"
        } ${isEditable ? 'cursor-text' : 'cursor-pointer'}`}
      />
      {isEditable && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(tab.id, tab.name); }} className="text-slate-400 hover:text-red-500 p-0.5"><Trash2 size={13} /></button>
      )}
    </div>
  );
};

// ――― 行コンポーネント ―――
const SortableRow = ({ row, rowIndex, isEditable, updateCell, handlePaste, duplicateColors, intervalWarnings, suggestions, onContextMenu, hoveredMatch, onHoverCell, onLeaveCell }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [focusedCol, setFocusedCol] = useState<number | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const rowWarning = intervalWarnings[rowIndex] as IntervalWarning | undefined;

  const isRiderMatchHovered = hoveredMatch?.type === "rider" && row.values[2].trim() !== "" && row.values[2].trim() === hoveredMatch.name;
  const isHorseMatchHovered = hoveredMatch?.type === "horse" && row.values[4].trim() !== "" && row.values[4].trim() === hoveredMatch.name;
  const isRowMatchHovered = isRiderMatchHovered || isHorseMatchHovered;

  useEffect(() => {
    if (dropdownRef.current && activeSuggestionIndex >= 0) {
      const activeItem = dropdownRef.current.children[activeSuggestionIndex] as HTMLElement;
      if (activeItem) {
        const itemBottom = activeItem.offsetTop + activeItem.clientHeight;
        const containerBottom = dropdownRef.current.scrollTop + dropdownRef.current.clientHeight;
        if (activeItem.offsetTop < dropdownRef.current.scrollTop) dropdownRef.current.scrollTop = activeItem.offsetTop;
        else if (itemBottom > containerBottom) dropdownRef.current.scrollTop = itemBottom - dropdownRef.current.clientHeight;
      }
    }
  }, [activeSuggestionIndex]);

  return (
    <tr 
      ref={setNodeRef} 
      data-row-index={rowIndex}
      style={style} 
      onContextMenu={(e) => isEditable && onContextMenu(e, rowIndex)}
      className={`border-b border-slate-100 transition-all duration-150 group ${isRowMatchHovered ? "bg-emerald-50/90 ring-2 ring-emerald-400 ring-inset z-20" : "bg-white hover:bg-slate-50/80"} ${focusedCol !== null ? "relative z-40" : "relative z-10"}`}
    >
      <td className="p-0 text-center">
        {isEditable ? (
          <button {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 opacity-50 group-hover:opacity-100 p-1"><GripVertical size={14} /></button>
        ) : (
          <div className="text-slate-200 p-1"><GripVertical size={14} /></div>
        )}
      </td>
      {row.values.map((val: string, colIndex: number) => {
        let styleColor = "bg-transparent";
        if (colIndex === 2 && duplicateColors.rider[val]) styleColor = duplicateColors.rider[val];
        if (colIndex === 4 && duplicateColors.horse[val]) styleColor = duplicateColors.horse[val];

        const warningInfo = colIndex === 2 ? rowWarning?.riderWarning : colIndex === 4 ? rowWarning?.horseWarning : null;
        const colSuggestions = (colIndex === 2 ? suggestions.riders : colIndex === 4 ? suggestions.horses : colIndex === 6 ? suggestions.affiliations : []);
        const filteredSuggestions = val.length > 0 ? colSuggestions.filter((s: string) => s !== val && s.toLowerCase().includes(val.toLowerCase())) : [];
        const isThisCellHovered = (colIndex === 2 && isRiderMatchHovered) || (colIndex === 4 && isHorseMatchHovered);

        return (
          <td 
            key={colIndex} 
            className={`p-0 relative transition-colors ${styleColor} ${isThisCellHovered ? "ring-2 ring-emerald-600 bg-emerald-100" : ""}`}
            onMouseEnter={() => { if ((colIndex === 2 || colIndex === 4) && val.trim()) onHoverCell(colIndex === 2 ? "rider" : "horse", val.trim()); }}
            onMouseLeave={() => { if (colIndex === 2 || colIndex === 4) onLeaveCell(); }}
          >
            <div className="flex items-center w-full h-full relative">
              <input
                type="text"
                value={val}
                readOnly={!isEditable}
                onFocus={() => { if(isEditable) { setFocusedCol(colIndex); setActiveSuggestionIndex(-1); } }}
                onBlur={() => { setFocusedCol(null); setActiveSuggestionIndex(-1); }}
                onChange={(e) => { updateCell(rowIndex, colIndex, e.target.value); setActiveSuggestionIndex(-1); }}
                onKeyDown={(e) => {
                  if (focusedCol === colIndex && filteredSuggestions.length > 0) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestionIndex((p) => Math.min(p + 1, filteredSuggestions.length - 1)); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveSuggestionIndex((p) => Math.max(p - 1, 0)); }
                    else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
                      e.preventDefault();
                      updateCell(rowIndex, colIndex, filteredSuggestions[activeSuggestionIndex]);
                      setFocusedCol(null);
                    }
                  }
                }}
                onPaste={(e) => isEditable && handlePaste(e, rowIndex, colIndex)}
                className={`w-full h-full px-2 py-1 bg-transparent outline-none transition-all duration-150 text-slate-700 text-xs sm:text-sm ${
                  isEditable ? 'focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:relative focus:z-10 cursor-text' : 'cursor-default'
                }`}
              />
              {warningInfo && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex items-center gap-0.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                  <AlertTriangle size={10} /><span>間隔 {warningInfo.minGap}</span>
                </div>
              )}
            </div>
            {focusedCol === colIndex && filteredSuggestions.length > 0 && isEditable && (
              <div ref={dropdownRef} className="absolute top-full left-0 w-full mt-0.5 bg-white border border-emerald-200 shadow-xl z-50 max-h-40 overflow-y-auto rounded-md flex flex-col">
                {filteredSuggestions.map((suggestion: string, i: number) => (
                  <div
                    key={suggestion}
                    onMouseEnter={() => setActiveSuggestionIndex(i)}
                    onMouseDown={(e) => { e.preventDefault(); updateCell(rowIndex, colIndex, suggestion); setFocusedCol(null); }}
                    className={`px-3 py-1.5 text-xs sm:text-sm cursor-pointer border-b border-slate-50 last:border-none ${i === activeSuggestionIndex ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-700 hover:bg-emerald-50"}`}
                  >
                    <HighlightMatch text={suggestion} query={val} />
                  </div>
                ))}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
};

// ――― メインアプリケーション ―――
export default function EditorPage() {
  const [tournamentId, setTournamentId] = useState<string>("");
  const [tournamentName, setTournamentName] = useState<string>("");
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  
  // ★ 編集モードとパスワードの管理
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [savedPassword, setSavedPassword] = useState<string>("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [inputPassword, setInputPassword] = useState<string>("");
  const [authError, setAuthError] = useState<boolean>(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "offline">("saved");

  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const isRemoteUpdateRef = useRef(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [minIntervalThreshold, setMinIntervalThreshold] = useState<number>(5);
  const [hoveredMatch, setHoveredMatch] = useState<HoveredMatch>(null);
  const [hoverBrackets, setHoverBrackets] = useState<{ top: number; height: number; gap: number }[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const initData = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentId = urlParams.get("id");

      if (!currentId) {
        window.location.href = "/"; // IDがなければトップへ戻す
        return;
      }
      setTournamentId(currentId);

      if (!supabase) {
        setSaveStatus("offline");
        setIsEditable(true); // オフライン時は常に編集可能
        setIsLoaded(true);
        return;
      }

      try {
        const { data } = await supabase.from("tournaments").select("*").eq("id", currentId).single();
        if (data && data.data) {
          const payload = data.data;
          setTournamentName(data.name || payload.tournamentName || "");
          setTabs(payload.tabs || []);
          setActiveTabId(payload.activeTabId || (payload.tabs?.[0]?.id || ""));
          if (payload.minIntervalThreshold !== undefined) setMinIntervalThreshold(payload.minIntervalThreshold);
          
          const dbPassword = payload.editPassword || "";
          setSavedPassword(dbPassword);

          // 作成者かどうか（SessionStorageにパスワードがあるか）チェック
          const sessionPw = sessionStorage.getItem(`eq_auth_${currentId}`);
          if (dbPassword === "" || sessionPw === dbPassword) {
            setIsEditable(true);
          } else {
            setIsEditable(false);
          }
        }
      } catch (err) {
        console.error("Supabase load error:", err);
      } finally {
        setIsLoaded(true);
      }
    };
    initData();
  }, []);

  // リアルタイム同期
  useEffect(() => {
    if (!supabase || !tournamentId) return;
    const channel = supabase.channel(`tournament:${tournamentId}`).on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            isRemoteUpdateRef.current = true;
            const remoteData = payload.new.data;
            setTournamentName(payload.new.name || remoteData.tournamentName || "");
            if (remoteData.tabs) setTabs(remoteData.tabs);
            if (remoteData.activeTabId) setActiveTabId(remoteData.activeTabId);
            setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]);

  // オートセーブ
  useEffect(() => {
    if (!isLoaded || !isEditable || isRemoteUpdateRef.current || !supabase || !tournamentId) return;
    setSaveStatus("saving");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await supabase.from("tournaments").upsert({
          id: tournamentId, name: tournamentName,
          data: { tabs, activeTabId, tournamentName, minIntervalThreshold, editPassword: savedPassword },
          updated_at: new Date().toISOString()
        });
        setSaveStatus("saved");
      } catch (e) { setSaveStatus("error"); }
    }, 500);
  }, [tabs, activeTabId, tournamentName, minIntervalThreshold, isLoaded, isEditable]);

  // モード切替の処理
  const handleAuthSubmit = () => {
    if (inputPassword === savedPassword) {
      setIsEditable(true);
      setIsAuthModalOpen(false);
      setAuthError(false);
      sessionStorage.setItem(`eq_auth_${tournamentId}`, inputPassword);
    } else {
      setAuthError(true);
    }
  };

  const handleToggleMode = () => {
    if (isEditable) {
      // 編集モードを終了して閲覧モードにする
      setIsEditable(false);
      sessionStorage.removeItem(`eq_auth_${tournamentId}`);
    } else {
      // パスワードなし設定なら即編集モード
      if (!savedPassword) setIsEditable(true);
      else setIsAuthModalOpen(true);
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // （これ以降の updateCell, addTab, copyToClipboard 等の機能はそのまま...）
  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    if (!isEditable || !activeTab) return;
    const newRows = [...activeTab.rows];
    newRows[rowIndex].values[colIndex] = value;
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
  };

  const copyShareUrl = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setIsShareCopied(true); setTimeout(() => setIsShareCopied(false), 2000); } catch (e) { }
  };

  const { duplicateColors, intervalWarnings } = useMemo(() => {
    if (!activeTab) return { duplicateColors: { rider: {}, horse: {} }, intervalWarnings: {} };
    const riderCounts: Record<string, number> = {}; const horseCounts: Record<string, number> = {};
    activeTab.rows.forEach((r) => {
      const rider = r.values[2].trim(); const horse = r.values[4].trim();
      if (rider) riderCounts[rider] = (riderCounts[rider] || 0) + 1;
      if (horse) horseCounts[horse] = (horseCounts[horse] || 0) + 1;
    });
    const riderColors: Record<string, string> = {}; const horseColors: Record<string, string> = {};
    let colorIdx = 0;
    Object.keys(riderCounts).forEach((k) => { if (riderCounts[k] > 1) riderColors[k] = COLOR_PALETTE[(colorIdx++) % COLOR_PALETTE.length]; });
    Object.keys(horseCounts).forEach((k) => { if (horseCounts[k] > 1) horseColors[k] = COLOR_PALETTE[(colorIdx++) % COLOR_PALETTE.length]; });
    return { duplicateColors: { rider: riderColors, horse: horseColors }, intervalWarnings: {} };
  }, [activeTab]);

  const suggestions = useMemo(() => {
    const riders = new Set<string>(); const horses = new Set<string>(); const allValues = new Set<string>();
    tabs.forEach((tab) => {
      tab.rows.forEach((row) => {
        row.values.forEach((v) => { if (v.trim()) allValues.add(v.trim()); });
        if (row.values[2].trim()) riders.add(row.values[2].trim());
        if (row.values[4].trim()) horses.add(row.values[4].trim());
      });
    });
    return { riders: Array.from(riders), horses: Array.from(horses), all: Array.from(allValues) };
  }, [tabs]);

  if (!isLoaded || !activeTab) return null;

  return (
    <div className="h-screen bg-slate-100 p-2 sm:p-3 font-sans text-slate-800 flex flex-col overflow-hidden">
      <div className="w-full max-w-[98%] xl:max-w-7xl mx-auto h-full flex flex-col min-h-0">
        
        {/* ヘッダー＆コントロール */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2 bg-white px-3.5 py-2.5 rounded-xl shadow-sm border border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="flex items-center gap-1.5 shrink-0 cursor-pointer" onClick={() => window.location.href="/"}>
              <span className="text-xl" role="img" aria-label="horse">🐴</span>
              <h1 className="text-base font-bold tracking-tight text-slate-800 shrink-0">Order List Helper</h1>
            </div>
            <input
              type="text"
              placeholder="大会名を入力"
              value={tournamentName}
              readOnly={!isEditable}
              onChange={(e) => isEditable && setTournamentName(e.target.value)}
              className="flex-1 text-xs sm:text-sm font-medium text-slate-700 border-b border-transparent focus:outline-none py-0.5 bg-transparent min-w-[120px]"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* モード切替ボタン */}
            <button
              onClick={handleToggleMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                isEditable 
                  ? "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200" 
                  : "bg-slate-700 text-white hover:bg-slate-800"
              }`}
            >
              {isEditable ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{isEditable ? "編集モード (終了する)" : "閲覧モード (編集する)"}</span>
            </button>

            {/* クラウド同期ステータス */}
            {isEditable && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600">
                {saveStatus === "saving" ? <><RefreshCw size={12} className="animate-spin text-amber-500" /> 保存中</> : 
                 saveStatus === "saved" ? <><Cloud size={13} className="text-emerald-500" /> 同期済</> : "オフライン"}
              </div>
            )}
            
            <button onClick={copyShareUrl} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium">
              <Share2 size={13} /> 共有URL
            </button>
          </div>
        </div>

        {/* タブ領域 */}
        <div className="flex justify-between items-end px-1 mb-0 shrink-0 mt-1">
          <div className="flex overflow-x-auto overflow-y-hidden mr-3">
            <div className="flex gap-1 px-1">
              <DndContext sensors={useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))} collisionDetection={closestCenter} onDragEnd={()=>{}}>
                <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
                  {tabs.map((tab) => (
                    <SortableTab key={tab.id} tab={tab} isActive={activeTabId === tab.id} isEditable={isEditable} onSelect={setActiveTabId} />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
          
          {isEditable && (
            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              <button className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-600 rounded-t-md text-xs font-medium"><Plus size={13} /> タブ追加</button>
            </div>
          )}
        </div>

        {/* 表領域 */}
        <div ref={tableWrapperRef} className="bg-white rounded-b-xl rounded-tl-xl shadow-lg border border-slate-200 flex-1 min-h-0 overflow-y-auto relative z-0">
          <table className="w-full border-collapse table-fixed relative">
            <colgroup><col className="w-8" />{COLUMNS.map((col, idx) => <col key={idx} className={col.width} />)}</colgroup>
            <thead className="bg-slate-800 text-white sticky top-0 z-30 shadow-sm">
              <tr className="text-xs tracking-wider"><th className="py-2 px-1"></th>{COLUMNS.map((col, idx) => <th key={idx} className="py-2 px-2 text-left">{col.name}</th>)}</tr>
            </thead>
            <tbody ref={tableBodyRef} className="relative">
              <DndContext sensors={useSensors(useSensor(PointerSensor))} collisionDetection={closestCenter} onDragEnd={()=>{}}>
                <SortableContext items={activeTab.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {activeTab.rows.map((row, rowIndex) => (
                    <SortableRow
                      key={row.id} row={row} rowIndex={rowIndex}
                      isEditable={isEditable} updateCell={updateCell}
                      duplicateColors={duplicateColors} intervalWarnings={intervalWarnings} suggestions={suggestions}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </tbody>
          </table>
        </div>

      </div>

      {/* パスワード入力モーダル */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Lock size={18} className="text-slate-600" /> 編集モードへの切り替え
              </h3>
              <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              この大会を編集するにはパスワードを入力してください。
            </p>
            <input
              type="password"
              placeholder="パスワード"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuthSubmit()}
              className={`w-full border rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 ${authError ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-emerald-500"}`}
            />
            {authError && <p className="text-red-500 text-xs mb-4">パスワードが間違っています。</p>}
            <button
              onClick={handleAuthSubmit}
              className="w-full mt-4 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg transition-colors"
            >
              ロックを解除する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}