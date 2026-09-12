"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Download, Upload, Trash2, GripVertical, ListOrdered, Copy, Check, ArrowUpToLine, Eraser, ChevronLeft, ChevronRight, AlertTriangle, Info, Search, ExternalLink, X } from "lucide-react";

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

// 高コントラストな交差カラーパレット（暖色 → 寒色 → 明るい暖色 → 濃い寒色を交互に配置して一目で判別しやすく最適化）
const COLOR_PALETTE = [
  "bg-sky-100",     // 淡いスカイブルー（寒色）
  "bg-rose-100",    // 淡いローズ・赤系（暖色）
  "bg-amber-100",   // 山吹色・アンバー（暖色）
  "bg-indigo-100",  // 落ち着いたインディゴ（深寒色）
  "bg-emerald-100", // エメラルドグリーン（中性・寒色系）
  "bg-orange-100",  // 明るいオレンジ（鮮やか暖色）
  "bg-purple-100",  // パープル（紫）
  "bg-lime-100",    // ライムグリーン（明黄緑）
  "bg-cyan-100",    // シアン（鮮やか青緑）
  "bg-fuchsia-100", // フューシャピンク（鮮やかピンク）
  "bg-yellow-100",  // イエロー
  "bg-blue-100",    // ブルー
  "bg-teal-100",    // ティール
  "bg-pink-100",    // ピンク
  "bg-sky-200",     // スカイブルー（濃）
  "bg-rose-200",    // ローズ（濃）
  "bg-amber-200",   // アンバー（濃）
  "bg-purple-200",  // パープル（濃）
  "bg-emerald-200", // エメラルド（濃）
  "bg-orange-200",  // オレンジ（濃）
  "bg-indigo-200",  // インディゴ（濃）
  "bg-yellow-200",  // イエロー（濃）
  "bg-teal-200",    // ティール（濃）
  "bg-pink-200"     // ピンク（濃）
];

type RowData = { id: string; values: string[] };
type TabData = { id: string; name: string; rows: RowData[] };
type SearchResult = { tabId: string; tabName: string; rowIndex: number; row: RowData };

const createEmptyRows = (count: number): RowData[] =>
  Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    values: Array(7).fill(""),
  }));

const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="font-bold text-emerald-600 bg-emerald-100 px-0.5 rounded">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

// ――― タブコンポーネント（ドラッグ＆ドロップ対応） ―――
const SortableTab = ({ tab, isActive, onSelect, onUpdateName, onDelete }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(tab.id)}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg cursor-grab transition-all ${
        isActive 
          ? "bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)] border-t-2 border-emerald-500 relative z-10" 
          : "bg-slate-200 hover:bg-slate-300 text-slate-500"
      }`}
    >
      <input
        type="text"
        value={tab.name}
        onChange={(e) => onUpdateName(tab.id, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`bg-transparent outline-none font-semibold w-20 text-xs sm:text-sm cursor-text ${
          isActive ? "text-emerald-900" : "text-slate-600"
        }`}
      />
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(tab.id, tab.name); }} 
        onPointerDown={(e) => e.stopPropagation()}
        className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
        title="タブを削除"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};

// ――― 行コンポーネント（ドラッグ＆ドロップ対応） ―――
const SortableRow = ({ row, rowIndex, updateCell, handlePaste, duplicateColors, suggestions, onContextMenu }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  const [focusedCol, setFocusedCol] = useState<number | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dropdownRef.current && activeSuggestionIndex >= 0) {
      const container = dropdownRef.current;
      const activeItem = container.children[activeSuggestionIndex] as HTMLElement;
      if (activeItem) {
        const itemTop = activeItem.offsetTop;
        const itemBottom = itemTop + activeItem.clientHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;

        if (itemTop < containerTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          container.scrollTop = itemBottom - container.clientHeight;
        }
      }
    }
  }, [activeSuggestionIndex]);

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      onContextMenu={(e) => onContextMenu(e, rowIndex)}
      className={`border-b border-slate-100 bg-white hover:bg-slate-50 transition-colors group ${focusedCol !== null ? "relative z-40" : "relative z-10"}`}
    >
      <td className="p-0 text-center">
        <button {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity p-1">
          <GripVertical size={14} />
        </button>
      </td>
      {row.values.map((val: string, colIndex: number) => {
        let bgColor = "bg-transparent";
        if (colIndex === 2 && duplicateColors.rider[val]) bgColor = duplicateColors.rider[val];
        if (colIndex === 4 && duplicateColors.horse[val]) bgColor = duplicateColors.horse[val];

        const colSuggestions = (colIndex === 2 ? suggestions.riders : colIndex === 4 ? suggestions.horses : colIndex === 6 ? suggestions.affiliations : []);
        
        const filteredSuggestions = val.length > 0 
          ? colSuggestions.filter((s: string) => s !== val && s.toLowerCase().includes(val.toLowerCase())) 
          : [];

        return (
          <td key={colIndex} className={`p-0 relative ${bgColor}`}>
            <input
              type="text"
              value={val}
              onFocus={() => {
                setFocusedCol(colIndex);
                setActiveSuggestionIndex(-1);
              }}
              onBlur={() => {
                setFocusedCol(null);
                setActiveSuggestionIndex(-1);
              }}
              onChange={(e) => {
                updateCell(rowIndex, colIndex, e.target.value);
                setActiveSuggestionIndex(-1);
              }}
              onKeyDown={(e) => {
                if (focusedCol === colIndex && filteredSuggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggestionIndex((prev) => Math.min(prev + 1, filteredSuggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === "Enter") {
                    if (activeSuggestionIndex >= 0 && activeSuggestionIndex < filteredSuggestions.length) {
                      e.preventDefault();
                      updateCell(rowIndex, colIndex, filteredSuggestions[activeSuggestionIndex]);
                      setFocusedCol(null);
                    }
                  }
                }
              }}
              onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
              className="w-full h-full px-2 py-1 bg-transparent outline-none transition-all duration-150 focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:relative focus:z-10 text-slate-700 text-xs sm:text-sm"
              autoComplete="off"
            />
            
            {focusedCol === colIndex && filteredSuggestions.length > 0 && (
              <div ref={dropdownRef} className="absolute top-full left-0 w-full mt-0.5 bg-white border border-emerald-200 shadow-xl z-50 max-h-40 overflow-y-auto rounded-md flex flex-col overflow-hidden">
                {filteredSuggestions.map((suggestion: string, i: number) => {
                  const isActive = i === activeSuggestionIndex;
                  return (
                    <div
                      key={suggestion}
                      onMouseEnter={() => setActiveSuggestionIndex(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        updateCell(rowIndex, colIndex, suggestion);
                        setFocusedCol(null);
                      }}
                      className={`px-3 py-1.5 text-xs sm:text-sm cursor-pointer border-b border-slate-50 last:border-none transition-colors ${
                        isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      <HighlightMatch text={suggestion} query={val} />
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
};

// ――― メインアプリケーション ―――
export default function EquestrianApp() {
  const [tournamentName, setTournamentName] = useState<string>("");
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const tabContainerRef = useRef<HTMLDivElement>(null);

  // 検索機能のステート
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState<number>(-1);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; rowIndex: number | null; customText?: string }>({
    visible: false, x: 0, y: 0, rowIndex: null
  });

  // カスタムモーダル（アラート＆確認用）の状態管理
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    type: "alert" | "confirm";
    confirmLabel?: string;
    confirmColor?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", message: "", type: "alert" });

  useEffect(() => {
    const saved = localStorage.getItem("equestrian-data");
    if (saved) {
      const parsed = JSON.parse(saved);
      setTabs(parsed.tabs || []);
      setActiveTabId(parsed.activeTabId || "");
      setTournamentName(parsed.tournamentName || "");
    } else {
      const initialTab = { id: crypto.randomUUID(), name: "第1競技", rows: createEmptyRows(100) };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("equestrian-data", JSON.stringify({ tabs, activeTabId, tournamentName }));
    }
  }, [tabs, activeTabId, tournamentName, isLoaded]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // モーダルヘルパー
  const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));

  const showAlert = (title: string, message: string) => {
    setModal({ isOpen: true, title, message, type: "alert" });
  };

  const showConfirm = (title: string, message: string | React.ReactNode, confirmLabel: string, confirmColor: string, onConfirm: () => void) => {
    setModal({ isOpen: true, title, message, type: "confirm", confirmLabel, confirmColor, onConfirm });
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const addTab = () => {
    const newTab = { id: crypto.randomUUID(), name: `新競技 ${tabs.length + 1}`, rows: createEmptyRows(100) };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setTimeout(() => scrollTabs("right"), 100);
  };

  const updateTabName = (id: string, name: string) => setTabs(tabs.map((t) => (t.id === id ? { ...t, name } : t)));

  const requestDeleteTab = (id: string, name: string) => {
    if (tabs.length === 1) {
      showAlert("削除エラー", "最後のタブは削除できません。");
      return;
    }
    showConfirm(
      "タブの削除",
      `「${name}」を削除しますか？\nこのタブのデータは完全に失われます。`,
      "削除する", "bg-red-600 hover:bg-red-700",
      () => {
        const newTabs = tabs.filter((t) => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) setActiveTabId(newTabs[0].id);
      }
    );
  };

  const exportData = () => {
    const dataObj = { tabs, activeTabId, tournamentName };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `${tournamentName || "Order-list"}-settings.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setTabs(parsed.tabs);
        setActiveTabId(parsed.activeTabId);
        setTournamentName(parsed.tournamentName || "");
      } catch (err) {
        showAlert("エラー", "ファイルの読み込みに失敗しました。形式が正しいか確認してください。");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const requestClearAllData = () => {
    showConfirm(
      "全データのクリア",
      "全てのタブのデータを削除し、初期状態に戻します。\n本当によろしいですか？",
      "全データ消去", "bg-red-600 hover:bg-red-700",
      () => {
        const initialTab = { id: crypto.randomUUID(), name: "第1競技", rows: createEmptyRows(100) };
        setTabs([initialTab]);
        setActiveTabId(initialTab.id);
        setTournamentName("");
      }
    );
  };

  const requestClearCurrentTab = () => {
    if (!activeTab) return;
    showConfirm(
      "タブデータの消去",
      `「${activeTab.name}」のデータをすべて消去し、空行に戻します。\n本当によろしいですか？`,
      "データを消去", "bg-red-600 hover:bg-red-700",
      () => {
        setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: createEmptyRows(100) } : t)));
      }
    );
  };

  const scrollTabs = (direction: "left" | "right") => {
    if (tabContainerRef.current) {
      const scrollAmount = 300;
      tabContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    if (!activeTab) return;
    const newRows = [...activeTab.rows];
    newRows[rowIndex].values[colIndex] = value;
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) => {
    e.preventDefault();
    if (!activeTab) return;

    const pasteData = e.clipboardData.getData("text");
    const pasteRows = pasteData.split("\n").map((row) => row.split("\t"));
    const newRows = [...activeTab.rows];

    pasteRows.forEach((row, rIdx) => {
      if (startRow + rIdx >= newRows.length) return;
      row.forEach((cellVal, cIdx) => {
        if (startCol + cIdx < 7) {
          newRows[startRow + rIdx].values[startCol + cIdx] = cellVal.replace(/\r/g, "");
        }
      });
    });
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
  };

  const renumberOrder = () => {
    if (!activeTab) return;
    const newRows = activeTab.rows.map((row, idx) => {
      const newValues = [...row.values];
      newValues[1] = (idx + 1).toString();
      return { ...row, values: newValues };
    });
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
  };

  const copyToClipboard = async () => {
    if (!activeTab) return;
    let lastValidRowIndex = -1;
    for (let i = activeTab.rows.length - 1; i >= 0; i--) {
      if (activeTab.rows[i].values[2].trim() !== "") {
        lastValidRowIndex = i;
        break;
      }
    }
    if (lastValidRowIndex === -1) {
      showAlert("コピーエラー", "コピーできるデータ（選手名）がありません。");
      return;
    }
    const rowsToCopy = activeTab.rows.slice(0, lastValidRowIndex + 1);
    const rowStrings = rowsToCopy.map((row) => row.values.join("\t"));
    const copyString = rowStrings.join("\n");
    try {
      await navigator.clipboard.writeText(copyString);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      showAlert("エラー", "クリップボードへのコピーに失敗しました。");
    }
  };

  const handleContextMenu = (e: React.MouseEvent, rowIndex: number, customText?: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      rowIndex: rowIndex,
      customText: customText
    });
  };

  const handleCopySingleRow = async () => {
    if (contextMenu.customText !== undefined) {
      try {
        await navigator.clipboard.writeText(contextMenu.customText);
      } catch (err) {
        showAlert("エラー", "コピーに失敗しました。");
      }
    } else if (contextMenu.rowIndex !== null && activeTab) {
      const targetRow = activeTab.rows[contextMenu.rowIndex];
      const copyString = targetRow.values.join("\t");
      try {
        await navigator.clipboard.writeText(copyString);
      } catch (err) {
        showAlert("エラー", "コピーに失敗しました。");
      }
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleInsertRowAbove = () => {
    if (contextMenu.rowIndex === null || !activeTab) return;

    const newEmptyRow = {
      id: crypto.randomUUID(),
      values: Array(7).fill("")
    };

    const newRows = [...activeTab.rows];
    newRows.splice(contextMenu.rowIndex, 0, newEmptyRow);

    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleRowDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id && activeTab) {
      const oldIndex = activeTab.rows.findIndex((r) => r.id === active.id);
      const newIndex = activeTab.rows.findIndex((r) => r.id === over.id);
      const newRows = arrayMove(activeTab.rows, oldIndex, newIndex);
      setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, rows: newRows } : t)));
    }
  };

  const handleTabDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);
      setTabs(arrayMove(tabs, oldIndex, newIndex));
    }
  };

  const getDuplicateColors = useCallback(() => {
    if (!activeTab) return { rider: {}, horse: {} };
    const riderCounts: Record<string, number> = {};
    const horseCounts: Record<string, number> = {};

    activeTab.rows.forEach((r) => {
      const rider = r.values[2];
      const horse = r.values[4];
      if (rider) riderCounts[rider] = (riderCounts[rider] || 0) + 1;
      if (horse) horseCounts[horse] = (horseCounts[horse] || 0) + 1;
    });

    const riderColors: Record<string, string> = {};
    const horseColors: Record<string, string> = {};
    let colorIdx = 0;

    Object.keys(riderCounts).forEach((k) => {
      if (riderCounts[k] > 1) riderColors[k] = COLOR_PALETTE[(colorIdx++) % COLOR_PALETTE.length];
    });
    Object.keys(horseCounts).forEach((k) => {
      if (horseCounts[k] > 1) horseColors[k] = COLOR_PALETTE[(colorIdx++) % COLOR_PALETTE.length];
    });

    return { rider: riderColors, horse: horseColors };
  }, [activeTab]);

  const suggestions = useMemo(() => {
    const riders = new Set<string>();
    const horses = new Set<string>();
    const affiliations = new Set<string>();
    const allValues = new Set<string>();

    tabs.forEach((tab) => {
      tab.rows.forEach((row) => {
        row.values.forEach((v) => {
          const val = v.trim();
          if (val) allValues.add(val);
        });
        if (row.values[2].trim()) riders.add(row.values[2].trim());
        if (row.values[4].trim()) horses.add(row.values[4].trim());
        if (row.values[6].trim()) affiliations.add(row.values[6].trim());
      });
    });

    return {
      riders: Array.from(riders),
      horses: Array.from(horses),
      affiliations: Array.from(affiliations),
      all: Array.from(allValues)
    };
  }, [tabs]);

  // 全体検索候補のフィルタリング
  const filteredSearchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return suggestions.all.filter((item) => item.toLowerCase().includes(query)).slice(0, 10);
  }, [searchQuery, suggestions.all]);

  // 検索モーダル用の検索結果リスト
  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const results: SearchResult[] = [];
    tabs.forEach((tab) => {
      tab.rows.forEach((row, rowIndex) => {
        const match = row.values.some((val) => val.toLowerCase().includes(query));
        if (match) {
          results.push({
            tabId: tab.id,
            tabName: tab.name,
            rowIndex: rowIndex,
            row: row
          });
        }
      });
    });
    return results;
  }, [searchQuery, tabs]);

  const handleExecuteSearch = (queryToSearch?: string) => {
    const targetQuery = queryToSearch !== undefined ? queryToSearch : searchQuery;
    if (!targetQuery.trim()) {
      showAlert("検索エラー", "検索キーワードを入力してください。");
      return;
    }
    setSearchQuery(targetQuery);
    setIsSearchFocused(false);
    setIsSearchModalOpen(true);
  };

  const handleJumpToTab = (tabId: string) => {
    setActiveTabId(tabId);
    setIsSearchModalOpen(false);
  };

  if (!isLoaded || !activeTab) return null;

  const duplicateColors = getDuplicateColors();

  return (
    <div className="h-screen bg-slate-100 p-2 sm:p-3 font-sans text-slate-800 flex flex-col overflow-hidden">
      <div className="w-full max-w-[98%] xl:max-w-7xl mx-auto h-full flex flex-col min-h-0">
        
        {/* ヘッダー＆コントロール */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2 bg-white px-3.5 py-2.5 rounded-xl shadow-sm border border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xl" role="img" aria-label="horse">🐴</span>
              <h1 className="text-base font-bold tracking-tight text-slate-800 shrink-0">
                Order List Helper
              </h1>
            </div>
            <input
              type="text"
              placeholder="大会名を入力 (例: 第3回 〇〇馬術大会)"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              className="flex-1 text-xs sm:text-sm font-medium text-slate-700 placeholder-slate-400 border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none py-0.5 bg-transparent transition-colors min-w-[120px]"
            />
          </div>

          {/* 検索入力ウィンドウ */}
          <div className="relative min-w-[200px] sm:min-w-[260px] flex-1 max-w-sm">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="全シートから検索 (選手, 馬名, 所属...)"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                  setActiveSearchSuggestionIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (isSearchFocused && filteredSearchSuggestions.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveSearchSuggestionIndex((prev) => Math.min(prev + 1, filteredSearchSuggestions.length - 1));
                      return;
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveSearchSuggestionIndex((prev) => Math.max(prev - 1, 0));
                      return;
                    } else if (e.key === "Enter" && activeSearchSuggestionIndex >= 0) {
                      e.preventDefault();
                      const selected = filteredSearchSuggestions[activeSearchSuggestionIndex];
                      setSearchQuery(selected);
                      handleExecuteSearch(selected);
                      return;
                    }
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleExecuteSearch();
                  }
                }}
                className="w-full pl-8 pr-16 py-1 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all"
              />
              <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <button
                onClick={() => handleExecuteSearch()}
                className="absolute right-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition-colors"
              >
                検索
              </button>
            </div>

            {/* 検索結果候補ドロップダウン */}
            {isSearchFocused && filteredSearchSuggestions.length > 0 && (
              <div
                ref={searchDropdownRef}
                className="absolute top-full left-0 w-full mt-1 bg-white border border-emerald-200 shadow-2xl z-50 max-h-52 overflow-y-auto rounded-lg flex flex-col"
              >
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 bg-slate-50 border-b border-slate-100">
                  入力候補 (エンターで検索)
                </div>
                {filteredSearchSuggestions.map((suggestion, i) => {
                  const isActive = i === activeSearchSuggestionIndex;
                  return (
                    <div
                      key={suggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery(suggestion);
                        handleExecuteSearch(suggestion);
                      }}
                      className={`px-3 py-1.5 text-xs cursor-pointer border-b border-slate-50 last:border-none transition-colors flex items-center justify-between ${
                        isActive ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      <span><HighlightMatch text={suggestion} query={searchQuery} /></span>
                      <Search size={11} className="text-slate-300" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={requestClearAllData} className="flex items-center gap-1 bg-white border border-red-200 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm font-medium text-xs">
              <Trash2 size={13} /> 全クリア
            </button>
            <button onClick={exportData} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium text-xs">
              <Download size={13} /> 保存
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium text-xs">
              <Upload size={13} /> 読込
            </button>
            <input type="file" accept=".json" ref={fileInputRef} onChange={importData} className="hidden" />
          </div>
        </div>

        {/* タブ領域と右側のアクションボタン */}
        <div className="flex justify-between items-end px-1 mb-0 shrink-0">
          <div className="flex items-center mr-3 min-w-0" style={{ flex: "1 1 auto" }}>
            <button 
              onClick={() => scrollTabs("left")} 
              className="p-1 mb-0.5 bg-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-300 rounded-l-md transition-colors shrink-0"
              title="左へスクロール"
            >
              <ChevronLeft size={14} />
            </button>
            
            <div 
              ref={tabContainerRef} 
              className="flex overflow-x-auto overflow-y-hidden scroll-smooth" 
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <div className="flex gap-1 px-1">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
                  <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
                    {tabs.map((tab) => (
                      <SortableTab
                        key={tab.id}
                        tab={tab}
                        isActive={activeTabId === tab.id}
                        onSelect={setActiveTabId}
                        onUpdateName={updateTabName}
                        onDelete={requestDeleteTab}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            <button 
              onClick={() => scrollTabs("right")} 
              className="p-1 mb-0.5 bg-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-300 rounded-r-md transition-colors shrink-0"
              title="右へスクロール"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            <button 
              onClick={addTab} 
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-slate-300 rounded-t-md transition-colors text-xs font-medium"
            >
              <Plus size={13} /> タブ追加
            </button>
            
            <button 
              onClick={requestClearCurrentTab} 
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-100 rounded-t-md transition-colors text-xs font-medium"
              title="現在のタブのデータを空行にリセットします"
            >
              <Eraser size={13} /> タブ消去
            </button>

            <button 
              onClick={copyToClipboard} 
              className={`flex items-center gap-1 px-2.5 py-1 rounded-t-md transition-colors text-xs font-medium shadow-sm ${
                isCopied 
                  ? "bg-emerald-500 text-white" 
                  : "bg-white border border-slate-200 border-b-0 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {isCopied ? <Check size={13} /> : <Copy size={13} />}
              {isCopied ? "コピー完了" : "Excelコピー"}
            </button>
            
            <button 
              onClick={renumberOrder} 
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white hover:bg-slate-700 rounded-t-md transition-colors text-xs font-medium shadow-sm"
              title="出番を1番から順に振り直します"
            >
              <ListOrdered size={13} /> 出番振り直し
            </button>
          </div>
        </div>

        {/* 表領域 */}
        <div className="bg-white rounded-b-xl rounded-tl-xl shadow-lg border border-slate-200 flex-1 min-h-0 overflow-y-auto relative z-0">
          <table className="w-full border-collapse table-fixed">
            <colgroup>
              <col className="w-8" />
              {COLUMNS.map((col, idx) => (
                <col key={idx} className={col.width} />
              ))}
            </colgroup>
            <thead className="bg-slate-800 text-white sticky top-0 z-30 shadow-sm">
              <tr className="text-xs tracking-wider">
                <th className="py-2 px-1 font-medium"></th>
                {COLUMNS.map((col, idx) => (
                  <th key={idx} className="py-2 px-2 text-left font-semibold">{col.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
                <SortableContext items={activeTab.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {activeTab.rows.map((row, rowIndex) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      rowIndex={rowIndex}
                      updateCell={updateCell}
                      handlePaste={handlePaste}
                      duplicateColors={duplicateColors}
                      suggestions={suggestions}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </tbody>
          </table>
        </div>

      </div>

      {/* カスタム右クリックメニュー */}
      {contextMenu.visible && (
        <div
          className="fixed z-[150] bg-white border border-slate-200 shadow-xl rounded-lg py-1 min-w-[170px] overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            onClick={handleCopySingleRow}
            className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 transition-colors"
          >
            <Copy size={13} /> この行をコピー
          </button>
          {contextMenu.customText === undefined && (
            <button
              onClick={handleInsertRowAbove}
              className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 transition-colors"
            >
              <ArrowUpToLine size={13} /> 上に空行を追加
            </button>
          )}
        </div>
      )}

      {/* 全体検索結果モーダル */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* モーダルヘッダー */}
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold">
                  検索結果一覧
                </h3>
                <span className="text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full ml-2">
                  キーワード: 「<span className="text-emerald-300 font-semibold">{searchQuery}</span>」 ({searchResults.length}件該当)
                </span>
              </div>
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* モーダル本文（結果テーブル） */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {searchResults.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  該当するデータが見つかりませんでした。
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full border-collapse text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="py-2 px-3 border-r border-slate-200 bg-slate-200/60 w-32">対象競技 (タブ)</th>
                        {COLUMNS.map((col, idx) => (
                          <th key={idx} className="py-2 px-2.5 border-r border-slate-200 last:border-r-0">{col.name}</th>
                        ))}
                        <th className="py-2 px-3 text-center w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((result, idx) => {
                        const rowCopyStr = `${result.tabName}\t${result.row.values.join("\t")}`;
                        return (
                          <tr
                            key={`${result.tabId}-${result.rowIndex}-${idx}`}
                            onContextMenu={(e) => handleContextMenu(e, result.rowIndex, rowCopyStr)}
                            className="border-b border-slate-100 hover:bg-emerald-50/50 transition-colors group"
                          >
                            <td className="py-2 px-3 font-semibold text-emerald-900 bg-slate-50 border-r border-slate-200 group-hover:bg-emerald-100/40">
                              {result.tabName}
                            </td>
                            {result.row.values.map((val, cIdx) => (
                              <td key={cIdx} className="py-2 px-2.5 border-r border-slate-100 last:border-r-0 text-slate-700">
                                <HighlightMatch text={val} query={searchQuery} />
                              </td>
                            ))}
                            <td className="py-1.5 px-2 text-center">
                              <button
                                onClick={() => handleJumpToTab(result.tabId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px] transition-colors shadow-sm"
                                title="このタブに切り替えます"
                              >
                                <ExternalLink size={12} /> 移動
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <div>💡 検索結果の行を右クリックすると、その行のデータをコピーできます。</div>
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カスタム モーダル (アラート＆確認ポップアップ) */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4">
              <div className="flex items-center gap-2.5 mb-3">
                {modal.type === "confirm" ? (
                  <AlertTriangle className="text-amber-500 shrink-0" size={22} />
                ) : (
                  <Info className="text-emerald-500 shrink-0" size={22} />
                )}
                <h3 className="text-base font-bold text-slate-800">{modal.title}</h3>
              </div>
              <p className="text-slate-600 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {modal.message}
              </p>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-100">
              {modal.type === "confirm" && (
                <button 
                  onClick={closeModal} 
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
              )}
              <button 
                onClick={() => {
                  if (modal.onConfirm) modal.onConfirm();
                  closeModal();
                }} 
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${modal.type === "confirm" ? modal.confirmColor : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {modal.type === "confirm" ? modal.confirmLabel : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}